# BuildSync AI

**Turn construction data into better decisions.**

A construction data management platform: projects, tasks, materials, budgets,
documents and site reports in one place, with an intelligence layer that reads
them together and says what needs attention.

Built for the B.Tech Hackathon 2026 — Smart Construction Data Management.
**Local development only.** Nothing here is configured for deployment.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.6-F7931E?logo=scikitlearn&logoColor=white)

---

## Four workspaces, one platform

A construction company is not one audience. The director wants the portfolio,
the project manager wants their sites, and the person at the gate wants today's
work on a phone. Each role signs in to its own workspace, at its own address,
with its own shell.

| Workspace | Address | Built for |
| --- | --- | --- |
| **Admin** | `/admin` | The whole platform: every project, user, role and system log |
| **Project Manager** | `/project-manager` | The portfolio they run — schedule, spend, documents, reports |
| **Site Manager** | `/site-manager` | The day on the ground: progress, headcount, stock, issues, the daily report |
| **Contractor** | `/contractor` | Their assigned work and what they record against it |

The admin and project-manager workspaces share a desktop shell built for
analysis. The site-manager and contractor workspaces share a field shell built
for a phone at a gate — larger targets, a bottom navigation bar, and no
portfolio charts to download over a site connection.

---

## What it does

### Portfolio — admin and project manager

| Area | What it gives you |
| --- | --- |
| **Dashboard** | Portfolio KPIs, planned-against-actual progress curve, project health, ranked risk findings, live activity |
| **Projects** | Card and table views, filters, schedule variance and cost performance per project |
| **Project detail** | Overview, tasks, a phase timeline, materials, expenses, documents, site reports and per-project findings |
| **Documents** | Upload a BOQ or invoice and its quantities, rates, vendors and totals are extracted into structured rows |
| **Site reports** | The daily record from every site, feeding the progress curve and drawing down material stock |
| **Ask BuildSync** | A copilot that answers from your own records and shows the numbers it used |
| **AI insights** | Schedule, budget and material risk, each finding ranked by impact |
| **Reports** | Five report types generated from live data, printable and exportable |

### Field — site manager and contractor

| Area | What it gives you |
| --- | --- |
| **Today** | The morning screen in one request: tasks due, headcount, stock cover, open issues |
| **My tasks** | Their own work and the crew's, with progress recorded against it |
| **Progress updates** | What was built today, which rolls up into the project's completion figure |
| **Site photos** | Evidence against a phase, categorised and timestamped |
| **Materials** | Consumption recorded on site, and requests raised when stock runs short |
| **Issues** | What went wrong, escalated to whoever runs that site |
| **Daily reports** | The end-of-day record — site manager only |

Money never reaches the field surface. Every read for these workspaces is
stripped of budget, spend and unit cost before it leaves the server: a site
manager records what was built and consumed, and what it cost is not their
screen.

---

## Who can see what

Two separate questions decide every request, and the code keeps them apart:

- **Which actions a role may perform** — the permission matrix in
  `backend/app/core/permissions.py`, enforced by the route guards.
- **Which rows a person may touch** — `project_service.visibility_filter`,
  which narrows every query to the projects they are attached to.

Only the admin holds `projects.view_all`. **Everyone else — project managers
included — sees only the projects they manage or are on the team of.** A
manager who has not been given a site cannot read its budget, its drawings or
its daily reports, and naming another project's id in a request returns
nothing rather than someone else's rows.

The workspace guards in the interface are UX, not security: every endpoint
authorises the request again from the role stored on the account, so landing
on the wrong URL earns a page of refusals rather than data.

---

## How the intelligence works

Every figure the interface shows is computed in one place
(`backend/app/ai/engine.py`), so the dashboard, the findings and the copilot
can never disagree with each other.

- **Schedule risk** — planned progress from the contract programme against
  actual progress from tasks, with the completion date extrapolated from the
  recent rate of build. A regression over the last twelve site reports supplies
  that rate when there is enough history; below three reports it falls back to
  the project average and says so through a lower confidence score.
- **Budget risk** — earned value against committed spend. A cost performance
  index below 1 means each rupee is buying less progress than planned, and the
  forecast at completion follows from it.
- **Material risk** — consumption rate against stock on site, judged against
  **supplier lead time** rather than a fixed number of days. A material with a
  three-week lead time needs far more cover than one that arrives tomorrow.

