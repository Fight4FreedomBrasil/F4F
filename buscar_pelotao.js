// Configurações
const API_URL = 'https://script.google.com/macros/s/AKfycbw22sQgqHKDvJBHTYY3jdTqC8HnwDXNMRbl8pWKY8P9jeDJu7gSttSJetM0Wd49G2bV/exec';
const ordemPatentes = [
    "Marechal", "General", "Coronel", "Tenente", 
    "Major", "Capitão", "Cabo", "Soldado"
];

// Função principal
document.addEventListener('DOMContentLoaded', () => {
    loadSquadData();
});

async function loadSquadData() {
    try {
        const data = await fetchSquadData();
        renderSquad(data);
    } catch (error) {
        showError(error);
    }
}

function fetchSquadData() {
    return new Promise((resolve, reject) => {
        // Usando JSONP para contornar CORS
        window.handleSquadData = (data) => {
            if (data.success) {
                resolve(data);
            } else {
                reject(new Error(data.error || 'Erro ao carregar dados'));
            }
        };

        const script = document.createElement('script');
        script.src = `${API_URL}?callback=handleSquadData`;
        script.onerror = () => reject(new Error('Falha ao conectar com o servidor'));
        document.body.appendChild(script);
    });
}

function renderSquad(data) {
    const { patentes, members } = data;
    const squadContainer = document.getElementById('squad-container');
    
    // Cria a seção de cadastro primeiro (no topo)
    squadContainer.innerHTML = createJoinSection();
    
    let membersHtml = '';
    const membersByRank = {};

    members.forEach(member => {
        if (!membersByRank[member.Ranking]) {
            membersByRank[member.Ranking] = [];
        }
        membersByRank[member.Ranking].push(member);
    });

    ordemPatentes.forEach(patente => {
        if (membersByRank[patente]?.length > 0) {
            membersHtml += createRankSection(patente, membersByRank[patente], patentes[patente]);
        }
    });

    // Adiciona os membros após a seção de cadastro
    squadContainer.innerHTML += membersHtml || '<div class="error-message">Nenhum membro encontrado</div>';
}

function createJoinSection() {
    return `
        <div class="join-section">
            <h2 class="join-title">SE JUNTE AO PELOTÃO!</h2>
            <a href="#" class="join-button" id="cadastroButton">
                <i class="fas fa-user-plus"></i> CADASTRE-SE AQUI
            </a>
            <p class="join-text">(Em breve - sistema de cadastro)</p>
        </div>
    `;
}

function createRankSection(rankName, members, iconUrl) {
    return `
        <div class="rank-category">
            <div class="rank-title">
                <img src="${iconUrl || 'https://via.placeholder.com/50'}" alt="${rankName}" class="rank-icon">
                <h2 class="rank-name">${rankName}</h2>
            </div>
            <div class="members-grid">
                ${members.map(member => createMemberCard(member)).join('')}
            </div>
        </div>
    `;
}

function createMemberCard(member) {
    return `
        <div class="member-card">
            <h3 class="member-name">${member.Nome}</h3>
            <div class="member-info">
                <span class="member-id">${member.ID}</span>
                <span class="member-console">
                    ${member.Console} ${getConsoleIcon(member.Console)}
                </span>
            </div>
        </div>
    `;
}

function getConsoleIcon(consoleType) {
    if (!consoleType) return '<i class="fas fa-question"></i>';
    
    const consoleLower = consoleType.toLowerCase();
    if (consoleLower.includes("ps")) return '<i class="fab fa-playstation"></i>';
    if (consoleLower.includes("xbox")) return '<i class="fab fa-xbox"></i>';
    if (consoleLower.includes("pc")) return '<i class="fas fa-desktop"></i>';
    return '<i class="fas fa-gamepad"></i>';
}

function showError(error) {
    const squadContainer = document.getElementById('squad-container');
    squadContainer.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Não foi possível carregar os dados do pelotão</p>
            <p>${error.message}</p>
            <button onclick="location.reload()">Tentar novamente</button>
        </div>
    `;
    console.error('Erro:', error);
}