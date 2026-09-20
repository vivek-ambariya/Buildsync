# BuildSync AI

**Turn construction data into better decisions.**

A construction data management platform: projects, tasks, materials, budgets,
documents and site reports in one place, with an intelligence layer that reads
them together and says what needs attention.

Built for the B.Tech Hackathon 2026 — Smart Construction Data Management.
**Local development only.** Nothing here is configured for deployment.

---

## What it does

| Area | What it gives you |
| --- | --- |
| **Dashboard** | Portfolio KPIs, planned-against-actual progress curve, project health, ranked risk findings, live activity |
| **Projects** | Card and table views, filters, schedule variance and cost performance per project |
| **Project detail** | Overview, tasks, a phase timeline, materials, expenses, documents, site reports and per-project findings |
| **Documents** | Upload a BOQ or invoice and its quantities, rates, vendors and totals are extracted into structured rows |
| **Site updates** | Daily reports that feed the progress curve and draw down material stock |
| **Ask BuildSync** | A copilot that answers from your own records and shows the numbers it used |
| **AI insights** | Schedule, budget and material risk, each finding ranked by impact |
| **Reports** | Five report types generated from live data, printable and exportable |

### How the intelligence works

Every figure the interface shows is computed in one place (`backend/app/ai/engine.py`),
so the dashboard, the findings and the copilot can never disagree with each other.

- **Schedule risk** — planned progress from the contract programme against actual
  progress from tasks, with the completion date extrapolated from the recent rate
  of build. A scikit-learn regression over the last twelve site reports supplies
  that rate when there is enough history; below three reports it falls back to the
  project average and says so through a lower confidence score.
- **Budget risk** — earned value against committed spend. A cost performance index
  below 1 means each rupee is buying less progress than planned, and the forecast
  at completion follows from it.
- **Material risk** — consumption rate against stock on site, judged against
  **supplier lead time** rather than a fixed number of days. A material with a
  three-week lead time needs far more cover than one that arrives tomorrow.

Findings carry an `impact` score so a sixteen-point schedule slip outranks two
overdue tasks, rather than ordering by whichever was raised first.

---

## Stack

- **Frontend** — React 18, Vite, Tailwind CSS, Recharts, GSAP + ScrollTrigger, Lenis, Lucide
- **Backend** — Python 3.11+, FastAPI, Motor (async MongoDB)
- **Database** — MongoDB
- **Data/AI** — pandas, NumPy, scikit-learn, with a pluggable hosted-LLM layer

---

## Running it locally

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- MongoDB running on `localhost:27017`

```bash
# macOS
brew services start mongodb-community
```

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # then set JWT_SECRET to something random
python -c "import secrets; print(secrets.token_urlsafe(48))"

python -m app.seed.seed            # load the demo portfolio
uvicorn app.main:app --reload --port 8000
```

The API runs on <http://127.0.0.1:8000>, with interactive docs at `/docs`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to the backend, so the browser
only ever talks to one origin.

### Or, both at once

```bash
./dev.sh          # starts the API and the frontend, and stops both on Ctrl-C
```

---

## Signing in

The seed loads eight projects and eight people. Every demo account uses the
password **`buildsync`**.

| Email | Role | What they see |
| --- | --- | --- |
| `vivek@buildsync.ai` | Admin | Everything, including creating projects and changing roles |
| `meera.shah@buildsync.ai` | Project manager | Projects, tasks, budgets, documents, reports |
| `anil.kumar@buildsync.ai` | Site engineer | Site reports, tasks, materials, uploads |
| `suresh@yadavconstructions.in` | Contractor | Only their assigned projects and their own tasks |

Sign in as the contractor to see the role-aware interface: the portfolio shrinks
to three projects, the task list to their own work, and write actions disappear.

---

## The AI layer

Out of the box BuildSync runs a **deterministic local engine** — no API key, no
network call, and every number traceable to a record in the database.

To route the copilot's prose through a hosted model instead, set these in
`backend/.env`:

```ini
LLM_PROVIDER=anthropic     # or: openai
LLM_API_KEY=sk-...
LLM_MODEL=claude-sonnet-5
```

The model writes the prose; the figures still come from the engine, and the
context it is given is built from the database. If the call fails, the grounded
local answer is used instead, so a model outage never costs you an answer.
Adding another vendor means one subclass in `backend/app/ai/llm_provider.py`.

---

## Layout

```
backend/
  app/
    main.py               wiring only: lifespan, CORS, error shape, routers
    core/                 settings, password hashing, JWT, dependencies
    db/                   Mongo client, collection names, indexes
    models/               domain enums and Mongo serialisation
    schemas/              request and response contracts
    routes/               one router per resource
    services/             project, analytics, insight, report, activity
    ai/                   engine, assistant, document pipeline, LLM provider
    utils/                dates and number formatting
    seed/                 the demo portfolio

frontend/
  src/
    animations/           the motion system: durations, easings, GSAP hooks
    charts/               chart components and their shared theming
    components/           reusable UI, built on ui/ primitives
    features/             screen-sized feature modules
    layouts/              app shell, sidebar, topbar, page header
    lib/                  API client, auth, theme, toast, formatting
    pages/                one file per route
```

### Collections

`users`, `projects`, `tasks`, `milestones`, `materials`, `expenses`,
`documents`, `site_updates`, `notifications`, `reports`, `ai_insights`,
`activities`, `conversations`.

Related records are joined by `ObjectId` reference, and indexes are applied on
startup from `backend/app/db/indexes.py`.

---

## Notes

- **Reseeding** wipes and reloads the database: `python -m app.seed.seed`.
  Use `--keep` to seed only when it is empty.
- **Uploads** are written to `backend/storage/` and are gitignored.
- **Secrets** live in `.env` and are never committed. `.env.example` documents
  every variable.
- **Timestamps** are stored and served in UTC with an explicit offset; the
  interface renders them in the viewer's local time.
