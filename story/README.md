# Instagram-tarina futsal-tuloksista

Tunnin välein ajettava `Daily data update` -workflow tekee tarinan automaattisesti, kun futsal-ottelun tulos ilmestyy tulospalveluun.

1. **prepare**: tunnistaa uudet tulokset tiedostosta `assets/futsal_matches.json` (`status == "Played"`) ja hakee maalintekijät `getMatch`-rajapinnasta. Jos kaikkia maaleja ei ole vielä kirjattu, se odottaa enintään 12 tuntia ja julkaisee sen jälkeen ilman puuttuvia nimiä. Yli 3 päivää vanhoja otteluita ei julkaista.
2. **render**: tekee pohjasta `story/template.html` 1080×1920-kuvan `assets/stories/<match_id>.jpg`.
3. Kuva commitoidaan, jolloin GitHub Pages julkaisee sen osoitteessa `https://www.jaliskirahvit.fi/assets/stories/…`.
4. **publish**: julkaisee kuvan tarinana Instagram Graph API:n kautta.

Tila tallennetaan tiedostoon `assets/stories/state.json`. Siinä on jokaisen ottelun tila: `waiting` (odottaa), `ready` (valmis renderöitäväksi), `rendered` (renderöity), `published` (julkaistu) tai `skipped` (ohitettu). Ottelua ei julkaista kahdesti. Jos tarina pitää julkaista uudelleen, poista ottelun rivi tiedostosta.

**Julkaisu on pois päältä**, kunnes repolle on asetettu muuttuja `STORY_PUBLISH=true`. Siihen asti kuvat renderöidään ja commitoidaan, mutta niitä ei julkaista. Näin voit tarkistaa ulkoasun ensimmäisistä otteluista ennen julkaisun käyttöönottoa.

---

## Kuvat

Lisää kuvia kansioihin:

| Kansio | Käytetään kun |
|---|---|
| `assets/story-photos/voitto/` | voitto |
| `assets/story-photos/tasapeli/` | tasapeli |
| `assets/story-photos/tappio/` | tappio |
| `assets/story-photos/yleinen/` | tuloskansio on tyhjä |

Jos kaikki kansiot ovat tyhjiä, käytetään sivuston kuvia kansiosta `assets/photos/`.

- Pystykuvat toimivat parhaiten. Kuva rajataan täyttämään 1080×1920 ja kohdistetaan hieman yläosaan.
- Muodot: JPG, PNG tai WEBP. Pidä kuvat alle noin 1 MB:n kokoisina (pitkä sivu noin 2000 px riittää), koska repo on julkinen ja jokainen kuva jää historiaan.
- **Repo on julkinen**, joten myös kuvat ovat julkisia. Käytä vain kuvia, joiden julkaisuun kuvissa näkyvät pelaajat ovat suostuneet.
- Kuva valitaan ottelun tunnisteen perusteella aina samalla tavalla, joten uudelleenrenderöinti tuottaa saman kuvan.

## Esikatselu omalla koneella

```bash
pip install requests playwright
python -m playwright install chromium

# Mikä tahansa jo pelattu ottelu, myös jalkapallosta. --offline ohittaa API-kutsun.
python story/story.py preview 4157579 --matches assets/matches.json --offline \
    --scorers "Matti Meikäläinen,Matti Meikäläinen,Kalle Kirahvi"
# -> assets/stories/preview/4157579.jpg (ei commitoida)

# getMatch-vastauksen raakadata (vaatii API_KEY_SECRET-ympäristömuuttujan)
API_KEY_SECRET=... python story/story.py dump 4363827
```

> **Tarkistettava ensimmäisen futsal-ottelun jälkeen:** `getMatch`-vastauksen maalitapahtumien tarkkaa muotoa ei ole vielä varmistettu. Jäsennin (`extract_goals`) hyväksyy yleisimmät muodot (`events`/`goals`-lista, jonka koodissa on "maali" tai "goal", tai `lineups`-listan maalimäärät). Aja ensimmäisen pelatun ottelun jälkeen `dump`-komento ja tarkista, että maalintekijät löytyvät ja että omat maalit lasketaan oikealle joukkueelle. Jos ottelu jää tilaan `waiting`, Actions-loki näyttää vastauksen avaimet ja tapahtumakoodit.

---

## Instagram-tunnusten käyttöönotto

Käytössä on **Instagram API with Instagram Login**. Se ei vaadi Facebook-sivua eikä Google Cloudia. Tarvitset:

- fcjaliskirahvit-tilin tunnukset
- jonkun henkilökohtaisen Facebook-tilin, jolla luodaan Meta-kehittäjätili (sovelluksen omistaja; voi olla oma tilisi)

### 1. Vaihda Instagram-tili ammattilaistiliksi (Business)

Tee tämä Instagram-sovelluksessa fcjaliskirahvit-tilillä kirjautuneena:

