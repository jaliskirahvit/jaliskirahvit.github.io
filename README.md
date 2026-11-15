# FC Jaliskirahvit

Joukkueen kotisivu osoitteessa <https://www.jaliskirahvit.fi> (GitHub Pages, `main`-haara).

## Sivut

| Sivu | Sisältö |
|---|---|
| `index.html` | Etusivu, tulevat ja pelatut ottelut |
| `futsal.html` | Futsal-kausi: ottelut ja sarjataulukko |
| `jalkapallo.html` | Jalkapallokausi: ottelut ja sarjataulukko |
| `joukkue.html` | Pelaajat, tilastot ja urat |

Tyylit ovat kansiossa `css/`, skriptit kansiossa `js/` ja kuvat, fontit sekä data kansiossa `assets/`.

## Data

`fetch_data.py` hakee Palloliiton tulospalvelun (Torneopal / Taso API) datan JSON-tiedostoiksi kansioon `assets/`:

| Tiedosto | Sisältö |
|---|---|
| `matches.json`, `group.json` | Jalkapallon ottelut ja lohko |
| `futsal_matches.json`, `futsal_group.json` | Futsalin ottelut ja lohko |
| `players.json` | Jalkapallojoukkueen pelaajat ja tilastot |
| `careers.json` | Pelaajien kausittaiset tilastot |

Joukkueiden, sarjojen ja lohkojen tunnisteet ovat skriptin alussa. API-avain on secretissä `TASO_API_KEY`.

## Automaatiot (GitHub Actions)

| Workflow | Milloin | Mitä |
|---|---|---|
| `daily_update.yml` | ajastettu tunnin välein, ottelupäivinä vahti käynnistää 10 min välein | Päivittää datan ja tekee Instagram-tarinan uusista futsal-tuloksista |
| `matchday_watch.yml` | ottelupäivinä | Käynnistää datapäivityksen tiheästi ottelun jälkeen, koska GitHub ajaa ajastettuja ajoja vain muutaman kerran päivässä |
| `story_test.yml` | käsin | Testaa tarinaketjun julkaisematta mitään |
| `instagram_token_refresh.yml` | maanantaisin | Tarkistaa, että Instagram-token toimii |

Instagram-tarinoiden toiminta, kuvat ja tunnukset on kuvattu tiedostossa [`story/README.md`](story/README.md).

## Kehitys

Botti commitoi `main`-haaraan datapäivityksiä jatkuvasti, joten hae muutokset ennen omaa pushia:

```bash
git checkout main
git pull origin main
git checkout -b branch-name
# muutokset
git add .
git commit -m "commit message"
git checkout main
git pull origin main
git merge branch-name
git push origin main
git branch -d branch-name
```

Sivut voi esikatsella paikallisesti esim. komennolla `python -m http.server`.
