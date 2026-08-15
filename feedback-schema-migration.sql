-- ============================================================
-- FEEDBACK TABLE MIGRATION FOR BUDGET ASSISTANT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    rating INT NOT NULL,
    type TEXT DEFAULT 'suggestion',
    comment TEXT,
    user_email TEXT DEFAULT 'guest'
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow insert for authenticated users
CREATE POLICY "Enable insert for authenticated users on feedback" ON public.feedback
    FOR INSERT TO authenticated WITH CHECK (true);

-- Allow insert for anon/guest users
CREATE POLICY "Enable insert for anon users on feedback" ON public.feedback
    FOR INSERT TO anon WITH CHECK (true);

-- Allow select for service role / admin
CREATE POLICY "Enable read access for admin" ON public.feedback
    FOR SELECT USING (true);
