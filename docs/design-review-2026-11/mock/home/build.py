import base64, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import parts as P
from parts import E, EVENTS, PLACES, NUM, card_photo, card_row, nav, spotlight, footer, page, map_square

HERE = os.path.dirname(__file__)
MOCK = '/Users/keithanderson/gsi-website/docs/design-review-2026-11/mock'
OUT_SRC = os.path.join(MOCK, 'home')          # committed, relative img paths
OUT_VIEW = os.path.join(MOCK, 'home', 'view')          # images inlined, for the preview pane

spot = open(os.path.join(MOCK, 'spotlight.html')).read()
svg = re.search(r'<div class="state"><svg.*?</svg>', spot, re.S).group(0)[len('<div class="state">'):]
P.STATE_SVG = svg.replace('<svg ', '<svg style="width:100%;height:100%" ')

def places_row(n=4):
    return ''.join(f'''<a class="pl"><div class="pp"><img class="fill" src="img/{f}.jpg" alt=""></div><h3>{t}</h3><p class="meta">{m}</p><p class="credit">Photo: {c}</p></a>''' for f, t, m, c in PLACES[:n])

PLACES_CSS = '''.pls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media(min-width:900px){.pls{grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}}
.pl .pp{aspect-ratio:4/3;border-radius:14px;overflow:hidden}.pl h3{font-size:16px;margin-top:8px}'''

TRIP = '''<div class="trip"><h2>Plan a trip</h2><p class="lede2">Every way there, side by side.</p>
<label><small>From</small>Union Square, Somerville</label><label><small>To</small>Fenway Park</label>
<a class="btn" style="width:100%">Show me the ways</a></div>'''
TRIP_CSS = '''.trip{background:var(--pale);border-radius:16px;padding:18px}.trip h2{font-size:21px}.lede2{font-size:15px;color:var(--ink75);margin:2px 0 12px}
.trip label{display:block;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin-bottom:8px;font-size:16px}
.trip label small{display:block;font-size:13px;color:var(--ink75)}'''

LESSON = '''<a class="lesson"><div class="lp"><img class="fill" src="img/lesson.jpg" alt=""><span class="cr">Photo: 4300streetcar, CC BY 4.0</span></div>
<div class="lt"><h2>Learn to ride on your own streets</h2><p class="lede2">A free one-on-one lesson, starting from your door.</p><span class="btn">Ask for a lesson</span></div></a>'''
LESSON_CSS = '''.lesson{display:grid;grid-template-columns:1fr;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff}
@media(min-width:640px){.lesson{grid-template-columns:1.1fr 1fr}}
.lp{position:relative;min-height:180px}.lp img{position:absolute;inset:0}
.cr{position:absolute;right:8px;bottom:8px;background:rgba(25,26,46,.65);color:#fff;font-size:13px;padding:2px 8px;border-radius:6px}
.lt{padding:18px}.lt h2{font-size:21px}'''

ORGS = [('briefcase', 'Employers', 'A team challenge, free to start'), ('school', 'Schools', 'Walk and bike to school, counted'),
        ('landmark', 'Towns and cities', 'A spring town challenge'), ('megaphone', 'Event hosts', 'List your rides and walks'),
        ('store', 'Local businesses', 'Become a rewards partner')]

def orgs_row():
    return ''.join(f'<a class="org"><i data-lucide="{i}"></i><b>{t}</b><span>{s}</span></a>' for i, t, s in ORGS)
ORGS_CSS = '''.orgs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(min-width:900px){.orgs{grid-template-columns:repeat(5,minmax(0,1fr))}}
.org{border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:3px}
.org [data-lucide]{width:22px;height:22px;color:var(--forest);margin-bottom:4px}.org b{font:800 16px Overpass}.org span{font-size:14px;color:var(--ink75)}'''

MISSION = f'''<div class="mission"><div><h2>A Somerville nonprofit helping Massachusetts try walking, biking and transit</h2>
<p class="lede2">Since 2006. Every listing, map and lesson here is free.</p><a class="btn ghost">About us</a> <a class="btn">Donate</a></div>
<div class="nums"><div><b>{NUM["trips_month"]}</b><span>trips on foot, bike or transit logged in Shift this month</span></div>
<div><b>{NUM["upcoming"]}</b><span>events listed across the state</span></div><div><b>{NUM["towns"]}</b><span>town pages with real trip maps</span></div></div></div>'''
MISSION_CSS = '''.mission{display:grid;gap:20px;border-top:1px solid var(--line);padding-top:26px}@media(min-width:900px){.mission{grid-template-columns:1.1fr 1fr;align-items:center}}
.mission h2{font-size:24px;line-height:1.2;margin-bottom:6px}.mission .btn{margin-top:8px}
.nums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.nums b{display:block;font:800 30px Overpass;color:var(--deep)}.nums span{font-size:14px;color:var(--ink75);line-height:1.3;display:block}'''

