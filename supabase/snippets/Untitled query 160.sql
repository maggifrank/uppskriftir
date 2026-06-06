-- ============================================================
-- UPPSKRIFTIR — Supabase setup (hardened)
-- Run in: supabase.com → your project → SQL Editor → New query
--
-- After running this, go to:
-- Table Editor → admin_users → Insert row
-- Add ONE row: { email: "you@example.com", is_super: true }
-- That's the only time you need the Supabase dashboard.
-- All user management after that is done from /admin.html.
-- ============================================================

-- ── 1. Recipes table ─────────────────────────────────────────
create table if not exists recipes (
  id          text primary key,
  title       text not null,
  category    text,
  data        jsonb not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 2. Admin allowlist ───────────────────────────────────────
create table if not exists admin_users (
  email    text primary key,
  is_super boolean not null default false
);

-- ── 3. Auto-update updated_at ────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger recipes_updated_at
  before update on recipes
  for each row execute function update_updated_at();

-- ── 4. Helper functions (security definer) ───────────────────

-- Is the current user in the admin allowlist?
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from admin_users
    where email = (select email from auth.users where id = auth.uid())
  );
$$ language sql security definer stable;

-- Is the current user the super admin?
create or replace function is_super_admin()
returns boolean as $$
  select exists (
    select 1 from admin_users
    where email = (select email from auth.users where id = auth.uid())
      and is_super = true
  );
$$ language sql security definer stable;

-- Add a user to the allowlist — only callable by super admin.
-- Returns 'ok', 'already_exists', or 'forbidden'.
create or replace function add_admin_user(target_email text)
returns text as $$
begin
  if not is_super_admin() then
    return 'forbidden';
  end if;
  if exists (select 1 from admin_users where email = target_email) then
    return 'already_exists';
  end if;
  insert into admin_users (email, is_super) values (target_email, false);
  return 'ok';
end;
$$ language plpgsql security definer;

-- Remove a user from the allowlist — only callable by super admin.
-- Cannot remove yourself or another super admin.
-- Returns 'ok', 'forbidden', 'cannot_remove_self', 'cannot_remove_super', or 'not_found'.
create or replace function remove_admin_user(target_email text)
returns text as $$
declare
  current_email text;
  target_is_super boolean;
begin
  if not is_super_admin() then
    return 'forbidden';
  end if;

  select email into current_email
    from auth.users where id = auth.uid();

  if target_email = current_email then
    return 'cannot_remove_self';
  end if;

  select is_super into target_is_super
    from admin_users where email = target_email;

  if not found then
    return 'not_found';
  end if;

  if target_is_super then
    return 'cannot_remove_super';
  end if;

  delete from admin_users where email = target_email;
  return 'ok';
end;
$$ language plpgsql security definer;

-- List all admin users — only callable by super admin.
create or replace function list_admin_users()
returns table(email text, is_super boolean) as $$
begin
  if not is_super_admin() then
    return;
  end if;
  return query select a.email, a.is_super from admin_users a order by a.email;
end;
$$ language plpgsql security definer;

-- ── 5. Revoke all default public access ──────────────────────
revoke all on recipes     from anon, authenticated;
revoke all on admin_users from anon, authenticated;

grant select, insert, update, delete on recipes to authenticated;
grant select                          on recipes to anon;

-- Grant execute on the safe RPC functions only
grant execute on function is_admin()                    to authenticated;
grant execute on function is_super_admin()              to authenticated;
grant execute on function add_admin_user(text)          to authenticated;
grant execute on function remove_admin_user(text)       to authenticated;
grant execute on function list_admin_users()            to authenticated;

-- ── 6. Row-level security on recipes ─────────────────────────
alter table recipes enable row level security;

create policy "Public read"
  on recipes for select using (true);

create policy "Admin insert"
  on recipes for insert to authenticated
  with check (is_admin() and auth.uid() = created_by);

create policy "Owner update"
  on recipes for update to authenticated
  using  (is_admin() and auth.uid() = created_by)
  with check (is_admin() and auth.uid() = created_by);

create policy "Owner delete"
  on recipes for delete to authenticated
  using (is_admin() and auth.uid() = created_by);

-- ── 7. RLS on admin_users — fully locked via API ─────────────
alter table admin_users enable row level security;
-- No policies = deny all via API.
-- Access is only through the security definer functions above.

-- ── 8. Block non-allowlisted signups at the auth level ───────
create or replace function block_non_admin_signup()
returns trigger as $$
begin
  if not exists (select 1 from admin_users where email = new.email) then
    raise exception 'Skráning ekki leyfð fyrir þetta netfang.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger enforce_admin_allowlist
  before insert on auth.users
  for each row execute function block_non_admin_signup();

-- ── 9. Supabase Storage bucket for recipe images ─────────────
-- Run this after the rest of the setup.
-- Creates a public bucket (images are readable by anyone via URL)
-- but only authenticated admins can upload or delete.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,                             -- public read via CDN URL
  5242880,                          -- 5 MB per file
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- Anyone can read (download) images
create policy "Public image read"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

-- Only admins can upload
create policy "Admin image upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and is_admin()
  );

-- Only admins can delete their own uploads
create policy "Admin image delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and is_admin()
  );
