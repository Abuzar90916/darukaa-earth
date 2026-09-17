# DARUKAA.EARTH

**Understand the Earth. Measure Change. Protect What Matters.**

A full-stack geospatial analytics platform for carbon and biodiversity projects:
authenticated workspaces, PostGIS-backed site boundaries, Mapbox polygon drawing,
satellite imagery and time-series analytics — in a cinematic space/glass interface.

---

## Architecture

```
React + TypeScript (TanStack Start)
        │  Authorization: Bearer <JWT>
        ▼
FastAPI (backend/, Python 3.11)
        │  SQLAlchemy + psycopg
        ▼
PostgreSQL 15 + PostGIS  (geometry(Polygon, 4326))
```

| Layer      | Technology                                                            |
| ---------- | --------------------------------------------------------------------- |
| Frontend   | TanStack Start (React 19, SSR), TypeScript, Tailwind CSS v4           |
| Charts     | Chart.js + react-chartjs-2                                            |
| Maps       | Mapbox GL JS + mapbox-gl-draw, Turf.js for on-map area readout        |
| API        | FastAPI + Pydantic + SQLAlchemy (`backend/`), OpenAPI at `/docs`      |
| Database   | PostgreSQL 15 + PostGIS (managed), row-level security                 |
| Auth       | Email/password + Google OAuth, JWT verified by FastAPI                |
| Migrations | Drizzle Kit custom SQL migrations (`drizzle/migrations`)              |
| Quality    | ESLint, Prettier, TypeScript, Vitest, Playwright, Ruff, pytest, Husky |

### Request flow

Drawing and saving a boundary:

```
Mapbox Draw polygon → GeoJSON
  → src/services/api.ts (createSite)
  → POST /api/projects/{project_id}/sites   (FastAPI, bearer JWT)
  → Pydantic + services/geometry.py validation
  → ST_GeomFromGeoJSON → ST_MakeValid → ST_SetSRID(…, 4326)
  → triggers derive centroid + hectare area
  → JSON response → React Query cache → map re-renders
```

Analytics follow the same path: `GET /api/sites/{site_id}/analytics` returns the
historical series that Chart.js renders.

**Two transports, one contract.** `src/services/api.ts` calls FastAPI whenever
`VITE_API_BASE_URL` is set. When it is not set (a frontend-only checkout, or the
in-editor preview where no Python process runs) the same functions fall back to
the direct Data API path against the same database and the same PostGIS
functions, under row-level security. Response shapes are identical, so nothing
in the UI, map or charts changes between the two.

### Data model

- `profiles` — one row per account, created by an `auth.users` trigger.
- `user_roles` — roles in a separate table, read through the `has_role()` security-definer function.
- `projects` — name, description, type (`carbon` / `biodiversity` / both), status, country, region, rolled-up area.
- `sites` — `geometry(Polygon, 4326)` boundary plus derived `centroid` and `area_hectares`
  (BEFORE trigger runs `ST_MakeValid`, `ST_Centroid` and geodesic `ST_Area`), GiST-indexed.
- `site_metrics` — timestamped CO₂ sequestration, biodiversity index, forest cover,
  species count, water quality and project health per site.

One project has many sites; one site has many `site_metrics` rows. Every table
has RLS enabled with owner-scoped policies and explicit `GRANT`s, and FastAPI
additionally scopes every SQL statement by the JWT's `sub`.

### PostGIS

Boundaries are never stored as JSON or in the browser. `sites.geom` is a real
`geometry(Polygon, 4326)` column with a GiST index; centroids and spheroidal
hectare areas are computed in the database (`ST_Centroid`,
`ST_Area(::geography)`) by the `sites_derive_spatial` trigger, and project
totals by `sync_project_area`.

### API endpoints

Auth `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` ·
Projects `GET|POST /api/projects`, `GET|PUT|DELETE /api/projects/{id}` ·
Sites `GET|POST /api/projects/{id}/sites`, `GET /api/sites`,
`GET|PUT|DELETE /api/sites/{id}` ·
Analytics `GET /api/sites/{id}/analytics`, `GET /api/sites/{id}/metrics`,
`GET /api/metrics` · Health `GET /health`, `GET /health/db`.

Full reference and status-code contract: [`backend/README.md`](backend/README.md),
plus live Swagger UI at `/docs` and ReDoc at `/redoc`.

