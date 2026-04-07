-- ============================================================
-- link_employer_on_login() — called from employer portal on each login
-- Links the authenticated user to their employer group via admin_email.
-- Same pattern as link_sponsor_on_login for rewards partners.
-- ============================================================

CREATE OR REPLACE FUNCTION link_employer_on_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Get the authenticated user's email
  v_email := (SELECT email FROM auth.users WHERE id = auth.uid());

  IF v_email IS NULL THEN
    RETURN;
  END IF;

  -- Link this auth user to their group if not already linked
  UPDATE groups
  SET user_id = auth.uid(),
      updated_at = now()
  WHERE admin_email = v_email
    AND user_id IS NULL;
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION link_employer_on_login() TO authenticated;
