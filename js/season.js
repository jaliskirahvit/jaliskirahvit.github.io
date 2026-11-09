// Season page (futsal.html, jalkapallo.html): the body's data-season picks the season

async function loadSeasonPage() {
    const season = SEASONS[document.body.dataset.season];
    const eyebrow = document.querySelector(".squad-intro .hero__eyebrow");
    const stats = document.querySelector(".squad-intro__stats");
    const fixtures = document.querySelector(".fixtures__container");
    const table = document.querySelector(".table__container");
    const tableSubtitle = document.querySelector(".table .section-subtitle");

    let s;
    try {
        s = await loadSeason(season);
    } catch (error) {
        console.error("Season data error:", error);
        fixtures.innerHTML = "<p>Tietoja ei voitu ladata.</p>";
        return;
    }

    eyebrow.textContent = [seasonLabel(s) && `Kausi ${seasonLabel(s)}`, s.category].filter(Boolean).join(" · ");
    stats.innerHTML = renderStatTiles(s);
    renderProgress(document.querySelector(".progress"), s);

    if (s.matches.length > 0) {
        fixtures.innerHTML = renderMatchList(s.matches, { showVenue: true });
        // Jump to the next fixture when the season is under way
        const firstUpcoming = fixtures.querySelector(".results__row--upcoming");
        if (firstUpcoming && s.played.length > 0) firstUpcoming.classList.add("results__row--next");
    }

    table.innerHTML = s.teams.length > 0 ? renderStandings(s.teams) : "";
    tableSubtitle.textContent = [s.category, s.groupName && `lohko ${s.groupName}`].filter(Boolean).join(" · ");
}

loadSeasonPage();
