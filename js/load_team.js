const POSITIONS = [
    { key: "maalivahti", label: "Maalivahdit", single: "Maalivahti" },
    { key: "puolustaja", label: "Puolustajat", single: "Puolustaja" },
    { key: "keskikentta", label: "Keskikenttä", single: "Keskikenttä" },
    { key: "hyokkaaja", label: "Hyökkääjät", single: "Hyökkääjä" },
    { key: "", label: "Muut", single: "" },
];

const STAT_COLUMNS = [
    { key: "matches", label: "O", title: "Ottelut" },
    { key: "goals", label: "M", title: "Maalit" },
    { key: "assists", label: "S", title: "Syötöt" },
    { key: "warnings", label: '<span class="card-icon card-icon--yellow"></span>', title: "Keltaiset kortit" },
    { key: "suspensions", label: '<span class="card-icon card-icon--red"></span>', title: "Punaiset kortit" },
];

const SPORT_NAMES = { futsal: "Futsal" };

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function fullName(p) {
    return `${p.first_name} ${p.last_name}`;
}

function positionOf(p) {
    return POSITIONS.find(pos => pos.key === p.position) || POSITIONS[POSITIONS.length - 1];
}

// Assists are not recorded in every series, so the column is hidden when it would be all zeros
function visibleColumns(rows) {
    return STAT_COLUMNS.filter(col => col.key !== "assists" || rows.some(r => r.assists > 0));
}

