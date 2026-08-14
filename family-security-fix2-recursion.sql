CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID AS $$
DECLARE
    my_family_id UUID;
BEGIN
    SELECT family_id INTO my_family_id
    FROM public.profiles
    WHERE id = auth.uid();
    RETURN my_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Allow read-only profile access by email or id" ON public.profiles;
DROP POLICY IF EXISTS "Allow read own or family profiles" ON public.profiles;
CREATE POLICY "Allow read own or family profiles" ON public.profiles
    FOR SELECT TO authenticated USING (
        id = auth.uid()
        OR (
            family_id IS NOT NULL
            AND family_id = public.get_my_family_id()
        )
    );
