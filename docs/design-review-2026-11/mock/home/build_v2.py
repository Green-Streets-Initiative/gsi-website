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


# Town names on the map (polish 2026-11-20: a map of dots with no names can't answer "is anything near me?").
# Projected with the same equirectangular fit as data/ma.py; anchor: r = right of the point, b = below, t = above.
TOWNS = [('Boston', 410.5, 119.2, 'r'), ('Lowell', 367.4, 57.3, 't'), ('Worcester', 285.9, 141.3, 'b'),
         ('Springfield', 153.8, 177.7, 'b'), ('Pittsfield', 43.9, 98.8, 'b'), ('Cape Cod', 537.7, 268.6, 'b')]


def ma_map(cls='mamap', labels=False):
    paths = ''.join(f'<path d="{d}"/>' for d in MA['paths'])
    dots = ''.join(f'<circle cx="{x}" cy="{y}" r="6"/>' for x, y in MA['dots'])
    svg = f'''<svg class="{cls}" viewBox="-12 -12 {MA["W"] + 24} {MA["H"] + 24}" role="img" aria-label="Map of Massachusetts with a dot for each event in the next 30 days">
<g class="land">{paths}</g><g class="dots">{dots}</g></svg>'''
    if not labels:
        return svg
    W, H = MA['W'] + 24, MA['H'] + 24
    tags = ''.join(f'<span class="tn tn-{a}" style="left:{(x + 12) / W * 100:.1f}%;top:{(y + 12) / H * 100:.1f}%">{t}</span>' for t, x, y, a in TOWNS)
    return f'<div class="mapwrap">{svg}{tags}</div>'


MAP_CSS = '''.mamap .land path{fill:#EAF2E3;stroke:#B9CFAE;stroke-width:2;stroke-linejoin:round}
.mamap .dots circle{fill:var(--forest);fill-opacity:.72;stroke:#fff;stroke-width:1.6}
.mapwrap{position:relative}.tn{position:absolute;font:700 14px Overpass;color:var(--ink);background:rgba(255,255,255,.88);border-radius:6px;padding:1px 6px;white-space:nowrap;pointer-events:none}
.tn-r{transform:translate(14px,-50%)}.tn-b{transform:translate(-50%,10px)}.tn-t{transform:translate(-50%,calc(-100% - 10px))}
@media(max-width:600px){.tn{font-size:13px;padding:0 4px}}'''


def logo_wall(n=12):
    return ''.join(f'<span class="lg" title="{name}"><img src="{src}" alt="{name}"></span>' for name, src, _ in LOGOS[:n])


