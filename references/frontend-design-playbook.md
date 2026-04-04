# Frontend Design Playbook

## Purpose

Use this reference when implementing the Next.js frontend for projects created with this skill. Updated for Next.js 16, React 19, Tailwind CSS v4, and shadcn/ui CLI v4.

## Mandatory Skill Chain

When the environment exposes these skills, use them in this order:

1. `frontend-design`
   - Use first for page direction, layout composition, visual concept, component styling, and initial implementation.
2. `ui-ux-pro-max`
   - Use second for UX refinement, responsive behavior, interaction coverage, state design, accessibility, and production polish.

Do not reverse the order. The first skill establishes the visual language. The second skill improves experience quality and polish.

## Frontend Stack Expectations

- Use Next.js 16 App Router with TypeScript. Turbopack is the default bundler.
- Use Tailwind CSS v4 with CSS-first configuration (`@import "tailwindcss"` + `@theme` for design tokens). No `tailwind.config.js` file.
- Use shadcn/ui (CLI v4) primitives with OKLCH color tokens. Customize beyond stock defaults.
- Use shadcn MCP when available to discover or assemble the right components before writing advanced UI.
- Always install `react-markdown` + `remark-gfm` + `@tailwindcss/typography` for any project that renders AI or user-generated markdown.
- Keep `next.config.ts` minimal. See Runtime API Proxy section.
- Use `proxy.ts` (not `middleware.ts`) for request-level concerns — Next.js 16 renamed this convention.

## Visual Quality Bar

The resulting UI must feel premium and production-ready:
- Avoid generic three-card marketing rows and default dashboard templates.
- Avoid default font stacks such as Inter, Arial, Roboto, or plain system UI when the repository allows better typography.
- Choose a deliberate art direction and keep it consistent.
- Customize color tokens, radii, shadows, and spacing instead of using stock shadcn defaults.
- Design all major states: loading, empty, error, success, and disabled.
- Ensure desktop and mobile both feel intentional.
- Prefer subtle motion with purpose over decorative animation spam.

---

## Design System Architecture

Enterprise UIs require a structured design system — not ad-hoc color picks. Build three layers.

### Three-Tier Token System

Components never reference primitives directly. The chain is always **component → semantic → primitive**.

```
src/styles/
  tokens/
    primitives.css    # Layer 1: @theme with raw OKLCH values
    semantic.css      # Layer 2: :root/.dark + @theme inline
    components.css    # Layer 3: component-scoped tokens
  app.css             # @import "tailwindcss" + token imports + @plugin
```

#### Layer 1: Primitives (`tokens/primitives.css`)

Raw, context-free values. The full palette. Registered in `@theme` to generate Tailwind utilities.

```css
@theme {
  /* ---- Typography ---- */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Cal Sans", "Inter", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* ---- Colors (OKLCH — perceptually uniform) ---- */
  --color-blue-50:  oklch(0.97 0.01 255);
  --color-blue-100: oklch(0.95 0.02 255);
  --color-blue-200: oklch(0.90 0.05 255);
  --color-blue-300: oklch(0.80 0.09 255);
  --color-blue-400: oklch(0.70 0.13 255);
  --color-blue-500: oklch(0.60 0.17 255);
  --color-blue-600: oklch(0.50 0.15 255);
  --color-blue-700: oklch(0.40 0.12 255);
  --color-blue-800: oklch(0.30 0.10 255);
  --color-blue-900: oklch(0.20 0.07 255);
  --color-blue-950: oklch(0.14 0.05 255);

  --color-gray-50:  oklch(0.985 0.002 250);
  --color-gray-100: oklch(0.97 0.004 250);
  --color-gray-200: oklch(0.92 0.006 250);
  --color-gray-300: oklch(0.87 0.008 250);
  --color-gray-400: oklch(0.71 0.010 250);
  --color-gray-500: oklch(0.55 0.012 250);
  --color-gray-600: oklch(0.45 0.012 250);
  --color-gray-700: oklch(0.37 0.012 250);
  --color-gray-800: oklch(0.27 0.010 250);
  --color-gray-900: oklch(0.21 0.008 250);
  --color-gray-950: oklch(0.13 0.006 250);

  --color-red-500:   oklch(0.63 0.22 25);
  --color-green-500: oklch(0.72 0.19 142);
  --color-amber-500: oklch(0.80 0.16 75);

  /* ---- Spacing ---- */
  --spacing: 0.25rem;  /* multiplier: spacing-4 = 1rem, spacing-8 = 2rem */

  /* ---- Border Radius ---- */
  --radius-sm:   0.25rem;
  --radius-md:   0.375rem;
  --radius-lg:   0.5rem;
  --radius-xl:   0.75rem;
  --radius-2xl:  1rem;
  --radius-full: 9999px;

  /* ---- Shadows ---- */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

  /* ---- Easing ---- */
  --ease-out:    cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);

  /* ---- Animation ---- */
  --animate-fade-in: fade-in 0.3s var(--ease-out);

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}
```

