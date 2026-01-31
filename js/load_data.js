async function loadData() {
    const container = document.querySelector('.table__container');
    
    try {
        const response = await fetch('assets/data.json');
        if (!response.ok) throw new Error("Could not fetch data");

        const data = await response.json();
        const teams = data.category.teams;

        const html = teams.map(team => {
            const crestUrl = team.crest || 'assets/unknown_logo.png'

            return `
                <div class="table__team">
                    <img src="${crestUrl}" width="40" alt="${team.team_name} logo">
                    <span>${team.team_name}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    } catch (error) {
        console.error("Error loading table:", error);
        const statusMessage = document.createElement("p");
        statusMessage.textContent = "Virhe tietojen lataamisessa.";
        container.appendChild(statusMessage);
    }
}

loadData();