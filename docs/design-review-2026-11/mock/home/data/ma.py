import json, math, sys
S = sys.argv[1]
topo = json.load(open(S + '/atlas/states-10m.json'))
sc, tr = topo['transform']['scale'], topo['transform']['translate']
arcs = []
for a in topo['arcs']:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy; pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
    arcs.append(pts)
geo = [g for g in topo['objects']['states']['geometries'] if g['id'] == '25'][0]
def ring(idx):
    out = []
    for i in idx:
        p = arcs[i] if i >= 0 else arcs[~i][::-1]
        out += p if not out else p[1:]
    return out
polys = geo['arcs'] if geo['type'] == 'MultiPolygon' else [geo['arcs']]
rings = [ring(p[0]) for p in polys]
k = math.cos(math.radians(42.2))
allp = [pt for r in rings for pt in r]
minx = min(p[0] for p in allp) * k; maxx = max(p[0] for p in allp) * k
miny = min(p[1] for p in allp); maxy = max(p[1] for p in allp)
W = 600; s = W / (maxx - minx); H = (maxy - miny) * s
def proj(lng, lat): return ((lng * k - minx) * s, (maxy - lat) * s)
paths = []
for r in rings:
    if len(r) < 8: continue
    paths.append('M' + ' L'.join('%.1f,%.1f' % proj(*p) for p in r[::2]) + 'Z')
pts = json.load(open(S + '/hosts.json'))
pts = (pts[0] if isinstance(pts, list) else pts)['j']['pts']
dots = [proj(lng, lat) for lat, lng in pts]
json.dump({'W': W, 'H': round(H, 1), 'paths': paths, 'dots': [[round(x, 1), round(y, 1)] for x, y in dots]}, open(S + '/ma.json', 'w'))
print(W, H, len(paths), len(dots), sum(len(p) for p in paths))
