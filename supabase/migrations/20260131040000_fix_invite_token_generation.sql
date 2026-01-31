-- fix: token generation without gen_random_bytes
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
  v_try int := 0;
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

  loop
    v_try := v_try + 1;
    v_token := substring(
      md5(random()::text || clock_timestamp()::text || auth.uid()::text),
      1,
      24
    );
    exit when not exists (select 1 from public.invites i where i.token = v_token) or v_try >= 5;
  end loop;

  insert into public.invites (family_id, email, invited_by, status, created_at, token, expires_at)
  values (v_family_id, invited_email, auth.uid(), 'pending', now(), v_token, now() + interval '7 days');

  return v_token;
end;
$$;

revoke all on function public.create_invite(text) from public;
grant execute on function public.create_invite(text) to authenticated;
