"""Instagram story for finished futsal matches.

The hourly data workflow runs this in three steps:

    python story/story.py prepare   # find new results, fetch scorers -> state "ready"
    python story/story.py render    # ready -> story JPEG in assets/stories/ ("rendered")
    python story/story.py publish   # rendered -> Instagram story ("published")

The JPEG has to be served from GitHub Pages before Instagram can fetch it,
so the workflow commits and pushes between render and publish.

Local helpers:

    python story/story.py preview <match_id> [--matches assets/matches.json]
    python story/story.py dump <match_id>       # raw getMatch response
"""

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fetch_data import FUTSAL_TEAM_ID, fetch_json  # noqa: E402

MATCHES_FILE = ROOT / "assets" / "futsal_matches.json"
STORIES_DIR = ROOT / "assets" / "stories"
STATE_FILE = STORIES_DIR / "state.json"
PHOTOS_DIR = ROOT / "assets" / "story-photos"
FALLBACK_PHOTOS_DIR = ROOT / "assets" / "photos"
TEMPLATE = ROOT / "story" / "template.html"

KIRAHVIT_CLUB_ID = "6950"
SITE_URL = os.getenv("STORY_SITE_URL", "https://www.jaliskirahvit.fi")
IG_API = f"https://graph.instagram.com/{os.getenv('IG_API_VERSION', 'v23.0')}"

# Results older than this are never posted (no backfill of a whole season)
MAX_MATCH_AGE = timedelta(days=3)
# How long to wait for the goal events to add up to the final score
SCORER_GRACE = timedelta(hours=12)

PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
WEEKDAYS = ["ma", "ti", "ke", "to", "pe", "la", "su"]


# ---------------------------------------------------------------- state

def now():
    return datetime.now(timezone.utc)


def load_state():
    try:
        return json.loads(STATE_FILE.read_text())
    except (OSError, ValueError):
        return {"matches": {}}


def save_state(state):
    STORIES_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=4, ensure_ascii=False) + "\n")


