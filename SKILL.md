---
name: personal-fullstack-bootstrap
description: This skill should be used at the start of new product or application builds when the user wants Claude to default to the author's personal stack: Go backend, Next.js plus shadcn/ui frontend, shadcn MCP-assisted UI composition, PostgreSQL, Docker Compose startup, DDD structure, and OpenAPI-driven code generation. Trigger on requests like build a SaaS, build a ChatGPT-like app, build an admin system, build an AI product, scaffold a full-stack app, or start a new web platform.
---

# Personal Fullstack Bootstrap

## Overview

Use this as the default personal full-stack stack when a project is just starting and the user asks to build a new system, product, SaaS, dashboard, admin panel, AI app, or ChatGPT-like application. Build with Go, Next.js, shadcn/ui, PostgreSQL, Docker Compose, and OpenAPI as the contract source of truth while keeping the backend DDD-first and the frontend premium and production-grade.

## Use This Skill When

Use this skill immediately at project bootstrap for requests such as:
- Build a new ChatGPT-like full-stack system.
- Build a new SaaS product from scratch.
- Build an admin system, internal tool, dashboard, CRM, or AI platform.
- Scaffold a production-ready full-stack starter using my default tech stack.
- Start a new web product and choose the backend, frontend, database, and project structure for me.
- Refactor an early generic scaffold into my standard Go plus Next.js DDD stack.

## Trigger Intent

Treat this skill as the default starting point for the author's personal technology stack.

Trigger proactively when the user is asking to create a brand new system and does not explicitly override the stack, especially for prompts involving:
- chat app
- ChatGPT clone
- AI app
- AI SaaS
- admin panel
- dashboard
- CRM
- CMS
- internal tool
- platform
- web app
- full-stack system
- full-stack project
- full-stack product
- scaffold a project
- start a project
- build from scratch
- reconciliation
- billing system
- data pipeline

## Non-Negotiables

- Keep one contract file at `api/openapi.yaml`.
- Keep `api/openapi.yaml` under 500 total lines. If the document grows beyond that limit, reduce scope, simplify schemas, or extract another bounded context before adding more endpoints.
- Make `docker-compose up -d` work from the repository root.
- Use PostgreSQL as the system database unless the existing repository already forces another supporting dependency outside the main relational store.
- Keep generated code out of the domain layer. Treat generated files as transport and client artifacts only.
- Keep the backend in a clear DDD layout with separate domain, application, interface, and infrastructure concerns.
- Keep the frontend in Next.js App Router with shadcn/ui primitives customized beyond default shadcn styling.
- **Never use Next.js `rewrites` in `next.config.ts` for API proxying in Docker.** `process.env` in rewrites is evaluated at build time, not runtime. Always use a runtime API proxy route instead. See `assets/api-proxy-route.template.ts`.
- **Dockerfile base image versions must match language versions.** Go Dockerfile `FROM golang:X` must match `go.mod`'s `go X.Y`. Node Dockerfile must match `.nvmrc` or `engines` if present.
- **Hardcode sensitive or environment-specific vars in `docker-compose.yml`** with explicit string values — user shell environment can silently override `${VAR}` syntax.
- **Always finalize async tasks.** Any goroutine that sets status to "processing" must guarantee transition to "completed" or "failed" via `defer` or equivalent.
- Set up `golangci-lint` and write at minimum one integration test (with `testcontainers-go`) per bounded context before moving to frontend implementation.
- Register `net/http/pprof` on a separate admin port (never the public API port) in every Go service.
- Use shadcn MCP when available before building complex UI such as tables, forms, dialogs, sheets, command menus, and dashboards.
- Invoke `frontend-design` first for visual direction and initial component/page implementation when that skill is available.
- Invoke `ui-ux-pro-max` after `frontend-design` for hierarchy tuning, UX improvements, responsiveness, state coverage, and production polish when that skill is available.

## Default Stack

Use these defaults unless the repository already standardizes something equivalent:
- Backend language: Go
- Backend HTTP layer: `net/http` compatible adapters, preferably `chi`
- Frontend: Next.js 16 App Router with TypeScript
- Component system: shadcn/ui (CLI v4) plus Tailwind CSS v4
- Markdown rendering: `react-markdown` + `remark-gfm` + `@tailwindcss/typography`
- Database: PostgreSQL
- Contract: `api/openapi.yaml`
- Go code generation: prefer `oapi-codegen` for Go contracts in DDD projects, or keep the repository's existing OpenAPI generator if it already exists
- TypeScript client generation: prefer `openapi-generator-cli` with `typescript-fetch`, or keep the repository's existing OpenAPI TypeScript generator if it already exists
- Containers: `docker-compose.yml` with `postgres`, `api`, and `web` services
- API proxy: runtime catch-all route at `src/app/api/[[...path]]/route.ts` (never Next.js rewrites). Keep `next.config.ts` as `{ output: "standalone" }` only.
- Excel handling: `github.com/xuri/excelize/v2` for Go-side reading/writing
- Observability: OpenTelemetry SDK → OTLP Collector → ClickHouse (via SigNoz or Uptrace)
- Logging: `log/slog` with JSON handler and trace correlation
- Database tracing: `otelpgx` for automatic SQL span capture
- Charts: Apache ECharts 6 (via `echarts-for-react`) for data-heavy UIs, or shadcn built-in Chart component (Recharts v3) for dashboards
- Motion: `motion` (`motion/react`) for functional transitions (page, list, toast)
- Middleware: chi middleware chain (RealIP → RequestID → Logger → Recoverer → CORS → Compress → Timeout → Auth)
- Circuit breaker: `gobreaker` for external service calls (AI agents, third-party APIs)
- Query builder: `squirrel` for dynamic filters/sorting/pagination
- Linting: `golangci-lint` with govet, staticcheck, errcheck, gosec, revive, exhaustive
- Integration testing: `testcontainers-go` for real PostgreSQL in tests
- Input validation: `go-playground/validator` for struct tag validation
- Admin/debug: `net/http/pprof` on separate port for profiling

