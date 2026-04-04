# Frontend Design Playbook

## Purpose

Use this reference when implementing the Next.js frontend for projects created with this skill.

## Mandatory Skill Chain

When the environment exposes these skills, use them in this order:

1. `frontend-design`
   - Use first for page direction, layout composition, visual concept, component styling, and initial implementation.
2. `ui-ux-pro-max`
   - Use second for UX refinement, responsive behavior, interaction coverage, state design, accessibility, and production polish.

Do not reverse the order. The first skill establishes the visual language. The second skill improves experience quality and polish.

## Frontend Stack Expectations

- Use Next.js App Router.
- Use TypeScript.
- Use Tailwind CSS.
- Use shadcn/ui primitives, but customize them beyond stock defaults.
- Use shadcn MCP when available to discover or assemble the right components before writing advanced UI.
- Always install `react-markdown` + `remark-gfm` + `@tailwindcss/typography` for any project that renders AI or user-generated markdown.
- Keep `next.config.js` minimal: `output: "standalone"` only. No `rewrites`. See Runtime API Proxy section.

## Visual Quality Bar

The resulting UI must feel premium and production-ready:
- Avoid generic three-card marketing rows and default dashboard templates.
- Avoid default font stacks such as Inter, Arial, Roboto, or plain system UI when the repository allows better typography.
- Choose a deliberate art direction and keep it consistent.
- Customize color tokens, radii, shadows, and spacing instead of using stock shadcn defaults.
- Design all major states: loading, empty, error, success, and disabled.
- Ensure desktop and mobile both feel intentional.
- Prefer subtle motion with purpose over decorative animation spam.

## Suggested Frontend Structure

```text
apps/web/src/
├── app/
├── components/
│   ├── ui/
│   └── shared/
├── features/
│   └── <bounded-context>/
│       ├── components/
│       ├── hooks/
│       ├── server/
│       └── view-model/
├── lib/
│   ├── api/
│   │   ├── generated/
│   │   └── client.ts
│   ├── utils/
│   └── config/
└── styles/
```

## shadcn MCP Usage Guidance

Use shadcn MCP before custom implementation for:
- data tables
- complex forms
- dialogs and sheets
- comboboxes and command menus
- date pickers
- dashboard primitives

After selecting a base primitive, restyle it to match the project's art direction.

## Production Polish Checklist

- Typography hierarchy is explicit and non-generic.
- Container widths, spacing rhythm, and section density are consistent.
- Focus states are visible.
- Touch targets are comfortable on mobile.
- Error messages are inline and actionable.
- Skeleton states match real layout shapes.
- Server and client rendering boundaries are deliberate.
- Generated API clients are wrapped instead of called directly all over the UI.

---

## Runtime API Proxy (Mandatory)

**Never use `rewrites` in `next.config.js` to proxy API calls.** The `process.env.INTERNAL_API_BASE_URL` in rewrites is evaluated at **build time** and baked into the Docker image. When you deploy to a different environment, the URL is wrong and unfixable without a rebuild.

### Solution: Catch-all API route

Create `src/app/api/[[...path]]/route.ts` that reads the env var at **runtime**:

```typescript
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.INTERNAL_API_BASE_URL || "http://api:8080";

async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api/, "");
  const url = `${API_BASE}${path}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");

  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.body,
    // @ts-expect-error -- required for streaming
    duplex: "half",
  });

  return new NextResponse(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
```

This ensures:
- `INTERNAL_API_BASE_URL` is read at runtime from the container environment.
- SSE and streaming responses pass through correctly.
- One Docker image works in all environments.

Keep `next.config.js` as just:
```js
module.exports = { output: "standalone" };
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
    // If last event is same type, append content
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

Without this, "我来开始分析" appears as separate lines: "我", "来", "开", "始", "分", "析"

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

For tabbed UIs, only fetch heavy data (e.g. Excel preview) when the user clicks the tab:

```typescript
const handleTabChange = (tab: string) => {
  setActiveTab(tab);
  if (tab === "excel" && !excelLoaded) {
    fetchExcelPreview(taskId).then(setSheets);
  }
};
```

---

## shadcn/ui Pitfalls & Solutions

### Dropdown Clipping in Overflow Containers

shadcn dropdowns (DropdownMenu, Select, Popover) clip inside tables or containers with `overflow-auto`. Use `createPortal` to render the dropdown at the document body level:

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

### Markdown Rendering

Always use `@tailwindcss/typography` plugin and render with prose class:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

<div className="prose prose-sm max-w-none dark:prose-invert">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {markdownContent}
  </ReactMarkdown>
</div>
```

Required packages: `react-markdown`, `remark-gfm`, `@tailwindcss/typography`.

### Excel Table Rendering

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
  pending:    { label: "待处理", className: "bg-amber-100 text-amber-700" },
  processing: { label: "处理中", className: "bg-blue-100 text-blue-700" },
  completed:  { label: "已完成", className: "bg-green-100 text-green-700" },
  failed:     { label: "失败",   className: "bg-red-100 text-red-700" },
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

### Confirm Before Delete

Use `window.confirm` for simple cases. For important actions, build a proper confirmation dialog.

---

## Common Development Lessons

### Environment & Build

- `GOPROXY=https://goproxy.cn,direct` — always set for Chinese network environments.
- Go `catch {}` without a parameter is not valid in older TypeScript configs — use `catch (_err) {}`.
- `Array.prototype.findLast` may not be available — use `array.filter(...).pop()` as fallback.
- TypeScript `Event` vs `MessageEvent` — SSE `onerror` provides `Event`, not `MessageEvent`. Name custom error events `agent_error` to avoid collision with the built-in `error` event.

### AI Agent Prompting

- If an AI agent repeatedly calls a function with wrong arguments, add **explicit function signatures with a code template** to the system prompt.
- Make critical outputs mandatory: "不生成 Excel 报告的任务视为未完成" / "不调用 submit_analysis 的任务视为未完成".
- For `dict.get()` style access in AI-generated code, always use `.get(key, default)` instead of `dict[key]` to avoid KeyError.
