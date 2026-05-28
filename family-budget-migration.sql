-- ============================================================
-- SQL Migration: Οικογενειακός Προϋπολογισμός (Family Budgeting)
-- ============================================================

-- 1. Create Family Groups table
CREATE TABLE IF NOT EXISTS public.family_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL DEFAULT upper(substring(md5(random()::text) from 1 for 6)),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Pending Invitations table
CREATE TABLE IF NOT EXISTS public.pending_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
    invited_email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (family_id, invited_email)
);

-- 3. Modify Profiles table & pending_invitations table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member';
ALTER TABLE public.pending_invitations ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member';

-- 4. Modify Transactions, Accounts, and Categories tables
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL;

-- 5. Modify Uniqueness Constraints using Partial Indexes (handles both family & individual modes)
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_user_id_name_key;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_type_key;

DROP INDEX IF EXISTS public.accounts_family_name_idx;
DROP INDEX IF EXISTS public.accounts_user_name_idx;
DROP INDEX IF EXISTS public.categories_family_name_type_idx;
DROP INDEX IF EXISTS public.categories_user_name_type_idx;

CREATE UNIQUE INDEX accounts_family_name_idx ON public.accounts (family_id, name) WHERE family_id IS NOT NULL;
CREATE UNIQUE INDEX accounts_user_name_idx ON public.accounts (user_id, name) WHERE family_id IS NULL;

CREATE UNIQUE INDEX categories_family_name_type_idx ON public.categories (family_id, name, type) WHERE family_id IS NOT NULL;
CREATE UNIQUE INDEX categories_user_name_type_idx ON public.categories (user_id, name, type) WHERE family_id IS NULL;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies for Profiles
DROP POLICY IF EXISTS "Allow read-only profile access by email or id" ON public.profiles;
CREATE POLICY "Allow read-only profile access by email or id" ON public.profiles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow user or family admin update" ON public.profiles;
CREATE POLICY "Allow user or family admin update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        id = auth.uid()
        OR 
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.family_id = profiles.family_id 
              AND p.role = 'admin'
        )
    )
    WITH CHECK (
        id = auth.uid()
        OR 
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() 
              AND p.family_id = profiles.family_id 
              AND p.role = 'admin'
        )
    );

-- 8. Define RLS Policies for Family Groups
DROP POLICY IF EXISTS "Allow members to read family group" ON public.family_groups;
CREATE POLICY "Allow members to read family group" ON public.family_groups
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND family_id = family_groups.id
        )
        OR invite_code IS NOT NULL -- Allow lookup by invite code before joining
    );

