# DARUKAA.EARTH API (FastAPI)

Python service that sits between the React frontend and the existing
PostgreSQL + PostGIS database:

```
React + TypeScript  ->  FastAPI  ->  PostgreSQL + PostGIS
```

It does not own the schema. The tables, PostGIS geometry columns, triggers and
indexes are created by the SQL migrations in `../drizzle/migrations`; this
service reads and writes them.

## Layout

```
backend/
├── app/
│   ├── main.py                  FastAPI app, CORS, error handlers, /health
│   ├── core/config.py           env-driven settings (no hard-coded secrets)
│   ├── core/security.py         JWT verification (HS256 secret or JWKS)
│   ├── db/database.py           SQLAlchemy engine + session dependency
│   ├── db/dependencies.py       DbSession / AuthedUser annotations
│   ├── models/tables.py         Core table mappings of the existing schema
│   ├── schemas/                 Pydantic request/response models
│   ├── api/                     auth, projects, sites, analytics routers
│   └── services/                project, site (PostGIS), analytics, geometry
├── tests/                       pytest suite (no database, no real secrets)
├── requirements.txt
└── requirements-dev.txt
```

## Run it locally

```sh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env      # fill in DATABASE_URL, JWT_SECRET, AUTH_BASE_URL, ...
uvicorn app.main:app --reload --port 8000
```

Then point the frontend at it with `VITE_API_BASE_URL=http://localhost:8000` in
the root `.env` and restart `bun run dev`.

Interactive docs: <http://localhost:8000/docs> (Swagger UI) and `/redoc`.
Readiness: `GET /health` (liveness) and `GET /health/db` (connection + PostGIS
version).

## Endpoints

| Method | Path                               | Purpose                                            |
| ------ | ---------------------------------- | -------------------------------------------------- |
| POST   | `/api/auth/register`               | Create an account through the platform auth server |
| POST   | `/api/auth/login`                  | Exchange credentials for a JWT                     |
| GET    | `/api/auth/me`                     | The verified caller and their role                 |
| GET    | `/api/projects`                    | List the caller's projects                         |
| POST   | `/api/projects`                    | Create a project                                   |
| GET    | `/api/projects/{project_id}`       | Read a project                                     |
| PUT    | `/api/projects/{project_id}`       | Update a project                                   |
| DELETE | `/api/projects/{project_id}`       | Delete a project                                   |
| GET    | `/api/projects/{project_id}/sites` | Sites of one project                               |
| POST   | `/api/projects/{project_id}/sites` | Add a drawn boundary                               |
| GET    | `/api/sites`                       | Every site the caller owns                         |
| GET    | `/api/sites/{site_id}`             | Read one site with GeoJSON boundary                |
| PUT    | `/api/sites/{site_id}`             | Update a site or replace its boundary              |
| DELETE | `/api/sites/{site_id}`             | Delete a site                                      |
| GET    | `/api/sites/{site_id}/analytics`   | Series + latest values + change                    |
| GET    | `/api/sites/{site_id}/metrics`     | Raw historical measurements                        |
| GET    | `/api/metrics`                     | Recent measurements across the portfolio           |
| GET    | `/health`, `/health/db`            | Liveness / readiness                               |

Status codes: `401` no or invalid token, `403` reserved for role checks, `404`
unknown or not-owned record, `422` validation or geometry rejection, `500`
generic message only — database internals are logged, never returned.

## Authentication

One coherent flow, no second account system:

1. The browser signs in (email/password or Google) and receives a JWT from the
   platform auth server.
2. The frontend sends `Authorization: Bearer <jwt>` on every API call.
3. `core/security.py` verifies signature, expiry and audience — with a shared
   secret (`JWT_SECRET`, HS256) or a JWKS endpoint (`JWT_JWKS_URL`, RS256/ES256).
4. `sub` becomes the owner id used in every SQL statement, so a caller only ever
   sees their own projects, sites and measurements.

`/api/auth/login` and `/api/auth/register` proxy the auth server so the frontend
can use a single API surface. Passwords are never stored, hashed or logged here.

## Geospatial handling

- Incoming GeoJSON is validated twice: Pydantic checks structure, closed rings
  and coordinate ranges; `services/geometry.py` rejects degenerate polygons
  (fewer than three distinct corners, zero enclosed area).
- Storage uses `ST_GeomFromGeoJSON` → `ST_MakeValid` → `ST_SetSRID(..., 4326)`
  into the existing `sites.geom geometry(Polygon, 4326)` column.
- Reads use `ST_AsGeoJSON`, plus `ST_X`/`ST_Y` of the stored centroid.
- Centroid and spheroidal hectare area are computed by the database triggers
  (`sites_derive_spatial`, `sync_project_area`) and returned in the response.

## Quality checks

```sh
ruff check .          # lint
ruff format --check . # formatting
pytest                # 51 tests, no database required
mypy app              # optional type checking
```
