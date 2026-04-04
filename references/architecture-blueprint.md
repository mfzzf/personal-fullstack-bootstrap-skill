# Architecture Blueprint

## Purpose

Use this reference when creating or reorganizing a repository into the default full-stack DDD layout for this skill.

## Default Repository Layout

```text
.
├── api/
│   └── openapi.yaml
├── apps/
│   ├── api/
│   │   ├── cmd/server/
│   │   │   └── main.go
│   │   ├── internal/
│   │   │   ├── domain/
│   │   │   │   └── <bounded-context>/
│   │   │   │       ├── entity.go
│   │   │   │       ├── value_object.go
│   │   │   │       ├── repository.go
│   │   │   │       └── service.go
│   │   │   ├── application/
│   │   │   │   └── <bounded-context>/
│   │   │   │       ├── commands.go
│   │   │   │       ├── queries.go
│   │   │   │       ├── handlers.go
│   │   │   │       └── dto.go
│   │   │   ├── interfaces/
│   │   │   │   └── http/
│   │   │   │       ├── generated/
│   │   │   │       ├── handlers/
│   │   │   │       ├── mapper/
│   │   │   │       └── router/
│   │   │   └── infrastructure/
│   │   │       ├── config/
│   │   │       ├── persistence/
│   │   │       │   └── postgres/
│   │   │       └── observability/
│   │   ├── go.mod
│   │   ├── go.sum
│   │   ├── Dockerfile
│   │   └── Makefile
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   ├── lib/
│       │   │   └── api/
│       │   │       ├── generated/
│       │   │       └── client.ts
│       │   └── styles/
│       ├── public/
│       ├── package.json
│       ├── Dockerfile
│       └── components.json
├── db/
│   └── migrations/
├── docker-compose.yml
└── README.md
```

## Layer Responsibilities

### Domain

Keep only business concepts here:
- Entities
- Value objects
- Domain services
- Domain events if needed
- Repository interfaces

Do not place SQL, HTTP DTOs, generated OpenAPI types, JSON tags that only exist for transport, or framework-specific objects in this layer.

### Application

Coordinate use cases here:
- Commands and queries
- Use-case handlers
- Transaction boundaries
- Domain orchestration
- Mapping from domain results to application DTOs

Do not let HTTP request parsing or SQL concerns leak here.

### Interfaces HTTP

Keep transport-facing code here:
- Generated OpenAPI server interfaces and types
- HTTP handlers
- Request validation adapters
- Request and response mappers
- Router composition

This layer translates HTTP into application calls. It should not contain domain rules beyond input translation.

### Infrastructure

Put technical details here:
- PostgreSQL repositories
- Connection pools
- Migrations wiring
- Environment config
- Logging and tracing adapters
- External clients

This layer implements interfaces defined inward by the domain or application layers.

## Request Flow

```text
HTTP request
-> generated OpenAPI contract types
-> HTTP handler adapter
-> application use case
-> domain entities and repository interfaces
-> infrastructure postgres repository
-> application DTO
-> HTTP response mapper
-> JSON response
```

## DDD Guardrails

- Start with one bounded context instead of many folders with no behavior.
- Keep repository interfaces close to the aggregate they serve.
- Keep one aggregate root per use case slice when possible.
- Avoid creating shared util packages for business rules.
- Avoid letting generated types cross into the domain layer.
- Prefer explicit mappers over hidden magic conversions.

## Frontend Alignment

Mirror backend bounded contexts in `src/features` when useful:
- `src/features/projects`
- `src/features/billing`
- `src/features/users`

Keep generated clients in `src/lib/api/generated` and wrap them with feature-aware query or action helpers outside the generated folder.

---

## SSE Endpoint Pattern (Go)

Use this pattern when building endpoints that stream events to the frontend (task progress, AI output, real-time updates).

### Required Headers

```go
w.Header().Set("Content-Type", "text/event-stream")
w.Header().Set("Cache-Control", "no-cache")
w.Header().Set("Connection", "keep-alive")
w.Header().Set("X-Accel-Buffering", "no") // disable nginx/proxy buffering
```

### Flusher Assertion

```go
flusher, ok := w.(http.Flusher)
if !ok {
    http.Error(w, "streaming not supported", http.StatusInternalServerError)
    return
}
```

### Event Format

```go
fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, jsonPayload)
flusher.Flush()
```

### Mandatory Behaviors