DAYS = [('Fri', 20, 'Walk/Ride Day'), ('Sat', 21, None), ('Sun', 22, None), ('Mon', 23, None), ('Tue', 24, None)]

# ---------------------------------------------------------------- 1. This weekend first
def home1():
    days = ''.join(f'<span class="day{" on" if d == 21 else ""}"><small>{w}</small><b>{d}</b></span>' for w, d, _ in DAYS)
    sat = ''.join(card_photo(E[s]) for s in ('butternut', 'picnic', 'lizzie', 'physics'))
    body = f'''{nav()}
<main class="wrap">
<section class="hero"><div><h1>Try a ride, walk or class this weekend</h1>
<p class="near">Near <b>Somerville</b> <i data-lucide="chevron-down"></i></p>
<div class="days">{days}</div>
<div class="kinds"><span class="on">All</span><span>Group rides</span><span>Walks</span><span>Classes</span><span>Easy pace</span></div></div>
<div class="tom"><i data-lucide="footprints"></i><div><b>Tomorrow: Walk/Ride Day</b><span>Make one trip on foot, by bike or on the T.</span></div><a>How it works →</a></div>
</section>
<section><div class="rowh"><h2>Saturday near you</h2><a>See all {NUM["weekend"]} →</a></div><div class="evs">{sat}</div></section>
<section>{spotlight()}</section>
<section><div class="rowh"><h2>Places to try on foot or by bike</h2><a>All {NUM["trails"]} trails →</a></div><div class="pls">{places_row()}</div></section>
<section class="two">{TRIP}{LESSON}</section>
<section><div class="rowh"><h2>For organizations</h2><a>Book a call →</a></div><div class="orgs">{orgs_row()}</div></section>
<section>{MISSION}</section>
</main>{footer()}'''
    css = PLACES_CSS + TRIP_CSS + LESSON_CSS + ORGS_CSS + MISSION_CSS + '''
section{padding:16px 0}
.hero{display:grid;gap:16px;padding-top:24px}@media(min-width:1024px){.hero{grid-template-columns:1fr 340px;align-items:end}}
.hero h1{font-size:30px;line-height:1.1}@media(min-width:900px){.hero h1{font-size:44px}}
.near{display:inline-flex;align-items:center;gap:6px;margin-top:8px;font:700 17px Overpass;color:var(--forest)}.near b{border-bottom:2px solid var(--forest)}
.days{display:flex;gap:8px;margin:14px 0 0;overflow:hidden}.day{flex:0 0 auto;min-width:60px;text-align:center;border:1px solid var(--line);border-radius:12px;padding:7px 10px}
.day small{display:block;font-size:14px;color:var(--ink75)}.day b{font:800 21px Overpass}.day.on{background:var(--ink);color:#fff;border-color:var(--ink)}.day.on small{color:#fff}
.kinds{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.kinds span{border:1px solid var(--line);border-radius:999px;padding:6px 13px;font-size:15px}.kinds .on{background:var(--pale);border-color:var(--forest);color:var(--deep);font-weight:600}
.tom{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:var(--pale);border-radius:14px;padding:14px}.tom [data-lucide]{width:28px;height:28px;color:var(--forest)}
.tom div{flex:1;min-width:0}.tom b{display:block;font:800 17px Overpass}.tom span{font-size:15px;color:var(--ink75)}.tom a{font:700 15px Overpass;color:var(--forest)}
.evs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}@media(min-width:900px){.evs{grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}}
@media(max-width:640px){.evs .pc h3{font-size:16px}}
.two{display:grid;gap:18px}@media(min-width:900px){.two{grid-template-columns:1fr 1.4fr}}'''
    return page('Home 1 · This weekend first', body, css)

