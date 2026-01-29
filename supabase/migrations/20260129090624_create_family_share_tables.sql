-- families
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz default now()
);

create index if not exists families_owner_id_idx on public.families (owner_id);

-- family_members
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  unique (family_id, user_id)
);

create index if not exists family_members_family_id_idx on public.family_members (family_id);
create index if not exists family_members_user_id_idx on public.family_members (user_id);

-- invites
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  status text not null check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz default now(),
  accepted_at timestamptz,
  unique (family_id, email, status)
);

create index if not exists invites_family_id_idx on public.invites (family_id);
create index if not exists invites_email_idx on public.invites (email);
create index if not exists invites_status_idx on public.invites (status);
