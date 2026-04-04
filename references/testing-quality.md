# Testing & Code Quality

## Purpose

Testing infrastructure is hard to retrofit. Set it up at bootstrap time alongside the first bounded context so every subsequent slice starts with a working test harness and linter pipeline.

---

## 1. Table-Driven Tests with Subtests

The standard Go test pattern. Every handler, service method, and repository method gets a table.

```go
func TestTaskService_Create(t *testing.T) {
    tests := []struct {
        name    string
        input   CreateTaskCmd
        wantErr bool
        errCode string
    }{
        {
            name:  "valid task",
            input: CreateTaskCmd{Name: "Q1 Reconciliation"},
        },
        {
            name:    "empty name rejected",
            input:   CreateTaskCmd{Name: ""},
            wantErr: true,
            errCode: "validation_failed",
        },
        {
            name:    "name too long",
            input:   CreateTaskCmd{Name: strings.Repeat("a", 256)},
            wantErr: true,
            errCode: "validation_failed",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            svc := setupTestService(t)
            result, err := svc.Create(context.Background(), tt.input)
            if tt.wantErr {
                require.Error(t, err)
                var apiErr *domain.Error
                require.ErrorAs(t, err, &apiErr)
                assert.Equal(t, tt.errCode, apiErr.Code)
                return
            }
            require.NoError(t, err)
            assert.NotEmpty(t, result.ID)
        })
    }
}
```

---

## 2. HTTP Handler Testing with httptest

Test handlers without starting a real server. Validates routing, middleware, serialization, and status codes.

```go
func TestTaskHandler_Create(t *testing.T) {
    // Set up real dependencies (or minimal fakes for unit tests)
    pool := setupTestDB(t)
    repo := postgres.NewTaskRepo(pool)
    svc := application.NewTaskService(repo)
    handler := http.NewTaskHandler(svc)

    router := chi.NewRouter()
    router.Post("/api/tasks", handler.Create)

    body := `{"name": "Test Task"}`
    req := httptest.NewRequest("POST", "/api/tasks", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()

    router.ServeHTTP(rec, req)

    assert.Equal(t, 201, rec.Code)

    var resp map[string]any
    json.NewDecoder(rec.Body).Decode(&resp)
    assert.NotEmpty(t, resp["id"])
    assert.Equal(t, "pending", resp["status"])
}

func TestTaskHandler_Create_InvalidBody(t *testing.T) {
    // ... same setup ...
    body := `{"name": ""}`
    req := httptest.NewRequest("POST", "/api/tasks", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()

    router.ServeHTTP(rec, req)

    assert.Equal(t, 422, rec.Code)

    var resp map[string]any
    json.NewDecoder(rec.Body).Decode(&resp)
    assert.Equal(t, "validation_failed", resp["code"])
}
```

---

## 3. Integration Tests with testcontainers-go

Test repositories against a real PostgreSQL instance. No mocks for the database layer — mocked DB tests pass while prod migrations fail.

```go
import (
    "github.com/testcontainers/testcontainers-go"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
    "github.com/testcontainers/testcontainers-go/wait"
)

func setupTestDB(t *testing.T) *pgxpool.Pool {
    t.Helper()
    ctx := context.Background()

    container, err := postgres.Run(ctx,
        "postgres:16-alpine",
        postgres.WithDatabase("test"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        testcontainers.WithWaitStrategy(
            wait.ForLog("database system is ready to accept connections").
                WithOccurrence(2).
                WithStartupTimeout(30*time.Second),
        ),
    )
    require.NoError(t, err)
    t.Cleanup(func() { container.Terminate(ctx) })

    connStr, err := container.ConnectionString(ctx, "sslmode=disable")
    require.NoError(t, err)

    pool, err := pgxpool.New(ctx, connStr)
    require.NoError(t, err)
    t.Cleanup(func() { pool.Close() })

    // Run migrations
    runMigrations(pool, "../../db/migrations")

    return pool
}
```

### Repository Test Pattern

```go
func TestTaskRepo_CreateAndGet(t *testing.T) {
    pool := setupTestDB(t)
    repo := postgres.NewTaskRepo(pool)
    ctx := context.Background()

    // Create
    task := &domain.Task{Name: "Integration Test Task"}
    err := repo.Create(ctx, task)
    require.NoError(t, err)
    assert.NotEqual(t, uuid.Nil, task.ID)

    // Get
    got, err := repo.GetByID(ctx, task.ID)
    require.NoError(t, err)
    assert.Equal(t, task.Name, got.Name)
    assert.Equal(t, domain.StatusPending, got.Status)
}

func TestTaskRepo_List_CursorPagination(t *testing.T) {
    pool := setupTestDB(t)
    repo := postgres.NewTaskRepo(pool)
    ctx := context.Background()

    // Seed 25 tasks
    for i := 0; i < 25; i++ {
        repo.Create(ctx, &domain.Task{Name: fmt.Sprintf("Task %d", i)})
    }

    // First page
    page1, err := repo.List(ctx, nil, 10)
    require.NoError(t, err)
    assert.Len(t, page1, 11) // 10 + 1 for has_more detection

    // Second page
    cursor := page1[9].CreatedAt
    page2, err := repo.List(ctx, &cursor, 10)
    require.NoError(t, err)
    assert.Len(t, page2, 11)

    // No overlap
    assert.NotEqual(t, page1[0].ID, page2[0].ID)
}
```

### Shared Test Container (faster test suite)

