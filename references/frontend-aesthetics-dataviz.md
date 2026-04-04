# Frontend Aesthetics & Data Visualization

## Purpose

Patterns for building data-heavy, premium frontends that handle real datasets — not demo dashboards with 3 cards and a pie chart. Updated for Motion 12 (`motion/react`), ECharts 6, Recharts 3, Tailwind CSS v4, and modern CSS.

---

## 1. Motion Design System

Stock shadcn has zero motion. Premium products use deliberate, functional transitions.

### Motion Philosophy

- **Hierarchy**: page transitions (most impactful, use sparingly) > scroll reveals (moderate) > hover/focus (subtle, frequent) > loading states (functional). Higher-level motions are slower and more prominent.
- **Timing**: 150ms for micro-interactions (hover, focus), 200–300ms for UI feedback (status change, tab switch, list item), 500ms for dramatic/page-level entrances.
- **Spring easing**: `cubic-bezier(0.16, 1, 0.3, 1)` for a satisfying bounce on entrances. Never use `linear`.
- **Staggered children**: `staggerChildren: 0.05` for list items appearing sequentially — creates a cascade effect.
- **Accessibility**: Always respect `prefers-reduced-motion`. Use Motion's `useReducedMotion()` hook or CSS `@media (prefers-reduced-motion: reduce)`.
- **CSS vs library**: Use CSS transitions for simple cases (hover, focus, color changes). Use Motion library for complex animations (layout, exit, gesture, shared layout).

### Layout Transitions

```tsx
import { motion, AnimatePresence } from "motion/react";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

<AnimatePresence mode="wait">
  <motion.div key={pathname} variants={pageVariants}
    initial="initial" animate="enter" exit="exit">
    {children}
  </motion.div>
</AnimatePresence>
```

### Staggered List Animation

```tsx
import { motion } from "motion/react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { ease: [0.16, 1, 0.3, 1] } },
};

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map((i) => (
    <motion.li key={i.id} variants={item}>{i.name}</motion.li>
  ))}
</motion.ul>
```

### Micro-interactions That Matter

| Element | Motion | Duration | Why |
|---------|--------|----------|-----|
| Status badge change | color crossfade | 200ms | Draws eye to state change |
| New list item | slide-in from top + fade | 250ms | Shows causality (I created this) |
| Delete item | height collapse + fade | 200ms | Confirms removal |
| Tab switch | underline slide | 150ms | Spatial continuity |
| Toast notification | slide-in from right | 300ms | Non-blocking attention |
| Skeleton → content | opacity crossfade | 150ms | Seamless load |

### Rules

- Never exceed 300ms for UI feedback. Users perceive > 300ms as lag.
- Never animate on scroll (parallax, reveal-on-scroll). It adds no value in data products.
- Never animate layout on data refresh — content jumping is worse than no animation.
- Loading spinners: 200ms delay before showing. Most loads finish faster and the spinner never appears.

---

## 2. Data-Dense UI Patterns

Dashboards for professionals need **information density**, not whitespace tourism.

### Compact Table Design

```tsx
// Dense mode: 28px rows, 12px font, minimal padding
<table className="text-xs leading-tight">
  <tbody>
    <tr className="h-7 border-b border-muted/50 hover:bg-muted/20">
      <td className="px-2 py-0.5 font-mono tabular-nums">{value}</td>
    </tr>
  </tbody>
</table>
```

Key CSS: `tabular-nums` aligns numbers in columns. Without it, "1,234" and "12,345" don't line up.

### Number Formatting

```typescript
// Tokens (large integers): 1,234,567
const fmtInt = (n: number) => n.toLocaleString("en-US");

// Percentages: +0.42% or -3.17%
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

// Currency (CNY): ¥1,234.56
const fmtCNY = (n: number) => `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;

// Conditional coloring
const pctColor = (n: number) =>
  Math.abs(n) <= 1 ? "text-green-600" :
  Math.abs(n) <= 5 ? "text-amber-600" :
  "text-red-600";
