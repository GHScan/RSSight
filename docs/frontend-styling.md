# Frontend styling (Tailwind)

This document describes the Tailwind-based styling foundation for the WebRSSReader frontend.

## Tailwind configuration

- **Config file:** `frontend/tailwind.config.js`
- **Content:** `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`
- **Entry CSS:** `frontend/src/index.css` (imported from `main.tsx`)

## Design tokens

Tokens are defined as CSS custom properties in `frontend/src/index.css` under `:root` and exposed via Tailwind theme in `tailwind.config.js`.

### Colors (semantic)

| Token        | Usage                          |
| ------------ | ------------------------------ |
| `background` | Page and surface background   |
| `foreground` | Default text on background    |
| `primary`    | Primary actions, links        |
| `secondary`  | Secondary actions, subtle UI  |
| `muted`      | Muted text, placeholders      |
| `accent`     | Hover/active accents          |
| `destructive`| Delete, errors, danger        |
| `border`     | Borders                        |
| `ring`       | Focus rings                    |

Use Tailwind classes such as `bg-background`, `text-foreground`, `bg-primary text-primary-foreground`, `border-border`, `ring-ring`.

### Border radius

- `rounded-lg` → `var(--radius-lg)` (0.5rem)
- `rounded-md` → `var(--radius-md)`
- `rounded-sm` → `var(--radius-sm)`

### Typography

- Default font stack: `var(--font-sans)` (system UI fallback).

## Layout conventions

- **Page root:** Use `min-h-screen bg-background text-foreground` on the app root so all pages share the same base.
- **Page width:** Use Tailwind width utilities for content (e.g. `max-w-4xl mx-auto px-4`) when you need a constrained content area.
- **Spacing:** Prefer Tailwind spacing scale (`p-4`, `gap-4`, `space-y-4`) for consistency.

## Core pages (S017)

Home, Feed Management, Article List, Article Summary, and Summary Profiles use consistent Tailwind styles:

- **Layout:** `max-w-4xl mx-auto px-4 py-6` (optionally `sm:px-6`) for content width and spacing.
- **Headings:** `text-2xl font-semibold text-foreground mb-4`.
- **Nav links:** `text-primary hover:underline` with focus ring (`focus:ring-2 focus:ring-ring focus:ring-offset-2`).
- **Lists:** `space-y-2 list-none`, list items with `border-b border-border py-2` where appropriate.
- **Buttons:** Primary `bg-primary text-primary-foreground`, secondary `border border-border bg-background hover:bg-accent`.
- **Forms:** `w-full max-w-md` inputs, `border border-border rounded-md`, `space-y-2` / `space-y-4` for vertical rhythm.
- **Errors:** `text-destructive`; muted text `text-muted-foreground`. Long content uses `break-words`, `whitespace-pre-wrap`, and `overflow-auto max-h-[70vh]` where needed for readability.

## Coexistence with existing styles

- Tailwind is additive. New or updated components should use Tailwind utility classes and semantic tokens above.
- Avoid introducing new global CSS outside `index.css`; extend the Tailwind theme or use `@layer` if needed.
