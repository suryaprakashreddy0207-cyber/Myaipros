CREATE TABLE public.business_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','instagram','x')),
  business_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  website TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scraped_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own business profiles" ON public.business_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);