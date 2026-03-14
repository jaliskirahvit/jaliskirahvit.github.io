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

        let tableHtml = `
            <table class="league-table">
                <thead>
                    <tr>
                        <th></th>
                        <th class="team-name-col">Joukkue</th>
                        <th>O</th>
                        <th>V</th>
                        <th>T</th>
                        <th>H</th>
                        <th>P</th>
                    </tr>
                </thead>
                <tbody>
        `;

        tableHtml += teams.map(team => {
            const highlightClass = team.team_id == "35213369" ? 'kirahvit' : '';

            return `
                <tr class="${highlightClass}">
                    <td class="pos-cell">${team.current_standing}</td>
                    <td class="team-cell">
                        <div class="table__team">
                            <img src="${team.crest || 'assets/unknown_logo.png'}" width="40"><span>${team.team_name}</span>
                        </div>
                    </td>
                    <td>${team.matches_played}</td>
                    <td>${team.matches_won}</td>
                    <td>${team.matches_tied}</td>
                    <td>${team.matches_lost}</td>
                    <td class="points-cell">${team.points}</td>
                </tr>
            `;
        }).join('');

        tableHtml += `
                </tbody>
            </table>
        `;

        container.innerHTML = tableHtml;
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
                    <div class="match-card__venue">${nextMatch.venue_name || 'Pelipaikka avoin'}</div>
                </div>
            `;
        }

        if (previousMatches.length > 0) {
            prevMatchesContainer.innerHTML = `
                <table class="matches-table">
                    <tbody>
                        ${previousMatches.map(m => `
                            <tr>
                                <td class="match-date">${m.date.split('-').reverse().join('.')}</td>
                                
                                <td class="match-team-a">
                                    <div class="inner">
                                        <img src="${m.club_A_crest || 'assets/unknown_logo.png'}" width="30" alt="">
                                        <span>${m.team_A_name}</span>
                                    </div>
                                </td>
                                
                                <td class="match-score">
                                    <span class="score-box">${m.fs_A} – ${m.fs_B}</span>
                                </td>
                                
                                <td class="match-team-b">
                                    <div class="inner">
                                        <span>${m.team_B_name}</span>
                                        <img src="${m.club_B_crest || 'assets/unknown_logo.png'}" width="30" alt="">
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }
}

loadData();