-- 9. Define RLS Policies for Pending Invitations
DROP POLICY IF EXISTS "Allow select pending invitations" ON public.pending_invitations;
CREATE POLICY "Allow select pending invitations" ON public.pending_invitations
    FOR SELECT TO authenticated USING (
        invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
        OR invited_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND family_id = pending_invitations.family_id AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Allow insert pending invitations" ON public.pending_invitations;
CREATE POLICY "Allow insert pending invitations" ON public.pending_invitations
    FOR INSERT TO authenticated WITH CHECK (
        invited_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND family_id = pending_invitations.family_id AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Allow delete pending invitations" ON public.pending_invitations;
CREATE POLICY "Allow delete pending invitations" ON public.pending_invitations
    FOR DELETE TO authenticated USING (
        invited_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
        OR invited_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND family_id = pending_invitations.family_id AND role = 'admin'
        )
    );

-- 10. Define RLS Policies for Transactions
DROP POLICY IF EXISTS "Allow user and partner access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow select transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow delete transactions" ON public.transactions;

CREATE POLICY "Allow select transactions" ON public.transactions
    FOR SELECT TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Allow insert transactions" ON public.transactions
    FOR INSERT TO authenticated WITH CHECK (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid())
        OR (family_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Allow update transactions" ON public.transactions
    FOR UPDATE TO authenticated USING (
        (
            family_id IS NOT NULL 
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (
                (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
                OR user_id = auth.uid()
            )
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Allow delete transactions" ON public.transactions
    FOR DELETE TO authenticated USING (
        (
            family_id IS NOT NULL 
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (
                (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
                OR user_id = auth.uid()
            )
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

-- 11. Define RLS Policies for Accounts
DROP POLICY IF EXISTS "Allow user and partner access to accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow select accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow delete accounts" ON public.accounts;

CREATE POLICY "Allow select accounts" ON public.accounts
    FOR SELECT TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Allow insert accounts" ON public.accounts
    FOR INSERT TO authenticated WITH CHECK (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid())
        OR (family_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Allow update accounts" ON public.accounts
    FOR UPDATE TO authenticated USING (
        (
            family_id IS NOT NULL 
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Allow delete accounts" ON public.accounts
    FOR DELETE TO authenticated USING (
        (
            family_id IS NOT NULL 
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

-- 12. Define RLS Policies for Categories
DROP POLICY IF EXISTS "Allow user and partner access to categories" ON public.categories;
DROP POLICY IF EXISTS "Allow select categories" ON public.categories;
DROP POLICY IF EXISTS "Allow insert categories" ON public.categories;
DROP POLICY IF EXISTS "Allow update categories" ON public.categories;
DROP POLICY IF EXISTS "Allow delete categories" ON public.categories;

CREATE POLICY "Allow select categories" ON public.categories
    FOR SELECT TO authenticated USING (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()))
        OR (family_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Allow insert categories" ON public.categories
    FOR INSERT TO authenticated WITH CHECK (
        (family_id IS NOT NULL AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid())
        OR (family_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Allow update categories" ON public.categories
    FOR UPDATE TO authenticated USING (
        (
            family_id IS NOT NULL 
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );

CREATE POLICY "Allow delete categories" ON public.categories
    FOR DELETE TO authenticated USING (
        (
            family_id IS NOT NULL 
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
        OR (family_id IS NULL AND user_id = auth.uid())
    );


-- ============================================================
-- 13. RPC FUNCTIONS FOR MUTATIONS
-- ============================================================

-- A. Create Family Group
CREATE OR REPLACE FUNCTION public.create_family_group(group_name TEXT)
RETURNS UUID AS $$
DECLARE
    new_family_id UUID;
    invite_code_val TEXT;
BEGIN
    -- Generate unique invite code
    LOOP
        invite_code_val := upper(substring(md5(random()::text) from 1 for 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.family_groups WHERE invite_code = invite_code_val);
    END LOOP;

    -- Create family group
    INSERT INTO public.family_groups (name, invite_code)
    VALUES (group_name, invite_code_val)
    RETURNING id INTO new_family_id;

    -- Update creator profile
    UPDATE public.profiles
    SET family_id = new_family_id, role = 'admin'
    WHERE id = auth.uid();

    -- Migrate creator's existing transactions, accounts, and categories to the family
    UPDATE public.transactions SET family_id = new_family_id WHERE user_id = auth.uid() AND family_id IS NULL;
    UPDATE public.accounts SET family_id = new_family_id WHERE user_id = auth.uid() AND family_id IS NULL;
    UPDATE public.categories SET family_id = new_family_id WHERE user_id = auth.uid() AND family_id IS NULL;

    RETURN new_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Join Family Group
CREATE OR REPLACE FUNCTION public.join_family_group(invite_code_input TEXT, invite_role_input TEXT DEFAULT 'member')
RETURNS BOOLEAN AS $$
DECLARE
    target_family_id UUID;
    r_acc RECORD;
    r_cat RECORD;
    my_email TEXT;
    invited_role TEXT;
BEGIN
    -- Find family group
    SELECT id INTO target_family_id
    FROM public.family_groups
    WHERE invite_code = invite_code_input;

    IF target_family_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    -- Get my email
    SELECT email INTO my_email FROM public.profiles WHERE id = auth.uid();

    -- Resolve role: check pending_invitations first, then fallback to invite_role_input, default to 'member'
    IF my_email IS NOT NULL THEN
        SELECT role INTO invited_role 
        FROM public.pending_invitations 
        WHERE family_id = target_family_id AND invited_email = my_email;
    END IF;

    IF invited_role IS NULL THEN
        invited_role := COALESCE(invite_role_input, 'member');
    END IF;

    IF invited_role NOT IN ('admin', 'member') THEN
        invited_role := 'member';
    END IF;

    -- Update user profile
    UPDATE public.profiles
    SET family_id = target_family_id, role = invited_role
    WHERE id = auth.uid();

    -- Safe merge of accounts
    FOR r_acc IN (SELECT * FROM public.accounts WHERE user_id = auth.uid() AND family_id IS NULL) LOOP
        IF EXISTS (SELECT 1 FROM public.accounts WHERE family_id = target_family_id AND name = r_acc.name) THEN
            -- Map transactions
            UPDATE public.transactions 
            SET account_from = r_acc.name 
            WHERE user_id = auth.uid() AND account_from = r_acc.name;
            
            UPDATE public.transactions 
            SET account_to = r_acc.name 
            WHERE user_id = auth.uid() AND account_to = r_acc.name;
            
            DELETE FROM public.accounts WHERE id = r_acc.id;
        ELSE
            UPDATE public.accounts SET family_id = target_family_id WHERE id = r_acc.id;
        END IF;
    END LOOP;

    -- Safe merge of categories
    FOR r_cat IN (SELECT * FROM public.categories WHERE user_id = auth.uid() AND family_id IS NULL) LOOP
        IF EXISTS (SELECT 1 FROM public.categories WHERE family_id = target_family_id AND name = r_cat.name AND type = r_cat.type) THEN
            -- Map transactions
            UPDATE public.transactions 
            SET category = r_cat.name 
            WHERE user_id = auth.uid() AND category = r_cat.name AND type = r_cat.type;
            
            DELETE FROM public.categories WHERE id = r_cat.id;
        ELSE
            UPDATE public.categories SET family_id = target_family_id WHERE id = r_cat.id;
        END IF;
    END LOOP;

    -- Move remaining transactions
    UPDATE public.transactions SET family_id = target_family_id WHERE user_id = auth.uid() AND family_id IS NULL;

    -- Delete pending invitations
    IF my_email IS NOT NULL THEN
        DELETE FROM public.pending_invitations WHERE family_id = target_family_id AND invited_email = my_email;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- C. Leave Family Group
CREATE OR REPLACE FUNCTION public.leave_family_group()
RETURNS BOOLEAN AS $$
DECLARE
    old_family_id UUID;
    admin_count INT;
BEGIN
    SELECT family_id INTO old_family_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF old_family_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admin safeguards
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        SELECT count(*) INTO admin_count
        FROM public.profiles
        WHERE family_id = old_family_id AND role = 'admin';

        IF admin_count = 1 THEN
            -- If last admin, they can't leave if there are other members
            IF EXISTS (SELECT 1 FROM public.profiles WHERE family_id = old_family_id AND id <> auth.uid()) THEN
                RAISE EXCEPTION 'You are the last admin. Promote another member to admin before leaving.';
            ELSE
                -- Delete family group if empty
                UPDATE public.profiles SET family_id = NULL, role = 'member' WHERE id = auth.uid();
                DELETE FROM public.family_groups WHERE id = old_family_id;
                RETURN TRUE;
            END IF;
        END IF;
    END IF;

    -- Leave group
    UPDATE public.profiles
    SET family_id = NULL, role = 'member'
    WHERE id = auth.uid();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- D. Kick Member
CREATE OR REPLACE FUNCTION public.kick_family_member(member_id_input UUID)
RETURNS BOOLEAN AS $$
DECLARE
    admin_family_id UUID;
BEGIN
    SELECT family_id INTO admin_family_id
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin';

    IF admin_family_id IS NULL THEN
        RAISE EXCEPTION 'Only family admins can kick members.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = member_id_input AND family_id = admin_family_id
    ) THEN
        RAISE EXCEPTION 'User does not belong to your family group.';
    END IF;

    UPDATE public.profiles
    SET family_id = NULL, role = 'member'
    WHERE id = member_id_input;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- E. Change Member Role
CREATE OR REPLACE FUNCTION public.change_member_role(member_id_input UUID, new_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    admin_family_id UUID;
BEGIN
    SELECT family_id INTO admin_family_id
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin';

    IF admin_family_id IS NULL THEN
        RAISE EXCEPTION 'Only family admins can change member roles.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = member_id_input AND family_id = admin_family_id
    ) THEN
        RAISE EXCEPTION 'User does not belong to your family group.';
    END IF;

    IF new_role NOT IN ('admin', 'member') THEN
        RAISE EXCEPTION 'Invalid role.';
    END IF;

    UPDATE public.profiles
    SET role = new_role
    WHERE id = member_id_input;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 14. AUTO-MIGRATE PARTNERS TO FAMILY GROUPS
-- ============================================================
DO $$
DECLARE
    r RECORD;
    new_fam_id UUID;
    invite_code_val TEXT;
BEGIN
    FOR r IN 
        SELECT p1.id AS u1_id, p1.email AS u1_email, p2.id AS u2_id, p2.email AS u2_email
        FROM public.profiles p1
        JOIN public.profiles p2 ON p1.partner_id = p2.id
        WHERE p1.family_id IS NULL AND p2.family_id IS NULL AND p1.id < p2.id
    LOOP
        -- Generate unique invite code
        LOOP
            invite_code_val := upper(substring(md5(random()::text) from 1 for 6));
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.family_groups WHERE invite_code = invite_code_val);
        END LOOP;

        -- Create family group
        INSERT INTO public.family_groups (name, invite_code)
        VALUES ('Οικογένεια ' || split_part(r.u1_email, '@', 1), invite_code_val)
        RETURNING id INTO new_fam_id;

        -- Update profiles
        UPDATE public.profiles SET family_id = new_fam_id, role = 'admin' WHERE id IN (r.u1_id, r.u2_id);

        -- Migrate data
        UPDATE public.transactions SET family_id = new_fam_id WHERE user_id IN (r.u1_id, r.u2_id);
        
        -- Safe migrate accounts
        BEGIN
            UPDATE public.accounts SET family_id = new_fam_id WHERE user_id = r.u1_id;
        EXCEPTION WHEN OTHERS THEN
        END;
        BEGIN
            UPDATE public.accounts SET family_id = new_fam_id WHERE user_id = r.u2_id;
        EXCEPTION WHEN OTHERS THEN
        END;

        -- Safe migrate categories
        BEGIN
            UPDATE public.categories SET family_id = new_fam_id WHERE user_id = r.u1_id;
        EXCEPTION WHEN OTHERS THEN
        END;
        BEGIN
            UPDATE public.categories SET family_id = new_fam_id WHERE user_id = r.u2_id;
        EXCEPTION WHEN OTHERS THEN
        END;
    END LOOP;
END;
$$;

-- 15. RPC Function to rename family group
CREATE OR REPLACE FUNCTION public.rename_family_group(new_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    admin_family_id UUID;
BEGIN
    -- Check if user is admin of their family
    SELECT family_id INTO admin_family_id
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin';

    IF admin_family_id IS NULL THEN
        RAISE EXCEPTION 'Only family admins can rename the family group.';
    END IF;

    IF new_name IS NULL OR trim(new_name) = '' THEN
        RAISE EXCEPTION 'Group name cannot be empty.';
    END IF;

    UPDATE public.family_groups
    SET name = trim(new_name)
    WHERE id = admin_family_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
