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
    renderTicker(seasons);
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

    renderStatBand(seasons);

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

// Latest season with games played: the record as big numbers under the hero
function renderStatBand(seasons) {
    const band = document.querySelector(".statband");
    if (!band) return;
    const lastPlayed = s => kickoff(s.played[s.played.length - 1]).getTime();
    const s = seasons
        .filter(t => t.own && Number(t.own.matches_played) > 0 && t.played.length > 0)
        .sort((a, b) => lastPlayed(b) - lastPlayed(a))[0];
    if (!s) return;

    const own = s.own;
    const tiles = [
        { value: `${own.current_standing}.`, label: "Sija sarjassa" },
        { value: own.points, label: "Pistettä" },
        { value: `${own.matches_won}–${own.matches_tied}–${own.matches_lost}`, label: "V – T – H" },
        { value: `${own.goals_for}–${own.goals_against}`, label: "Maalit" },
    ];
    const live = s.upcoming.length > 0;
    band.querySelector(".statband__eyebrow").textContent = `${live ? "Kausi käynnissä" : "Viimeisin kausi"} · ${s.name} ${seasonLabel(s)}`;
    band.querySelector("h2").textContent = s.category;
    const link = band.querySelector(".statband__link");
    link.href = s.page;
    link.innerHTML = "Ottelut ja sarjataulukko &rarr;";
    band.querySelector(".statband__grid").innerHTML = tiles.map(t => `
        <div class="statband__stat">
            <span class="statband__value">${esc(t.value)}</span>
            <span class="statband__label">${esc(t.label)}</span>
        </div>
    `).join("");
    band.hidden = false;
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

// Scrolling strip above the header: latest results, then the next fixtures
function renderTicker(seasons) {
    const ticker = document.querySelector(".ticker");
    if (!ticker) return;
    const byTime = (a, b) => kickoff(a) - kickoff(b);
    const results = seasons.flatMap(s => s.played).sort(byTime).slice(-4);
    const fixtures = seasons.flatMap(s => s.upcoming).sort(byTime).slice(0, 5);
    if (results.length + fixtures.length === 0) return;

    const team = (name, id) => `<span class="${isKirahvit(id) ? "ticker__own" : ""}">${esc(name)}</span>`;
    const item = (m, played) => {
        const r = outcome(m);
        const middle = played
            ? `<span class="ticker__score ticker__score--${r || "x"}">${esc(m.fs_A)}&ndash;${esc(m.fs_B)}</span>`
            : `<span>vs</span>`;
        const when = played ? formatDate(m) : `${formatDate(m)} ${formatTime(m)}`.trim();
        return `<span class="ticker__item"><span class="ticker__when">${esc(when)}</span>${team(m.team_A_name, m.club_A_id)}${middle}${team(m.team_B_name, m.club_B_id)}</span>`;
    };
    const half = results.map(m => item(m, true)).concat(fixtures.map(m => item(m, false))).join("");
    // The list is repeated so the loop has no gap; the copy is hidden from screen readers
    ticker.querySelector(".ticker__track").innerHTML = `<span class="ticker__half">${half}</span><span class="ticker__half" aria-hidden="true">${half}</span>`;
    ticker.hidden = false;
}

// Counts down to the featured match; the strip hides itself once play has started
function startCountdown() {
    const el = document.querySelector(".match-card__countdown");
    if (!el) return;
    const kickoffAt = Number(el.dataset.kickoff);
    const out = el.querySelector(".match-card__countdown-time");
    const cd = (n, unit) => `<span class="cd"><b>${n}</b><i>${unit}</i></span>`;

    function tick() {
        const left = kickoffAt - Date.now();
        if (left <= 0) {
            el.hidden = true;
            return;
        }
        const mins = Math.floor(left / 60000);
        const d = Math.floor(mins / 1440);
        const h = Math.floor((mins % 1440) / 60);
        out.innerHTML = cd(d, "pv") + cd(h, "t") + cd(mins % 60, "min");
        el.hidden = false;
    }
    tick();
    setInterval(tick, 30000);
}

loadHome().then(startCountdown);
