"""
The OpenStreetMap bike-way ledger (Shift migration 01422; Keith 2026-10-23).

Once a day (.github/workflows/osm-ledger.yml): read Geofabrik's Massachusetts
extract, keep the ways that carry bike infrastructure, compare them with the
ledger in Supabase, and record
  - every way that appeared, changed or went (osm_bike_way_versions), and
  - the changes people would care about (osm_bike_events), judged BY PLACE:
    a stretch counts only where the best facility within 20 m, running the
    same way, got better or worse. A year of core-Boston edits was ~90%
    re-tags, splits and redraws of lanes that didn't change on the ground
    (174 mi of protected ways touched, 16 mi actually new), so ids and tags
    alone would cry wolf daily.
Events start pending, are confirmed after holding 3 daily snapshots, and are
marked reverted if they undo within 14 days (vandalism, mistakes). A run that
moves the statewide totals by more than 2% is quarantined, not applied.

Usage:
  python ledger.py <extract.osm.pbf> <data_timestamp> [--dry-run]
Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (not needed with --dry-run).

One classifier for the whole ledger, the union of the website's
(src/lib/server/bike-network.ts) and the app's (supabase/functions/_shared/
osm-bike.ts): the two disagree today, and this is the place to settle it.
"""

import hashlib
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import osmium

# ── Classification ──────────────────────────────────────────────────────

TRACK = re.compile(r"^(track|opposite_track|sidepath)$")
LANE = re.compile(r"^(lane|opposite_lane|buffered_lane)$")
SUFFIX = {"st": "street", "ave": "avenue", "av": "avenue", "rd": "road", "blvd": "boulevard", "dr": "drive",
          "pkwy": "parkway", "pky": "parkway", "hwy": "highway", "sq": "square", "pl": "place", "ln": "lane",
          "ct": "court", "ter": "terrace", "terr": "terrace", "cir": "circle", "ext": "extension"}
STREET_WORDS = {"street", "avenue", "road", "highway", "boulevard", "parkway", "turnpike", "pike", "drive", "place",
                "square", "row", "bridge", "court", "terrace", "circle", "extension", "lane", "broadway"}
PATHISH = {"path", "trail", "greenway", "esplanade", "bikeway", "footbridge", "pedestrian", "riverwalk", "walkway",
           "boardwalk", "rail"}
KEEP_TAGS = re.compile(r"^(highway|name|bicycle|foot|segregated|surface|oneway|oneway:bicycle|is_sidepath|"
                       r"cycleway(:.*)?|construction|proposed|start_date|opening_date|check_date|access|ref)$")


def street_key(name):
    words = re.sub(r"[^a-z0-9\s]", " ", name.lower()).split()
    return " ".join(SUFFIX.get(w, w) for w in words).replace("bike path", "path")


def looks_like_street(name):
    if not name:
        return False
    words = street_key(name).split()
    return bool(words) and not any(w in PATHISH for w in words) and words[-1] in STREET_WORDS


def classify(tags):
    """path | protected | painted | construction | proposed | None."""
    hw = tags.get("highway")
    name = tags.get("name")
    if hw == "construction" and tags.get("construction") in ("cycleway", "path"):
        return "construction"
    if hw == "proposed" and tags.get("proposed") in ("cycleway", "path"):
        return "proposed"
    own = hw == "cycleway" or (hw in ("path", "footway", "track") and tags.get("bicycle") in ("designated", "yes"))
    if own:
        sidepath = tags.get("is_sidepath") == "yes" or looks_like_street(name)
        return "protected" if sidepath else "path"
    # A road carrying the lane. "separate" means the lane is drawn as its own
    # way (which carries it), so it doesn't count again here.
    vals = [tags.get(k) for k in ("cycleway", "cycleway:both", "cycleway:left", "cycleway:right")]
    vals = [v for v in vals if v]
    if any(TRACK.match(v) for v in vals):
        return "protected"
    if any(LANE.match(v) for v in vals):
        return "painted"
    return None


# Comfort rank for "better or worse at this place". Construction and
# proposed rank with nothing: they aren't rideable yet.
RANK = {"path": 3, "protected": 3, "painted": 1, "construction": 0, "proposed": 0, None: 0}


