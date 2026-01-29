-- families
alter table if exists public.families enable row level security;

create policy "families_select_member"
on public.families
for select
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = families.id
      and fm.user_id = auth.uid()
  )
);

create policy "families_insert_owner"
on public.families
for insert
with check (owner_id = auth.uid());

create policy "families_update_owner"
on public.families
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "families_delete_owner"
on public.families
for delete
using (owner_id = auth.uid());

-- family_members
alter table if exists public.family_members enable row level security;

create policy "family_members_select_member"
on public.family_members
for select
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = family_members.family_id
      and fm.user_id = auth.uid()
  )
);

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

-- invites
alter table if exists public.invites enable row level security;

create policy "invites_select_owner"
on public.invites
for select
using (
  exists (
    select 1
    from public.families f
    where f.id = invites.family_id
      and f.owner_id = auth.uid()
  )
);

create policy "invites_select_invited"
on public.invites
for select
using (invites.email = auth.email());

create policy "invites_insert_owner"
on public.invites
for insert
with check (
  exists (
    select 1
    from public.families f
    where f.id = invites.family_id
      and f.owner_id = auth.uid()
  )
  and invited_by = auth.uid()
);

create policy "invites_update_owner"
on public.invites
for update
using (
  exists (
    select 1
    from public.families f
    where f.id = invites.family_id
      and f.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.families f
    where f.id = invites.family_id
      and f.owner_id = auth.uid()
  )
);

create policy "invites_accept_self"
on public.invites
for update
using (invites.email = auth.email())
with check (
  invites.email = auth.email()
  and invites.status = 'accepted'
);

create policy "invites_delete_owner"
on public.invites
for delete
using (
  exists (
    select 1
    from public.families f
    where f.id = invites.family_id
      and f.owner_id = auth.uid()
  )
);

-- children
alter table if exists public.children enable row level security;

create policy "children_select_family"
on public.children
for select
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = children.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "children_insert_family"
on public.children
for insert
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = children.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "children_update_family"
on public.children
for update
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = children.family_id
      and fm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = children.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "children_delete_family"
on public.children
for delete
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = children.family_id
      and fm.user_id = auth.uid()
  )
);

-- records
alter table if exists public.records enable row level security;

create policy "records_select_family"
on public.records
for select
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = records.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "records_insert_family"
on public.records
for insert
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = records.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "records_update_family"
on public.records
for update
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = records.family_id
      and fm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = records.family_id
      and fm.user_id = auth.uid()
  )
);

create policy "records_delete_family"
on public.records
for delete
using (
  exists (
    select 1
    from public.family_members fm
    where fm.family_id = records.family_id
      and fm.user_id = auth.uid()
  )
);
