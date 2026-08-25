// Painel reutilizável de filtros avançados para listas de Pokémon.
const PokemonFilters = (() => {
    const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
    const EFFECT_STATS = ['ATK', 'DEF', 'SPA', 'SPD', 'SPE'];

    function defaultValues() {
        return {
            removeGroups: false,
            sortBy: 'position',
            sortDirection: 'asc',
            shinyOnly: false,
            itemOnly: false,
            typeMode: 'any',
            types: [],
            natureMode: 'name',
            natures: [],
            natureIncrease: '',
            natureDecrease: '',
            neutralOnly: false,
            ivTotalMin: 0,
            ivMinimum: Object.fromEntries(STATS.map((stat) => [stat, 0]))
        };
    }

    function mount(panel, callbacks = {}) {
        const selectedTypes = new Set();
        const selectedNatures = new Set();

        panel.innerHTML = `
            <div class="pokemon-filter-grid">
                <label class="filter-field filter-field--checkbox filter-toggle-control">
                    <input type="checkbox" id="filter-remove-groups">
                    <span>Remover caixas</span>
                </label>

                <label class="filter-field">
                    <span>Ordenar por</span>
                    <select id="filter-sort-by" class="pxl-input">
                        <option value="position">Slot e Caixa</option>
                        <option value="level">Nível</option>
                        <option value="name">Alfabética</option>
                        <option value="type">Tipo</option>
                        <option value="nature">Nature</option>
                        <option value="ivPercent">IV%</option>
                    </select>
                </label>

                <label class="filter-field" id="filter-direction-field" hidden>
                    <span>Direção</span>
                    <select id="filter-sort-direction" class="pxl-input">
                        <option value="asc">Crescente</option>
                        <option value="desc">Decrescente</option>
                    </select>
                </label>
            </div>

            <fieldset class="pokemon-filter-section">
                <legend>Filtros rápidos</legend>
                <div class="filter-checks">
                    <label class="filter-field--checkbox"><input type="checkbox" id="filter-shiny"> <span>Somente Shiny</span></label>
                    <label class="filter-field--checkbox"><input type="checkbox" id="filter-item"> <span>Somente com item</span></label>
                </div>
            </fieldset>

            <fieldset class="pokemon-filter-section">
                <legend>Tipos</legend>
                <label class="filter-field">
                    <span>Modo</span>
                    <select id="filter-type-mode" class="pxl-input">
                        <option value="any">Múltiplos — qualquer selecionado</option>
                        <option value="all">Exclusivos — todos selecionados</option>
                    </select>
                </label>
                <div class="type-filter-options" id="filter-type-options">
                    ${TYPES.map((type) => `
                        <button type="button" class="type-filter-option" data-type="${type}" aria-pressed="false" title="${LABELS[type]}">
                            ${typeIconHTML(type, { colored: true })}
                            <span>${LABELS[type]}</span>
                        </button>
                    `).join('')}
                </div>
                <p class="filter-help" id="filter-type-help">Selecione um ou mais tipos.</p>
            </fieldset>

            <fieldset class="pokemon-filter-section">
                <legend>Nature</legend>
                <label class="filter-field">
                    <span>Selecionar por</span>
                    <select id="filter-nature-mode" class="pxl-input">
                        <option value="name">Nome</option>
                        <option value="effect">Efeito</option>
                    </select>
                </label>

                <div id="filter-nature-name-fields">
                    <div class="nature-autocomplete">
                        <input type="text" id="filter-nature-search" class="pxl-input" placeholder="Digite uma Nature" autocomplete="off">
                        <div class="nature-dropdown" id="filter-nature-dropdown"></div>
                    </div>
                    <div class="nature-filter-chips" id="filter-nature-chips"></div>
                </div>

                <div class="nature-effect-fields" id="filter-nature-effect-fields" hidden>
                    <label class="filter-field"><span>Aumenta</span><select id="filter-nature-increase" class="pxl-input"><option value="">Qualquer</option>${EFFECT_STATS.map((stat) => `<option>${stat}</option>`).join('')}</select></label>
                    <label class="filter-field"><span>Diminui</span><select id="filter-nature-decrease" class="pxl-input"><option value="">Qualquer</option>${EFFECT_STATS.map((stat) => `<option>${stat}</option>`).join('')}</select></label>
                    <label class="filter-field--checkbox"><input type="checkbox" id="filter-nature-neutral"> <span>Neutras</span></label>
                </div>
            </fieldset>

            <fieldset class="pokemon-filter-section">
                <legend>IV mínimo</legend>
                <label class="filter-field iv-total-field"><span>IV total ≥</span><input type="number" id="filter-iv-total" min="0" max="100" value="0" inputmode="numeric"> %</label>
                <div class="iv-filter-grid">
                    ${STATS.map((stat) => `<label><span>${stat.toUpperCase()}</span><input type="number" id="filter-iv-${stat}" min="0" max="31" value="0" inputmode="numeric"></label>`).join('')}
                </div>
            </fieldset>

            <div class="pokemon-filter-actions">
                <button type="button" class="pxl-btn pxl-btn-sm" id="filter-clear">Limpar</button>
                <button type="button" class="pxl-btn pxl-btn-sm" id="filter-apply">Aplicar</button>
            </div>
        `;

        const byId = (id) => panel.querySelector(`#${id}`);
        const sortBy = byId('filter-sort-by');
        const directionField = byId('filter-direction-field');
        const typeMode = byId('filter-type-mode');
        const typeHelp = byId('filter-type-help');
        const natureMode = byId('filter-nature-mode');
        const natureNameFields = byId('filter-nature-name-fields');
        const natureEffectFields = byId('filter-nature-effect-fields');
        const natureSearch = byId('filter-nature-search');
        const natureDropdown = byId('filter-nature-dropdown');
        const natureChips = byId('filter-nature-chips');
        const neutralCheckbox = byId('filter-nature-neutral');
        const increaseSelect = byId('filter-nature-increase');
        const decreaseSelect = byId('filter-nature-decrease');

        function syncSortDirection() {
            directionField.hidden = !['level', 'ivPercent'].includes(sortBy.value);
        }

        function syncTypeHelp() {
            typeHelp.textContent = typeMode.value === 'all'
                ? 'Selecione no máximo 2 tipos. O Pokémon deve possuir todos.'
                : 'O Pokémon deve possuir pelo menos um dos tipos selecionados.';
        }

        function syncNatureMode() {
            const byName = natureMode.value === 'name';
            natureNameFields.hidden = !byName;
            natureEffectFields.hidden = byName;
        }

        function syncNeutral() {
            increaseSelect.disabled = neutralCheckbox.checked;
            decreaseSelect.disabled = neutralCheckbox.checked;
        }

        function renderNatureChips() {
            natureChips.innerHTML = [...selectedNatures].map((nature) => `
                <span class="nature-filter-chip">
                    ${natureEffectHTML(nature)}
                    <button type="button" data-nature="${nature}" aria-label="Remover ${nature}">×</button>
                </span>
            `).join('');
        }

        function addNature(nature) {
            selectedNatures.add(nature);
            renderNatureChips();
            natureSearch.value = '';
            natureDropdown.classList.remove('open');
        }

        function renderNatureDropdown() {
            const query = natureSearch.value.trim().toLowerCase();
            const matches = NATURE_NAMES
                .filter((nature) => !selectedNatures.has(nature))
                .filter((nature) => !query || nature.toLowerCase().includes(query))
                .slice(0, 8);
            natureDropdown.innerHTML = matches.length
                ? matches.map((nature) => `<button type="button" data-nature="${nature}">${natureEffectHTML(nature)}</button>`).join('')
                : '<span>Nenhuma Nature encontrada.</span>';
            natureDropdown.classList.add('open');
        }

        function setType(type, selected) {
            const button = panel.querySelector(`[data-type="${type}"]`);
            if (selected) selectedTypes.add(type);
            else selectedTypes.delete(type);
            button?.setAttribute('aria-pressed', String(selected));
        }

        byId('filter-type-options').addEventListener('click', (event) => {
            const button = event.target.closest('[data-type]');
            if (!button) return;
            const type = button.dataset.type;
            const selecting = !selectedTypes.has(type);
            if (selecting && typeMode.value === 'all' && selectedTypes.size >= 2) return;
            setType(type, selecting);
        });

        typeMode.addEventListener('change', () => {
            if (typeMode.value === 'all' && selectedTypes.size > 2) {
                [...selectedTypes].slice(2).forEach((type) => setType(type, false));
            }
            syncTypeHelp();
        });
        sortBy.addEventListener('change', syncSortDirection);
        natureMode.addEventListener('change', syncNatureMode);
        neutralCheckbox.addEventListener('change', syncNeutral);
        natureSearch.addEventListener('input', renderNatureDropdown);
        natureSearch.addEventListener('focus', renderNatureDropdown);
        natureSearch.addEventListener('blur', () => setTimeout(() => natureDropdown.classList.remove('open'), 150));
        natureDropdown.addEventListener('mousedown', (event) => {
            const option = event.target.closest('[data-nature]');
            if (!option) return;
            event.preventDefault();
            addNature(option.dataset.nature);
        });
        natureChips.addEventListener('click', (event) => {
            const button = event.target.closest('[data-nature]');
            if (!button) return;
            selectedNatures.delete(button.dataset.nature);
            renderNatureChips();
        });

        function clampIv(value) {
            const number = Number.parseInt(value, 10);
            return Number.isFinite(number) ? Math.min(31, Math.max(0, number)) : 0;
        }

        function getValues() {
            const ivMinimum = Object.fromEntries(STATS.map((stat) => {
                const input = byId(`filter-iv-${stat}`);
                const value = clampIv(input.value);
                input.value = value;
                return [stat, value];
            }));
            return {
                removeGroups: byId('filter-remove-groups').checked,
                sortBy: sortBy.value,
                sortDirection: byId('filter-sort-direction').value,
                shinyOnly: byId('filter-shiny').checked,
                itemOnly: byId('filter-item').checked,
                typeMode: typeMode.value,
                types: [...selectedTypes],
                natureMode: natureMode.value,
                natures: [...selectedNatures],
                natureIncrease: increaseSelect.value,
                natureDecrease: decreaseSelect.value,
                neutralOnly: neutralCheckbox.checked,
                ivTotalMin: (() => {
                    const el = byId('filter-iv-total');
                    const n = Number.parseInt(el.value, 10);
                    const v = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
                    el.value = v;
                    return v;
                })(),
                ivMinimum
            };
        }

        function reset() {
            const defaults = defaultValues();
            byId('filter-remove-groups').checked = false;
            sortBy.value = defaults.sortBy;
            byId('filter-sort-direction').value = defaults.sortDirection;
            byId('filter-shiny').checked = false;
            byId('filter-item').checked = false;
            typeMode.value = defaults.typeMode;
            [...selectedTypes].forEach((type) => setType(type, false));
            natureMode.value = defaults.natureMode;
            selectedNatures.clear();
            renderNatureChips();
            increaseSelect.value = '';
            decreaseSelect.value = '';
            neutralCheckbox.checked = false;
            byId('filter-iv-total').value = 0;
            STATS.forEach((stat) => { byId(`filter-iv-${stat}`).value = 0; });
            syncSortDirection();
            syncTypeHelp();
            syncNatureMode();
            syncNeutral();
        }

        byId('filter-apply').addEventListener('click', () => callbacks.onApply?.(getValues()));
        byId('filter-clear').addEventListener('click', () => {
            reset();
            callbacks.onClear?.(getValues());
        });

        reset();
        return { getValues, reset };
    }

    return Object.freeze({ mount, defaultValues });
})();
