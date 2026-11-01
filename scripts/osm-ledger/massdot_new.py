"""
MassDOT's newly opened bike lanes and paths, kept in Supabase for the "new
this season" layer (Shift migration 01577; Keith 2026-11-01).

Once a day, after the ledger (.github/workflows/osm-ledger.yml): ask MassDOT's
bike inventory for every bike lane, separated lane and shared-use path it lists
as opened in the last two years, statewide (~300 records), and replace
massdot_new_bike_facilities with them. The ride page, the town page, both
assistants and the app read it through get_new_bike_infra_*; the same records
also back an OpenStreetMap ledger event before it may show: after the
refresh, refresh_osm_event_corroboration (01578) records what backs each one.

A failed or empty answer leaves yesterday's table alone: MassDOT answering
nothing looks exactly like "no new lanes" (reference_route_data_sources).

Usage:  python massdot_new.py [--dry-run]
Env:    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (not needed with --dry-run).
Standard library only.
"""

import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

LAYER = "https://gis.massdot.state.ma.us/arcgis/rest/services/Multimodal/BikeInventory/MapServer/0/query"
FACILITY = {1: "painted", 2: "protected", 5: "path"}
KEEP_CAPS = {"MBTA", "DCR", "MWRA", "UMASS"}
UA = "GreenStreetsInitiative-Shift/1.0 (info@gogreenstreets.org)"


def get_json(url, timeout=60):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode())
        except (urllib.error.URLError, json.JSONDecodeError):
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def fetch():
    since = (datetime.now(timezone.utc) - timedelta(days=731)).strftime("%Y-%m-%d")
    out, offset = [], 0
    while True:
        params = urllib.parse.urlencode({
            "where": f"Open_Date >= DATE '{since}' AND Fac_Type IN (1,2,5)",
            "outFields": "GlobalID,Fac_Type,Local_Name,St_Name,Reg_Name,Alt_Name,Open_Date,City,ProjectLink",
            "returnGeometry": "true", "outSR": "4326", "orderByFields": "OBJECTID",
            "resultOffset": str(offset), "resultRecordCount": "500", "f": "json",
        })
        page = get_json(f"{LAYER}?{params}")
        if page.get("error"):
            raise RuntimeError(f"massdot error: {page['error']}")
        feats = page.get("features") or []
        out += feats
        if not page.get("exceededTransferLimit") or not feats:
            return out
        offset += len(feats)


def readable(name):
    # MassDOT writes some names in capitals ("CUMMINS HWY"); keep "MBTA"-style
    # short words as they are.
    return re.sub(r"\b[A-Z]{3,}\b", lambda m: m.group(0) if m.group(0) in KEEP_CAPS else m.group(0)[0] + m.group(0)[1:].lower(), name)


def miles(path):
    total = 0.0
    for (x1, y1), (x2, y2) in zip(path, path[1:]):
        total += math.hypot((y2 - y1) * 69.0, (x2 - x1) * 69.0 * math.cos(math.radians(y1)))
    return total


def rows_from(features, now):
    rows = []
    for f in features:
        a, g = f.get("attributes") or {}, f.get("geometry") or {}
        paths = [[[round(x, 6), round(y, 6)] for x, y in p] for p in g.get("paths") or [] if len(p) >= 2]
        if not paths or not a.get("GlobalID") or not a.get("Open_Date") or a.get("Fac_Type") not in FACILITY:
            continue
        opened = datetime.fromtimestamp(a["Open_Date"] / 1000, timezone.utc).date()
        if opened > now.date():
            continue  # planned, not open yet
        raw = next((a.get(k).strip() for k in ("Local_Name", "St_Name", "Reg_Name", "Alt_Name") if (a.get(k) or "").strip()), None)
        pts = [p for path in paths for p in path]
        link = a.get("ProjectLink") or None
        rows.append({
            "global_id": a["GlobalID"].strip("{}").lower(),
            "name": readable(raw) if raw else None,
            "fac_type": a["Fac_Type"],
            "facility": FACILITY[a["Fac_Type"]],
            "opened": opened.isoformat(),
            "town_id": a.get("City"),
            "geom": paths,
            "min_lat": min(p[1] for p in pts), "max_lat": max(p[1] for p in pts),
            "min_lng": min(p[0] for p in pts), "max_lng": max(p[0] for p in pts),
            "length_mi": round(sum(miles(p) for p in paths), 3),
            "project_link": link if link and re.match(r"^https?://", link) else None,
            "fetched_at": now.isoformat(),
        })
    return rows


def req(method, path, body=None, prefer="return=minimal"):
    url, key = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": prefer}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.urlopen(urllib.request.Request(f"{url}{path}", data=data, method=method, headers=h), timeout=120)
    txt = r.read().decode()
    return json.loads(txt) if txt else None


def heartbeat(started, status, sent, message):
    req("POST", "/rest/v1/rpc/record_cron_heartbeat", {
        "p_function_name": "massdot-new-lanes", "p_started_at": started.isoformat(),
        "p_finished_at": datetime.now(timezone.utc).isoformat(), "p_status": status,
        "p_sent": sent, "p_errors": 0 if status == "ok" else 1, "p_message": message[:500]})


def main():
    dry = "--dry-run" in sys.argv
    started = datetime.now(timezone.utc)
    try:
        rows = rows_from(fetch(), started)
    except Exception as e:  # noqa: BLE001 - one line in the heartbeat is the point
        print(f"MassDOT fetch failed: {e}")
        if not dry:
            heartbeat(started, "error", 0, f"fetch failed, kept yesterday's: {e}")
        sys.exit(1)
    print(f"{len(rows)} MassDOT facilities opened in the last two years; {sum(r['length_mi'] for r in rows):.1f} mi")
    if dry:
        for r in sorted(rows, key=lambda r: r["opened"], reverse=True)[:15]:
            print(f"  {r['opened']} {r['facility']:9} {r['length_mi']:5.2f} mi  {r['name']} (town {r['town_id']})")
        return
    if len(rows) < 50:
        # About 300 statewide; a handful means a broken answer, not a quiet year.
        heartbeat(started, "error", len(rows), f"only {len(rows)} records, kept yesterday's")
        sys.exit(1)
    for i in range(0, len(rows), 200):
        req("POST", "/rest/v1/massdot_new_bike_facilities?on_conflict=global_id", rows[i:i + 200],
            "return=minimal,resolution=merge-duplicates")
    # Records MassDOT no longer lists (aged out of two years, or corrected).
    stamp = urllib.parse.quote(started.isoformat())
    req("DELETE", f"/rest/v1/massdot_new_bike_facilities?fetched_at=lt.{stamp}")
    # The automated second pass on the OSM ledger's events (Shift 01578): what
    # backs each one, so only those backed by more than one mapper show as opened.
    checked = req("POST", "/rest/v1/rpc/refresh_osm_event_corroboration", {}, "return=representation")
    heartbeat(started, "ok", len(rows), f"{len(rows)} facilities; {checked} OSM events checked")


if __name__ == "__main__":
    main()
