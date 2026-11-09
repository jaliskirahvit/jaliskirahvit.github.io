// Season progress chart: cumulative points as a glowing line (dots coloured by
// result) with goal difference per match as bars underneath. Plain SVG.

function renderProgress(section, season) {
    if (!section) return;
    // Only the league group the standings are for, so the totals match the table
    const played = season.played.filter(m => outcome(m) && (!season.groupId || String(m.group_id) === season.groupId));
    if (played.length < 2) return;

    const PTS = { V: 3, T: 1, H: 0 };
    const W = 1000, L = 44, R = 18, TOP = 18, LINE_BOTTOM = 232, BASE = 300, BAR_MAX = 46, H = 372;
    const innerW = W - L - R;
    const n = played.length;
    const xAt = i => L + (i + 0.5) * (innerW / n);

    let total = 0;
    const rows = played.map((m, i) => {
        const res = outcome(m);
        total += PTS[res];
        const own = isKirahvit(m.club_A_id) ? Number(m.fs_A) : Number(m.fs_B);
        const other = isKirahvit(m.club_A_id) ? Number(m.fs_B) : Number(m.fs_A);
        return { m, i, res, total, gd: own - other, own, other };
    });

    const maxPts = Math.max(3, total);
    const yPts = v => LINE_BOTTOM - (v / maxPts) * (LINE_BOTTOM - TOP);
    const maxGd = Math.max(3, ...rows.map(r => Math.abs(r.gd)));

    const pts = rows.map(r => [xAt(r.i), yPts(r.total)]);
    const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const area = `${path} L${pts[n - 1][0].toFixed(1)} ${LINE_BOTTOM} L${pts[0][0].toFixed(1)} ${LINE_BOTTOM} Z`;
    const len = Math.ceil(pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : s), 0)) + 8;

    const grid = [0, 0.5, 1].map(f => {
        const v = Math.round(maxPts * f);
        const y = yPts(v);
        return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text class="chart__tick" x="${L - 10}" y="${y + 4}" text-anchor="end">${v}</text>`;
    }).join("");

    const step = Math.ceil(n / 8);
    const cols = rows.map(r => {
        const x = xAt(r.i);
        const h = Math.max(2, (Math.abs(r.gd) / maxGd) * BAR_MAX);
        const up = r.gd >= 0;
        const d = kickoff(r.m);
        const label = `${d.getDate()}.${d.getMonth() + 1}.`;
        const tip = `${label} ${r.m.team_A_name} ${r.m.fs_A}–${r.m.fs_B} ${r.m.team_B_name} · ${OUTCOME_NAMES[r.res]} · ${r.total} p`;
        const tick = (r.i % step === 0 || r.i === n - 1)
            ? `<text class="chart__tick" x="${x}" y="${H - 6}" text-anchor="middle">${label}</text>` : "";
        return `
            <g class="chart__col" style="--i:${r.i}">
                <title>${esc(tip)}</title>
                <rect class="chart__hit" x="${x - innerW / n / 2}" y="${TOP - 8}" width="${innerW / n}" height="${H - TOP - 12}"/>
                <rect class="chart__bar chart__bar--${up ? "up" : "down"}" x="${x - 8}" y="${up ? BASE - h : BASE}" width="16" height="${h}" rx="2" style="--i:${r.i}"/>
                <circle class="chart__dot chart__dot--${r.res}" cx="${x}" cy="${yPts(r.total)}" r="6" style="--i:${r.i}"/>
                ${tick}
            </g>`;
    }).join("");

    section.querySelector(".progress__panel").innerHTML = `
        <div class="progress__legend">
            <span><i></i>Pisteet yhteensä</span>
            <span class="is-gd is-gd-up"><i></i>Maaliero +</span>
            <span class="is-gd"><i></i>Maaliero &minus;</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kauden pisteet ja maaliero otteluittain">
            <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#f0a73a" stop-opacity="0.35"/>
                    <stop offset="1" stop-color="#f0a73a" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <g class="chart__grid">${grid}</g>
            <line class="chart__zero" x1="${L}" x2="${W - R}" y1="${BASE}" y2="${BASE}"/>
            <path class="chart__area" d="${area}"/>
            <path class="chart__line" d="${path}" style="--len:${len}"/>
            ${cols}
        </svg>`;
    section.hidden = false;
    if (!("IntersectionObserver" in window)) section.classList.add("is-in");
}
