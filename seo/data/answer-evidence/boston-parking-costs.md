# Evidence: boston-parking-costs

Run 2026-10-16 against production (read-only, management API). Rules: seo/answer-pages.md section 8 (aggregate only, 10+ people per figure). Demo accounts excluded; trips are auto-verified only. "Inner core" = start and end inside lat 42.30–42.41, lng -71.17 to -71.00 (Boston, Cambridge, Somerville, Brookline and edges). Durations are the trip as Shift recorded it.

## Weekday trips ending downtown (lat 42.345–42.364, lng -71.087 to -71.048), last 120 days

99 people drove downtown on a weekday at least once; 90 of them also arrived downtown by transit, bike, walking or ferry at least once. Weekday arrivals: walk 1,559, transit 1,066, bike 413, drive 363 (drive = about 1 in 9 of these four). Median weekday drive into downtown was 3.4 miles; 242 of 363 were under 5 miles.

```sql
with t as (
  select tr.user_id, tr.mode, tr.distance_miles, tr.duration_minutes, (tr.started_at at time zone 'America/New_York') lt
  from trips tr join users u on u.id=tr.user_id
  where coalesce(u.is_demo,false)=false and tr.verification_status='auto_verified'
    and tr.started_at > now()-interval '120 days'
    and tr.end_lat between 42.345 and 42.364 and tr.end_lng between -71.087 and -71.048
    and extract(isodow from (tr.started_at at time zone 'America/New_York')) <= 5
), drivers as (select distinct user_id from t where mode='drive')
select
 (select count(*) from drivers) people_drove_downtown,
 (select count(*) from t where mode='drive') weekday_drives_downtown,
 (select count(distinct user_id) from t join drivers using(user_id) where mode in ('transit_train','transit_bus','transit_commuter_rail','bike','walk','ferry')) of_them_also_other_way,
 (select count(*) from t where mode in ('transit_train','transit_bus','transit_commuter_rail','ferry')) transit_arrivals,
 (select count(*) from t where mode='bike') bike_arrivals,
 (select count(*) from t where mode='walk') walk_arrivals,
 (select round(percentile_cont(0.5) within group (order by distance_miles)::numeric,1) from t where mode='drive') med_drive_mi,
 (select count(*) from t where mode='drive' and distance_miles<5) drives_under_5mi;
```