1. **Always send a terminal `done` event** — the frontend uses it to close the EventSource.
2. **Add a timeout** (e.g. `time.After(10 * time.Minute)`) to prevent infinite hanging for stuck producers.
3. **Check `ctx.Done()`** in the polling loop to handle client disconnects.
4. **For completed resources**, replay stored events from DB, send `done`, and return immediately.
5. **Set `WriteTimeout`** on the HTTP server to at least 10 minutes for SSE routes.

### Event Sourcing for Replay

Store events to a DB table so the frontend can reconnect and see full history:

```sql
CREATE TABLE task_events (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_task_events_task_id ON task_events (task_id, id);
```

The SSE handler: (1) replays all stored events, (2) if resource is still active, polls for new events every 1s, (3) sends `done` on completion or timeout.

---

## Async Task Processing Pattern

Use this for any operation that runs longer than a few seconds (AI analysis, report generation, data processing).

### Status Lifecycle

```
pending → processing → completed | failed
```

### Guaranteed Finalization

**Critical**: A goroutine that sets status to "processing" MUST guarantee it reaches a terminal state. Use a `defer` block that checks if status is still "processing" and force-fails it. Always store a `done` event in the defer as well.

### Scanner Error Checking

When reading streaming responses, always check for scanner errors after the loop:

```go
scanner := bufio.NewScanner(body)
for scanner.Scan() { /* ... */ }
if err := scanner.Err(); err != nil {
    log.Printf("WARN: scanner error: %v", err)
}
```

---

## AI Agent Integration Pattern

When integrating AI agents (LangChain, LangGraph, custom) that produce analysis or reports:

### Use Tool Calls for Structured Output

**Never parse free-text AI output for critical data.** Define explicit tools:

- `submit_analysis(markdown: str)` — agent submits final analysis as a tool call. JSON is complete and parseable.
- `present_file(path: str)` — agent marks output files as deliverables.

### Extraction Priority

1. **Tool call args** (most reliable) — parse `submit_analysis` tool call JSON
2. **Dedicated SSE event** — `analysis` event with `{content, excel_path}`
3. **Text accumulation** (least reliable) — concatenate AI text chunks as fallback

### Streaming Tool Call Args (LangGraph)

LangGraph streams tool_call arguments incrementally across chunks:
- First chunk: `{name: "bash", args: "", id: "abc123"}`
- Subsequent: `{args: "python -c 'print"}`, `{args: "(1+2)'"}`

**Accumulate args by index/id**, then emit the complete tool call when the corresponding ToolMessage arrives.

---

## File Operations Pattern

### Excel Read/Preview

Use `github.com/xuri/excelize/v2` to read Excel files and return JSON for frontend rendering:

```go
f, _ := excelize.OpenFile(path)
defer f.Close()
for _, name := range f.GetSheetList() {
    rows, _ := f.GetRows(name)
    // return {sheets: [{name, rows}]}
}
```

### File Upload with Role Detection

For multi-file workflows, use a junction table with roles:

```sql
CREATE TABLE task_files (
    task_id UUID NOT NULL,
    file_id UUID NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (task_id, file_id)
);
```

---

## Deployment Lessons

### Docker Compose

- **Hardcode env vars**: `ANTHROPIC_BASE_URL: "https://api.example.com"` — shell env can silently override `${VAR}` syntax.
- **Go version match**: Dockerfile `FROM golang:X.Y` must match `go.mod` version exactly.
- **SSE timeout**: Set Go HTTP server `WriteTimeout` to 10+ minutes.
- **GOPROXY**: Add `GOPROXY=https://goproxy.cn,direct` for builds behind Chinese firewall.

---

## main.go Wiring Pattern

Constructor-based dependency injection. No frameworks (wire is acceptable for large projects, but explicit wiring is clearer at bootstrap).