#### Layer 2: Semantic Tokens (`tokens/semantic.css`)

Purpose-driven aliases. Dark mode swaps ONLY this layer. Use `@theme inline` so `var()` resolves correctly.

```css
:root {
  /* ---- Surface ---- */
  --surface:           var(--color-gray-50);  /* warm, not pure white */
  --surface-secondary: var(--color-gray-100);
  --surface-invert:    var(--color-gray-900);

  /* ---- Text ---- */
  --text:           var(--color-gray-900);
  --text-secondary: var(--color-gray-600);
  --text-tertiary:  var(--color-gray-400);
  --text-invert:    var(--color-gray-50);
  --text-link:      var(--color-blue-600);

  /* ---- Border ---- */
  --border:       var(--color-gray-200);
  --border-focus: var(--color-blue-500);

  /* ---- Action ---- */
  --action-primary:       var(--color-blue-600);
  --action-primary-hover: var(--color-blue-700);
  --action-destructive:   var(--color-red-500);

  /* ---- State ---- */
  --success: var(--color-green-500);
  --warning: var(--color-amber-500);
  --error:   var(--color-red-500);
  --info:    var(--color-blue-500);
}

.dark {
  --surface:           var(--color-gray-950);
  --surface-secondary: var(--color-gray-900);
  --surface-invert:    var(--color-gray-50);

  --text:           var(--color-gray-50);
  --text-secondary: var(--color-gray-400);
  --text-tertiary:  var(--color-gray-600);
  --text-invert:    var(--color-gray-900);
  --text-link:      var(--color-blue-400);

  --border:       var(--color-gray-800);
  --border-focus: var(--color-blue-400);

  --action-primary:       var(--color-blue-500);
  --action-primary-hover: var(--color-blue-400);
}

@theme inline {
  --color-surface:         var(--surface);
  --color-surface-secondary: var(--surface-secondary);
  --color-text:            var(--text);
  --color-text-secondary:  var(--text-secondary);
  --color-border:          var(--border);
  --color-action-primary:  var(--action-primary);
}
```

#### Layer 3: Component Tokens (`tokens/components.css`)

Scoped to individual components. Always reference semantic tokens.

```css
:root {
  --button-radius:    var(--radius-md);
  --button-transition: all 150ms var(--ease-out);
  --card-radius:      var(--radius-xl);
  --card-shadow:      var(--shadow-sm);
  --card-padding:     1.5rem;
  --dialog-radius:    var(--radius-2xl);
  --dialog-shadow:    var(--shadow-xl);
  --input-radius:     var(--radius-md);
  --input-border:     1px solid var(--border);
}
```

#### Entry Point (`app.css`)

```css
@import "tailwindcss";
@import "./tokens/primitives.css";
@import "./tokens/semantic.css";
@import "./tokens/components.css";
@plugin "@tailwindcss/typography";
@custom-variant dark (&:where(.dark, .dark *));
```

### Typography System

Use a modular scale — never pick font sizes arbitrarily.

