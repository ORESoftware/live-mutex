// Package livemutex is a Go client for the live-mutex broker.
//
// Speaks the broker's NDJSON-over-TCP wire protocol. A single Client
// multiplexes many concurrent acquire/release/acquire-many requests
// over one connection by correlating on a per-request UUID.
//
// Minimal by design — covers the new wire features (fencing tokens,
// acquire-many, broker-side max validation) and the basic
// lock/unlock flow, but not RW locks or the legacy lock-received
// ack (the broker's centralised TTL sweeper handles clients that
// skip the ack).
package livemutex

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ProtocolVersion is the wire-protocol version sent in the version
// handshake. Must match the broker; the broker only rejects strictly-
// older clients, so revving this is forward-safe.
const ProtocolVersion = "0.2.25"

var (
	// ErrConnectionClosed is returned when an in-flight request is
	// interrupted by the underlying socket closing.
	ErrConnectionClosed = errors.New("livemutex: connection closed")
	// ErrTimeout is returned when a request hasn't received a reply
	// within the configured request timeout.
	ErrTimeout = errors.New("livemutex: request timed out")
)

// LockGrant is the result of a successful acquire.
type LockGrant struct {
	Key              string
	LockUUID         string
	FencingToken     uint64 // 0 if the broker pre-dates fencing-token support.
	LockRequestCount uint64
}

// AcquireManyGrant is the result of a successful acquire-many.
type AcquireManyGrant struct {
	Keys          []string
	LockUUID      string
	FencingTokens map[string]uint64
}

// LockOpts customises an acquire call.
type LockOpts struct {
	// TTLMs is the lock TTL in milliseconds. Zero means "use broker
	// default" (lockExpiresAfter, default 5s).
	TTLMs uint64
	// Max is the per-key concurrency level. Zero means "leave broker
	// default in place" (mutex, max=1). Values < 1 are rejected by
	// the broker and surface as an error here.
	Max uint32
}

// Client is a thread-safe live-mutex client. The zero value is not
// usable — call Connect.
type Client struct {
	conn           net.Conn
	writer         *bufio.Writer
	writeMu        sync.Mutex
	inflight       sync.Map // map[string]chan map[string]any
	pid            int
	requestTimeout time.Duration
	closed         chan struct{}
}

// Connect dials the broker and sends the version handshake.
func Connect(addr string) (*Client, error) {
	return ConnectWithTimeout(addr, 60*time.Second)
}

// ConnectWithTimeout is like Connect but uses a custom per-request
// timeout (the underlying TCP dial uses 30s).
func ConnectWithTimeout(addr string, requestTimeout time.Duration) (*Client, error) {
	conn, err := net.DialTimeout("tcp", addr, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("livemutex: dial %s: %w", addr, err)
	}
	if tcp, ok := conn.(*net.TCPConn); ok {
		// TCP_NODELAY mirrors the canonical broker default.
		_ = tcp.SetNoDelay(true)
	}
	c := &Client{
		conn:           conn,
		writer:         bufio.NewWriter(conn),
		pid:            os.Getpid(),
		requestTimeout: requestTimeout,
		closed:         make(chan struct{}),
	}
	if err := c.send(map[string]any{"type": "version", "value": ProtocolVersion}); err != nil {
		_ = conn.Close()
		return nil, err
	}
	go c.readLoop()
	return c, nil
}

// Close terminates the connection. Safe to call from multiple goroutines.
func (c *Client) Close() error {
	select {
	case <-c.closed:
		return nil
	default:
	}
	close(c.closed)
	err := c.conn.Close()
	// Wake up any in-flight callers.
	c.inflight.Range(func(k, v any) bool {
		ch := v.(chan map[string]any)
		select {
		case ch <- nil:
		default:
		}
		return true
	})
	return err
}

// Acquire takes an exclusive lock on key (or a semaphore slot if
// opts.Max > 1).
func (c *Client) Acquire(ctx context.Context, key string, opts LockOpts) (*LockGrant, error) {
	requestUUID := uuid.NewString()
	payload := map[string]any{
		"type":                "lock",
		"uuid":                requestUUID,
		"key":                 key,
		"pid":                 c.pid,
		"keepLocksAfterDeath": false,
	}
	if opts.TTLMs > 0 {
		payload["ttl"] = opts.TTLMs
	} else {
		payload["ttl"] = nil
	}
	if opts.Max > 0 {
		payload["max"] = opts.Max
	}
	reply, err := c.awaitReply(ctx, requestUUID, payload)
	if err != nil {
		return nil, err
	}
	if acquired, _ := reply["acquired"].(bool); !acquired {
		return nil, fmt.Errorf("livemutex: lock not acquired: %v", reply["error"])
	}
	g := &LockGrant{
		Key:      key,
		LockUUID: requestUUID,
	}
	if v, ok := reply["fencingToken"].(float64); ok {
		g.FencingToken = uint64(v)
	}
	if v, ok := reply["lockRequestCount"].(float64); ok {
		g.LockRequestCount = uint64(v)
	}
	return g, nil
}

