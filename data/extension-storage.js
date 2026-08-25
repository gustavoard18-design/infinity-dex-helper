// Camada compartilhada de persistência da extensão.
// Mantém as chaves e valores padrão fora das telas e do service worker.
var PokemonHelperStorage = globalThis.PokemonHelperStorage || (() => {
    const KEYS = Object.freeze({
        overlaySettings: 'pkmnHelperSettings',
        updatePreferences: 'pkmnHelperUpdatePreferences',
        updateStatus: 'pkmnHelperUpdateStatus',
        abilities: 'pkmnHelperAbilities',
        pokedex: 'pkmnHelperPokedex',
        trainerMoves: 'pkmnHelperTrainerMoves',
        discoveredMoves: 'pkmnHelperDiscoveredMoves',
        uiPreferences: 'pkmnHelperUiPreferences'
    });

    const DEFAULT_OVERLAY_SETTINGS = Object.freeze({
        top: 16,
        right: 16,
        width: 300,
        height: 360,
        maximized: false,
        restoreWidth: null,
        restoreRight: null,
        restoreTop: null,
        restoreHeight: null,
        collapsed: true,
        view: 'myPokemons',
        open: true
    });

    const DEFAULT_UPDATE_PREFERENCES = Object.freeze({
        notificationsEnabled: false,
        betaChannelEnabled: false
    });

    const DEFAULT_UPDATE_STATUS = Object.freeze({
        updateAvailable: false,
        installedVersion: null,
        latestVersion: null,
        channel: null,
        checkedAt: null,
        error: null
    });

    // seções reordenáveis da aba Encontro (cabeçalho + meta ficam sempre no
    // topo, fora dessa lista). key = identificador usado no render/preferência;
    // label = rótulo mostrado na UI de reordenação (Configurações → BATALHA).
    const BATTLE_SECTIONS = Object.freeze([
        Object.freeze({ key: 'ivs',        label: 'IVs / Stats' }),
        Object.freeze({ key: 'best',       label: 'Melhor Jogada' }),
        Object.freeze({ key: 'weaknesses', label: 'Fraquezas dele' }),
        Object.freeze({ key: 'foeMoves',   label: 'Golpes dele' }),
        Object.freeze({ key: 'pokeballs',  label: 'Pokébolas' }),
        Object.freeze({ key: 'stages',     label: 'Atributos alterados' }),
        Object.freeze({ key: 'myMoves',    label: 'Seus golpes' })
    ]);
    const BATTLE_SECTION_ORDER = Object.freeze(BATTLE_SECTIONS.map((section) => section.key));

    // normaliza uma ordem salva: mantém só chaves conhecidas (sem duplicar) e
    // acrescenta no fim, na ordem canônica, qualquer seção nova que ainda não
    // esteja na lista — assim ordens antigas não perdem seções adicionadas depois.
    function sanitizeBattleOrder(order) {
        const known = new Set(BATTLE_SECTION_ORDER);
        const seen = new Set();
        const out = [];
        (Array.isArray(order) ? order : []).forEach((key) => {
            if (known.has(key) && !seen.has(key)) { seen.add(key); out.push(key); }
        });
        BATTLE_SECTION_ORDER.forEach((key) => { if (!seen.has(key)) out.push(key); });
        return out;
    }

    const DEFAULT_UI_PREFERENCES = Object.freeze({
        tooltipsEnabled: true,
        startView: 'last',            // 'last' | 'battle' | 'myPokemons'
        startCollapsed: 'remember',   // 'remember' | 'collapsed' | 'open'
        autoSwitchToBattle: true,
        minimizeAfterBattle: false,   // recolher pra bolha quando a luta termina
        minimizeOnLeave: true,        // recolher pra bolha ao sair da aba/tela do jogo
        dockToGameGap: true,          // encaixar na faixa preta que o jogo deixa à esquerda
        screens: Object.freeze({
            myPokemons: Object.freeze({
                expandPokemonByDefault: false,
                expandGroupsByDefault: true
            }),
            battle: Object.freeze({
                showStatChanges: true,
                showWeaknesses: true,
                showFoeMoves: true,
                showPokeballs: true,
                showIvs: true,
                showMyMoves: true,
                order: BATTLE_SECTION_ORDER
            })
        })
    });

    function read(key, defaults) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(key, (result) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(error);
                    return;
                }
                resolve(Object.assign({}, defaults, result[key] || {}));
            });
        });
    }

    function write(key, value) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, () => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(error);
                    return;
                }
                resolve(value);
            });
        });
    }

    async function update(key, defaults, changes) {
        const current = await read(key, defaults);
        return write(key, Object.assign(current, changes));
    }

    // uiPreferences tem um objeto aninhado (screens) — o merge raso de read()
    // substituiria o objeto inteiro pelo salvo, e uma versão futura que
    // adicionasse uma tela nova deixaria configs antigas sem o campo.
    function mergeUiPreferences(stored) {
        const prefs = Object.assign({}, DEFAULT_UI_PREFERENCES, stored);
        prefs.screens = {};
        Object.keys(DEFAULT_UI_PREFERENCES.screens).forEach((screen) => {
            prefs.screens[screen] = Object.assign({},
                DEFAULT_UI_PREFERENCES.screens[screen],
                stored && stored.screens && stored.screens[screen]);
        });
        return prefs;
    }

    function getUiPreferencesDeep() {
        return read(KEYS.uiPreferences, {}).then(mergeUiPreferences);
    }

    async function updateUiPreferences(changes) {
        const current = await getUiPreferencesDeep();
        const next = Object.assign({}, current, changes);
        if (changes.screens) {
            next.screens = {};
            Object.keys(current.screens).forEach((screen) => {
                next.screens[screen] = Object.assign({}, current.screens[screen], changes.screens[screen]);
            });
        }
        return write(KEYS.uiPreferences, next);
    }

    return Object.freeze({
        KEYS,
        DEFAULT_OVERLAY_SETTINGS,
        DEFAULT_UPDATE_PREFERENCES,
        DEFAULT_UPDATE_STATUS,
        DEFAULT_UI_PREFERENCES,
        BATTLE_SECTIONS,
        sanitizeBattleOrder,
        getOverlaySettings: () => read(KEYS.overlaySettings, DEFAULT_OVERLAY_SETTINGS),
        setOverlaySettings: (settings) => write(KEYS.overlaySettings, settings),
        getUpdatePreferences: () => read(KEYS.updatePreferences, DEFAULT_UPDATE_PREFERENCES),
        setUpdatePreferences: (changes) => update(KEYS.updatePreferences, DEFAULT_UPDATE_PREFERENCES, changes),
        getUpdateStatus: () => read(KEYS.updateStatus, DEFAULT_UPDATE_STATUS),
        setUpdateStatus: (status) => write(KEYS.updateStatus, Object.assign({}, DEFAULT_UPDATE_STATUS, status)),
        getUiPreferences: getUiPreferencesDeep,
        setUiPreferences: updateUiPreferences,
        getAbilities: () => read(KEYS.abilities, { items: [], checkedAt: null, error: null }),
        setAbilities: (value) => write(KEYS.abilities, value),
        getPokedex: () => read(KEYS.pokedex, { items: [], checkedAt: null, error: null }),
        setPokedex: (value) => write(KEYS.pokedex, value),
        getTrainerMoves: () => read(KEYS.trainerMoves, { items: [], checkedAt: null, error: null }),
        setTrainerMoves: (value) => write(KEYS.trainerMoves, value),
        getDiscoveredMoves: () => read(KEYS.discoveredMoves, { items: [] }),
        setDiscoveredMoves: (value) => write(KEYS.discoveredMoves, value)
    });
})();

globalThis.PokemonHelperStorage = PokemonHelperStorage;
