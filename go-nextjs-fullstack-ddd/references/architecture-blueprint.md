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