## Execution Workflow

### 1. Establish the bounded context

- Start with one thin vertical slice.
- Define one business capability, one aggregate root, and only the endpoints required for that slice.
- Keep the first contract intentionally small so the OpenAPI file remains comfortably below 500 lines.
- Refuse to let generated transport concerns leak into the domain model.

Read `references/architecture-blueprint.md` before laying out folders when the repository is empty or the structure is unclear.

### 2. Write the contract first

- Create or update `api/openapi.yaml` before writing handlers, repositories, or frontend data hooks.
- Keep operation IDs stable and human-readable.
- Reuse schemas aggressively instead of duplicating payload shapes.
- Prefer a compact response model over many near-duplicate envelopes.
- Run `python3 scripts/check_openapi_size.py api/openapi.yaml` after editing the contract.

Read `references/openapi-codegen-playbook.md` before generating code or choosing generator flags.

### 3. Generate transport and client code

- Generate Go transport contracts into a generated package under the HTTP interface layer.
- Generate the frontend API client into a dedicated generated folder under the web app.
- Commit generated files that belong to the project workflow.
- Keep hand-written adapters, use cases, validation, orchestration, and UI state outside generated directories.
- Regenerate instead of hand-editing generated files.

### 4. Implement the Go backend with DDD boundaries

- Place aggregates, value objects, domain services, and repository interfaces in `internal/domain`.
- Place application use cases, commands, queries, and DTO mappers in `internal/application`.
- Place generated server contracts, HTTP handlers, request/response mapping, and router wiring in `internal/interfaces/http`.
- Place PostgreSQL repositories, config loading, migrations integration, and external adapters in `internal/infrastructure`.
- Keep SQL and persistence details out of the domain layer.
- Keep framework-specific concerns out of application services.

Read `references/architecture-blueprint.md` for main.go wiring pattern, domain error patterns, and DDD guardrails.

### 4b. Set up testing and code quality

- Add `.golangci.yml` at the repo root with the recommended linter set.
- Write at least one integration test per repository using `testcontainers-go`.
- Write handler tests using `httptest` for the critical path (create, get, list).
- Add `goleak.VerifyTestMain` to any package with goroutines.
- Add Makefile targets: `lint`, `test`, `test-integration`, `generate`, `build`.

Read `references/testing-quality.md` for test patterns, linter config, and Makefile template.

### 5. Implement the Next.js frontend with premium UI standards

- Keep routes and layouts in `src/app`.
- Keep business-facing UI modules in `src/features`.
- Keep reusable primitives and design building blocks in `src/components`.
- Keep generated API client code in `src/lib/api/generated`.
- Keep hand-written query wrappers, server actions, and API helpers in `src/lib/api`.
- **Always create `src/app/api/[[...path]]/route.ts`** as the runtime API proxy — never use Next.js `rewrites`. Use `assets/api-proxy-route.template.ts` as the starting point.
- Use shadcn MCP to discover the right primitives before composing advanced flows.
- Invoke `frontend-design` first to shape layout, visual system, and baseline interaction design.
- Invoke `ui-ux-pro-max` second to improve spacing, hierarchy, states, accessibility, mobile behavior, and finish quality.
- Never ship stock shadcn surfaces. Customize typography, radius, spacing, color tokens, shadows, and component states so the result looks premium and production-ready.

Read `references/frontend-design-playbook.md` before building or refactoring the frontend.

### 6. Implement streaming and real-time features

When the project requires SSE, streaming AI output, or long-running task progress:

- Use the Go SSE endpoint pattern from `references/architecture-blueprint.md` section "SSE Endpoint Pattern".
- Use the frontend EventSource pattern from `references/frontend-design-playbook.md` section "SSE / EventSource Patterns".
- Store SSE events to a database table for replay on reconnect (event sourcing lite).
- For AI agent output, use structured tool calls (`submit_analysis`, `present_file`) to capture results — never rely on parsing free-text stream output.
- Concatenate consecutive same-type streaming chunks in the frontend instead of creating a new DOM element per chunk.

