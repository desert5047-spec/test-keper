-- family_members: user_id で検索する場合は自分自身のレコードを取得可能にする
drop policy if exists "family_members_select_member" on public.family_members;

create policy "family_members_select_member"
on public.family_members
for select
using (
  -- 自分自身のレコードを取得する場合（user_id で検索）は無条件で許可
  -- これにより、ensureFamilyForUser で user_id で検索する際に循環参照を回避
  family_members.user_id = auth.uid()
  -- または、自分がその family_id のメンバーである場合（is_family_member 関数を使用）
  -- ただし、user_id が自分でない場合のみ（循環参照を避けるため）
  or (
    family_members.user_id <> auth.uid()
    and public.is_family_member(family_members.family_id, auth.uid())
  )
);
