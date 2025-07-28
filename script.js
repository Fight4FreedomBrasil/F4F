document.addEventListener('DOMContentLoaded', () => {
    // COLOQUE AQUI A URL DA SUA API DA HOMEPAGE
    const API_URL = 'https://script.google.com/macros/s/AKfycbx2-agLV56Gvtav_BWBx7AyFZAuduDNmEBrJHWvjG1MfoWxVzV_l3ThPYoBFhzWB2Ab/exec?page=homepage';
    let allWeapons = [];

    async function initialize() {
        const container = document.getElementById('tier-sections-container');
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Erro ao buscar dados da API.');
            const jsonData = await response.json();
            if (!jsonData.success) throw new Error(jsonData.error || 'API retornou um erro.');
            
            allWeapons = jsonData.weaponsData;
            renderFilters(allWeapons);
            renderWeapons(allWeapons);
            setupSearch();
        } catch (error) {
            console.error("Erro na inicialização:", error);
            container.innerHTML = `<p class="loading-text" style="color:red;">Não foi possível carregar as armas.</p>`;
        }
    }

    function renderWeapons(weapons) {
        const container = document.getElementById('tier-sections-container');
        container.innerHTML = '';
        if (!weapons || weapons.length === 0) {
            container.innerHTML = '<p class="loading-text">Nenhuma arma encontrada.</p>';
            return;
        }
        const weaponsByTier = groupBy(weapons, 'Tier');
        const tierOrder = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
        tierOrder.forEach(tier => {
            if (weaponsByTier[tier]) {
                container.appendChild(createTierSection(tier, weaponsByTier[tier]));
            }
        });
        addAccordionFunctionality();
    }
    
    function renderFilters(weapons) {
        const filterContainer = document.getElementById('filter-tags');
        const classes = ['Todas', ...new Set(weapons.map(w => w.Classe).filter(Boolean))];
        filterContainer.innerHTML = classes.map(cls => `<button class="filter-tag" data-class="${cls}">${cls}</button>`).join('');
        
        filterContainer.querySelectorAll('.filter-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                filterContainer.querySelector('.active')?.classList.remove('active');
                tag.classList.add('active');
                const selectedClass = tag.dataset.class;
                document.getElementById('weaponSearch').value = '';
                const filteredWeapons = selectedClass === 'Todas' ? allWeapons : allWeapons.filter(w => w.Classe === selectedClass);
                renderWeapons(filteredWeapons);
            });
        });
        filterContainer.querySelector('.filter-tag[data-class="Todas"]').classList.add('active');
    }
    
    function setupSearch() {
        const searchInput = document.getElementById('weaponSearch');
        searchInput.addEventListener('input', e => {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelector('.filter-tag.active')?.classList.remove('active');
            const filteredWeapons = allWeapons.filter(w => 
                (w.Arma && w.Arma.toLowerCase().includes(searchTerm)) || 
                (w.Classe && w.Classe.toLowerCase().includes(searchTerm))
            );
            renderWeapons(filteredWeapons);
        });
    }

    function createTierSection(tier, weapons) {
        const section = document.createElement('div');
        section.className = `tier-section tier-${tier}`;
        section.innerHTML = `<h2 class="tier-title">Tier ${tier}</h2>`;
        weapons.forEach(weapon => {
            section.appendChild(createWeaponElement(weapon));
        });
        return section;
    }


    function createWeaponElement(weapon) {
        const item = document.createElement('div');
        item.className = 'weapon-ranking-item';

        // Cria o HTML para a lista de acessórios
        let attachmentsHTML = '';
        const attachmentHeaders = ['Cano', 'Freio de Boca', 'Acoplamento Inferior', 'Carregador', 'Empunhadura Traseira', 'Coronha', 'Modos de Tiro'];
        attachmentHeaders.forEach(header => {
            if (weapon[header]) {
                attachmentsHTML += `
                    <div class="attachment">
                        <span class="attachment-slot">${header}</span>
                        <span class="attachment-name">${weapon[header]}</span>
                    </div>`;
            }
        });
        if (!attachmentsHTML) {
            attachmentsHTML = '<p style="padding: 0 10px;">Nenhum loadout detalhado para esta arma.</p>';
        }

        // --- MUDANÇA AQUI: Troca o '+' por um ícone de seta ---
        item.innerHTML = `
            <div class="accordion-header">
                <div class="toggle-icon">
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="weapon-info">
                    <h3>${weapon.Arma || 'Arma Desconhecida'}</h3>
                    <div class="labels">
                        <span class="label tier-${weapon.Tier}">${weapon.Tier || '?'} Tier</span>
                        <span class="label">${weapon.Classe || 'N/A'}</span>
                    </div>
                </div>
                <img src="${weapon.ImagemURL || ''}" alt="${weapon.Arma}" class="weapon-image">
            </div>
            <div class="accordion-content">
                <div class="attachments-list">${attachmentsHTML}</div>
            </div>`;
        return item;
    }
    
    function addAccordionFunctionality() {
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('active');
                const content = header.nextElementSibling;
                content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + 'px';
            });
        });
    }

    function groupBy(array, key) {
        return array.reduce((result, currentValue) => {
            (result[currentValue[key] || 'Outros'] = result[currentValue[key] || []] || []).push(currentValue);
            return result;
        }, {});
    }

    initialize();
});