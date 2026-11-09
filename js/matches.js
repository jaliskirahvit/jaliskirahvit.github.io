// Shared helpers for the match and standings views on the home page and the
// season pages. Both sports come from the same Taso API, so the JSON files
// share one format.

const KIRAHVIT_CLUB_ID = "6950";
const UNKNOWN_CREST = "assets/unknown_logo.png";

const SEASONS = {
    futsal: {
        key: "futsal",
        name: "Futsal",
        title: "Futsal-kausi",
        page: "futsal.html",
        matches: "assets/futsal_matches.json",
        group: "assets/futsal_group.json",
    },
    jalkapallo: {
        key: "jalkapallo",
        name: "Jalkapallo",
        title: "Jalkapallokausi",
        page: "jalkapallo.html",
        matches: "assets/matches.json",
        group: "assets/group.json",
    },
};

const WEEKDAYS = ["su", "ma", "ti", "ke", "to", "pe", "la"];

// A match still counts as upcoming for a while after kick-off, until the result is in
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function isKirahvit(clubId) {
    return String(clubId) === KIRAHVIT_CLUB_ID;
}

function kickoff(m) {
    const time = /^\d\d:\d\d/.test(m.time || "") ? m.time.slice(0, 5) : "00:00";
    return new Date(`${m.date}T${time}:00`);
}

function hasDate(m) {
    return !isNaN(kickoff(m).getTime());
}