```

### Sticky Multi-Axis Table

For reconciliation-style tables with frozen row headers and column headers:

```tsx
<div className="overflow-auto max-h-[calc(100vh-200px)]">
  <table className="border-collapse">
    <thead className="sticky top-0 z-20">
      {/* Header row */}
    </thead>
    <tbody>
      {rows.map(row => (
        <tr>
          {/* First column sticky */}
          <td className="sticky left-0 z-10 bg-background">{row.label}</td>
          {row.values.map(v => <td className="tabular-nums text-right">{v}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### Heat Map Cells

For difference/delta values, encode magnitude as background intensity:

```tsx
function HeatCell({ value, max }: { value: number; max: number }) {
  const intensity = Math.min(Math.abs(value) / max, 1);
  const bg = value >= 0
    ? `rgba(34,197,94,${intensity * 0.3})`   // green
    : `rgba(239,68,68,${intensity * 0.3})`;   // red
  return (
    <td style={{ backgroundColor: bg }} className="tabular-nums text-right px-2">
      {fmtPct(value)}
    </td>
  );
}
```

---

## 3. Chart Library Selection

| Library | Best For | Bundle | Version |
|---------|----------|--------|---------|
| **shadcn Chart** (Recharts v3) | Dashboards with shadcn theming | ~45KB | Built-in, `--chart-1..5` tokens |
| **Apache ECharts 6** (via echarts-for-react) | Data-dense, CJK, large datasets, 3D | 300KB (tree-shakeable to ~80KB) | v6: new default theme |
| **Recharts** (standalone) | Simple dashboards, quick start | ~45KB | v3 composable API |
| **Observable Plot** | Statistical/analytical charts | ~20KB | D3-based |
| **D3** (raw) | Full custom, novel visualizations | ~80KB | Low-level |

**Recommendations:**
- **Default for dashboards**: shadcn built-in Chart component (Recharts v3 with `--chart-1..5` token integration, auto dark mode). Install: `pnpm dlx shadcn@latest add chart`.
- **Data-heavy products** (reconciliation, analytics, monitoring): ECharts 6 for performance with large datasets.
- **Tremor**: Shifting to a copy-paste model at tremor.so (similar to shadcn). For new projects, prefer shadcn charts or direct ECharts/Recharts.

### shadcn Chart Pattern (Preferred for Dashboards)

```tsx
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  cost:    { label: "Cost",    color: "var(--chart-2)" },
} satisfies ChartConfig;

export function RevenueChart({ data }) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
        <Bar dataKey="cost" fill="var(--color-cost)" radius={4} />
        <ChartTooltip content={<ChartTooltipContent />} />
      </BarChart>
    </ChartContainer>
  );
}
```

### ECharts 6 Setup

```tsx
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

function ReconciliationChart({ data }) {
  const option = {
    tooltip: { trigger: "axis" },
    // ECharts 6: legend defaults to bottom now. Set explicitly for v5 behavior:
    legend: { data: ["Ours", "Supplier"], top: "top" },
    xAxis: { type: "category", data: data.map(d => d.date) },
    yAxis: { type: "value", name: "Tokens" },
    series: [
      { name: "Ours", type: "bar", data: data.map(d => d.ours), itemStyle: { color: "#4472C4" } },
      { name: "Supplier", type: "bar", data: data.map(d => d.supplier), itemStyle: { color: "#ED7D31" } },
    ],
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 400 }} />;
}
```

**ECharts 6 breaking changes:**
- New default theme — visual style and component positions changed. Legend now at bottom by default.
- Anti-overflow and anti-overlap enabled by default on Cartesian axes.
- Rich label styles now inherit from plain label styles (`richInheritPlainLabel: false` to revert).
- To keep v5 look: `import 'echarts/theme/v5'` and set `theme="v5"` on the component.

### Large Dataset Rendering (>10K points)

```typescript
// ECharts handles 100K+ points natively with downsampling
option.series[0].large = true;
option.series[0].largeThreshold = 5000;

// For Recharts: virtualize or aggregate client-side
const aggregated = data.reduce((acc, d) => {
  const key = d.date.slice(0, 7); // monthly
  acc[key] = (acc[key] || 0) + d.value;
  return acc;
}, {});
```

---

## 4. Dark Mode Done Right

Not just "invert colors." Data-heavy UIs need different dark mode strategies.

### Enterprise Approach: Semantic Token Swap

The best pattern: components use `bg-surface text-text` — dark mode swaps happen in the token layer. No `dark:` prefix needed in component code.

```css
/* tokens/semantic.css */
:root {
  --surface: var(--color-gray-50);     /* warm off-white */
  --text:    var(--color-gray-900);
}
.dark {
  --surface: var(--color-gray-950);
  --text:    var(--color-gray-50);
}
```

```html
<!-- No dark: prefix needed -->
<div class="bg-surface text-text">Always correct in both modes</div>
```

Reserve `dark:` prefix for edge cases where token system doesn't cover the need.

### Chart Color Tokens

Use OKLCH values that adapt to dark backgrounds:

```css
:root {
  --chart-1: oklch(0.646 0.222 41.116);   /* primary series */
  --chart-2: oklch(0.6 0.118 184.704);    /* comparison */
  --chart-3: oklch(0.398 0.07 227.392);   /* tertiary */
  --chart-4: oklch(0.828 0.189 84.429);   /* highlight */
  --chart-5: oklch(0.769 0.188 70.08);    /* accent */
}

.dark {
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
}
```

### Table Borders in Dark Mode

```tsx
// Light: subtle gray borders. Dark: slightly lighter than background, not white.
className="border-b border-muted/50 dark:border-muted/30"
```

### ECharts Theme Switching

```typescript
const chartTheme = resolvedTheme === "dark" ? {
  backgroundColor: "transparent",
  textStyle: { color: "#a1a1aa" },
  axisLine: { lineStyle: { color: "#3f3f46" } },
} : {};
```

---

## 5. Modern CSS Features

### Container Queries (Built into Tailwind v4)

Component-level responsive design independent of viewport:

```html
<div class="@container">
  <div class="grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3">
    <!-- responsive to container, not viewport -->
  </div>
</div>

<!-- Named containers for nested layouts -->
<div class="@container/sidebar">
  <h2 class="@lg/sidebar:text-2xl text-lg">Title</h2>
</div>
```

### CSS Nesting (Native)

No preprocessor needed. Cleaner component styles:

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);

  & .title {
    font-weight: 600;
    color: var(--text);
  }

  &:hover {
    box-shadow: var(--shadow-md);
  }
}
```

### :has() Selector

Parent-based styling without JavaScript:

```css
/* Style form group when input inside is invalid */
.field:has(input:invalid) {
  --input-border-color: var(--error);
}

/* Card layout changes when it contains an image */
.card:has(img) {
  grid-template-rows: auto 1fr;
}
```

### View Transitions API

Page transitions without a JS animation library:

```css
@view-transition {
  navigation: auto;
}

::view-transition-old(root) {
  animation: fade-out 150ms ease-in;
}

::view-transition-new(root) {
  animation: fade-in 200ms ease-out;
}
```

### oklch() for Palette Generation

Perceptually uniform: keep hue constant, step lightness, taper chroma at extremes:

```css
@theme {
  /* Brand palette — hue 250, chroma tapers at extremes */
  --color-brand-50:  oklch(0.98 0.01 250);
  --color-brand-500: oklch(0.60 0.16 250);   /* primary */
  --color-brand-950: oklch(0.13 0.06 250);
}
```

---

## 6. Chinese Typography

For Chinese-first products, the default system font stack is wrong.

```css
font-family:
  "PingFang SC",        /* macOS */
  "Microsoft YaHei",    /* Windows */
  "Noto Sans SC",       /* Linux/Android */
  system-ui,
  -apple-system,
  sans-serif;
```

### CJK Table Considerations

- Chinese characters are wider than Latin — column widths need 1.5x for mixed content.
- Monospace numbers: always `font-variant-numeric: tabular-nums` for number columns.
- Line height: 1.6-1.8 for body text (vs 1.5 for Latin).
- Don't `truncate` Chinese labels — they lose meaning. Prefer wrapping or tooltip.

---

## 7. Export Patterns

### Client-Side CSV Export

```typescript
function exportCSV(data: Record<string, any>[], filename: string) {
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const v = String(row[h] ?? "");
      return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",")
  );
  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n"); // BOM for Excel CJK
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Key**: `\uFEFF` BOM prefix is required for Excel to correctly read UTF-8 Chinese characters.

### PDF Export (server-side)

For complex reports with charts, generate PDF on the server using headless Chrome or wkhtmltopdf. Don't try client-side PDF — the quality is never right for CJK.
