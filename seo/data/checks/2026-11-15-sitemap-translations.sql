-- Read-only check, 2026-11-15: why the live sitemap lists 3 translated guide URLs instead of ~84.
-- The sitemap reads content_item_translations with no filter, so the API's 1,000-row default applies.
select count(*) as total_rows,
       count(*) filter (where ci.id is not null) as guide_library_rows,
       count(distinct t.content_item_id) filter (where ci.id is not null) as guide_library_guides,
       count(*) filter (where t.content_item_id::text like 'roam%') as roam_rows,
       count(*) filter (where t.content_item_id::text like 'trail%') as trail_rows,
       max(t.updated_at) as newest
from content_item_translations t
left join content_items ci
  on ci.id::text = t.content_item_id::text
 and ci.content_type = 'micro_guide' and ci.status = 'approved'
 and ci.surfaces @> array['guide_library'] and ci.slug is not null;
