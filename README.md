# Bocha

Multi-company SaaS back-office: clients, quotes, suppliers and invoices.
Each company (tenant) sees only its own data, enforced through Row Level Security.
The pilot company is Vivero Urbano.

The product name lives in `frontend/src/lib/brand.ts` — that single file is all
you need to touch to rename it across the whole app.

**Live:** https://boviverourbano.vercel.app

## Architecture

```
bocha/
├── frontend/          # Next.js 16 + Tailwind CSS + Supabase JS
├── backend/           # Spring Boot 3.3 + Java 21 + JPA
├── supabase/          # SQL schema + RLS policies
└── .github/workflows/ # CI/CD (GitHub Actions)
```

**Stack:**
- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4, TanStack Query v5, React Hook Form + Zod, Sonner, jsPDF
- **Backend:** Spring Boot 3.3, Java 21, Spring Data JPA, MapStruct, Lombok, Springdoc OpenAPI
- **Database:** Supabase (PostgreSQL)
- **Deploy:** Vercel (frontend) + Render (backend)

## Why multi-tenant from day one

Tenant isolation does not rely on the UI filtering correctly. It is enforced in
the database: every business table carries `company_id NOT NULL` and an RLS
policy that rejects any read or write outside the connected user's company.

Building it this way cost more upfront than one instance per client, but
retrofitting multi-tenancy onto live production data would have been far worse.

## Features

- **Clients** — full CRUD, statuses (prospect / client), search and filters
- **Quotes** — line items, bulk import from pasted text, inline status changes, PDF export
- **Suppliers + Invoices** — complete purchasing cycle
- **Settings** — reusable informative-text presets for quotes
- **Dashboard** — monthly metrics, recent activity, CSV export
- **Dark mode** — toggle persisted in localStorage, no flash on reload
- **Quick search** — `Ctrl/Cmd + K` jumps to any section, creates a client or quote, or finds a client by name
- **Responsive** — mobile drawer navigation, card lists and bottom-sheet dialogs on small screens
- **Authentication** — Supabase Auth, routes protected by middleware
- **Multi-tenancy** — each company sees only its own data. Strict RLS.
- **Self-service onboarding** — anyone can create their company at `/register`
- **Company switcher** — users belonging to several companies switch without re-login
- **Per-company branding** — name, logo and color (also on login via `?company=slug`)
- **Plans** — Free / Pro / Enterprise with limits and a billing page
- **Global super-admin** — cross-tenant view for the SaaS operator (`/admin/companies`)

## Local development

### Requirements

- Node.js 20+
- Java 21 + Maven 3.9+
- A Supabase account

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in the variables in .env.local
npm install
npm run dev
```

### Backend

```bash
cd backend
export DB_URL=jdbc:postgresql://db.xxx.supabase.co:5432/postgres
export DB_USERNAME=postgres
export DB_PASSWORD=your_password
export ALLOWED_ORIGINS=http://localhost:3000
mvn spring-boot:run
```

## Testing

### Frontend — Vitest + Testing Library

```bash
cd frontend
npm test            # single run (what CI runs)
npm run test:watch  # watch mode
```

- `src/lib/*.test.ts` — data access (Supabase query building, soft delete, errors) and pure helpers
- `src/components/**/*.test.tsx` — UI kit, command palette (Ctrl+K), client form
- `src/app/(backoffice)/**/*.test.tsx` — full screens: dashboard, clients, quotes list, new quote, quote detail
- Supabase is replaced by a recording double (`src/test/supabaseMock.ts`), so tests need no network or database.

### Backend — JUnit 5 + Mockito + MockMvc

```bash
cd backend
mvn test
```

- Domain and DTO validation rules
- MapStruct mappers (generated implementations)
- Use cases with mocked repositories
- Controllers with `@WebMvcTest`, including error responses (400 / 404 / 500 as Problem Details)

## Environment variables

### Frontend (`frontend/.env.local`)

| Variable | Description | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | Supabase → Settings → API |
| `NEXT_PUBLIC_API_URL` | Backend URL (optional) | Render URL |

### Backend

| Variable | Description |
|---|---|
| `DB_URL` | `jdbc:postgresql://db.xxx.supabase.co:5432/postgres` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | Supabase password |
| `ALLOWED_ORIGINS` | Frontend URL on Vercel |

## Database

Full setup from scratch (tables, RLS, roles, permissions and the compatibility view):

```
Supabase → SQL Editor → paste supabase/schema.sql → Run
```

Create the first company and admin user (edit the values at the top first):

```
Supabase → SQL Editor → paste supabase/seed.sql → edit → Run
```

### Multi-tenancy

Each company is a row in `companies`. Users belong to one or more companies
through `user_companies(user_id, company_id, role_id)`. Every business table
(`clients`, `quotes`, `quote_items`, `suppliers`, `invoices`, etc.) carries
`company_id NOT NULL`, defaulting to the user's active company
(`current_company_id()`), with RLS filtering on `is_member_of(company_id)`.

The active company is stored in `profiles.current_company_id` and can be changed
from the sidebar switcher when the user belongs to more than one.

### Adding a company without self-service

```sql
INSERT INTO companies (slug, name, primary_color)
VALUES ('company-x', 'Company X', '#2563eb');

-- then assign users from the back-office /admin page, or:
INSERT INTO user_companies (user_id, company_id, role_id)
VALUES (
  (SELECT id FROM auth.users WHERE email='user@company-x.com'),
  (SELECT id FROM companies  WHERE slug='company-x'),
  (SELECT id FROM roles      WHERE name='administrador')
);
```

## CI/CD — required GitHub secrets

Go to **GitHub → repo → Settings → Secrets and variables → Actions**

| Secret | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `RENDER_DEPLOY_HOOK_URL` | Render → service → Settings → Deploy Hook |

## Deploy

### Frontend (Vercel)

- Root directory: `frontend`
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Backend (Render)

- Language: Docker / Root directory: `backend`
- Env vars: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `ALLOWED_ORIGINS`
- Health check path: `/actuator/health`

## API

Swagger UI: `https://backoffice-vivero-urbano.onrender.com/swagger-ui.html`

Main endpoints under `/api/v1/`:

| Method | Path | Description |
|---|---|---|
| GET | `/clients` | List clients (paginated) |
| POST | `/clients` | Create client |
| PATCH | `/clients/{id}` | Update client |
| DELETE | `/clients/{id}` | Delete client (soft delete) |
| GET | `/quotes` | List quotes |
| POST | `/quotes` | Create quote |
| PATCH | `/quotes/{id}/status` | Change status |
| GET | `/quote-information` | List text presets |
