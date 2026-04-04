# personal-fullstack-bootstrap

Claude Code skill for bootstrapping full-stack applications with Go + Next.js + PostgreSQL + Docker Compose.

## When to Use

Triggers at project bootstrap when you ask for things like:

- Build a ChatGPT-like app / AI SaaS
- Build an admin panel, dashboard, or CRM
- Scaffold a full-stack project from scratch
- Build a reconciliation platform, billing system, data pipeline

## Stack

| Layer | Choice |
|-------|--------|
| Backend | Go + chi + DDD structure |
| Frontend | Next.js App Router + shadcn/ui + Tailwind |
| Database | PostgreSQL |
| Contract | OpenAPI (`api/openapi.yaml`) |
| Containers | Docker Compose |
| Markdown | react-markdown + remark-gfm + @tailwindcss/typography |
| API Proxy | Runtime catch-all route (never Next.js rewrites) |

## Key Patterns (battle-tested)

- **Runtime API Proxy** — `src/app/api/[[...path]]/route.ts` reads env at runtime, not build time
- **SSE Streaming** — Go endpoint with Flusher, timeout, `done` event + event sourcing for replay
- **EventSource Consumption** — text chunk concatenation, proper cleanup, lazy tab loading
- **Async Task Processing** — guaranteed finalization via `defer`, scanner error checking
- **AI Agent Integration** — structured output via tool calls, never free-text parsing
- **shadcn/ui Fixes** — `createPortal` for overflow clipping, typography plugin for markdown

## Structure

```
SKILL.md              ← main skill definition
references/
  architecture-blueprint.md    ← DDD layout, SSE, async tasks, AI agent, deployment
  frontend-design-playbook.md  ← runtime proxy, EventSource, shadcn pitfalls, async UI
  openapi-codegen-playbook.md  ← contract rules, generation commands
assets/
  api-proxy-route.template.ts  ← Next.js runtime API proxy
  sse-handler.template.go      ← Go SSE endpoint boilerplate
  eventsource-hook.template.ts ← React EventSource hook
  docker-compose.template.yaml ← Docker Compose starter
  openapi.template.yaml        ← OpenAPI contract starter
  project-tree.txt             ← Repository layout reference
scripts/
  check_openapi_size.py        ← Enforce 500-line OpenAPI limit
```

## Install

Copy this repository into your Claude skills directory, or install as a skill package.