### Geospatial API (database functions)

| Function                                                      | Purpose                                       |
| ------------------------------------------------------------- | --------------------------------------------- |
| `create_site(project_id, name, description, status, geojson)` | Validates and stores a single polygon in 4326 |
| `update_site(site_id, name, description, status, geojson)`    | Partial update, re-validates geometry         |
| `seed_demo_data()`                                            | Populates the demonstration portfolio         |
| `has_role(user_id, role)`                                     | Role check used by RLS policies               |

Client access lives in `src/services/api.ts`; TanStack Query options in `src/services/queries.ts`.

### Data sources

- **Site measurements** — stored in `site_metrics`; the demo portfolio ships 24 monthly
  observations per site so every chart has history from first sign-in.
- **Satellite imagery** — Mapbox Satellite raster tiles, toggled on any map view.
- **Global CO₂ reference** — NOAA Global Monitoring Laboratory globally averaged
  monthly mean CO₂ series, fetched server-side in `src/lib/earth-data.functions.ts`.

To stream your own MRV/remote-sensing feeds, insert into `site_metrics`
(`site_id`, `recorded_at`, metric columns) — the analytics views pick them up automatically.

---

## Demo account

There is no shared pre-made login. The demonstration portfolio (5 projects, 10 sites,
240 measurements) seeds itself for whichever account signs in first, so create an account
on the login page (any email + a 6+ character password) and the workspace fills itself on
first load of the dashboard.

**Google sign-in** is also live: the login page has a "Continue with Google" button
(`onGoogleSignIn` in `src/features/auth/AuthScreen.tsx`) that uses the managed Google OAuth
client, so no client ID or secret is needed. A Google account signing in for the first time
gets its own seeded workspace.

---

## Testing

| Command                  | What it runs                                             |
| ------------------------ | -------------------------------------------------------- |
| `bun run test`           | Vitest + React Testing Library unit/component tests      |
| `bun run test:coverage`  | The same suite with a V8 coverage report                 |
| `bun run test:e2e`       | Playwright end-to-end tests (desktop + mobile viewports) |
| `pytest` (in `backend/`) | FastAPI tests: health, JWT, CRUD, geometry, analytics    |

Unit tests live in `tests/unit` (auth form validation and error mapping, sign-out flow,
projects/sites CRUD service calls and error handling, polygon validation and area maths).
End-to-end specs live in `tests/e2e`. Backend tests live in `backend/tests`
(health and OpenAPI, JWT verification and rejection of anonymous requests, login /
register / invalid credentials, project CRUD, multiple sites per project, site CRUD,
invalid and zero-area polygon rejection, PostGIS SQL and SRID, area in responses,
analytics and time ranges). They stub the database session, so they need no
production credentials and no live database:

```sh
cd backend && pytest          # 51 tests
ruff check . && ruff format --check .
```

E2E specs that need a signed-in session read `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` (copy
`.env.test.example` to `.env.test`, or set them as CI secrets) and **skip automatically**
when those are absent, so anonymous specs still run everywhere. Use a dedicated throwaway
account — the suite creates data. Set `E2E_BASE_URL` to test a deployed URL instead of the
local dev server. Google OAuth cannot be automated (Google blocks headless consent), so the
E2E suite only asserts the button is present; the handler itself is unit-tested.

