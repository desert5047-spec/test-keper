-- invites: token + expires_at
alter table if exists public.invites
  add column if not exists token text,
  add column if not exists expires_at timestamptz;

create unique index if not exists invites_token_unique_idx
  on public.invites (token);

-- helper: owner check (security definer to bypass RLS)
create or replace function public.is_family_owner(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.families f
    where f.id = target_family_id
      and f.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_family_owner(uuid) from public;
grant execute on function public.is_family_owner(uuid) to authenticated;

-- RPC: create_invite
create or replace function public.create_invite(invited_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_existing_token text;
  v_token text;
begin
  select f.id
  into v_family_id
  from public.families f
  where f.owner_id = auth.uid()
  limit 1;

  if v_family_id is null or not public.is_family_owner(v_family_id) then
    raise exception 'owner_only';
  end if;

  select i.token
  into v_existing_token
  from public.invites i
  where i.family_id = v_family_id
    and lower(i.email) = lower(invited_email)
    and i.status = 'pending'
    and (i.expires_at is null or i.expires_at > now())
  order by i.created_at desc
  limit 1;

  if v_existing_token is not null then
    return v_existing_token;
  end if;

  v_token := encode(gen_random_bytes(12), 'hex'); -- 24 chars

  insert into public.invites (family_id, email, invited_by, status, created_at, token, expires_at)
  values (v_family_id, invited_email, auth.uid(), 'pending', now(), v_token, now() + interval '7 days');

  return v_token;
end;
$$;

revoke all on function public.create_invite(text) from public;
grant execute on function public.create_invite(text) to authenticated;

-- RPC: accept_invite
create or replace function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_user_email text;
begin
  v_user_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_user_email = '' then
    raise exception 'email_not_found';
  end if;

  select *
  into v_invite
  from public.invites i
  where i.token = invite_token
    and i.status = 'pending'
    and (i.expires_at is null or i.expires_at > now())
  limit 1;

  if v_invite.id is null then
    raise exception 'invalid_or_expired';
  end if;

  if lower(v_invite.email) <> v_user_email then
    raise exception 'email_mismatch';
  end if;

  insert into public.family_members (family_id, user_id, role, created_at)
  values (v_invite.family_id, auth.uid(), 'member', now())
  on conflict (family_id, user_id)
  do update set role = family_members.role;

  update public.invites
  set status = 'accepted',
      accepted_at = now()
  where id = v_invite.id;

  return v_invite.family_id;
end;
$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;

-- RPC: list_invites (owner only)
create or replace function public.list_invites()
returns table (
  token text,
  email text,
  created_at timestamptz,
  expires_at timestamptz,
  status text
)
language sql
security definer
set search_path = public
as $$
  select i.token, i.email, i.created_at, i.expires_at, i.status
  from public.invites i
  where i.family_id = (
    select f.id
    from public.families f
    where f.owner_id = auth.uid()
    limit 1
  )
    and i.status = 'pending'
  order by i.created_at desc;
$$;

revoke all on function public.list_invites() from public;
grant execute on function public.list_invites() to authenticated;