1. Profiili → ☰ → **Asetukset ja toiminta** → **Tilin tyyppi ja työkalut** → **Vaihda ammattilaistiliin**.
2. Valitse kategoriaksi esim. *Urheilujoukkue* (Sports Team).
3. Valitse tilityypiksi **Yritys (Business)**. Metan dokumentaation mukaan tarinoiden julkaisu API:n kautta on varmasti tuettu yritystileillä. Creator-tilillä se ei välttämättä toimi.
4. Facebook-sivun yhdistämisen voi ohittaa.

Vaihto on ilmainen, eikä se muuta tilin julkaisuja tai seuraajia. Tilin pitää olla julkinen.

### 2. Luo Meta-kehittäjätili ja sovellus

1. Mene osoitteeseen <https://developers.facebook.com>, kirjaudu Facebook-tunnuksilla ja rekisteröidy kehittäjäksi (vahvistus puhelinnumerolla tai sähköpostilla).
2. **My Apps** → **Create App**.
   - Nimi esim. `Jaliskirahvit stories`.
   - Käyttötapaus (use case): **Manage messaging & content on Instagram**.
   - Business portfolio: "I don't want to connect a business portfolio yet" riittää.
3. Sovellus jää **Development**-tilaan. Se riittää, kun julkaistaan vain tiliin, jolla on rooli sovelluksessa. App Review -tarkastusta ei tarvita.

### 3. Liitä Instagram-tili ja luo token

1. Avaa sovelluksen hallintapaneelissa **Instagram** → **API setup with Instagram login**.
2. Kohdassa *Generate access tokens* valitse **Add account** ja kirjaudu fcjaliskirahvit-tunnuksilla. Hyväksy oikeudet, joihin kuuluvat `instagram_business_basic` ja `instagram_business_content_publish`.
   - Jos sovellus pyytää lisäämään tilin testaajaksi, mene kohtaan **App roles → Roles → Instagram Testers** ja lisää `fcjaliskirahvit`. Hyväksy kutsu Instagramissa (verkossa: Asetukset → Sovellukset ja verkkosivustot → *Tester invites*) ja yritä uudelleen.
3. Tilin viereen tulee **Generate token**. Kopioi token. Se on pitkäikäinen token, joka on voimassa 60 päivää.
4. Tarkista token ja hae tilin ID:

   ```bash
   curl "https://graph.instagram.com/v23.0/me?fields=user_id,username&access_token=TOKEN"
   ```

   Vastauksen `user_id` on `IG_USER_ID`.

### 4. Lisää tunnukset GitHubiin

Mene repossa kohtaan **Settings → Secrets and variables → Actions**.

| Tyyppi | Nimi | Arvo |
|---|---|---|
| Secret | `IG_ACCESS_TOKEN` | token kohdasta 3 |
| Secret | `IG_USER_ID` | `user_id` kohdasta 3 |
| Secret | `SECRETS_PAT` | ks. alla (tokenin automaattinen uusiminen) |
| Variable | `STORY_PUBLISH` | `true`, kun haluat julkaisun päälle |

**Tokenin uusiminen:** Instagram-token vanhenee 60 päivässä. Workflow `Instagram token refresh` uusii sen kahdesti kuukaudessa ja tallentaa uuden tokenin secretiin. Tallentamiseen tarvitaan oma GitHub-token:

1. GitHub → oma profiili → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Repository access: *Only select repositories* → `jaliskirahvit.github.io`.
3. Permissions → Repository permissions → **Secrets: Read and write**. Muita oikeuksia ei tarvita.
4. Aseta voimassaoloksi esim. 1 vuosi ja tallenna token secretiksi `SECRETS_PAT`.
5. Testaa ajamalla Actions → *Instagram token refresh* → **Run workflow**.

Jos `SECRETS_PAT`-tokenia ei ole, token pitää luoda käsin uudelleen kohdan 3 mukaisesti vähintään 60 päivän välein.

### 5. Testaa

1. Jätä `STORY_PUBLISH` aluksi asettamatta ja katso ensimmäisen ottelun jälkeen kuva `assets/stories/<match_id>.jpg`.
2. Kun kuva näyttää hyvältä, aseta `STORY_PUBLISH=true`. Jo renderöity tarina julkaistaan seuraavalla tunnin ajolla, jos ottelu on alle 3 päivää vanha. Julkaisun voi käynnistää heti kohdasta Actions → *Daily data update* → **Run workflow**.

### Rajoitukset

- API:lla voi julkaista vain kuvan. Tarroja, linkkejä, musiikkia tai tunnisteita ei voi lisätä.
- Rajana on 50 API-julkaisua vuorokaudessa.
- Instagram hakee kuvan julkisesta osoitteesta, joten se julkaistaan GitHub Pagesin kautta. Julkaisuvaihe odottaa enintään 10 minuuttia, että Pages on päivittynyt. Jos odotus ei riitä, julkaisua yritetään uudelleen seuraavalla ajolla.