def set_output(name, value):
    out = os.getenv("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"{name}={value}\n")
    print(f"{name}={value}")


# ---------------------------------------------------------------- match data

def load_matches(path=None):
    return json.loads(Path(path or MATCHES_FILE).read_text()).get("matches", [])


def own_side(m):
    return "A" if str(m.get("club_A_id")) == KIRAHVIT_CLUB_ID else "B"


def is_finished(m):
    return m.get("status") == "Played" and str(m.get("fs_A", "")) != "" and str(m.get("fs_B", "")) != ""


def kickoff(m):
    t = (m.get("time") or "00:00:00")[:5]
    try:
        return datetime.fromisoformat(f"{m['date']}T{t}")
    except (KeyError, ValueError):
        return None


def format_date(m):
    k = kickoff(m)
    return f"{WEEKDAYS[k.weekday()]} {k.day}.{k.month}." if k else ""


def format_time(m):
    t = (m.get("time") or "")[:5]
    return t if t and t != "00:00" else ""


def to_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def next_fixture(matches, after):
    start = kickoff(after)
    upcoming = [m for m in matches if m.get("status") == "Fixture" and kickoff(m) and (start is None or kickoff(m) > start)]
    upcoming.sort(key=kickoff)
    if not upcoming:
        return None
    n = upcoming[0]
    side = own_side(n)
    opp = "B" if side == "A" else "A"
    return {
        "date": format_date(n),
        "time": format_time(n),
        "opponent": n.get(f"team_{opp}_name", ""),
        "home": side == "A",
    }


# ---------------------------------------------------------------- scorers

def _name(e):
    name = e.get("player_name") or e.get("name") or ""
    if not name:
        name = " ".join(x for x in (e.get("first_name"), e.get("last_name")) if x)
    return name.strip()


def _event_code(e):
    return str(e.get("code") or e.get("event_type") or e.get("type") or e.get("event") or "").lower()


def extract_goals(match, own_team_id):
    """Return (own_goals, opponent_goals) as lists of scorer names.

    The exact getMatch event format still has to be confirmed against a real
    played futsal match (see `dump`), so this accepts the usual variants:
    an `events` or `goals` list whose code mentions maali/goal, or per-player
    goal counts in `lineups`.
    """
    own, opp = [], []
    events = match.get("events") or match.get("goals") or []
    found_events = False

    for e in events if isinstance(events, list) else []:
        code = _event_code(e)
        if not ("maali" in code or "goal" in code):
            continue
        if any(w in code for w in ("ohi", "miss", "hyl", "disallow")):
            continue
        found_events = True
        team = str(e.get("team_id") or "")
        own_goal = "oma" in code or "own" in code
        # An own goal is listed under the player's team but counts for the other side
        for_us = (team == own_team_id) != own_goal
        name = "Oma maali" if own_goal else (_name(e) or "Tuntematon")
        (own if for_us else opp).append(name)

    if not found_events:
        for p in match.get("lineups") or []:
            goals = to_int(p.get("goals"))
            if goals <= 0:
                continue
            target = own if str(p.get("team_id") or "") == own_team_id else opp
            target.extend([_name(p) or "Tuntematon"] * goals)

    return own, opp


def group_scorers(names):
    counts = {}
    for n in names:
        counts[n] = counts.get(n, 0) + 1
    own_goal = counts.pop("Oma maali", 0)
    rows = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    if own_goal:
        rows.append(("Oma maali", own_goal))
    return [{"name": n, "goals": c} for n, c in rows]


def fetch_match_details(match_id):
    data = fetch_json("getMatch", {"match_id": match_id})
    return (data or {}).get("match")


# ---------------------------------------------------------------- story data

def build_story(m, matches, details):
    side = own_side(m)
    opp = "B" if side == "A" else "A"
    ours, theirs = to_int(m[f"fs_{side}"]), to_int(m[f"fs_{opp}"])
    own_team_id = str(m.get(f"team_{side}_id", FUTSAL_TEAM_ID))

    own_goals, opp_goals = extract_goals(details or {}, own_team_id)

    result = "win" if ours > theirs else "loss" if ours < theirs else "draw"
    return {
        "match_id": m["match_id"],
        "result": result,
        "headline": {"win": "VOITTO", "draw": "TASAPELI", "loss": "TAPPIO"}[result],
        "category": m.get("category_name", ""),
        "date": format_date(m),
        "venue": m.get("venue_name", ""),
        "home": {
            "name": m.get("team_A_name", ""),
            "crest": m.get("club_A_crest", ""),
            "score": to_int(m["fs_A"]),
            "own": side == "A",
        },
        "away": {
            "name": m.get("team_B_name", ""),
            "crest": m.get("club_B_crest", ""),
            "score": to_int(m["fs_B"]),
            "own": side == "B",
        },
        "scorers": group_scorers(own_goals),
        "scorers_complete": len(own_goals) >= ours,
        "opponent_scorers": group_scorers(opp_goals),
        "next": next_fixture(matches, m),
        "site": SITE_URL.replace("https://", "").replace("www.", ""),
    }


def pick_photo(result, match_id):
    """Deterministic pick so a re-render gives the same picture."""
    folder = {"win": "voitto", "draw": "tasapeli", "loss": "tappio"}[result]
    for d in (PHOTOS_DIR / folder, PHOTOS_DIR / "yleinen", FALLBACK_PHOTOS_DIR):
        photos = sorted(p for p in d.glob("*") if p.suffix.lower() in PHOTO_EXTENSIONS) if d.is_dir() else []
        if photos:
            h = int(hashlib.sha1(match_id.encode()).hexdigest(), 16)
            return photos[h % len(photos)]
    return None


# ---------------------------------------------------------------- commands

def cmd_prepare(_args):
    state = load_state()
    entries = state.setdefault("matches", {})
    matches = load_matches()

    for m in matches:
        mid = m["match_id"]
        entry = entries.get(mid, {})
        if entry.get("status") in ("ready", "rendered", "published", "skipped"):
            continue
        if not is_finished(m):
            continue

        k = kickoff(m)
        if k and datetime.now() - k > MAX_MATCH_AGE:
            entries[mid] = {"status": "skipped", "reason": "too old"}
            continue

        entry.setdefault("first_seen", now().isoformat(timespec="seconds"))
        details = fetch_match_details(mid)
        if details is None:
            print(f"{mid}: getMatch failed, retrying next run")
            entries[mid] = {**entry, "status": "waiting"}
            continue

        story = build_story(m, matches, details)
        waited = now() - datetime.fromisoformat(entry["first_seen"])
        if not story["scorers_complete"] and waited < SCORER_GRACE:
            own_score = story["home"]["score"] if story["home"]["own"] else story["away"]["score"]
            print(f"{mid}: {sum(s['goals'] for s in story['scorers'])}/{own_score} goals have a scorer, waiting")
            # Helps to confirm the getMatch format from the Actions log
            print(f"{mid}: getMatch keys: {sorted(details.keys())}")
            print(f"{mid}: event codes seen: {sorted({_event_code(e) for e in details.get('events') or [] if isinstance(e, dict)})}")
            entries[mid] = {**entry, "status": "waiting"}
            continue

        entries[mid] = {**entry, "status": "ready", "story": story}
        print(f"{mid}: ready ({story['home']['name']} {story['home']['score']}-"
              f"{story['away']['score']} {story['away']['name']})")

    save_state(state)
    statuses = {e.get("status") for e in entries.values()}
    set_output("render", "true" if "ready" in statuses else "false")
    set_output("publish", "true" if statuses & {"ready", "rendered"} else "false")


def render_story(story, out_path):
    from playwright.sync_api import sync_playwright

    photo = pick_photo(story["result"], story["match_id"])
    data = {**story, "photo": os.path.relpath(photo, TEMPLATE.parent) if photo else ""}

    launch = {}
    if os.getenv("CHROMIUM_PATH"):
        launch["executable_path"] = os.environ["CHROMIUM_PATH"]

    with sync_playwright() as p:
        browser = p.chromium.launch(**launch)
        page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page.goto(TEMPLATE.as_uri())
        page.evaluate("d => window.renderStory(d)", data)
        page.wait_for_function("window.storyReady === true", timeout=20000)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(out_path), type="jpeg", quality=90,
                        clip={"x": 0, "y": 0, "width": 1080, "height": 1920})
        browser.close()
    return photo


