-- SQL Migration: Create public.recurring_templates table
-- Execute this script in your Supabase SQL Editor (Dashboard -> SQL Editor)

CREATE TABLE IF NOT EXISTS public.recurring_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id UUID,
    is_shared BOOLEAN DEFAULT false,
    amount NUMERIC(12,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    category TEXT NOT NULL,
    subcategory TEXT,
    account_from TEXT NOT NULL,
    account_to TEXT,
    note TEXT,
    description TEXT,
    preset TEXT NOT NULL DEFAULT 'monthly',
    days INTEGER[] DEFAULT '{}',
    months INTEGER[] DEFAULT '{}',
    years INTEGER[] DEFAULT '{}',
    end_type TEXT NOT NULL DEFAULT 'perpetual',
    end_date DATE,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_year INTEGER,
    start_month INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Allow user and partner access to recurring templates" ON public.recurring_templates;

-- Create policy allowing users and their partners to view and edit templates
CREATE POLICY "Allow user and partner access to recurring templates" ON public.recurring_templates
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR user_id IN (
            SELECT partner_id FROM public.profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid() 
        OR user_id IN (
            SELECT partner_id FROM public.profiles WHERE id = auth.uid()
        )
    );

COMMENT ON TABLE public.recurring_templates IS 'Stores user defined recurring transaction templates for cloud syncing.';