// Release frees a previously-acquired lock.
func (c *Client) Release(ctx context.Context, key, lockUUID string, force bool) error {
	requestUUID := uuid.NewString()
	payload := map[string]any{
		"type":  "unlock",
		"uuid":  requestUUID,
		"_uuid": lockUUID,
		"key":   key,
		"force": force,
	}
	reply, err := c.awaitReply(ctx, requestUUID, payload)
	if err != nil {
		return err
	}
	if unlocked, _ := reply["unlocked"].(bool); !unlocked {
		return fmt.Errorf("livemutex: unlock rejected: %v", reply["error"])
	}
	return nil
}

// AcquireMany takes a union-style hold on every key. Either every
// key is granted or none is — failure is surfaced as an error,
// optionally including the contended key in the message.
func (c *Client) AcquireMany(ctx context.Context, keys []string, ttlMs uint64) (*AcquireManyGrant, error) {
	if len(keys) == 0 {
		return nil, errors.New("livemutex: AcquireMany requires at least one key")
	}
	requestUUID := uuid.NewString()
	payload := map[string]any{
		"type": "acquire-many",
		"uuid": requestUUID,
		"keys": keys,
	}
	if ttlMs > 0 {
		payload["ttl"] = ttlMs
	} else {
		payload["ttl"] = nil
	}
	reply, err := c.awaitReply(ctx, requestUUID, payload)
	if err != nil {
		return nil, err
	}
	if acquired, _ := reply["acquired"].(bool); !acquired {
		why := "rejected"
		if e, ok := reply["error"].(string); ok && e != "" {
			why = e
		} else if k, ok := reply["contendedKey"].(string); ok && k != "" {
			why = "contended on " + k
		}
		return nil, fmt.Errorf("livemutex: acquire-many %s", why)
	}
	g := &AcquireManyGrant{LockUUID: ""}
	if s, ok := reply["lockUuid"].(string); ok {
		g.LockUUID = s
	}
	if arr, ok := reply["keys"].([]any); ok {
		for _, v := range arr {
			if s, ok := v.(string); ok {
				g.Keys = append(g.Keys, s)
			}
		}
	}
	if g.Keys == nil {
		g.Keys = append([]string(nil), keys...)
	}
	g.FencingTokens = map[string]uint64{}
	if m, ok := reply["fencingTokens"].(map[string]any); ok {
		for k, v := range m {
			if f, ok := v.(float64); ok {
				g.FencingTokens[k] = uint64(f)
			}
		}
	}
	return g, nil
}

// ReleaseMany releases an acquire-many grant by its lock UUID.
func (c *Client) ReleaseMany(ctx context.Context, lockUUID string) error {
	requestUUID := uuid.NewString()
	payload := map[string]any{
		"type":     "release-many",
		"uuid":     requestUUID,
		"lockUuid": lockUUID,
	}
	reply, err := c.awaitReply(ctx, requestUUID, payload)
	if err != nil {
		return err
	}
	if released, _ := reply["released"].(bool); !released {
		return fmt.Errorf("livemutex: release-many rejected: %v", reply["error"])
	}
	return nil
}

// --- internals ---

func (c *Client) send(payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	if _, err := c.writer.Write(data); err != nil {
		return err
	}
	if err := c.writer.WriteByte('\n'); err != nil {
		return err
	}
	return c.writer.Flush()
}

func (c *Client) awaitReply(ctx context.Context, requestUUID string, payload map[string]any) (map[string]any, error) {
	ch := make(chan map[string]any, 1)
	c.inflight.Store(requestUUID, ch)
	defer c.inflight.Delete(requestUUID)

	if err := c.send(payload); err != nil {
		return nil, err
	}

	timeout := time.NewTimer(c.requestTimeout)
	defer timeout.Stop()

	select {
	case reply := <-ch:
		if reply == nil {
			return nil, ErrConnectionClosed
		}
		return reply, nil
	case <-timeout.C:
		return nil, ErrTimeout
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-c.closed:
		return nil, ErrConnectionClosed
	}
}

func (c *Client) readLoop() {
	scanner := bufio.NewScanner(c.conn)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		var msg map[string]any
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			continue
		}
		requestUUID, _ := msg["uuid"].(string)
		if requestUUID == "" {
			continue
		}
		if v, ok := c.inflight.Load(requestUUID); ok {
			ch := v.(chan map[string]any)
			select {
			case ch <- msg:
			default:
			}
		}
	}
	_ = c.Close()
}