Findings carry an `impact` score so a sixteen-point schedule slip outranks two
overdue tasks, rather than ordering by whichever was raised first.

---

## The delay-risk model

`ml/` holds a trained classifier that estimates the probability a project
finishes late, and the work behind it: dataset generation, a validation gate,
model selection and explainability. `ml/REPORT.md` documents all of it.

| | |
| --- | --- |
| **Dataset** | 10,000 rows, 10 features, 30.4% delay rate — no missing values, no duplicate feature vectors |
| **Selection** | Logistic regression, random forest and XGBoost compared under 5-fold cross-validation |
| **Selected** | Calibrated logistic regression — the simplest model, and the strongest here |
| **Test ROC-AUC** | 0.890 |
| **Tuned threshold** | 0.35 → F1 0.721, recall 0.778, precision 0.671 |
| **Context** | 0.697 majority-class baseline, ~0.835 achievable ceiling for this generator |
| **Explainability** | SHAP global, beeswarm, dependence and local plots in `ml/reports/` |

`backend/app/ai/delay_model.py` is the only thing that loads the saved bundle.
Two rules hold there: if the bundle is missing the API reports that no
prediction is available rather than inventing one, and a project whose records
do not carry a feature stops the prediction rather than having a value guessed
into place.

Reproduce the whole pipeline:

```bash
backend/.venv/bin/python ml/generate_dataset.py
backend/.venv/bin/python ml/validate_dataset.py
backend/.venv/bin/python ml/train_model.py
```

---

## Stack

- **Frontend** — React 18, Vite, Tailwind CSS, Recharts, GSAP + ScrollTrigger, Lenis, Lucide
- **Backend** — Python 3.11+, FastAPI, Motor (async MongoDB), PyJWT, bcrypt
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

| Email | Workspace | What they see |
| --- | --- | --- |
| `vivek@buildsync.ai` | Admin | Every project and user, roles, activity logs, system settings |
| `meera.shah@buildsync.ai` | Project Manager | The four projects she runs |
| `rajesh.patel@buildsync.ai` | Project Manager | The four projects he runs — a different four |
| `anil.kumar@buildsync.ai` | Site Manager | The four sites he is on: progress, materials, issues, daily reports |
| `suresh@yadavconstructions.in` | Contractor | Three sites, his own tasks, and no budgets anywhere |

Sign in as the two project managers one after the other to see the access model
working: the same portfolio screens, no project in common, and neither able to
reach the other's sites by editing a URL.

New accounts can also be created from the sign-up form, which offers the
project-manager, site-manager and contractor workspaces. Admin is not among
them — no amount of posting to the registration route produces an
administrator.

---

## The AI layer

Out of the box BuildSync runs a **deterministic local engine** — no API key, no
network call, and every number traceable to a record in the database.

To route the copilot's prose through a hosted model instead, set these in
`backend/.env`:

```ini
LLM_PROVIDER=anthropic     # or: openai, gemini
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
    core/                 settings, permissions, workspaces, JWT, dependencies
    db/                   Mongo client, collection names, indexes
    models/               domain enums and Mongo serialisation
    schemas/              request and response contracts
    routes/               one router per resource, plus per-workspace entry points
    services/             project, site, analytics, insight, report, activity
    ai/                   engine, assistant, delay model, document pipeline, LLM provider
    utils/                dates and number formatting
    seed/                 the demo portfolio

frontend/
  src/
    animations/           the motion system: durations, easings, GSAP hooks
    charts/               chart components and their shared theming
    components/           reusable UI, built on ui/ primitives
    features/             screen-sized feature modules
    layouts/              the three shells: portfolio, field, admin
    lib/                  API client, auth, workspaces, theme, toast, formatting
    pages/                one file per route

ml/                       dataset, training, evaluation and SHAP explainability
```

### Collections

`users`, `projects`, `tasks`, `milestones`, `materials`, `expenses`,
`documents`, `site_updates`, `site_photos`, `site_issues`,
`material_requests`, `workforce_logs`, `progress_updates`, `notifications`,
`reports`, `ai_insights`, `activities`, `conversations`.

The daily report a site manager files is stored as a `site_updates` record —
it is the same fact the portfolio reads as a site report, entered from the
other end.

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
- **`BuildSync-Project-Report.pdf`** in the repository root is the written
  project report submitted alongside the code.