# ---------------------------------------------------------------- 2. Six doors
def home2():
    nxt = ''.join(card_row(E[s], 64) for s in ('butternut', 'picnic', 'lizzie', 'coffee'))
    body = f'''{nav()}
<main class="wrap">
<section class="hero2">
<div class="ht"><h1>Try a new way around Massachusetts</h1>
<p class="lede">Group rides and walks, maps of real trips, and free lessons, from a Somerville nonprofit.</p>
<div class="cta"><a class="btn">See what's on</a><a class="btn ghost">Plan a trip</a></div></div>
<figure class="hp"><img class="fill" src="img/walk-ride-day-2014.jpg" alt="People with bikes on City Hall Plaza before a Walk/Ride Day ride">
<span class="live"><b>{NUM["trips_month"]}</b> trips on foot, bike or transit in Shift this month</span>
<figcaption>Walk/Ride Day, Boston. Photo: MassDOT</figcaption></figure>
</section>
<section class="doors">
<div class="door d-on"><div class="dh"><h2>What's on</h2><a>{NUM["upcoming"]} events →</a></div><div class="nx">{nxt}</div></div>
<a class="door d-pl"><img class="fill" src="img/minuteman-bikeway.jpg" alt=""><div class="ov2"><h2>Places</h2><p>{NUM["trails"]} trails · {NUM["towns"]} towns</p></div><span class="cr">Photo: Daderot, public domain</span></a>
<div class="door d-gt"><h2>Get there</h2><label><small>From</small>Union Square</label><label><small>To</small>Fenway Park</label><a class="btn" style="width:100%">Show me the ways</a></div>
<a class="door d-lr"><img class="fill" src="img/lesson.jpg" alt=""><div class="ov2"><h2>Learn to ride</h2><p>Free lessons on your own streets</p></div><span class="cr">Photo: 4300streetcar, CC BY 4.0</span></a>
<div class="door d-or"><h2>For organizations</h2><div class="oc">{''.join(f'<a><i data-lucide="{i}"></i>{t}</a>' for i, t, _ in ORGS[:4])}</div><a class="more">Book a call →</a></div>
<a class="door d-sh"><h2>Get Shift</h2><p>Live departures, bike share and every way to go, in one free app.</p><p class="big"><b>{NUM["members"]}</b> people use it</p><span class="btn">Get the app</span></a>
</section>
<section>{spotlight()}</section>
</main>{footer()}'''
    css = '''section{padding:16px 0}
.hero2{display:grid;gap:18px;padding-top:24px}@media(min-width:900px){.hero2{grid-template-columns:1fr 1.1fr;align-items:center;gap:36px}}
.hero2 h1{font-size:32px;line-height:1.08}@media(min-width:900px){.hero2 h1{font-size:48px}}
.lede{font-size:17px;color:var(--ink75);margin-top:10px;max-width:460px}.cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.hp{position:relative;margin:0;aspect-ratio:3/2;border-radius:18px;overflow:hidden}
.hp figcaption{position:absolute;right:8px;bottom:8px;background:rgba(25,26,46,.65);color:#fff;font-size:13px;padding:2px 8px;border-radius:6px}
.live{position:absolute;left:12px;top:12px;max-width:220px;background:#fff;border-radius:12px;padding:8px 12px;font-size:14px;line-height:1.3;box-shadow:0 2px 8px #0002}.live b{display:block;font:800 24px Overpass;color:var(--deep)}
.doors{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:900px){.doors{grid-template-columns:1.25fr 1fr 1fr;grid-template-rows:auto auto;grid-template-areas:"on pl gt" "on lr or" "sh sh sh"}
.d-on{grid-area:on}.d-pl{grid-area:pl}.d-gt{grid-area:gt}.d-lr{grid-area:lr}.d-or{grid-area:or}.d-sh{grid-area:sh}}
.door{position:relative;border-radius:18px;overflow:hidden;border:1px solid var(--line);padding:18px;min-height:200px;display:block}
.door h2{font-size:22px}
.dh{display:flex;justify-content:space-between;align-items:baseline}.dh a{font:700 15px Overpass;color:var(--forest)}
.d-on{background:var(--pale);border-color:transparent}.nx{display:grid;gap:14px;margin-top:14px}
.d-pl,.d-lr{padding:0;min-height:220px}.d-pl img,.d-lr img{position:absolute;inset:0}
.ov2{position:absolute;left:0;right:0;bottom:0;padding:40px 16px 14px;background:linear-gradient(transparent,rgba(25,26,46,.8));color:#fff}.ov2 p{font-size:15px;margin-top:2px}
.cr{position:absolute;right:8px;top:8px;background:rgba(25,26,46,.65);color:#fff;font-size:13px;padding:2px 8px;border-radius:6px}
.d-gt label{display:block;background:var(--pale);border-radius:10px;padding:7px 12px;margin:8px 0;font-size:16px}.d-gt label small{display:block;font-size:13px;color:var(--ink75)}
.oc{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.oc a{display:flex;gap:7px;align-items:center;font:700 15px Overpass;background:var(--pale);border-radius:10px;padding:10px}
.oc [data-lucide]{width:18px;height:18px;color:var(--forest)}.more{display:inline-block;margin-top:12px;font:700 15px Overpass;color:var(--forest)}
.d-sh{background:var(--ink);color:#fff;border:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px 24px;min-height:0}.d-sh h2{width:100%}@media(min-width:900px){.d-sh h2{width:auto}}
.d-sh p{font-size:16px;color:rgba(255,255,255,.85);flex:1;min-width:220px}.d-sh .big{flex:0 0 auto}.d-sh .big b{font:800 26px Overpass;color:#8FD3A8;margin-right:4px}
.d-sh .btn{background:#fff;color:var(--ink)}'''
    return page('Home 2 · Six doors', body, css)

