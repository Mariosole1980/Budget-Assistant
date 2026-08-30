-- ============================================================
-- SQL Migration: Enable Supabase Realtime Broadcasts
-- ============================================================
-- Run this in Supabase SQL Editor to ensure Postgres broadcasts
-- all live inserts, updates, and deletes to open Web and Mobile clients.

-- 1. Enable replication on transactions table
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

-- 2. Add tables to supabase_realtime publication
DO $$
BEGIN
    -- Add transactions to publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'transactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
    END IF;

    -- Add categories to publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'categories'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
    END IF;

    -- Add accounts to publication if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'accounts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
    END IF;
END $$;