def who_band(donate=True):
    return f'''<section class="who">
<div class="wl">
<h2>A Somerville nonprofit since 2006</h2>
<p class="lede2">Janie Katz-Christy started Walk/Ride Day in Cambridge in 2006. Twenty years on, it runs statewide.</p>
<div class="kp"><span class="av">KA</span><div><b>Keith Anderson</b><span>Executive Director</span></div><a class="kc">Get in touch →</a></div>
<div class="docs">
<a class="doc"><i data-lucide="file-text"></i><b>2026 plan</b><span>PDF</span></a>
<div class="doc todo"><i data-lucide="users"></i><b>Board of directors</b><em>from Keith</em></div>
<div class="doc todo"><i data-lucide="pie-chart"></i><b>2025 money in and out</b><em>from Keith</em></div>
<div class="doc todo"><i data-lucide="landmark"></i><b>IRS filings</b><em>from Keith</em></div>
</div>
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
.docs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
.doc{display:flex;flex-direction:column;align-items:flex-start;gap:4px;border:1px solid var(--line);border-radius:12px;padding:12px;min-height:96px}
.doc b{font:700 15px Overpass;color:var(--ink);line-height:1.2}.doc span{font-size:14px;color:var(--ink75)}.doc [data-lucide]{color:var(--forest);width:20px;height:20px;margin-bottom:2px}
.doc.todo{border:1.5px dashed #C9CFC0}.doc em{margin-top:auto;font-style:normal;font-size:13px;font-weight:700;color:var(--warm);background:var(--warmbg);border-radius:999px;padding:2px 9px;white-space:nowrap}
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
<p class="lede">Group rides and walks, trail and town maps, and free bike lessons, from a Somerville nonprofit.</p>
<div class="cta"><a class="btn">See what's on</a><a class="btn ghost">Plan a trip</a></div></div>
<figure class="hmap">{ma_map(labels=True)}
<figcaption><b>{EV30}</b> rides, walks and classes in the next 30 days</figcaption></figure>
</section>
<section class="doors">
<div class="door d-on"><div class="dh"><h2>What's on</h2><a>See the calendar →</a></div><div class="nx">{nxt}</div></div>
<a class="door d-pl"><img class="fill" src="img/minuteman-bikeway.jpg" alt=""><div class="ov2"><h2>Places</h2><p>{NUM["trails"]} trails · {NUM["towns"]} towns</p><span class="cr">Photo: Daderot, public domain</span></div></a>
<p class="crs">Photos: Daderot, public domain; 4300streetcar, CC BY 4.0</p>
<div class="door d-gt"><h2>Get there</h2><label><small>From</small><span class="ph">Address or T stop</span><span class="loc"><i data-lucide="locate-fixed"></i>Use where I am</span></label><label><small>To</small><span class="ph">Where to?</span></label><a class="btn" style="width:100%">Show me the ways</a></div>
<a class="door d-lr"><img class="fill" src="img/lesson.jpg" alt=""><div class="ov2"><h2>Learn to ride</h2><p>Free lessons on your own streets</p><span class="cr">Photo: 4300streetcar, CC BY 4.0</span></div></a>
<div class="door d-or"><h2>For organizations</h2><div class="oc">{''.join(f'<a><i data-lucide="{i}"></i>{t}</a>' for i, t in ORGS)}</div><a class="more">Book a call →</a></div>
<a class="door d-sh"><span class="shot"><img src="img/shift-around-you.jpg" alt="The Shift app's Around you card: the 85 bus at Ruggles in 2 minutes, the E train at Medford/Tufts in 6, and 8 bikes nearby"></span>
<div class="shc"><h2>Get Shift</h2><p>Live departures, bike share and every way to go, in one free app.</p><div class="shr"><p class="big"><b>{NUM["members"]}</b> people use it</p><span class="btn">Get the app</span></div></div></a>
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
.doors{display:grid;gap:14px;grid-template-columns:1fr 1fr;grid-template-areas:"on on" "pl lr" "crs crs" "gt gt" "or or" "sh sh"}.crs{grid-area:crs;font-size:13px;color:var(--ink75);margin:-6px 0 0}
@media(min-width:900px){.crs{display:none}}@media(max-width:899px){.ov2 .cr{display:none}.d-pl p,.d-lr p{font-size:14px}}
.d-on{grid-area:on}.d-pl{grid-area:pl}.d-gt{grid-area:gt}.d-lr{grid-area:lr}.d-or{grid-area:or}.d-sh{grid-area:sh}
@media(max-width:899px){.d-pl,.d-lr{min-height:190px}.d-pl h2,.d-lr h2{font-size:20px}.ov2{padding:30px 12px 12px}}
@media(min-width:900px){.doors{grid-template-columns:1.25fr 1fr 1fr;grid-template-rows:auto auto;grid-template-areas:"on pl gt" "on lr or" "sh sh sh"}
.d-on{grid-area:on}.d-pl{grid-area:pl}.d-gt{grid-area:gt}.d-lr{grid-area:lr}.d-or{grid-area:or}.d-sh{grid-area:sh}}
.door{position:relative;border-radius:18px;overflow:hidden;border:1px solid var(--line);padding:18px;min-height:200px;display:block}
.door h2{font-size:22px}
.dh{display:flex;justify-content:space-between;align-items:baseline}.dh a{font:700 15px Overpass;color:var(--forest)}
.d-on{background:var(--pale);border-color:transparent}.nx{display:grid;gap:14px;margin-top:14px}
.d-pl,.d-lr{padding:0;min-height:220px}.d-pl img,.d-lr img{position:absolute;inset:0}
.ov2{position:absolute;left:0;right:0;bottom:0;padding:40px 16px 14px;background:linear-gradient(transparent,rgba(25,26,46,.8));color:#fff}.ov2 p{font-size:15px;margin-top:2px}
.ov2 .cr{display:block;color:rgba(255,255,255,.88);font-size:13px;margin-top:4px}@media(max-width:899px){.ov2 .cr{display:none}}
.d-gt label{display:flex;flex-wrap:wrap;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:10px;padding:7px 12px;margin:8px 0;font-size:16px}.d-gt label small{flex:0 0 100%;font-size:13px;color:var(--ink75)}
.d-gt .ph{color:var(--ink75)}.d-gt .loc{margin-left:auto;display:inline-flex;align-items:center;gap:4px;font:700 14px Overpass;color:var(--forest)}.d-gt .loc [data-lucide]{width:15px;height:15px}
.oc{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.oc a{display:flex;gap:7px;align-items:center;font:700 15px Overpass;background:var(--pale);border-radius:10px;padding:10px}
.oc [data-lucide]{width:18px;height:18px;color:var(--forest)}.more{display:inline-block;margin-top:12px;font:700 15px Overpass;color:var(--forest)}
.d-sh{background:var(--ink);color:#fff;border:0;display:grid;gap:16px;min-height:0;padding:0}
.d-sh .shot{display:block;aspect-ratio:4/3;overflow:hidden}.d-sh .shot img{width:100%;height:100%;object-fit:cover;object-position:0 36%;display:block}
.d-sh .shc{padding:0 18px 18px}.d-sh h2{font-size:24px}
.d-sh p{font-size:16px;color:rgba(255,255,255,.85);margin-top:6px;max-width:440px}.shr{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:12px}.d-sh .big{margin:0}.d-sh .big b{font:800 26px Overpass;color:#8FD3A8;margin-right:4px}
.d-sh .btn{background:#fff;color:var(--ink)}
@media(min-width:900px){.d-sh{grid-template-columns:300px 1fr;align-items:center;gap:32px}.d-sh .shot{aspect-ratio:1.05}.d-sh .shc{padding:18px 24px 18px 0}.d-sh h2{font-size:28px}}''' + MAP_CSS + WHO_CSS + NAV_PHONE_CSS
    return page('Home 2 · Six doors, round 2', body, css)


