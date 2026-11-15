"""Match reminder for the team WhatsApp group.

The day before a match this builds the usual reminder message and sends it
as a push notification through ntfy. Tapping the notification opens WhatsApp
with the text filled in; pick the team group and send. See reminder/README.md.

    python reminder/reminder.py run              # Actions step: notify if due
    python reminder/reminder.py preview [ID]     # print the message (next match by default)
    python reminder/reminder.py test [ID]        # send a test notification, state untouched
"""

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
MATCH_FILES = [ROOT / "assets" / "futsal_matches.json", ROOT / "assets" / "matches.json"]
STATE_FILE = ROOT / "assets" / "reminders" / "state.json"
TZ = ZoneInfo("Europe/Helsinki")

KIRAHVIT_CLUB_ID = "6950"
OWN_NAME = "FC Jaliskirahvit"
ARRIVE_BEFORE = timedelta(minutes=45)
SEND_FROM_HOUR = 10                  # earliest local hour on the day before
SAME_DAY_CUTOFF = timedelta(hours=3)  # missed the day before: still send until kick-off minus this
KIT = "Ottakaa molemmat"

NTFY_SERVER = os.getenv("NTFY_SERVER") or "https://ntfy.sh"

# Nimenhuuto events link to the match in tulospalvelu ("Lisätiedot"), which
# maps them to match_id. Manual overrides: reminder/nimenhuuto.json {match_id: event_id}
NIMENHUUTO = "https://fcjaliskirahvit.nimenhuuto.com"
NIMENHUUTO_OVERRIDES = ROOT / "reminder" / "nimenhuuto.json"
_events_cache = None

# Street addresses by venue_name. The API only gives the hall name and
# coordinates, so add new venues here. Unknown venues get only the name.
VENUE_ADDRESSES = {
    "Otahalli B": "Otaranta 6, 02150 Espoo",
    "Latokartano LH 1": "Agronominkatu 26, 00790 Helsinki",
    "Opinmäen liikuntahalli": "Lillhemtintie 1, 02250 Espoo",
    "Kaarela AC 1": "Kaarelankuja 2 A, 00430 Helsinki",
    "Tali halli TN": "Purotie 8, 00380 Helsinki",
}

WEEKDAYS = ["maanantaina", "tiistaina", "keskiviikkona", "torstaina",
            "perjantaina", "lauantaina", "sunnuntaina"]


def now():
    return datetime.now(TZ)


def load_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return default


def load_state():
    return load_json(STATE_FILE, {"sent": {}})


def save_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=4, ensure_ascii=False) + "\n")


def all_matches():
    out = []
    for f in MATCH_FILES:
        out += load_json(f, {}).get("matches", [])
    return out


def kickoff(m):
    t = (m.get("time") or "")[:5]
    if not m.get("date") or not t or t == "00:00":
        return None  # no kick-off time yet, nothing useful to send
    try:
        return datetime.fromisoformat(f"{m['date']}T{t}").replace(tzinfo=TZ)
    except ValueError:
        return None


def opponent(m):
    side = "B" if str(m.get("club_A_id")) == KIRAHVIT_CLUB_ID else "A"
    return m.get(f"team_{side}_name") or "?"


def day_word(k, today):
    days = (k.date() - today).days
    weekday = WEEKDAYS[k.weekday()]
    if days == 0:
        return f"Tänään {weekday}"
    if days == 1:
        return f"Huomenna {weekday}"
    return f"{weekday.capitalize()} {k.day}.{k.month}."


def location_lines(m):
    name = m.get("venue_name") or m.get("venue_location_name") or "?"
    address = VENUE_ADDRESSES.get(name)
    return [f"Sijainti: {name},", address] if address else [f"Sijainti: {name}"]


def nimenhuuto_events():
    """{match_id: event_id} from the public list of upcoming events."""
    global _events_cache
    if _events_cache is None:
        _events_cache = {}
        try:
            req = urllib.request.Request(f"{NIMENHUUTO}/events", headers={"User-Agent": "jaliskirahvit-reminder"})
            with urllib.request.urlopen(req, timeout=30) as r:
                page = r.read().decode("utf-8", "replace")
            for block in page.split('class="event-detailed-container"')[1:]:
                event = re.search(r"/events/(\d+)", block)
                match = re.search(r"palloliitto\.fi/match/(\d+)", block)
                if event and match:
                    _events_cache[match.group(1)] = event.group(1)
        except OSError as e:
            print(f"Nimenhuuto lookup failed: {e}")
    return _events_cache


