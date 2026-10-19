# CRM

A CRM for freelancers and small agencies: a FastAPI backend and a React frontend.

**Backend** (this directory)

- **Phase 1** — authentication, Companies, Contacts.
- **Phase 2** — Deals / pipeline.
- **Phase 3** — Activities & Tasks.
- **Phase 4** — Dashboard (read-only aggregation; no new tables).

**Frontend** ([`frontend/`](frontend/) — see [frontend/README.md](frontend/README.md))

- **Phase 1** — setup, auth, app shell, dashboard.
- **Phase 2** — Pipeline (kanban), deal detail, contacts.
- **Phase 3** — Tasks, inline task actions, Radix dialogs.

## Running both

They run as two processes, in two terminals.

```bash
# Terminal 1 -- API on :8000
.\.venv\Scripts\Activate.ps1        # macOS/Linux: source .venv/bin/activate
uvicorn app.main:app --reload
```

```bash
# Terminal 2 -- UI on :5173
cd frontend
npm install                          # first run only
npm run dev
```

Open <http://localhost:5173>. The backend allows the Vite dev origin via `CORS_ORIGINS`
in `.env`; change it there if you move the frontend off port 5173.

Built with FastAPI, SQLAlchemy 2.0, Alembic, and Pydantic v2. SQLite for local dev;
switching to PostgreSQL is a one-line change in `.env`.

---

## Setup

### 1. Virtual environment

```bash
python -m venv .venv
```

```bash
# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure the environment

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Then edit `.env` and set a real `SECRET_KEY`. Generate one with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./crm.db` | Any SQLAlchemy URL |
| `SECRET_KEY` | *(insecure dev default)* | **Must** be changed outside local dev |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | |
| `PROJECT_NAME` | `CRM API` | Title shown in `/docs` |

### 4. Create the database schema

```bash
alembic upgrade head
```

### 5. Run the server

```bash
uvicorn app.main:app --reload
```

- API: <http://127.0.0.1:8000>
- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>

---

## Switching to PostgreSQL

Nothing in the application code is SQLite-specific. Install a driver and repoint the URL:

```bash
pip install "psycopg[binary]"
```

```dotenv
DATABASE_URL=postgresql+psycopg://crm:crm@localhost:5432/crm
```

Then `alembic upgrade head` against the new database. `app/database.py` picks engine
options per backend (`check_same_thread` for SQLite, `pool_pre_ping` otherwise), and
`alembic/env.py` enables batch mode only on SQLite.

---

## Endpoints

### Auth

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account. `201`, or `400` on duplicate email. |
| `POST` | `/auth/login` | OAuth2 password form (`username` = email). Returns a JWT. |
| `GET` | `/auth/me` | Current user, from the bearer token. |

### Companies — all require `Authorization: Bearer <token>`

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/companies` | Create → `201` |
| `GET` | `/companies` | List own companies. `?search=` (name), `?skip=`, `?limit=` |
| `GET` | `/companies/{id}` | Get one → `404` if missing or not yours |
| `PUT` | `/companies/{id}` | Update (only the fields you send) |
| `DELETE` | `/companies/{id}` | Delete → `204` |

### Contacts — all require auth

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/contacts` | Create → `201` |
| `GET` | `/contacts` | List own contacts. `?search=` (name or email), `?company_id=`, `?skip=`, `?limit=` |
| `GET` | `/contacts/{id}` | Get one → `404` if missing or not yours |
| `PUT` | `/contacts/{id}` | Update (only the fields you send) |
| `DELETE` | `/contacts/{id}` | Delete → `204` |

Contact responses embed the linked company as a nested object, not just an id:

```json
{
  "id": 1,
  "name": "Jane Rivera",
  "email": "jane@acme.example",
  "phone": "+1-555-0100",
  "company_id": 1,
  "owner_id": 1,
  "notes": "Met at the design conference.",
  "created_at": "2026-08-11T10:12:00Z",
  "updated_at": "2026-08-11T10:12:00Z",
  "company": { "id": 1, "name": "Acme Studios" }
}
```

`company` is `null` when the contact has no company.

