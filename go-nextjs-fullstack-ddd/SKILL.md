---
name: go-nextjs-fullstack-ddd
description: This skill should be used when building or refactoring production-grade full-stack applications with a Go backend, a Next.js plus shadcn/ui frontend, shadcn MCP-assisted component selection, PostgreSQL, Docker Compose startup, DDD structure, and OpenAPI-driven code generation for both server and client code.
---

# Go Nextjs Fullstack Ddd

## Overview

Build production-grade full-stack systems with Go, Next.js, shadcn/ui, PostgreSQL, Docker Compose, and OpenAPI as the contract source of truth. Keep backend architecture DDD-first, keep frontend quality premium, and generate transport and client code from one OpenAPI YAML file that stays under 500 lines.

## Use This Skill When

Use this skill for requests such as:
- Build a new SaaS app with Go, Next.js, PostgreSQL, and Docker Compose.
- Scaffold a production-ready full-stack starter with DDD and OpenAPI.
- Add a new bounded context that needs generated Go server contracts and a generated Next.js client.
- Refactor a generic monorepo into a contract-first stack with better frontend quality.
- Create an internal tool or customer-facing dashboard that must look premium instead of scaffold-grade.

## Non-Negotiables

- Keep one contract file at `api/openapi.yaml`.
- Keep `api/openapi.yaml` under 500 total lines. If the document grows beyond that limit, reduce scope, simplify schemas, or extract another bounded context before adding more endpoints.
- Make `docker-compose up -d` work from the repository root.
- Use PostgreSQL as the system database unless the existing repository already forces another supporting dependency outside the main relational store.
- Keep generated code out of the domain layer. Treat generated files as transport and client artifacts only.
- Keep the backend in a clear DDD layout with separate domain, application, interface, and infrastructure concerns.
- Keep the frontend in Next.js App Router with shadcn/ui primitives customized beyond default shadcn styling.
- Use shadcn MCP when available before building complex UI such as tables, forms, dialogs, sheets, command menus, and dashboards.
- Invoke `frontend-design` first for visual direction and initial component/page implementation when that skill is available.
- Invoke `ui-ux-pro-max` after `frontend-design` for hierarchy tuning, UX improvements, responsiveness, state coverage, and production polish when that skill is available.

## Default Stack

Use these defaults unless the repository already standardizes something equivalent:
- Backend language: Go
- Backend HTTP layer: `net/http` compatible adapters, preferably `chi`
- Frontend: Next.js App Router with TypeScript
- Component system: shadcn/ui plus Tailwind CSS
- Database: PostgreSQL
- Contract: `api/openapi.yaml`
- Go code generation: prefer `oapi-codegen` for Go contracts in DDD projects, or keep the repository's existing OpenAPI generator if it already exists
- TypeScript client generation: prefer `openapi-generator-cli` with `typescript-fetch`, or keep the repository's existing OpenAPI TypeScript generator if it already exists
- Containers: `docker-compose.yml` with `postgres`, `api`, and `web` services

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

### 5. Implement the Next.js frontend with premium UI standards

- Keep routes and layouts in `src/app`.
- Keep business-facing UI modules in `src/features`.
- Keep reusable primitives and design building blocks in `src/components`.
- Keep generated API client code in `src/lib/api/generated`.
- Keep hand-written query wrappers, server actions, and API helpers in `src/lib/api`.
- Use shadcn MCP to discover the right primitives before composing advanced flows.
- Invoke `frontend-design` first to shape layout, visual system, and baseline interaction design.
- Invoke `ui-ux-pro-max` second to improve spacing, hierarchy, states, accessibility, mobile behavior, and finish quality.
- Never ship stock shadcn surfaces. Customize typography, radius, spacing, color tokens, shadows, and component states so the result looks premium and production-ready.

Read `references/frontend-design-playbook.md` before building or refactoring the frontend.

### 6. Make local startup one command

- Provide a root-level `docker-compose.yml` compatible with `docker-compose up -d`.
- Build separate images for `apps/api` and `apps/web`.
- Add a `postgres` service with a health check and named volume.
- Wire the API container to PostgreSQL through container networking.
- Wire the web container so browser requests use a public base URL and server-side requests use the internal API hostname when needed.
- Keep local environment defaults simple and explicit.

Use `assets/docker-compose.template.yaml` as the starting point when scaffolding containers from scratch.

### 7. Verify the slice end to end

- Validate the OpenAPI line count.
- Regenerate Go and TypeScript code.
- Run backend tests or lint tasks if the repository defines them.
- Run frontend type checks or lint tasks if the repository defines them.
- Start the stack with `docker-compose up -d`.
- Verify the web app can load, read from the API, and render loading, empty, error, and success states.

## Delivery Rules

- Prefer a monorepo layout rooted around `api/`, `apps/`, and `db/`.
- Keep one bounded context small enough that one OpenAPI file can remain readable.
- Treat generated folders as replaceable outputs, not as the home for business logic.
- Favor explicit folder names over clever abstractions.
- Favor premium, sober, production-grade UI over generic gradients and boilerplate dashboards.
- Prefer narrow slices that actually run over broad scaffolds that only look complete.

## Resource Map

- Read `references/architecture-blueprint.md` for the default DDD folder layout and request flow.
- Read `references/openapi-codegen-playbook.md` for contract rules, code generation commands, and placement rules.
- Read `references/frontend-design-playbook.md` for the required frontend skill chain and premium UI standards.
- Run `scripts/check_openapi_size.py` to enforce the OpenAPI file limit.
- Reuse `assets/project-tree.txt` for the initial repository scaffold.
- Reuse `assets/openapi.template.yaml` for a compact contract-first starting point.
- Reuse `assets/docker-compose.template.yaml` for the root compose stack.

## Example Requests

- Build a production-grade project management app with Go, Next.js, PostgreSQL, Docker Compose, and OpenAPI-first code generation.
- Scaffold a DDD monorepo with a Go API, Next.js admin app, shadcn/ui, and one command startup.
- Add a billing bounded context with a single OpenAPI YAML file under 500 lines and generated Go plus TypeScript clients.
- Refactor this CRUD starter into a DDD slice with generated transport code and a premium shadcn-based dashboard.