| Level | Size | Line Height | Letter Spacing | Use |
|-------|------|-------------|----------------|-----|
| Display | 72–120px | 1.0–1.1 | -0.03em | Hero headlines |
| H1 | 48–64px | 1.1–1.2 | -0.02em | Page titles |
| H2 | 32–40px | 1.2 | -0.01em | Section headings |
| H3 | 24–28px | 1.3 | 0 | Subsection headings |
| Body | 16–18px | 1.5–1.6 | 0 | Content text |
| Small | 12–14px | 1.4 | +0.01em | Captions, labels |
| CJK Body | 16–18px | 1.6–1.8 | 0 | Chinese content |

**Rules:**
- Measure (line length): 45–75 characters for body text. Wider destroys readability.
- Limit to 2 font families (3 max). Use weight/size/case for variation.
- Font pairing: contrast principle — pair serif display with sans-serif body or vice versa.

### Color Architecture

- **60-30-10 rule**: 60% dominant neutral (surfaces), 30% secondary (text, borders), 10% accent (CTAs, status).
- **Warm neutrals**: Use `oklch(0.985 0.002 250)` (warm off-white) not pure `#fff`. Use `oklch(0.13 0.006 250)` (warm near-black) not `#000`.
- **OKLCH palette generation**: Keep hue constant, step lightness evenly, taper chroma at extremes.
- **Opacity**: Use slash syntax `bg-blue-500/50` (not deprecated `bg-opacity-*`).
- **Data viz colors**: Use `--chart-1` through `--chart-5` tokens that auto-adapt to dark mode.

### Spatial System

- **8px base grid**: Tailwind's `--spacing: 0.25rem` means `spacing-2 = 8px`. All spacing derives from this.
- **Vertical rhythm hierarchy**:
  - Between page sections: 96–192px (generous, breathable)
  - Between content groups: 48–64px
  - Between heading and content: 16–32px (tight, grouped)
  - Between paragraphs: 16–24px
  - Between list items: 8–12px
- **Proximity principle**: Related items close together, unrelated items far apart. Never uniform spacing.
- **Container widths**: max-width 1200–1440px for content, with responsive padding 24–80px.

---

## Tailwind CSS v4 Patterns

### Core Setup

```css
/* app.css — replaces @tailwind base/components/utilities */
@import "tailwindcss";

/* Design tokens via @theme (replaces tailwind.config.js) */
@theme {
  --color-brand-500: oklch(0.60 0.16 250);
  --font-sans: "Inter", system-ui, sans-serif;
  --radius-lg: 0.5rem;
}

/* Plugins via @plugin (replaces require() in config) */
@plugin "@tailwindcss/typography";

/* Dark mode via @custom-variant (replaces darkMode: 'class') */
@custom-variant dark (&:where(.dark, .dark *));
```

### Key Differences from v3

| v3 | v4 |
|----|-----|
| `tailwind.config.js` | `@theme` directive in CSS |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| `content: [...]` array | Automatic detection (Rust engine) |
| `bg-opacity-50` | `bg-brand-500/50` (slash syntax) |
| `theme.extend.colors` | `--color-*` in `@theme` |
| `require('@tailwindcss/typography')` | `@plugin "@tailwindcss/typography"` |
| `darkMode: 'class'` | `@custom-variant dark (...)` |
| `theme()` function in CSS | `var(--)` everywhere |

### `@theme inline` for CSS Variable Resolution

When token values use `var()`, use `@theme inline` so Tailwind resolves them correctly:

```css
@theme inline {
  --color-primary: var(--primary);        /* resolves at runtime */
  --color-background: var(--background);
}
```

This is what shadcn/ui uses to bridge CSS custom properties to Tailwind utilities.

### Container Queries (Built-in)

```html
<div class="@container">
  <div class="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3">
    <!-- responsive to CONTAINER, not viewport -->
  </div>
</div>

<!-- Named containers for nested layouts -->
<div class="@container/sidebar">
  <div class="@container/card">
    <h2 class="@lg/sidebar:text-2xl @sm/card:text-lg">Title</h2>
  </div>
</div>
```

### Custom Utilities and Variants

```css
/* Custom utility that works with all variants */
@utility scrollbar-hidden {
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

/* Custom variant for multi-theme support */
@custom-variant theme-midnight (&:where([data-theme="midnight"] *));
```

### Scanning Additional Paths

```css
/* Tell Tailwind to scan external component libraries */
@source "../node_modules/@my-company/ui-lib";
```

