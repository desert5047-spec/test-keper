-- children
alter table if exists public.children
  add column if not exists family_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'children_family_id_fkey'
  ) then
    alter table public.children
      add constraint children_family_id_fkey
      foreign key (family_id)
      references public.families(id)
      on delete set null;
  end if;
end $$;

create index if not exists children_family_id_idx on public.children (family_id);

-- records
alter table if exists public.records
  add column if not exists family_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'records_family_id_fkey'
  ) then
    alter table public.records
      add constraint records_family_id_fkey
      foreign key (family_id)
      references public.families(id)
      on delete set null;
  end if;
end $$;

create index if not exists records_family_id_idx on public.records (family_id);

-- monthly_stats (if exists)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'monthly_stats'
      and table_type = 'BASE TABLE'
  ) then
    alter table public.monthly_stats
      add column if not exists family_id uuid;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'monthly_stats_family_id_fkey'
    ) then
      alter table public.monthly_stats
        add constraint monthly_stats_family_id_fkey
        foreign key (family_id)
        references public.families(id)
        on delete set null;
    end if;

    create index if not exists monthly_stats_family_id_idx
      on public.monthly_stats (family_id);
  end if;
end $$;
