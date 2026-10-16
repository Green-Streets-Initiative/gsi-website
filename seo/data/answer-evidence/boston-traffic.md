# Evidence: boston-traffic

Run 2026-10-16 against production (read-only, management API). Rules: seo/answer-pages.md section 8 (aggregate only, 10+ people per figure). Demo accounts excluded; trips are auto-verified only. "Inner core" = start and end inside lat 42.30–42.41, lng -71.17 to -71.00 (Boston, Cambridge, Somerville, Brookline and edges). Durations are the trip as Shift recorded it.

## Rush-hour speed by mode, inner core, last 90 days

1–3 mile trips (weekday 7:00–9:30 and 16:00–19:00 ET): drive 438 trips / 104 people, median 15 min, 7.3 mph; bike 748 / 113, 15 min, 6.9 mph; subway 516 / 123, 17 min, 6.9 mph; bus 207 / 47, 25 min, 5.0 mph; walk 577 / 134, 29 min, 3.0 mph. Off-peak drive median 7.7 mph.

3–8 mile trips, same windows: drive 329 / 93, median 32 min, 8.4 mph; bike 345 / 78, 31 min, 8.6 mph; subway 404 / 103, 31 min, 8.8 mph; bus 82 / 42, 6.0 mph. Off-peak drive median 10.3 mph (rush is about 18% slower); off-peak subway 8.8, bike 8.3.

```sql
with t as (
  select tr.*, (started_at at time zone 'America/New_York') lt
  from trips tr join users u on u.id=tr.user_id
  where coalesce(u.is_demo,false)=false and tr.verification_status='auto_verified'
    and started_at > now()-interval '90 days'
    and start_lat between 42.30 and 42.41 and end_lat between 42.30 and 42.41
    and start_lng between -71.17 and -71.00 and end_lng between -71.17 and -71.00
    and duration_minutes >= 3 and distance_miles between 1 and 3
)
select case when extract(isodow from lt) <= 5 and ((lt::time between '07:00' and '09:30') or (lt::time between '16:00' and '19:00')) then 'weekday rush' else 'other times' end as period,
  mode, count(*) trips, count(distinct user_id) people,
  round(percentile_cont(0.5) within group (order by distance_miles)::numeric,2) med_mi,
  percentile_cont(0.5) within group (order by duration_minutes) med_min,
  round(percentile_cont(0.5) within group (order by distance_miles*60.0/duration_minutes)::numeric,1) med_mph
from t where mode in ('drive','bike','walk','transit_train','transit_bus','carpool')
group by 1,2 order by 1,2;
```

The 3–8 mile run is the same query with `distance_miles between 3 and 8`.
