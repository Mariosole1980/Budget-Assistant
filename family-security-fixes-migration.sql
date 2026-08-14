-- ============================================================================
-- Family Security Fixes Migration - Budget Assistant
-- ============================================================================
-- Fixes the 3 CRITICAL security issues identified in the family management
-- system. This file is IDEMPOTENT (safe to re-run).
--
--   FIX 1: Close the admin-by-URL bypass in join_family_group()
--          The 'admin' role can now ONLY be granted via a pending_invitation
--          created by an existing admin. The invite_role_input from the URL
--          can never grant admin privileges.
--
--   FIX 2: Restrict the profiles SELECT policy
--          Previously ANY authenticated user could read ALL profiles (emails,
--          names, premium status). Now a user can only read profiles of
--          members in their OWN family (or their own profile).
--
--   FIX 3: Protect the last admin
--          change_member_role() and kick_family_member() now refuse to
--          demote/remove the LAST admin of a family, preventing a family
--          from being left without a manager.
-- ============================================================================

-- ============================================================================
-- FIX 1: Close the admin-by-URL bypass in join_family_group()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.join_family_group(invite_code_input TEXT, invite_role_input TEXT DEFAULT 'member')
RETURNS BOOLEAN AS $$
DECLARE
    target_family_id UUID;
    r_acc RECORD;
    r_cat RECORD;
    my_email TEXT;
    invited_role TEXT;
    member_count INT;
BEGIN
    -- Find family group
    SELECT id INTO target_family_id
    FROM public.family_groups
    WHERE invite_code = invite_code_input;

    IF target_family_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    -- PREMIUM GATE (server-side, authoritative): Free plan allows up to 2 members
    -- (the creator + 1). Joining a family that is already at the free limit
    -- requires the joining user to have Premium. This cannot be bypassed from
    -- the client.
    SELECT COUNT(*) INTO member_count
    FROM public.profiles
    WHERE family_id = target_family_id;

    IF member_count >= 2 AND NOT COALESCE(
        (SELECT premium_active FROM public.profiles WHERE id = auth.uid()), false
    ) THEN
        RAISE EXCEPTION 'Family member limit reached. Upgrade to Premium to add more members.';
    END IF;

    -- Get my email
    SELECT email INTO my_email FROM public.profiles WHERE id = auth.uid();

    -- SECURITY FIX 1:
    -- The role is resolved ONLY from a pending_invitation created by an
    -- existing admin. The invite_role_input (which comes from the URL query
    -- string) is IGNORED for role assignment. This prevents any user who
    -- obtains the invite code from granting themselves admin via the URL.
    -- If there is no pending invitation for this user, they join as 'member'.
    IF my_email IS NOT NULL THEN
        SELECT role INTO invited_role
        FROM public.pending_invitations
        WHERE family_id = target_family_id AND invited_email = my_email;
    END IF;

    -- Fallback: always 'member' (NEVER use invite_role_input for role)
    IF invited_role IS NULL THEN
        invited_role := 'member';
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


-- ============================================================================
-- FIX 2: Restrict the profiles SELECT policy
-- ============================================================================
-- Old (INSECURE): any authenticated user could read ALL profiles.
--   CREATE POLICY "Allow read-only profile access by email or id"
--       ON public.profiles FOR SELECT TO authenticated USING (true);
--
-- New: a user can only read their OWN profile, or profiles of members in
-- their OWN family. This prevents leaking emails/names/premium status of
-- unrelated users.
DROP POLICY IF EXISTS "Allow read-only profile access by email or id" ON public.profiles;
DROP POLICY IF EXISTS "Allow read own or family profiles" ON public.profiles;
CREATE POLICY "Allow read own or family profiles" ON public.profiles
    FOR SELECT TO authenticated USING (
        id = auth.uid()
        OR (
            family_id IS NOT NULL
            AND family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
        )
    );


-- ============================================================================
-- FIX 3: Protect the last admin
-- ============================================================================

-- 3a. change_member_role(): refuse to demote the LAST admin
CREATE OR REPLACE FUNCTION public.change_member_role(member_id_input UUID, new_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    admin_family_id UUID;
    admin_count INT;
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

    -- SECURITY FIX 3a: If demoting an admin to member, ensure there is at
    -- least one OTHER admin remaining in the family.
    IF new_role = 'member' THEN
        IF EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = member_id_input AND role = 'admin'
        ) THEN
            SELECT count(*) INTO admin_count
            FROM public.profiles
            WHERE family_id = admin_family_id AND role = 'admin';

            IF admin_count <= 1 THEN
                RAISE EXCEPTION 'Cannot demote the last admin. Promote another member to admin first.';
            END IF;
        END IF;
    END IF;

    UPDATE public.profiles
    SET role = new_role
    WHERE id = member_id_input;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3b. kick_family_member(): refuse to remove the LAST admin
CREATE OR REPLACE FUNCTION public.kick_family_member(member_id_input UUID)
RETURNS BOOLEAN AS $$
DECLARE
    admin_family_id UUID;
    admin_count INT;
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

    -- SECURITY FIX 3b: Refuse to kick the last admin of the family.
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = member_id_input AND role = 'admin'
    ) THEN
        SELECT count(*) INTO admin_count
        FROM public.profiles
        WHERE family_id = admin_family_id AND role = 'admin';

        IF admin_count <= 1 THEN
            RAISE EXCEPTION 'Cannot remove the last admin. Promote another member to admin first.';
        END IF;
    END IF;

    UPDATE public.profiles
    SET family_id = NULL, role = 'member'
    WHERE id = member_id_input;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- END OF FAMILY SECURITY FIXES MIGRATION
-- ============================================================================
