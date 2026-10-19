# CRM Frontend

React frontend for the CRM API.

- **Phase 1** — setup, authentication, app shell, dashboard.
- **Phase 2** — Pipeline (kanban), deal detail, contacts list and detail.
- **Phase 3** — Tasks, inline task actions on deal/contact pages, Radix dialogs.

Vite · React 18 · TypeScript · Tailwind CSS v4 · React Router v6 · TanStack Query v5 ·
axios · dnd-kit · Radix Dialog

---

## Running it

The frontend and the API both need to be running. **Two terminals**, both from the repo
root:

**Terminal 1 — backend (port 8000)**

```bash
# Windows
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

uvicorn app.main:app --reload
```

**Terminal 2 — frontend (port 5173)**

```bash
cd frontend
npm install     # first run only
npm run dev
```

Then open <http://localhost:5173>. Register an account and you'll land on the dashboard.

> The backend must be running **before** you sign in — the frontend validates the stored
> token against `GET /auth/me` on load, and every dashboard number comes from the API.

### Environment

```bash
cp .env.example .env.local   # Windows: Copy-Item .env.example .env.local
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Where the API lives |

Only needed if your backend isn't on port 8000. Vite only exposes variables prefixed
`VITE_`, and `.env.local` is git-ignored.

### CORS

The backend allows `http://localhost:5173` and `http://127.0.0.1:5173` out of the box via
`CORS_ORIGINS` in the **backend's** `.env`. If you run the frontend on a different port,
add that origin there or the browser will block every request.

---

## Regenerating the API client

Types in `src/api/schema.ts` are generated from the running backend's OpenAPI schema.
**Never edit that file by hand.**

```bash
# with the backend running on :8000
npm run generate:api
```

which runs:

```bash
openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.ts
```

Re-run it whenever a backend model or endpoint changes. `src/api/types.ts` re-exports the
generated schemas under friendly names — importing from there rather than reaching into
`components["schemas"][...]` everywhere means a backend rename breaks one file, not fifty.

`schema.ts` **is committed**, so a fresh clone type-checks without needing the API up.

---

## Layout

```
src/
├── api/
│   ├── schema.ts        # GENERATED -- do not edit
│   ├── types.ts         # friendly aliases over schema.ts
│   ├── client.ts        # axios instance, JWT + 401 interceptors, error formatting
│   └── hooks.ts         # react-query hooks, query keys, mutations
├── auth/
│   ├── storage.ts       # localStorage token access
│   ├── AuthContext.tsx  # session state, login/register/logout
│   └── ProtectedRoute.tsx
├── components/
│   ├── activities/      # ActivityList, ActivityForm (shared by deal + contact)
│   ├── tasks/           # TaskList, TaskRow, TaskFormDialog (shared by all three
│   │                    # surfaces: /tasks, contact detail, deal detail)
│   ├── layout/          # AppShell, Sidebar, TopBar
│   ├── ui/              # Button, Card, Skeleton, Badge, Field, Select, Textarea,
│   │                    # Alert, EmptyState, Modal (Radix), ConfirmDialog, Toast,
│   │                    # ComboBox/SearchableSelect, pickerHooks, StageBadge,
│   │                    # PageHeader
│   └── icons.tsx        # hand-rolled icon set
├── lib/
│   ├── cn.ts            # className joiner
│   ├── format.ts        # money, relative time, date maths, dueUrgency banding
│   ├── stages.ts        # stage colours + terminal-stage rule (single source)
│   └── useDebouncedValue.ts
├── pages/
│   ├── LoginPage.tsx  RegisterPage.tsx  AuthLayout.tsx
│   ├── DashboardPage.tsx      + dashboard/   StatCards, PipelineChart,
│   │                                         RecentActivity, ClosingSoon
│   ├── PipelinePage.tsx       + pipeline/    KanbanColumn, DealCard, NewDealDialog
│   ├── DealDetailPage.tsx     + deals/       DealEditDialog
│   ├── ContactsPage.tsx  ContactDetailPage.tsx  ContactFormPage.tsx
│   ├── TasksPage.tsx
│   └── StubPage.tsx  NotFoundPage.tsx
├── App.tsx              # routes
├── main.tsx             # providers
└── index.css            # Tailwind import + design tokens
```

## Routes

| Path | Screen |
| --- | --- |
| `/login`, `/register` | Auth |
| `/dashboard` | Dashboard |
| `/pipeline` | Kanban board |
| `/deals/:id` | Deal detail |
| `/contacts` | Contacts table |
| `/contacts/new` | Create contact |
| `/contacts/:id` | Contact detail |
| `/contacts/:id/edit` | Edit contact |
| `/tasks` | Task list. `?overdue=true` pre-applies the overdue filter |

