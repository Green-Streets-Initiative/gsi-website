"""Home 2 (six doors), round 2, and a donate page mockup (Keith 2026-11-19).

Keith picked six doors. The Design Lead's credibility review asked for a
"who we are" band, Donate on the phone header, and a donate page with the
form on the first screen. Keith: there are no photos of people to use
("we need to design around their absence"), so the pictures here are real
data: this month's events on a map of Massachusetts, and the logos of the
local groups whose events are on the calendar. Placeholders for what only
Keith can supply (board, finances, costs) are drawn as dashed boxes.

Data: data/ma.json (data/ma.py: us-atlas outline + next-30-day event points),
data/logos.json (host logos, saved to ../img/hosts/).
"""
import base64, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import parts as P
from parts import E, NUM, card_row, nav, footer, page

HERE = os.path.dirname(__file__)
MOCK = os.path.dirname(HERE)
OUT_VIEW = os.path.join(HERE, 'view')

spot = open(os.path.join(MOCK, 'spotlight.html')).read()
svg = re.search(r'<div class="state"><svg.*?</svg>', spot, re.S).group(0)[len('<div class="state">'):]
P.STATE_SVG = svg.replace('<svg ', '<svg style="width:100%;height:100%" ')
from parts import spotlight

MA = json.load(open(os.path.join(HERE, 'data', 'ma.json')))
LOGOS = json.load(open(os.path.join(HERE, 'data', 'logos.json')))
EV30, HOSTS30 = 150, 64          # approved events in the next 30 days, distinct host groups (2026-11-19)

ORGS = [('briefcase', 'Employers'), ('school', 'Schools'), ('landmark', 'Towns and cities'), ('calendar-plus', 'Event hosts')]


def ma_map(cls='mamap'):
    paths = ''.join(f'<path d="{d}"/>' for d in MA['paths'])
    dots = ''.join(f'<circle cx="{x}" cy="{y}" r="6"/>' for x, y in MA['dots'])
    return f'''<svg class="{cls}" viewBox="-12 -12 {MA["W"] + 24} {MA["H"] + 24}" role="img" aria-label="Map of Massachusetts with a dot for each event in the next 30 days">
<g class="land">{paths}</g><g class="dots">{dots}</g></svg>'''


MAP_CSS = '''.mamap .land path{fill:#EAF2E3;stroke:#B9CFAE;stroke-width:2;stroke-linejoin:round}
.mamap .dots circle{fill:var(--forest);fill-opacity:.72;stroke:#fff;stroke-width:1.6}'''


def logo_wall(n=12):
    return ''.join(f'<span class="lg" title="{name}"><img src="{src}" alt="{name}"></span>' for name, src, _ in LOGOS[:n])


def who_band(donate=True):
    return f'''<section class="who">
<div class="wl">
<h2>A Somerville nonprofit since 2006</h2>
<p class="lede2">Janie Katz-Christy started Walk/Ride Day in Cambridge in 2006. Twenty years on, it runs statewide.</p>
<div class="kp"><span class="av">KA</span><div><b>Keith Anderson</b><span>Executive Director</span></div><a class="kc">Get in touch →</a></div>
<div class="todo"><i data-lucide="users"></i><span><b>Board of directors</b>Names and one line each</span><em>from Keith</em></div>
<ul class="docs">
<li><a><i data-lucide="file-text"></i>2026 plan (PDF)</a></li>
<li class="todo"><i data-lucide="pie-chart"></i><span><b>2025 money in and out</b></span><em>from Keith</em></li>
<li class="todo"><i data-lucide="landmark"></i><span><b>IRS filings</b></span><em>from Keith</em></li>
</ul>
<div class="cta">{'<a class="btn donate-btn"><i data-lucide="heart"></i>Donate</a>' if donate else ''}<a class="btn ghost">About us</a></div>
</div>
<div class="wr">
<p class="num"><b>{HOSTS30}</b>local groups host the rides and walks on our calendar this month</p>
<div class="logos">{logo_wall()}</div>
<a class="more">Add your group's events →</a>
</div>
</section>'''


