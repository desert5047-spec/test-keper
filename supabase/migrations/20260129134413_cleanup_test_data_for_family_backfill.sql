-- A) 孤児 records を削除（family_id が NULL のものに限定）
delete from public.records r
where r.family_id is null
  and (
    r.child_id is null
    or not exists (select 1 from public.children c where c.id = r.child_id)
  );

-- B) auth.users に存在しない user_id を持つ children を参照する records を削除
delete from public.records r
where r.family_id is null
  and exists (
    select 1
    from public.children c
    where c.id = r.child_id
      and c.family_id is null
      and not exists (select 1 from auth.users u where u.id = c.user_id)
  );

-- B) auth.users に存在しない user_id を持つ children を削除
delete from public.children c
where c.family_id is null
  and not exists (select 1 from auth.users u where u.id = c.user_id);

-- C) backfill を再実行（NULL のみ）
update public.children c
set family_id = fm.family_id
from public.family_members fm
where c.family_id is null
  and c.user_id = fm.user_id;

update public.records r
set family_id = c.family_id
from public.children c
where r.family_id is null
  and r.child_id = c.id
  and c.family_id is not null;
