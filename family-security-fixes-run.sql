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
    SELECT id INTO target_family_id
    FROM public.family_groups
    WHERE invite_code = invite_code_input;

    IF target_family_id IS NULL THEN
        RAISE EXCEPTION 'Invalid invite code';
    END IF;

    SELECT COUNT(*) INTO member_count
    FROM public.profiles
    WHERE family_id = target_family_id;

    IF member_count >= 2 AND NOT COALESCE(
        (SELECT premium_active FROM public.profiles WHERE id = auth.uid()), false
    ) THEN
        RAISE EXCEPTION 'Family member limit reached. Upgrade to Premium to add more members.';
    END IF;

    SELECT email INTO my_email FROM public.profiles WHERE id = auth.uid();

    IF my_email IS NOT NULL THEN
        SELECT role INTO invited_role
        FROM public.pending_invitations
        WHERE family_id = target_family_id AND invited_email = my_email;
    END IF;

    IF invited_role IS NULL THEN
        invited_role := 'member';
    END IF;

    IF invited_role NOT IN ('admin', 'member') THEN
        invited_role := 'member';
    END IF;

    UPDATE public.profiles
    SET family_id = target_family_id, role = invited_role
    WHERE id = auth.uid();

    FOR r_acc IN (SELECT * FROM public.accounts WHERE user_id = auth.uid() AND family_id IS NULL) LOOP
        IF EXISTS (SELECT 1 FROM public.accounts WHERE family_id = target_family_id AND name = r_acc.name) THEN
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

    FOR r_cat IN (SELECT * FROM public.categories WHERE user_id = auth.uid() AND family_id IS NULL) LOOP
        IF EXISTS (SELECT 1 FROM public.categories WHERE family_id = target_family_id AND name = r_cat.name AND type = r_cat.type) THEN
            UPDATE public.transactions
            SET category = r_cat.name
            WHERE user_id = auth.uid() AND category = r_cat.name AND type = r_cat.type;

            DELETE FROM public.categories WHERE id = r_cat.id;
        ELSE
            UPDATE public.categories SET family_id = target_family_id WHERE id = r_cat.id;
        END IF;
    END LOOP;

    UPDATE public.transactions SET family_id = target_family_id WHERE user_id = auth.uid() AND family_id IS NULL;

    IF my_email IS NOT NULL THEN
        DELETE FROM public.pending_invitations WHERE family_id = target_family_id AND invited_email = my_email;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
