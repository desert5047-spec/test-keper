create or replace function public.update_family_display_name(
  target_family_id uuid,
  new_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if new_display_name is not null
    and (char_length(new_display_name) < 1 or char_length(new_display_name) > 4) then
    raise exception 'invalid_display_name';
  end if;

  if not public.is_family_member(target_family_id, auth.uid()) then
    raise exception 'not_family_member';
  end if;

  update public.family_members
  set display_name = new_display_name
  where family_id = target_family_id
    and user_id = auth.uid();

  if not found then
    raise exception 'member_not_found';
  end if;
end;
$$;

revoke all on function public.update_family_display_name(uuid, text) from public;
grant execute on function public.update_family_display_name(uuid, text) to authenticated;
