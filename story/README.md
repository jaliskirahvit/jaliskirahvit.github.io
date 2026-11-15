# Instagram-tarina futsal-tuloksista

Kun futsal-ottelun tulos ilmestyy tulospalveluun, @fcjaliskirahvit-tilille julkaistaan automaattisesti tarina. Siinä näkyvät lopputulos, maalintekijät ja seuraava ottelu.

## Näin se toimii

Workflow `daily_update.yml` ajaa datan haun jälkeen nämä vaiheet:

1. **prepare** (`story/story.py prepare`): etsii tiedostosta `assets/futsal_matches.json` uudet pelatut ottelut (`status == "Played"`) ja hakee maalintekijät tulospalvelun `getMatch`-tapahtumista (koodi `maali`).
   - Jos maalintekijöitä on kirjattu vähemmän kuin maaleja, se odottaa enintään 12 tuntia ja julkaisee sen jälkeen ilman puuttuvia nimiä.
   - Yli 3 päivää vanhoja otteluita ei julkaista.
2. **render**: tekee pohjasta `story/template.html` 1080×1920-kuvan `assets/stories/<match_id>.jpg` (Playwright + Chromium).
3. Kuva commitoidaan, jolloin GitHub Pages julkaisee sen osoitteessa `https://www.jaliskirahvit.fi/assets/stories/…`.
4. **publish**: Instagram hakee kuvan tästä osoitteesta, ja se julkaistaan tarinana Graph API:n kautta.

**Ottelupäivän vahti** (`story/watch.py`, `matchday_watch.yml`): GitHub ajaa tunnin välein ajastetun päivityksen käytännössä vain muutaman kerran päivässä. Kun datapäivitys huomaa saman päivän ottelun, se käynnistää vahdin. Vahti odottaa, kunnes aloituksesta on kulunut 55 minuuttia, ja käynnistää sen jälkeen datapäivityksen 10 minuutin välein, kunnes tarina on julkaistu tai aloituksesta on kulunut 8 tuntia. Varalla vahti käynnistyy myös ajastetusti joka aamu.

### Tila

Tila tallennetaan tiedostoon `assets/stories/state.json`. Jokaisella ottelulla on yksi tila:

| Tila | Merkitys |
|---|---|
| `waiting` | Tulos on tullut, mutta maalintekijöitä odotetaan |
| `ready` | Valmis renderöitäväksi |
| `rendered` | Kuva on tehty, julkaisu odottaa |
| `published` | Julkaistu (`media_id`, `published_at`) |
| `skipped` | Ohitettu (liian vanha) |

Ottelua ei julkaista kahdesti. Jos tarina pitää tehdä uudelleen, poista ottelun rivi tiedostosta.

### Julkaisun keskeytys

Julkaisu on oletuksena päällä. Sen saa tauolle asettamalla repoon muuttujan `STORY_PUBLISH` = `false` (Settings → Secrets and variables → Actions → Variables). Tauon aikana kuvat renderöidään ja commitoidaan, mutta niitä ei julkaista.

### Kohokohta

Instagramin rajapinta ei tue kohokohtia, joten tarina pitää lisätä kohokohtaan **Futsal** käsin: avaa tarina profiilista → **Kohokohta** → *Futsal*.

## Kuvat

| Kansio | Käytetään, kun |
|---|---|
| `assets/story-photos/voitto/` | voitto |
| `assets/story-photos/tasapeli/` | tasapeli |
| `assets/story-photos/tappio/` | tappio |
| `assets/story-photos/yleinen/` | tuloksen kansio on tyhjä |

- Nykyiset kuvat on valittu joukkueen kuvaajan kuvista. Ne on rajattu valmiiksi pystymuotoon 1080×1920, JPEG-muodossa ja kooltaan noin 450 kt. Rajaa uudet kuvat samoin.
- Kuva valitaan ottelun tunnisteen perusteella, joten uudelleenrenderöinti tuottaa aina saman kuvan.
- **Repo on julkinen**, joten myös kuvat ovat julkisia. Käytä vain kuvia, joiden julkaisuun kuvissa näkyvät pelaajat ovat suostuneet.

## Testaus