async function loadTeam() {
    const introStats = document.querySelector(".squad-intro__stats");
    const rosterContainer = document.querySelector(".roster__container");
    const statsContainer = document.querySelector(".stats__container");
    const dialog = document.querySelector(".career");

    let players;
    let careers = {};

    try {
        const playersRes = await fetch("assets/players.json");
        if (!playersRes.ok) throw new Error("Player data not found");
        players = (await playersRes.json()).players;
    } catch (error) {
        console.error("Team page error:", error);
        rosterContainer.innerHTML = "<p>Tietoja ei voitu ladata.</p>";
        return;
    }

    try {
        const careersRes = await fetch("assets/careers.json");
        if (careersRes.ok) careers = (await careersRes.json()).players || {};
    } catch (error) {
        console.error("Career data error:", error);
    }

    const byId = new Map(players.map(p => [p.player_id, p]));

    renderIntro();
    renderRoster();
    renderPitch();
    renderStats("goals");

    document.addEventListener("click", event => {
        const trigger = event.target.closest("[data-player]");
        if (trigger) openCareer(byId.get(trigger.dataset.player));
    });

    dialog.addEventListener("click", event => {
        // Clicking the backdrop (the dialog element itself) or the close button closes it
        if (event.target === dialog || event.target.closest(".career__close")) dialog.close();
    });

    function renderIntro() {
        const totalGoals = players.reduce((sum, p) => sum + p.goals, 0);
        // Everyone sharing the top value is listed; large ties collapse into a count
        function leaderTile(key, title) {
            const best = Math.max(0, ...players.map(p => p[key]));
            if (best === 0) return null;

            const leaders = players.filter(p => p[key] === best);
            const names = leaders.length > 3
                ? `${leaders.length} pelaajaa`
                : leaders.map(p => esc(fullName(p))).join("<br>");

            return { value: best, label: `${title}<br><strong>${names}</strong>` };
        }

        const tiles = [
            { value: players.length, label: "Pelaajaa" },
            { value: totalGoals, label: "Maalia" },
            leaderTile("goals", "Maalikuningas"),
            leaderTile("matches", "Eniten otteluita"),
        ].filter(Boolean);

        introStats.innerHTML = tiles.map(t => `
            <div class="stat-tile">
                <span class="stat-tile__value">${t.value}</span>
                <span class="stat-tile__label">${t.label}</span>
            </div>
        `).join("");
    }

    // Tactical board: the squad placed by position on a tilted pitch, attacking to the right
    function renderPitch() {
        const container = document.querySelector(".pitch__container");
        if (!container) return;

        const COLUMNS = [
            { key: "maalivahti", x: 9 },
            { key: "puolustaja", x: 31 },
            { key: "keskikentta", x: 55 },
            { key: "hyokkaaja", x: 80 },
        ];
        let n = 0;
        const dots = COLUMNS.map(col => {
            const group = players
                .filter(p => p.position === col.key)
                .sort((a, b) => Number(a.shirt_number) - Number(b.shirt_number));
            return group.map((p, i) => {
                // long lines zigzag so the markers do not overlap
                const x = col.x + (group.length > 5 ? (i % 2 ? 2.6 : -2.6) : 0);
                const y = 9 + ((i + 0.5) / group.length) * 82;
                const size = 34 + Math.min(Number(p.matches) || 0, 17) * 1.1;
                return `
                    <button type="button" class="pitch__player" data-player="${esc(p.player_id)}"
                        style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--s:${size.toFixed(0)};--i:${n++}">
                        <span class="pitch__num">${esc(p.shirt_number)}</span>
                        ${p.goals > 0 ? `<span class="pitch__goals" title="Maalit">${p.goals}</span>` : ""}
                        <span class="pitch__name">${esc(p.last_name)}</span>
                    </button>`;
            }).join("");
        }).join("");

        const bench = players.filter(p => !COLUMNS.some(c => c.key === p.position))
            .sort((a, b) => Number(a.shirt_number) - Number(b.shirt_number));
        const counts = POSITIONS.filter(pos => pos.key).map(pos => `${players.filter(p => positionOf(p) === pos).length} ${pos.label.toLowerCase()}`).join(" · ");

        const lines = `
            <svg class="pitch__lines" viewBox="0 0 150 100" preserveAspectRatio="none" aria-hidden="true">
                <rect x="2" y="2" width="146" height="96"/>
                <line x1="75" y1="2" x2="75" y2="98"/>
                <circle cx="75" cy="50" r="13.5"/><circle cx="75" cy="50" r="0.8"/>
                <rect x="2" y="20.3" width="24.3" height="59.4"/><rect x="2" y="36.5" width="8.1" height="27"/>
                <rect x="123.7" y="20.3" width="24.3" height="59.4"/><rect x="139.9" y="36.5" width="8.1" height="27"/>
                <path d="M26.3 39.2 A13.5 13.5 0 0 1 26.3 60.8"/><path d="M123.7 39.2 A13.5 13.5 0 0 0 123.7 60.8"/>
                <circle cx="18.2" cy="50" r="0.8"/><circle cx="131.8" cy="50" r="0.8"/>
            </svg>`;

        container.innerHTML = `
            <div class="pitch__layout">
                <div class="pitch__stage"><div class="pitch__field">${lines}${dots}</div></div>
                <aside class="pitch__info" aria-live="polite"></aside>
            </div>
            ${bench.length ? `
                <div class="pitch__bench">
                    <span class="pitch__bench-label">Muut</span>
                    ${bench.map(p => `<button type="button" class="pitch__chip" data-player="${esc(p.player_id)}"><b>${esc(p.shirt_number)}</b> ${esc(fullName(p))}</button>`).join("")}
                </div>` : ""}
        `;

        const info = container.querySelector(".pitch__info");
        const showDefault = () => {
            info.innerHTML = `
                <span class="pitch__info-eyebrow">Kokoonpano</span>
                <h3 class="pitch__info-title">${players.length} pelaajaa</h3>
                <p class="pitch__info-sub">${esc(counts)}</p>
                <p class="pitch__info-hint">Merkin koko kertoo pelatut ottelut, pallo maalit. Vie hiiri pelaajan päälle tai valitse hänet nähdäksesi uran.</p>`;
        };
        const show = p => {
            const pos = positionOf(p);
            info.innerHTML = `
                <span class="pitch__info-eyebrow">#${esc(p.shirt_number)}${pos.single ? " · " + esc(pos.single) : ""}${p.captain && p.captain !== "0" ? " · Kapteeni" : ""}</span>
                <h3 class="pitch__info-title">${esc(fullName(p))}</h3>
                <dl class="pitch__info-stats">
                    <div><dt>Ottelut</dt><dd>${p.matches}</dd></div>
                    <div><dt>Maalit</dt><dd>${p.goals}</dd></div>
                    <div><dt>Syötöt</dt><dd>${p.assists}</dd></div>
                    <div><dt>Keltaiset</dt><dd>${p.warnings}</dd></div>
                </dl>
                <p class="pitch__info-hint">Klikkaa nähdäksesi aiemmat kaudet &rarr;</p>`;
        };
        const playerOf = e => {
            const el = e.target.closest("[data-player]");
            return el && container.contains(el) ? byId.get(el.dataset.player) : null;
        };
        container.addEventListener("mouseover", e => { const p = playerOf(e); if (p) show(p); });
        container.addEventListener("focusin", e => { const p = playerOf(e); if (p) show(p); });
        container.addEventListener("mouseleave", showDefault);
        container.addEventListener("focusout", e => { if (!container.contains(e.relatedTarget)) showDefault(); });
        showDefault();
    }

    function renderRoster() {
        rosterContainer.innerHTML = POSITIONS.map(pos => {
            const group = players
                .filter(p => positionOf(p) === pos)
                .sort((a, b) => Number(a.shirt_number) - Number(b.shirt_number));
            if (group.length === 0) return "";

            return `
                <div class="roster__group">
                    <h3 class="roster__group-title">${pos.label}</h3>
                    <div class="roster__grid">
                        ${group.map(p => `
                            <button type="button" class="player-card" data-player="${esc(p.player_id)}">
                                <span class="player-card__number">${esc(p.shirt_number)}</span>
                                <span class="player-card__info">
                                    <span class="player-card__first">${esc(p.first_name)}</span>
                                    <span class="player-card__last">${esc(p.last_name)}${p.captain && p.captain !== "0" ? ' <span class="captain-badge" title="Kapteeni">C</span>' : ""}</span>
                                    <span class="player-card__meta">${p.matches} O &middot; ${p.goals} M</span>
                                </span>
                            </button>
                        `).join("")}
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderStats(sortKey) {
        const columns = visibleColumns(players);
        const sorted = [...players].sort((a, b) =>
            b[sortKey] - a[sortKey] || b.goals - a.goals || b.matches - a.matches || a.last_name.localeCompare(b.last_name, "fi")
        );
        const leaders = Object.fromEntries(columns.map(col => [col.key, Math.max(...players.map(p => p[col.key]))]));
        const template = `grid-template-columns: 36px minmax(140px, 1fr) repeat(${columns.length}, 52px); --stat-cols: ${columns.length};`;

        statsContainer.innerHTML = `
            <div class="stats__row stats__row--head" style="${template}">
                <span>#</span>
                <span class="left">Pelaaja</span>
                ${columns.map(col => `
                    <button type="button" class="stats__sort ${col.key === sortKey ? "is-active" : ""}" data-sort="${col.key}" title="Järjestä: ${col.title}" aria-label="${col.title}">${col.label}</button>
                `).join("")}
            </div>
            ${sorted.map(p => `
                <div class="stats__row" style="${template}" data-player="${esc(p.player_id)}" tabindex="0" role="button">
                    <span class="stats__number">${esc(p.shirt_number)}</span>
                    <span class="stats__name">${esc(fullName(p))}</span>
                    ${columns.map(col => `
                        <span class="${col.key === sortKey ? "stats__cell--active" : ""} ${p[col.key] > 0 && p[col.key] === leaders[col.key] ? "stats__cell--leader" : ""}">${p[col.key]}</span>
                    `).join("")}
                </div>
            `).join("")}
        `;

        statsContainer.querySelectorAll(".stats__sort").forEach(btn => {
            btn.addEventListener("click", () => renderStats(btn.dataset.sort));
        });
        statsContainer.querySelectorAll(".stats__row[data-player]").forEach(row => {
            row.addEventListener("keydown", event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCareer(byId.get(row.dataset.player));
                }
            });
        });
    }

    function openCareer(player) {
        if (!player) return;

        const seasons = careers[player.player_id];
        const position = positionOf(player).single;

        let history;
        if (!seasons) {
            history = '<p class="career__empty">Aiempien kausien tiedot päivittyvät pian.</p>';
        } else if (seasons.length === 0) {
            history = '<p class="career__empty">Ei pelattuja otteluita.</p>';
        } else {
            const columns = visibleColumns(seasons);
            const totals = Object.fromEntries(columns.map(col => [col.key, seasons.reduce((sum, s) => sum + s[col.key], 0)]));
            const template = `grid-template-columns: 64px minmax(120px, 1fr) repeat(${columns.length}, 40px); --stat-cols: ${columns.length};`;

            history = `
                <div class="career__seasons">
                    <div class="career__row career__row--head" style="${template}">
                        <span class="left">Kausi</span>
                        <span class="left">Sarja</span>
                        ${columns.map(col => `<span title="${col.title}">${col.label}</span>`).join("")}
                    </div>
                    ${seasons.map(s => `
                        <div class="career__row" style="${template}">
                            <span class="career__season">${esc(s.season)}</span>
                            <span class="career__series">
                                <img class="career__crest" src="${esc(s.crest || "assets/unknown_logo.png")}" alt="">
                                <span class="career__series-text">
                                    <span class="career__team">${esc(s.team_name)}</span>
                                    <span class="career__competition">${esc(s.category_name)}${SPORT_NAMES[s.sport] ? ` <span class="sport-badge">${SPORT_NAMES[s.sport]}</span>` : ""}</span>
                                </span>
                            </span>
                            ${columns.map(col => `<span>${s[col.key]}</span>`).join("")}
                        </div>
                    `).join("")}
                    <div class="career__row career__row--total" style="${template}">
                        <span class="left">Yht.</span>
                        <span class="left">${seasons.length} ${seasons.length === 1 ? "sarja" : "sarjaa"}</span>
                        ${columns.map(col => `<span>${totals[col.key]}</span>`).join("")}
                    </div>
                </div>
            `;
        }

        dialog.querySelector(".career__inner").innerHTML = `
            <div class="career__header">
                <span class="player-card__number player-card__number--large">${esc(player.shirt_number)}</span>
                <div class="career__title">
                    ${position ? `<span class="hero__eyebrow">${position}</span>` : ""}
                    <h2>${esc(fullName(player))}</h2>
                </div>
                <button type="button" class="career__close" aria-label="Sulje">&times;</button>
            </div>
            <div class="career__current">
                <div class="stat-tile stat-tile--small"><span class="stat-tile__value">${player.matches}</span><span class="stat-tile__label">Ottelua 2026</span></div>
                <div class="stat-tile stat-tile--small"><span class="stat-tile__value">${player.goals}</span><span class="stat-tile__label">Maalia 2026</span></div>
                <div class="stat-tile stat-tile--small"><span class="stat-tile__value">${player.warnings + player.suspensions}</span><span class="stat-tile__label">Korttia 2026</span></div>
            </div>
            <h3 class="career__subtitle">Pelaajaura</h3>
            ${history}
        `;

        dialog.showModal();
    }
}

loadTeam();
