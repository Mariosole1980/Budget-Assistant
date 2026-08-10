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
    -- Soft-delete support (mirrors the transactions trash-bin pattern)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Structured checklist items (JSONB array of {text, checked}) — avoids fragile
    -- JSON-string parsing of `body` for checklist notes.
    checklist_items JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist if table was already created (idempotent for existing installs)
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS checklist_items JSONB;

-- Index to speed up trash-bin queries (status='deleted' ordered by deleted_at)
CREATE INDEX IF NOT EXISTS idx_notes_status_deleted_at ON public.notes (status, deleted_at DESC);

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