- **Story test** (Actions → *Story test* → Run workflow): ajo renderöi jo pelatusta ottelusta tarinan oikeilla maalintekijöillä (oletuksena jalkapallo-ottelu 4157579), julkaisee kuvan tiedostoon `assets/stories/test.jpg` ja tarkistaa, että Instagram hyväksyy sen tarinaksi. **Mitään ei julkaista.** Hyväksytty luonnos poistuu Instagramista itsestään 24 tunnissa.
- **Paikallinen esikatselu:**

  ```bash
  pip install requests playwright
  python -m playwright install chromium

  # --offline ohittaa API-kutsun, --scorers antaa testinimet
  python story/story.py preview 4157579 --matches assets/matches.json --offline \
      --scorers "Matti Meikäläinen,Matti Meikäläinen,Kalle Kirahvi"
  # -> assets/stories/preview/4157579.jpg (ei commitoida)

  # Oikeat maalintekijät ja getMatch-raakadata (vaatii API-avaimen)
  API_KEY_SECRET=... python story/story.py preview 4157579 --matches assets/matches.json
  API_KEY_SECRET=... python story/story.py dump 4157579
  ```

## Tunnukset

Julkaisu käyttää **Instagram Graph API:a Facebook Loginin kautta**:

- Instagram-tili @fcjaliskirahvit on yritystili (Business), joka on yhdistetty Facebook-sivuun **FC Jaliskirahvit**.
- Joukkueen Meta-sovellus ([developers.facebook.com/apps](https://developers.facebook.com/apps/)) on Development-tilassa. App Review -tarkastusta ei tarvita, koska julkaisu tehdään vain omalle tilille.
- Oikeudet: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` ja `business_management`.

Arvot on tallennettu kohtaan Settings → Secrets and variables → Actions:

| Tyyppi | Nimi | Arvo |
|---|---|---|
| Secret | `IG_ACCESS_TOKEN` | Facebook-sivun token (Expires: Never) |
| Secret | `IG_USER_ID` | Instagram-tilin ID (`instagram_business_account.id`) |
| Variable | `IG_API_HOST` | `graph.facebook.com` |
| Variable | `STORY_PUBLISH` | ei asetettu (= päällä), `false` laittaa julkaisun tauolle |

### Tokenin uusiminen

Sivun token ei vanhene, mutta Metan **datakäyttöoikeus päättyy noin 90 päivän välein**. Workflow *Instagram token refresh and check* testaa tokenin maanantaisin. Jos token ei toimi, ajo epäonnistuu ja GitHub lähettää siitä sähköpostin. Uusi token silloin näin:

1. Avaa [Graph API Explorer](https://developers.facebook.com/tools/explorer/) ja valitse joukkueen sovellus ja *User Token*. Valitse yllä luetellut oikeudet ja paina **Generate Access Token**. Valitse dialogissa FC Jaliskirahvitin sivu ja Instagram-tili.
2. Pidennä token [Access Token Debuggerissa](https://developers.facebook.com/tools/debug/accesstoken/) (**Extend Access Token**).
3. Hae Explorerissa pidennetyllä tokenilla `GET me/accounts` ja kopioi FC Jaliskirahvitin rivin `access_token`.
4. Tarkista debuggerista, että tyyppi on *Page* ja *Expires* on *Never*. Päivitä token sitten secretiin `IG_ACCESS_TOKEN`.
5. Varmista toiminta ajamalla *Instagram token refresh and check* käsin.

> Koodi tukee myös Instagram Login -polkua (`graph.instagram.com`, 60 päivän token). Siinä muuttuja `IG_API_HOST` jätetään asettamatta, ja token uusitaan automaattisesti, jos secret `SECRETS_PAT` on asetettu. Kyseessä on fine-grained GitHub-token, jolla on oikeus *Secrets: Read and write*. Polku ei ole nyt käytössä.

## Rajoitukset

- Rajapinnalla voi julkaista vain kuvan. Tarroja, linkkejä, musiikkia ja kohokohtia ei voi lisätä.
- Rajana on 50 API-julkaisua vuorokaudessa.
- Julkaisu odottaa GitHub Pagesin päivittymistä enintään 10 minuuttia. Jos odotus ei riitä, julkaisua yritetään uudelleen seuraavalla ajolla.