---

## Next.js 16 & React 19 Patterns

### next.config.ts (TypeScript Default)

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Enables "use cache", PPR, and dynamic IO
  cacheComponents: true,

  // React Compiler: stable in 16, auto-memoizes components
  reactCompiler: true,

  // Custom cache profiles (optional)
  cacheLife: {
    biweekly: {
      stale: 60 * 60 * 24,
      revalidate: 60 * 60 * 24 * 7,
      expire: 60 * 60 * 24 * 14,
    },
  },
};

export default nextConfig;
```

**Breaking changes from 14/15:**

| Area | Old | Next.js 16 |
|------|-----|------------|
| Config file | `next.config.js` | `next.config.ts` |
| Bundler | Webpack default | Turbopack default |
| Turbopack config | `experimental.turbopack` | Top-level `turbopack` |
| Caching | Implicit fetch cache | Opt-in `"use cache"` only |
| PPR | `experimental.ppr` | `cacheComponents: true` |
| React Compiler | `experimental.reactCompiler` | `reactCompiler: true` |
| Middleware | `middleware.ts` / `middleware()` | `proxy.ts` / `proxy()` |
| `revalidateTag` | `revalidateTag('tag')` | `revalidateTag('tag', 'profile')` (2nd arg required) |
| `params`/`searchParams` | Sync objects | `Promise` — must `await` |
| `forwardRef` | Required | Deprecated (ref is a regular prop) |

### `use cache` Directive

No more implicit fetch caching. Everything is uncached by default. Opt in explicitly:

```typescript
// app/products/page.tsx
"use cache";

import { cacheLife, cacheTag } from "next/cache";

export default async function ProductsPage() {
  cacheLife("hours");       // revalidate hourly
  cacheTag("products");     // tag for on-demand revalidation

  const products = await db.query("SELECT * FROM products WHERE active = true");
  return <ProductList products={products} />;
}
```

Three variants: `'use cache'` (shared), `'use cache: private'` (reads cookies), `'use cache: remote'` (off-memory/Redis).

### PPR (Partial Prerendering)

Static shell + streamed dynamic content. No special directive — wrap dynamic Server Components in `<Suspense>`:

```typescript
// app/dashboard/page.tsx
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <DashboardShell>
      {/* Static: prerendered at build */}
      <h1>Dashboard</h1>
      <nav>{/* static links */}</nav>

      {/* Dynamic: streamed at request time */}
      <Suspense fallback={<UserSkeleton />}>
        <UserGreeting />
      </Suspense>

      <div className="grid grid-cols-2 gap-6">
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart />
        </Suspense>
        <Suspense fallback={<OrdersSkeleton />}>
          <RecentOrders />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
```

### React 19 Patterns

**useActionState** (replaces useFormState):

```typescript
"use client";

import { useActionState } from "react";
import { createProduct } from "@/app/actions/product-actions";

const initialState = { success: false, message: "", errors: undefined };

export function ProductForm() {
  const [state, formAction, isPending] = useActionState(createProduct, initialState);

  return (
    <form action={formAction}>
      <input name="name" required />
      {state.errors?.name && <p className="text-error text-sm">{state.errors.name[0]}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Product"}
      </button>
    </form>
  );
}
```

**useOptimistic** for instant UI during async:

```typescript
const [optimisticTodos, addOptimisticTodo] = useOptimistic(
  todos,
  (current, newTodo: Todo) => [...current, { ...newTodo, pending: true }]
);
```

**ref as prop** (no more forwardRef):

```typescript
// React 19: ref is just a prop
function Input({ ref, ...props }: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}
```

**Activity component** (React 19.2+) — preserves state without unmounting:

```typescript
import { Activity } from "react";

<Activity mode={activeTab === "overview" ? "visible" : "hidden"}>
  <OverviewTab />  {/* state, scroll, inputs preserved when hidden */}
</Activity>
```

**params is async** — must `await`:

```typescript
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ...
}
```

### Server Actions Pattern

Dedicated `'use server'` files. Security: authenticate → validate → authorize → mutate → revalidate.

```typescript
// app/actions/product-actions.ts
"use server";

import { z } from "zod";
import { revalidateTag } from "next/cache";

const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  categoryId: z.string().uuid(),  // Zod v4: z.uuid() also available as top-level
});

type ActionState = { success: boolean; message: string; errors?: Record<string, string[]> };

export async function createProduct(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session) return { success: false, message: "Unauthorized" };

  const parsed = CreateProductSchema.safeParse({
    name: formData.get("name"),
    price: Number(formData.get("price")),
    categoryId: formData.get("categoryId"),
  });
  if (!parsed.success) return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };

  await db.insert("products", parsed.data);
  revalidateTag("products", "max");  // Next.js 16: second arg required
  return { success: true, message: "Product created" };
}
```

### proxy.ts (replaces middleware.ts)

```typescript
// proxy.ts (project root or src/)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("auth_token");
  if (!token) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/settings/:path*"] };
```

Keep proxy.ts lightweight: redirects, rewrites, header injection only. No heavy auth logic.

### TanStack Query v5 Patterns

```typescript
// Single object argument (v5 style)
const { data, isPending } = useQuery({
  queryKey: ["products", categoryId],
  queryFn: () => fetchProducts(categoryId),
  gcTime: 5 * 60 * 1000,         // was cacheTime in v4
  staleTime: 30 * 1000,
});

// Suspense hook
const { data } = useSuspenseQuery({
  queryKey: ["product", id],
  queryFn: () => fetchProduct(id),
});
```

Status is `pending` (not `loading`). Use `isPending` instead of `isLoading`.

---

## Suggested Frontend Structure

```text
apps/web/src/
├── app/
│   ├── api/[[...path]]/route.ts    # runtime API proxy
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── loading.tsx             # route-level streaming skeleton
│   │   └── error.tsx               # route-level error boundary
│   ├── actions/                    # Server Action files
│   └── layout.tsx
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   └── shared/
├── features/
│   └── <bounded-context>/
│       ├── components/
│       ├── hooks/
│       ├── server/
│       └── view-model/
├── lib/
│   ├── api/
│   │   ├── generated/              # openapi-generator output
│   │   └── client.ts
│   ├── utils/
│   └── config/
└── styles/
    ├── tokens/
    │   ├── primitives.css
    │   ├── semantic.css
    │   └── components.css
    └── app.css
```

---

## shadcn/ui (CLI v4) Patterns

### Current State (2026)

- **60+ components** including: Chart, Empty, Spinner, Input Group, Input OTP, Sidebar, Kbd, Direction (RTL)
- **OKLCH color space** for all tokens (replaces HSL `hsl(var(--primary))`)
- **Unified `radix-ui` package** — single import replaces all `@radix-ui/react-*` packages
- **Two primitive libraries**: Radix UI (default) and Base UI
- **CLI v4**: presets, `--dry-run`/`--diff`/`--view`, `shadcn/skills` for AI agents, `--base` flag

### Theming Setup

shadcn/ui bridges CSS variables to Tailwind via `@theme inline`:

```css
@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  /* ... full sidebar token set */
}
```

Radius uses a single anchor with computed scale:

```css
@theme inline {
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}
```

### Adding Custom Tokens

```css
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}
.dark {
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
}

@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

Enables `bg-warning` and `text-warning-foreground` as Tailwind utilities.

### Form Primitives (New in 2026)

The old `FormField`/`FormItem`/`FormMessage` is replaced by generic field primitives:

```tsx
import { Controller } from "react-hook-form";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";

<Controller
  name="title"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={field.name}>Title</FieldLabel>
      <Input {...field} id={field.name} />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

Works with React Hook Form, TanStack Form, and (coming) React `useActionState`.

### Built-in Charts (Recharts v3)

shadcn/ui includes first-class chart components. Install: `pnpm dlx shadcn@latest add chart`.

```tsx
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function MyChart() {
  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
        <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
        <ChartTooltip content={<ChartTooltipContent />} />
      </BarChart>
    </ChartContainer>
  );
}
```

Colors auto-adapt to dark mode via `--chart-1..5` tokens.

### Sidebar Component

First-class layout component with dedicated token set:

```tsx
<SidebarProvider>
  <Sidebar variant="sidebar" collapsible="icon">
    <SidebarHeader />
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton isActive>Dashboard</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter />
  </Sidebar>
  <SidebarInset>
    <main>{children}</main>
  </SidebarInset>
