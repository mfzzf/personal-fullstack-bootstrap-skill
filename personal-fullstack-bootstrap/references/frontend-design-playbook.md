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
