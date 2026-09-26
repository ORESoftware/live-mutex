// Package livemutex is a Go client for the live-mutex broker.
//
// Speaks the broker's NDJSON-over-TCP wire protocol. A single Client
// multiplexes many concurrent acquire/release/acquire-many requests
// over one connection by correlating on a per-request UUID.
//
// This client targets Broker1 and therefore treats a successful grant without
// a positive, exact fencing token as a protocol error. Authority values are
// decoded with json.Number rather than float64 so they can never be silently
// rounded before validation.
package livemutex

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ProtocolVersion is the wire-protocol version sent in the version handshake.
const ProtocolVersion = "0.2.25"

// MaxFencingToken is the largest authority token the Broker1 JSON protocol may
// mint. It matches JavaScript's exact integer domain. Servers must fail closed
// instead of issuing a larger numeric JSON value.
const MaxFencingToken uint64 = 9007199254740991

var (
	ErrConnectionClosed = errors.New("livemutex: connection closed")
	ErrTimeout          = errors.New("livemutex: request timed out")
	ErrInvalidFence     = errors.New("livemutex: invalid or missing fencing token")
)

type LockGrant struct {
	Key              string
	LockUUID         string
	FencingToken     uint64
	LockRequestCount uint64
}

type AcquireManyGrant struct {
	Keys          []string
	LockUUID      string
	FencingTokens map[string]uint64
}

type LockOpts struct {
	TTLMs uint64
	Max   uint32
}

type Client struct {
	conn           net.Conn
	writer         *bufio.Writer
	writeMu        sync.Mutex
	inflight       sync.Map // map[string]chan map[string]any
	pid            int
	requestTimeout time.Duration
	closed         chan struct{}
}

func Connect(addr string) (*Client, error) {
	return ConnectWithTimeout(addr, 60*time.Second)
}

func ConnectWithTimeout(addr string, requestTimeout time.Duration) (*Client, error) {
	conn, err := net.DialTimeout("tcp", addr, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("livemutex: dial %s: %w", addr, err)
	}
	if tcp, ok := conn.(*net.TCPConn); ok {
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

func (c *Client) Close() error {
	select {
	case <-c.closed:
		return nil
	default:
	}
	close(c.closed)
	err := c.conn.Close()
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

// exactUint accepts only canonical non-negative integer JSON/string values.
// For fencing tokens callers additionally require 1..MaxFencingToken.
func exactUint(value any) (uint64, bool) {
	var text string
	switch v := value.(type) {
	case json.Number:
		text = v.String()
	case string:
		text = v
	case uint64:
		return v, true
	case int:
		if v < 0 {
			return 0, false
		}
		return uint64(v), true
	default:
		return 0, false
	}
	if text == "" {
		return 0, false
	}
	if len(text) > 1 && text[0] == '0' {
		return 0, false
	}
	for _, r := range text {
		if r < '0' || r > '9' {
			return 0, false
		}
	}
	u, err := strconv.ParseUint(text, 10, 64)
	return u, err == nil
}

func exactFence(value any) (uint64, error) {
	u, ok := exactUint(value)
	if !ok || u == 0 || u > MaxFencingToken {
		return 0, ErrInvalidFence
	}
	return u, nil
}

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
	fence, err := exactFence(reply["fencingToken"])
	if err != nil {
		return nil, fmt.Errorf("%w on acquired key %q", err, key)
	}
	g := &LockGrant{Key: key, LockUUID: requestUUID, FencingToken: fence}
	if v, ok := exactUint(reply["lockRequestCount"]); ok {
		g.LockRequestCount = v
	}
	return g, nil
}

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

func (c *Client) AcquireMany(ctx context.Context, keys []string, ttlMs uint64) (*AcquireManyGrant, error) {
	if len(keys) == 0 {
		return nil, errors.New("livemutex: AcquireMany requires at least one key")
	}
	requestUUID := uuid.NewString()
	payload := map[string]any{"type": "acquire-many", "uuid": requestUUID, "keys": keys}
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
	g := &AcquireManyGrant{LockUUID: "", FencingTokens: map[string]uint64{}}
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
	m, ok := reply["fencingTokens"].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("%w: acquire-many omitted fencingTokens", ErrInvalidFence)
	}
	for _, key := range g.Keys {
		fence, err := exactFence(m[key])
		if err != nil {
			return nil, fmt.Errorf("%w for acquire-many key %q", err, key)
		}
		g.FencingTokens[key] = fence
	}
	if len(g.FencingTokens) != len(g.Keys) {
		return nil, fmt.Errorf("%w: acquire-many token/key cardinality mismatch", ErrInvalidFence)
	}
	return g, nil
}

func (c *Client) ReleaseMany(ctx context.Context, lockUUID string) error {
	requestUUID := uuid.NewString()
	payload := map[string]any{"type": "release-many", "uuid": requestUUID, "lockUuid": lockUUID}
	reply, err := c.awaitReply(ctx, requestUUID, payload)
	if err != nil {
		return err
	}
	if released, _ := reply["released"].(bool); !released {
		return fmt.Errorf("livemutex: release-many rejected: %v", reply["error"])
	}
	return nil
}

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
		dec := json.NewDecoder(bytes.NewReader(scanner.Bytes()))
		dec.UseNumber()
		if err := dec.Decode(&msg); err != nil {
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