# ---------------------------------------------------------------- 3. Map first
def home3():
    pins = [dict(lat=e['lat'], lng=e['lng'], d=e['d'], day=e['day'], t=e['title']) for e in EVENTS]
    import json
    lst = ''.join(card_row(e, 72) for e in EVENTS[:6])
    body = f'''{nav()}
<main>
<section class="mapwrap"><div id="map"></div>
<div class="panel"><h1>This weekend near Somerville</h1>
<div class="seg"><span class="on">Sat 21</span><span>Sun 22</span><span>Next 7 days</span></div>
<div class="kinds"><span class="on">All {NUM["weekend"]}</span><span>Rides</span><span>Walks</span><span>Classes</span></div>
<div class="lst">{lst}</div><a class="all">See all {NUM["weekend"]} on the calendar →</a></div>
</section>
<div class="wrap">
<section><div class="rowh"><h2>Places to try on foot or by bike</h2><a>All {NUM["trails"]} trails →</a></div><div class="pls">{places_row()}</div></section>
<section class="strip">
<a class="sd"><i data-lucide="route"></i><b>Plan a trip</b><span>Every way there, side by side</span></a>
<a class="sd"><i data-lucide="bike"></i><b>Learn to ride</b><span>Free lessons on your own streets</span></a>
<a class="sd"><i data-lucide="users"></i><b>Go with someone</b><span>A neighbor for your first trip</span></a>
<a class="sd"><i data-lucide="building-2"></i><b>For organizations</b><span>Employers, schools, towns, hosts</span></a>
</section>
<section>{spotlight()}</section>
<section>{MISSION}</section>
</div>{footer()}
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
const pins={json.dumps(pins)};
const m=L.map('map',{{zoomControl:false,attributionControl:true,scrollWheelZoom:false}}).setView([42.355,-71.105],12);
L.tileLayer('https://www.gogreenstreets.org/api/map-tiles/{{z}}/{{x}}/{{y}}',{{attribution:'© OpenStreetMap contributors'}}).addTo(m);
L.circleMarker([42.3796,-71.0937],{{radius:7,color:'#fff',weight:3,fillColor:'#2D6A4F',fillOpacity:1}}).addTo(m);
for(const p of pins){{L.marker([p.lat,p.lng],{{icon:L.divIcon({{className:'dpin',html:`<span><small>${{p.day}}</small>${{p.d}}</span>`,iconSize:[38,40],iconAnchor:[19,40]}})}}).addTo(m)}}
m.setView([42.362,-71.105],window.innerWidth>=1024?13:12);
</script>'''
    css = PLACES_CSS + MISSION_CSS + '''section{padding:16px 0}
.mapwrap{position:relative;display:grid}@media(min-width:1024px){.mapwrap{grid-template-columns:minmax(0,1fr) 440px;height:620px}}
#map{height:300px;background:#EEF0EA}@media(min-width:1024px){#map{height:100%}}
.panel{padding:16px;background:#fff;overflow:hidden}@media(min-width:1024px){.panel{border-left:1px solid var(--line);padding:22px;overflow-y:auto}}
.panel h1{font-size:28px;line-height:1.1}
.seg{display:flex;gap:6px;margin-top:12px}.seg span{border:1px solid var(--line);border-radius:10px;padding:7px 12px;font:700 15px Overpass}.seg .on{background:var(--ink);color:#fff;border-color:var(--ink)}
.kinds{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.kinds span{border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:15px}.kinds .on{background:var(--pale);border-color:var(--forest);color:var(--deep);font-weight:600}
.lst{display:grid;gap:14px;margin-top:16px}.all{display:block;margin-top:14px;font:700 15px Overpass;color:var(--forest)}
.dpin span{display:block;width:38px;height:38px;background:#fff;border-radius:9px;box-shadow:0 2px 6px #0004;text-align:center;font:800 16px/1 Overpass;color:var(--ink);padding-top:4px;border:2px solid var(--forest)}
.dpin small{display:block;font-size:10px;color:var(--forest);margin-bottom:2px}
.strip{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}@media(min-width:900px){.strip{grid-template-columns:repeat(4,minmax(0,1fr))}}
.sd{border-radius:14px;background:var(--pale);padding:14px;display:flex;flex-direction:column;gap:3px}.sd [data-lucide]{width:24px;height:24px;color:var(--forest);margin-bottom:4px}.sd b{font:800 16px Overpass}.sd span{font-size:14px;color:var(--ink75)}'''
    head = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">'
    return page('Home 3 · Map first', body, css, head)

