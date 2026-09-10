-- Allow a user to see their partner's category, but only when that
-- category is used by an item the partner has marked as shared.
create policy "select partner category used by shared item"
on categories for select
using (
  user_id = partner_id(auth.uid())
  and exists (
    select 1 from routine_items ri
    where ri.category_id = categories.id
      and ri.is_shared = true
  )
);