</SidebarProvider>
```

Variants: `sidebar` (default), `floating`, `inset`. Collapsible modes: `offcanvas`, `icon`, `none`. Auto mobile detection. `cmd+b` toggle.

### Dropdown Clipping in Overflow Containers

shadcn dropdowns (DropdownMenu, Select, Popover) clip inside tables or containers with `overflow-auto`. Use `createPortal`:

```typescript
import { createPortal } from "react-dom";

function RoleDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    const rect = btnRef.current!.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  };

  return (
    <>
      <button ref={btnRef} onClick={handleOpen}>{value}</button>
      {open && createPortal(
        <div style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 50 }}>
          {/* menu items */}
        </div>,
        document.body
      )}
    </>
  );
}
```

### shadcn MCP Usage Guidance

Use shadcn MCP before custom implementation for:
- data tables
- complex forms
- dialogs and sheets
- comboboxes and command menus
- date pickers
- dashboard primitives
- charts

After selecting a base primitive, restyle it to match the project's art direction.

---

## Performance Targets

### Core Web Vitals

| Metric | Target | How |
|--------|--------|-----|
| LCP | < 2.5s | Preload hero image/font, SSR above-fold, PPR for mixed pages |
| INP | < 200ms | Break long tasks, virtualize lists, debounce heavy handlers |
| CLS | < 0.1 | Set explicit dimensions on images/embeds, `font-display: swap` |

### Bundle Budget

- Initial JS: **< 100KB** compressed
- Code split by route: `React.lazy` + `<Suspense>`
- Tree shake: ES modules only, avoid side-effect-heavy imports

### Rendering Strategy

- **PPR** for pages with mixed static/dynamic content (dashboards, product pages)
- **`use cache`** for server-side data caching (replaces implicit fetch cache)
- **Streaming SSR** with `<Suspense>` boundaries per component
- **`loading.tsx`** for route-level streaming skeletons
- **`error.tsx`** for route-level error boundaries (must be Client Components)
- **Parallel fetches**: `Promise.all([...])` not sequential `await` waterfalls

### Skeleton Design

Skeletons must match real layout shapes — not generic blocks:

```typescript
// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-64 bg-muted rounded" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 bg-muted rounded" />
        <div className="h-32 bg-muted rounded" />
        <div className="h-32 bg-muted rounded" />
      </div>
      <div className="h-64 bg-muted rounded" />
    </div>
  );
}
```

---

## Runtime API Proxy (Mandatory)

**Never use `rewrites` in `next.config.ts` to proxy API calls.** The `process.env.INTERNAL_API_BASE_URL` in rewrites is evaluated at **build time** and baked into the Docker image.

### Solution: Catch-all API route

Create `src/app/api/[[...path]]/route.ts` that reads the env var at **runtime**:

```typescript
import { NextRequest, NextResponse } from "next/server";

const API_BASE = () =>
  process.env.INTERNAL_API_BASE_URL || "http://localhost:8080";

async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api/, "");
  const search = req.nextUrl.search;
  const target = `${API_BASE()}${path}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const init: RequestInit & { duplex?: string } = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }

  const upstream = await fetch(target, init);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
```

Keep `next.config.ts` as:
```typescript
import type { NextConfig } from "next";
const config: NextConfig = { output: "standalone" };
export default config;
```

---

## SSE / EventSource Patterns

### Basic EventSource Consumption

```typescript
const es = new EventSource(`/api/tasks/${taskId}/stream`);

es.addEventListener("tool_call", (e) => {
  const data = JSON.parse(e.data);
  // handle event
});

es.addEventListener("done", () => {
  es.close();
});

// Cleanup
return () => es.close();
```

### Text Chunk Concatenation

AI models stream text character-by-character. **Never create a new DOM element per chunk.** Instead, merge consecutive same-type events:

