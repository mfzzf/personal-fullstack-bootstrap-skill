# Performance & Production Readiness

## Purpose

This reference covers the patterns that separate a working prototype from a system that survives real traffic. Read this after the initial slice works end-to-end, before deploying to any shared environment.

These patterns are ordered by blast radius — fix connection management before adding tracing.

---

## 1. Connection Pool Tuning

The default `pgxpool` settings are wrong for production. An unconfigured pool will either exhaust PG connections under load or hold idle connections that PG's `max_connections` counts against.

```go
config, _ := pgxpool.ParseConfig(databaseURL)

// Hard ceiling. PG default max_connections = 100.
// Leave headroom for admin, migrations, monitoring.
// Formula: (pool_max * num_instances) < pg_max_connections * 0.8
config.MaxConns = 20

// Kill idle connections before PG's idle_in_transaction_session_timeout.
config.MaxConnIdleTime = 5 * time.Minute

// Force reconnect to pick up PG config changes and avoid stale connections.
config.MaxConnLifetime = 30 * time.Minute

// Don't hold connections for cold-start; acquire on demand.
config.MinConns = 2

pool, err := pgxpool.NewWithConfig(ctx, config)
```

**Why these numbers matter**: A single Go instance with default pool (no max) under 50 concurrent requests will open 50 connections. Two instances = 100 connections = PG's default limit. Every new request after that blocks or fails.

### Health Check

```go
r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
    defer cancel()
    if err := pool.Ping(ctx); err != nil {
        http.Error(w, `{"status":"unhealthy"}`, 503)
        return
    }
    w.Write([]byte(`{"status":"ok"}`))
})
```

---

## 2. Graceful Shutdown

Without graceful shutdown, in-flight requests get killed on deploy, SSE connections drop without `done` events, and DB transactions roll back mid-write.

```go
srv := &http.Server{
    Addr:         ":" + port,
    Handler:      router,
    ReadTimeout:  15 * time.Second,
    WriteTimeout: 10 * time.Minute,  // SSE needs this long
    IdleTimeout:  60 * time.Second,
}

// Start
go func() { srv.ListenAndServe() }()

// Wait for interrupt
quit := make(chan os.Signal, 1)
signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
<-quit

// Graceful shutdown — give in-flight requests 30s to finish
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()
srv.Shutdown(ctx)
pool.Close()
```

**Key**: `srv.Shutdown(ctx)` stops accepting new connections but lets in-flight requests finish. SSE handlers see `ctx.Done()` and send their `done` event.

---

## 3. Context Propagation

Every goroutine spawned from an HTTP handler must respect the request context or use `context.Background()` with an explicit timeout. Leaked goroutines accumulate and eventually OOM.

```go
// WRONG — goroutine outlives request but uses request context
go func() {
    s.doWork(r.Context(), taskID) // ctx cancelled when client disconnects
}()

// RIGHT — detach from request, use background with timeout
go func() {
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
    defer cancel()
    s.doWork(ctx, taskID)
}()
```

For async tasks that must outlive the HTTP request (reconciliation, report generation), always use `context.Background()` with a deadline.

---

## 4. Database Migration Safety

Sequential SQL file execution without locking is a race condition when multiple instances start simultaneously.

### Advisory Lock Pattern

```go
func runMigrations(pool *pgxpool.Pool, dir string) error {
    conn, _ := pool.Acquire(context.Background())
    defer conn.Release()

    // Advisory lock — only one instance runs migrations at a time.
    // The lock ID is arbitrary but must be consistent across instances.
    _, err := conn.Exec(context.Background(),
        "SELECT pg_advisory_lock(42)")
    if err != nil { return err }
    defer conn.Exec(context.Background(),
        "SELECT pg_advisory_unlock(42)")

    // Now safe to check and apply migrations
    // ...
}
```

### Migration Table

