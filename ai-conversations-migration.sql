-- ============================================================
-- SQL Migration: AI Σύμβουλος — Συνομιλίες (AI Advisor Conversations)
-- ============================================================
-- Αποθηκεύει το ιστορικό των συνομιλιών με τον AI Σύμβουλο στο cloud,
-- ώστε να μην χάνεται όταν εκκαθαρίζεται το τοπικό localStorage
-- (εκκαθάριση δεδομένων WebView, επανεγκατάσταση, κ.λπ.).
--
-- Τοπικά οι συνομιλίες αποθηκεύονται στο localStorage με κλειδί
-- 'advisor_chat_conversations_v1'. Αυτός ο πίνακας αποτελεί το cloud
-- αντίγραφο (backup) και συγχρονίζεται με τη λογική merge-by-updatedAt,
-- ακριβώς όπως και οι σημειώσεις (notes).
--
-- Το migration είναι IDEMPOTENT (IF NOT EXISTS / IF EXISTS), οπότε
-- μπορεί να τρέξει με ασφάλεια πολλές φορές.
-- ============================================================

-- 1. Create AI Conversations Table
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id TEXT PRIMARY KEY,                -- Το ίδιο id με το τοπικό (π.χ. 'conv_...')
    title TEXT NOT NULL DEFAULT 'Νέα συνομιλία',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{sender, html}, ...]
    gemini_history JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{role, content}, ...]
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "Allow user select ai_conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Allow user insert ai_conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Allow user update ai_conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Allow user delete ai_conversations" ON public.ai_conversations;

-- 4. Create Security Policies (μόνο ο κάτοχος έχει πρόσβαση)
CREATE POLICY "Allow user select ai_conversations" ON public.ai_conversations
    FOR SELECT TO authenticated USING (
        user_id = auth.uid()
    );

CREATE POLICY "Allow user insert ai_conversations" ON public.ai_conversations
    FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid()
    );

CREATE POLICY "Allow user update ai_conversations" ON public.ai_conversations
    FOR UPDATE TO authenticated USING (
        user_id = auth.uid()
    );

CREATE POLICY "Allow user delete ai_conversations" ON public.ai_conversations
    FOR DELETE TO authenticated USING (
        user_id = auth.uid()
    );

-- 5. Index για γρήγορη ανάκτηση ανά χρήστη (ταξινομημένο κατά updated_at)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
    ON public.ai_conversations (user_id, updated_at DESC);
