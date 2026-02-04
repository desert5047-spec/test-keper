-- get_my_family_id: 自分の family_id を安全に取得する
create or replace function public.get_my_family_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select fm.family_id
  from public.family_members fm
  where fm.user_id = auth.uid()
  order by fm.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_family_id() from public;
grant execute on function public.get_my_family_id() to authenticated;
