if (typeof PokemonHelperStorage === 'undefined') {
    importScripts('data/extension-storage.js');
}

const HOST_RE = /^https?:\/\/([^/]*\.)?infinitymmo\.net(\/|$)/;
const UPDATE_ALARM = 'pkmn-helper-check-updates';
const UPDATE_INTERVAL_MINUTES = 360;
const ABILITIES_ALARM = 'pkmn-helper-refresh-abilities';
const ABILITIES_URL = 'https://infinitymmo.net/assets/data/wiki-abilities.json';
const ABILITIES_MAX_AGE = 24 * 60 * 60 * 1000;
const POKEDEX_ALARM = 'pkmn-helper-refresh-pokedex';
const POKEDEX_URL = 'https://infinitymmo.net/assets/data/wiki-pokedex.json';
const POKEDEX_MAX_AGE = 24 * 60 * 60 * 1000;
const TRAINER_MOVES_ALARM = 'pkmn-helper-refresh-trainer-moves';
const TRAINERS_URL = 'https://infinitymmo.net/assets/data/trainers.json';
const TRAINER_MOVES_MAX_AGE = 24 * 60 * 60 * 1000;
let updateCheckPromise = null;
let abilityCheckPromise = null;
let pokedexCheckPromise = null;
let trainerMovesCheckPromise = null;