# ── Reading the extract ─────────────────────────────────────────────────

def car_free_type(tags):
    """The trip classifier's car-free paths (Shift poll-car-free-facilities,
    same three rules): cycleways, and paths designated for bikes that cars
    can't use."""
    hw = tags.get("highway")
    if hw == "cycleway" and tags.get("area") != "yes":
        return "cycleway"
    if hw == "path" and tags.get("bicycle") == "designated" and (
            tags.get("motor_vehicle") == "no" or (tags.get("access") == "no" and tags.get("foot") == "yes")):
        return "path"
    return None


# The trip classifier's area (the old refresh's Overpass bbox): Massachusetts
# plus the edges of its neighbours, where people cross the line on a trail.
CAR_FREE_BBOX = (41.15, -73.60, 42.90, -69.80)


def in_car_free_bbox(coords):
    s, w, n, e = CAR_FREE_BBOX
    return any(s <= c[1] <= n and w <= c[0] <= e for c in coords)


class CarFreeOnly(osmium.SimpleHandler):
    """A neighbouring state's extract, read for car-free paths only."""

    def __init__(self):
        super().__init__()
        self.car_free = {}

    def way(self, w):
        tags = {t.k: t.v for t in w.tags}
        cf = car_free_type(tags)
        if not cf:
            return
        try:
            coords = [[round(n.lon, 6), round(n.lat, 6)] for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        if len(coords) >= 2 and in_car_free_bbox(coords):
            self.car_free[w.id] = {"osm_way_id": w.id, "name": tags.get("name"), "facility_type": cf, "coords": coords}


class BikeWays(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.ways = {}
        self.car_free = {}

    def way(self, w):
        tags = {t.k: t.v for t in w.tags}
        cls = classify(tags)
        if not cls:
            return
        try:
            coords = [[round(n.lon, 6), round(n.lat, 6)] for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        if len(coords) < 2:
            return
        cf = car_free_type(tags)
        if cf and in_car_free_bbox(coords):
            self.car_free[w.id] = {"osm_way_id": w.id, "name": tags.get("name"), "facility_type": cf, "coords": coords}
        kept = {k: v for k, v in tags.items() if KEEP_TAGS.match(k)}
        self.ways[w.id] = {
            "way_id": w.id, "version": w.version, "osm_ts": w.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "facility_class": cls, "name": tags.get("name"), "tags": kept,
            "tags_hash": hashlib.md5(json.dumps(kept, sort_keys=True).encode()).hexdigest()[:16],
            "geom": coords,
        }


def with_bbox(w):
    xs = [c[0] for c in w["geom"]]
    ys = [c[1] for c in w["geom"]]
    w.update(min_lat=min(ys), min_lng=min(xs), max_lat=max(ys), max_lng=max(xs), length_m=round(line_m(w["geom"]), 1))
    return w


# ── Geometry ────────────────────────────────────────────────────────────

def dist_m(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    dx = (b[0] - a[0]) * 111320 * math.cos(lat)
    dy = (b[1] - a[1]) * 110540
    return math.hypot(dx, dy)


def line_m(coords):
    return sum(dist_m(coords[i - 1], coords[i]) for i in range(1, len(coords)))


def bearing(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    return math.degrees(math.atan2((b[0] - a[0]) * math.cos(lat), b[1] - a[1])) % 180  # undirected


def densify(coords, step=10.0):
    """Points every ~10 m, each with the bearing of its segment."""
    out = []
    for i in range(1, len(coords)):
        a, b = coords[i - 1], coords[i]
        d = dist_m(a, b)
        n = max(1, int(d // step))
        br = bearing(a, b)
        for k in range(n):
            t = k / n
            out.append(((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), br))
    out.append((tuple(coords[-1]), bearing(coords[-2], coords[-1])))
    return out


CELL = 0.0005  # ~50 m


class SegGrid:
    """Line segments of many ways, for "best class within 20 m, running the same way"."""

    def __init__(self, ways):
        self.cells = defaultdict(list)
        for w in ways:
            g = w["geom"]
            for i in range(1, len(g)):
                a, b = g[i - 1], g[i]
                seg = (a, b, w["facility_class"], bearing(a, b), w.get("name"))
                for cx in range(int(min(a[0], b[0]) // CELL), int(max(a[0], b[0]) // CELL) + 1):
                    for cy in range(int(min(a[1], b[1]) // CELL), int(max(a[1], b[1]) // CELL) + 1):
                        self.cells[(cx, cy)].append(seg)

    def best(self, p, br, within=20.0, angle=30.0):
        """The best rideable class here; else construction or proposed if that's what's here; else None."""
        cx, cy = int(p[0] // CELL), int(p[1] // CELL)
        found = set()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for a, b, cls, sb, _ in self.cells.get((cx + dx, cy + dy), ()):
                    if cls in found:
                        continue
                    diff = abs(sb - br) % 180
                    if min(diff, 180 - diff) > angle:
                        continue
                    if point_seg_m(p, a, b) <= within:
                        found.add(cls)
        for cls in ("protected", "path", "painted", "construction", "proposed"):
            if cls in found:
                # A protected sidepath and a car-free path rank the same; call
                # either one "protected" so a renamed way isn't a change.
                return cls
        return None


def street_name_near(grids, p, br, within=25.0, angle=30.0):
    """A sidepath drawn without a name borrows the parallel street's."""
    cx, cy = int(p[0] // CELL), int(p[1] // CELL)
    best, bd = None, within
    for g in grids:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for a, b, _, sb, name in g.cells.get((cx + dx, cy + dy), ()):
                    if not name:
                        continue
                    diff = abs(sb - br) % 180
                    if min(diff, 180 - diff) > angle:
                        continue
                    d = point_seg_m(p, a, b)
                    if d < bd:
                        best, bd = name, d
    return best


class NamedRoads(osmium.SimpleHandler):
    """Second pass, only when an event has no name: the named streets beside it."""

    def __init__(self, boxes):
        super().__init__()
        self.boxes = boxes
        self.ways = []

    def way(self, w):
        name = w.tags.get("name")
        hw = w.tags.get("highway")
        if not name or not hw or hw in ("footway", "path", "cycleway", "service", "steps"):
            return
        try:
            coords = [[n.lon, n.lat] for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        xs = [c[0] for c in coords]
        ys = [c[1] for c in coords]
        if any(min(xs) <= b[2] and max(xs) >= b[0] and min(ys) <= b[3] and max(ys) >= b[1] for b in self.boxes):
            self.ways.append({"geom": coords, "facility_class": "painted", "name": name})


def name_from_streets(pbf, groups):
    pad = 0.0004
    boxes = []
    for g in groups:
        pts = [p for line in g["lines"] for p in line]
        boxes.append((min(p[0] for p in pts) - pad, min(p[1] for p in pts) - pad, max(p[0] for p in pts) + pad, max(p[1] for p in pts) + pad))
    h = NamedRoads(boxes)
    h.apply_file(pbf, locations=True, idx="flex_mem")
    grid = SegGrid(h.ways)
    for g in groups:
        line = g["lines"][0]
        mid = len(line) // 2
        a, b = line[max(0, mid - 1)], line[min(len(line) - 1, mid + 1)]
        g["name"] = street_name_near((grid,), tuple(line[mid]), bearing(a, b), within=35.0)


def point_seg_m(p, a, b):
    lat = math.radians(p[1])
    kx, ky = 111320 * math.cos(lat), 110540
    ax, ay = (a[0] - p[0]) * kx, (a[1] - p[1]) * ky
    bx, by = (b[0] - p[0]) * kx, (b[1] - p[1]) * ky
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, -(ax * dx + ay * dy) / L))
    return math.hypot(ax + t * dx, ay + t * dy)


# ── What changed, by place ──────────────────────────────────────────────

def event_kind(before, after):
    rb, ra = RANK[before], RANK[after]
    if before == "construction" and ra > 0:
        return "opened"
    if after == "construction" and before is None:
        return "construction_started"
    if ra > rb:
        return "new" if rb == 0 else "upgrade"
    if ra < rb:
        return "removed" if ra == 0 and after != "construction" else "downgrade"
    return None


MIN_NAMED_M = 150
MIN_UNNAMED_M = 300


def place_changes(lines, old_grid, new_grid):
    """Stretches along the affected lines where the best class changed."""
    stretches = []
    for way_id, name, coords in lines:
        run = None
        for p, br in densify(coords):
            kind = None
            before, after = old_grid.best(p, br), new_grid.best(p, br)
            kind = event_kind(before, after) if before != after else None
            if kind and run and run["kind"] == kind and run["before"] == before and run["after"] == after:
                run["pts"].append(list(p))
                continue
            if run:
                stretches.append(run)
                run = None
            if kind:
                run = {"kind": kind, "before": before, "after": after, "name": name, "way_ids": {way_id}, "pts": [list(p)]}
        if run:
            stretches.append(run)
    for s in stretches:
        s["length_m"] = line_m(s["pts"]) if len(s["pts"]) > 1 else 0
        if not s["name"] and len(s["pts"]) > 1:
            mid = len(s["pts"]) // 2
            a, b = s["pts"][max(0, mid - 1)], s["pts"][min(len(s["pts"]) - 1, mid + 1)]
            s["name"] = street_name_near((new_grid, old_grid), tuple(s["pts"][mid]), bearing(a, b))
    # Join the pieces of one street first (a lane split by intersections and
    # crossing paths arrives in short runs), then hold the whole to the bar.
    return [g for g in merge_stretches(stretches) if g["length_m"] >= (MIN_NAMED_M if g["name"] else MIN_UNNAMED_M)]


def merge_stretches(stretches, gap_m=150):
    """One event per kind and street: nearby stretches with the same name join."""
    groups = []
    for s in stretches:
        for g in groups:
            if g["kind"] == s["kind"] and (g["name"] or "") == (s["name"] or "") and \
                    min(dist_m(a, b) for a in (g["lines"][-1][0], g["lines"][-1][-1]) for b in (s["pts"][0], s["pts"][-1])) <= gap_m:
                g["lines"].append(s["pts"])
                g["length_m"] += s["length_m"]
                g["way_ids"] |= s["way_ids"]
                break
        else:
            groups.append({"kind": s["kind"], "before": s["before"], "after": s["after"], "name": s["name"],
                           "lines": [s["pts"]], "length_m": s["length_m"], "way_ids": set(s["way_ids"])})
    return groups


# ── Supabase ────────────────────────────────────────────────────────────

class Db:
    def __init__(self, url, key, dry):
        self.url, self.key, self.dry = url.rstrip("/"), key, dry

    def req(self, method, path, body=None, headers=None):
        h = {"apikey": self.key, "Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}
        h.update(headers or {})
        data = json.dumps(body).encode() if body is not None else None
        for attempt in range(4):
            try:
                r = urllib.request.urlopen(urllib.request.Request(f"{self.url}{path}", data=data, method=method, headers=h), timeout=120)
                txt = r.read().decode()
                return json.loads(txt) if txt else None
            except urllib.error.HTTPError as e:
                msg = e.read().decode()[:500]
                if e.code < 500 or attempt == 3:
                    raise RuntimeError(f"{method} {path.split('?')[0]} {e.code}: {msg}")
            except urllib.error.URLError:
                if attempt == 3:
                    raise
            time.sleep(2 * (attempt + 1))

    def select_all(self, table, query):
        rows, start = [], 0
        while True:
            page = self.req("GET", f"/rest/v1/{table}?{query}", headers={"Range": f"{start}-{start + 999}"})
            rows += page
            if len(page) < 1000:
                return rows
            start += 1000

    def count(self, table, query):
        h = {"apikey": self.key, "Authorization": f"Bearer {self.key}", "Prefer": "count=exact", "Range": "0-0"}
        r = urllib.request.urlopen(urllib.request.Request(f"{self.url}/rest/v1/{table}?select=*&{query}", headers=h), timeout=60)
        return int(r.headers.get("Content-Range", "*/0").split("/")[-1])

    def write(self, method, table, rows, query="", prefer="return=minimal", chunk=500):
        if self.dry or not rows:
            return
        for i in range(0, len(rows), chunk):
            self.req(method, f"/rest/v1/{table}{query}", rows[i:i + chunk], {"Prefer": prefer})


# ── Car-free paths for the trip classifier ──────────────────────────────

def sync_car_free(db, car_free, started):
    """Keep car_free_facility_shapes (Shift 00439/01420) current from today's
    extract, so it no longer depends on Overpass answering a statewide query
    (it didn't, on 2026-10-01). Same rows and markers as the old refresh:
    last_seen_at this run, gone_at for ways no longer car-free. The old
    refresh stays scheduled as a backup and skips while this keeps the data
    fresh; its heartbeat is recorded here, so its staleness alarm still means
    "the car-free paths stopped refreshing"."""
    count = db.count("car_free_facility_shapes", "gone_at=is.null")
    if count and abs(len(car_free) - count) / count > 0.05:
        note = f"car-free ways {count}→{len(car_free)}"
        alert(db, "Car-free paths: today's extract moved the count by more than 5%, not applied", note)
        print("car-free sync skipped:", note)
        return
    seen = started.isoformat()
    rows = []
    for cf in car_free.values():
        ys = [c[1] for c in cf["coords"]]
        xs = [c[0] for c in cf["coords"]]
        rows.append({
            "osm_way_id": cf["osm_way_id"], "name": cf["name"], "facility_type": cf["facility_type"],
            "shape": [[c[1], c[0]] for c in cf["coords"]],  # this table stores [lat, lng]
            "bbox_min_lat": min(ys), "bbox_max_lat": max(ys), "bbox_min_lng": min(xs), "bbox_max_lng": max(xs),
            "updated_at": seen, "last_seen_at": seen, "gone_at": None,
        })
    db.write("POST", "car_free_facility_shapes", rows, "?on_conflict=osm_way_id", "return=minimal,resolution=merge-duplicates")
    if not db.dry:
        db.req("PATCH", f"/rest/v1/car_free_facility_shapes?gone_at=is.null&last_seen_at=lt.{urllib.parse.quote(seen)}",
               {"gone_at": datetime.now(timezone.utc).isoformat()}, {"Prefer": "return=minimal"})
        db.req("POST", "/rest/v1/rpc/record_cron_heartbeat", {
            "p_function_name": "poll-car-free-facilities", "p_started_at": seen,
            "p_finished_at": datetime.now(timezone.utc).isoformat(), "p_status": "success",
            "p_sent": len(rows), "p_errors": 0, "p_message": f"refreshed from the OSM ledger: {len(rows)} car-free ways"})
    print(f"car-free sync: {len(rows)} ways (table had {count})")


# ── The run ─────────────────────────────────────────────────────────────

def miles_by_class(ways):
    m = defaultdict(float)
    for w in ways:
        m[w["facility_class"]] += w["length_m"] / 1609.344
    return {k: round(v, 1) for k, v in sorted(m.items())}


def main():
    pbf, data_ts = sys.argv[1], sys.argv[2]
    dry = "--dry-run" in sys.argv
    if "--compare-anyway" in sys.argv:  # testing: compare even when the extract isn't newer
        data_ts = "9999-01-01T00:00:00Z" if dry else data_ts
    started = datetime.now(timezone.utc)
    db = Db(os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""), dry)

    h = BikeWays()
    h.apply_file(pbf, locations=True, idx="flex_mem")
    # Neighbouring states, for the car-free paths near the line only:
    # --car-free-extra=nh.osm.pbf,ri.osm.pbf,...
    extra = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--car-free-extra=")), "")
    for f in [x for x in extra.split(",") if x]:
        if not os.path.exists(f) or os.path.getsize(f) < 1_000_000:
            # A failed download: the car-free count then drops more than 5%
            # and the sync is skipped with an alert, so nothing is lost.
            print(f"{f}: missing, skipped")
            continue
        c = CarFreeOnly()
        c.apply_file(f, locations=True, idx="flex_mem")
        h.car_free.update(c.car_free)
        print(f"{os.path.basename(f)}: {len(c.car_free)} car-free ways in the area")
    new = {k: with_bbox(w) for k, w in h.ways.items()}
    new_miles = miles_by_class(new.values())
    print(f"extract: {len(new)} bike ways, miles {new_miles}; {len(h.car_free)} car-free ways")

    if dry and not db.key:
        print("dry run without a database: classification only")
        return

    # Geofabrik sometimes skips a day: the same extract twice is nothing new.
    last = db.req("GET", "/rest/v1/osm_snapshots?select=data_ts&status=in.(baseline,applied)&order=data_ts.desc&limit=1")
    if last and datetime.fromisoformat(last[0]["data_ts"].replace("Z", "+00:00")) >= datetime.fromisoformat(data_ts.replace("Z", "+00:00")):
        print(f"no new data: the extract is still {data_ts}")
        heartbeat(db, started, "ok", 0, f"no new data ({data_ts})")
        return

    old_rows = db.select_all("osm_bike_ways", "select=way_id,version,facility_class,name,tags_hash,geom,length_m&gone_snapshot=is.null&order=way_id")
    old = {r["way_id"]: r for r in old_rows}
    print(f"ledger: {len(old)} live ways")

    def snapshot(status, note=None):
        row = {"data_ts": data_ts, "way_count": len(new), "miles": new_miles, "status": status, "note": note}
        if db.dry:
            return 0
        return db.req("POST", "/rest/v1/osm_snapshots", row, {"Prefer": "return=representation"})[0]["id"]

    # First run: the baseline. No events: everything would look "new".
    if not old:
        sid = snapshot("baseline", "First copy of the Massachusetts bike ways.")
        rows = [{**w, "first_seen_snapshot": sid, "last_seen_snapshot": sid} for w in new.values()]
        db.write("POST", "osm_bike_ways", rows, "?on_conflict=way_id", "return=minimal,resolution=merge-duplicates")
        heartbeat(db, started, "ok", 0, f"baseline: {len(new)} ways")
        print(f"baseline written: {len(rows)} ways")
        sync_car_free(db, h.car_free, started)
        return

    # Sanity: a bad extract or a filter bug shows up as a big swing.
    old_miles = miles_by_class(old.values())
    def swing(a, b):
        return abs(a - b) / max(b, 1)
    big = swing(len(new), len(old)) > 0.02 or any(
        swing(new_miles.get(c, 0), old_miles.get(c, 0)) > 0.02 for c in ("path", "protected", "painted"))
    if big:
        note = f"ways {len(old)}→{len(new)}; miles {old_miles}→{new_miles}"
        snapshot("quarantined", note)
        alert(db, "OSM ledger: today's extract moved the totals by more than 2%, not applied", note)
        heartbeat(db, started, "error", 0, f"quarantined: {note}")
        print("quarantined:", note)
        return

    sid = snapshot("applied")
    appeared = [k for k in new if k not in old]
    gone = [k for k in old if k not in new]
    changed = [k for k in new if k in old and (new[k]["version"] != old[k]["version"] or new[k]["tags_hash"] != old[k]["tags_hash"])]

    versions = []
    for k in appeared:
        versions.append({"way_id": k, "version": new[k]["version"], "osm_ts": new[k]["osm_ts"], "snapshot_id": sid,
                         "change_kind": "appeared", "facility_class": new[k]["facility_class"], "tags": new[k]["tags"], "geom": new[k]["geom"]})
    for k in changed:
        moved = new[k]["geom"] != old[k]["geom"]
        kind = "class_changed" if new[k]["facility_class"] != old[k]["facility_class"] else "geometry" if moved else "retagged"
        versions.append({"way_id": k, "version": new[k]["version"], "osm_ts": new[k]["osm_ts"], "snapshot_id": sid,
                         "change_kind": kind, "facility_class": new[k]["facility_class"], "tags": new[k]["tags"],
                         "geom": new[k]["geom"] if moved else None})
    for k in gone:
        versions.append({"way_id": k, "version": None, "osm_ts": None, "snapshot_id": sid, "change_kind": "disappeared",
                         "facility_class": old[k]["facility_class"], "tags": None, "geom": None})

    # Events, by place, along everything that moved.
    old_grid = SegGrid(old.values())
    new_grid = SegGrid(new.values())
    lines = [(k, new[k]["name"], new[k]["geom"]) for k in appeared + changed] + \
            [(k, old[k]["name"], old[k]["geom"]) for k in gone + changed if old[k]["geom"] != new.get(k, {}).get("geom")]
    found = place_changes(lines, old_grid, new_grid)
    if any(not g["name"] for g in found):
        name_from_streets(pbf, [g for g in found if not g["name"]])

    # Pending events from earlier runs: still true today?
    pending = db.select_all("osm_bike_events", "select=id,kind,class_after,geom,seen_count,first_seen_at&status=eq.pending")
    now = datetime.now(timezone.utc)
    updates = []
    for e in pending:
        holds, total = 0, 0
        for line in e["geom"]:
            step = max(1, len(line) // 10)
            for i in range(0, len(line), step):
                a, b = line[max(0, i - 1)], line[min(len(line) - 1, i + 1)]
                br = bearing(a, b) if a != b else 0
                total += 1
                if RANK[new_grid.best(tuple(line[i]), br)] == RANK[e["class_after"]] and \
                        (e["class_after"] != "construction" or new_grid.best(tuple(line[i]), br) == "construction"):
                    holds += 1
        sample = range(total)
        ok = holds >= len(sample) * 0.6
        age = now - datetime.fromisoformat(e["first_seen_at"].replace("Z", "+00:00"))
        if ok:
            seen = e["seen_count"] + 1
            updates.append({"id": e["id"], "seen_count": seen, **({"status": "confirmed", "confirmed_at": now.isoformat()} if seen >= 3 else {})})
        elif age <= timedelta(days=14):
            updates.append({"id": e["id"], "status": "reverted"})

    events = []
    for g in found:
        pts = [p for line in g["lines"] for p in line]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        edits = [new[k]["osm_ts"] for k in g["way_ids"] if k in new]
        events.append({
            "kind": g["kind"], "class_before": g["before"], "class_after": g["after"], "name": g["name"],
            "geom": [[[round(x, 6), round(y, 6)] for x, y in line] for line in g["lines"]],
            "min_lat": min(ys), "min_lng": min(xs), "max_lat": max(ys), "max_lng": max(xs),
            "length_m": round(g["length_m"], 1), "way_ids": sorted(g["way_ids"]),
            "osm_edit_at": min(edits) if edits else None, "first_seen_at": now.isoformat(), "first_snapshot": sid,
        })

    print(f"appeared {len(appeared)}, changed {len(changed)}, gone {len(gone)}; events {len(events)}; pending updated {len(updates)}")
    for e in events:
        print(f"  {e['kind']}: {e['name'] or '(unnamed)'} {e['class_before']}→{e['class_after']} {e['length_m']:.0f} m")

    upserts = [{**new[k], "last_seen_snapshot": sid, **({"first_seen_snapshot": sid} if k in appeared else {})} for k in appeared + changed]
    db.write("POST", "osm_bike_ways", upserts, "?on_conflict=way_id", "return=minimal,resolution=merge-duplicates")
    for i in range(0, len(gone), 200):
        ids = ",".join(str(k) for k in gone[i:i + 200])
        if not db.dry:
            db.req("PATCH", f"/rest/v1/osm_bike_ways?way_id=in.({ids})", {"gone_snapshot": sid}, {"Prefer": "return=minimal"})
    db.write("POST", "osm_bike_way_versions", versions)
    db.write("POST", "osm_bike_events", events)
    for u in updates:
        if not db.dry:
            db.req("PATCH", f"/rest/v1/osm_bike_events?id=eq.{u.pop('id')}", u, {"Prefer": "return=minimal"})
    heartbeat(db, started, "ok", len(events), f"+{len(appeared)} ~{len(changed)} -{len(gone)} ways; {len(events)} events")
    sync_car_free(db, h.car_free, started)


def heartbeat(db, started, status, sent, message):
    if db.dry:
        return
    db.req("POST", "/rest/v1/rpc/record_cron_heartbeat", {
        "p_function_name": "osm-ledger", "p_started_at": started.isoformat(),
        "p_finished_at": datetime.now(timezone.utc).isoformat(), "p_status": status,
        "p_sent": sent, "p_errors": 0 if status == "ok" else 1, "p_message": message[:500]})


def alert(db, title, body):
    if db.dry:
        return
    db.req("POST", "/rest/v1/admin_notifications", {"level": "warning", "source": "osm_ledger", "title": title, "body": body[:2000]},
           {"Prefer": "return=minimal"})


if __name__ == "__main__":
    main()
