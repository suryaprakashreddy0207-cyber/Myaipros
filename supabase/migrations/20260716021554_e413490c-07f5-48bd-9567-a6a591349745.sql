CREATE TABLE public.presentations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled presentation',
  topic text NOT NULL DEFAULT '',
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentations TO authenticated;
GRANT ALL ON public.presentations TO service_role;
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own presentations" ON public.presentations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);