# ---------------------------------------------------------------- menu
WO = "What's on"
MENU = {
    "What's on": [('calendar-days', 'All events', f'{NUM["upcoming"]} rides, walks, classes and talks'), ('sun', 'This weekend', f'{NUM["weekend"]} near you'),
                  ('trophy', 'Challenges', 'Beat the Bay State, Walk/Ride Day'), ('users', 'Go with someone', 'A neighbor for your first trip'),
                  ('plus-circle', 'Add your event', 'Free, listed statewide')],
    'Places': [('map', 'Your town', f'{NUM["towns"]} towns, with real trip maps'), ('trees', 'Trails', f'{NUM["trails"]} car-free paths'),
               ('flag', 'Roams', 'Walks and rides worth the trip'), ('ticket', 'Game days', 'Fenway, TD Garden, Gillette, Logan')],
    'Get there': [('route', 'Plan a trip', 'Every way there, side by side'), ('locate', "What's near you", 'T, buses and Bluebikes by an address'),
                  ('briefcase', 'Commute Advisor', 'The best way to work, compared'), ('book-open', 'Guides', 'Pay for the T, bikes on trains and more')],
    'Learn to ride': [('bike', 'Free bike lessons', 'One-on-one, on your own streets'), ('users', 'Go with someone', 'A neighbor for your first ride'),
                      ('book-open', 'First-ride guides', 'Door zones, winter riding, locking up')],
    'For organizations': [('briefcase', 'Employers', 'A team challenge, free to start'), ('school', 'Schools', 'Walk and bike to school, counted'),
                          ('landmark', 'Towns and cities', 'A spring town challenge'), ('megaphone', 'Event hosts', 'List your rides and walks'),
                          ('store', 'Local businesses', 'Become a rewards partner'), ('home', 'Property managers', 'A welcome page for new residents')],
}

def menu_items(name):
    return ''.join(f'<a class="mi"><i data-lucide="{i}"></i><span><b>{t}</b><small>{s}</small></span></a>' for i, t, s in MENU[name])

