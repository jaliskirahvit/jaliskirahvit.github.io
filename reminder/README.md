# Pelimuistutus WhatsApp-ryhmään

Ottelua edeltävänä päivänä puhelimeen tulee ilmoitus, jossa on valmis muistutusviesti. Kun ilmoitusta napauttaa, WhatsApp avautuu viesti valmiiksi kirjoitettuna. Valitse joukkueen ryhmä ja paina lähetä.

Ryhmään ei lähetetä mitään automaattisesti. WhatsAppin virallinen rajapinta ei tue tavallisia ryhmiä, ja epäviralliset botit voivat johtaa numeron estoon.

## Viesti

```
FC Jaliskirahvit - Kasiysi/3

Sijainti: Otahalli B,
Otaranta 6, 02150 Espoo

Päivämäärä: Huomenna lauantaina
Paikalla 15:15
Pelin aloitus: 16:00

Peliasu: Ottakaa molemmat

Ilmoittautuminen: https://fcjaliskirahvit.nimenhuuto.com/events/20565079
```

- Tiedot tulevat tiedostoista `assets/futsal_matches.json` ja `assets/matches.json`.
- **Paikalla** on aina 45 minuuttia ennen aloitusta.
- **Peliasu** on aina *Ottakaa molemmat*. Sen voi muuttaa WhatsAppissa ennen lähettämistä.
- **Ilmoittautuminen** on linkki ottelun Nimenhuuto-tapahtumaan. Linkki löytyy automaattisesti: Nimenhuudon julkisessa tapahtumalistassa jokaisen ottelun lisätiedoissa on linkki tulospalveluun (`tulospalvelu.palloliitto.fi/match/<match_id>`). Jos tapahtumaa ei löydy, viestissä on linkki tapahtumalistaan. Yksittäisen ottelun voi asettaa käsin tiedostossa `reminder/nimenhuuto.json`, esimerkiksi `{"4363833": "20565079"}`. Ilmoittautuneiden määrä ei näy ilman kirjautumista, joten sitä ei ole viestissä.
- **Osoite** tulee taulukosta `VENUE_ADDRESSES` tiedostossa `reminder/reminder.py`, koska rajapinta antaa vain hallin nimen. Jos hallia ei ole taulukossa, viestissä on pelkkä nimi. Lisää uudet hallit taulukkoon.

## Näin se toimii

Workflow `daily_update.yml` ajaa datan haun jälkeen komennon `python reminder/reminder.py run`:

- Ilmoitus lähtee ottelua edeltävänä päivänä ensimmäisellä ajolla klo 10 jälkeen (Suomen aikaa).
- Jos edellisen päivän ajot jäävät väliin, ilmoitus lähtee pelipäivänä viimeistään 3 tuntia ennen aloitusta. Silloin viestissä lukee *Tänään*.
- Lähetetyt ottelut tallennetaan tiedostoon `assets/reminders/state.json`, joten samasta ottelusta ei tule kahta ilmoitusta. Jos ilmoitus pitää lähettää uudelleen, poista ottelun rivi tiedostosta.
- Ilmoitukset kulkevat palvelun [ntfy](https://ntfy.sh) kautta. Se on ilmainen eikä vaadi tiliä.

## Käyttöönotto

1. Asenna puhelimeen **ntfy**-sovellus (Google Play, F-Droid tai App Store).
2. Keksi aiheelle (topic) pitkä satunnainen nimi, esimerkiksi `jaliskirahvit-` ja perään 16 satunnaista merkkiä. Kuka tahansa nimen tietävä voi lukea ilmoitukset, joten älä käytä arvattavaa nimeä.
3. Tilaa aihe sovelluksessa: **+** → kirjoita aiheen nimi → *Subscribe*.
4. Tallenna sama nimi GitHubiin: Settings → Secrets and variables → Actions → *New repository secret*, nimi `NTFY_TOPIC`.
5. Testaa omalla koneella:

   ```bash
   NTFY_TOPIC=<aihe> python reminder/reminder.py test
   ```

Ilman secretiä `NTFY_TOPIC` ilmoituksia ei lähetetä. Ottelua ei silloin merkitä lähetetyksi, joten muistutus lähtee heti, kun secret on lisätty.

## Testaus

```bash
python reminder/reminder.py preview            # seuraavan ottelun viesti ja WhatsApp-linkki
python reminder/reminder.py preview 4363833    # tietty ottelu
NTFY_TOPIC=<aihe> python reminder/reminder.py test   # testi-ilmoitus puhelimeen, tilaa ei muuteta
```
