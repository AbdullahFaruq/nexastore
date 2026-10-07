---
name: nextjs-ui-builder
description: Build, inspect, fix, and improve the UI of this Next.js project.
---

# Next.js UI Builder

Use this skill whenever working on the frontend or UI of this project.

## Core rules

- Use Next.js App Router.
- Use TypeScript.
- Use Tailwind CSS.
- Use shadcn/ui when appropriate.
- Reuse existing components before creating new ones.
- Follow the project's existing visual design and component patterns.
- Keep components reusable and maintainable.
- Keep desktop, tablet, and mobile layouts responsive.
- Follow accessibility best practices.

## UI work

When building or improving UI:

- Keep spacing consistent.
- Keep typography consistent.
- Maintain clear visual hierarchy.
- Avoid unnecessary text and clutter.
- Make navigation simple and understandable.
- Make forms, buttons, cards, tables, and dashboards easy to use.
- Make pricing or comparison sections easy to scan.
- Match screenshots or design references closely when provided.

## Safety

- Do not modify backend logic unless explicitly asked.
- Do not change database code unless explicitly asked.
- Do not modify authentication unless explicitly asked.
- Do not change APIs unless explicitly asked.
- Do not change unrelated functionality.

## Analysis mode

If I ask you to inspect, review, or analyze only:

- Do not edit any files.
- Inspect the relevant source code.
- Inspect the running application visually when possible.
- Check desktop and mobile.
- List the most important UI/UX problems.
- Prioritize the problems by impact.

## Editing mode

If I ask you to fix or improve something:

1. Inspect the existing implementation first.
2. Reuse existing components and styles where possible.
3. Make only changes relevant to the requested task.
4. Run the project after making changes.
5. Visually inspect the affected pages.
6. Check desktop and mobile.
7. Fix any UI regressions introduced by the changes.
8. Report which files were changed.
9. Briefly explain what changed in each file.
