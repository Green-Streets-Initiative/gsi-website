"""Shared pieces for the home + menu mockups (2026-11-19). Real events for
Nov 20-23 near Union Square, real photos with credits, live numbers."""
import math

LINE = {'Green': '#00843D', 'Orange': '#ED8B00', 'Red': '#DA291C', 'Blue': '#003DA5', 'bus': '#FFC72C'}

EVENTS = [
    dict(slug='butternut', day='Sat', d=21, time='10 AM', title='Butternut Bake House Ride', host='Boston Cafe Bikers', kind='Group ride',
         logo='https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/ride-flyers/organizer-logos/boston-cafe-bikers-1792790264.png',
         lat=42.379609, lng=-71.095519, stop='Union Square', line='Green', ride=('Easy', 'No-drop'), mi=0.1),
    dict(slug='picnic', day='Sat', d=21, time='11 AM', title='Fall Bike Picnic, Social and Food Drive', host='Boston Pedals', kind='Social',
         img='https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/community-event-images/flyer_boston-pedals-fall-bike-picnic_2026-11-21.jpg',
         lat=42.339661, lng=-71.073524, stop='Back Bay', line='Orange', mi=2.9),
    dict(slug='lizzie', day='Sat', d=21, time='1 PM', title='Lizzie Learns to Ride: book launch', host='Turtle Books', kind='Talk',
         logo='https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/ride-flyers/organizer-logos/turtle-books-26ec087127.png',
         lat=42.332464, lng=-71.118694, stop='Brookline Village', line='Green', mi=3.5),
    dict(slug='physics', day='Sat', d=21, time='2 PM', title='Physics of Bikes', host='BU Cycle Kitchen', kind='Class',
         lat=42.352182, lng=-71.121346, stop='Babcock Street', line='Green', mi=2.4),
    dict(slug='coffee', day='Sun', d=22, time='10 AM', title='Thankful for Coffee', host='Boston Cafe Bikers', kind='Group ride',
         logo='https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/ride-flyers/organizer-logos/boston-cafe-bikers-1792790264.png',
         lat=42.337145, lng=-71.089432, stop='Ruggles', line='Orange', ride=('Easy', 'No-drop'), mi=2.9),
    dict(slug='freshpond', day='Sun', d=22, time='3:15 PM', title='Sunset Walk at Fresh Pond', host='Boston Walking Meetup', kind='Walk',
         lat=42.378751, lng=-71.147295, stop='Huron Ave, bus 75', line='bus', mi=2.7),
    dict(slug='arboretum', day='Sat', d=21, time='8 AM', title='Family Wellness Walk', host='Arnold Arboretum', kind='Walk',
         img='https://arboretum.harvard.edu/wp-content/uploads/2026/11/Family-Wellness-Walks-landscape.jpg-smaller-scaled.jpg',
         lat=42.307735, lng=-71.120728, stop='Forest Hills', line='Orange', mi=5.2),
    dict(slug='trivia', day='Mon', d=23, time='6 PM', title='Streetwise: Transportation Trivia', host='SASS and PTAC', kind='Talk',
         lat=42.381978, lng=-71.106255, stop='Somerville Ave, bus 87', line='bus', mi=0.7),
]
E = {e['slug']: e for e in EVENTS}

PLACES = [
    ('community-path', 'Somerville Community Path', 'Flat · car-free · 3.2 mi', '4300streetcar, CC BY 4.0'),
    ('minuteman-bikeway', 'Minuteman Bikeway', 'Flat · car-free · 10 mi', 'Daderot, public domain'),
    ('charles-river-path', 'Charles River paths', 'Flat · river views', '4300streetcar, CC BY 4.0'),
    ('concord-bikes-on-the-train', 'Train and bike to Concord', 'Bikes ride free off-peak', '4300streetcar, CC BY 4.0'),
]

NUM = dict(trips_month='7,972', members='419', upcoming='277', weekend='21', trails='28', towns='90')