async function refreshAbilities(force = false) {
    if (abilityCheckPromise) return abilityCheckPromise;
    abilityCheckPromise = (async () => {
        const cached = await PokemonHelperStorage.getAbilities();
        const age = Date.now() - new Date(cached.checkedAt || 0).getTime();
        if (!force && cached.items.length && age < ABILITIES_MAX_AGE) return cached;
        try {
            const response = await fetch(ABILITIES_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error(`InfinityMMO respondeu com status ${response.status}`);
            const payload = await response.json();
            const items = Array.isArray(payload) ? payload : payload.abilities;
            if (!Array.isArray(items)) throw new Error('Lista de habilidades inválida');
            return PokemonHelperStorage.setAbilities({ items, checkedAt: new Date().toISOString(), error: null });
        } catch (error) {
            await PokemonHelperStorage.setAbilities({ ...cached, error: error.message });
            console.warn('[Infinity Dex Helper] Não foi possível atualizar habilidades:', error);
            return cached;
        }
    })().finally(() => { abilityCheckPromise = null; });
    return abilityCheckPromise;
}

async function refreshPokedex(force = false) {
    if (pokedexCheckPromise) return pokedexCheckPromise;
    pokedexCheckPromise = (async () => {
        const cached = await PokemonHelperStorage.getPokedex();
        const age = Date.now() - new Date(cached.checkedAt || 0).getTime();
        if (!force && cached.items.length && age < POKEDEX_MAX_AGE) return cached;
        try {
            const response = await fetch(POKEDEX_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error(`InfinityMMO respondeu com status ${response.status}`);
            const payload = await response.json();
            const remoteItems = Array.isArray(payload) ? payload : payload.mons;
            if (!Array.isArray(remoteItems)) {
                throw new Error('Pokédex remota inválida');
            }
            const items = remoteItems.filter((item) => item?.slug && Number.isFinite(Number(item.catchRate))).map((item) => ({
                slug: item.slug,
                name: item.name,
                dex: Number(item.dex),
                types: Array.isArray(item.types) ? item.types : [],
                catchRate: Number(item.catchRate),
                base: item.base || null,
                levelMoves: Array.isArray(item.levelMoves)
                    ? item.levelMoves.filter((move) => move?.slug && Number.isFinite(Number(move.lv))).map((move) => ({ lv: Number(move.lv), slug: move.slug }))
                    : []
            }));
            if (!items.length) throw new Error('Pokédex remota sem catch rates válidos');
            return PokemonHelperStorage.setPokedex({ items, checkedAt: new Date().toISOString(), error: null });
        } catch (error) {
            await PokemonHelperStorage.setPokedex({ ...cached, error: error.message });
            console.warn('[Infinity Dex Helper] Não foi possível atualizar a Pokédex:', error);
            return cached;
        }
    })().finally(() => { pokedexCheckPromise = null; });
    return pokedexCheckPromise;
}

// indexa por espécie+nível pra dar o moveset EXATO de um Pokémon de treinador
// (mais confiável que a heurística de nível usada em batalhas selvagens);
// quando há mais de um treinador com o mesmo par espécie+nível, fica com o
// moveset mais completo (times de exibição/placeholder às vezes vêm sem golpes)
function indexTrainerMoves(trainers) {
    const bySpeciesLevel = new Map();
    Object.values(trainers || {}).forEach((trainer) => {
        (trainer.party || []).forEach((mon) => {
            if (!mon?.species || !Number.isFinite(Number(mon.level)) || !Array.isArray(mon.moves) || !mon.moves.length) return;
            const key = `${mon.species}|${Number(mon.level)}`;
            const existing = bySpeciesLevel.get(key);
            if (!existing || mon.moves.length > existing.moves.length) {
                bySpeciesLevel.set(key, { species: mon.species, level: Number(mon.level), moves: mon.moves });
            }
        });
    });
    return [...bySpeciesLevel.values()];
}

async function refreshTrainerMoves(force = false) {
    if (trainerMovesCheckPromise) return trainerMovesCheckPromise;
    trainerMovesCheckPromise = (async () => {
        const cached = await PokemonHelperStorage.getTrainerMoves();
        const age = Date.now() - new Date(cached.checkedAt || 0).getTime();
        if (!force && cached.items.length && age < TRAINER_MOVES_MAX_AGE) return cached;
        try {
            const response = await fetch(TRAINERS_URL, { cache: 'no-store' });
            if (!response.ok) throw new Error(`InfinityMMO respondeu com status ${response.status}`);
            const payload = await response.json();
            const trainers = payload?.trainers && typeof payload.trainers === 'object' ? payload.trainers : payload;
            const items = indexTrainerMoves(trainers);
            if (!items.length) throw new Error('Dados de treinadores inválidos');
            return PokemonHelperStorage.setTrainerMoves({ items, checkedAt: new Date().toISOString(), error: null });
        } catch (error) {
            await PokemonHelperStorage.setTrainerMoves({ ...cached, error: error.message });
            console.warn('[Infinity Dex Helper] Não foi possível atualizar golpes de treinadores:', error);
            return cached;
        }
    })().finally(() => { trainerMovesCheckPromise = null; });
    return trainerMovesCheckPromise;
}

function compareVersions(left, right) {
    const leftParts = String(left).split('.').map(Number);
    const rightParts = String(right).split('.').map(Number);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
        const leftPart = leftParts[index] || 0;
        const rightPart = rightParts[index] || 0;
        if (leftPart > rightPart) return 1;
        if (leftPart < rightPart) return -1;
    }
    return 0;
}

function setUpdateAlarm(enabled) {
    chrome.alarms.clear(UPDATE_ALARM, () => {
        if (enabled) {
            chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: UPDATE_INTERVAL_MINUTES });
        }
    });
}