### Deals — all require auth

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/deals` | Create → `201`. `contact_id` required. |
| `GET` | `/deals` | List own deals. `?stage=`, `?contact_id=`, `?company_id=`, `?skip=`, `?limit=` |
| `GET` | `/deals/pipeline-summary` | Count and total value per stage |
| `GET` | `/deals/{id}` | Get one → `404` if missing or not yours |
| `PUT` | `/deals/{id}` | Update details. **Cannot change stage.** Works on closed deals. |
| `PATCH` | `/deals/{id}/stage` | Move to another stage — the only way stage changes |
| `POST` | `/deals/{id}/reopen` | Pull a won/lost deal back to `negotiation` |
| `DELETE` | `/deals/{id}` | Delete → `204` |

#### Stages

`lead` → `contacted` → `proposal_sent` → `negotiation` → `won` / `lost`

There is no enforced order between the four open stages — you can jump freely between
them. `won` and `lost` are **terminal**:

- `PATCH /deals/{id}/stage` on a deal that is already won or lost returns `400`, pointing
  at the reopen endpoint. Getting out of a terminal stage requires `reopen`.
- Moving to `won` stamps `won_at`; moving to `lost` stamps `lost_at`.
- `POST /deals/{id}/reopen` only works on a closed deal (`400` otherwise). It resets the
  stage to `negotiation` and clears both timestamps.
- `PUT /deals/{id}` never touches the stage. It rejects a `stage` key in the body with a
  `422` rather than ignoring it, and it works on closed deals so you can still correct a
  won deal's value or title.

#### Company inheritance

`POST /deals` with `company_id` **omitted** inherits the contact's company. Passing
`"company_id": null` explicitly means "no company" and is respected as written.

#### Money

`value` is a `Decimal(14,2)` and serialises as a JSON **string** (`"5000.00"`), not a
float, so cents stay exact. `total_value` in the pipeline summary behaves the same way.

```json
{
  "id": 1,
  "title": "Globex retainer",
  "value": "5000.00",
  "stage": "negotiation",
  "probability": 40,
  "expected_close_date": "2026-10-01",
  "contact_id": 5,
  "company_id": 1,
  "owner_id": 1,
  "won_at": null,
  "lost_at": null,
  "created_at": "2026-08-11T09:09:08",
  "updated_at": "2026-08-11T09:09:08",
  "contact": { "id": 5, "name": "Hank Scorpio" },
  "company": { "id": 1, "name": "Globex Ltd" }
}
```

`GET /deals/pipeline-summary` reports **every** stage, including empty ones, in pipeline
order, so a board UI needs no backfilling:

```json
[
  { "stage": "lead",          "count": 1, "total_value": "0.00" },
  { "stage": "contacted",     "count": 0, "total_value": "0.00" },
  { "stage": "proposal_sent", "count": 0, "total_value": "0.00" },
  { "stage": "negotiation",   "count": 1, "total_value": "7500.00" },
  { "stage": "won",           "count": 0, "total_value": "0.00" },
  { "stage": "lost",          "count": 1, "total_value": "1200.50" }
]
```

The counts and sums come from a single `GROUP BY` query; only the zero-fill for empty
stages happens in Python.

### Activities — all require auth

An activity is an **append-only** log entry: something that happened. There is no `PUT`
or `PATCH` — correcting one means deleting it and logging again (`PUT` returns `405`).

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/activities` | Create → `201`. `contact_id` required. |
| `GET` | `/activities` | List own activities, **newest first**. `?contact_id=`, `?deal_id=`, `?type=`, `?skip=`, `?limit=` |
| `GET` | `/activities/{id}` | Get one → `404` if missing or not yours |
| `DELETE` | `/activities/{id}` | Hard delete → `204` |

`type` is one of `call`, `email`, `meeting`, `note`.

`occurred_at` defaults to now but can be backdated — logging yesterday's phone call is the
normal case. Listing sorts on `occurred_at` descending (with `id` breaking ties), so a
backdated entry lands in its rightful place rather than at the top.

If `deal_id` is given it must be **your** deal (`404` otherwise) **and** must belong to the
same contact (`400` otherwise — the deal exists and is yours, the request is just
contradictory).