**Forms as routes vs modals.** A form gets a URL when the thing it edits is a destination
worth linking to and reloading — that's contact create and edit. Forms launched as a quick
action from a view you want to stay on are modals: new deal (from the board), edit deal,
log activity, and delete confirmations.

---

## Pipeline board

- **One request.** `GET /deals?limit=500` loads every deal, and column headers total up
  from what's already in memory rather than calling `/deals/pipeline-summary` for numbers
  the client can add up itself. This does **not** scale indefinitely — 500 is the
  backend's cap, and past a few thousand deals this needs per-column pagination
  (`GET /deals?stage=X`) or windowing. Flagged in a comment in `api/hooks.ts`.
- **Optimistic drag.** Dropping a card moves it immediately, then `PATCH /deals/{id}/stage`
  confirms. On failure the previous board snapshot is restored and an error toast carries
  the backend's message.
- **Won and Lost cards don't drag.** The backend rejects leaving a terminal stage with a
  400, but relying on that would mean the card lifts, travels, and snaps back. Instead the
  draggable is disabled outright, the card sits on a tinted background with a "Closed"
  chip, and the cursor stays a pointer rather than a grab handle — so the restriction
  reads as deliberate. `handleDragEnd` re-checks the rule as a second guard. Both columns
  still *accept* drops, since entering a terminal stage is allowed.

## Query keys and invalidation

Keys are hierarchical (`["deals", "detail", 7]`, `["activities", "list", {...}]`) so a
broad prefix invalidates everything under it.

| After | Invalidates |
| --- | --- |
| Stage change | `deals`, `dashboard`, `activities` (the backend auto-logs the move) |
| Deal create / edit / delete | `deals`, `dashboard` |
| Log activity | `activities`, `dashboard` |
| Contact create / edit | `contacts`, `dashboard` (+ `deals` on edit, which embeds the name) |
| Contact delete | `contacts`, `deals` (they cascade), `dashboard` |
| Any task mutation | `tasks`, `dashboard` |

Task mutations invalidate the whole `tasks` tree, which is what keeps the inline actions
on the contact and deal pages in step with the main `/tasks` list and the dashboard's
overdue counter — none of those views needs to know the others exist.

Invalidating the whole `activities` tree is what makes an activity logged on the deal page
show up on the contact's timeline without either view knowing the other exists.

## Notes on specific decisions

- **Company on the contact form** is a searchable select over `GET /companies?search=`
  with an explicit `Create "<name>"` row when nothing matches. Free text that silently
  creates a company would turn a typo into a duplicate record; requiring the click keeps a
  misspelling a search miss.
- **The new-deal form has no company field.** The backend inherits the company from the
  chosen contact when `company_id` is omitted, so a second picker could only disagree with
  it. Changing the contact on the *edit* form clears the company for the same reason.
- **Contacts pagination is prev/next, not numbered.** The list endpoint returns a bare
  array with no total count, so "page 3 of 9" isn't computable. The page requests one row
  more than it shows to detect whether a next page exists.
- **Stage colour lives in `lib/stages.ts`** and is read by both the dashboard chart and
  `StageBadge`, so a stage can't be teal in one view and green in another.
## Tasks

- **Overdue uses the backend's own endpoint.** The toggle calls `GET /tasks/overdue`
  rather than filtering the general list client-side: "overdue" is defined server-side as
  pending **and** past due, and re-deriving it in the browser would drift the moment the
  two definitions disagree. While the toggle is on, the status tabs are disabled — that
  endpoint is pending-only, so the tabs would be lying.
- **Sorting is client-side.** `GET /tasks` orders by `created_at` and takes no sort
  parameter, so `sortByDueDate` reorders soonest-first with no-due-date tasks last. Fine
  at the 200-row cap; it's the reason the list can't be paginated server-side without a
  backend change.
- **The deal picker prevents the constraint violation.** A task's deal must belong to its
  contact (the backend 400s otherwise), so the picker only offers deals from the selected
  contact, is disabled until one is chosen, and clears itself when the contact changes.
  The error is made unbuildable rather than merely reported.
- **No status field on the task form.** `TaskUpdate` sets `extra="forbid"` and omits
  `status`, so a control there would 422. Status moves through Complete and Cancel.
- **Complete has no confirmation; Cancel does.** Completing is the common, low-stakes
  action and a dialog between the click and the tick would make it feel slow. Cancelling
  reads as final to a user even though it isn't destructive, so it gets a ConfirmDialog.
