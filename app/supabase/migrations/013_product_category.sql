-- 013_product_category: a product carries its own category (the feed filtered on the brand's categories
-- before, so one brand with three categories made every chip show every product).
--
-- Values are the feed categories; the API validates them (src/lib/categories.ts). Existing products take
-- their brand's first category mapped onto the feed list, else "כללי".

alter table public.products add column if not exists category text;

update public.products p
set category = coalesce(
  (
    select case
      when c in ('אופנה') then 'אופנה'
      when c in ('ביוטי', 'ביוטי וטיפוח') then 'ביוטי'
      when c in ('טכנולוגיה') then 'טכנולוגיה'
      when c in ('בית וגינה', 'ניקיון ובית') then 'בית וגינה'
      when c in ('אוכל', 'מזון ומשקאות') then 'אוכל'
      when c in ('ספורט', 'ספורט ובריאות') then 'ספורט'
      when c in ('ילדים', 'ילדים ותינוקות') then 'ילדים'
      else null
    end
    from (
      select coalesce(b.categories[1], b.category) as c
      from public.brand_profiles b where b.id = p.brand_id
    ) s
  ),
  'כללי'
)
where p.category is null;

alter table public.products alter column category set default 'כללי';
alter table public.products alter column category set not null;

create index if not exists products_category_idx on public.products (category) where status = 'active';
