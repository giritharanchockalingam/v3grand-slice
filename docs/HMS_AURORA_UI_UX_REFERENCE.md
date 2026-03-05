# HMS Aurora–Aligned UI/UX Reference

This document captures **world-class UI/UX principles** derived from the [HMS Aurora Portal](https://github.com/giritharanchockalingam/hms-aurora-portal) reference and applies them to the V3 Grand Investment OS. Use it as the single source of truth when building or refining the Agent experience and any agentic surfaces, **and for the entire portal** (Deals, Portfolio, Login, Nav).

---

## 1. Design Principles

| Principle | Description | V3 Grand application |
|-----------|-------------|----------------------|
| **Clear hierarchy** | One primary action per view; sections have a single clear purpose. | Agent page: Workflows (left) = run pipelines; Assistant (right) = chat with Grand. Use `section-title` and consistent heading levels. |
| **Tile-based content** | Chunk information into scannable cards/tiles instead of walls of text. | Assistant replies: `AgentReplyTiles` — each block (heading, list, formula) is a separate card. Workflow steps: tile per step with icon, label, status. |
| **Named assistant** | The AI has a consistent identity (e.g. Grand) in headings, FAB, and loading states. | Use `AGENT_NAME` from `@/lib/agent-constants` everywhere (panel title, “Grand is thinking…”, FAB tooltip). |
| **Floating assistant** | From any page, users can open a compact chat without losing context. | `FloatingAgent` FAB (bottom-right); slide-up panel with same chat; “Full page” and “New conversation” links. |
| **Progressive disclosure** | Show essentials first; details on demand. | Workflow: show phase + steps; verification details when expanded or on completion. Errors: one-line summary + optional details. |
| **Grounding over guessing** | Prefer tool-backed data and clear “I don’t have that” over fabricated answers. | System prompt + anti-hallucination contract; pre-flight validation before workflows so failures are explicit (e.g. “Run migrations”). |

---

## 2. Agent & Workflow UX Checklist

- **Empty states**
  - Chat: Welcoming first message + 2–4 suggested prompts (e.g. “What is WACC?”, “List my deals”) so users don’t face a blank input only.
  - Workflows: When API is down, show a single clear line: “Start the API (port 3001) and refresh,” not a generic error.
- **Loading states**
  - Use skeletons or subtle animation (e.g. `shimmer`) for lists (workflows, steps); avoid bare “Loading…” when a layout is known.
  - Assistant: “Grand is thinking…” (or named equivalent) with a single loading bubble, not a spinner in the corner.
- **Errors**
  - One primary line (what went wrong) + optional hint (what to do). Use `border-amber`/`bg-amber-50` for recoverable, `border-red`/`bg-red-500/10` for hard failures.
  - Network/connection: “Cannot reach the API. Start the server (…). Then refresh.”
- **Structure**
  - Reply content: Markdown-style structure (##, ###, bullets) rendered as real headings and lists; formulas in plain text or code-style blocks.
  - Workflow steps: Human-readable step label (from plan `description`), icon, status badge, duration in a tile.
- **Accessibility**
  - Focus visible on all interactive elements (`focus:ring-2 ring-brand-400`).
  - FAB and panel: `aria-label` and `role="dialog"`; overlay closes on Escape and click-outside.
  - Form labels associated with inputs; buttons have clear labels.

---

## 3. Visual & Motion

- **Cards**: Use `elevated-card` for main panels; consistent `rounded-xl` or `rounded-2xl` and `border-surface-200`.
- **Spacing**: Section gaps `space-y-6` or `gap-6`; internal card padding `p-4` or `p-6`; avoid cramped controls.
- **Motion**: Prefer subtle `animate-fade-in` / `animate-slide-up` for panels and tiles; avoid distracting animation. Loading can use `shimmer` or a soft pulse.
- **Color**: Brand (teal) for primary actions and key accents; surface palette for text and borders; amber for warnings, red for errors.

---

## 4. Portal-Wide Application (Entire Portal)

Apply the same principles across **all** portal pages: Nav (SVG icons, not emoji), Deals list (`elevated-card`, shimmer, empty state), Deal detail (tab SVG icons, section-title), Portfolio (surface/brand tokens, elevated-card, skeleton loading), Login (already aligned). Use **SVG icons** from `PortalIcons` over emoji; `elevated-card` and `section-title` everywhere; skeletons for loading; one-line errors + hint.

---

## 5. Reference Locations in Codebase

| Area | Path | Notes |
|------|------|--------|
| Agent name | `packages/ui/src/lib/agent-constants.ts` | Single constant for the assistant name. |
| Reply tiles | `packages/ui/src/components/agent/AgentReplyTiles.tsx` | Block split + headings, lists, bold, code. |
| Workflow progress | `packages/ui/src/components/agent/WorkflowProgress.tsx` | Phase, steps (tile per step), verification, errors. |
| Floating agent | `packages/ui/src/components/agent/FloatingAgent.tsx` | FAB, slide-up panel, Grand title, Full page / New conversation. |
| Chat panel | `packages/ui/src/components/agent/AgentChatPanel.tsx` | Message list, empty state, input, optional assistant name in loading. |
| Agent page | `packages/ui/src/app/agent/AgentPageContent.tsx` | Workflows + Grand panels; API error banner; validation. |
| Globals / theme | `packages/ui/src/app/globals.css`, `tailwind.config.js` | Tokens, elevated-card, btn-primary, focus ring. |

---

## 6. Backend Alignment (for context)

HMS Aurora–style backend behaviour that the UI assumes:

- **Plan → execute → verify**: Workflows return `status`, `verification`, `_debug.stepResults` with `description` per step.
- **Pre-flight**: `POST /agent/workflows/validate` before execute; UI shows validation errors and hints (e.g. run migrations).
- **Tool result shape**: `content[]` with `text`/`data`; errors with clear message so the UI can show “Grand” replies or error tiles without guessing.

---

When in doubt, prefer **clarity and scannability** over density, and **named, grounded assistant behaviour** over generic “AI” copy. Use this reference together with the Cursor rule (`.cursor/rules/hms-aurora-ui.mdc`) for all Agent and agentic UI work, **and for the entire portal** (Deals, Portfolio, Login, Nav).
