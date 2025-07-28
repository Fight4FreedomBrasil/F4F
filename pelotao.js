// Arquivo: pelotao.js

document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'https://script.google.com/macros/s/AKfycbx2-agLV56Gvtav_BWBx7AyFZAuduDNmEBrJHWvjG1MfoWxVzV_l3ThPYoBFhzWB2Ab/exec?page=pelotao'; 
    
    // O resto do código não precisa mudar
    const container = document.getElementById('platoon-container');

    async function fetchPlatoonData() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
            
            const responseText = await response.text();
            
            // Linha de depuração para vermos a resposta crua
            console.log("RESPOSTA CRUA DA API:", responseText);

            const jsonData = JSON.parse(responseText.replace(/^callback\(|\)$/g, ''));

            // Linha de depuração para vermos o JSON final
            console.log("JSON FINAL APÓS ANÁLISE:", jsonData);

            if (!jsonData.success || !Array.isArray(jsonData.members) || typeof jsonData.patentes !== 'object') {
                throw new Error("A resposta da API está incompleta ou em um formato inesperado.");
            }
            
            renderPlatoon(jsonData.members, jsonData.patentes);

        } catch (error) {
            console.error("Erro ao buscar dados do pelotão:", error);
            container.innerHTML = `<p class="loading-text" style="color:red;">Não foi possível carregar os dados do pelotão.</p>`;
        }
    }

    function renderPlatoon(members, patentes) {
        container.innerHTML = '';
        const membersByRank = groupBy(members, 'Ranking');
        const rankOrder = patentes ? Object.keys(patentes) : [];
        
        rankOrder.forEach(rankName => {
            if (membersByRank[rankName]) {
                const rankSection = document.createElement('div');
                rankSection.className = 'rank-section';
                const rankImageURL = patentes[rankName] || '';
                rankSection.innerHTML = `<h2 class="rank-title"><img src="${rankImageURL}" alt="${rankName}" class="rank-icon">${rankName}</h2>`;
                const membersGrid = document.createElement('div');
                membersGrid.className = 'members-grid';
                membersByRank[rankName].forEach(member => {
                    membersGrid.appendChild(createMemberCard(member));
                });
                rankSection.appendChild(membersGrid);
                container.appendChild(rankSection);
            }
        });
    }

    function createMemberCard(member) {
        const card = document.createElement('div');
        card.className = 'member-card';
        const consoleIcons = { 'PS5': 'fa-playstation', 'PS4': 'fa-playstation', 'XBOX': 'fa-xbox', 'PC': 'fa-windows' };
        const iconClass = (member.Console && consoleIcons[member.Console.toUpperCase()]) || 'fa-gamepad';
        card.innerHTML = `
            <div class="member-details">
                <h3>${member.Nome || 'N/A'}</h3>
                <p><span>${member.ID || 'N/A'}</span><i class="fab ${iconClass} console-icon"></i></p>
            </div>
            <div class="member-stats">
                <div class="stats-grid">
                    <div class="stat-card"><span class="stat-label">K/D</span><span class="stat-value">${member.KD || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">SPM</span><span class="stat-value">${member.SPM || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">KPM</span><span class="stat-value">${member.KPM || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">Kills</span><span class="stat-value">${member.Kills || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">Score</span><span class="stat-value">${member.Score || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">Tempo</span><span class="stat-value">${member.Time || 'N/A'}</span></div>
                </div>
            </div>`;
        return card;
    }

    function groupBy(array, key) {
        if (!Array.isArray(array)) return {};
        return array.reduce((result, currentValue) => {
            const groupKey = currentValue[key] || 'Sem Patente';
            (result[groupKey] = result[groupKey] || []).push(currentValue);
            return result;
        }, {});
    }

    fetchPlatoonData();
});