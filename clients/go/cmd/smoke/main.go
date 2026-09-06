package main

import (
	"context"
	"fmt"
	"os"
	"strconv"

	"github.com/ORESoftware/live-mutex/clients/go/livemutex"
)

func main() {
	host := os.Getenv("LMX_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := 6970
	if p := os.Getenv("LMX_PORT"); p != "" {
		if v, err := strconv.Atoi(p); err == nil {
			port = v
		}
	}
	addr := fmt.Sprintf("%s:%d", host, port)

	c, err := livemutex.Connect(addr)
	if err != nil {
		fmt.Fprintln(os.Stderr, "connect:", err)
		os.Exit(1)
	}
	defer func() { _ = c.Close() }()

	ctx := context.Background()

	g1, err := c.Acquire(ctx, "go-smoke", livemutex.LockOpts{TTLMs: 5_000})
	if err != nil {
		fmt.Fprintln(os.Stderr, "acquire #1:", err)
		os.Exit(1)
	}
	fmt.Printf("acquire #1: lockUuid=%s fencingToken=%d\n", g1.LockUUID, g1.FencingToken)
	if g1.FencingToken < 1 {
		fmt.Fprintln(os.Stderr, "missing fencing token")
		os.Exit(1)
	}
	if err := c.Release(ctx, "go-smoke", g1.LockUUID, false); err != nil {
		fmt.Fprintln(os.Stderr, "release #1:", err)
		os.Exit(1)
	}

	g2, err := c.Acquire(ctx, "go-smoke", livemutex.LockOpts{})
	if err != nil {
		fmt.Fprintln(os.Stderr, "acquire #2:", err)
		os.Exit(1)
	}
	fmt.Printf("acquire #2: lockUuid=%s fencingToken=%d\n", g2.LockUUID, g2.FencingToken)
	if g2.FencingToken <= g1.FencingToken {
		fmt.Fprintln(os.Stderr, "fencing tokens must be strictly monotonic per key")
		os.Exit(1)
	}
	if err := c.Release(ctx, "go-smoke", g2.LockUUID, false); err != nil {
		fmt.Fprintln(os.Stderr, "release #2:", err)
		os.Exit(1)
	}

	many, err := c.AcquireMany(ctx, []string{"go-many-a", "go-many-b", "go-many-c"}, 5_000)
	if err != nil {
		fmt.Fprintln(os.Stderr, "acquire-many:", err)
		os.Exit(1)
	}
	fmt.Printf("acquire_many: lockUuid=%s fencingTokens=%v\n", many.LockUUID, many.FencingTokens)
	if len(many.FencingTokens) != 3 {
		fmt.Fprintln(os.Stderr, "expected 3 fencing tokens")
		os.Exit(1)
	}
	if err := c.ReleaseMany(ctx, many.LockUUID); err != nil {
		fmt.Fprintln(os.Stderr, "release-many:", err)
		os.Exit(1)
	}

	fmt.Println("\u2705 go client smoke test passed")
}
