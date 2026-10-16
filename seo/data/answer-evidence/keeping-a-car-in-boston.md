# Evidence: keeping-a-car-in-boston

Run 2026-10-16 against production (read-only, management API). Rules: seo/answer-pages.md section 8 (aggregate only, 10+ people per figure). Demo accounts excluded; trips are auto-verified only. "Inner core" = start and end inside lat 42.30–42.41, lng -71.17 to -71.00 (Boston, Cambridge, Somerville, Brookline and edges). Durations are the trip as Shift recorded it.

## How often active users drive, last 8 weeks (active in 6+ of 8 weeks)

Living in Boston, Cambridge, Somerville or Brookline: 65 people; median 17 driving days in 8 weeks (about 2 a week); median 25% of trips by car; 787 of 3,263 drives (24%) under 2 miles. Elsewhere: 46 people, median 23.5 driving days, 30% of trips by car. Caveat: "drive" includes rides in a taxi or ride-hail car; Shift cannot tell them apart. Fewer than 10 core residents never drove, so that count is not publishable.

```sql
with t as (
  select tr.user_id, tr.mode, tr.distance_miles, (tr.started_at at time zone 'America/New_York')::date d,
    case when u.home_town in ('Boston','Cambridge','Somerville','Brookline') then 'core' else 'elsewhere' end grp
  from trips tr join users u on u.id=tr.user_id
  where coalesce(u.is_demo,false)=false and tr.verification_status='auto_verified'
    and tr.started_at >= now()-interval '56 days'
), active as (
  select user_id, grp, count(distinct d) days_active, count(distinct d) filter (where mode='drive') drive_days,
    count(*) trips, count(*) filter (where mode='drive') drives,
    count(*) filter (where mode='drive' and distance_miles<2) short_drives
  from t group by 1,2 having count(distinct date_trunc('week',d)) >= 6
)
select grp, count(*) people, percentile_cont(0.5) within group (order by drive_days) med_drive_days, percentile_cont(0.5) within group (order by days_active) med_active_days, percentile_cont(0.5) within group (order by drives::numeric/trips) med_drive_share,
  count(*) filter (where drive_days=0) never_drove,
  count(*) filter (where drive_days between 1 and 8) drove_1_8_days,
  count(*) filter (where drive_days > 8) drove_9plus_days,
  sum(drives) drives, sum(short_drives) short_drives, sum(trips) trips
from active group by grp;
```
