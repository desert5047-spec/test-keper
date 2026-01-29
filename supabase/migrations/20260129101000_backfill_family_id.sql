-- children.family_id を user_id 経由で埋める（NULL のみ）
update public.children c
set family_id = fm.family_id
from public.family_members fm
where c.family_id is null
  and c.user_id = fm.user_id;

-- records.family_id を child 経由で埋める（NULL のみ）
update public.records r
set family_id = c.family_id
from public.children c
where r.family_id is null
  and r.child_id = c.id
  and c.family_id is not null;
