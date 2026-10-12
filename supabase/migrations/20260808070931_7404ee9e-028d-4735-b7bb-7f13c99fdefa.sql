ALTER TABLE public.presentations
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_title text;

CREATE INDEX IF NOT EXISTS presentations_published_idx ON public.presentations (published, updated_at DESC);

DROP POLICY IF EXISTS "Anyone can view published presentations" ON public.presentations;
CREATE POLICY "Anyone can view published presentations"
ON public.presentations FOR SELECT
TO authenticated, anon
USING (published = true);

GRANT SELECT ON public.presentations TO anon;