function formatDate(m, withYear = false) {
    if (!hasDate(m)) return "Avoin";
    const d = kickoff(m);
    const year = withYear ? d.getFullYear() : "";
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.${year}`;
}

function formatTime(m) {
    return /^\d\d:\d\d/.test(m.time || "") && m.time !== "00:00:00" ? m.time.slice(0, 5) : "";
}

function isPlayed(m) {
    return m.status === "Played";
}

function isUpcoming(m, now = new Date()) {
    return !isPlayed(m) && hasDate(m) && kickoff(m).getTime() + MATCH_DURATION_MS > now.getTime();
}

// "V" (voitto), "T" (tasapeli) or "H" (häviö) from FC Jaliskirahvit's point of view
function outcome(m) {
    if (!isPlayed(m)) return null;
    const a = Number(m.fs_A);
    const b = Number(m.fs_B);
    if (isNaN(a) || isNaN(b)) return null;
    const [own, other] = isKirahvit(m.club_A_id) ? [a, b] : [b, a];
    return own > other ? "V" : own < other ? "H" : "T";
}

const OUTCOME_NAMES = { V: "Voitto", T: "Tasapeli", H: "Häviö" };

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
}

// Loads one season's matches (chronological) and standings (by position)
async function loadSeason(season) {
    const [matchesData, groupData] = await Promise.all([
        fetchJson(season.matches),
        fetchJson(season.group).catch(() => null),
    ]);

    const matches = (matchesData.matches || []).slice().sort((a, b) => {
        if (!hasDate(a)) return hasDate(b) ? 1 : 0;
        if (!hasDate(b)) return -1;
        return kickoff(a) - kickoff(b);
    });

    const group = groupData && groupData.group ? groupData.group : null;
    const teams = group && group.teams
        ? group.teams.slice().sort((a, b) => a.current_standing - b.current_standing)
        : [];

    const ref = matches[0] || {};
    return {
        ...season,
        matches,
        teams,
        own: teams.find(t => isKirahvit(t.club_id)) || null,
        category: (group && group.category_name) || ref.category_name || "",
        groupName: (group && group.group_name) || ref.group_name || "",
        groupId: group ? String(group.group_id) : "",
        seasonName: ref.competition_season || "",
        played: matches.filter(isPlayed),
        upcoming: matches.filter(m => isUpcoming(m)),
    };
}

function seasonLabel(s) {
    return s.seasonName ? s.seasonName.replace("-", "–") : "";
}

function crest(src) {
    return esc(src || UNKNOWN_CREST);
}

function sportBadge(s) {
    return `<span class="sport-badge sport-badge--${esc(s.key)}">${esc(s.name)}</span>`;
}

const PIN_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pin-icon" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

function renderNextMatch(m, season) {
    const time = formatTime(m);
    const side = (name, id, src) => `
        <div class="team">
            <img src="${crest(src)}" width="92" height="92" alt="">
            <span class="${isKirahvit(id) ? "kirahvit-team" : ""}">${esc(name)}</span>
        </div>`;
    return `
        <div class="match-card match-card--next">
            <div class="match-card__meta">
                ${sportBadge(season)}
                <span class="match-card__competition">${esc(m.category_name)}</span>
            </div>
            <div class="match-card__teams">
                ${side(m.team_A_name, m.club_A_id, m.club_A_crest)}
                <div class="match-card__center">
                    <span class="match-card__time">${time || "&ndash;"}</span>
                    <span class="match-card__day">${esc(formatDate(m))}</span>
                </div>
                ${side(m.team_B_name, m.club_B_id, m.club_B_crest)}
            </div>
            <div class="match-card__venue">
                ${PIN_ICON}
                ${esc(m.venue_name || "Pelipaikka avoin")}
            </div>
            ${time ? `<div class="match-card__countdown" data-kickoff="${kickoff(m).getTime()}" hidden>
                <span class="match-card__countdown-label">Alkuun</span>
                <span class="match-card__countdown-time"></span>
            </div>` : ""}
        </div>
    `;
}

// One row per match: played matches show the score, upcoming ones the kick-off time
function renderMatchRow(m, { showVenue = false } = {}) {
    const result = outcome(m);
    const time = formatTime(m);
    const center = isPlayed(m)
        ? `<span class="results__score results__score--${result || "x"}" title="${OUTCOME_NAMES[result] || ""}">${esc(m.fs_A)}&ndash;${esc(m.fs_B)}</span>`
        : `<span class="results__score results__score--upcoming">${time || "vs"}</span>`;

    return `
        <div class="results__row${isPlayed(m) ? "" : " results__row--upcoming"}">
            <span class="results__date">${formatDate(m)}</span>
            <span class="results__team results__team--home">
                <img class="results__crest" src="${crest(m.club_A_crest)}" alt="">
                <span class="${isKirahvit(m.club_A_id) ? "kirahvit-team" : ""}">${esc(m.team_A_name)}</span>
            </span>
            ${center}
            <span class="results__team results__team--away">
                <span class="${isKirahvit(m.club_B_id) ? "kirahvit-team" : ""}">${esc(m.team_B_name)}</span>
                <img class="results__crest" src="${crest(m.club_B_crest)}" alt="">
            </span>
            ${showVenue && m.venue_name ? `<span class="results__venue">${PIN_ICON}${esc(m.venue_name)}</span>` : ""}
        </div>
    `;
}

function renderMatchList(matches, options) {
    return `<div class="results">${matches.map(m => renderMatchRow(m, options)).join("")}</div>`;
}

function renderStandings(teams) {
    const rows = teams.map(team => `
        <div class="standings__row ${isKirahvit(team.club_id) ? "kirahvit" : ""}">
            <span class="standings__rank">${esc(team.current_standing)}</span>
            <span class="standings__team">
                <img class="standings__crest" src="${crest(team.crest)}" alt="">
                <span class="standings__name">${esc(team.team_name)}</span>
            </span>
            <span>${esc(team.matches_played)}</span>
            <span>${esc(team.matches_won)}</span>
            <span>${esc(team.matches_tied)}</span>
            <span>${esc(team.matches_lost)}</span>
            <span class="standings__goals">${esc(team.goals_for)}&ndash;${esc(team.goals_against)}</span>
            <span class="standings__points">${esc(team.points)}</span>
        </div>
    `).join("");

    return `
        <div class="standings__row standings__row--head">
            <span></span>
            <span class="left">Joukkue</span>
            <span title="Ottelut">O</span>
            <span title="Voitot">V</span>
            <span title="Tasapelit">T</span>
            <span title="Häviöt">H</span>
            <span class="standings__goals" title="Maalit">M</span>
            <span title="Pisteet">P</span>
        </div>
        ${rows}
    `;
}

// Last results as V/T/H dots, oldest first
function renderForm(played, count = 5) {
    const recent = played.slice(-count);
    if (recent.length === 0) return "";
    return `
        <div class="form" aria-label="Viimeisimmät tulokset">
            ${recent.map(m => {
                const r = outcome(m) || "x";
                return `<span class="form__dot form__dot--${r}" title="${esc(formatDate(m))} ${esc(m.team_A_name)} ${esc(m.fs_A)}–${esc(m.fs_B)} ${esc(m.team_B_name)}">${r === "x" ? "?" : r}</span>`;
            }).join("")}
        </div>
    `;
}

function renderStatTiles(s) {
    const own = s.own;
    const tiles = [];

    if (own && Number(own.matches_played) > 0) {
        tiles.push({ value: `${own.current_standing}.`, label: `Sija (${s.teams.length} joukkuetta)` });
        tiles.push({ value: own.points, label: "Pistettä" });
        tiles.push({ value: `${own.matches_won}–${own.matches_tied}–${own.matches_lost}`, label: "Voitot – tasapelit – häviöt" });
        tiles.push({ value: `${own.goals_for}–${own.goals_against}`, label: "Maalit" });
    } else {
        const next = s.upcoming[0];
        tiles.push({ value: s.matches.length, label: "Sarjaottelua" });
        tiles.push({ value: s.teams.length || "–", label: "Joukkuetta lohkossa" });
        tiles.push({ value: next ? formatDate(next).split(" ")[1] : "–", label: "Avausottelu" });
        tiles.push({ value: new Set(s.matches.map(m => m.venue_name).filter(Boolean)).size, label: "Pelipaikkaa" });
    }

    return tiles.map(t => `
        <div class="stat-tile">
            <span class="stat-tile__value">${esc(t.value)}</span>
            <span class="stat-tile__label">${esc(t.label)}</span>
        </div>
    `).join("");
}

// Some crests on the CDN are missing, so broken ones fall back to the placeholder
document.addEventListener("error", event => {
    const img = event.target;
    if (img.tagName === "IMG" && img.closest("main") && !img.src.endsWith(UNKNOWN_CREST)) {
        img.src = UNKNOWN_CREST;
    }
}, true);
