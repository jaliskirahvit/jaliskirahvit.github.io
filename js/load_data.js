const KIRAHVIT_TEAM_ID = "35213369";

async function loadData() {
    const tableContainer = document.querySelector('.table__container');
    const nextMatchContainer = document.querySelector('.matches__next-match-container');
    const prevMatchesContainer = document.querySelector('.matches__previous-matches-container');
    
    try {
        const [groupRes, matchesRes] = await Promise.all([
            fetch('assets/group.json'),
            fetch('assets/matches.json')
        ]);

        if (!groupRes.ok || !matchesRes.ok) throw new Error("Data files not found");
        
        const groupData = await groupRes.json();
        const matchesData = await matchesRes.json();

        renderTeams(groupData, tableContainer);
        renderMatches(matchesData);
    
    } catch (error) {
        console.error("Dashboard error:", error);
        if (tableContainer) {
            tableContainer.innerHTML = "<p>Tietoja ei voitu ladata.</p>";
        }
    }

    function renderTeams(data, container) {
        if (!container || !data.group || !data.group.teams ) {
            console.error("Invalid group data structure");
            return;
        }

        const teams = data.group.teams;

        teams.sort((a, b) => a.current_standing - b.current_standing);

        const rows = teams.map(team => {
            const highlightClass = team.team_id == KIRAHVIT_TEAM_ID ? 'kirahvit' : '';

            return `
                <div class="standings__row ${highlightClass}">
                    <span class="standings__rank">${team.current_standing}</span>
                    <span class="standings__team">
                        <img class="standings__crest" src="${team.crest || 'assets/unknown_logo.png'}" alt="">
                        <span class="standings__name">${team.team_name}</span>
                    </span>
                    <span>${team.matches_played}</span>
                    <span>${team.matches_won}</span>
                    <span>${team.matches_tied}</span>
                    <span>${team.matches_lost}</span>
                    <span class="standings__points">${team.points}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="standings__row standings__row--head">
                <span></span>
                <span class="left">Joukkue</span>
                <span>O</span>
                <span>V</span>
                <span>T</span>
                <span>H</span>
                <span>P</span>
            </div>
            ${rows}
        `;
    }

    function renderMatches(data) {
        if (!data || !data.matches) return;

        const matches = data.matches;

        const sortedMatches = matches.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);

            const isADateInvalid = isNaN(dateA.getTime());
            const isBDateInvalid = isNaN(dateB.getTime());

            if (isADateInvalid && isBDateInvalid) {
                return 0;
            }

            if (isADateInvalid) {
                return 1;
            }

            if (isBDateInvalid) {
                return -1;
            }

            return dateA.getTime() - dateB.getTime();
        });

        const now = new Date();

        const nextMatch = sortedMatches.find(m => {
            const matchDate = new Date(m.date);
            return !isNaN(matchDate.getTime()) && matchDate.getTime() >= now.getTime();
        });

        const previousMatches = sortedMatches
            .filter(m => m.status === 'Played')
            .reverse()
            .slice(0, 5);

        if (nextMatch) {
            nextMatchContainer.innerHTML = `
                <div class="match-card match-card--next">
                    <div class="match-card__date">
                        ${nextMatch.date.split('-').reverse().join('.')}, klo ${nextMatch.time.slice(0, 5)}
                    </div>
                    <div class="match-card__teams">
                        <span class="team"><img src="${nextMatch.club_A_crest || 'assets/unknown_logo.png'}" width="60"><span>${nextMatch.team_A_name}</span></span>
                        <span class="vs">vs</span>
                        <span class="team"><span>${nextMatch.team_B_name}</span><img src="${nextMatch.club_B_crest || 'assets/unknown_logo.png'}" width="60"></span>
                    </div>
                    <div class="match-card__venue">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pin-icon"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${nextMatch.venue_name || 'Pelipaikka avoin'}
                    </div>
                </div>
            `;
        }

        if (previousMatches.length > 0) {
            prevMatchesContainer.innerHTML = `
                <div class="results">
                    ${previousMatches.map(m => {
                        const teamAClass = m.team_A_id == KIRAHVIT_TEAM_ID ? 'kirahvit-team' : '';
                        const teamBClass = m.team_B_id == KIRAHVIT_TEAM_ID ? 'kirahvit-team' : '';

                        return `
                        <div class="results__row">
                            <span class="results__date">${m.date.split('-').reverse().join('.')}</span>

                            <span class="results__team results__team--home">
                                <img class="results__crest" src="${m.club_A_crest || 'assets/unknown_logo.png'}" alt="">
                                <span class="${teamAClass}">${m.team_A_name}</span>
                            </span>

                            <span class="results__score">${m.fs_A} &ndash; ${m.fs_B}</span>

                            <span class="results__team results__team--away">
                                <span class="${teamBClass}">${m.team_B_name}</span>
                                <img class="results__crest" src="${m.club_B_crest || 'assets/unknown_logo.png'}" alt="">
                            </span>
                        </div>
                    `;
                    }).join('')}
                </div>
            `;
        }
    }
}

loadData();