def cmd_render(_args):
    state = load_state()
    for mid, entry in state["matches"].items():
        if entry.get("status") != "ready":
            continue
        out = STORIES_DIR / f"{mid}.jpg"
        photo = render_story(entry["story"], out)
        entry.update({
            "status": "rendered",
            "image": out.relative_to(ROOT).as_posix(),
            "photo": photo.relative_to(ROOT).as_posix() if photo else "",
        })
        print(f"{mid}: rendered {out}")
    save_state(state)


def _ig(method, path, **params):
    import requests

    params["access_token"] = os.environ["IG_ACCESS_TOKEN"]
    r = requests.request(method, f"{IG_API}/{path}", params=params, timeout=60)
    if r.status_code >= 400:
        raise RuntimeError(f"Instagram {path}: {r.status_code} {r.text}")
    return r.json()


def wait_for_url(url, timeout=600):
    import requests

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.head(url, timeout=20)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"):
                return True
        except requests.RequestException:
            pass
        time.sleep(15)
    return False


def publish_story(image_url):
    user = os.environ["IG_USER_ID"]
    container = _ig("POST", f"{user}/media", image_url=image_url, media_type="STORIES")["id"]
    for _ in range(30):
        status = _ig("GET", container, fields="status_code").get("status_code")
        if status == "FINISHED":
            break
        if status in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Container {container} {status}")
        time.sleep(5)
    return _ig("POST", f"{user}/media_publish", creation_id=container)["id"]


def cmd_publish(_args):
    enabled = os.getenv("STORY_PUBLISH", "").lower() == "true"
    has_creds = bool(os.getenv("IG_ACCESS_TOKEN") and os.getenv("IG_USER_ID"))
    state = load_state()
    failed = False

    for mid, entry in state["matches"].items():
        if entry.get("status") != "rendered":
            continue
        if not (enabled and has_creds):
            print(f"{mid}: rendered, publishing disabled (STORY_PUBLISH={enabled}, credentials={has_creds})")
            continue

        url = f"{SITE_URL}/{entry['image']}"
        if not wait_for_url(url):
            print(f"{mid}: {url} not served yet, retrying next run")
            continue
        try:
            media_id = publish_story(url)
        except RuntimeError as e:
            print(f"{mid}: {e}")
            entry["errors"] = entry.get("errors", 0) + 1
            failed = True
            continue
        entry.update({"status": "published", "media_id": media_id,
                      "published_at": now().isoformat(timespec="seconds")})
        print(f"{mid}: published story {media_id}")

    save_state(state)
    if failed:
        sys.exit(1)


def cmd_preview(args):
    """Render a story for any played match, without touching the state."""
    matches = load_matches(args.matches)
    m = next((x for x in matches if x["match_id"] == args.match_id), None)
    if m is None or not is_finished(m):
        sys.exit(f"{args.match_id}: not a played match in {args.matches}")
    details = None if args.offline else fetch_match_details(args.match_id)
    story = build_story(m, matches, details)
    if args.scorers:
        story["scorers"] = group_scorers([s.strip() for s in args.scorers.split(",")])
    out = Path(args.out or STORIES_DIR / "preview" / f"{args.match_id}.jpg")
    render_story(story, out)
    print(json.dumps(story, indent=2, ensure_ascii=False))
    print(f"-> {out}")


def cmd_dump(args):
    print(json.dumps(fetch_match_details(args.match_id), indent=2, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("prepare").set_defaults(fn=cmd_prepare)
    sub.add_parser("render").set_defaults(fn=cmd_render)
    sub.add_parser("publish").set_defaults(fn=cmd_publish)
    p = sub.add_parser("preview")
    p.add_argument("match_id")
    p.add_argument("--matches", default=str(MATCHES_FILE))
    p.add_argument("--out")
    p.add_argument("--offline", action="store_true", help="skip getMatch")
    p.add_argument("--scorers", help="comma separated names, for layout tests")
    p.set_defaults(fn=cmd_preview)
    d = sub.add_parser("dump")
    d.add_argument("match_id")
    d.set_defaults(fn=cmd_dump)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
