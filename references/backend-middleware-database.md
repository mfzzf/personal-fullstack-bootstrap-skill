# Backend Middleware & Database Patterns

## Purpose

Production backend patterns beyond basic CRUD — auth, middleware chains, database indexing, query optimization, and external service integration.

---

## 1. Middleware Chain Architecture

chi middleware executes in LIFO order (last registered = outermost). Order matters.

```go
r := chi.NewRouter()

// Outermost → innermost (execution order: top → bottom for request, bottom → top for response)
r.Use(middleware.RealIP)                    // 1. Extract real IP from proxy headers
r.Use(middleware.RequestID)                 // 2. Generate X-Request-Id
r.Use(requestLogger)                       // 3. Log with request_id and trace_id
r.Use(middleware.Recoverer)                 // 4. Panic recovery → 500
r.Use(corsMiddleware)                       // 5. CORS headers
r.Use(middleware.Compress(5))               // 6. gzip responses > 512 bytes
r.Use(middleware.Timeout(30 * time.Second)) // 7. Default timeout

// Per-route middleware
r.Route("/api", func(r chi.Router) {
    r.Use(authMiddleware)                   // Auth on all /api routes
    r.With(rateLimiter(2, 5)).Post("/tasks", createTask)   // Expensive
    r.With(rateLimiter(30, 60)).Get("/tasks", listTasks)   // Cheap
    r.With(noTimeout).Get("/tasks/{id}/stream", streamTask) // SSE: no timeout
})
```

### Request ID Propagation

```go
// Extract in handlers and pass to service layer
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
    requestID := middleware.GetReqID(r.Context())
    slog.InfoContext(r.Context(), "creating task", "request_id", requestID)
    // ...
}
```

---

## 2. Auth Middleware Patterns

### JWT Validation

```go
func jwtAuth(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
        if token == "" {
            writeError(w, 401, "unauthorized", "missing token")
            return
        }

        claims, err := validateJWT(token)
        if err != nil {
            writeError(w, 401, "unauthorized", "invalid token")
            return
        }

        // Inject user into context
        ctx := context.WithValue(r.Context(), userCtxKey, claims)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Extract in handlers
func currentUser(ctx context.Context) *UserClaims {
    u, _ := ctx.Value(userCtxKey).(*UserClaims)
    return u
}
```

### API Key Auth (simpler, for internal/B2B)

```go
func apiKeyAuth(validKeys map[string]string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            key := r.Header.Get("X-API-Key")
            owner, ok := validKeys[key]
            if !ok {
                writeError(w, 401, "unauthorized", "invalid API key")
                return
            }
            ctx := context.WithValue(r.Context(), apiKeyOwnerCtxKey, owner)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

---

## 3. CORS Configuration

Default `AllowedOrigins: *` is fine for dev. Production needs explicit origins.

```go
cors.Handler(cors.Options{
    AllowedOrigins:   []string{"https://app.example.com", "https://admin.example.com"},
    AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
    AllowedHeaders:   []string{"Authorization", "Content-Type", "X-Request-ID"},
    ExposedHeaders:   []string{"Content-Disposition", "X-Request-ID"},
    AllowCredentials: true,
    MaxAge:           3600, // 1 hour preflight cache
})
```

---

## 4. Request Body Limits

Prevent memory exhaustion from oversized payloads:

```go
func maxBodySize(maxBytes int64) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
            next.ServeHTTP(w, r)
        })
    }
}

// 10MB for file upload, 1MB for JSON bodies
r.With(maxBodySize(10<<20)).Post("/api/files/upload", fileHandler.Upload)
r.With(maxBodySize(1<<20)).Post("/api/tasks", taskHandler.Create)
```

---

## 5. Idempotency Keys

For POST endpoints that create resources, support client-provided idempotency keys to safely retry.

```go
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
    idempotencyKey := r.Header.Get("Idempotency-Key")
    if idempotencyKey != "" {
        // Check if we've seen this key before
        existing, err := h.service.GetByIdempotencyKey(r.Context(), idempotencyKey)
        if err == nil {
            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(existing)
            return // Return cached result
        }
    }

    // Create new resource
    result, err := h.service.Create(r.Context(), req, idempotencyKey)
    // ...
}
```

```sql
ALTER TABLE reconciliation_tasks ADD COLUMN idempotency_key TEXT UNIQUE;
```

---

## 6. Input Validation

Use `go-playground/validator` for struct-level validation. Map errors to the structured error envelope from `performance-production.md`.

```go
import "github.com/go-playground/validator/v10"

var validate = validator.New()

// Register custom validators once at startup
func init() {
    validate.RegisterValidation("task_status", func(fl validator.FieldLevel) bool {
        s := fl.Field().String()
        return s == "pending" || s == "processing" || s == "completed" || s == "failed"
    })
}

// Request DTO with validation tags
type CreateTaskRequest struct {
    Name        string `json:"name" validate:"required,min=1,max=255"`
    Description string `json:"description" validate:"max=5000"`
    Priority    int    `json:"priority" validate:"gte=0,lte=10"`
}

