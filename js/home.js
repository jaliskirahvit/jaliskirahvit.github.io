// Home page: the season that has the next match is shown in full, seasons
// that have ended get a short recap card.

const PROGRAM_LENGTH = 5;
const PROGRAM_RESULTS = 2;

async function loadHome() {
    const nextContainer = document.querySelector(".matches__next-match-container");
    const programContainer = document.querySelector(".matches__program-container");
    const programLink = document.querySelector(".matches__program-link");
    const tableContainer = document.querySelector(".table__container");
    const tableSubtitle = document.querySelector(".table .section-subtitle");
    const tableLink = document.querySelector(".table__link");
    const heroSeason = document.querySelector(".hero__season");
    const recapSection = document.querySelector(".recaps");
    const recapContainer = document.querySelector(".recaps__container");

    const results = await Promise.allSettled(Object.values(SEASONS).map(loadSeason));
    const seasons = results.filter(r => r.status === "fulfilled").map(r => r.value);
    results.filter(r => r.status === "rejected").forEach(r => console.error("Season data error:", r.reason));

    if (seasons.length === 0) {
        tableContainer.innerHTML = "<p>Tietoja ei voitu ladata.</p>";
        return;
    }

    const active = pickActive(seasons);
    const ended = seasons.filter(s => s !== active && s.upcoming.length === 0 && s.played.length > 0);

    const next = active.upcoming[0];
    if (next) nextContainer.innerHTML = renderNextMatch(next, active);

    // A couple of latest results followed by the next fixtures after the featured one
    const recent = active.played.slice(-PROGRAM_RESULTS);
    const coming = active.upcoming.slice(1, 1 + PROGRAM_LENGTH - recent.length);
    const program = [...recent, ...coming];
    if (program.length > 0) programContainer.innerHTML = renderMatchList(program);
    programLink.href = active.page;

    tableContainer.innerHTML = active.teams.length > 0 ? renderStandings(active.teams) : "";
    tableSubtitle.textContent = [active.category, active.groupName && `lohko ${active.groupName}`].filter(Boolean).join(" · ");
    tableLink.href = active.page;

    if (heroSeason) {
        const label = active.upcoming.length > 0 ? "Nyt käynnissä" : "Viimeisin kausi";
        heroSeason.innerHTML = `${sportBadge(active)} <span>${esc(label)}: ${esc(active.category)} ${esc(seasonLabel(active))}</span>`;
        heroSeason.href = active.page;
        heroSeason.hidden = false;
    }

    if (ended.length > 0) {
        recapContainer.innerHTML = ended.map(renderRecap).join("");
        recapSection.hidden = false;
    }
}

// The season with the soonest upcoming match, or the most recently played one
function pickActive(seasons) {
    const withUpcoming = seasons.filter(s => s.upcoming.length > 0);
    if (withUpcoming.length > 0) {
        return withUpcoming.sort((a, b) => kickoff(a.upcoming[0]) - kickoff(b.upcoming[0]))[0];
    }
    const lastPlayed = s => s.played.length ? kickoff(s.played[s.played.length - 1]).getTime() : 0;
    return seasons.slice().sort((a, b) => lastPlayed(b) - lastPlayed(a))[0];
}

function renderRecap(s) {
    const own = s.own;
    const sub = [s.category, s.groupName && `lohko ${s.groupName}`].filter(Boolean).join(" · ");
    const tiles = own ? [
        { value: own.points, label: "Pistettä" },
        { value: `${own.matches_won}–${own.matches_tied}–${own.matches_lost}`, label: "V–T–H" },
        { value: `${own.goals_for}–${own.goals_against}`, label: "Maalit" },
    ] : [];

    return `
        <article class="recap">
            <div class="recap__head">
                <div class="recap__title">
                    ${sportBadge(s)}
                    <h3>${esc(s.title)} ${esc(seasonLabel(s))}</h3>
                    <p class="recap__sub">${esc(sub)}</p>
                </div>
                ${own ? `
                    <div class="recap__place">
                        <span class="recap__place-value">${esc(own.current_standing)}.</span>
                        <span class="recap__place-label">sija</span>
                    </div>
                ` : ""}
            </div>
            ${tiles.length ? `
                <div class="recap__stats">
                    ${tiles.map(t => `
                        <div class="stat-tile stat-tile--small">
                            <span class="stat-tile__value">${esc(t.value)}</span>
                            <span class="stat-tile__label">${esc(t.label)}</span>
                        </div>
                    `).join("")}
                </div>
            ` : ""}
            <div class="recap__footer">
                ${renderForm(s.played)}
                <a class="text-link" href="${esc(s.page)}">Kauden ottelut ja sarjataulukko &rarr;</a>
            </div>
        </article>
    `;
}

loadHome();
