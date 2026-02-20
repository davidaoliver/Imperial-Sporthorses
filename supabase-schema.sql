-- ============================================================
-- BARN MANAGER - Supabase SQL Schema
-- Run this in the Supabase SQL Editor to set up your database.
-- ============================================================

-- 1. USERS TABLE (public mirror of auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'Staff' CHECK (role IN ('Admin', 'Staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read all users
CREATE POLICY "Users are viewable by authenticated users"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own row (fallback if trigger misses)
CREATE POLICY "Users can insert own row"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own display_name
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any user (e.g. role changes)
CREATE POLICY "Admins can update any user"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin')
  );

-- Trigger: auto-insert a row in public.users when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- 2. LOCATIONS TABLE (Stalls & Pastures)
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Stall', 'Pasture')),
  grid_row INT DEFAULT 0,
  grid_col INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locations viewable by authenticated"
  ON public.locations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert locations"
  ON public.locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));

CREATE POLICY "Admins can update locations"
  ON public.locations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));

CREATE POLICY "Admins can delete locations"
  ON public.locations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));


-- 3. HORSES TABLE
CREATE TABLE public.horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_info TEXT,
  home_stall UUID REFERENCES public.locations(id),
  assigned_pasture UUID REFERENCES public.locations(id),
  current_location UUID REFERENCES public.locations(id),
  am_grain TEXT,
  pm_grain TEXT,
  hay_type TEXT,
  supplements TEXT,
  meds_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.horses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Horses viewable by authenticated"
  ON public.horses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert horses"
  ON public.horses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));

CREATE POLICY "Admins can update horses"
  ON public.horses FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));

-- Staff can update current_location only
CREATE POLICY "Staff can update horse location"
  ON public.horses FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);


-- 4. TASK TEMPLATES (master list for midnight reset)
CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('AM', 'Mid-Day', 'PM')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task templates viewable by authenticated"
  ON public.task_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage task templates"
  ON public.task_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));


-- 5. TASKS TABLE (daily generated tasks)
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('AM', 'Mid-Day', 'PM')),
  assigned_to UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Done')),
  completed_at TIMESTAMPTZ,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks viewable by authenticated"
  ON public.tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (true);

-- Any authenticated user can update task status/assignment
CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));


-- 6. WEEKLY SCHEDULE (shift assignments per day)
CREATE TABLE public.weekly_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  shift TEXT NOT NULL CHECK (shift IN ('AM', 'Mid-Day', 'PM')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week, shift)
);

ALTER TABLE public.weekly_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedule viewable by authenticated"
  ON public.weekly_schedule FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage schedule"
  ON public.weekly_schedule FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));


-- 7. MESSAGES TABLE (Chat)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by authenticated"
  ON public.messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- 8. FEED INVENTORY TABLE
CREATE TABLE public.feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_name TEXT NOT NULL,
  quantity TEXT,
  delivery_date DATE,
  expiration_date DATE,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Low', 'Expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feed inventory viewable by authenticated"
  ON public.feed_inventory FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert feed inventory"
  ON public.feed_inventory FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));

CREATE POLICY "Admins can update feed inventory"
  ON public.feed_inventory FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));

CREATE POLICY "Admins can delete feed inventory"
  ON public.feed_inventory FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));


-- 9. FUNCTION: Generate daily tasks from templates
CREATE OR REPLACE FUNCTION public.generate_daily_tasks()
RETURNS void AS $$
DECLARE
  today DATE := CURRENT_DATE;
  dow INT := EXTRACT(DOW FROM today)::INT;
BEGIN
  -- Only generate if no tasks exist for today
  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE task_date = today) THEN
    INSERT INTO public.tasks (title, shift, assigned_to, status, task_date, sort_order)
    SELECT
      tt.title,
      tt.shift,
      ws.user_id,
      'Pending',
      today,
      tt.sort_order
    FROM public.task_templates tt
    LEFT JOIN public.weekly_schedule ws
      ON ws.shift = tt.shift AND ws.day_of_week = dow;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 10. Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.horses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_inventory;


-- ============================================================
-- SEED DATA (Optional - remove or modify for your barn)
-- ============================================================

-- Sample Locations
INSERT INTO public.locations (name, type, grid_row, grid_col) VALUES
  ('Stall 1', 'Stall', 0, 0),
  ('Stall 2', 'Stall', 0, 1),
  ('Stall 3', 'Stall', 0, 2),
  ('Stall 4', 'Stall', 1, 0),
  ('Stall 5', 'Stall', 1, 1),
  ('Stall 6', 'Stall', 1, 2),
  ('Pasture A', 'Pasture', 3, 0),
  ('Pasture B', 'Pasture', 3, 1),
  ('Pasture C', 'Pasture', 3, 2);

-- Sample Task Templates
INSERT INTO public.task_templates (title, shift, sort_order) VALUES
  ('Feed AM Grain', 'AM', 1),
  ('Hay AM', 'AM', 2),
  ('Turnout Horses', 'AM', 3),
  ('Muck Stalls', 'AM', 4),
  ('Water Check', 'AM', 5),
  ('Midday Hay', 'Mid-Day', 1),
  ('Water Check', 'Mid-Day', 2),
  ('Fly Spray', 'Mid-Day', 3),
  ('Bring In Horses', 'PM', 1),
  ('Feed PM Grain', 'PM', 2),
  ('Hay PM', 'PM', 3),
  ('Night Check', 'PM', 4),
  ('Lock Up', 'PM', 5);