```typescript
const addEvent = (type, content) => {
  setEvents((prev) => {
    if (prev.length > 0 && prev[prev.length - 1].type === type) {
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        content: updated[updated.length - 1].content + content,
      };
      return updated;
    }
    return [...prev, { id: nextId++, type, content }];
  });
};
```

Without this, streaming CJK text appears as separate characters per line.

### EventSource Error Handling

```typescript
es.onerror = () => {
  if (doneReceived) {
    es.close(); // Expected — server closed after done
    return;
  }
  if (receivedAnyEvent) {
    setStatus("done"); // Server closed for completed resource
    es.close();
  }
  // Otherwise: connection issue, EventSource auto-retries
};
```

### Lazy Tab Loading

For tabbed UIs, only fetch heavy data when the user clicks the tab:

```typescript
const handleTabChange = (tab: string) => {
  setActiveTab(tab);
  if (tab === "excel" && !excelLoaded) {
    fetchExcelPreview(taskId).then(setSheets);
  }
};
```

---

## Markdown Rendering

Install: `react-markdown`, `remark-gfm`, `@tailwindcss/typography`.

CSS setup (Tailwind v4):
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

Component:
```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

<div className="prose prose-sm max-w-none dark:prose-invert">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {markdownContent}
  </ReactMarkdown>
</div>
```

---

## Excel Table Rendering

Render Excel data as HTML tables with sticky headers:

```tsx
<div className="overflow-auto max-h-[600px] border rounded-md">
  <table className="w-full text-xs border-collapse">
    <thead className="sticky top-0 z-10">
      <tr>
        {headers.map(h => (
          <th className="bg-muted/80 backdrop-blur px-3 py-2 text-left font-medium border-b whitespace-nowrap">
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map(row => (
        <tr className="hover:bg-muted/30">
          {row.map(cell => <td className="px-3 py-1.5 border-b whitespace-nowrap">{cell}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

---

## Async Task UI Pattern

### Polling While Active

```typescript
useEffect(() => {
  if (task?.status === "pending" || task?.status === "processing") {
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }
}, [task, fetchData]);
```

### Status Badge Component

```tsx
const config = {
  pending:    { label: "Pending",    className: "bg-amber-100 text-amber-700" },
  processing: { label: "Processing", className: "bg-blue-100 text-blue-700" },
  completed:  { label: "Completed",  className: "bg-green-100 text-green-700" },
  failed:     { label: "Failed",     className: "bg-red-100 text-red-700" },
};
```

### Inline Edit Pattern

Click-to-edit with Enter to save, Escape to cancel:

```tsx
const [isEditing, setIsEditing] = useState(false);
const [editValue, setEditValue] = useState("");

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") save();
  if (e.key === "Escape") cancel();
};

// Show: title + pencil icon (opacity-0 group-hover:opacity-100)
// Edit: Input + check/x buttons
```

---

## Production Polish Checklist

- Typography hierarchy is explicit and non-generic.
- Container widths, spacing rhythm, and section density are consistent.
- Focus states are visible (outline, not border).
- Touch targets are comfortable on mobile (min 44px).
- Error messages are inline and actionable.
- Skeleton states match real layout shapes.
- Server and client rendering boundaries are deliberate.
- Generated API clients are wrapped instead of called directly.
- Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- Initial JS bundle < 100KB compressed.
- `loading.tsx` and `error.tsx` for every data-fetching route.
- Dark mode works via semantic tokens, not ad-hoc `dark:` overrides.

---

## Common Development Lessons

### Environment & Build

- `GOPROXY=https://goproxy.cn,direct` — always set for Chinese network environments.
- Go `catch {}` without a parameter is not valid in older TypeScript configs — use `catch (_err) {}`.
- TypeScript `Event` vs `MessageEvent` — SSE `onerror` provides `Event`, not `MessageEvent`. Name custom error events `agent_error` to avoid collision with the built-in `error` event.

### AI Agent Prompting

- If an AI agent repeatedly calls a function with wrong arguments, add **explicit function signatures with a code template** to the system prompt.
- Make critical outputs mandatory: "A task that does not generate an Excel report is considered incomplete."
- For `dict.get()` style access in AI-generated code, always use `.get(key, default)` instead of `dict[key]` to avoid KeyError.
