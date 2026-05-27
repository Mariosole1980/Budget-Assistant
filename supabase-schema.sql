-- Supabase SQL Schema for Realbyte Money Manager Clone

-- Drop tables if they exist
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.accounts;
DROP TABLE IF EXISTS public.categories;

-- Create Accounts Table
CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'card', 'investment')),
    balance NUMERIC NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pre-populate default Accounts (matching user's screenshots)
INSERT INTO public.accounts (name, type, balance) VALUES
('Cash', 'cash', 5494.96),
('Bank Account', 'bank', 36351.31),
('Card', 'card', -18492.81),
('ETF, ΜΕΤΟΧΕΣ', 'investment', 0.0)
ON CONFLICT (name) DO UPDATE SET balance = EXCLUDED.balance;

-- Create Categories Table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    icon TEXT, -- emoji or fontawesome string
    color TEXT, -- hex code for UI visualization
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (name, type)
);

-- Pre-populate categories (matching screenshots and common ones)
INSERT INTO public.categories (name, type, icon, color) VALUES
-- Expenses
('ΣΠΙΤΙ', 'expense', '🏠', '#ff5b5b'),
('ΔΙΑΤΡΟΦΗ', 'expense', '🛒', '#ffa726'),
('ΓΡΑΦΕΙΟ Β2', 'expense', '🏢', '#ffd54f'),
('ΑΥΤΟΚΙΝΗΤΟ', 'expense', '🚗', '#ffee58'),
('ΥΓΕΙΑ', 'expense', '💖', '#66bb6a'),
('ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ', 'expense', '🎉', '#26a69a'),
('ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ', 'expense', '📄', '#26c6da'),
('ΓΥΜΝΑΣΤΗΡΙΟ', 'expense', '🏋️', '#42a5f5'),
('ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ', 'expense', '👕', '#7e57c2'),
('ΜΕΤΑΚΙΝΗΣΗ', 'expense', '🚇', '#ab47bc'),
('ΑΛΛΑ ΕΞΟΔΑ', 'expense', '💸', '#78909c'),
-- Incomes
('ΜΙΣΘΟΣ', 'income', '💰', '#4caf50'),
('ΕΠΕΝΔΥΣΕΙΣ', 'income', '📈', '#2196f3'),
('ΕΠΙΣΤΡΟΦΗ ΦΟΡΟΥ', 'income', '💵', '#009688'),
('ΑΛΛΑ ΕΣΟΔΑ', 'income', '🏷️', '#9e9e9e')
ON CONFLICT (name, type) DO NOTHING;

-- Create Transactions Table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC(12,2) NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    account_from TEXT NOT NULL, -- The account debited (or source account)
    account_to TEXT,           -- The account credited (only used for transfers)
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) and define public access policies to avoid RLS violations
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- In case RLS is enabled manually, these policies guarantee public access via Anon key
DROP POLICY IF EXISTS "Allow public select" ON public.transactions;
DROP POLICY IF EXISTS "Allow public insert" ON public.transactions;
DROP POLICY IF EXISTS "Allow public update" ON public.transactions;
DROP POLICY IF EXISTS "Allow public delete" ON public.transactions;
CREATE POLICY "Allow public select" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.transactions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public select" ON public.accounts;
DROP POLICY IF EXISTS "Allow public insert" ON public.accounts;
DROP POLICY IF EXISTS "Allow public update" ON public.accounts;
DROP POLICY IF EXISTS "Allow public delete" ON public.accounts;
CREATE POLICY "Allow public select" ON public.accounts FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.accounts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.accounts FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public select" ON public.categories;
DROP POLICY IF EXISTS "Allow public insert" ON public.categories;
DROP POLICY IF EXISTS "Allow public update" ON public.categories;
DROP POLICY IF EXISTS "Allow public delete" ON public.categories;
CREATE POLICY "Allow public select" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.categories FOR DELETE USING (true);

-- Insert some sample transactions to pre-populate and show visual correctness (May 2026, matching screenshot)
INSERT INTO public.transactions (date, type, amount, category, account_from, note) VALUES
('2026-05-15', 'expense', 1230.20, 'ΣΠΙΤΙ', 'Bank Account', 'Ενοίκιο & Κοινόχρηστα'),
('2026-05-18', 'expense', 578.61, 'ΔΙΑΤΡΟΦΗ', 'Card', 'Σούπερ Μάρκετ'),
('2026-05-19', 'expense', 472.68, 'ΓΡΑΦΕΙΟ Β2', 'Bank Account', 'Έξοδα Γραφείου'),
('2026-05-20', 'expense', 433.84, 'ΑΥΤΟΚΙΝΗΤΟ', 'Card', 'Βενζίνη & Service'),
('2026-05-21', 'expense', 276.11, 'ΥΓΕΙΑ', 'Card', 'Φαρμακείο'),
('2026-05-22', 'expense', 153.00, 'ΔΙΑΣΚΕΔΑΣΗ/ΕΞΟΔΟΙ', 'Cash', 'Εστιατόριο'),
('2026-05-23', 'expense', 92.74, 'ΦΟΡΟΙ/ΛΟΓΙΣΤΗΣ', 'Bank Account', 'Αμοιβή Λογιστή'),
('2026-05-23', 'expense', 35.00, 'ΓΥΜΝΑΣΤΗΡΙΟ', 'Card', 'Μηνιαία Συνδρομή'),
('2026-05-24', 'expense', 34.48, 'ΠΡΟΣΩΠΙΚΗ ΦΡΟΝΤΙΔΑ', 'Cash', 'Κούρεμα'),
('2026-05-24', 'expense', 27.00, 'ΜΕΤΑΚΙΝΗΣΗ', 'Cash', 'Εισιτήρια'),
('2026-05-01', 'income', 3921.22, 'ΜΙΣΘΟΣ', 'Bank Account', 'Μισθοδοσία Μαΐου');
