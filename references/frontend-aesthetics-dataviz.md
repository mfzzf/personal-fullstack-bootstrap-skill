# Frontend Aesthetics & Data Visualization

## Purpose

Patterns for building data-heavy, premium frontends that handle real datasets — not demo dashboards with 3 cards and a pie chart.

---

## 1. Motion Design System

Stock shadcn has zero motion. Premium products use deliberate, functional transitions.

### Layout Transitions

```tsx
// Wrap route content for page transitions
import { motion, AnimatePresence } from "framer-motion";

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
- Never animate on scroll (parallax, reveal-on-scroll). It's 2026, not 2016.
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

| Library | Best For | Bundle | SSR |
|---------|----------|--------|-----|
| **Recharts** | Simple dashboards, quick start | 45KB | Partial |
| **Apache ECharts** (via echarts-for-react) | Data-dense, CJK, large datasets, 3D | 300KB (tree-shakeable to ~80KB) | No |
| **Observable Plot** | Statistical/analytical charts | 20KB | Yes |
| **D3** (raw) | Full custom, novel visualizations | 80KB | No |
| **Tremor** | shadcn-style chart components | 60KB | Yes |

**Recommendation**: ECharts for data-heavy products (reconciliation, analytics, monitoring). Recharts for simple SaaS dashboards. Tremor if you want shadcn-native.

### ECharts Setup

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
    legend: { data: ["我方", "供应商"] },
    xAxis: { type: "category", data: data.map(d => d.date) },
    yAxis: { type: "value", name: "Tokens" },
    series: [
      { name: "我方", type: "bar", data: data.map(d => d.ours), itemStyle: { color: "#4472C4" } },
      { name: "供应商", type: "bar", data: data.map(d => d.supplier), itemStyle: { color: "#ED7D31" } },
    ],
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 400 }} />;
}
```

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

### Color Tokens

```css
:root {
  --chart-1: #4472C4;  /* primary data series */
  --chart-2: #ED7D31;  /* comparison series */
  --chart-3: #548235;  /* positive/success */
  --chart-4: #BF8F00;  /* warning/attention */
  --heat-positive: 34, 197, 94;   /* green RGB for alpha blending */
  --heat-negative: 239, 68, 68;   /* red RGB for alpha blending */
}

.dark {
  --chart-1: #7BA4DB;  /* lighter for dark bg */
  --chart-2: #F4A460;
  --chart-3: #7BC67B;
  --chart-4: #DAA520;
}
```

### Table Borders in Dark Mode

```tsx
// Light: subtle gray borders
// Dark: slightly lighter than background, not white
className="border-b border-muted/50 dark:border-muted/30"
```

### Chart Theme Switching

```typescript
const chartTheme = resolvedTheme === "dark" ? {
  backgroundColor: "transparent",
  textStyle: { color: "#a1a1aa" },
  axisLine: { lineStyle: { color: "#3f3f46" } },
} : {};
```

---

## 5. Chinese Typography

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

## 6. Export Patterns

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