GitHub Actions runs all three suites — see [CI/CD](#cicd).

---

## Local development

### Frontend

```sh
git clone <this-repository-url>
cd <repository-name>
bun install          # or: npm install
cp .env.example .env # fill in API base URL, backend + Mapbox values
bun run dev          # http://localhost:8080
```

Scripts: `dev`, `build`, `build:dev`, `preview`, `lint`, `format`, `format:check`,
`typecheck`, `test`, `test:watch`, `test:coverage`, `test:e2e`, `test:e2e:ui`.

### Backend (FastAPI)

```sh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env      # DATABASE_URL, JWT_SECRET / JWT_JWKS_URL, AUTH_BASE_URL, CORS_ORIGINS
uvicorn app.main:app --reload --port 8000
```

Set `VITE_API_BASE_URL=http://localhost:8000` in the root `.env` and restart
`bun run dev` so the frontend talks to FastAPI. Swagger UI: <http://localhost:8000/docs>.

### Database

The managed PostgreSQL + PostGIS instance is provisioned already. For a
self-managed instance: create the database, run `CREATE EXTENSION postgis;`,
apply `drizzle/migrations/*.sql` in order, then point `DATABASE_URL` at it.

### Environment variables

All variables, and which of them are browser-visible, are documented in
[`.env.example`](.env.example). Frontend: `VITE_API_BASE_URL`,
`VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`. Backend (server-side only, never `VITE_`-prefixed):
`DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_AUDIENCE`, `JWT_JWKS_URL`,
`AUTH_BASE_URL`, `AUTH_ANON_KEY`, `CORS_ORIGINS`, `ENVIRONMENT`. `.env` is
git-ignored; no real secret is committed.

### Pre-commit hooks

This repository uses **Husky** + **lint-staged** to enforce code quality before every commit. When you run `npm install` (or `bun install`), the `prepare` script automatically initializes Husky and wires the pre-commit hook into Git.

Before every commit, lint-staged runs on staged files:

- `*.{ts,tsx,js,jsx}` → `eslint --fix` (blocks the commit if errors remain), then `prettier --write`.
- `backend/**/*.py` → `sh scripts/lint-python.sh`, which runs `ruff check --fix` and
  `ruff format` from the backend virtualenv (skipped with a note if Ruff is not installed).

The commit is blocked if ESLint reports errors. Prettier formatting changes are automatically added to the commit.

To test the hook locally without committing:

```sh
# Stage a TypeScript or JSX file, then run:
npx lint-staged
```

To bypass the hook in rare cases (not recommended):

```sh
git commit --no-verify -m "..."
```

### Database migrations

Migrations are plain SQL files under `drizzle/migrations`, applied in order.
Against a self-managed PostGIS instance:

```sh
psql "$DATABASE_URL" -f drizzle/migrations/<file>.sql
```

PostGIS must be available (`CREATE EXTENSION postgis;`) before the first migration.

---

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request to `main`, in
three jobs. No step uses `continue-on-error`, so any failing check fails the run.

- **quality** — `bun install` → ESLint → `prettier --check` → `tsc --noEmit` →
  Vitest (58 unit tests) → production build → upload `dist`.
- **backend** — Python 3.11 → `pip install -r requirements-dev.txt` →
  `ruff check` → `ruff format --check` → `pytest` (51 API tests, no database needed).
- **e2e** — needs both of the above; installs Chromium and runs the Playwright suite.

Repository secrets used: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`MAPBOX_PUBLIC_TOKEN`, and optionally `E2E_BASE_URL`, `E2E_TEST_EMAIL`,
`E2E_TEST_PASSWORD` (account-dependent specs skip when they are absent).

---

## Deployment

### Hosted (recommended)

The app is deployed from the Lovable editor with **Publish**; the database, auth and
server functions are already hosted alongside it. Backend changes go live immediately,
frontend changes when you publish.

### Vercel (frontend)

1. Import the repository into Vercel.
2. Build command `bun run build`, output `dist`.
3. Add `VITE_API_BASE_URL` (the Render service URL — required in production so the
   browser talks to FastAPI rather than the fallback transport), plus
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN`, `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY` as project environment variables.
4. Add the deployment domain to the backend's allowed redirect URLs so OAuth login works.

### Render (FastAPI backend)

[`render.yaml`](render.yaml) is a ready blueprint for the API service.

1. In Render, choose **New → Blueprint** and select this repository.
2. Fill in the values marked `sync: false`: `DATABASE_URL`, `JWT_SECRET` (or
   `JWT_JWKS_URL`), `AUTH_BASE_URL`, `AUTH_ANON_KEY`, and `CORS_ORIGINS` set to
   your deployed frontend origin.
3. Deploy. Health check is `/health`; `autoDeploy` ships every merge to `main`.
4. Copy the resulting service URL into the frontend's `VITE_API_BASE_URL` and redeploy it.

For a self-managed database instead of the managed one: create a PostgreSQL
instance, run `CREATE EXTENSION postgis;`, apply `drizzle/migrations/*.sql` in
order, and point `DATABASE_URL` at it.

No public deployment URL is claimed here: Vercel and Render both require your
own accounts, so the URLs only exist once you complete the steps above.

Both providers require your own accounts and tokens; add them and the pipeline above
deploys on every merge to `main`.