WHO_CSS = '''.who{display:grid;gap:22px;border-top:1px solid var(--line);margin-top:12px;padding-top:28px}
@media(min-width:900px){.who{grid-template-columns:1fr 1.1fr;gap:40px;align-items:start}}
.who h2{font-size:26px;line-height:1.15}.lede2{font-size:16px;color:var(--ink75);margin-top:6px;max-width:460px}
.kp{display:flex;align-items:center;gap:12px;margin-top:18px}.av{width:52px;height:52px;border-radius:50%;background:var(--deep);color:#fff;display:flex;align-items:center;justify-content:center;font:800 18px Overpass;flex:0 0 auto}
.kp b{display:block;font:800 17px Overpass}.kp div span{font-size:15px;color:var(--ink75)}.kc{margin-left:auto;font:700 15px Overpass;color:var(--forest);white-space:nowrap}
.todo{display:flex;align-items:center;gap:10px;border:1.5px dashed #C9CFC0;border-radius:12px;padding:10px 12px;margin-top:12px;color:var(--ink75);font-size:15px}
.todo b{display:block;color:var(--ink);font:700 15px Overpass}.todo em{margin-left:auto;font-style:normal;font-size:13px;font-weight:700;color:var(--warm);background:var(--warmbg);border-radius:999px;padding:2px 9px;white-space:nowrap}
.todo [data-lucide],.docs [data-lucide]{color:var(--forest);flex:0 0 auto}
.docs{list-style:none;padding:0;margin:0}.docs li:not(.todo) a{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:12px;border:1px solid var(--line);border-radius:12px;font:700 15px Overpass}
.who .cta{display:flex;gap:10px;margin-top:18px}
.donate-btn{background:var(--warm)}
.wr{background:var(--pale);border-radius:18px;padding:20px}
.num{font-size:16px;color:var(--ink85);line-height:1.35;max-width:420px}.num b{display:block;font:800 40px Overpass;color:var(--deep);line-height:1}
.logos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}@media(min-width:600px){.logos{grid-template-columns:repeat(4,minmax(0,1fr))}}
.lg{background:#fff;border-radius:12px;aspect-ratio:3/2;display:flex;align-items:center;justify-content:center;padding:10px}.lg img{max-width:100%;max-height:100%;object-fit:contain}
.wr .more{display:inline-block;margin-top:14px;font:700 15px Overpass;color:var(--forest)}'''

# Donate on the phone header: a small pill beside Get Shift; the wordmark shrinks to fit 375px.
NAV_PHONE_CSS = '''.donate,.get{white-space:nowrap}.donate{align-items:center;gap:5px}@media(min-width:1024px){.donate{display:inline-flex}}@media(max-width:1023px){.donate{display:inline-flex;align-items:center;gap:4px;padding:7px 11px;font-size:14px}.get{padding:8px 12px;font-size:14px}.brand img{height:19px}.bar{gap:12px}.right{gap:6px}}
@media(max-width:380px){.donate [data-lucide]{display:none}}'''


def nav2(open_item=None):
    return nav(open_item).replace('<a class="donate">Donate</a>', '<a class="donate"><i data-lucide="heart" style="width:15px;height:15px;color:var(--warm)"></i>Donate</a>')


