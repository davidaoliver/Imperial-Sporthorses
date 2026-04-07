-- Schedule Notes table — run this in the Supabase SQL Editor
CREATE TABLE public.schedule_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_schedule_notes_sort ON public.schedule_notes (pinned DESC, updated_at DESC);

ALTER TABLE public.schedule_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read schedule notes"
  ON public.schedule_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert schedule notes"
  ON public.schedule_notes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedule notes"
  ON public.schedule_notes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Creator or admin can delete schedule notes"
  ON public.schedule_notes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin')
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_notes;