```go
func main() {
    ctx := context.Background()

    // Config
    cfg := config.Load()

    // Infrastructure
    pool, err := infrastructure.NewPGPool(ctx, cfg.DatabaseURL)
    if err != nil {
        slog.Error("failed to connect to database", "error", err)
        os.Exit(1)
    }

    // Run migrations (with advisory lock for multi-instance safety)
    if err := infrastructure.RunMigrations(pool, "db/migrations"); err != nil {
        slog.Error("migration failed", "error", err)
        os.Exit(1)
    }

    // Repositories (infra implements domain interfaces)
    taskRepo := postgres.NewTaskRepo(pool)
    fileRepo := postgres.NewFileRepo(pool)

    // Application services
    taskService := application.NewTaskService(taskRepo, fileRepo)

    // HTTP handlers
    taskHandler := handlers.NewTaskHandler(taskService)
    fileHandler := handlers.NewFileHandler(taskService)

    // Router
    router := router.New(taskHandler, fileHandler)

    // Server
    srv := &http.Server{
        Addr:         ":" + cfg.Port,
        Handler:      router,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 10 * time.Minute,
        IdleTimeout:  60 * time.Second,
    }

    // Start with errgroup for concurrent concerns
    g, gctx := errgroup.WithContext(ctx)

    // HTTP server
    g.Go(func() error {
        slog.Info("server starting", "port", cfg.Port)
        if err := srv.ListenAndServe(); err != http.ErrServerClosed {
            return err
        }
        return nil
    })

    // Background workers (if needed)
    taskQueue := worker.NewTaskQueue(cfg.WorkerCount, taskService.Process)
    g.Go(func() error {
        <-gctx.Done()
        taskQueue.Shutdown()
        return nil
    })

    // Graceful shutdown
    g.Go(func() error {
        quit := make(chan os.Signal, 1)
        signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
        select {
        case <-quit:
        case <-gctx.Done():
        }
        slog.Info("shutting down")
        shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()
        srv.Shutdown(shutdownCtx)
        pool.Close()
        return nil
    })

    if err := g.Wait(); err != nil {
        slog.Error("server error", "error", err)
        os.Exit(1)
    }
}
```

**Why explicit wiring**: Every dependency is visible in one place. Startup failures point to the exact line. No magic, no reflection, no framework to learn.

---

## Domain Error Patterns

Errors cross layer boundaries. Each layer must speak its own error language.

### Domain Errors (Sentinel + Typed)

```go
// internal/domain/task/errors.go
package task

import "fmt"

// Sentinel errors for errors.Is() checks
var (
    ErrNotFound              = &Error{Code: "not_found", Message: "task not found"}
    ErrConcurrentModification = &Error{Code: "conflict", Message: "task was modified by another request"}
)

// Typed error for rich context
type Error struct {
    Code    string
    Message string
    Cause   error
}

func (e *Error) Error() string {
    if e.Cause != nil {
        return fmt.Sprintf("%s: %v", e.Message, e.Cause)
    }
    return e.Message
}

func (e *Error) Unwrap() error { return e.Cause }

func (e *Error) Is(target error) bool {
    t, ok := target.(*Error)
    if !ok {
        return false
    }
    return e.Code == t.Code
}

// Wrap preserves the domain error code while adding cause context
func (e *Error) Wrap(cause error) *Error {
    return &Error{Code: e.Code, Message: e.Message, Cause: cause}
}
```

### Mapping Domain Errors to HTTP (Interface Layer)

```go
// internal/interfaces/http/handlers/errors.go
func mapDomainError(w http.ResponseWriter, err error) {
    var domErr *domain.Error
    if !errors.As(err, &domErr) {
        writeError(w, 500, "internal_error", "unexpected error")
        return
    }

    switch domErr.Code {
    case "not_found":
        writeError(w, 404, domErr.Code, domErr.Message)
    case "validation_failed":
        writeError(w, 422, domErr.Code, domErr.Message)
    case "conflict":
        writeError(w, 409, domErr.Code, domErr.Message)
    default:
        writeError(w, 500, domErr.Code, domErr.Message)
    }
}
```

**Rule**: Domain layer defines error codes. Application layer wraps with `%w`. Interface layer maps codes to HTTP status. Infrastructure layer wraps database errors into domain errors (`pgx.ErrNoRows` → `ErrNotFound`).

### Kubernetes

- **RWO volumes**: Use `strategy: Recreate` if PVCs use ReadWriteOnce (only one pod can mount).
- **IPv6**: Use `[::]` as listen address instead of `0.0.0.0`. Best: env var `LISTEN_HOST` defaulting to `0.0.0.0`.
- **imagePullPolicy**: Always use `Always` during development.
- **Readiness probes**: Set `initialDelaySeconds: 30` and `failureThreshold: 6` for slow-starting services (AI agents with model loading).

### PostgreSQL

- PG 16 restricts `public` schema for non-superusers. Either `CREATE DATABASE` owned by the connecting user, or `GRANT ALL ON SCHEMA public TO <user>`.
- For external PG with IPv6: use `sslmode=prefer` and bracket notation `postgres://user:pass@[::1]:5432/db`.
