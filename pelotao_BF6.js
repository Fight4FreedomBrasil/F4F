// Arquivo: pelotao_BF6.js

document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'https://script.google.com/macros/s/AKfycbzLXYwQzjMvHTg1CsxvNP0xhrSnSJj7-c7nSY-iVi9ffzKZyeStpEqixHNuvNKwWYXT/exec'; 
    
    const container = document.getElementById('platoon-container');

    async function fetchPlatoonData() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
            
            const members = await response.json();
            
            console.log("Dados recebidos da API (primeiro membro):", members[0]);

            if (!Array.isArray(members)) {
                 throw new Error("A resposta da API não retornou uma lista de membros válida.");
            }
            
            renderPlatoon(members);

        } catch (error) {
            console.error("Erro ao buscar dados do pelotão:", error);
            container.innerHTML = `<p class="loading-text" style="color:red;">Não foi possível carregar os dados do pelotão. Verifique o console (F12) para detalhes.</p>`;
        }
    }

    function renderPlatoon(members) {
        container.innerHTML = '';
        
        // --- ALTERAÇÃO APLICADA AQUI ---
        // 1. Definimos a ordem hierárquica correta das patentes.
        const rankOrder = [
            'Marechal',
            'General',
            'Coronel',
            'Tenente',
            'Major',
            'Capitão',
            'Cabo',
            'Soldado',
            'Sem Patente' // Garante que jogadores sem patente apareçam por último
        ];
        
        const membersByRank = groupBy(members, 'Ranking');
        
        // 2. O script agora itera sobre a nossa lista ordenada, e não uma lista aleatória.
        rankOrder.forEach(rankName => {
            // Apenas cria a seção se existirem membros com aquela patente
            if (membersByRank[rankName]) {
                const rankSection = document.createElement('div');
                rankSection.className = 'rank-section';
                rankSection.innerHTML = `<h2 class="rank-title">${rankName}</h2>`;
                
                const membersGrid = document.createElement('div');
                membersGrid.className = 'members-grid';
                
                const sortedMembers = membersByRank[rankName].sort((a, b) => (a.Nome || "").localeCompare(b.Nome || ""));

                sortedMembers.forEach(member => {
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
        const iconClass = (member.Plataforma && consoleIcons[member.Plataforma.toUpperCase()]) || 'fa-gamepad';
        
        card.innerHTML = `
            <div class="member-details">
                <h3>${member['Nome'] || 'N/A'}</h3>
                <p><span>${member['ID'] || 'N/A'}</span><i class="fab ${iconClass} console-icon"></i></p>
            </div>
            <div class="member-stats">
                <div class="stats-grid">
                    <div class="stat-card"><span class="stat-label">K/D</span><span class="stat-value">${member['K/D'] || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">Kills</span><span class="stat-value">${member['Kills'] || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">Assists</span><span class="stat-value">${member['Assists'] || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">Revives</span><span class="stat-value">${member['Revives'] || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">Partidas</span><span class="stat-value">${member['Partidas'] || 'N/A'}</span></div>
                    <div class="stat-card"><span class="stat-label">XP</span><span class="stat-value">${member['XP'] || 'N/A'}</span></div>
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