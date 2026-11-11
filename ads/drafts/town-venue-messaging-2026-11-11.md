# Town and Venue messaging rewrite (2026-11-11)

Keith 2026-11-11: "draft both and add Town and Venue now" (overrides the 14-day wait).
Why: the 11-11 compliance email flagged Town Walking & Biking (4.8%) and Venue Parking (4.2%).
Neither is a grant breach (the 5% rule is account-wide; account 8.9%), but both ads answered a
different question than the one searched.

- **Venue Parking (Nov 1-11):** Gillette 5.4% (17/317, the one conversion) leads with a parking fact
  (free lots across Route 1). TD Garden 3.1% and Fenway 2.8% led with the train. The pinned Ad 1s were
  rated Poor and Google showed them 63 of 592 times, so the pinned test never ran.
- **Town (Nov 1-11, 7/152):** searches name a place ("bradford rail trail" 23 impr / 0 clicks, "walking
  trails boston"); the ads were generic and talked about street projects and events. The four low
  Quality Score pauses were all trail/path searches.

## What changes

1. **New ad group Trails** (Town Walking & Biking). Phrase match. Named-trail keywords land on their own
   trail page (keyword-level Final URL); general trail searches land on /trails. Headline 1 uses keyword
   insertion so the ad names the trail searched.
2. **Moved:** the trail/path keywords below are paused in Town routes and re-added (phrase) in Trails.
3. **Town routes:** two new route-first ads; the two old ads paused.
4. **Venue Parking:** every ad leads with the parking answer (map, every garage, prices checked weekly,
   walk times); the train is a second option in later headlines and descriptions. No pins. New TD Garden
   and Fenway pairs; Gillette gets one new ad and keeps its working Ad 2. Old ads paused, not deleted.
5. **Call to action:** see the map, compare garages, check today's conditions.

Prices stay out of the ads (the pages carry them, checked weekly by the venue-parking-prices routine).

Judge from 2026-11-25: each ad group at 5%+ after ~300 impressions; Trails vs the old Town baseline
(4.6%). Pause any ad group still under 5% then.

## Keywords

**Named trails (phrase -> /trails/<slug>):** minuteman bikeway (minuteman-bikeway), minuteman bike path (minuteman-bikeway), minuteman trail (minuteman-bikeway), cape cod rail trail (cape-cod-rail-trail), bruce freeman rail trail (bruce-freeman-rail-trail), bruce freeman trail (bruce-freeman-rail-trail), shining sea bikeway (shining-sea-bikeway), mass central rail trail (mass-central-rail-trail), somerville community path (somerville-community-path), charles river bike path (charles-river-paths), charles river path (charles-river-paths), northern strand trail (northern-strand-trail), northern strand (northern-strand-trail), battle road trail (battle-road-trail), marblehead rail trail (marblehead-rail-trail), manhan rail trail (manhan-rail-trail), twin cities rail trail (twin-cities-rail-trail), nashua river rail trail (nashua-river-rail-trail), assabet river rail trail (assabet-river-rail-trail), clipper city rail trail (clipper-city-rail-trail), wwii veterans memorial trail (wwii-veterans-memorial-trail), fort river trail (fort-river-trail), southwest corridor park (southwest-corridor-park), southwest corridor bike path (southwest-corridor-park), emerald necklace bike path (emerald-necklace-paths), emerald necklace path (emerald-necklace-paths), boston harborwalk (boston-harborwalk), harborwalk boston (boston-harborwalk), neponset river greenway (neponset-river-greenway), neponset river trail (neponset-river-greenway), east boston greenway (east-boston-greenway), mystic river greenway (mystic-river-greenway), mystic river path (mystic-river-greenway), alewife linear park (alewife-linear-park), alewife greenway (alewife-linear-park), fresh pond reservation (fresh-pond-reservation), fresh pond loop (fresh-pond-reservation), narrow gauge rail trail (narrow-gauge-rail-trail), reformatory branch trail (reformatory-branch-trail), watertown cambridge greenway (watertown-cambridge-greenway)

**General trail searches (phrase -> /trails):** walking trails near me, walking paths near me, bike paths near me, rail trail near me, rail trails near me, rail trails massachusetts, bike trails massachusetts, bike paths massachusetts, walking trails somerville, walking trails cambridge, walking trails medford, walking trails arlington, walking trails newton, walking trails brookline, walking trails malden, walking trails worcester, walking trails boston, somerville bike paths, cambridge bike paths, medford bike paths, arlington bike paths, newton bike paths, brookline bike paths, malden bike paths, worcester bike paths

**Paused in Town routes (broad):** bike paths near me, walking trails near me, walking trails somerville, walking trails cambridge, walking trails medford, walking trails arlington, walking trails newton, walking trails brookline, walking trails malden, walking trails worcester, walking trails boston, somerville bike paths, cambridge bike paths, medford bike paths, arlington bike paths, newton bike paths, brookline bike paths, malden bike paths, worcester bike paths

## Ads

**Town Walking & Biking / Trails** -> `/trails` (path trails/map)
- Headlines: {KeyWord:Trail Maps and Parking} · Map, Parking, Where to Get On · Every Place to Get On · Where to Park for the Trail · Trail Length and Surface · See Closures and Conditions · Download the GPX File · How to Get There · Rail Trails in Massachusetts · Bike Paths in Massachusetts · Free Trail Guides · Plan Your Ride or Walk · Trail Map With Entry Points · From a Massachusetts Nonprofit · Green Streets Initiative
- Descriptions:
  - A map of the trail, every place to get on, and where to park at each one.
  - Length, surface, closures and how to get there, on one page.
  - Download the GPX for Strava, Komoot or Ride with GPS before you head out.
  - Free trail guides from Green Streets Initiative, a Massachusetts nonprofit.

**Town Walking & Biking / Trails** -> `/trails` (path trails/guide)
- Headlines: {KeyWord:Rail Trail Map} · Where to Get On and Park · Trail Map and Parking · Length, Surface, Closures · Is the Trail Open Today? · Find Your Starting Point · Rail Trail Guides · Walk or Ride It · Bike Path Maps · Free From Green Streets · Massachusetts Trail Guides · Trail Guides With Maps · Plan a Trail Day · See Every Entry Point · GPX Download for Each Trail
- Descriptions:
  - Where to get on, where to park, and how long the trail is, all on one map.
  - Check closures before you go, then download the GPX for your bike computer.
  - Bike paths and rail trails across Massachusetts, from a local nonprofit.
  - Free guides from Green Streets Initiative, helping people move better since 2006.

**Town Walking & Biking / Town routes** -> `/shift/towns` (path towns/walk-and-bike)
- Headlines: Walk and Bike in Your Town · Local Trails and Bike Paths · Free Local Group Rides · Group Rides This Month · Trails, Rides and Street News · Self-Guided Roams Near You · How Your Town Gets Around · Biking in Greater Boston · Walking and Biking Guide · Free Town Guide · Street Projects Near You · Bike Routes in Your Town · Walks and Rides Near You · From a Massachusetts Nonprofit · Green Streets Initiative
- Descriptions:
  - Trails and bike paths near you, free group rides, and self-guided routes in your town.
  - See this month's group rides and walks, then pick a trail or path close to home.
  - Upcoming street projects and meetings in your town, with how to comment.
  - Free town pages from Green Streets Initiative, a Massachusetts nonprofit.

**Town Walking & Biking / Town routes** -> `/shift/towns` (path towns/rides)
- Headlines: Group Rides in Your Town · Biking and Walking Near You · Free Rides and Walks Nearby · Trails Close to Home · Local Bike Paths and Trails · Self-Guided Routes to Try · Rides for Every Pace · Find a Ride This Week · Your Town, On Foot and Bike · Town Walking and Biking Guide · See Local Street Projects · Join a Free Group Ride · Walk and Bike Events Nearby · Green Streets Initiative · A Massachusetts Nonprofit
- Descriptions:
  - Free group rides and walks in your town this month, with the trails nearby.
  - Pick a self-guided route, a trail close to home, or a ride with neighbors.
  - See the street projects coming to your town and the next meeting to weigh in.
  - Free town pages from Green Streets Initiative, a Massachusetts nonprofit.

**Venue Parking / TD Garden** -> `/parking/td-garden` (path parking/td-garden)
- Headlines: TD Garden Parking · TD Garden Parking Map · Every Garage Near TD Garden · The Garage Under the Arena · Garage Prices, Checked Weekly · Walk Time From Each Garage · Compare Garages Near TD Garden · Buy Ahead or Pay That Day · Height Limits and EV Charging · North Station Garage Rates · Parking for Bruins and Celtics · Parking for Concerts Too · Orange and Green Lines Below · Free Guide From a Nonprofit · Green Streets Initiative
- Descriptions:
  - Every garage near TD Garden on one map, with its price and walk time.
  - The garage under the arena: buy ahead or pay that day, height limit and EV chargers.
  - Prices checked every week. The Orange and Green Lines also stop under the arena.
  - A free guide from Green Streets Initiative, a Massachusetts nonprofit.

**Venue Parking / TD Garden** -> `/parking/td-garden` (path parking/td-garden)
- Headlines: Parking Near TD Garden · Where to Park for TD Garden · North Station Parking · North Station Garage Prices · Garages and Walk Times · See Every Garage on a Map · Game Night Parking Guide · Prices Checked Every Week · What the Garage Charges · Park Under the Arena · Elevator to the Arena · Event Parking, Explained · Trains Stop Under the Arena · Green Streets Initiative · A Massachusetts Nonprofit
- Descriptions:
  - North Station Garage, the garages a short walk away, and what each one charges.
  - See each garage's walk time on the map before you leave home.
  - Commuter Rail, Orange and Green Lines stop at North Station, under TD Garden.
  - A free guide from Green Streets Initiative, a Massachusetts nonprofit.

**Venue Parking / Fenway Park** -> `/parking/fenway-park` (path parking/fenway)
- Headlines: Fenway Park Parking · Fenway Park Parking Map · Every Garage Near Fenway · Red Sox Garage Rates · Garage Prices, Checked Weekly · Walk Time From Each Garage · Night and Weekend Game Rates · Cheaper Garages a Walk Away · Cash Lots vs. Garages · Parking Near Fenway Park · Red Sox Parking Guide · Pick a Garage, See the Walk · Green Line to Kenmore · Free Guide From a Nonprofit · Green Streets Initiative
- Descriptions:
  - Every garage near Fenway on one map, with its price and walk time.
  - The Red Sox night and weekend rate, which garages take it, and how to get it.
  - Prices checked every week. Kenmore station on the Green Line is a 5-minute walk.
  - A free guide from Green Streets Initiative, a Massachusetts nonprofit.

**Venue Parking / Fenway Park** -> `/parking/fenway-park` (path parking/fenway)
- Headlines: Where to Park for Fenway · Parking Near Fenway Park · Fenway Parking Garages · Red Sox Parking Rates · Garages and Walk Times · See Every Garage on a Map · Prices Checked Every Week · Scan Your Ticket to Save · Cash Lots and What They Charge · Fenway Game Day Parking · Bike Valet on Game Days · Commuter Rail to Lansdowne · Fenway, Step by Step · Green Streets Initiative · A Massachusetts Nonprofit
- Descriptions:
  - The Red Sox rate garages and the ones a short walk away, with walk times.
  - Scan that day's Red Sox ticket at the exit for the night and weekend game rate.
  - Lansdowne Commuter Rail is 3 minutes away, and Kenmore is a 5-minute walk.
  - A free guide from Green Streets Initiative, a Massachusetts nonprofit.

**Venue Parking / Gillette Stadium** -> `/parking/gillette-stadium` (path parking/gillette)
- Headlines: Gillette Stadium Parking · Free Parking Across Route 1 · Gillette Parking Map · When the Lots Open and Close · Lots, Walk Times and Rules · Be Paid to Park, Explained · Free Lots for Patriots Games · Concerts Park Free Too · Stadium-Side Lots Explained · Tailgating Rules · Gillette Parking Guide · Prices Checked Every Week · $20 Round-Trip Event Train · Free Guide From a Nonprofit · Green Streets Initiative
- Descriptions:
  - General parking across Route 1 is free for Patriots games, concerts and Revolution.
  - Lots open 4 hours before kickoff. See each lot on the map with its walk time.
  - Be Paid to Park, the stadium-side lots, and the $20 event train from South Station.
  - A free guide from Green Streets Initiative, a Massachusetts nonprofit.
