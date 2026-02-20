# Barn Manager

A mobile-first React web application for managing a horse barn — tasks, facility map, team chat, and feed/nutrition tracking.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS v4 + Lucide React icons
- **Backend:** Supabase (Auth, Database, Realtime)

## Getting Started

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In **Authentication → Providers**, enable **Google OAuth** and configure your Google Cloud credentials.
3. In the **SQL Editor**, run the contents of `supabase-schema.sql` to create all tables, RLS policies, triggers, and seed data.

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Install & Run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## Features

### Authentication & Onboarding
- Google OAuth via Supabase Auth
- First-login flow: users must set a display name before accessing the app
- Auto-insert trigger creates a `public.users` row on signup

### Role-Based Access Control
- **Admin (Barn Manager):** Full access including settings, task reassignment, horse management, and inventory
- **Staff:** Can view everything, claim/complete tasks, send chat messages, and update horse locations
- Admins see a gear icon in the bottom nav to access the Admin panel

### Tab 1: Smart Task Board
- Daily tasks grouped by shift (AM / Mid-Day / PM)
- Tap to claim (Pending → In Progress) → tap again to complete (→ Done)
- Color-coded status cards (Red/Yellow/Green)
- Midnight reset: `generate_daily_tasks()` DB function creates fresh tasks from templates
- Shift assignment from weekly schedule table
- Admin override: pencil icon to reassign any task on the fly (Realtime sync)

### Tab 2: Interactive Facility Map
- 2D grid layout of Stalls and Pastures
- Shows which horse belongs where (home stall labels, assigned pasture labels)
- Admins can tap a horse → tap a destination to move them
- Warning prompt if moving to the wrong pasture

### Tab 3: Barn Chat
- Real-time group chat via Supabase Realtime
- Messages show display name, timestamp, and content
- Own messages styled differently from others

### Tab 4: Feed & Nutrition Room
- **Feed Chart:** Scannable list of all horses with AM/PM grain, hay type, supplements, and meds notes
- **Inventory Tracker:** Feed inventory with color-coded expiration (Yellow ≤14 days, Red = expired)
- **Add Delivery:** Admin-only button to log new feed deliveries with expiration dates

### Admin Settings
- **Manage Users:** Toggle Admin/Staff roles
- **Locations:** Add/remove stalls and pastures
- **Horses:** Add horses with full nutrition profiles
- **Task Templates:** Manage the master task list for daily generation
- **Weekly Schedule:** Assign staff to shifts by day of the week

## Database Schema

See `supabase-schema.sql` for the complete schema including:
- `users` — synced from `auth.users` via trigger
- `locations` — stalls and pastures
- `horses` — with home stall, assigned pasture, current location, feed info
- `task_templates` — master task list
- `tasks` — daily generated tasks
- `weekly_schedule` — shift assignments per day
- `messages` — chat messages
- `feed_inventory` — feed tracking with expiration

All tables have Row Level Security enabled with appropriate policies.

## Midnight Task Reset

The `generate_daily_tasks()` Postgres function creates tasks from templates. To automate this at midnight, set up a **Supabase CRON job** (via `pg_cron` extension):

```sql
SELECT cron.schedule(
  'generate-daily-tasks',
  '0 0 * * *',
  $$SELECT public.generate_daily_tasks()$$
);
```

Or call the function from your app's Admin panel via the "Generate" button.
