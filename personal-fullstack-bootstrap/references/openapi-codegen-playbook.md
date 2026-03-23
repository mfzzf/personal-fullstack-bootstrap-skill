# OpenAPI Codegen Playbook

## Purpose

Use this reference to keep the API contract compact, stable, and suitable for code generation in both Go and Next.js projects.

## Source of Truth

Keep one contract file at `api/openapi.yaml`.

The file must stay under 500 total lines. Enforce this after every edit with:

```bash
python3 scripts/check_openapi_size.py api/openapi.yaml
```

## Contract Design Rules

- Prefer one bounded context per contract file.
- Prefer reusable `components.schemas` entries over repeated inline schemas.
- Prefer simple request and response bodies over envelope-heavy designs.
- Prefer one list endpoint and one detail endpoint for the first slice.
- Prefer stable `operationId` values because generated clients depend on them.
- Keep tags aligned with bounded contexts.
- Keep examples short.
- Keep descriptions concise or omit them if the line budget is tight.

## Suggested First Slice Shape

```yaml
openapi: 3.0.3
info:
  title: Project API
  version: 0.1.0
servers:
  - url: http://localhost:8080
paths:
  /projects:
    get:
      operationId: listProjects
      tags: [projects]
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProjectList'
    post:
      operationId: createProject
      tags: [projects]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateProjectRequest'
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Project'
components:
  schemas:
    Project:
      type: object
      required: [id, name, status]
      properties:
        id:
          type: string
        name:
          type: string
        status:
          type: string
    ProjectList:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items:
            $ref: '#/components/schemas/Project'
    CreateProjectRequest:
      type: object
      required: [name]
      properties:
        name:
          type: string
```

## Generation Targets

### Go

Prefer generating into the HTTP interface layer, for example:

```bash
mkdir -p apps/api/internal/interfaces/http/generated
oapi-codegen \
  -generate types,chi-server,spec \
  -package generated \
  api/openapi.yaml \
  > apps/api/internal/interfaces/http/generated/api.gen.go
```

Rules:
- Do not edit generated Go files by hand.
- Keep business logic in handlers and application services outside `generated/`.
- Keep generated types from leaking into domain entities.

### Next.js TypeScript Client

Prefer generating into the frontend API layer, for example:

```bash
mkdir -p apps/web/src/lib/api/generated
openapi-generator-cli generate \
  -i api/openapi.yaml \
  -g typescript-fetch \
  -o apps/web/src/lib/api/generated
```

Rules:
- Keep generated clients isolated in `src/lib/api/generated`.
- Wrap generated calls in hand-written helpers for auth, base URL handling, caching, and error normalization.
- Do not spread generator-specific types across unrelated UI code when a feature-local view model is clearer.

## Change Workflow

1. Edit `api/openapi.yaml`.
2. Check line count.
3. Regenerate Go artifacts.
4. Regenerate TypeScript artifacts.
5. Fix mappers and adapters, not generated files.
6. Run project checks.

## When the Contract Approaches 500 Lines

- Remove verbose descriptions.
- Collapse duplicate schemas.
- Drop unused examples.
- Limit the slice to the smallest workable business capability.
- Split into another bounded context only if the user is clearly asking for a second independent slice.
