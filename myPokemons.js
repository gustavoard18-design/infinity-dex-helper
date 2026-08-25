let LOCAL_PAYLOAD = { party: [], pc: [] };

const ICON_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/';
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

const DATA_STATE = {
    sourcePokemon: [],
    filteredPokemon: [],
    groups: []
};

const FILTER_STATE = {
    advancedEnabled: false,
    liveName: '',
    appliedName: '',
    applied: PokemonFilters.defaultValues(),
    isFiltering: false
};

const UI_STATE = {
    expandedGroups: new Set(),
    expandedPokemon: new Set(),
    knownGroups: new Set(),
    initialized: false,
    // ligado/desligado pela mensagem 'panel-mode' do shell (modo full) —
    // nunca persistido: some assim que o iframe volta ao modo encaixado.
    forceExpandAll: false,
    // no modo full os detalhes começam todos abertos, mas o usuário pode
    // recolher card a card — os recolhidos vivem aqui, fora do Set
    // persistido (expandedPokemon), e zeram a cada entrada no modo full.
    fullCollapsed: new Set()
};

// defaults de expansão da tela (Configurações → TELAS). Começa com os
// defaults síncronos: se o primeiro payload chegar antes da leitura do
// storage resolver, o comportamento é o padrão — aceitável e raro.
let SCREEN_PREFS = Object.assign({}, PokemonHelperStorage.DEFAULT_UI_PREFERENCES.screens.myPokemons);
PokemonHelperStorage.getUiPreferences()
    .then((prefs) => { SCREEN_PREFS = prefs.screens.myPokemons; })
    .catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
    PokemonHelperStorage.getUiPreferences()
        .then((prefs) => { SCREEN_PREFS = prefs.screens.myPokemons; })
        .catch(() => {});
});

let filterController = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function calculateIvPercent(ivs) {
    const total = STAT_KEYS.reduce((sum, stat) => {
        const value = Number(ivs?.[stat] ?? 0);
        return sum + Math.min(Math.max(value, 0), 31);
    }, 0);
    return Math.round((total / (31 * STAT_KEYS.length)) * 100);
}

