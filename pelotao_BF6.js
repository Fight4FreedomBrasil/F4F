// Arquivo: pelotao_BF6.js

document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'https://script.google.com/macros/s/AKfycbzLXYwQzjMvHTg1CsxvNP0xhrSnSJj7-c7nSY-iVi9ffzKZyeStpEqixHNuvNKwWYXT/exec'; 
    
    const container = document.getElementById('platoon-container');

    async function fetchPlatoonData() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
            
            const members = await response.json();
            
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
        
        // --- LÓGICA DE DESTAQUE (INÍCIO) ---
        // 1. Encontra os maiores valores para cada estatística antes de renderizar
        const topStats = findTopStats(members);
        // --- LÓGICA DE DESTAQUE (FIM) ---

        const rankOrder = [
            'Marechal', 'General', 'Coronel', 'Tenente', 'Major',
            'Capitão', 'Cabo', 'Soldado', 'Sem Patente'
        ];
        
        const membersByRank = groupBy(members, 'Ranking');
        
        rankOrder.forEach(rankName => {
            if (membersByRank[rankName]) {
                const rankSection = document.createElement('div');
                rankSection.className = 'rank-section';
                rankSection.innerHTML = `<h2 class="rank-title">${rankName}</h2>`;
                
                const membersGrid = document.createElement('div');
                membersGrid.className = 'members-grid';
                
                const sortedMembers = membersByRank[rankName].sort((a, b) => (a.Nome || "").localeCompare(b.Nome || ""));

                sortedMembers.forEach(member => {
                    // 2. Passa os maiores valores para a função que cria o card
                    membersGrid.appendChild(createMemberCard(member, topStats));
                });

                rankSection.appendChild(membersGrid);
                container.appendChild(rankSection);
            }
        });
    }

    // Função que encontra os maiores valores de cada estatística
    function findTopStats(members) {
        const top = { 'K/D': 0, 'Kills': 0, 'Assists': 0, 'Revives': 0, 'Partidas': 0, 'XP': 0 };
        const statKeys = Object.keys(top);

        members.forEach(member => {
            statKeys.forEach(key => {
                try {
                    // Converte o valor para número da forma correta
                    const value = parseFloat(String(member[key] || '0').replace(/,/g, ''));
                    if (value > top[key]) {
                        top[key] = value;
                    }
                } catch(e) { /* Ignora erros de conversão */ }
            });
        });
        console.log("Maiores estatísticas encontradas:", top); // Para depuração
        return top;
    }

    // A função de criar o card agora recebe os 'topStats'
    function createMemberCard(member, topStats) {
        const card = document.createElement('div');
        card.className = 'member-card';

        const consoleIcons = { 'PS5': 'fa-playstation', 'PS4': 'fa-playstation', 'XBOX': 'fa-xbox', 'PC': 'fa-windows' };
        const iconClass = (member.Plataforma && consoleIcons[member.Plataforma.toUpperCase()]) || 'fa-gamepad';
        
        // 3. Verifica se a estatística do membro é a maior e adiciona a classe 'highlight' se for
        const isTopKD = parseFloat(String(member['K/D'] || 0).replace(/,/g, '')) === topStats['K/D'];
        const isTopKills = parseFloat(String(member['Kills'] || 0).replace(/,/g, '')) === topStats['Kills'];
        const isTopAssists = parseFloat(String(member['Assists'] || 0).replace(/,/g, '')) === topStats['Assists'];
        const isTopRevives = parseFloat(String(member['Revives'] || 0).replace(/,/g, '')) === topStats['Revives'];
        const isTopPartidas = parseFloat(String(member['Partidas'] || 0).replace(/,/g, '')) === topStats['Partidas'];
        const isTopXP = parseFloat(String(member['XP'] || 0).replace(/,/g, '')) === topStats['XP'];

        card.innerHTML = `
            <div class="member-details">
                <h3>${member['Nome'] || 'N/A'}</h3>
                <p><span>${member['ID'] || 'N/A'}</span><i class="fab ${iconClass} console-icon"></i></p>
            </div>
            <div class="member-stats">
                <div class="stats-grid">
                    <div class="stat-card ${isTopKD ? 'highlight' : ''}"><span class="stat-label">K/D</span><span class="stat-value">${member['K/D'] || 'N/A'}</span></div>
                    <div class="stat-card ${isTopKills ? 'highlight' : ''}"><span class="stat-label">Kills</span><span class="stat-value">${member['Kills'] || 'N/A'}</span></div>
                    <div class="stat-card ${isTopAssists ? 'highlight' : ''}"><span class="stat-label">Assists</span><span class="stat-value">${member['Assists'] || 'N/A'}</span></div>
                    <div class="stat-card ${isTopRevives ? 'highlight' : ''}"><span class="stat-label">Revives</span><span class="stat-value">${member['Revives'] || 'N/A'}</span></div>
                    <div class="stat-card ${isTopPartidas ? 'highlight' : ''}"><span class="stat-label">Partidas</span><span class="stat-value">${member['Partidas'] || 'N/A'}</span></div>
                    <div class="stat-card ${isTopXP ? 'highlight' : ''}"><span class="stat-label">XP</span><span class="stat-value">${member['XP'] || 'N/A'}</span></div>
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