def signup_link(m):
    mid = str(m.get("match_id"))
    event = load_json(NIMENHUUTO_OVERRIDES, {}).get(mid) or nimenhuuto_events().get(mid)
    return f"{NIMENHUUTO}/events/{event}" if event else f"{NIMENHUUTO}/events"


def build_message(m, today=None):
    k = kickoff(m)
    today = today or now().date()
    lines = [
        f"{OWN_NAME} - {opponent(m)}",
        "",
        *location_lines(m),
        "",
        f"Päivämäärä: {day_word(k, today)}",
        f"Paikalla {(k - ARRIVE_BEFORE):%H:%M}",
        f"Pelin aloitus: {k:%H:%M}",
        "",
        f"Peliasu: {KIT}",
        "",
        f"Ilmoittautuminen: {signup_link(m)}",
    ]
    return "\n".join(lines)


def whatsapp_link(text):
    return "https://wa.me/?text=" + urllib.parse.quote(text, safe="")


def due_matches(t):
    """Fixtures kicking off tomorrow (from SEND_FROM_HOUR) or later today."""
    out = []
    for m in all_matches():
        k = kickoff(m)
        if k is None or m.get("status") != "Fixture":
            continue
        days = (k.date() - t.date()).days
        if (days == 1 and t.hour >= SEND_FROM_HOUR) or (days == 0 and t <= k - SAME_DAY_CUTOFF):
            out.append(m)
    return sorted(out, key=kickoff)


def next_fixture():
    upcoming = [m for m in all_matches()
                if m.get("status") == "Fixture" and kickoff(m) and kickoff(m) > now()]
    return min(upcoming, key=kickoff) if upcoming else None


def find_match(match_id):
    for m in all_matches():
        if str(m.get("match_id")) == str(match_id):
            return m
    sys.exit(f"Match {match_id} not found")


def notify(m, text, test=False):
    topic = os.getenv("NTFY_TOPIC")
    if not topic:
        print("NTFY_TOPIC is not set, nothing sent")
        return False
    link = whatsapp_link(text)
    title = f"Pelimuistutus: {OWN_NAME} - {opponent(m)}"
    payload = {
        "topic": topic,
        "title": ("TESTI: " if test else "") + title,
        "message": text,
        "click": link,
        "tags": ["soccer"],
        "actions": [{"action": "view", "label": "Avaa WhatsApp", "url": link, "clear": True}],
    }
    req = urllib.request.Request(
        NTFY_SERVER.rstrip("/") + "/",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        msg_id = json.loads(r.read()).get("id")
    print(f"Notification {msg_id} sent for match {m.get('match_id')}")
    return True


def cmd_run(_args):
    state = load_state()
    sent = state.setdefault("sent", {})
    changed = False
    for m in due_matches(now()):
        mid = str(m["match_id"])
        if mid in sent:
            continue
        text = build_message(m)
        print(text, "\n")
        if notify(m, text):
            sent[mid] = {"kickoff": kickoff(m).isoformat(), "sent_at": now().isoformat(timespec="seconds")}
            changed = True
    if changed:
        save_state(state)
    else:
        print("No reminders due")


def pick(args):
    m = find_match(args.match_id) if args.match_id else next_fixture()
    if not m or not kickoff(m):
        sys.exit("No upcoming match with a kick-off time")
    return m


def cmd_preview(args):
    m = pick(args)
    text = build_message(m)
    print(text)
    print("\n" + whatsapp_link(text))


def cmd_test(args):
    m = pick(args)
    notify(m, build_message(m), test=True)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run").set_defaults(func=cmd_run)
    for name, func in (("preview", cmd_preview), ("test", cmd_test)):
        s = sub.add_parser(name)
        s.add_argument("match_id", nargs="?")
        s.set_defaults(func=func)
    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
