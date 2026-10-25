# Noctis — Your Personal Productivity Space

Noctis is a modern, unified personal productivity web application designed to help students and professionals manage course schedules, task lists, agendas, and notes in one cohesive interface. Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and **Supabase**, Noctis delivers an elegant dark/light workflow with support for both cloud-synced accounts and zero-configuration local guest usage.

---

## Key Features

- **Dashboard**: Centralized home screen displaying today's active schedule, high-priority tasks, upcoming agenda events, and real-time "Next Up" activity recommendations.
- **Schedules & Calendar**: Weekly class and recurring schedule management with date range bounds (`start_date` and `end_date`), day-of-week validation, and interactive daily/weekly calendar views.
- **Tasks Management**: Structured task tracking with priority tiers (`low`, `medium`, `high`), status workflows (`todo`, `in_progress`, `done`), deadline timestamps, and direct associations with course schedules.
- **Agenda & Events**: Time-aware event scheduling with automated category classification (`academic`, `organization`, `personal`).
- **Notes**: Fast, distraction-free notes with tag filtering and pin-to-top support.
- **Settings & Customization**: Theme toggling (**Light**, **Dark**, or **System** preference), timezone configuration, and full profile management.
- **Data Portability (Export & Import)**: Atomic JSON backup export and import with strict [Zod](https://zod.dev/) schema validation, foreign key re-mapping, and rollback safety.
- **Progressive Web App (PWA)**: Installable standalone app experience with service worker asset caching and branded offline fallback.

---

## Technology Stack

The application is built strictly using the dependencies specified in `package.json`:

| Area | Technology | Version / Specification |
| :--- | :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) | `16.4.2` (App Router, Turbopack, Server & Client Components) |
| **UI Library** | [React](https://react.dev/) | `19.3.0` |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `^5` |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | `^4` (with `@tailwindcss/turbopack`) |
| **Backend & DB** | [Supabase](https://supabase.com/) | `@supabase/ssr: ^0.12.7`, `@supabase/supabase-js: ^2.118.0` |
| **Schema Validation** | [Zod](https://zod.dev/) | `^4.6.7` |
| **Date Utilities** | [date-fns](https://date-fns.org/) | `^4.4.0` |
| **Icons & Notifications** | [Lucide React](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/) | `lucide-react: ^1.61.0`, `sonner: ^2.0.8` |
| **Styling Helpers** | `clsx`, `tailwind-merge` | `clsx: ^2.1.1`, `tailwind-merge: ^3.7.0` |

---

## Dual Storage Architecture

Noctis includes an adaptive dual-storage architecture that allows the app to function immediately without requiring a backend, while seamlessly upgrading to cloud persistence when Supabase credentials are provided.

| Feature / Aspect | Guest Mode (Local Storage) | Supabase Mode (Cloud Database) |
| :--- | :--- | :--- |
| **Activation** | Default when `NEXT_PUBLIC_SUPABASE_URL` is omitted or empty. | Active when valid Supabase environment variables are configured. |
| **Authentication** | None (instant access to all app routes). | Supabase Auth (Email & Password registration/login). |
| **Route Protection** | Private routes open directly without redirect. | Middleware redirects unauthenticated requests to `/login`. |
| **Data Storage** | Browser `localStorage` (`noctis_storage_*_v1`). | Supabase PostgreSQL tables protected by Row Level Security (RLS). |
| **Cross-Device Sync** | **Not supported**. Data is local to the specific browser profile. | **Supported**. Data synchronizes across any authenticated device. |
| **Data Backup** | Manual via JSON Export in Settings. | Cloud persistence + manual JSON Export/Import in Settings. |

> **Important Disclosure on Guest Mode:**
> Guest Mode does not perform background syncing, cloud backups, or cross-browser data sharing. If you clear your browser's site data or switch browsers, Guest Mode data will be lost unless you export a JSON backup beforehand.

---

## Prerequisites & Local Installation

### Prerequisites
- **Node.js**: `>= 20.x` recommended (compatible with Next.js 16 and native ESM strip-types).
- **npm**: Package manager bundled with Node.js.

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/paiszz/noctis.git
cd noctis
npm install
```

### 2. Run in Guest Mode (Zero-Config)
If you do not need Supabase cloud sync, you can launch the app immediately:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The application will detect that Supabase is unconfigured and run in **Guest Mode**.

---

## Environment Variables

To enable cloud authentication and database synchronization, create a local environment file by copying `.env.example`:

```bash
cp .env.example .env.local
```

### Active Variables (Required for Supabase Mode)
These variables are read directly by `src/lib/supabase/config.ts`:

```env
# Supabase Project URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Public API / Anon Key (Publishable key)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
# (Alternatively, NEXT_PUBLIC_SUPABASE_ANON_KEY is also accepted as fallback)
```

### Planned / Inactive Variables
The following variables are defined in `.env.example` as architectural foundations for future capabilities (e.g. backend Web Push delivery and background cron schedulers). They are **not actively consumed by the current application runtime**:

- `SUPABASE_SERVICE_ROLE_KEY`: Privileged admin key. **Never expose to the client or prefix with `NEXT_PUBLIC_`.**
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: Reserved for future Web Push server implementation.
- `REMINDER_SCHEDULER_SECRET`: Reserved for future background scheduler endpoints.

---

## Supabase Setup & Database Migrations

When connecting Noctis to a Supabase project, follow these steps:

### 1. Configure Authentication
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and navigate to **Authentication → URL Configuration**.
2. Set **Site URL** to your application domain (e.g. `http://localhost:3000` for local development, or your production URL).
3. In **Redirect URLs**, add:
   - `http://localhost:3000/auth/callback` (for local development)
   - `https://your-production-domain.com/auth/callback` (for production)

### 2. Apply Database Migrations
Database migration files are located in `supabase/migrations/`.

> **Important**: Migration files committed to the repository **are not automatically executed on remote databases**. You must apply them manually via the Supabase Dashboard SQL Editor or using the Supabase CLI (`supabase db push`).

Detailed migration instructions, security notes, and schema details are documented in [`supabase/README.md`](supabase/README.md).

The migrations must be applied in sequential order:
1. `20261022000000_create_noctis_schema.sql`:
   - Creates the 6 core tables (`profiles`, `user_preferences`, `schedules`, `tasks`, `notes`, `agenda_events`).
   - Configures multi-tenant Row Level Security (RLS) scoped strictly to `auth.uid()`.
   - Sets up the `handle_new_user()` trigger for automatic profile generation on signup.
   - Enforces composite foreign keys (`tasks(user_id, course_schedule_id)` referencing `schedules(user_id, id)`).
2. `20261023000000_import_user_data_atomic.sql`:
   - Creates the PostgreSQL RPC function `public.import_user_data_atomic(payload jsonb)`.
   - Provides transactional atomic replacement, payload pre-validation, and ID re-mapping.
3. `20261025000000_validate_import_schedule_date_range.sql`:
   - Updates `public.import_user_data_atomic(payload jsonb)`.
   - Enforces date range ordering (`start_date <= end_date`) and validates that the date range encompasses the schedule's `day_of_week` prior to any database mutation.

---

## Development & Verification Commands

All development and validation scripts are defined in `package.json`:

```bash
# Start Next.js development server
npm run dev

# Run comprehensive standalone test suite (7 test suites)
npm test

# Run strict TypeScript type-checking
npx tsc --noEmit

# Check for formatting and whitespace issues in Git
git diff --check

# Compile production build with Next.js Turbopack
npm run build

# Start production server (requires npm run build first)
npm run start
```

### Verification Status & Known Audit Findings
- **Automated Test Suite (`npm test`)**: **100% Passing**. Runs 7 test suites covering schedule date ranges, agenda categorization, next-up timeline sorting, timezone handling, atomic JSON import validation, PWA file integrity, and auth redirect sanitization.
- **Type Checking (`npx tsc --noEmit`)**: **0 errors**. Codebase strictly conforms to TypeScript typings.
- **Production Build (`npm run build`)**: **100% Passing**. Generates static and dynamic routes cleanly with Next.js Turbopack.
- **Linter (`npm run lint`)**: **Known Issue (23 errors, 31 warnings)**. ESLint 9 using `eslint-config-next` enforces canary React 19 rules (`react-hooks/set-state-in-effect` and `react-hooks/refs`). While the application compiles and functions correctly, these linter warnings/errors are actively tracked for refactoring and will fail CI pipelines that enforce zero-lint warnings.

---

## Progressive Web App (PWA) & Offline Capabilities

Noctis includes Progressive Web App support configured through `public/manifest.json` and `public/sw.js`.

### Installing the PWA
- **Desktop (Chrome / Edge / Brave)**: Click the install icon in the address bar or choose **Install Noctis** from the browser menu.
- **Mobile (iOS Safari)**: Tap the Share button and select **Add to Home Screen**.
- **Mobile (Android Chrome)**: Tap the three dots menu and select **Install App** or **Add to Home screen**.

### Testing Offline Mode
1. Open the app in your browser and open **DevTools** (`F12`).
2. Navigate to the **Network** tab and check the **Offline** checkbox.
3. Attempt to refresh or navigate to a new document route.
4. The Service Worker will intercept the failed network request and render the branded **Mode Luar Jaringan (Offline Fallback)** interface (`OFFLINE_FALLBACK_HTML`).

> **Offline Capability Disclosure:**
> Noctis caches application shell icons, fonts, and static assets. In **Guest Mode**, existing schedules and tasks remain accessible because they reside in browser `localStorage`. In **Supabase Mode**, remote PostgreSQL queries require network connectivity; offline background synchronization to the cloud database is not supported.

---

## Deployment Guide

### Deploying to Vercel (Recommended)
1. Push your repository to GitHub.
2. Import the project into the [Vercel Dashboard](https://vercel.com/new).
3. In **Project Settings → Environment Variables**, configure:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<your-project-id>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `<your-supabase-publishable-key>`
4. Deploy the project.
5. In your Supabase Dashboard (**Authentication → URL Configuration**), add your Vercel deployment URL (e.g. `https://your-app.vercel.app/auth/callback`) to the **Redirect URLs** list.

### Production Release Checklist
Before opening the application to end-users, ensure the following steps have been performed:
- [ ] All 3 Supabase migrations have been executed on the production PostgreSQL database.
- [ ] Production redirect URL (`https://your-domain.com/auth/callback`) is registered in Supabase.
- [ ] Environment variables are configured in the hosting provider without surrounding quotes or trailing spaces.
- [ ] SSL/HTTPS is active (required for Service Workers, Web Crypto, and secure cookies).
- [ ] Registration flow is manually verified by signing up a test account to confirm the `handle_new_user()` database trigger creates associated `profiles` and `user_preferences` rows.

---

## Project Structure

```text
noctis/
├── public/                 # Static assets, PWA manifest, service worker, icons
│   ├── icons/              # Multi-size PNG icons and maskable assets
│   ├── screenshots/        # PWA store preview screenshots
│   ├── manifest.json       # Web App Manifest
│   └── sw.js               # Service Worker implementation
├── scripts/                # Standalone verification and test suites
│   ├── test-schedule-date-range.mjs
│   ├── test-agenda-categorization.mjs
│   ├── test-next-up.mjs
│   ├── test-timezone-support.mjs
│   ├── test-import-validation.mjs
│   ├── test-pwa.mjs
│   └── test-redirect-sanitizer.mjs
├── src/
│   ├── app/                # Next.js App Router routes
│   │   ├── (app)/          # Authenticated/core app routes
│   │   │   ├── agenda/     # Agenda view & modal
│   │   │   ├── calendar/   # Schedules & calendar view
│   │   │   ├── dashboard/  # Main dashboard & summary cards
│   │   │   ├── notes/      # Notes list & editor
│   │   │   ├── settings/   # User preferences & import/export
│   │   │   └── tasks/      # Task board & filters
│   │   ├── (auth)/         # Auth routes (login, register)
│   │   ├── auth/callback/  # PKCE auth code exchange route handler
│   │   ├── layout.tsx      # Root HTML layout with PWA & font setup
│   │   └── globals.css     # Tailwind CSS design system tokens
│   ├── components/         # Reusable UI & domain-specific components
│   │   ├── agenda/
│   │   ├── calendar/
│   │   ├── dashboard/
│   │   ├── layout/         # Sidebar, navigation, mobile headers
│   │   ├── notes/
│   │   ├── pwa/            # PwaRegister lifecycle component
│   │   ├── settings/
│   │   ├── tasks/
│   │   └── ui/             # Primitives (Button, Modal, Card, TimePicker)
│   ├── lib/                # Core application logic & integrations
│   │   ├── supabase/       # Supabase client/server/middleware & DB models
│   │   ├── validation/     # Zod schemas for JSON import validation
│   │   ├── auth-context.tsx # User session & auth state provider
│   │   ├── data-context.tsx # Unified data provider (Guest & Supabase)
│   │   ├── next-up.ts      # Recommendation sorting algorithm
│   │   └── utils.ts        # Helper functions & redirect sanitizers
│   ├── proxy.ts            # Next.js middleware router proxy
│   └── types/              # Domain TypeScript interfaces and types
├── supabase/               # Supabase database configuration & migrations
│   ├── migrations/         # PostgreSQL DDL migrations
│   └── README.md           # Database setup and migration guide
├── .env.example            # Template for environment variables
├── eslint.config.mjs       # ESLint flat configuration
├── next.config.ts          # Next.js configuration (Turbopack, redirects)
├── package.json            # Project dependencies and npm scripts
└── tsconfig.json           # TypeScript configuration
```