### Tasks — all require auth

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/tasks` | Create → `201`. All links optional. |
| `GET` | `/tasks` | List own tasks. `?status=`, `?contact_id=`, `?deal_id=`, `?due_before=`, `?skip=`, `?limit=` |
| `GET` | `/tasks/overdue` | Pending tasks past their due date, most overdue first |
| `GET` | `/tasks/{id}` | Get one → `404` if missing or not yours |
| `PUT` | `/tasks/{id}` | Update details. **Cannot change status.** |
| `PATCH` | `/tasks/{id}/complete` | → `completed`, stamps `completed_at`. `400` if already closed. |
| `PATCH` | `/tasks/{id}/cancel` | → `cancelled`. `400` if already closed. |
| `DELETE` | `/tasks/{id}` | Hard delete → `204` |

`status` is one of `pending` (default), `completed`, `cancelled`. `completed` and
`cancelled` are **closed** states — a task cannot leave one, so `complete` and `cancel`
both return `400` on an already-closed task. As with deals, `PUT` rejects a `status` key
with a `422` rather than ignoring it.

`?due_before=` accepts a bare ISO date or a full datetime and matches tasks due **strictly
before** it. Tasks with no due date never match it, and never appear in `/tasks/overdue`.

### Automatic activity logging

`PATCH /deals/{id}/stage` writes an activity alongside the stage change:

```json
{ "type": "note", "content": "Deal moved from lead to proposal_sent" }
```

linked to the deal and to the deal's contact. Both rows commit in a **single
transaction** — if the activity insert fails, the stage change rolls back with it, so a
deal never moves without a trace. `POST /deals/{id}/reopen` does **not** auto-log.

### Dashboard — all require auth

Read-only aggregation over everything above. No new tables.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/dashboard/summary` | Every section below, in one request |
| `GET` | `/dashboard/activity-feed` | Paginated activity feed. `?skip=`, `?limit=` (default 20, max 100) |
| `GET` | `/dashboard/deals-closing-soon` | `?days=` (default 7, min 1, max 90), `?limit=` |

`GET /dashboard/summary` returns five sections:

| Section | Contents |
| --- | --- |
| `pipeline` | Per-stage count and total value, zero-filled to all 6 stages — the same query that backs `/deals/pipeline-summary` |
| `tasks` | `{ overdue_count, due_this_week_count }` for pending tasks |
| `recent_activity` | Last 10 hand-logged activities, newest first, with nested contact |
| `totals` | `{ contacts, companies, open_deals, open_pipeline_value }` — `open_*` excludes won and lost |
| `deals_closing_soon` | Up to 20 open deals closing within 7 days, soonest first, with nested contact |

`overdue` is `due_date < now`; `due_this_week` is `now ≤ due_date ≤ now + 7 days`. The two
windows are disjoint, so a task is never counted twice.

A brand-new account gets the same shape back with zeroes and empty lists — never an error
and never a missing key, so a frontend can render it without special-casing the empty state.

#### Auto-logged activities are excluded

`recent_activity` and `/dashboard/activity-feed` leave out the notes written by the deal
stage-change hook, so the feed shows what a person actually did. The filter lives in
[app/activity_filters.py](app/activity_filters.py) and matches on `type == "note"` **and**
content starting with `"Deal moved from "`.

> **This is a string-matching coupling, not a schema one.** There is no column marking a
> row as machine-generated; the content prefix is the only marker. `routers/deals.py` and
> `activity_filters.py` share the `AUTO_LOG_CONTENT_PREFIX` constant so they cannot drift
> apart in new code — but rows already written keep their old wording, so changing the
> message means backfilling them too. The durable fix is a real column; see the note at the
> top of `activity_filters.py`.

A hand-written note is unaffected unless its content happens to begin with that exact
prefix.

#### Query cost

Each section is a database-level `COUNT`/`SUM`/`GROUP BY`, and nested contacts and
companies are fetched with `selectinload`. `/dashboard/summary` issues a **constant 11
queries** regardless of how many rows it summarises.

### Timezones

Client-supplied datetimes (`occurred_at`, `due_date`) are normalised to UTC on the way in,
so `2026-10-01T09:00+05:00` and `2026-10-01T04:00Z` are stored identically. A datetime
sent without an offset is taken to already be UTC.

Note that responses currently render timestamps **without** an offset (`2026-08-11T09:34:20`)
because SQLite has no timezone-aware column type. They are UTC. On PostgreSQL's
`timestamptz` the offset round-trips properly.

### Meta

`GET /health` → `{"status": "ok"}` (no auth).

---

## Data ownership

Every Company, Contact, Deal, Activity and Task carries an `owner_id`. All queries filter
on the authenticated user, so one user can never read or modify another's records.
Requests for someone else's row return **`404`, not `403`** — a `403` would confirm the id
exists. Linking a contact to a company you do not own, opening a deal on someone else's
contact, or logging an activity against one, is likewise rejected with `404`.

### Delete behaviour

| Deleting a… | …does this |
| --- | --- |
| Company | Its contacts, deals and tasks survive with `company_id` / `deal_id` intact; only the company link is nulled |
| Contact | **Refused with `400`** while activities or tasks reference it. Otherwise its deals cascade away with it. |
| Deal | Its activities and tasks survive with `deal_id` nulled — the history of what happened stays |
| Activity / Task | Hard delete, no restrictions |
| User | Everything they own is deleted |

The contact rule is the one deliberate asymmetry: a deal cannot exist without its contact,
so it cascades, but activities and tasks are records of work done and commitments made, so
they block the delete rather than vanish. The error names the counts:

```json
{ "detail": "Cannot delete contact: 3 activities and 1 task reference it. Delete or reassign them first." }
```

