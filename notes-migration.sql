-- ============================================================
-- SQL Migration: Σημειώσεις & Λίστες Αγορών (Notes & Checklists)
-- ============================================================

-- 1. Create Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT, -- Holds raw text for text notes, or JSON-serialized array for checklists
    type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'checklist')),
    pinned BOOLEAN NOT NULL DEFAULT false,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    reminder_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure column exists if table was already created
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "Allow user or family select" ON public.notes;
DROP POLICY IF EXISTS "Allow user or family insert" ON public.notes;
DROP POLICY IF EXISTS "Allow user or family update" ON public.notes;
DROP POLICY IF EXISTS "Allow user or family delete" ON public.notes;

-- 4. Create Security Policies
CREATE POLICY "Allow user or family select" ON public.notes
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR 
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Allow user or family insert" ON public.notes
    FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() OR
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Allow user or family update" ON public.notes
    FOR UPDATE TO authenticated USING (
        user_id = auth.uid() OR 
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Allow user or family delete" ON public.notes
    FOR DELETE TO authenticated USING (
        user_id = auth.uid() OR 
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );
