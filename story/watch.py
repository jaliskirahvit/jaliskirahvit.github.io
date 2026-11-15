"""Match day watcher.

GitHub runs the hourly schedule of the data update only a few times a day,
so on a futsal match day this keeps a runner waiting and dispatches the data
update every 10 minutes from shortly after kick-off until the story is out.
workflow_dispatch runs are not throttled like scheduled ones.

    python story/watch.py           # watch today's match (Actions job)
    python story/watch.py --check   # exit 0 if a watch is needed now
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
MATCHES_FILE = ROOT / "assets" / "futsal_matches.json"
STATE_FILE = ROOT / "assets" / "stories" / "state.json"
TZ = ZoneInfo("Europe/Helsinki")

FIRST_POLL = timedelta(minutes=55)     # after kick-off
LAST_POLL = timedelta(hours=8)         # after kick-off, then the normal schedule takes over
POLL_EVERY = timedelta(minutes=10)
JOB_BUDGET = timedelta(hours=5, minutes=40)  # Actions jobs are killed at 6 h

DONE = {"rendered", "published", "skipped"}


def now():
    return datetime.now(TZ)


def load(path, default):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return default


def kickoff(m):
    try:
        return datetime.fromisoformat(f"{m['date']}T{(m.get('time') or '00:00:00')[:8]}").replace(tzinfo=TZ)
    except (KeyError, ValueError):
        return None


def pending_matches():
    """Matches kicking off within 14 h or played in the last 8 h whose story is not done yet."""
    state = load(STATE_FILE, {}).get("matches", {})
    publish_on = state_publish_enabled()
    out = []
    for m in load(MATCHES_FILE, {}).get("matches", []):
        k = kickoff(m)
        if k is None or not (k - timedelta(hours=14) <= now() <= k + LAST_POLL):
            continue
        status = state.get(m["match_id"], {}).get("status")
        # Without publishing a rendered image is as far as it goes
        if status in DONE and (status != "rendered" or not publish_on):
            continue
        out.append((k, m["match_id"]))
    return sorted(out)


def state_publish_enabled():
    return os.getenv("STORY_PUBLISH", "").lower() != "false"


def sh(*cmd):
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, cwd=ROOT, check=False).returncode


def refresh():
    sh("git", "pull", "--quiet", "--ff-only")


def main():
    if "--check" in sys.argv:
        sys.exit(0 if pending_matches() else 1)

    started = now()
    while True:
        refresh()
        pending = pending_matches()
        if not pending:
            print("No match to watch")
            return

        first_kickoff, mid = pending[0]
        wake = first_kickoff + FIRST_POLL
        if now() < wake:
            wait = wake - now()
        else:
            print(f"{mid}: dispatching data update", flush=True)
            sh("gh", "workflow", "run", "daily_update.yml", "--ref", "main")
            wait = POLL_EVERY

        if now() + wait > started + JOB_BUDGET:
            # Hand over to a fresh run before this job hits the 6 h limit
            remaining = started + JOB_BUDGET - now()
            if remaining.total_seconds() > 0:
                time.sleep(remaining.total_seconds())
            print("Job budget used, continuing in a new run", flush=True)
            sh("gh", "workflow", "run", "matchday_watch.yml", "--ref", "main")
            return

        print(f"{mid}: kick-off {first_kickoff:%d.%m. %H:%M}, sleeping {int(wait.total_seconds() // 60)} min", flush=True)
        time.sleep(wait.total_seconds())


if __name__ == "__main__":
    main()