async function checkForUpdates() {
    if (updateCheckPromise) return updateCheckPromise;

    updateCheckPromise = (async () => {
        const preferences = await PokemonHelperStorage.getUpdatePreferences();
        if (!preferences.notificationsEnabled) {
            await PokemonHelperStorage.setUpdateStatus({ updateAvailable: false });
            return;
        }

        const branch = preferences.betaChannelEnabled ? 'develop' : 'main';
        const channel = preferences.betaChannelEnabled ? 'beta' : 'stable';
        const installedManifest = chrome.runtime.getManifest();
        const manifestName = installedManifest.browser_specific_settings
            ? 'manifest.firefox.json'
            : 'manifest.json';
        const manifestUrl = `https://raw.githubusercontent.com/gustavoard18-design/infinity-dex-helper/${branch}/${manifestName}`;

        try {
            const response = await fetch(manifestUrl, { cache: 'no-store' });
            if (!response.ok) throw new Error(`GitHub respondeu com status ${response.status}`);

            const remoteManifest = await response.json();
            if (!/^\d+(\.\d+)*$/.test(remoteManifest.version || '')) {
                throw new Error('Versão remota inválida');
            }

            await PokemonHelperStorage.setUpdateStatus({
                updateAvailable: compareVersions(remoteManifest.version, installedManifest.version) > 0,
                installedVersion: installedManifest.version,
                latestVersion: remoteManifest.version,
                channel,
                checkedAt: new Date().toISOString(),
                error: null
            });
        } catch (error) {
            const previousStatus = await PokemonHelperStorage.getUpdateStatus();
            const belongsToCurrentChannel = previousStatus.channel === channel;
            await PokemonHelperStorage.setUpdateStatus({
                ...previousStatus,
                updateAvailable: belongsToCurrentChannel && previousStatus.updateAvailable,
                installedVersion: installedManifest.version,
                channel,
                checkedAt: new Date().toISOString(),
                error: error.message
            });
            console.warn('[Infinity Dex Helper] Não foi possível verificar atualizações:', error);
        }
    })().finally(() => {
        updateCheckPromise = null;
    });

    return updateCheckPromise;
}

async function initializeUpdateChecks() {
    const preferences = await PokemonHelperStorage.getUpdatePreferences();
    setUpdateAlarm(preferences.notificationsEnabled);
    if (preferences.notificationsEnabled) await checkForUpdates();
    chrome.alarms.create(ABILITIES_ALARM, { periodInMinutes: 1440 });
    chrome.alarms.create(POKEDEX_ALARM, { periodInMinutes: 1440 });
    chrome.alarms.create(TRAINER_MOVES_ALARM, { periodInMinutes: 1440 });
    await Promise.all([refreshAbilities(), refreshPokedex(), refreshTrainerMoves()]);
}

// 'toggle': ícone/atalho — fecha o overlay se já estiver aberto.
// 'ensure': injeção automática (troca de página, F5) — nunca fecha, só garante
// que exista; precisa ser idempotente porque `tabs.onUpdated` pode disparar
// mais de um 'complete' pra mesma navegação.
function runContentScripts(tabId, mode) {
    if (!tabId) return;
    chrome.scripting
        .executeScript({
            target: { tabId },
            func: (m) => { window.__pkmnHelperInjectMode = m; },
            args: [mode],
        })
        .then(() => {
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['data/extension-storage.js', 'components/pixel-icon.js', 'components/tooltip.js', 'components/header-buttons.js', 'components/settings-panel.js', 'content.js']
            });
            // MAIN world: só ali dá pra sobrescrever o window.fetch que o jogo usa.
            chrome.scripting.executeScript({
                target: { tabId },
                world: 'MAIN',
                files: ['interceptor.js']
            });
        })
        .catch(() => {});
}

chrome.action.onClicked.addListener((tab) => runContentScripts(tab.id, 'toggle'));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && HOST_RE.test(tab.url)) {
        runContentScripts(tabId, 'ensure');
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'pkmn-helper-refresh-abilities') refreshAbilities();
    if (msg && msg.type === 'pkmn-helper-refresh-pokedex') refreshPokedex();
    if (msg && msg.type === 'pkmn-helper-refresh-trainer-moves') refreshTrainerMoves();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === UPDATE_ALARM) checkForUpdates();
    if (alarm.name === ABILITIES_ALARM) refreshAbilities(true);
    if (alarm.name === POKEDEX_ALARM) refreshPokedex(true);
    if (alarm.name === TRAINER_MOVES_ALARM) refreshTrainerMoves(true);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[PokemonHelperStorage.KEYS.updatePreferences]) return;

    const preferences = Object.assign(
        {},
        PokemonHelperStorage.DEFAULT_UPDATE_PREFERENCES,
        changes[PokemonHelperStorage.KEYS.updatePreferences].newValue || {}
    );
    setUpdateAlarm(preferences.notificationsEnabled);
    checkForUpdates();
});

initializeUpdateChecks().catch((error) => {
    console.warn('[Infinity Dex Helper] Falha ao iniciar verificação de atualizações:', error);
});

