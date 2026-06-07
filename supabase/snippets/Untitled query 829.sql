grant select on admin_users to supabase_auth_admin;
alter function block_non_admin_signup() owner to supabase_auth_admin;drop trigger if exists enforce_admin_allowlist on auth.users;