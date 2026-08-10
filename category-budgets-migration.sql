-- ============================================================
-- SQL Migration: Προϋπολογισμοί Κατηγοριών (Category Budgets)
-- ============================================================
-- Δημιουργεί τον πίνακα `category_budgets` με RLS, ακολουθώντας το
-- μοτίβο των Notes (secondary entity, last-write-wins sync μέσω
-- `syncBudgets()` στο app.js).
--
-- Τα πεδία αντιστοιχούν ΑΚΡΙΒΩΣ σε αυτά που χρησιμοποιεί ο κώδικας
-- στο `syncBudgets()` (app.js:17153) — όχι στο αρχικό πλάνο.
--
-- SAFE & IDEMPOTENT: χρησιμοποιεί IF NOT EXISTS / IF EXISTS /
-- CREATE OR REPLACE. Re-running είναι no-op. Δεν κάνει drop πινάκων
-- και δεν απενεργοποιεί RLS.
--
-- Εκτέλεση: Supabase Dashboard -> SQL Editor -> Run.
-- ============================================================

-- ----------------------------------------------------------------------------
-- 1. Δημιουργία πίνακα category_budgets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_budgets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id        UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
    category         TEXT NOT NULL,
    subcategory      TEXT NOT NULL DEFAULT '',
    amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency         TEXT NOT NULL DEFAULT 'EUR',
    period           TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','weekly','yearly','custom')),
    scope            TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','family')),
    notify_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.80,
    is_deleted       BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_category_budgets_user
    ON public.category_budgets (user_id, category);

CREATE INDEX IF NOT EXISTS idx_category_budgets_family
    ON public.category_budgets (family_id, category);

CREATE INDEX IF NOT EXISTS idx_category_budgets_active
    ON public.category_budgets (user_id, updated_at DESC)
    WHERE is_deleted = false;

-- ----------------------------------------------------------------------------
-- 3. Ενεργοποίηση Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. Διαγραφή υπαρχόντων policies (idempotent)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow user or family select budgets" ON public.category_budgets;
DROP POLICY IF EXISTS "Allow user or family insert budgets" ON public.category_budgets;
DROP POLICY IF EXISTS "Allow user or family update budgets" ON public.category_budgets;
DROP POLICY IF EXISTS "Allow user or family delete budgets" ON public.category_budgets;

-- ----------------------------------------------------------------------------
-- 5. Δημιουργία Security Policies
-- ----------------------------------------------------------------------------
-- Ο χρήστης βλέπει/επεξεργάζεται τα δικά του + αυτά της οικογένειας.
-- Το μοτίβο είναι ίδιο με τα notes (family_id = το family του χρήστη).
CREATE POLICY "Allow user or family select budgets" ON public.category_budgets
    FOR SELECT TO authenticated USING (
        user_id = auth.uid() OR
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Allow user or family insert budgets" ON public.category_budgets
    FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() OR
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Allow user or family update budgets" ON public.category_budgets
    FOR UPDATE TO authenticated USING (
        user_id = auth.uid() OR
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Allow user or family delete budgets" ON public.category_budgets
    FOR DELETE TO authenticated USING (
        user_id = auth.uid() OR
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
    );

-- ----------------------------------------------------------------------------
-- Σημείωση για το RLS και το query του app.js:
-- Το `syncBudgets()` κάνει:
--   .or(`family_id.eq.${familyId},user_id.eq.${userId}`)
-- Αυτό ταιριάζει με τα policies παραπάνω: ο χρήστης βλέπει rows όπου
-- user_id = auth.uid() Ή family_id = το family του. Το RLS φιλτράρει
-- επιπλέον ώστε να μην εκτίθενται rows άλλων οικογενειών.
-- ----------------------------------------------------------------------------