def tile_xy(lat, lng, z):
    n = 2 ** z
    x = (lng + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def map_square(lat, lng, size, z=15, pin=True):
    """A real street map (CARTO Voyager, OSM data) centred on the spot."""
    x, y = tile_xy(lat, lng, z)
    tx, ty = int(x), int(y)
    px, py = (x - tx + 1) * 256, (y - ty + 1) * 256  # point inside a 3x3 block starting one tile up-left
    tiles = ''.join(
        f'<img src="https://www.gogreenstreets.org/api/map-tiles/{z}/{tx+dx}/{ty+dy}" style="position:absolute;left:{(dx+1)*256}px;top:{(dy+1)*256}px;width:256px;height:256px" alt="">'
        for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    off = f'left:{size/2 - px:.0f}px;top:{size/2 - py:.0f}px'
    p = '<span class="pin"></span>' if pin else ''
    return f'<div class="mapsq" style="width:100%;height:100%"><div style="position:absolute;width:768px;height:768px;{off}">{tiles}</div>{p}</div>'


def stop_line(e):
    color = LINE[e['line']]
    ring = 'border-radius:3px' if e['line'] == 'bus' else 'border-radius:50%'
    return f'<span class="stop"><i style="background:{color};{ring}"></i>{e["stop"]}</span>'


def under(e):
    if e.get('ride'):
        lvl, nd = e['ride']
        return f'<span class="lvl"><b class="m1"></b><b></b><b></b>{lvl}</span><span class="chip">{nd}</span>'
    return stop_line(e)


def picture(e, size):
    if e.get('img'):
        inner = f'<img class="fill" src="{e["img"]}" alt="">'
    elif e.get('logo'):
        inner = f'<div class="logo"><img src="{e["logo"]}" alt="{e["host"]} logo"></div>'
    else:
        inner = map_square(e['lat'], e['lng'], size)
    return inner


def date_tile(e):
    return f'<span class="dt"><small>{e["day"]}</small><b>{e["d"]}</b></span>'


def card_photo(e):
    """Tall card for a row: picture on top, date tile on it."""
    return f'''<a class="pc"><div class="pic">{picture(e, 280)}{date_tile(e)}</div>
<h3>{e["title"]}</h3><p class="meta">{e["time"]} · {e["host"]}</p><p class="under">{under(e)}</p></a>'''


def card_row(e, size=76):
    """Compact row: square picture, text beside it."""
    return f'''<a class="rc"><div class="sq" style="width:{size}px;height:{size}px">{picture(e, size)}</div>
<div class="tx"><h3>{e["title"]}</h3><p class="meta">{e["day"]} {e["time"]} · {e["host"]}</p><p class="under">{under(e)}</p></div></a>'''


NAV_ITEMS = ["What's on", 'Places', 'Get there', 'Learn to ride', 'For organizations']


def nav(open_item=None):
    links = ''.join(f'<a class="{"on" if n == open_item else ""}">{n}{"<i data-lucide=chevron-down></i>" if True else ""}</a>' for n in NAV_ITEMS)
    return f'''<header class="top"><div class="wrap bar">
<a class="brand"><img src="img/gsi-wordmark.png" alt="Green Streets Initiative"></a>
<nav class="nav">{links}</nav>
<div class="right"><a class="donate">Donate</a><a class="get">Get Shift</a><button class="burger" aria-label="Menu"><i data-lucide="menu"></i></button></div>
</div></header>'''


CSS = r'''
:root{--ink:#191A2E;--ink85:#2F3150;--ink75:#4A4D68;--line:#E3E6DD;--forest:#2D6A4F;--deep:#1B4332;--pale:#F4F8EE;--warm:#9A4A12;--warmbg:#F8F1EC;--warmline:#EAD8C8}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font:16px/1.45 "DM Sans",sans-serif}
h1,h2,h3,.ov{font-family:Overpass,sans-serif;font-weight:800;letter-spacing:-.01em;margin:0}
a{color:inherit;text-decoration:none;cursor:pointer}
p{margin:0}
.wrap{max-width:1200px;margin:0 auto;padding:0 16px}
@media(min-width:900px){.wrap{padding:0 32px}}
[data-lucide]{width:18px;height:18px;stroke-width:2}
/* nav */
.top{border-bottom:1px solid var(--line);background:#fff;position:relative;z-index:5}
.bar{display:flex;align-items:center;gap:28px;height:64px}
.brand img{height:22px;display:block}
.nav{display:none;gap:4px;font:700 15px Overpass}
.nav a{display:flex;align-items:center;gap:3px;padding:8px 10px;border-radius:8px}
.nav a [data-lucide]{width:15px;height:15px;opacity:.7}
.nav a.on{background:var(--pale);color:var(--deep)}
.right{margin-left:auto;display:flex;align-items:center;gap:10px}
.donate{display:none;font:700 15px Overpass;padding:8px 12px;border:1px solid var(--line);border-radius:999px}
.get{background:var(--forest);color:#fff;padding:9px 16px;border-radius:999px;font:800 15px Overpass}
.burger{border:0;background:none;padding:6px;display:flex}
.burger [data-lucide]{width:26px;height:26px}
@media(min-width:1024px){.nav{display:flex}.donate{display:inline-block}.burger{display:none}}
/* bits */
.dt{position:absolute;left:6px;top:6px;background:#fff;border-radius:8px;padding:3px 7px 2px;text-align:center;line-height:1.05;box-shadow:0 1px 3px #0003;font-family:Overpass}
.dt small{display:block;font-size:12px;font-weight:800;color:var(--forest)}.dt b{font-size:18px;font-weight:800}
.mapsq{position:relative;overflow:hidden;background:#EEF0EA}
.pin{position:absolute;left:50%;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:var(--forest);border:3px solid #fff;box-shadow:0 1px 4px #0005}
.logo{width:100%;height:100%;background:#fff;display:flex;align-items:center;justify-content:center;padding:14%}
.logo img{max-width:100%;max-height:100%;object-fit:contain}
img.fill{width:100%;height:100%;object-fit:cover;display:block}
.stop{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:var(--ink85)}
.stop i{width:10px;height:10px;display:inline-block}
.lvl{display:inline-flex;align-items:flex-end;gap:2px;font-size:14px;color:var(--ink85);margin-right:8px}
.lvl b{width:4px;height:8px;background:#D5D9CF;border-radius:1px}.lvl b:nth-child(2){height:11px}.lvl b:nth-child(3){height:14px;margin-right:5px}.lvl b.m1{background:var(--forest)}
.chip{display:inline-block;font-size:13px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--pale);color:var(--deep)}
.meta{font-size:14px;color:var(--ink75);margin-top:3px}
.under{margin-top:6px}
.credit{font-size:13px;color:var(--ink75);margin-top:4px}
.rowh{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:14px}
.rowh h2{font-size:22px}.rowh a{font:700 15px Overpass;color:var(--forest);white-space:nowrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:46px;padding:0 18px;border-radius:10px;font:800 16px Overpass;background:var(--forest);color:#fff}
.btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
/* photo card */
.pc{display:block;min-width:0}
.pc .pic{position:relative;aspect-ratio:4/3;border-radius:14px;overflow:hidden;background:var(--pale);border:1px solid var(--line)}
.pc h3{font-size:17px;line-height:1.25;margin-top:10px}
/* row card */
.rc{display:flex;gap:12px;align-items:flex-start;min-width:0}
.rc .sq{position:relative;flex:0 0 auto;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:var(--pale)}
.rc .sq .dt{left:4px;top:4px;padding:2px 5px 1px}.rc .sq .dt small{font-size:11px}.rc .sq .dt b{font-size:15px}
.rc .tx{min-width:0}.rc h3{font-size:16px;line-height:1.25}
/* spotlight strip */
.spot{display:flex;align-items:center;gap:14px;border:1px solid var(--warmline);background:var(--warmbg);border-radius:16px;padding:12px 14px}
.spot .st{flex:0 0 auto;width:96px;height:66px;background:#fff;border:1px solid var(--warmline);border-radius:10px;padding:5px}
.spot .lab{font-size:14px;font-weight:600;color:var(--warm);display:flex;gap:6px;align-items:center}
.spot h3{font-size:17px;margin-top:2px}
.spot .bar2{height:7px;border-radius:4px;background:rgba(154,74,18,.15);margin-top:7px;max-width:300px}.spot .bar2 i{display:block;height:100%;width:63%;background:var(--warm);border-radius:4px}
.spot .mt{display:flex;justify-content:space-between;max-width:300px;font-size:14px;color:var(--ink85);margin-top:3px}
.spot .go{margin-left:auto;background:var(--warm);color:#fff;font:800 15px Overpass;border-radius:10px;padding:11px 14px;white-space:nowrap}
@media(max-width:640px){.spot{flex-wrap:wrap}.spot .go{width:100%;text-align:center;margin:0}.spot>div:nth-child(2){flex:1;min-width:0}}
/* footer */
.foot{border-top:1px solid var(--line);margin-top:28px;padding:22px 0 30px;font-size:14px;color:var(--ink75)}
.foot .wrap{display:flex;flex-wrap:wrap;gap:8px 20px}
.foot b{color:var(--ink)}
'''

STATE_SVG = None  # filled by build.py from the Spotlight mockup


def spotlight():
    return f'''<div class="spot"><div class="st">{STATE_SVG}</div>
<div><p class="lab"><i data-lucide="trophy" style="width:16px;height:16px"></i>Spotlight · Community Challenge</p>
<h3>Beat the Bay State: walk with Team Green Streets</h3>
<div class="bar2"><i></i></div><div class="mt"><span>Nov 1 to 30</span><b>11 days left</b></div></div>
<a class="go">Join the team →</a></div>'''


def footer():
    return '''<footer class="foot"><div class="wrap"><b>Green Streets Initiative</b><span>519 Somerville Ave, Somerville</span><a>About</a><a>Programs</a><a>Volunteer</a><a>Contact</a><a>Press</a><a>Help</a><a>Español · Português · 中文</a></div></footer>'''


def page(title, body, extra_css='', head_extra=''):
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Overpass:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap">
{head_extra}
<style>{CSS}{extra_css}</style></head><body>
{body}
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script><script>lucide.createIcons()</script>
</body></html>'''