Use `assets/sse-handler.template.go` and `assets/eventsource-hook.template.ts` as starting points.

### 7. Make local startup one command

- Provide a root-level `docker-compose.yml` compatible with `docker-compose up -d`.
- Build separate images for `apps/api` and `apps/web`.
- Add a `postgres` service with a health check and named volume.
- Wire the API container to PostgreSQL through container networking.
- Wire the web container with `INTERNAL_API_BASE_URL` for the runtime proxy route.
- Hardcode environment values as explicit strings — never rely on `${SHELL_VAR}` passthrough.
- For SSE-capable APIs, set `WriteTimeout` to at least 10 minutes.
- Keep local environment defaults simple and explicit.

Use `assets/docker-compose.template.yaml` as the starting point when scaffolding containers from scratch.

### 8. Harden for production

After the slice works end-to-end, apply production patterns in priority order:

- Tune connection pool (MaxConns, idle timeout, lifetime).
- Add graceful shutdown with signal handling and drain timeout.
- Replace `http.Error` strings with structured JSON error responses.
- Add cursor pagination to all list endpoints.
- Initialize OpenTelemetry with OTLP exporter, auto-instrument HTTP and pgx.
- Add trace-correlated structured logging via `log/slog`.
- Wrap migrations with `pg_advisory_lock` for multi-instance safety.
- Add request timeout middleware (30s default, 10m for SSE).
- Eliminate N+1 queries with batch loading.
- Add rate limiting on expensive endpoints (task creation, file upload).

Read `references/performance-production.md` for implementation details and code templates.

### 9. Verify the slice end to end

- Validate the OpenAPI line count.
- Regenerate Go and TypeScript code.
- Run backend tests or lint tasks if the repository defines them.
- Run frontend type checks or lint tasks if the repository defines them.
- Start the stack with `docker-compose up -d`.
- Verify the web app can load, read from the API, and render loading, empty, error, and success states.
- If SSE or streaming is involved, verify events flow end-to-end and replay works on page refresh.

## Delivery Rules

- Prefer a monorepo layout rooted around `api/`, `apps/`, and `db/`.
- Keep one bounded context small enough that one OpenAPI file can remain readable.
- Treat generated folders as replaceable outputs, not as the home for business logic.
- Favor explicit folder names over clever abstractions.
- Favor premium, sober, production-grade UI over generic gradients and boilerplate dashboards.
- Prefer narrow slices that actually run over broad scaffolds that only look complete.

## Resource Map

- Read `references/architecture-blueprint.md` for the default DDD folder layout, request flow, main.go wiring, domain error patterns, SSE patterns, and async task processing.
- Read `references/testing-quality.md` for table-driven tests, httptest handler testing, testcontainers-go integration tests, goleak, fuzzing, golangci-lint config, and Makefile targets.
- Read `references/performance-production.md` for connection pool tuning, graceful shutdown, pagination, observability (OTel + ClickHouse), caching, rate limiting, N+1 prevention, pprof endpoints, pool monitoring, and benchmarks.
- Read `references/backend-middleware-database.md` for auth middleware, middleware chain ordering, input validation, retry with backoff, DB indexing, transactions, partitioning, circuit breakers, worker queues, and query builders.
- Read `references/frontend-aesthetics-dataviz.md` for motion design, data-dense tables, chart libraries (ECharts/Recharts), dark mode, CJK typography, heat maps, and export patterns.
- Read `references/openapi-codegen-playbook.md` for contract rules, code generation commands, and placement rules.
- Read `references/frontend-design-playbook.md` for the required frontend skill chain, premium UI standards, runtime proxy pattern, SSE consumption, and shadcn pitfalls.
- Run `scripts/check_openapi_size.py` to enforce the OpenAPI file limit.
- Reuse `assets/project-tree.txt` for the initial repository scaffold.
- Reuse `assets/openapi.template.yaml` for a compact contract-first starting point.
- Reuse `assets/docker-compose.template.yaml` for the root compose stack.
- Reuse `assets/api-proxy-route.template.ts` for the Next.js runtime API proxy.
- Reuse `assets/sse-handler.template.go` for Go SSE endpoint boilerplate.
- Reuse `assets/eventsource-hook.template.ts` for frontend SSE consumption.

## Example Requests

- Build a production-grade ChatGPT-like app with streaming chat, auth, billing, and admin tools using my default stack.
- Build a production-grade project management app with Go, Next.js, PostgreSQL, Docker Compose, and OpenAPI-first code generation.
- Scaffold a DDD monorepo with a Go API, Next.js admin app, shadcn/ui, and one command startup.
- Add a billing bounded context with a single OpenAPI YAML file under 500 lines and generated Go plus TypeScript clients.
- Refactor this CRUD starter into a DDD slice with generated transport code and a premium shadcn-based dashboard.
- Build a reconciliation platform with file upload, async AI analysis, SSE streaming progress, and Excel report generation.
