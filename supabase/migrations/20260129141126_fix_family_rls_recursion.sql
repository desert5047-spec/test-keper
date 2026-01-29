-- helper function to avoid RLS recursion
create or replace function public.is_family_member(target_family_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_family_id
      and fm.user_id = target_user_id
  );
$$;

revoke all on function public.is_family_member(uuid, uuid) from public;
grant execute on function public.is_family_member(uuid, uuid) to authenticated;

-- update family_members policies to avoid recursion
drop policy if exists "family_members_select_member" on public.family_members;
create policy "family_members_select_member"
on public.family_members
for select
using (public.is_family_member(family_members.family_id, auth.uid()));

drop policy if exists "family_members_insert_owner_or_invited" on public.family_members;
create policy "family_members_insert_owner_or_invited"
on public.family_members
for insert
with check (
  exists (
    select 1
    from public.families f
    where f.id = family_members.family_id
      and f.owner_id = auth.uid()
  )
  or (
    family_members.user_id = auth.uid()
    and exists (
      select 1
      from public.invites i
      where i.family_id = family_members.family_id
        and i.email = auth.email()
        and i.status in ('pending', 'accepted')
    )
  )
);

drop policy if exists "family_members_update_owner" on public.family_members;
create policy "family_members_update_owner"
on public.family_members
for update
using (
  exists (
    select 1
    from public.families f
    where f.id = family_members.family_id
      and f.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.families f
    where f.id = family_members.family_id
      and f.owner_id = auth.uid()
  )
);

drop policy if exists "family_members_delete_owner" on public.family_members;
create policy "family_members_delete_owner"
on public.family_members
for delete
using (
  exists (
    select 1
    from public.families f
    where f.id = family_members.family_id
      and f.owner_id = auth.uid()
  )
);

-- update children policies to use helper function
drop policy if exists "children_select_family" on public.children;
create policy "children_select_family"
on public.children
for select
using (public.is_family_member(children.family_id, auth.uid()));

drop policy if exists "children_insert_family" on public.children;
create policy "children_insert_family"
on public.children
for insert
with check (public.is_family_member(children.family_id, auth.uid()));

drop policy if exists "children_update_family" on public.children;
create policy "children_update_family"
on public.children
for update
using (public.is_family_member(children.family_id, auth.uid()))
with check (public.is_family_member(children.family_id, auth.uid()));

drop policy if exists "children_delete_family" on public.children;
create policy "children_delete_family"
on public.children
for delete
using (public.is_family_member(children.family_id, auth.uid()));

-- update records policies to use helper function
drop policy if exists "records_select_family" on public.records;
create policy "records_select_family"
on public.records
for select
using (public.is_family_member(records.family_id, auth.uid()));

drop policy if exists "records_insert_family" on public.records;
create policy "records_insert_family"
on public.records
for insert
with check (public.is_family_member(records.family_id, auth.uid()));

drop policy if exists "records_update_family" on public.records;
create policy "records_update_family"
on public.records
for update
using (public.is_family_member(records.family_id, auth.uid()))
with check (public.is_family_member(records.family_id, auth.uid()));

drop policy if exists "records_delete_family" on public.records;
create policy "records_delete_family"
on public.records
for delete
using (public.is_family_member(records.family_id, auth.uid()));

-- update families policies to use helper function
drop policy if exists "families_select_member" on public.families;
create policy "families_select_member"
on public.families
for select
using (public.is_family_member(families.id, auth.uid()));
