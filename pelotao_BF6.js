// Arquivo: pelotao_BF6.js (medalhas + imagens das patentes, mantendo compatibilidade)

document.addEventListener('DOMContentLoaded', () => {

  // >>> MANTIDO: use o SEU endpoint que já estava funcionando
  const API_URL = 'https://script.google.com/macros/s/AKfycbzLXYwQzjMvHTg1CsxvNP0xhrSnSJj7-c7nSY-iVi9ffzKZyeStpEqixHNuvNKwWYXT/exec';

  const container = document.getElementById('platoon-container');

  async function initialize() {
    try {
      const response = await fetch(API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);

      const data = await response.json();

      // 🔁 Compatibilidade: aceita tanto ARRAY quanto {membros, patentes}
      let members = [];
      let patentesMap = {};

      if (Array.isArray(data)) {
        // formato antigo (array) → busca patentes à parte
        members = data;
        patentesMap = await fetchPatentesSafe();
      } else if (data && Array.isArray(data.membros)) {
        // formato novo ({membros, patentes}) → usa direto
        members = data.membros;
        patentesMap = data.patentes || await fetchPatentesSafe();
      } else {
        throw new Error("A API não retornou uma lista de membros válida.");
      }

      renderPlatoon(members, patentesMap);

    } catch (error) {
      console.error("Erro ao buscar dados do pelotão:", error);
      container.innerHTML = `<p class="loading-text" style="color:red;">Não foi possível carregar os dados. ${error.message}</p>`;
    }
  }

  async function fetchPatentesSafe() {
    try {
      const r = await fetch(API_URL + '?patentes=1', { cache: 'no-store' });
      if (!r.ok) throw new Error('Falha ao carregar patentes');
      const map = await r.json();
      // garante objeto plano
      return (map && typeof map === 'object' && !Array.isArray(map)) ? map : {};
    } catch (e) {
      console.warn('Patentes não disponíveis. Seguindo sem ícones de patente.');
      return {};
    }
  }

  function renderPlatoon(members, patentesMap) {
    container.innerHTML = '';
    const topStats = findTopStats(members);
    const rankOrder = [ 'Marechal', 'General', 'Coronel', 'Tenente', 'Major', 'Capitão', 'Sargento', 'Cabo', 'Soldado', 'Sem Patente' ];
    const membersByRank = groupBy(members, 'Ranking');

    rankOrder.forEach(rankName => {
      if (membersByRank[rankName]) {
        const rankSection = document.createElement('div');
        rankSection.className = 'rank-section';

        // 🔥 Imagem ao lado do título da patente
        const imgUrl = patentesMap[rankName] || '';
        rankSection.innerHTML = `
          <h2 class="rank-title">
            ${imgUrl ? `<img src="${imgUrl}" alt="${rankName}" class="rank-icon">` : ''}
            ${rankName}
          </h2>
        `;

        const membersGrid = document.createElement('div');
        membersGrid.className = 'members-grid';

        const sortedMembers = membersByRank[rankName].sort((a, b) => (a.Nome || "").localeCompare(b.Nome || ""));

        sortedMembers.forEach(member => {
          membersGrid.appendChild(createMemberCard(member, topStats));
        });

        rankSection.appendChild(membersGrid);
        container.appendChild(rankSection);
      }
    });
  }

  function findTopStats(members) {
    const top = { 'K/D': 0, 'Kills': 0, 'Assists': 0, 'Revives': 0, 'Partidas': 0, 'XP': 0 };
    Object.keys(top).forEach(key => {
      members.forEach(member => {
        try {
          const value = parseFloat(String(member[key] || '0').replace(/,/g, ''));
          if (value > top[key]) {
            top[key] = value;
          }
        } catch(e) {}
      });
    });
    return top;
  }

  function createMemberCard(member, topStats) {
    const card = document.createElement('div');
    card.className = 'member-card';

    let medalsHTML = '';
    if (member.MedalhasData && member.MedalhasData.length > 0) {
      medalsHTML = '<div class="member-medals">';
      member.MedalhasData.forEach((medal) => {
        medalsHTML += `
          <div class="medal-wrapper">
            <img src="${medal.url}" alt="${medal.nome}" class="medal-icon">
            <div class="medal-tooltip">
              <img src="${medal.url}" alt="${medal.nome}" class="tooltip-img">
              <h4 class="tooltip-title">${medal.nome}</h4>
              <p class="tooltip-desc">${medal.descricao}</p>
            </div>
          </div>
        `;
      });
      medalsHTML += '</div>';
    }

    const consoleIcons = { 'PS5': 'fa-playstation', 'PS4': 'fa-playstation', 'XBOX': 'fa-xbox', 'PC': 'fa-windows' };
    const iconClass = (member.Plataforma && consoleIcons[member.Plataforma.toUpperCase()]) || 'fa-gamepad';

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
        ${medalsHTML}
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

  initialize();
});