def home2():
    nxt = ''.join(card_row(E[s], 64) for s in ('butternut', 'picnic', 'lizzie', 'coffee'))
    body = f'''{nav2()}
<main class="wrap">
<section class="hero2">
<div class="ht"><h1>Try a new way around Massachusetts</h1>
<p class="lede">Group rides and walks, maps of real trips, and free lessons, from a Somerville nonprofit.</p>
<div class="cta"><a class="btn">See what's on</a><a class="btn ghost">Plan a trip</a></div></div>
<figure class="hmap">{ma_map()}
<figcaption><b>{EV30}</b> rides, walks and classes in the next 30 days, from {HOSTS30} local groups</figcaption></figure>
</section>
<section class="doors">
<div class="door d-on"><div class="dh"><h2>What's on</h2><a>{NUM["upcoming"]} events →</a></div><div class="nx">{nxt}</div></div>
<a class="door d-pl"><img class="fill" src="img/minuteman-bikeway.jpg" alt=""><div class="ov2"><h2>Places</h2><p>{NUM["trails"]} trails · {NUM["towns"]} towns</p></div><span class="cr">Photo: Daderot, public domain</span></a>
<div class="door d-gt"><h2>Get there</h2><label><small>From</small>Union Square</label><label><small>To</small>Fenway Park</label><a class="btn" style="width:100%">Show me the ways</a></div>
<a class="door d-lr"><img class="fill" src="img/lesson.jpg" alt=""><div class="ov2"><h2>Learn to ride</h2><p>Free lessons on your own streets</p></div><span class="cr">Photo: 4300streetcar, CC BY 4.0</span></a>
<div class="door d-or"><h2>For organizations</h2><div class="oc">{''.join(f'<a><i data-lucide="{i}"></i>{t}</a>' for i, t in ORGS)}</div><a class="more">Book a call →</a></div>
<a class="door d-sh"><h2>Get Shift</h2><p>Live departures, bike share and every way to go, in one free app.</p><p class="big"><b>{NUM["members"]}</b> people use it</p><span class="btn">Get the app</span></a>
</section>
<section>{spotlight()}</section>
{who_band()}
</main>{footer()}'''
    css = '''section{padding:16px 0}
.hero2{display:grid;gap:18px;padding-top:24px}@media(min-width:900px){.hero2{grid-template-columns:1fr 1.1fr;align-items:center;gap:36px}}
.hero2 h1{font-size:32px;line-height:1.08}@media(min-width:900px){.hero2 h1{font-size:48px}}
.lede{font-size:17px;color:var(--ink75);margin-top:10px;max-width:460px}.cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.hmap{margin:0;background:var(--pale);border-radius:18px;padding:14px 14px 16px}.hmap svg{width:100%;height:auto;display:block}
.hmap figcaption{font-size:16px;color:var(--ink85);margin-top:6px;padding:0 4px}.hmap figcaption b{font:800 24px Overpass;color:var(--deep);margin-right:4px}
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
.d-sh .btn{background:#fff;color:var(--ink)}''' + MAP_CSS + WHO_CSS + NAV_PHONE_CSS
    return page('Home 2 · Six doors, round 2', body, css)


