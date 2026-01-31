import os
import requests
import json

API_BASE_URL = "https://spl.torneopal.net/taso/rest"

def fetch_and_save(task):
    endpoint = task["endpoint"]
    filename = task["filename"]
    extra_params = task.get("params", {})

    api_key = os.getenv("API_KEY_SECRET")
    query_params = {"api_key": api_key}

    query_params.update(extra_params)

    url = f"{API_BASE_URL}/{endpoint}"

    try:
        response = requests.get(url, params=query_params)
        response.raise_for_status()
        data = response.json()

        os.makedirs('assets', exist_ok=True)
        with open(f"assets/{filename}", "w") as f:
            json.dump(data, f, indent=4)
        print(f"Saved {filename} from {endpoint}")

    except Exception as e:
        print(f"Error fetching {endpoint}: {e}")

if __name__ == "__main__":
    tasks = [
        {
            "endpoint": "getMatches",
            "filename": "matches.json",
            "params": {
                "team_id": "35213369",
            }
        },
        {
            "endpoint": "getGroup",
            "filename": "group.json",
            "params": {
                "competition_id": "etejp26",
                "category_id": "M6",
                "group_id": "1",
            }
        }
    ]

    for task in tasks:
        fetch_and_save(task)