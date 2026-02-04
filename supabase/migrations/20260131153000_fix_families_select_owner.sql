-- families: owner は所属メンバー未作成でも参照可能にする
drop policy if exists "families_select_member" on public.families;
create policy "families_select_member"
on public.families
for select
using (
  public.is_family_member(families.id, auth.uid())
  or families.owner_id = auth.uid()
);
