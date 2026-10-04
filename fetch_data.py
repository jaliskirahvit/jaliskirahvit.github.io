import os
import requests
import json
from datetime import datetime, timezone

API_BASE_URL = "https://spl.torneopal.net/taso/rest"

TEAM_ID = "35213369"
COMPETITION_ID = "etejp26"
CATEGORY_ID = "M6"

def fetch_json(endpoint, params):
    query_params = {"api_key": os.getenv("API_KEY_SECRET")}
    query_params.update(params)

    url = f"{API_BASE_URL}/{endpoint}"

    try:
        response = requests.get(url, params=query_params, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching {endpoint}: {e}")
        return None

def save_json(filename, data):
    os.makedirs('assets', exist_ok=True)
    with open(f"assets/{filename}", "w") as f:
        json.dump(data, f, indent=4)
    print(f"Saved {filename}")

def load_json(filename):
    try:
        with open(f"assets/{filename}") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None

def fetch_and_save(task):
    data = fetch_json(task["endpoint"], task.get("params", {}))
    if data is not None:
        save_json(task["filename"], data)

def to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0

def build_roster(team_data):
    # getTeam also returns contact details, invoices and suspension reasons,
    # so only the public roster fields are published
    team = team_data["team"]
    players = []

    for p in team.get("players", []):
        if p.get("inactive") == "1":
            continue
        players.append({
            "player_id": p["player_id"],
            "first_name": p.get("first_name", ""),
            "last_name": p.get("last_name", ""),
            "shirt_number": p.get("shirt_number", ""),
            "position": p.get("position", ""),
            "captain": p.get("captain", ""),
            "img_url": p.get("img_url") or "",
            "matches": to_int(p.get("matches")),
            "goals": to_int(p.get("goals")),
            "assists": to_int(p.get("assists")),
            "warnings": to_int(p.get("warnings")),
            "suspensions": to_int(p.get("suspensions")),
        })

    return {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "team_name": team.get("team_name", ""),
        "players": players,
    }

def build_career(player_data):
    # getPlayer only lists individual matches, so seasons are summed up here
    seasons = {}

    for m in player_data["player"].get("matches", []):
        if m.get("status") != "Played" or m.get("not_participated") == "1":
            continue

        key = (m.get("season_id"), m.get("sport_id"), m.get("competition_id"), m.get("category_id"), m.get("team_id"))
        season = seasons.get(key)
        if season is None:
            own_side = "A" if m.get("team_id") == m.get("team_A_id") else "B"
            season = seasons[key] = {
                "season": m.get("season_id", ""),
                "sport": m.get("sport_id", ""),
                "competition_name": m.get("competition_name", ""),
                "category_name": m.get("category_name", ""),
                "team_name": m.get("team_name", ""),
                "crest": m.get(f"club_{own_side}_crest", ""),
                "last_date": "",
                "matches": 0,
                "goals": 0,
                "assists": 0,
                "warnings": 0,
                "suspensions": 0,
            }

        season["matches"] += 1
        season["goals"] += to_int(m.get("player_goals"))
        season["assists"] += to_int(m.get("player_assists"))
        season["warnings"] += to_int(m.get("player_warnings"))
        season["suspensions"] += to_int(m.get("player_suspensions"))
        season["last_date"] = max(season["last_date"], m.get("date") or "")

    return sorted(seasons.values(), key=lambda s: s["last_date"], reverse=True)

def update_careers(player_ids):
    # Careers change slowly, so every player is refetched once a day and
    # new roster additions as soon as they appear
    today = datetime.now(timezone.utc).date().isoformat()
    existing = load_json("careers.json") or {}
    careers = existing.get("players", {}) if existing.get("updated") == today else {}

    missing = [pid for pid in player_ids if pid not in careers]
    if not missing:
        return

    for pid in missing:
        data = fetch_json("getPlayer", {"player_id": pid})
        if data and "player" in data:
            careers[pid] = build_career(data)
        elif pid in existing.get("players", {}):
            careers[pid] = existing["players"][pid]

    save_json("careers.json", {
        "updated": today,
        "players": {pid: careers[pid] for pid in player_ids if pid in careers},
    })

if __name__ == "__main__":
    tasks = [
        {
            "endpoint": "getMatches",
            "filename": "matches.json",
            "params": {
                "team_id": TEAM_ID,
            }
        },
        {
            "endpoint": "getGroup",
            "filename": "group.json",
            "params": {
                "competition_id": COMPETITION_ID,
                "category_id": CATEGORY_ID,
                "group_id": "14",
            }
        }
    ]

    for task in tasks:
        fetch_and_save(task)

    team_data = fetch_json("getTeam", {
        "team_id": TEAM_ID,
        "competition_id": COMPETITION_ID,
        "category_id": CATEGORY_ID,
    })
    if team_data and "team" in team_data:
        roster = build_roster(team_data)
        save_json("players.json", roster)
        update_careers([p["player_id"] for p in roster["players"]])
