alter table if exists public.family_members
  add column if not exists display_name text;

alter table public.family_members
  drop constraint if exists family_members_display_name_length;

alter table public.family_members
  add constraint family_members_display_name_length
  check (
    display_name is null
    or (char_length(display_name) between 1 and 4)
  );