def donate():
    # Keith 2026-11-19: monthly is the accessible ask, benchmarked to an everyday bill;
    # $35 is a one-time amount (memory feedback_donation_amounts).
    def amts(vals, on):
        return ''.join(f'<span class="am{" on" if a == on else ""}">${a}</span>' for a in vals) + '<span class="am other">Other</span>'
    form_monthly = f'''<div class="ams">{amts(['5', '10', '15', '25'], '10')}</div>
<p class="what"><i data-lucide="tv"></i><span><b>$10 a month</b>, about what a streaming plan costs.</span></p>
<a class="btn givebtn"><i data-lucide="heart"></i>Give $10 a month</a>'''
    form_once = f'''<div class="ams">{amts(['20', '35', '50', '100'], '35')}</div>
<p class="what"><i data-lucide="bike"></i><span><b>$35</b> covers an hour of expert instruction from a local, <span style="white-space:nowrap">Bike League-certified</span> instructor.</span></p>
<a class="btn givebtn"><i data-lucide="heart"></i>Give $35</a>'''
    # Walk/Ride Day is the last Friday of every month (src/app/programs/walk-ride-days): a calendar page
    # with that day marked, no month named so it stays true all year.
    cells = ''.join('<i class="on"><b data-lucide="footprints"></b></i>' if (r, c) == (4, 4) else '<i></i>' for r in range(5) for c in range(7))
    wrd_cal = f'<div class="cal"><div class="cdh">{"".join(f"<span>{d}</span>" for d in "MTWTFSS")}</div><div class="cg">{cells}</div></div>'
    ty_events = ''.join(card_row(E[s], 56) for s in ('butternut', 'picnic'))
    body = f'''{nav2()}
<main class="wrap">
<section class="dn">
<div class="dhd">
<h1>Help more people try walking, biking and transit</h1>
<p class="lede">Your gift keeps our lessons, Walk/Ride Day and the events calendar free for everyone.</p>
</div>
<div class="dl">
<h2 class="pt">What your gift pays for</h2>
<div class="tiles">
<figure class="t t-map"><div class="pic">{ma_map()}</div><figcaption><b>{EV30} events</b><span>On the free calendar in the next 30 days</span></figcaption></figure>
<figure class="t t-les"><div class="pic"><img src="img/lesson.jpg" alt="The bike lane on Washington Street in Somerville"></div><figcaption><b>Free bike lessons</b><span>With a local instructor, on your own streets</span><small class="pcr">Photo: 4300streetcar, CC BY 4.0</small></figcaption></figure>
<figure class="t t-wrd"><div class="pic">{wrd_cal}</div><figcaption><b>Walk/Ride Day</b><span>Last Friday of every month, since 2006</span></figcaption></figure>
</div>
</div>
<div class="give">
<div class="tog"><a href="#once" data-t="once">Once</a><a href="#monthly" data-t="monthly">Monthly</a></div>
<div class="fm" data-f="monthly">{form_monthly}</div><div class="fm" data-f="once">{form_once}</div>
<div class="fm ty" data-f="thanks"><i data-lucide="heart"></i><h2>Thank you</h2><p>Your receipt from Donorbox is on its way by email.</p>
<p class="tyn">See what your gift keeps free this weekend:</p><div class="nx">{ty_events}</div><a class="btn" style="width:100%">See what's on</a></div>
<p class="sec"><i data-lucide="lock"></i>Secure checkout by Donorbox</p>
<p class="org"><b>Green Streets Initiative</b> is a 501(c)(3) nonprofit, EIN 26-1484405. Gifts are tax-deductible.</p>
<div class="ask"><span class="av">KA</span><p>Questions? <a>Email Keith Anderson</a>, Executive Director</p></div>
</div>
</section>
{who_band(False)}
<section class="other">
<h2>Other ways to give</h2>
<div class="ow">
<div class="env"><b>Mail a check</b><div class="envp"><span class="stamp"><i data-lucide="bike"></i></span><p>Green Streets Initiative<br>519 Somerville Ave, Ste 2, Box 103<br>Somerville, MA 02143</p></div></div>
<div class="ows">
<a><i data-lucide="briefcase"></i><span><b>Ask your employer to match it</b>Many employers match gifts to nonprofits</span></a>
<a><i data-lucide="calendar-plus"></i><span><b>Give your time</b>Host a ride or walk on our calendar</span></a>
</div>
</div>
</section>
</main>{footer()}'''
    css = '''section{padding:16px 0}
.dn{display:grid;gap:18px;padding-top:24px;grid-template-areas:"hd" "gv" "dl"}.dhd{grid-area:hd}.give{grid-area:gv}.dl{grid-area:dl}
@media(min-width:900px){.dn{grid-template-columns:1.15fr 1fr;grid-template-areas:"hd gv" "dl gv";column-gap:44px;row-gap:0;align-items:start;padding-top:36px}}
.dn h1{font-size:30px;line-height:1.1}@media(min-width:900px){.dn h1{font-size:44px}}
.lede{font-size:17px;color:var(--ink75);margin-top:10px;max-width:480px}
.pt{font-size:20px;margin:22px 0 10px}
.tiles{display:grid;gap:10px}
.t{margin:0;display:grid;grid-template-columns:104px 1fr;gap:12px;align-items:center}
.t .pic{position:relative;border-radius:12px;overflow:hidden;background:var(--pale);aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.t .pic img{width:100%;height:100%;object-fit:cover;display:block}.t .pic .mamap{width:94%;height:auto}
.pcr{display:block;font-size:13px;color:var(--ink75);margin-top:2px}
.t b{display:block;font:800 17px Overpass}.t figcaption span{font-size:15px;color:var(--ink75)}
.cal{background:#fff;border-radius:8px;padding:6px;width:84%;box-shadow:0 1px 3px #0002}.cdh,.cg{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cdh span{font:800 13px Overpass;text-align:center;color:var(--ink75)}.cg i{aspect-ratio:1;background:var(--pale);border-radius:2px;display:flex;align-items:center;justify-content:center}
.cg i.on{background:var(--forest)}.cg i.on [data-lucide]{color:#fff;width:70%;height:70%}
@media(min-width:900px){.tiles{grid-template-columns:1fr 1fr;gap:14px}.t{grid-template-columns:112px 1fr}
.t-map{grid-column:1/-1;grid-template-columns:1.45fr 1fr;gap:18px}.t-map .pic{aspect-ratio:auto;padding:12px 10px}.t-map b{font-size:24px}}
.give{border:1px solid var(--line);border-radius:18px;padding:18px;box-shadow:0 4px 18px #191A2E12;background:#fff}
.tog{display:grid;grid-template-columns:1fr 1fr;background:var(--pale);border-radius:12px;padding:4px}.tog a{text-align:center;padding:10px;border-radius:9px;font:700 16px Overpass;color:var(--ink75)}.tog a.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px #0002}
.ams{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:14px}.am{border:1.5px solid var(--line);border-radius:10px;height:48px;display:flex;align-items:center;justify-content:center;font:800 17px Overpass}
.am.on{border-color:var(--warm);background:var(--warmbg);color:var(--warm)}.am.other{font-size:15px;color:var(--ink75)}
.what{display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:15px;color:var(--ink85);flex-wrap:wrap}.what [data-lucide]{color:var(--warm);flex:0 0 auto;margin-top:2px}.what span{flex:1;min-width:180px}
.what em{font-style:normal;font-size:13px;font-weight:700;color:var(--warm);background:var(--warmbg);border:1.5px dashed var(--warmline);border-radius:999px;padding:1px 9px}
.givebtn{width:100%;margin-top:16px;height:52px;font-size:17px;background:var(--warm)}
.sec{display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;color:var(--ink75);margin-top:8px}.sec [data-lucide]{width:15px;height:15px}
.org{border-top:1px solid var(--line);margin-top:16px;padding-top:14px;font-size:14px;color:var(--ink75);line-height:1.45}.org b{color:var(--ink)}
.ask{display:flex;gap:10px;align-items:center;margin-top:10px}.ask p{font-size:14px;color:var(--ink75)}.ask a{color:var(--forest);font-weight:700;text-decoration:underline}.ask .av{width:36px;height:36px;font-size:13px}
.ty{text-align:left}.ty>[data-lucide]{color:var(--warm);width:28px;height:28px}.ty h2{font-size:26px;margin-top:4px}.ty p{font-size:16px;color:var(--ink85);margin-top:4px}.ty .tyn{margin-top:16px;font-weight:700;color:var(--ink)}
.ty .nx{display:grid;gap:12px;margin:10px 0 16px}
.other h2{font-size:22px;margin-bottom:12px}.ow{display:grid;gap:14px}@media(min-width:900px){.ow{grid-template-columns:1fr 1fr;align-items:stretch}}
.env b{font:800 17px Overpass}.envp{position:relative;margin-top:8px;background:#FBF7EF;border:1px solid #E6DCC8;border-radius:6px;padding:40px 20px 22px 30%;min-height:0;box-shadow:0 2px 6px #0001}
.envp p{font-size:16px;line-height:1.45;color:var(--ink)}.stamp{position:absolute;right:14px;top:12px;width:44px;height:52px;border:2px dashed var(--forest);border-radius:3px;display:flex;align-items:center;justify-content:center;background:#fff}.stamp [data-lucide]{color:var(--forest)}
@media(max-width:600px){.envp{padding-left:20px;padding-top:56px}}
.ows{display:grid;gap:10px;align-content:start}@media(min-width:900px){.ows{padding-top:30px}}
.ows a{display:flex;gap:12px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:14px}.ows [data-lucide]{color:var(--forest);flex:0 0 auto}
.ows b{display:block;font:800 16px Overpass}.ows span{font-size:15px;color:var(--ink75)}''' + MAP_CSS + WHO_CSS + NAV_PHONE_CSS
    js = """<script>function sh(){var h=location.hash.slice(1),t=['once','thanks'].indexOf(h)>-1?h:'monthly';document.querySelector('.tog').style.display=t==='thanks'?'none':'';document.querySelectorAll('.sec').forEach(function(e){e.style.display=t==='thanks'?'none':''});document.querySelectorAll('[data-t]').forEach(function(e){e.classList.toggle('on',e.dataset.t===t)});document.querySelectorAll('[data-f]').forEach(function(e){e.style.display=e.dataset.f===t?'':'none'})}addEventListener('hashchange',sh);sh()</script>"""
    return page('Donate', body + js, css)


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