```sql
CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Check `filename` existence before applying. Wrap each migration in a transaction when possible (DDL in PG is transactional).

---

## 5. Pagination

**Never return unbounded result sets.** Every list endpoint must support cursor or offset pagination from day one.

### Cursor Pagination (preferred for feeds/timelines)

```go
func (r *TaskRepo) List(ctx context.Context, cursor *time.Time, limit int) ([]Task, error) {
    if limit <= 0 || limit > 100 {
        limit = 20
    }
    query := `
        SELECT id, status, name, created_at
        FROM reconciliation_tasks
        WHERE ($1::timestamptz IS NULL OR created_at < $1)
        ORDER BY created_at DESC
        LIMIT $2
    `
    rows, err := r.pool.Query(ctx, query, cursor, limit+1)
    // If len(results) > limit, there's a next page
}
```

### Frontend

```typescript
interface PaginatedResponse<T> {
  items: T[];
  next_cursor?: string;
  has_more: boolean;
}
```

Always pass `limit` as a query parameter. Default 20, max 100.

---

## 6. Structured Error Responses

Raw `http.Error(w, "message", 500)` is unparseable by frontends and useless for debugging.

### Standard Error Envelope

```go
type APIError struct {
    Code    string `json:"code"`              // machine-readable: "not_found", "validation_failed"
    Message string `json:"message"`           // human-readable
    Details any    `json:"details,omitempty"`  // field errors, constraints
}

func writeError(w http.ResponseWriter, status int, code, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(APIError{Code: code, Message: message})
}
```

### Frontend Error Handling

```typescript
class ApiError extends Error {
  code: string;
  status: number;
  constructor(body: { code: string; message: string }, status: number) {
    super(body.message);
    this.code = body.code;
    this.status = status;
  }
}
```

Errors like `validation_failed` carry `details` with field-level messages. The frontend renders them inline.

---

## 7. SSE with LISTEN/NOTIFY (replacing DB polling)

Polling the DB every second per SSE connection doesn't scale. At 100 concurrent viewers, that's 100 QPS of pure overhead.

### PostgreSQL LISTEN/NOTIFY

```go
// Producer (in service.go, after inserting event):
pool.Exec(ctx, "SELECT pg_notify('task_events', $1)", taskID.String())

// Consumer (in SSE handler):
conn, _ := pool.Acquire(ctx)
defer conn.Release()
conn.Exec(ctx, "LISTEN task_events")

for {
    notification, err := conn.Conn().WaitForNotification(ctx)
    if err != nil { return } // client disconnected or timeout
    if notification.Payload == taskID.String() {
        // Fetch new events from DB and send
        events, _ := service.GetEventsAfter(ctx, taskID, lastID)
        for _, ev := range events {
            fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.EventType, ev.Data)
            lastID = ev.ID
        }
        flusher.Flush()
    }
}
```

**Advantage**: Zero DB queries when nothing happens. Notification arrives within milliseconds of insert. One PG connection per SSE client (vs one query per second per client).

**Fallback**: If LISTEN/NOTIFY adds too much complexity for the initial slice, use the polling approach but document it as tech debt with a clear migration path.

---

## 8. Caching Strategy

### Read-Through Cache for Hot Paths

For list pages and repeated detail fetches:

```go
type CachedTaskRepo struct {
    repo  *TaskRepo
    cache *sync.Map  // or use github.com/dgraph-io/ristretto for LRU+TTL
}