// In handler: validate and map errors
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
    var req CreateTaskRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, 400, "invalid_body", "malformed JSON")
        return
    }

    if err := validate.Struct(req); err != nil {
        details := mapValidationErrors(err.(validator.ValidationErrors))
        writeErrorWithDetails(w, 422, "validation_failed", "invalid input", details)
        return
    }
    // ...
}

// Map validator errors to field-level details
func mapValidationErrors(errs validator.ValidationErrors) []FieldError {
    out := make([]FieldError, 0, len(errs))
    for _, e := range errs {
        out = append(out, FieldError{
            Field:   toSnakeCase(e.Field()),
            Message: validationMessage(e),
        })
    }
    return out
}

type FieldError struct {
    Field   string `json:"field"`
    Message string `json:"message"`
}
```

**Where to validate**: Interface layer validates shape (required, length, format). Domain layer validates business rules (status transitions, permission checks). Never validate in infrastructure.

---

## 7. Retry with Exponential Backoff

Complement to circuit breaker. Circuit breaker protects against sustained failures; retry handles transient ones (network blips, brief timeouts).

```go
import (
    "math"
    "math/rand"
    "time"
)

type RetryConfig struct {
    MaxAttempts int
    BaseDelay   time.Duration
    MaxDelay    time.Duration
}

var DefaultRetry = RetryConfig{
    MaxAttempts: 3,
    BaseDelay:   500 * time.Millisecond,
    MaxDelay:    10 * time.Second,
}

func WithRetry[T any](ctx context.Context, cfg RetryConfig, fn func() (T, error)) (T, error) {
    var lastErr error
    var zero T
    for attempt := 0; attempt < cfg.MaxAttempts; attempt++ {
        result, err := fn()
        if err == nil {
            return result, nil
        }
        lastErr = err

        if attempt == cfg.MaxAttempts-1 {
            break
        }

        // Exponential backoff with jitter
        delay := time.Duration(float64(cfg.BaseDelay) * math.Pow(2, float64(attempt)))
        if delay > cfg.MaxDelay {
            delay = cfg.MaxDelay
        }
        jitter := time.Duration(rand.Int63n(int64(delay / 2)))
        delay = delay + jitter

        select {
        case <-ctx.Done():
            return zero, ctx.Err()
        case <-time.After(delay):
        }
    }
    return zero, fmt.Errorf("after %d attempts: %w", cfg.MaxAttempts, lastErr)
}

// Usage: retry an external API call
body, err := WithRetry(ctx, DefaultRetry, func() (io.ReadCloser, error) {
    return agentClient.Call(ctx, payload)
})
```

**When to retry**: Network errors, 502/503/504 responses, connection resets. **When NOT to retry**: 400/401/403/404/422 — these won't succeed on retry.

---

## 8. PostgreSQL Index Strategy

### Covering Indexes for List Queries

If your list query always selects the same columns, a covering index avoids table lookups entirely:

```sql
-- The task list query: SELECT id, status, name, created_at ORDER BY created_at DESC
CREATE INDEX idx_tasks_list ON reconciliation_tasks (created_at DESC)
    INCLUDE (id, status, name);

-- Filter by status (common): WHERE status = 'processing'
CREATE INDEX idx_tasks_status ON reconciliation_tasks (status, created_at DESC)
    WHERE status IN ('pending', 'processing');
```

### Partial Indexes

Don't index what you don't query:

```sql
-- Only active tasks need fast lookup
CREATE INDEX idx_tasks_active ON reconciliation_tasks (created_at DESC)
    WHERE status IN ('pending', 'processing');

-- Events: only recent ones need fast tailing
CREATE INDEX idx_events_recent ON task_events (task_id, id)
    WHERE created_at > NOW() - INTERVAL '7 days';
```

### JSONB Indexes

For event data or flexible schemas:

```sql
-- GIN index for containment queries: data @> '{"tool": "bash"}'
CREATE INDEX idx_events_data ON task_events USING GIN (data);

-- Expression index for specific JSON path
CREATE INDEX idx_events_tool ON task_events ((data->>'tool'))
    WHERE event_type = 'tool_call';
```

### Index Monitoring

```sql
-- Find unused indexes (waste of write I/O)
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Find slow queries missing indexes
SELECT query, calls, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## 9. Database Transaction Patterns

### Read-only Transactions

For queries that must see a consistent snapshot:

```go
tx, _ := pool.BeginTx(ctx, pgx.TxOptions{
    IsoLevel:   pgx.RepeatableRead,
    AccessMode: pgx.ReadOnly,
})
defer tx.Rollback(ctx)

tasks := listTasks(ctx, tx)
stats := getStats(ctx, tx) // Sees same snapshot as listTasks
tx.Commit(ctx)
```

### Optimistic Locking

Prevent lost updates when two users edit the same resource:

```go
// Entity has a version field
type Task struct {
    ID      uuid.UUID
    Version int
    // ...
}

func (r *TaskRepo) Update(ctx context.Context, t *Task) error {
    result, err := r.pool.Exec(ctx, `
        UPDATE reconciliation_tasks
        SET status = $2, name = $3, version = version + 1
        WHERE id = $1 AND version = $4
    `, t.ID, t.Status, t.Name, t.Version)
    if result.RowsAffected() == 0 {
        return ErrConcurrentModification
    }
    return err
}
```