- **A task's deal link shows a title** resolved from the board's already-cached deal
  query, because `TaskOut` carries `deal_id` but no nested deal (unlike its nested
  contact). Rows fall back to a generic "View deal" if that query hasn't loaded. A nested
  deal on `TaskOut` would remove the need.

## Dialogs

All dialogs — new/edit deal, log activity, new/edit task, every confirmation, and the
mobile nav drawer — go through `components/ui/Modal.tsx`, which wraps
`@radix-ui/react-dialog`.

Radix supplies the parts that are genuinely hard to hand-roll and easy to get subtly
wrong: a real focus trap with sentinel guards either side of the portal, focus restore to
the trigger on close, Escape, click-outside, scroll lock, `aria-labelledby` /
`aria-describedby` wired to the Title and Description, and `hideOthers()` to drop the rest
of the page out of the accessibility tree.

The one behaviour kept from the old implementation is `onOpenAutoFocus`, which moves focus
to the first form field instead of the close button. That changes the trap's starting
point, not the trap.

> The previous hand-rolled version handled Escape, backdrop click and focus restore but
> **not** containment — Tab could walk into the page behind an open panel. The mobile nav
> drawer had the same defect while declaring `aria-modal="true"`, advertising a guarantee
> it did not keep. Both are fixed.

---

## How auth works

1. **Sign in** posts form-encoded credentials to `/auth/login` (the backend uses
   `OAuth2PasswordRequestForm`, so the email travels in the `username` field) and stores
   the returned JWT in `localStorage`.
2. **Register** posts to `/auth/register` then signs in with the same credentials, so
   there's no second login form.
3. A **request interceptor** attaches `Authorization: Bearer <token>` to every call.
4. A **response interceptor** watches for 401s. On one it clears the token and redirects
   to `/login` — except for `/auth/login` and `/auth/register`, where a 401 means "wrong
   password", not "session expired". Without that carve-out a failed sign-in would
   redirect you to the page you're already on and swallow the error message.
5. **On load**, a stored token is not trusted on sight. The app holds in a `checking`
   state and calls `GET /auth/me`; only a 200 counts as signed in. This is what makes a
   token that expired while the tab was closed fail cleanly instead of showing a broken
   shell.
6. **Sign out** clears the token *and* the react-query cache, so the next account never
   sees the previous one's data flash on screen.

Tokens live in `localStorage`, which any script on the origin can read — an accepted
trade-off at this scope. The production answer is a short-lived in-memory access token
plus an httpOnly refresh cookie, which needs backend support that doesn't exist yet.

---

## Design notes

- **Palette.** Warm-leaning neutrals (`ink-*`) carry the whole interface. A single muted
  teal (`accent-*`) appears only on primary buttons, the active nav rail, focus rings and
  open-stage pipeline bars. Status colours are deliberately desaturated so a red badge
  reads as information rather than an alarm.
- **Type.** Inter when installed, system stack otherwise — no webfont request, so there's
  no flash of unstyled text. Sizes step 11 / 12 / 13 / 14 / 20 / 24px with weight doing
  most of the hierarchy work.
- **Surfaces.** One hairline border and a near-invisible shadow. Elevation is reserved for
  things that genuinely float, like the mobile nav drawer.
- **Charts.** The pipeline breakdown is plain divs. Six horizontal bars don't justify a
  charting runtime, and real elements give accessible labels for free. Colour is
  semantic — accent for stages in play, muted green for won, grey for lost — and bars fall
  back to scaling by deal *count* when every deal is worth zero, so the chart never
  renders blank.
- **Loading.** Skeletons mirror the real layout (four stat cards, six bars, five activity
  rows) so nothing jumps when data arrives. One `aria-live` region announces "Loading"
  once instead of every placeholder shouting.
- **Empty states.** A brand-new account gets a genuine welcome panel with next steps.
  Individual sections have their own empty states for the in-between case — contacts but
  no deals, say.

### Timestamps

The API serves UTC timestamps without an offset (a SQLite limitation). `new Date()` reads
an offset-less ISO string as *local* time, which would skew every "2 hours ago" by the
viewer's UTC offset. `parseApiDate()` in `src/lib/format.ts` appends `Z` when no zone is
present. Strings that do carry an offset — as PostgreSQL will serve — pass through
untouched, so this needs no change when the backend moves.

Money arrives as a decimal *string* (`"3000.00"`) so cents survive JSON. USD formatting is
a frontend display assumption; the API doesn't record a currency.

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the built output |
| `npm run typecheck` | Types only, no build |
| `npm run generate:api` | Regenerate `src/api/schema.ts` (backend must be running) |
