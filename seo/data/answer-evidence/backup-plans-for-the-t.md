# Evidence: backup-plans-for-the-t

Run 2026-10-16 against production (read-only, management API). Rules: seo/answer-pages.md section 8 (aggregate only, 10+ people per figure). Demo accounts excluded; trips are auto-verified only. "Inner core" = start and end inside lat 42.30–42.41, lng -71.17 to -71.00 (Boston, Cambridge, Somerville, Brookline and edges). Durations are the trip as Shift recorded it.

## Regular Red Line riders during the July 21–30, 2026 closure

People with 3+ Red Line trips Jun 15–Jul 17: before (Jun 22–Jul 17) 22 people, 1,493 trips: drive 24.6%, bike 14.9%, walk 36.5%, transit 23.5%. During the closure 17 people, 474 trips: drive 34.6%, bike 18.1%, walk 29.3%, transit 17.3%. Small group and midsummer; directional only.

```sql
with riders as (
  select tr.user_id from trips tr join users u on u.id=tr.user_id
  where coalesce(u.is_demo,false)=false and tr.auto_classified_route_id='Red'
    and (tr.started_at at time zone 'America/New_York')::date between '2026-06-15' and '2026-07-17'
  group by 1 having count(*) >= 3
), t as (
  select tr.user_id, tr.mode, tr.auto_classified_route_id rid,
    case when (tr.started_at at time zone 'America/New_York')::date between '2026-06-22' and '2026-07-17' then 'before'
         when (tr.started_at at time zone 'America/New_York')::date between '2026-07-21' and '2026-07-30' then 'closure' end per
  from trips tr join riders r using (user_id)
  where tr.verification_status in ('auto_verified','manual')
)
select per, count(distinct user_id) people, count(*) trips,
  round(100.0*count(*) filter (where mode='drive')/count(*),1) drive_pct,
  round(100.0*count(*) filter (where mode='bike')/count(*),1) bike_pct,
  round(100.0*count(*) filter (where mode='walk')/count(*),1) walk_pct,
  round(100.0*count(*) filter (where mode in ('transit_train','transit_bus','transit_commuter_rail'))/count(*),1) transit_pct,
  round(100.0*count(*) filter (where mode='transit_bus')/count(*),1) bus_pct,
  round(count(*)::numeric/count(distinct user_id)/ (case per when 'before' then 26 else 10 end),2) trips_per_person_day
from t where per is not null group by per order by per;
```

## Green Line vs walking, 0.75–2 mile trips starting in the inner core, last 120 days

Green Line 324 trips / 81 people, median 13 min, 6.4 mph; Red/Orange/Blue 442 / 125, 10.5 min, 7.7 mph; bike 2,398 / 158, 12 min, 6.7 mph; walk 3,111 / 220, 24 min, 2.8 mph. Transit durations may not include all platform waiting.

```sql
select coalesce(case when auto_classified_route_id like 'Green%' then 'Green Line' when auto_classified_route_id in ('Red','Orange','Blue') then 'Red/Orange/Blue' end, mode::text) k,
  count(*) trips, count(distinct user_id) people,
  percentile_cont(0.5) within group (order by duration_minutes) med_min,
  round(percentile_cont(0.5) within group (order by distance_miles)::numeric,2) med_mi,
  round(percentile_cont(0.5) within group (order by distance_miles*60.0/duration_minutes)::numeric,1) med_mph
from trips tr join users u on u.id=tr.user_id
where coalesce(u.is_demo,false)=false and tr.verification_status='auto_verified'
  and started_at > now()-interval '120 days' and duration_minutes>=3 and distance_miles between 0.75 and 2
  and start_lat between 42.30 and 42.41 and start_lng between -71.17 and -71.00
  and (mode in ('walk','bike') or (mode='transit_train' and auto_classified_route_id is not null))
group by 1 order by 1;
```