For large test suites, reuse one container across all tests in a package:

```go
var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
    ctx := context.Background()
    container, _ := postgres.Run(ctx, "postgres:16-alpine", ...)
    connStr, _ := container.ConnectionString(ctx, "sslmode=disable")
    testPool, _ = pgxpool.New(ctx, connStr)
    runMigrations(testPool, "../../db/migrations")

    code := m.Run()

    testPool.Close()
    container.Terminate(ctx)
    os.Exit(code)
}
```

---

## 4. Goroutine Leak Detection

Any test involving goroutines (SSE handlers, worker pools, background tasks) must verify no goroutines leak.

```go
import "go.uber.org/goleak"

func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m)
}

// Or per-test:
func TestWorkerPool_Shutdown(t *testing.T) {
    defer goleak.VerifyNone(t)

    pool := NewTaskQueue(4, func(id uuid.UUID) { /* noop */ })
    pool.Submit(uuid.New())
    pool.Shutdown() // Must drain all goroutines
}
```

---

## 5. Fuzzing

Fuzz input parsing and validation to catch edge cases. Go 1.18+ native fuzzing.

```go
func FuzzParseTaskFilter(f *testing.F) {
    // Seed corpus
    f.Add("pending", "2024-01-01", "50")
    f.Add("", "", "0")
    f.Add("invalid_status", "not-a-date", "-1")

    f.Fuzz(func(t *testing.T, status, cursor, limit string) {
        // Should never panic
        filter, err := ParseTaskFilter(status, cursor, limit)
        if err != nil {
            return // validation errors are fine
        }
        // Invariants
        assert.LessOrEqual(t, filter.Limit, 100)
        assert.GreaterOrEqual(t, filter.Limit, 1)
    })
}
```

Run: `go test -fuzz=FuzzParseTaskFilter -fuzztime=30s ./...`

---

## 6. golangci-lint Configuration

Recommended linter set for this stack. Place at repo root as `.golangci.yml`.

```yaml
run:
  timeout: 5m

linters:
  enable:
    - govet          # Reports suspicious constructs
    - staticcheck    # Advanced static analysis
    - errcheck       # Unchecked error returns
    - gosec          # Security issues
    - revive         # Opinionated Go linter (replaces golint)
    - exhaustive     # Missing enum switch cases
    - gocritic       # Opinionated style and performance
    - unparam        # Unused function parameters
    - misspell       # Spelling mistakes in comments/strings
    - unconvert      # Unnecessary type conversions

linters-settings:
  govet:
    enable-all: true
    disable:
      - fieldalignment  # Too noisy for bootstrap
  revive:
    rules:
      - name: unexported-return
        disabled: true  # DDD repos return domain types from infra
  exhaustive:
    default-signifies-exhaustive: true
  gosec:
    excludes:
      - G104  # Unhandled errors on deferred Close() — acceptable

issues:
  exclude-dirs:
    - internal/interfaces/http/generated  # Generated code
  exclude-rules:
    - path: _test\.go
      linters: [gosec, errcheck]  # Tests are allowed to be looser
```

### Why these linters

| Linter | Catches |
|--------|---------|
| errcheck | Ignored errors — the #1 production bug source in Go |
| gosec | SQL injection, hardcoded credentials, weak crypto |
| staticcheck | Unreachable code, deprecated APIs, incorrect format strings |
| exhaustive | Missing cases in switch on enums — catches silent bugs on new status values |
| gocritic | Inefficient append, unnecessary nil checks, shadowed variables |

---

## 7. Makefile Targets

Standard targets for the Go backend. Place in `apps/api/Makefile`.

```makefile
.PHONY: lint test test-integration generate build docker

# Code generation from OpenAPI
generate:
	oapi-codegen \
		-generate types,chi-server,spec \
		-package generated \
		../../api/openapi.yaml \
		> internal/interfaces/http/generated/api.gen.go

# Linting
lint:
	golangci-lint run ./...

# Unit tests (no containers needed)
test:
	go test -race -count=1 ./internal/domain/... ./internal/application/...

# Integration tests (requires Docker for testcontainers)
test-integration:
	go test -race -count=1 -tags=integration ./internal/infrastructure/...

# All tests
test-all: test test-integration

# Build
build:
	go build -o bin/server ./cmd/server

# Docker image
docker:
	docker build -t api:dev .

# Run locally (requires running postgres)
run:
	go run ./cmd/server
```

### Build Tag for Integration Tests

Use build tags to separate slow integration tests from fast unit tests:

```go
//go:build integration

package postgres_test
```

This way `go test ./...` skips integration tests by default. CI runs `go test -tags=integration ./...`.

---

## 8. Test File Organization

```text
apps/api/
├── internal/
│   ├── domain/task/
│   │   ├── entity.go
│   │   ├── entity_test.go          # Unit: validation, state transitions
│   │   └── service_test.go         # Unit: business rules with fake repo
│   ├── application/task/
│   │   └── handlers_test.go        # Unit: orchestration with fake deps
│   ├── interfaces/http/handlers/
│   │   └── task_handler_test.go    # httptest: request/response cycle
│   └── infrastructure/persistence/postgres/
│       └── task_repo_test.go       # Integration: testcontainers + real PG
```

**Rule**: Domain and application tests are always unit tests (fast, no I/O). Infrastructure tests are integration tests (real DB). HTTP handler tests can be either — use httptest with real service for smoke tests, or with fakes for edge cases.