def donate():
    amts = [('10', False), ('25', False), ('35', True), ('100', False)]
    amt_html = ''.join(f'<span class="am{" on" if on else ""}">${a}</span>' for a, on in amts)
    body = f'''{nav2()}
<main class="wrap">
<section class="dn">
<div class="dhd">
<h1>Help more people try walking, biking and transit</h1>
<p class="lede">Your gift keeps our lessons, Walk/Ride Day and the events calendar free for everyone.</p>
</div>
<div class="dl">
<ul class="pays">
<li><span class="ic"><i data-lucide="bike"></i></span><div><b>Free bike lessons</b><span>With a local instructor, on your own streets</span></div></li>
<li><span class="ic"><i data-lucide="calendar-days"></i></span><div><b>{EV30} events</b><span>On the free calendar in the next 30 days</span></div></li>
<li><span class="ic"><i data-lucide="footprints"></i></span><div><b>Walk/Ride Day</b><span>One Friday a month, since 2006</span></div></li>
</ul>
<figure class="dmap">{ma_map()}<figcaption>Each dot is a ride, walk or class in the next 30 days.</figcaption></figure>
</div>
<div class="give">
<div class="tog"><span>Once</span><span class="on">Monthly</span></div>
<div class="ams">{amt_html}<span class="am other">Other</span></div>
<p class="what"><i data-lucide="bike"></i><span><b>$35 a month</b> pays for an hour of a free bike lesson.</span><em>Keith confirms</em></p>
<a class="btn givebtn"><i data-lucide="heart"></i>Give $35 a month</a>
<p class="sec"><i data-lucide="lock"></i>Secure checkout by Donorbox</p>
<div class="org"><span class="av">KA</span><p><b>Green Streets Initiative</b>501(c)(3) nonprofit · EIN 26-1484405<br>Gifts are tax-deductible. Questions? Keith Anderson, Executive Director.</p></div>
</div>
</section>
{who_band(False)}
<section class="other">
<h2>Other ways to give</h2>
<div class="ow">
<div><i data-lucide="mail"></i><b>Mail a check</b><span>Green Streets Initiative, 519 Somerville Ave, Somerville</span></div>
<div><i data-lucide="briefcase"></i><b>Ask your employer to match it</b><span>Many will double your gift</span></div>
<div><i data-lucide="calendar-plus"></i><b>Give your time</b><span>Host a ride or walk on our calendar</span></div>
</div>
</section>
</main>{footer()}'''
    css = '''section{padding:16px 0}
.dn{display:grid;gap:18px;padding-top:24px;grid-template-areas:"hd" "gv" "dl"}.dhd{grid-area:hd}.give{grid-area:gv}.dl{grid-area:dl}
@media(min-width:900px){.dn{grid-template-columns:1.15fr 1fr;grid-template-areas:"hd gv" "dl gv";column-gap:44px;row-gap:0;align-items:start;padding-top:36px}}
.dn h1{font-size:30px;line-height:1.1}@media(min-width:900px){.dn h1{font-size:44px}}
.lede{font-size:17px;color:var(--ink75);margin-top:10px;max-width:480px}
.pays{list-style:none;padding:0;margin:18px 0 0;display:grid;gap:12px}.pays li{display:flex;gap:12px;align-items:center}
.ic{width:42px;height:42px;border-radius:12px;background:var(--pale);display:flex;align-items:center;justify-content:center;flex:0 0 auto}.ic [data-lucide]{color:var(--forest);width:20px;height:20px}
.pays b{display:block;font:800 17px Overpass}.pays span{font-size:15px;color:var(--ink75)}
.dmap{margin:18px 0 0;max-width:460px}.dmap svg{width:100%;height:auto;display:block}.dmap figcaption{font-size:14px;color:var(--ink75);margin-top:4px}
@media(max-width:899px){.dmap{display:none}}
.give{border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:0 4px 18px #191A2E12;background:#fff}
.tog{display:grid;grid-template-columns:1fr 1fr;background:var(--pale);border-radius:12px;padding:4px}.tog span{text-align:center;padding:10px;border-radius:9px;font:700 16px Overpass;color:var(--ink75)}.tog .on{background:#fff;color:var(--ink);box-shadow:0 1px 3px #0002}
.ams{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:14px}.am{border:1.5px solid var(--line);border-radius:10px;height:48px;display:flex;align-items:center;justify-content:center;font:800 17px Overpass}
.am.on{border-color:var(--warm);background:var(--warmbg);color:var(--warm)}.am.other{font-size:15px;color:var(--ink75)}
.what{display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:15px;color:var(--ink85);flex-wrap:wrap}.what [data-lucide]{color:var(--warm);flex:0 0 auto;margin-top:2px}.what span{flex:1;min-width:180px}
.what em{font-style:normal;font-size:13px;font-weight:700;color:var(--warm);background:var(--warmbg);border:1.5px dashed var(--warmline);border-radius:999px;padding:1px 9px}
.givebtn{width:100%;margin-top:16px;height:52px;font-size:17px;background:var(--warm)}
.sec{display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;color:var(--ink75);margin-top:8px}.sec [data-lucide]{width:15px;height:15px}
.org{display:flex;gap:12px;align-items:center;border-top:1px solid var(--line);margin-top:16px;padding-top:14px}.org p{font-size:14px;color:var(--ink75);line-height:1.4}.org b{display:block;color:var(--ink);font:800 15px Overpass}
.org .av{width:44px;height:44px;font-size:15px}
.other h2{font-size:22px;margin-bottom:12px}.ow{display:grid;gap:12px}@media(min-width:900px){.ow{grid-template-columns:repeat(3,1fr)}}
.ow div{border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:center}.ow [data-lucide]{grid-row:span 2;color:var(--forest)}
.ow b{font:800 16px Overpass}.ow span{font-size:15px;color:var(--ink75)}''' + MAP_CSS + WHO_CSS + NAV_PHONE_CSS
    return page('Donate', body, css)


def inline(html):
    # small copies of the photos live in the scratchpad (homegen/img); logos and originals in ../img
    dirs = [os.environ.get('HOMEGEN', ''), MOCK]
    def rep(m):
        p = next(os.path.join(d, m.group(1)) for d in dirs if d and os.path.exists(os.path.join(d, m.group(1))))
        mime = 'image/png' if p.endswith('.png') else 'image/jpeg'
        return 'src="data:%s;base64,%s"' % (mime, base64.b64encode(open(p, 'rb').read()).decode())
    return re.sub(r'src="(img/[^"]+)"', rep, html)


os.makedirs(OUT_VIEW, exist_ok=True)
for name, fn in (('home-2-doors-v2', home2), ('donate', donate)):
    h = fn()
    open(os.path.join(HERE, name + '.html'), 'w').write(h.replace('src="img/', 'src="../img/').replace('../img/lesson.jpg', '../../../../public/bike-lessons/washington-st-somerville.jpg'))
    v = inline(h)
    open(os.path.join(OUT_VIEW, name + '.html'), 'w').write(v)
    print(name, len(h), len(v))
