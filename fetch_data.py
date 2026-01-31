import os
import requests
import json

def fetch_and_save():
    api_key = os.getenv("API_KEY_SECRET")

    # Joukkueet (placeholder)
    url = f"https://spl.torneopal.net/taso/rest/getCategory?api_key={api_key}&competition_id=etejp26&category_id=M6&exclude_fields=player_statistics"

    # Ottelut
    # url = f"https://spl.torneopal.net/taso/rest/getMatches?api_key={api_key}&competition_id=etejp26&category_id=M6" #TODO: lisää group id ja team id kun julkaistaan otteluohjelma

    # Sarjataulukko
    # TODO

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        os.makedirs('assets', exist_ok=True)
        with open("assets/data.json", "w") as f:
            json.dump(data, f, indent=4)

        print("Data saved to assets/data.json")

    except Exception as e:
        print(f"Error fetching data: {e}")
        exit(1)

if __name__ == "__main__":
    fetch_and_save()