function formatToText(value) {
    if (!value) return '—';
    return String(value)
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function getGenderSymbol(gender) {
    const value = String(gender ?? '').toUpperCase();
    const genders = {
        M: { class: 'male', symbol: '♂️' },
        MALE: { class: 'male', symbol: '♂️' },
        F: { class: 'female', symbol: '♀️' },
        FEMALE: { class: 'female', symbol: '♀️' }
    };
    return genders[value] || { symbol: '—', class: '' };
}

function getPokemonName(pokemon) {
    return pokemon?.name || pokemon?.species || 'Desconhecido';
}

function normalizeSearch(value) {
    return String(value ?? '').trim().toLocaleLowerCase('pt-BR');
}

function getPokemonId(name) {
    return POKEMON_NAME_TO_ID[name.toLowerCase()] || null;
}

function normalizeMoves(moves) {
    if (!Array.isArray(moves)) return [];
    return moves.filter(Boolean).map((move) => ({
        name: move.name || 'Desconhecido',
        typeKey: TYPE_MAPPER[move.type] || null,
        category: formatToText(move.category),
        pp: move.pp
    }));
}

function createPokemonViewModel(pokemon, location) {
    const name = getPokemonName(pokemon);
    const typeKeys = [...new Set((pokemon.types || []).map((type) => TYPE_MAPPER[type]).filter(Boolean))];
    const natureName = pokemon.nature || '—';
    const pokemonId = getPokemonId(name);

    return {
        pokemon,
        key: location.key,
        groupKey: location.groupKey,
        location: location.kind,
        boxIndex: location.boxIndex,
        slotIndex: location.slotIndex,
        slotLabel: location.kind === 'party'
            ? `Meu Time - Slot ${location.slotIndex + 1}`
            : `Cx.${location.boxIndex + 1} - Slot ${location.slotIndex + 1}`,
        sourceOrder: location.sourceOrder,
        name,
        normalizedName: normalizeSearch(name),
        pokemonId,
        iconUrl: pokemonId ? `${ICON_URL}${pokemonId}.svg` : null,
        gender: getGenderSymbol(pokemon.gender),
        level: Number(pokemon.level ?? 0),
        natureName,
        natureKey: normalizeSearch(natureName),
        natureEffect: getNatureEffect(natureName),
        ability: pokemon.ability,
        heldItem: formatToText(pokemon.heldItem),
        hasItem: pokemon.heldItem !== null && pokemon.heldItem !== undefined && pokemon.heldItem !== '',
        shiny: pokemon.shiny === true,
        ivs: Object.fromEntries(STAT_KEYS.map((stat) => [stat, Math.min(Math.max(Number(pokemon.ivs?.[stat] ?? 0), 0), 31)])),
        ivPercent: calculateIvPercent(pokemon.ivs),
        typeKeys,
        typeOrder: typeKeys.map((type) => TYPES.indexOf(type)),
        moves: normalizeMoves(pokemon.moves)
    };
}

function rebuildDataState(data) {
    const party = Array.isArray(data?.party) ? data.party : [];
    const pc = Array.isArray(data?.pc) ? data.pc : [];
    const groups = [{ key: 'party', kind: 'party', title: 'Meu time', capacity: 6, boxIndex: null }];
    const pokemon = [];
    let sourceOrder = 0;

    party.forEach((entry, slotIndex) => {
        if (!entry) return;
        pokemon.push(createPokemonViewModel(entry, {
            key: `party:${slotIndex}`,
            groupKey: 'party',
            kind: 'party',
            boxIndex: null,
            slotIndex,
            sourceOrder: sourceOrder++
        }));
    });

    pc.forEach((box, boxIndex) => {
        const list = Array.isArray(box?.pokemon) ? box.pokemon : [];
        const groupKey = `pc:${boxIndex}`;
        groups.push({
            key: groupKey,
            kind: 'pc',
            title: box?.name || `Caixa ${boxIndex + 1}`,
            capacity: list.length || 30,
            boxIndex
        });
        list.forEach((entry, slotIndex) => {
            if (!entry) return;
            pokemon.push(createPokemonViewModel(entry, {
                key: `pc:${boxIndex}:${slotIndex}`,
                groupKey,
                kind: 'pc',
                boxIndex,
                slotIndex,
                sourceOrder: sourceOrder++
            }));
        });
    });

    DATA_STATE.sourcePokemon = pokemon;
    DATA_STATE.groups = groups;
}

function hasAdvancedFilter(values) {
    return values.shinyOnly
        || values.itemOnly
        || values.types.length > 0
        || (values.natureMode === 'name' && values.natures.length > 0)
        || (values.natureMode === 'effect' && (
            values.neutralOnly || values.natureIncrease || values.natureDecrease
        ))
        || values.ivTotalMin > 0
        || STAT_KEYS.some((stat) => values.ivMinimum[stat] > 0);
}

function pokemonPassesFilters(viewModel, nameQuery, values, advancedEnabled, compiled) {
    if (nameQuery && !viewModel.normalizedName.includes(nameQuery)) return false;
    if (!advancedEnabled) return true;
    if (values.shinyOnly && !viewModel.shiny) return false;
    if (values.itemOnly && !viewModel.hasItem) return false;

    if (values.types.length) {
        const matchesType = values.typeMode === 'all'
            ? values.types.every((type) => viewModel.typeKeys.includes(type))
            : values.types.some((type) => viewModel.typeKeys.includes(type));
        if (!matchesType) return false;
    }

    if (values.natureMode === 'name' && values.natures.length) {
        if (!compiled.natureKeys.has(viewModel.natureKey)) return false;
    }

    if (values.natureMode === 'effect') {
        const effect = viewModel.natureEffect;
        if (!effect) return false;
        if (values.neutralOnly) {
            if (effect.increases !== effect.decreases) return false;
        } else {
            if (values.natureIncrease && effect.increases !== values.natureIncrease) return false;
            if (values.natureDecrease && effect.decreases !== values.natureDecrease) return false;
        }
    }

    if (values.ivTotalMin > 0 && Number(viewModel.ivPercent) < values.ivTotalMin) return false;
    if (STAT_KEYS.some((stat) => viewModel.ivs[stat] < values.ivMinimum[stat])) return false;
    return true;
}

function compareTypeOrder(left, right) {
    const length = Math.max(left.typeOrder.length, right.typeOrder.length, 2);
    for (let index = 0; index < length; index += 1) {
        const leftOrder = left.typeOrder[index] ?? TYPES.length;
        const rightOrder = right.typeOrder[index] ?? TYPES.length;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    }
    return 0;
}

function createComparator(values) {
    const direction = values.sortDirection === 'desc' ? -1 : 1;
    return (left, right) => {
        let result = 0;
        switch (values.sortBy) {
            case 'level':
                result = (left.level - right.level) * direction;
                break;
            case 'name':
                result = left.normalizedName.localeCompare(right.normalizedName, 'pt-BR');
                break;
            case 'type':
                result = compareTypeOrder(left, right);
                break;
            case 'nature':
                result = left.natureKey.localeCompare(right.natureKey, 'pt-BR');
                break;
            case 'ivPercent':
                result = (left.ivPercent - right.ivPercent) * direction;
                break;
            default:
                result = left.sourceOrder - right.sourceOrder;
        }
        return result || left.sourceOrder - right.sourceOrder;
    };
}

function applyFilters() {
    const advancedEnabled = FILTER_STATE.advancedEnabled;
    const values = advancedEnabled ? FILTER_STATE.applied : PokemonFilters.defaultValues();
    const nameQuery = advancedEnabled ? FILTER_STATE.appliedName : FILTER_STATE.liveName;
    FILTER_STATE.isFiltering = Boolean(nameQuery) || (advancedEnabled && hasAdvancedFilter(values));

    const noProcessing = !FILTER_STATE.isFiltering
        && (!advancedEnabled || values.sortBy === 'position');
    if (noProcessing) {
        DATA_STATE.filteredPokemon = DATA_STATE.sourcePokemon;
        return;
    }

    const compiled = {
        natureKeys: new Set(values.natures.map(normalizeSearch))
    };

    DATA_STATE.filteredPokemon = DATA_STATE.sourcePokemon
        .filter((viewModel) => pokemonPassesFilters(viewModel, nameQuery, values, advancedEnabled, compiled))
        .sort(createComparator(values));
}

// ---------------------------------------------------------------------
// Render — cartões e grupos no design system v2 (pixel).
// ---------------------------------------------------------------------

// mesmas faixas usadas no encontro (battle.js): >=26 verde, >=15 âmbar
const ivStatColor = (iv) => iv >= 26 ? 'var(--px-good)' : iv >= 15 ? 'var(--px-mid)' : 'var(--px-bad)';
// faixa do IV total (%): >=80 verde, >=50 âmbar
const ivPercentColor = (percent) => percent >= 80 ? 'var(--px-good)' : percent >= 50 ? 'var(--px-mid)' : 'var(--px-bad)';

const MOVE_CATEGORY_STYLE = {
    physical: { label: 'FÍS', color: '#e0803c' },
    special: { label: 'ESP', color: '#4a90e2' },
    status: { label: 'STA', color: 'var(--px-text-dim)' }
};

function moveCategoryInfo(category) {
    const key = String(category ?? '').trim().toLowerCase();
    return MOVE_CATEGORY_STYLE[key] || { label: '—', color: 'var(--px-text-dim)' };
}

function ivTooltipText(ivs) {
    return STAT_KEYS.map((stat) => `${stat.toUpperCase()} ${ivs[stat]}`).join(' · ');
}

// chips de +/- da nature (verde/vermelho), a partir de getNatureEffect
function natureModsHTML(effect) {
    if (!effect) return '';
    if (effect.increases === effect.decreases) {
        return '<span class="nat-mod" style="color:var(--px-mid)">NEUTRA</span>';
    }
    return `<span class="nat-mod" style="color:var(--px-good)">${effect.increases}⬆</span>`
        + `<span class="nat-mod" style="color:var(--px-bad)">${effect.decreases}⬇</span>`;
}

function syncUiState() {
    const groupKeys = DATA_STATE.groups.map((group) => group.key);
    const pokemonKeys = new Set(DATA_STATE.sourcePokemon.map((viewModel) => viewModel.key));
    groupKeys.forEach((key) => {
        // grupos novos (ou primeira carga) nascem expandidos só se a preferência mandar
        if ((!UI_STATE.initialized || !UI_STATE.knownGroups.has(key)) && SCREEN_PREFS.expandGroupsByDefault) {
            UI_STATE.expandedGroups.add(key);
        }
    });
    // pokémon: o default de expansão só vale na primeira carga da tela —
    // depois disso, quem manda é o toggle manual do usuário (expandedPokemon)
    if (!UI_STATE.initialized && SCREEN_PREFS.expandPokemonByDefault) {
        pokemonKeys.forEach((key) => UI_STATE.expandedPokemon.add(key));
    }
    UI_STATE.expandedGroups.forEach((key) => {
        if (!groupKeys.includes(key)) UI_STATE.expandedGroups.delete(key);
    });
    UI_STATE.expandedPokemon.forEach((key) => {
        if (!pokemonKeys.has(key)) UI_STATE.expandedPokemon.delete(key);
    });
    UI_STATE.knownGroups = new Set(groupKeys);
    UI_STATE.initialized = true;
}

function renderDetailRows(viewModel) {
    // avaliação de IVs/natureza/stats (grade Ruim..Excelente) + papel ofensivo
    // principal — mesma fonte (PokemonIvEvaluation) usada no encontro (battle.js)
    const evaluation = PokemonIvEvaluation.evaluate(viewModel.pokemon);
    return `
        <div class="detail-row"><span class="detail-key">Natureza</span><span class="detail-val">${escapeHtml(viewModel.natureName)} ${natureModsHTML(viewModel.natureEffect)}</span></div>
        <div class="detail-row"><span class="detail-key">Habilidade</span><span class="detail-val" data-ability="${escapeHtml(viewModel.ability)}">${escapeHtml(PokemonAbilityInfo.label(viewModel.ability))}</span></div>
        <div class="detail-row"><span class="detail-key">Item</span><span class="detail-val">${escapeHtml(viewModel.heldItem)}</span></div>
        <div class="detail-row"><span class="detail-key">Posição</span><span class="detail-val">${escapeHtml(viewModel.slotLabel)}</span></div>
        <div class="detail-row"><span class="detail-key">Avaliação</span><span class="detail-val">${PokemonIvEvaluation.html(viewModel.pokemon)} ${PokemonHelperTooltip.iconHTML('Avalia IVs, natureza e stats base pra classificar o Pokémon.')}</span></div>
        <div class="detail-row"><span class="detail-key">Atq Principal</span><span class="detail-val">${escapeHtml(evaluation.role)}</span></div>
    `;
}

function renderIvDetails(viewModel) {
    return `<div class="pokemon-iv-grid">${STAT_KEYS.map((stat) => `
        <div class="pokemon-iv">
            <span class="k">${stat.toUpperCase()}</span>
            <span class="v" style="color:${ivStatColor(viewModel.ivs[stat])}">${viewModel.ivs[stat]}</span>
        </div>
    `).join('')}</div>`;
}

function renderMoveDetails(viewModel) {
    if (!viewModel.moves.length) {
        return `<div class="moves-head"><span class="px-label">Golpes</span></div><p class="empty">Nenhum golpe disponível.</p>`;
    }
    const rows = viewModel.moves.map((move) => {
        const category = moveCategoryInfo(move.category);
        const typeBg = move.typeKey ? PokemonPixelIcons.typeColor(move.typeKey) : 'var(--px-bg-track)';
        return `
            <div class="pokemon-move">
                <span class="pokemon-move-type" style="background:${typeBg}"></span>
                <span class="pokemon-move-name">${escapeHtml(move.name)}</span>
                <span class="pokemon-move-category" style="color:${category.color}">${category.label}</span>
                <span class="pokemon-move-pp">${move.pp ?? '—'} PP</span>
            </div>
        `;
    }).join('');
    return `<div class="moves-head"><span class="px-label">Golpes</span></div>${rows}`;
}

function renderPokemonCard(viewModel) {
    const expanded = UI_STATE.forceExpandAll
        ? !UI_STATE.fullCollapsed.has(viewModel.key)
        : UI_STATE.expandedPokemon.has(viewModel.key);
    const detailsId = `pokemon-details-${viewModel.key.replace(/:/g, '-')}`;
    const icon = viewModel.iconUrl
        ? `<img class="pokemon-icon" src="${viewModel.iconUrl}" alt="${escapeHtml(viewModel.name)} icon">`
        : '<span class="pokemon-icon"><span class="pxl-pokeball"></span></span>';
    const genderClass = viewModel.gender.class === 'male' ? 'pokemon-gender-m' : viewModel.gender.class === 'female' ? 'pokemon-gender-f' : '';
    const gender = genderClass ? `<span class="${genderClass}">${viewModel.gender.symbol}</span>` : '';
    const shiny = viewModel.shiny ? '<span data-tip="Shiny!">✨</span>' : '';
    const chips = viewModel.typeKeys.map((type) => typeTagHTML(type, { stack: true })).join('');
    const ivColor = ivPercentColor(viewModel.ivPercent);
    const cardStyle = viewModel.typeKeys[0] ? ` style="--card-type-color:${PokemonPixelIcons.typeColor(viewModel.typeKeys[0])}"` : '';

    return `
        <article class="pokemon-card pokemon-card--${viewModel.location}" data-pokemon-key="${viewModel.key}"${cardStyle}>
            <button type="button" class="pokemon-card-toggle" aria-expanded="${expanded}" aria-controls="${detailsId}">
                ${icon}
                <span class="pokemon-id-col">
                    <span class="pokemon-name">
                        <span class="pokemon-name-text">${escapeHtml(viewModel.name)}</span>
                        ${gender}
                        ${shiny}
                    </span>
                    <span class="pokemon-chips">${chips}</span>
                </span>
                <span class="pokemon-right">
                    <span class="pokemon-level">Lv. ${viewModel.level || '—'}</span>
                    <span class="pokemon-ivbar" data-tip="${escapeHtml(ivTooltipText(viewModel.ivs))}">
                        <span class="px-bar"><span class="px-bar-fill" style="width:${viewModel.ivPercent}%;background:${ivColor}"></span></span>
                        <span class="pokemon-ivbar-label" style="color:${ivColor}">${viewModel.ivPercent}%</span>
                    </span>
                </span>
            </button>
            <div class="pokemon-details" id="${detailsId}" ${expanded ? '' : 'hidden'}>${renderDetailRows(viewModel)}${renderIvDetails(viewModel)}${renderMoveDetails(viewModel)}</div>
        </article>
    `;
}

function renderPokemonList(viewModels, location = 'all') {
    if (!viewModels.length) return '<p class="empty">Nenhum Pokémon encontrado.</p>';
    return `<div class="pokemon-list pokemon-list--${location}">${viewModels.map(renderPokemonCard).join('')}</div>`;
}

function renderCollapsibleGroup(group, viewModels, total) {
    const expanded = UI_STATE.expandedGroups.has(group.key);
    const contentId = `pokemon-group-${group.key.replace(/:/g, '-')}`;
    const counter = FILTER_STATE.isFiltering
        ? `${viewModels.length}/${total}`
        : `${total}/${group.capacity}`;
    return `
        <section class="pokemon-group" data-group-key="${group.key}">
            <button type="button" class="pokemon-group-toggle" aria-expanded="${expanded}" aria-controls="${contentId}">
                <span class="group-title">${expanded ? '▾' : '▸'} ${escapeHtml(group.title)}</span>
                <span class="group-rule"></span>
                <span class="group-counter">${counter}</span>
            </button>
            <div class="pokemon-group-content" id="${contentId}" ${expanded ? '' : 'hidden'}>${renderPokemonList(viewModels, group.kind)}</div>
        </section>
    `;
}

function renderGrouped() {
    // primeira execução: antes do primeiro sync do personagem não existe nem
    // o grupo do time (groups[0]), e render() pode rodar antes disso via
    // 'panel-mode' do shell ou interação com busca/filtros
    if (DATA_STATE.groups.length === 0) {
        return '<p class="empty">Aguardando dados do jogo — eles chegam quando o personagem sincroniza.</p>';
    }
    const sourceByGroup = new Map(DATA_STATE.groups.map((group) => [group.key, []]));
    const filteredByGroup = new Map(DATA_STATE.groups.map((group) => [group.key, []]));
    DATA_STATE.sourcePokemon.forEach((viewModel) => sourceByGroup.get(viewModel.groupKey)?.push(viewModel));
    DATA_STATE.filteredPokemon.forEach((viewModel) => filteredByGroup.get(viewModel.groupKey)?.push(viewModel));
    const partyGroup = DATA_STATE.groups[0];
    const pcGroups = DATA_STATE.groups.slice(1);
    const party = renderCollapsibleGroup(
        partyGroup,
        filteredByGroup.get('party') || [],
        sourceByGroup.get('party')?.length || 0
    );
    const pcBoxes = pcGroups.map((group) => {
        const filtered = filteredByGroup.get(group.key) || [];
        if (FILTER_STATE.isFiltering && filtered.length === 0) return '';
        return renderCollapsibleGroup(group, filtered, sourceByGroup.get(group.key)?.length || 0);
    }).join('');

    return `${party}${pcBoxes}`;
}

function renderFlat() {
    const header = `
        <div class="pokemon-group-toggle" style="cursor:default;">
            <span class="group-title">Todos os Pokémon</span>
            <span class="group-rule"></span>
            <span class="group-counter">${DATA_STATE.filteredPokemon.length}/${DATA_STATE.sourcePokemon.length}</span>
        </div>
    `;
    return `${header}${renderPokemonList(DATA_STATE.filteredPokemon)}`;
}

function syncGlobalControls() {
    const visibleKeys = DATA_STATE.filteredPokemon.map((viewModel) => viewModel.key);
    const groupKeys = DATA_STATE.groups.map((group) => group.key);
    const allGroupsExpanded = groupKeys.length > 0 && groupKeys.every((key) => UI_STATE.expandedGroups.has(key));
    const allPokemonExpanded = UI_STATE.forceExpandAll
        ? visibleKeys.length > 0 && visibleKeys.every((key) => !UI_STATE.fullCollapsed.has(key))
        : visibleKeys.length > 0 && visibleKeys.every((key) => UI_STATE.expandedPokemon.has(key));
    const removeGroups = FILTER_STATE.advancedEnabled && FILTER_STATE.applied.removeGroups;
    const groupsToggle = document.getElementById('expand-all-groups');
    groupsToggle?.setAttribute('aria-pressed', String(allGroupsExpanded));
    if (groupsToggle) groupsToggle.hidden = removeGroups;
    document.getElementById('expand-all-pokemon')?.setAttribute('aria-pressed', String(allPokemonExpanded));
}

function render() {
    const content = document.getElementById('content');
    if (!content) return;
    syncUiState();
    const removeGroups = FILTER_STATE.advancedEnabled && FILTER_STATE.applied.removeGroups;
    // linha de total de resultados no topo (só quando há filtro ativo)
    const summary = FILTER_STATE.isFiltering
        ? `<div class="pokemon-results-summary">${DATA_STATE.filteredPokemon.length} de ${DATA_STATE.sourcePokemon.length} Pokémon</div>`
        : '';
    content.innerHTML = summary + (removeGroups ? renderFlat() : renderGrouped());
    PokemonAbilityInfo.hydrate(content);
    syncGlobalControls();
}

function applyAndRender() {
    applyFilters();
    render();
}

function toggleSetValue(set, key) {
    if (set.has(key)) set.delete(key);
    else set.add(key);
}

function bindControls() {
    const content = document.getElementById('content');
    const filterInput = document.getElementById('pokemon-name-filter');
    const advancedToggle = document.getElementById('toggle-advanced-filters');
    const advancedPanel = document.getElementById('pokemon-advanced-filters');
    const groupsToggle = document.getElementById('expand-all-groups');
    const pokemonToggle = document.getElementById('expand-all-pokemon');

    filterController = PokemonFilters.mount(advancedPanel, {
        onApply(values) {
            FILTER_STATE.applied = values;
            FILTER_STATE.appliedName = normalizeSearch(filterInput.value);
            applyAndRender();
        },
        onClear(values) {
            filterInput.value = '';
            FILTER_STATE.liveName = '';
            FILTER_STATE.appliedName = '';
            FILTER_STATE.applied = values;
            applyAndRender();
        }
    });

    advancedToggle.addEventListener('click', () => {
        FILTER_STATE.advancedEnabled = !FILTER_STATE.advancedEnabled;
        advancedToggle.setAttribute('aria-pressed', String(FILTER_STATE.advancedEnabled));
        advancedPanel.hidden = !FILTER_STATE.advancedEnabled;
        if (!FILTER_STATE.advancedEnabled) FILTER_STATE.liveName = normalizeSearch(filterInput.value);
        applyAndRender();
    });

    filterInput.addEventListener('input', () => {
        if (FILTER_STATE.advancedEnabled) return;
        FILTER_STATE.liveName = normalizeSearch(filterInput.value);
        applyAndRender();
    });

    groupsToggle.addEventListener('click', () => {
        const shouldExpand = groupsToggle.getAttribute('aria-pressed') !== 'true';
        DATA_STATE.groups.forEach((group) => {
            if (shouldExpand) UI_STATE.expandedGroups.add(group.key);
            else UI_STATE.expandedGroups.delete(group.key);
        });
        render();
    });

    pokemonToggle.addEventListener('click', () => {
        const shouldExpand = pokemonToggle.getAttribute('aria-pressed') !== 'true';
        DATA_STATE.filteredPokemon.forEach((viewModel) => {
            // no modo full o estado session-only é o de RECOLHIDOS —
            // o Set persistido não deve ser tocado por ações do modo full
            if (UI_STATE.forceExpandAll) {
                if (shouldExpand) UI_STATE.fullCollapsed.delete(viewModel.key);
                else UI_STATE.fullCollapsed.add(viewModel.key);
            } else if (shouldExpand) {
                UI_STATE.expandedPokemon.add(viewModel.key);
            } else {
                UI_STATE.expandedPokemon.delete(viewModel.key);
            }
        });
        render();
    });

    content.addEventListener('click', (event) => {
        const groupButton = event.target.closest('.pokemon-group-toggle');
        if (groupButton) {
            const group = groupButton.closest('[data-group-key]');
            if (group) toggleSetValue(UI_STATE.expandedGroups, group.dataset.groupKey);
            render();
            return;
        }
        const pokemonButton = event.target.closest('.pokemon-card-toggle');
        if (pokemonButton) {
            const card = pokemonButton.closest('[data-pokemon-key]');
            if (!card) return;
            // no modo full o clique recolhe/reabre só na sessão (fullCollapsed);
            // o Set persistido (expandedPokemon) fica intocado, senão o card
            // ficaria "marcado" como expandido depois que o modo full termina,
            // mesmo sem o usuário ter pedido isso.
            toggleSetValue(UI_STATE.forceExpandAll ? UI_STATE.fullCollapsed : UI_STATE.expandedPokemon, card.dataset.pokemonKey);
            render();
        }
    });
}

bindControls();

window.addEventListener('message', (event) => {
    const { type, payload } = event?.data || {};
    const hasData = payload?.party?.length > 0 || payload?.pc?.length > 0;
    if (type !== 'character-data' || !hasData) return;
    if (payload.pc?.length > 0) LOCAL_PAYLOAD.pc = payload.pc;
    if (payload.party?.length > 0) LOCAL_PAYLOAD.party = payload.party;
    rebuildDataState(LOCAL_PAYLOAD);
    applyAndRender();
});

// modo full do painel (shell) — detalhes de Pokémon começam todos abertos,
// mas podem ser recolhidos card a card (fullCollapsed); grupos continuam
// manuais. Cada entrada no modo full zera os recolhidos da sessão anterior.
window.addEventListener('message', (event) => {
    if (event.data?.type !== 'panel-mode') return;
    const full = event.data.full === true;
    document.body.classList.toggle('full', full);
    if (full !== UI_STATE.forceExpandAll) UI_STATE.fullCollapsed.clear();
    UI_STATE.forceExpandAll = full;
    render();
});