func (c *CachedTaskRepo) GetByID(ctx context.Context, id uuid.UUID) (*Task, error) {
    key := "task:" + id.String()
    if v, ok := c.cache.Load(key); ok {
        return v.(*Task), nil
    }
    task, err := c.repo.GetByID(ctx, id)
    if err != nil { return nil, err }
    c.cache.Store(key, task)
    return task, nil
}
```

### Cache Invalidation

Invalidate on write. For single-instance deployments, `sync.Map` is fine. For multi-instance, use Redis or PG LISTEN/NOTIFY to broadcast invalidation.

### Frontend: SWR/stale-while-revalidate

```typescript
// In the API proxy or client wrapper
const headers = new Headers();
headers.set("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
```

For task lists: 5s cache + 30s stale-while-revalidate. The list refreshes in the background while the user sees instant results.

---

## 9. Rate Limiting

Protect against runaway clients and abuse, especially for expensive endpoints (task creation, file upload, AI analysis).

### Token Bucket per IP (middleware)

```go
import "golang.org/x/time/rate"

var limiters sync.Map

func rateLimitMiddleware(rps float64, burst int) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := r.RemoteAddr
            val, _ := limiters.LoadOrStore(ip, rate.NewLimiter(rate.Limit(rps), burst))
            limiter := val.(*rate.Limiter)
            if !limiter.Allow() {
                writeError(w, 429, "rate_limited", "Too many requests")
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

// Usage
r.With(rateLimitMiddleware(10, 20)).Post("/api/tasks", taskHandler.Create)
r.With(rateLimitMiddleware(2, 5)).Post("/api/files/upload", fileHandler.Upload)
```

---

## 10. Observability — OpenTelemetry + ClickHouse

Structured logging is the minimum. For production systems, implement the full observability trinity: **traces, metrics, logs** — all flowing through OpenTelemetry into ClickHouse.

### Why ClickHouse

- Columnar storage compresses trace/log data 10-30x vs PostgreSQL
- Sub-second aggregation over billions of spans
- Native support for OpenTelemetry schema
- Free with SigNoz, Uptrace, or self-hosted

### Architecture

```
Go Service → OTLP exporter → OTel Collector → ClickHouse
                                            → Prometheus (metrics)
                                            → stdout (logs fallback)
```

### Trace Setup (Go)

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

func initTracer(ctx context.Context, serviceName, otlpEndpoint string) (*sdktrace.TracerProvider, error) {
    exporter, err := otlptracehttp.New(ctx,
        otlptracehttp.WithEndpoint(otlpEndpoint),
        otlptracehttp.WithInsecure(),
    )
    if err != nil { return nil, err }

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(serviceName),
        )),
        sdktrace.WithSampler(sdktrace.ParentBased(
            sdktrace.TraceIDRatioBased(0.1), // 10% sampling in prod
        )),
    )
    otel.SetTracerProvider(tp)
    return tp, nil
}
```

### Auto-Instrumentation Middleware

```go
import "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

// Wrap chi router
handler := otelhttp.NewHandler(router, "api-server")
srv := &http.Server{Handler: handler}
```

This automatically creates spans for every HTTP request with method, path, status, duration.

### Database Tracing

```go
import "github.com/exaring/otelpgx"

config, _ := pgxpool.ParseConfig(databaseURL)
config.ConnConfig.Tracer = otelpgx.NewTracer()
pool, _ := pgxpool.NewWithConfig(ctx, config)
```

Every SQL query now appears as a child span with query text, duration, and row count.

### Custom Spans for Business Logic

```go
func (s *Service) runReconciliation(ctx context.Context, taskID uuid.UUID) {
    ctx, span := otel.Tracer("reconciliation").Start(ctx, "runReconciliation",
        trace.WithAttributes(attribute.String("task_id", taskID.String())),
    )
    defer span.End()

    // Agent call span
    ctx2, agentSpan := otel.Tracer("reconciliation").Start(ctx, "agent.stream")
    body, err := s.reconciler.ReconcileStream(ctx2, ...)
    agentSpan.SetAttributes(attribute.Int("events_count", eventCount))
    agentSpan.End()
}
```

### Metrics

```go
import (
    "go.opentelemetry.io/otel/metric"
    "go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
)

meter := otel.Meter("reconciliation")
taskCounter, _ := meter.Int64Counter("tasks.created")
taskDuration, _ := meter.Float64Histogram("tasks.duration_seconds",
    metric.WithDescription("Time to complete a reconciliation task"),
    metric.WithExplicitBucketBoundaries(1, 5, 10, 30, 60, 120, 300),
)

// In handler
taskCounter.Add(ctx, 1, metric.WithAttributes(
    attribute.String("supplier", supplierName),
))
taskDuration.Record(ctx, duration.Seconds())
```

### Structured Logging with Trace Correlation

```go
import "log/slog"

// Add trace_id and span_id to every log line
func traceHandler(base slog.Handler) slog.Handler {
    return &tracingHandler{base: base}
}

type tracingHandler struct{ base slog.Handler }

func (h *tracingHandler) Handle(ctx context.Context, r slog.Record) error {
    span := trace.SpanFromContext(ctx)
    if span.SpanContext().IsValid() {
        r.AddAttrs(
            slog.String("trace_id", span.SpanContext().TraceID().String()),
            slog.String("span_id", span.SpanContext().SpanID().String()),
        )
    }
    return h.base.Handle(ctx, r)
}

logger := slog.New(traceHandler(slog.NewJSONHandler(os.Stdout, nil)))
```

Now every log line carries `trace_id` — click it in SigNoz/Grafana to see the full trace.

### Docker Compose Integration

```yaml
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel/config.yaml"]
    volumes:
      - ./otel-config.yaml:/etc/otel/config.yaml
    ports:
      - "4318:4318"   # OTLP HTTP

  clickhouse:
    image: clickhouse/clickhouse-server:latest
    ports:
      - "8123:8123"   # HTTP
      - "9000:9000"   # Native
    volumes:
      - clickhouse-data:/var/lib/clickhouse

  signoz:  # or uptrace — pick one
    image: signoz/signoz:latest
    depends_on: [clickhouse, otel-collector]
    ports:
      - "3301:3301"

  api:
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4318"
      OTEL_SERVICE_NAME: "api"
```

### Sampling Strategy

- **Development**: 100% sampling (`sdktrace.AlwaysSample()`)
- **Production < 1k RPS**: 10% sampling (`TraceIDRatioBased(0.1)`)
- **Production > 1k RPS**: 1% or tail-based sampling at collector level
- **Errors**: Always sample (`ParentBased` with `AlwaysSample` for error spans)

### What to Monitor (non-negotiable dashboards)

| Metric | Alert Threshold |
|--------|----------------|
| p99 latency | > 2s for API, > 5min for tasks |
| Error rate (5xx) | > 1% |
| PG connection pool utilization | > 80% |
| Active SSE connections | > 500 |
| Task queue depth (pending) | > 50 |
| Goroutine count | > 10,000 |

---

## 11. Request Timeout Middleware

Prevent slow handlers from holding connections indefinitely:

```go
import "github.com/go-chi/chi/v5/middleware"

// 30s for normal endpoints
r.Use(middleware.Timeout(30 * time.Second))

// SSE and long-running endpoints opt out individually
r.With(middleware.Timeout(10 * time.Minute)).Get("/api/tasks/{taskId}/stream", ...)
```

---

## 12. Batch Operations for N+1 Queries

The current `List()` does N+1 queries: one for tasks, then one per task for files.

```go
// WRONG: N+1
for rows.Next() {
    files, _ := r.GetTaskFiles(ctx, t.ID) // 1 query per task
    t.Files = files
}

// RIGHT: batch load
func (r *TaskRepo) ListWithFiles(ctx context.Context) ([]Task, error) {
    tasks := r.listTasks(ctx)
    taskIDs := extractIDs(tasks)
    fileMap := r.batchLoadFiles(ctx, taskIDs)  // 1 query for all files
    for i := range tasks {
        tasks[i].Files = fileMap[tasks[i].ID]
    }
    return tasks, nil
}
```

The batch query:
```sql
SELECT tf.task_id, tf.file_id, tf.role, uf.filename
FROM task_files tf JOIN uploaded_files uf ON uf.id = tf.file_id
WHERE tf.task_id = ANY($1)
ORDER BY tf.task_id, tf.role
```

---

## Priority Order

When bootstrapping, implement in this order:
1. **Connection pool tuning** — prevents cascading failures
2. **Graceful shutdown** — prevents data loss on deploy
3. **Structured errors** — unblocks frontend error handling
4. **Pagination** — prevents OOM on growing data
5. **OpenTelemetry + structured logging** — enables debugging and monitoring
6. **Context propagation** — prevents goroutine leaks
7. **Migration safety** — prevents multi-instance races
8. **Request timeouts** — prevents connection exhaustion
9. **Batch queries** — prevents N+1 at scale
10. **Rate limiting** — prevents abuse
11. **Caching** — improves latency
12. **LISTEN/NOTIFY** — replaces SSE polling
13. **ClickHouse + dashboards** — long-term observability storage

---

## 14. pprof Endpoints

Register `net/http/pprof` on a **separate admin port** — never expose it on the public API.

```go
import _ "net/http/pprof" // registers handlers on DefaultServeMux

func startAdminServer() {
    adminMux := http.DefaultServeMux // pprof already registered here
    adminMux.HandleFunc("/healthz", healthHandler)

    adminSrv := &http.Server{
        Addr:    ":6060",
        Handler: adminMux,
    }
    go adminSrv.ListenAndServe()
}
```

### Profiling Workflow

```bash
# CPU profile (30 seconds)
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30

# Heap (current allocations)
go tool pprof http://localhost:6060/debug/pprof/heap

# Goroutine dump (find leaks)
go tool pprof http://localhost:6060/debug/pprof/goroutine

# Generate flame graph (requires graphviz)
go tool pprof -http=:8090 http://localhost:6060/debug/pprof/profile?seconds=30
```

**When to profile**: p99 latency spike → CPU profile. Memory growing → heap profile. Goroutine count alert → goroutine profile. Always profile in a staging environment that mirrors production load.

---

## 15. Connection Pool Monitoring

Expose `pgxpool.Stat()` as OTel metrics so you see pool exhaustion before it becomes an outage.

```go
func monitorPool(pool *pgxpool.Pool, meter metric.Meter) {
    acquireCount, _ := meter.Int64ObservableGauge("db.pool.acquire_count")
    totalConns, _ := meter.Int64ObservableGauge("db.pool.total_conns")
    idleConns, _ := meter.Int64ObservableGauge("db.pool.idle_conns")
    maxConns, _ := meter.Int64ObservableGauge("db.pool.max_conns")

    meter.RegisterCallback(func(_ context.Context, o metric.Observer) error {
        stat := pool.Stat()
        o.ObserveInt64(acquireCount, stat.AcquireCount())
        o.ObserveInt64(totalConns, int64(stat.TotalConns()))
        o.ObserveInt64(idleConns, int64(stat.IdleConns()))
        o.ObserveInt64(maxConns, int64(stat.MaxConns()))
        return nil
    }, acquireCount, totalConns, idleConns, maxConns)
}
```

**Dashboard query**: `db.pool.total_conns / db.pool.max_conns > 0.8` → alert. This catches connection exhaustion 5-10 minutes before requests start failing.

---

## 16. Benchmark Pattern

Use `testing.B` for hot-path functions. Run before and after optimization to prove improvement.

```go
func BenchmarkTaskRepo_List(b *testing.B) {
    pool := setupBenchDB(b) // Shared container, pre-seeded with 10k rows
    repo := postgres.NewTaskRepo(pool)
    ctx := context.Background()

    b.ResetTimer()
    b.ReportAllocs()

    for i := 0; i < b.N; i++ {
        _, err := repo.List(ctx, nil, 20)
        if err != nil {
            b.Fatal(err)
        }
    }
}

// Comparison benchmark: cursor vs offset
func BenchmarkPagination(b *testing.B) {
    pool := setupBenchDB(b)
    repo := postgres.NewTaskRepo(pool)
    ctx := context.Background()

    b.Run("cursor", func(b *testing.B) {
        b.ReportAllocs()
        for i := 0; i < b.N; i++ {
            repo.ListByCursor(ctx, nil, 20)
        }
    })

    b.Run("offset_page_1", func(b *testing.B) {
        b.ReportAllocs()
        for i := 0; i < b.N; i++ {
            repo.ListByOffset(ctx, 0, 20)
        }
    })

    b.Run("offset_page_500", func(b *testing.B) {
        b.ReportAllocs()
        for i := 0; i < b.N; i++ {
            repo.ListByOffset(ctx, 10000, 20)
        }
    })
}
```

Run: `go test -bench=. -benchmem -count=5 ./internal/infrastructure/persistence/postgres/`

**Rule**: Always use `-count=5` or higher to get statistically meaningful results. Use `benchstat` to compare before/after.
