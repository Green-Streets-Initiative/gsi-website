# Evidence: getting-around-boston

Run 2026-10-16 against production (read-only, management API). Rules: seo/answer-pages.md section 8 (aggregate only, 10+ people per figure). Demo accounts excluded; trips are auto-verified only. "Inner core" = start and end inside lat 42.30–42.41, lng -71.17 to -71.00 (Boston, Cambridge, Somerville, Brookline and edges). Durations are the trip as Shift recorded it.

## Trips by people living in Boston, Cambridge, Somerville, Brookline (active 6+ of 8 weeks)

65 people, 12,256 trips: walk 42.6%, drive 26.6%, bike 18.2%, subway 8.0%, bus 1.8%, carpool 1.1%, commuter rail 1.0%, scooter 0.5%, ferry 0.2%. Walking, biking and transit together: 71%. By town (10+ people): Boston 23 people, drive 30.6%; Somerville 24, drive 21.1%, bike 25.4%; Cambridge 14, drive 30.0%. Brookline has 4 people: not publishable on its own.

```sql
with act as (
  select tr.user_id from trips tr join users u on u.id=tr.user_id
  where coalesce(u.is_demo,false)=false and u.home_town in ('Boston','Cambridge','Somerville','Brookline')
    and tr.verification_status='auto_verified' and tr.started_at >= now()-interval '56 days'
  group by 1 having count(distinct date_trunc('week', tr.started_at at time zone 'America/New_York')) >= 6
)
select u.home_town, mode, count(*) trips, count(distinct tr.user_id) people
from trips tr join act using (user_id) join users u on u.id=tr.user_id
where tr.verification_status='auto_verified' and tr.started_at >= now()-interval '56 days'
group by rollup(u.home_town), mode order by 1 nulls first, 3 desc;
```
