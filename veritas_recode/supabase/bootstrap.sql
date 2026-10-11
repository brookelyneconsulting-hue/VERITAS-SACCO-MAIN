-- After creating your first account in the application, find its UUID in
-- Authentication > Users and run this statement to make that account the
-- Veritas platform owner.
-- Replace only the UUID below.

update public.profiles
set role = 'admin',
    is_platform_admin = true,
    account_status = 'approved',
    institution_id = null,
    institution_name = null
where id = 'PUT-FIRST-USER-UUID-HERE';