def menu():
    wo = ''.join(card_row(E[s], 56) for s in ('butternut', 'picnic', 'coffee'))
    groups = []
    for n in MENU:
        op = ' open' if n == WO else ''
        items = ''.join('<a><i data-lucide="%s"></i>%s</a>' % (i, t) for i, t, _ in MENU[n])
        groups.append('<details%s><summary>%s<i data-lucide="chevron-down"></i></summary><div class="pg">%s</div></details>' % (op, n, items))
    phone_groups = ''.join(groups)
    body = f'''<main class="wrap" style="padding-top:20px">
<h1 class="mh">Menu: desktop, "What's on" open</h1>
<div class="frame">{nav("What's on")}
<div class="mega"><div class="wrap mg"><div class="cols">{menu_items("What's on")}</div>
<div class="live2"><p class="lab2">Saturday near Somerville</p>{wo}<a class="all">See all {NUM["weekend"]} →</a></div></div></div>
<div class="dim"></div></div>

<h1 class="mh">Menu: desktop, "For organizations" open</h1>
<div class="frame">{nav("For organizations")}
<div class="mega"><div class="wrap mg"><div class="cols two">{menu_items("For organizations")}</div>
<div class="live2 org2"><p class="lab2">Not sure where to start?</p><p style="font-size:16px">Tell us what you have in mind and we'll suggest a fit.</p><a class="btn" style="margin-top:12px">Book a call</a><a class="all" style="margin-top:14px">Employer login →</a></div></div></div>
<div class="dim"></div></div>

<h1 class="mh">Menu: phone</h1>
<div class="phones">
<div class="phone"><header class="top"><div class="bar" style="padding:0 16px"><a class="brand"><img src="img/gsi-wordmark.png" alt=""></a><div class="right"><a class="get">Get Shift</a><button class="burger"><i data-lucide="x"></i></button></div></div></header>
<div class="sheet"><div class="search"><i data-lucide="search"></i>Search events, towns, trails</div>{phone_groups}
<div class="pfoot"><a class="btn" style="flex:1">Get Shift</a><a class="btn ghost" style="flex:1">Donate</a></div><p class="plinks">About · Volunteer · Contact · Help · Español · Português · 中文</p></div></div>
</div>
</main>'''
    css = '''.mh{font-size:18px;margin:26px 0 10px;color:var(--ink75)}
.frame{position:relative;border:1px solid var(--line);border-radius:14px;overflow:hidden;height:470px;background:#fafbf8}
.frame .wrap.bar{max-width:none}
.frame .nav{display:flex}.frame .donate{display:inline-block}.frame .burger{display:none}
.mega{position:relative;z-index:4;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 12px 24px rgba(25,26,46,.08)}
.mg{display:grid;grid-template-columns:1fr 360px;gap:32px;padding-top:22px;padding-bottom:24px;max-width:none}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;align-content:start}.cols.two{grid-template-columns:1fr 1fr}
.mi{display:flex;gap:12px;padding:10px;border-radius:12px}.mi:hover,.mi:first-child{background:var(--pale)}
.mi [data-lucide]{width:22px;height:22px;color:var(--forest);flex:0 0 auto;margin-top:1px}.mi b{display:block;font:800 16px Overpass}.mi small{display:block;font-size:14px;color:var(--ink75)}
.live2{border-left:1px solid var(--line);padding-left:28px;display:grid;gap:12px;align-content:start}.lab2{font:800 15px Overpass;color:var(--ink75)}
.all{font:700 15px Overpass;color:var(--forest)}
.dim{position:absolute;inset:64px 0 0;background:rgba(25,26,46,.18);z-index:1}
.phones{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:40px}
.phone{width:375px;max-width:100%;height:760px;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:#fff}
.phone .burger{display:flex}.phone .bar{height:60px}
.sheet{padding:12px 16px}
.search{display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:11px 12px;font-size:16px;color:var(--ink75);margin-bottom:6px}
details{border-bottom:1px solid var(--line)}summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:14px 2px;font:800 19px Overpass}
summary::-webkit-details-marker{display:none}
.pg{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 0 14px}.pg a{display:flex;gap:8px;align-items:center;background:var(--pale);border-radius:10px;padding:10px;font:700 15px Overpass;min-height:48px}
.pg [data-lucide]{width:18px;height:18px;color:var(--forest);flex:0 0 auto}
.pfoot{display:flex;gap:10px;margin-top:16px}.plinks{font-size:14px;color:var(--ink75);margin-top:14px}
@media(max-width:700px){.mg{grid-template-columns:1fr}.live2{border:0;padding:0}.frame{height:auto}.frame .nav{display:none}}'''
    return page('Menu', body, css)

def inline(html):
    def rep(m):
        p = os.path.join(HERE, m.group(1))
        mime = 'image/png' if p.endswith('.png') else 'image/jpeg'
        return 'src="data:%s;base64,%s"' % (mime, base64.b64encode(open(p, 'rb').read()).decode())
    return re.sub(r'src="(img/[^"]+)"', rep, html)

os.makedirs(OUT_SRC, exist_ok=True); os.makedirs(OUT_VIEW, exist_ok=True)
for name, fn in (('home-1-weekend', home1), ('home-2-doors', home2), ('home-3-map', home3), ('menu', menu)):
    h = fn()
    open(os.path.join(OUT_SRC, name + '.html'), 'w').write(h.replace('src="img/', 'src="../img/').replace('../img/lesson.jpg', '../../../../public/bike-lessons/washington-st-somerville.jpg'))
    open(os.path.join(OUT_VIEW, name + '.html'), 'w').write(inline(h))
    print(name, len(h))