---

## Smoke test

With the server running:

```bash
python scripts/smoke_test.py
# or against another host:
python scripts/smoke_test.py --base-url http://127.0.0.1:8000
```

**Phase 1 (sections 1–14)** registers a user, rejects the duplicate, logs in, creates a
company and a linked contact, lists contacts and asserts the nested company data is
present, exercises search and filters, verifies a second user is fully walled off, and
cleans up with deletes.

**Phase 2 (sections 15–29)** creates a deal and confirms `company_id` inherits from the
contact, walks it through the open stages, closes it as won and checks `won_at`, confirms
a closed deal rejects further stage changes with a `400`, reopens it back to
`negotiation` with the timestamps cleared, then covers the lost path, validation,
filters, the pipeline summary, owner scoping and cascade-on-contact-delete.

**Phase 3 (sections 30–43)** logs activities against a contact and a deal, rejects a deal
belonging to a different contact, checks newest-first ordering with backdated entries and
that `PUT`/`PATCH` return `405`, runs tasks through `complete`/`cancel` and the overdue
view, exercises the contact-delete guard end to end, and confirms a stage change
auto-logs an activity while `reopen` does not.

**Phase 4 (sections 44–51)** registers a fresh account and confirms the dashboard returns
zeroes and empty lists rather than errors, then builds a known dataset (2 companies, 3
contacts, 4 deals across lead/negotiation/won/lost, 5 hand-logged activities, 4 tasks) and
asserts every summary section against it, checks that a stage change's auto-logged note
stays out of the feed while a hand-written note survives, and exercises pagination, the
`?days=` window, parameter validation and cross-user isolation.

Exits non-zero on the first failure.

### Equivalent by hand (curl)

```bash
curl -X POST http://127.0.0.1:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"SuperSecret123","full_name":"Me"}'

TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/login \
  -d "username=me@example.com&password=SuperSecret123" | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -X POST http://127.0.0.1:8000/companies \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Acme Studios","industry":"Design"}'

curl -X POST http://127.0.0.1:8000/contacts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Jane Rivera","email":"jane@acme.example","company_id":1}'

curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/contacts

# Open a deal on that contact (company_id inherits from the contact)
curl -X POST http://127.0.0.1:8000/deals \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Website rebuild","value":"5000.00","contact_id":1}'

curl -X PATCH http://127.0.0.1:8000/deals/1/stage \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"stage":"won"}'

curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/deals/pipeline-summary

# Log a call that happened yesterday, and add a follow-up task
curl -X POST http://127.0.0.1:8000/activities \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"call","content":"Discussed scope","occurred_at":"2026-08-10T15:00:00Z","contact_id":1,"deal_id":1}'

curl -X POST http://127.0.0.1:8000/tasks \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Send the quote","due_date":"2026-08-15","contact_id":1}'

curl -X PATCH http://127.0.0.1:8000/tasks/1/complete -H "Authorization: Bearer $TOKEN"
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/tasks/overdue

# Everything a landing page needs, in one request
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/dashboard/summary
curl -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8000/dashboard/deals-closing-soon?days=30"
```

---

## Migrations

```bash
alembic upgrade head                       # apply
alembic revision --autogenerate -m "msg"   # create after editing app/models.py
alembic downgrade -1                       # roll back one
alembic current                            # show applied revision
```

`alembic/env.py` imports `Base.metadata` from `app.models` and takes the URL from
`app.config.settings`, so `sqlalchemy.url` in `alembic.ini` is intentionally blank.
Always review autogenerated migrations before applying them.

---

## Project layout

```
.
├── app/
│   ├── main.py            # app factory, router wiring, 500 handler, /health
│   ├── config.py          # pydantic-settings, reads .env
│   ├── database.py        # engine, SessionLocal, Base, get_db
│   ├── models.py          # User, Company, Contact, Deal, Activity, Task + enums
│   ├── schemas.py         # Pydantic v2 request/response models
│   ├── auth.py            # bcrypt hashing, JWT create/decode, get_current_user
│   ├── ownership.py       # shared owner-scoped lookups for activities and tasks
│   ├── aggregates.py      # shared aggregate queries (deals + dashboard)
│   ├── activity_filters.py # auto-logged-activity filter (see coupling warning)
│   └── routers/
│       ├── auth.py
│       ├── companies.py
│       ├── contacts.py
│       ├── deals.py
│       ├── activities.py
│       ├── tasks.py
│       └── dashboard.py
├── alembic/               # migration environment + versions/
├── scripts/smoke_test.py
├── alembic.ini
├── requirements.txt
└── .env.example
```
