-- accept_invite: accepted重複がある場合は安全に復帰
create or replace function public.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_user_email text;
  v_existing_accepted record;
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

  select i.id
  into v_existing_accepted
  from public.invites i
  where i.family_id = v_invite.family_id
    and lower(i.email) = v_user_email
    and i.status = 'accepted'
  limit 1;

  if v_existing_accepted.id is not null then
    update public.invites
    set status = 'revoked'
    where id = v_invite.id;
    return v_invite.family_id;
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