---

## 10. Time-Series Partitioning

For tables that grow continuously (events, logs, audit trails), partition by time:

```sql
CREATE TABLE task_events (
    id BIGSERIAL,
    task_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE task_events_2026_04 PARTITION OF task_events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE task_events_2026_05 PARTITION OF task_events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Auto-create partitions with pg_partman or a cron job
```

**Benefits**: DROP old partitions instead of DELETE (instant, no vacuum). Queries on recent data only scan recent partitions.

---

## 11. Materialized Views for Aggregation

For dashboard stats that don't need real-time accuracy:

```sql
CREATE MATERIALIZED VIEW task_daily_stats AS
SELECT
    date_trunc('day', created_at) AS day,
    status,
    COUNT(*) AS count,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) AS avg_duration_sec
FROM reconciliation_tasks
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY 1, 2;

CREATE UNIQUE INDEX ON task_daily_stats (day, status);

-- Refresh every 5 minutes (non-blocking with CONCURRENTLY)
REFRESH MATERIALIZED VIEW CONCURRENTLY task_daily_stats;
```

### Go Cron for Refresh

```go
go func() {
    ticker := time.NewTicker(5 * time.Minute)
    for range ticker.C {
        pool.Exec(context.Background(),
            "REFRESH MATERIALIZED VIEW CONCURRENTLY task_daily_stats")
    }
}()
```

---

## 12. External Service Integration

### Circuit Breaker for AI Agent Calls

The AI agent can be slow or down. Don't let it take down your API.

```go
import "github.com/sony/gobreaker"

cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
    Name:        "ai-agent",
    MaxRequests: 3,                    // Half-open: allow 3 test requests
    Interval:    60 * time.Second,     // Reset failure count every 60s
    Timeout:     30 * time.Second,     // Open → half-open after 30s
    ReadyToTrip: func(counts gobreaker.Counts) bool {
        return counts.ConsecutiveFailures > 3 // Open after 3 consecutive failures
    },
})

func (r *AgentReconciler) ReconcileStream(ctx context.Context, ...) (io.ReadCloser, error) {
    result, err := cb.Execute(func() (interface{}, error) {
        return r.doReconcileStream(ctx, ...)
    })
    if err != nil {
        if errors.Is(err, gobreaker.ErrOpenState) {
            return nil, fmt.Errorf("agent service temporarily unavailable")
        }
        return nil, err
    }
    return result.(io.ReadCloser), nil
}
```

### HTTP Client Pool

Don't create a new `http.Client` per request:

```go
var agentClient = &http.Client{
    Timeout: 0, // No timeout for streaming (controlled by context)
    Transport: &http.Transport{
        MaxIdleConns:        20,
        MaxIdleConnsPerHost: 20,
        IdleConnTimeout:     90 * time.Second,
        DisableCompression:  true, // SSE streams shouldn't be compressed
    },
}
```

---

## 13. Worker Queue Pattern

For production, goroutine-per-task doesn't scale. Use a bounded worker pool:

```go
type TaskQueue struct {
    ch     chan uuid.UUID
    wg     sync.WaitGroup
}

func NewTaskQueue(workers int, handler func(uuid.UUID)) *TaskQueue {
    q := &TaskQueue{ch: make(chan uuid.UUID, 100)}
    for i := 0; i < workers; i++ {
        q.wg.Add(1)
        go func() {
            defer q.wg.Done()
            for taskID := range q.ch {
                handler(taskID)
            }
        }()
    }
    return q
}

func (q *TaskQueue) Submit(taskID uuid.UUID) { q.ch <- taskID }
func (q *TaskQueue) Shutdown()              { close(q.ch); q.wg.Wait() }
```

**Why**: Unbounded `go func()` under load creates thousands of goroutines, each holding a DB connection, each calling the AI agent. The system OOMs or exhausts PG connections. A worker pool caps concurrency at N.

---

## 14. Query Builder vs Raw SQL

For dynamic queries (filters, sorting, pagination), raw SQL string concatenation is a SQL injection vector. Use a builder:

```go
import sq "github.com/Masterminds/squirrel"

psql := sq.StatementBuilder.PlaceholderFormat(sq.Dollar)

func (r *TaskRepo) List(ctx context.Context, filter TaskFilter) ([]Task, error) {
    q := psql.Select("id", "status", "name", "created_at").
        From("reconciliation_tasks").
        OrderBy("created_at DESC").
        Limit(uint64(filter.Limit))

    if filter.Status != "" {
        q = q.Where(sq.Eq{"status": filter.Status})
    }
    if filter.After != nil {
        q = q.Where(sq.Lt{"created_at": filter.After})
    }
    if filter.Search != "" {
        q = q.Where(sq.ILike{"name": "%" + filter.Search + "%"})
    }

    sql, args, _ := q.ToSql()
    rows, err := r.pool.Query(ctx, sql, args...)
    // ...
}
```
