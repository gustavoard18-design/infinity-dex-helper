const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
// TYPE_MAPPER e TYPES vêm de components/type-tag.js; CHART/defMultiplier vêm de
// components/type-chart-data.js; MOVE_TYPES vem de data/move-types.js;
// STATUS_MOVES vem de data/move-status.js

const state = {
    battleId: null, kind: null, foe: null, foeParty: [], party: [], youMon: null, bag: {}, turn: 1,
    canCatch: false, moves: [], caught: false, over: false, active: { you: null, foe: null },
    stages: { you: {}, foe: {} }, foeMoveUses: {}
};
let pokedexBySlug = new Map();
let trainerMovesByKey = new Map();
let discoveredMovesByKey = new Map();
const openMoves = new Set();

// seções visíveis da tela (Configurações → TELAS → BATALHA)
let SCREEN_PREFS = Object.assign({}, PokemonHelperStorage.DEFAULT_UI_PREFERENCES.screens.battle);
PokemonHelperStorage.getUiPreferences()
    .then((prefs) => { SCREEN_PREFS = prefs.screens.battle; render(); })
    .catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
    PokemonHelperStorage.getUiPreferences()
        .then((prefs) => { SCREEN_PREFS = prefs.screens.battle; render(); })
        .catch(() => {});
});

const escapeHtml = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
const normalizeSpecies = (value) => String(value || '').trim().toLowerCase().replace(/[.']/g, '').replace(/[\s-]+/g, '_');
const typeNames = (types) => [...new Set((types || []).map((id) => TYPE_MAPPER[id] || String(id).toLowerCase()).filter(Boolean))];
const row = (label, value) => `<div class="row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
// verde/amarelo/vermelho por faixa de IV (0-31), usado no grid IVS/STATS e na
// célula "IVS TOTAL" da grade meta
const ivColor = (iv) => iv >= 26 ? 'var(--px-good)' : iv >= 15 ? 'var(--px-mid)' : 'var(--px-bad)';

function resetBattle(battleId) {
    Object.assign(state, {
        battleId: battleId || null, kind: null, foe: null, foeParty: [], youMon: null, turn: 1,
        canCatch: false, moves: [], caught: false, over: false,
        active: { you: null, foe: null }, stages: { you: {}, foe: {} }, foeMoveUses: {}
    });
}

// acha o Pokémon ativo do time. Prioriza o índice de batalha em state.party;
// se não alinhar, casa pelo moveset atual (state.moves). Se o time ainda não
// foi sincronizado nesta sessão, cai pros dados ao vivo do próprio Pokémon
// ativo vindos do payload de batalha (state.youMon) — assim o dano aparece
// mesmo sem a sincronização do personagem ter rolado.
function resolveActivePokemon() {
    const byIndex = state.party[state.active.you];
    if (byIndex) return byIndex;
    const wanted = state.moves.map((move) => slugifyMoveName(move.name)).filter(Boolean);
    if (wanted.length) {
        const byMoves = state.party.find((pokemon) => {
            const names = new Set((pokemon?.moves || []).map((move) => slugifyMoveName(move.name)));
            return wanted.every((slug) => names.has(slug));
        });
        if (byMoves) return byMoves;
    }
    return state.youMon || null;
}

// multiplicador de atributo alterado (mesma tabela dos jogos): +1 = ×1.5,
// +2 = ×2 … +6 = ×4; -1 = ×2/3 … -6 = ×1/4. Aplica-se a atk/def/spa/spd/spe.
function stageMultiplier(stage) {
    const s = Math.max(-6, Math.min(6, Number(stage) || 0));
    return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

// stat efetivo de um Pokémon: usa o valor ao vivo (payload) quando existe; se
// faltar (o jogo nem sempre manda os stats completos do oponente), calcula do
// base da Pokédex + IV + nível (natureza neutra) em vez de usar 1 — senão a
// defesa vira 1 e o dano estimado explota. Devolve null se não dá pra saber.
function effectiveStat(mon, key) {
    const live = Number(mon && mon.stats ? mon.stats[key] : NaN);
    if (Number.isFinite(live) && live > 0) return live;
    const entry = pokedexBySlug.get(normalizeSpecies(mon && (mon.species || mon.name)));
    const base = Number(entry && entry.base ? entry.base[key] : NaN);
    if (!Number.isFinite(base) || base <= 0) return null;
    const ivRaw = Number(mon && mon.ivs ? mon.ivs[key] : NaN);
    const iv = Number.isFinite(ivRaw) ? Math.max(0, Math.min(31, ivRaw)) : 15;
    const level = Number(mon && mon.level) || 1;
    return Math.floor((2 * base + iv) * level / 100 + 5);
}

// estimativa de dano (fórmula padrão de jogos Pokémon). Inclui os atributos
// alterados: `atkStage` é o estágio ofensivo de quem ataca e `defStage` o
// defensivo de quem defende (quem chama escolhe atk/spa vs def/spd). Continua
// sem crítico/clima/item/habilidade. Devolve { min, max } (variação 85–100%),
// ou null quando não dá pra resolver ataque/defesa (aí quem chama não mostra).
function estimateDamage(pokemon, move, foe, multiplier, stab = 1, atkStage = 0, defStage = 0) {
    const level = Number(pokemon.level) || 1;
    const power = Number(move.power) || 0;
    const isSpecial = move.category === 'special';
    const rawAtk = effectiveStat(pokemon, isSpecial ? 'spa' : 'atk');
    const rawDef = effectiveStat(foe, isSpecial ? 'spd' : 'def');
    if (rawAtk == null || rawDef == null) return null;
    // estatística efetiva depois do estágio (o jogo trunca o resultado)
    const atk = Math.max(1, Math.floor(rawAtk * stageMultiplier(atkStage)));
    const def = Math.max(1, Math.floor(rawDef * stageMultiplier(defStage)));
    // fórmula EXATA do jogo (calcDamage em battle54.js): a base tem UM único
    // floor na conta inteira, com o +2 fora do floor; e STAB × efetividade ×
    // aleatório (85–100%) entram todos juntos num único floor no final — NÃO
    // um floor por passo (era isso que dava a imprecisão de ±1–2).
    const base = Math.floor((Math.floor(2 * level / 5) + 2) * power * atk / def / 50) + 2;
    const roll = (randPct) => {
        const d = Math.floor(base * stab * multiplier * randPct / 100);
        return multiplier > 0 ? Math.max(1, d) : 0;
    };
    return { min: roll(85), max: roll(100) };
}

// escolhe a melhor combinação Pokémon+golpe do time contra o oponente atual
// (potência × precisão × eficácia × STAB × ataque) e monta a caixa de destaque
function bestPlay(foe) {
    const defenders = typeNames(foe.types), candidates = [];
    state.party.filter(Boolean).forEach((pokemon, index) => {
        (pokemon.moves || []).forEach((move, moveIndex) => {
            if (Number(move.pp) <= 0 || Number(move.power) <= 0) return;
            const moveType = TYPE_MAPPER[move.type];
            const multiplier = defMultiplier(moveType, defenders);
            const stab = typeNames(pokemon.types).includes(moveType) ? 1.5 : 1;
            const attack = move.category === 'special' ? Number(pokemon.stats?.spa || 1) : Number(pokemon.stats?.atk || 1);
            candidates.push({ pokemon, index, move, moveIndex, moveType, multiplier, score:Number(move.power) * (Number(move.accuracy) || 100) / 100 * multiplier * stab * attack });
        });
    });

    // fallback: se os dados de time sincronizados não trazem golpe com poder
    // pro Pokémon que está de fato em campo agora (acontece em algumas lutas),
    // usa o moveset real desta luta (state.moves — mesma fonte de SEUS GOLPES,
    // que sempre reflete o Pokémon ativo corretamente) pra a caixa não sumir.
    const activePokemon = resolveActivePokemon();
    if (activePokemon && !candidates.some((c) => c.pokemon === activePokemon)) {
        const activeIndex = state.party.indexOf(activePokemon);
        state.moves.forEach((move, moveIndex) => {
            const slug = resolveMoveSlug(move.name);
            const details = MOVE_DETAILS[slug];
            const moveType = MOVE_TYPES[slug];
            if (!details || !moveType || Number(move.pp) <= 0 || Number(details.power) <= 0) return;
            const multiplier = defMultiplier(moveType, defenders);
            const stab = typeNames(activePokemon.types).includes(moveType) ? 1.5 : 1;
            const attack = details.category === 'special' ? Number(activePokemon.stats?.spa || 1) : Number(activePokemon.stats?.atk || 1);
            candidates.push({
                pokemon: activePokemon, index: activeIndex,
                move: { name: move.name, power: details.power, accuracy: details.accuracy, category: details.category },
                moveIndex, moveType, multiplier,
                score: Number(details.power) * (Number(details.accuracy) || 100) / 100 * multiplier * stab * attack
            });
        });
    }

    candidates.sort((left, right) => right.score - left.score);
    const best = candidates[0];
    if (!best) return '';
    const moveType = best.moveType;
    const hasStab = typeNames(best.pokemon.types).includes(moveType);
    const typeBg = PokemonPixelIcons.typeColor(moveType);
    const fg = PokemonPixelIcons.onColor(typeBg);
    const multBadge = best.multiplier !== 1
        ? `<span class="best-badge ${multClass(best.multiplier)}" data-tip="${best.multiplier > 1 ? 'Super eficaz' : 'Pouco eficaz'} contra o oponente.">${multLabel(best.multiplier)}</span>`
        : '';

    // atributos alterados no dano exibido: o estágio defensivo dele vale sempre
    // (ele continua em campo); o seu estágio ofensivo só se a jogada for com o
    // Pokémon que já está ativo (trocar zera os stages do que entra).
    const isSpecial = best.move.category === 'special';
    const defStage = Number(state.stages.foe[isSpecial ? 'spd' : 'def'] || 0);
    const bestIsActive = best.pokemon === resolveActivePokemon();
    const atkStage = bestIsActive ? Number(state.stages.you[isSpecial ? 'spa' : 'atk'] || 0) : 0;
    const dmg = estimateDamage(best.pokemon, best.move, foe, best.multiplier, hasStab ? 1.5 : 1, atkStage, defStage);
    const foeHp = Number(foe.hp) || 0;
    let koBadge = '';
    if (dmg && foeHp > 0) {
        if (dmg.min >= foeHp) {
            koBadge = `<span class="best-badge badge-ko" data-tip="Dano estimado: ${dmg.min}–${dmg.max} (HP dele: ${foeHp}). Mesmo no pior caso da variação aleatória, esse golpe nocauteia.">💀 OHKO</span>`;
        } else if (dmg.max >= foeHp) {
            koBadge = `<span class="best-badge badge-ko-maybe" data-tip="Dano estimado: ${dmg.min}–${dmg.max} (HP dele: ${foeHp}). Pode nocautear dependendo da variação aleatória do jogo, mas não é garantido.">⚡ OHKO?</span>`;
        }
    }

    return `<div class="section"><div class="section-head"><span class="px-label">MELHOR JOGADA</span>${PokemonHelperTooltip.iconHTML('Melhor combinação de Pokémon e golpe do seu time contra este oponente (potência × precisão × eficácia × STAB × ataque).')}</div>
        <div class="best-two">
            <div class="best-r1"><span class="best-star" data-tip="Pokémon do seu time recomendado (slot ${best.index + 1}).">★</span> ${escapeHtml(best.pokemon.name || best.pokemon.species)}·${best.index + 1}</div>
            <div class="best-r2">
                <span class="type-tag" style="background:${typeBg};color:${fg}" data-tip="${escapeHtml(best.move.name)} está no slot ${best.moveIndex + 1} de golpes">
                    <span class="abbr">${escapeHtml(best.move.name)}</span><span class="slot-num" style="color:${fg}">${best.moveIndex + 1}</span>
                </span>
                ${koBadge}${multBadge}
            </div>
        </div>
    </div>`;
}

// destaca, dentre os golpes disponíveis do Pokémon ativo agora, qual causa
// mais dano estimado neste oponente (mesmo cálculo de score do bestPlay, mas
// restrito ao Pokémon que já está em campo — não ao time inteiro)
function renderMyMoves(foe) {
    const activePokemon = resolveActivePokemon();
    const defenders = typeNames(foe.types);
    const foeHp = Number(foe.hp) || 0;
    let bestSlug = null, bestScore = 0;
    const scored = state.moves.map((move) => {
        const slug = resolveMoveSlug(move.name);
        const details = MOVE_DETAILS[slug];
        const moveType = MOVE_TYPES[slug];
        let score = -1;
        let dmgChip = '';
        if (details && moveType && Number(move.pp) > 0 && Number(details.power) > 0) {
            const multiplier = defMultiplier(moveType, defenders);
            const isSpecial = details.category === 'special';
            const stab = activePokemon ? (typeNames(activePokemon.types).includes(moveType) ? 1.5 : 1) : 1;
            // atributos alterados: você ataca → seu estágio ofensivo (atk/spa) e
            // o estágio defensivo dele (def/spd). Stages só valem pro Pokémon
            // ativo (eles zeram ao trocar); state.stages guarda os dois lados.
            const atkStage = activePokemon ? Number(state.stages.you[isSpecial ? 'spa' : 'atk'] || 0) : 0;
            const defStage = Number(state.stages.foe[isSpecial ? 'spd' : 'def'] || 0);

            // dano estimado por golpe: só dá pra calcular com o Pokémon ativo
            // resolvido e com os stats de defesa dele (ao vivo ou da Pokédex)
            const dmg = activePokemon
                ? estimateDamage(activePokemon, { power: details.power, category: details.category }, foe, multiplier, stab, atkStage, defStage)
                : null;
            if (dmg) {
                // ordena pela estimativa de dano de verdade (já com stages)
                score = dmg.max;
                if (score > bestScore) { bestScore = score; bestSlug = slug; }
                const pct = foeHp > 0 ? Math.round(dmg.max / foeHp * 100) : null;
                let cls = 'dmg-normal', prefix = '';
                if (foeHp > 0 && dmg.min >= foeHp) { cls = 'dmg-ko'; prefix = '💀 '; }
                else if (foeHp > 0 && dmg.max >= foeHp) { cls = 'dmg-maybe'; prefix = '⚡ '; }
                const tipParts = [`Dano estimado: ${dmg.min}–${dmg.max}`];
                if (foeHp > 0) tipParts.push(`HP dele: ${foeHp}${pct != null ? ` (até ${pct}%)` : ''}`);
                if (atkStage || defStage) tipParts.push('inclui atributos alterados');
                if (cls === 'dmg-ko') tipParts.push('Mesmo no pior caso, deve nocautear.');
                else if (cls === 'dmg-maybe') tipParts.push('Pode nocautear, mas não é garantido.');
                dmgChip = `<span class="move-dmg ${cls}" data-tip="${tipParts.join(' · ')}">${prefix}${dmg.min}–${dmg.max}</span>`;
            } else {
                // sem dano estimável (sem Pokémon ativo ou sem defesa dele):
                // ordena por potência × eficácia e não mostra número
                score = Number(details.power) * multiplier * stab;
                if (score > bestScore) { bestScore = score; bestSlug = slug; }
            }
        }
        return { move, slug, dmgChip };
    });
    const rows = scored.map(({ move, slug, dmgChip }) => {
        const isBest = bestSlug !== null && slug === bestSlug;
        return `<div class="row${isBest ? ' row-best' : ''}">
            <span class="label">${isBest ? '<span class="best-star" data-tip="Melhor golpe disponível agora contra esse oponente.">★</span> ' : ''}${escapeHtml(move.name)}</span>
            <span class="value">${dmgChip}<span class="move-pp-mine">${move.pp} PP</span></span>
        </div>`;
    }).join('');
    return `<div class="section"><div class="section-head"><span class="px-label">SEUS GOLPES</span></div><div class="rows">${rows}</div></div>`;
}

const KNOWN_EVENT_TYPES = ['stat_change', 'capture_result', 'battle_end'];
const slugifyMoveName = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// alguns golpes vêm do jogo como palavra única (THUNDERPUNCH, DYNAMICPUNCH,
// SELFDESTRUCT) mas a base (PokeAPI) usa a forma com separador (thunder_punch,
// self_destruct). Este índice mapeia a forma "colada" (sem _) pra chave real,
// e resolveMoveSlug tenta o slug direto e, se falhar, a forma colada — assim
// esses golpes voltam a ter tipo/detalhes (e entram no dano/ranking).
const MOVE_SLUG_BY_JOINED = new Map(Object.keys(MOVE_TYPES).map((key) => [key.replace(/_/g, ''), key]));
function resolveMoveSlug(name) {
    const slug = slugifyMoveName(name);
    if (MOVE_TYPES[slug]) return slug;
    return MOVE_SLUG_BY_JOINED.get(slug.replace(/_/g, '')) || slug;
}

// não sabemos o nome exato do campo que carrega o golpe usado num evento de
// batalha (o jogo não documenta isso), então procuramos em qualquer campo de
// texto do evento por algo que bata com um golpe conhecido (data/move-types.js)
function findRevealedMoveSlug(event) {
    for (const key of ['move', 'moveSlug', 'slug', 'name', 'moveName']) {
        const slug = resolveMoveSlug(event[key]);
        if (MOVE_TYPES[slug]) return slug;
    }
    for (const value of Object.values(event)) {
        if (typeof value !== 'string') continue;
        const slug = resolveMoveSlug(value);
        if (MOVE_TYPES[slug]) return slug;
    }
    return null;
}

function applyEvents(events) {
    (events || []).forEach((event) => {
        if (event.t === 'stat_change' && state.stages[event.side]) {
            const current = Number(state.stages[event.side][event.stat] || 0);
            state.stages[event.side][event.stat] = Math.max(-6, Math.min(6, current + Number(event.delta || 0)));
        }
        if (event.t === 'capture_result' && event.caught === true) state.caught = true;
        if (event.t === 'battle_end' && event.outcome === 'caught') state.caught = true;

        // segue a mesma convenção já usada em stat_change (side: 'you'|'foe')
        // pra achar golpes que o oponente revelou usando em combate
        if (event.side === 'foe') {
            const slug = findRevealedMoveSlug(event);
            if (slug) {
                // conta toda vez que o golpe é usado (não só a primeira) pra
                // estimar o PP restante — diferente de recordDiscoveredMove,
                // que só grava a primeira vez (é uma lista, não um contador)
                state.foeMoveUses[slug] = (state.foeMoveUses[slug] || 0) + 1;
                recordDiscoveredMove(slug);
            }
        } else if (event.t && !KNOWN_EVENT_TYPES.includes(event.t)) {
            console.debug('[Infinity Dex Helper] evento de batalha não mapeado (ajuda a calibrar a detecção de golpes):', event);
        }
    });
}

function decrementUsedBall(request) {
    const action = request?.action;
    if (action?.type !== 'item' || !PokemonCatchRate.isBall(action.slug)) return;
    const slug = PokemonCatchRate.normalizeSlug(action.slug);
    const matchingKey = Object.keys(state.bag).find((key) => PokemonCatchRate.normalizeSlug(key) === slug) || slug;
    state.bag[matchingKey] = Math.max(0, Number(state.bag[matchingKey] || 0) - 1);
}

function updateBattle(data) {
    if (Array.isArray(data?.party)) state.party = data.party;
    if (data?.bag && typeof data.bag === 'object') state.bag = { ...data.bag };
    if (!data?.foe && !data?.state?.foe?.mon && !data?.battleId && !data?.__pokemonHelperRequest) return;

    const requestBattleId = data.__pokemonHelperRequest?.battleId;
    const incomingBattleId = data.battleId || requestBattleId;
    if (data.foe && (!state.foe || (incomingBattleId && incomingBattleId !== state.battleId))) resetBattle(incomingBattleId);
    if (incomingBattleId) state.battleId = incomingBattleId;
    if (data.kind) state.kind = data.kind;
    if (Array.isArray(data.foeParty)) state.foeParty = data.foeParty.map((pokemon) => ({ ...pokemon }));
    if (data.foe) state.foe = { ...data.foe };

    const battleState = data.state;
    if (battleState) {
        const foeActive = Number(battleState.foe?.active ?? state.active.foe ?? 0);
        const youActive = Number(battleState.you?.active ?? state.active.you ?? 0);
        if (state.active.foe !== null && foeActive !== state.active.foe) { state.stages.foe = {}; state.foeMoveUses = {}; }
        if (state.active.you !== null && youActive !== state.active.you) state.stages.you = {};
        state.active = { foe:foeActive, you:youActive };
        const activeMon = battleState.foe?.mon;
        if (activeMon) {
            const detailed = state.foeParty[foeActive] || {};
            const sameSpecies = normalizeSpecies(state.foe?.species) === normalizeSpecies(activeMon.species);
            state.foe = { ...(sameSpecies ? state.foe : {}), ...detailed, ...activeMon };
            state.foeParty[foeActive] = { ...detailed, ...state.foe };
        }
        // dados ao vivo do SEU Pokémon ativo (simétrico ao foe.mon). Serve de
        // fonte pro dano estimado quando o time (state.party) ainda não foi
        // sincronizado nesta sessão — sem isso o dano não aparece.
        const youMon = battleState.you?.mon;
        if (youMon && (youMon.stats || youMon.species || youMon.name)) state.youMon = { ...youMon };
        state.turn = Number(battleState.turn || state.turn);
        state.over = battleState.over === true;
        if (battleState.outcome === 'caught') state.caught = true;
    }

    const allowed = data.next?.allowed;
    if (allowed && !Array.isArray(allowed)) {
        if (Array.isArray(allowed.moves)) state.moves = allowed.moves;
        if (typeof allowed.canCatch === 'boolean') state.canCatch = allowed.canCatch;
    } else if (data.next && data.next.phase !== 'choose') {
        state.moves = [];
    }
    applyEvents(data.events);
    decrementUsedBall(data.__pokemonHelperRequest);
}

const STAGE_LABELS = { hp:'HP',atk:'ATK',def:'DEF',spa:'SPA',spd:'SPD',spe:'SPE',accuracy:'Precisão',evasion:'Evasão' };
function renderStages() {
    const sections = [['you','SEUS ATRIBUTOS ALTERADOS'], ['foe','ATRIBUTOS ALTERADOS DO OPONENTE']];
    return sections.map(([side,title]) => {
        const values = Object.entries(state.stages[side]).filter(([,value]) => Number(value) !== 0);
        if (!values.length) return '';
        return `<div class="section"><div class="section-head"><span class="px-label">${title}</span></div><div class="rows">` +
            values.map(([key,value]) => row(STAGE_LABELS[key] || escapeHtml(key), `<span class="stage ${value > 0 ? 'up' : 'down'}">${value > 0 ? '+' : ''}${value}</span>`)).join('') +
            '</div></div>';
    }).join('');
}

function groupByValue(entries) {
    const groups = new Map();
    entries.forEach(({ combo, value }) => {
        if (!groups.has(value)) groups.set(value, []);
        groups.get(value).push(combo);
    });
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

const moveLabel = (slug) => slug.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

// o jogo não revela o moveset do oponente na batalha, então inferimos os golpes
// prováveis a partir do learnset por nível da Pokédex (data/move-types.js dá o
// tipo de cada golpe) — pegamos os golpes de nível <= nível atual e ficamos com
// os 4 aprendidos mais recentemente, como faria um Pokémon selvagem/treinador real.
function probableMoves(foe) {
    const entry = pokedexBySlug.get(normalizeSpecies(foe.species || foe.name));
    const level = Number(foe.level) || 0;
    const learned = (entry?.levelMoves || [])
        .filter((move) => move.lv <= level && MOVE_TYPES[move.slug])
        .sort((a, b) => a.lv - b.lv);
    const uniqueBySlug = new Map(learned.map((move) => [move.slug, move]));
    return [...uniqueBySlug.values()].slice(-4).map((move) => ({ slug: move.slug, type: MOVE_TYPES[move.slug] }));
}

function movesWithTypes(slugs) {
    return slugs.map((slug) => ({ slug, type: MOVE_TYPES[slug] })).filter((move) => move.type);
}

// moveset real de um treinador da wiki (data/trainer-moves.js), casando por
// espécie+nível — bem mais confiável que a heurística de nível quando existe.
function trainerMovesFor(foe) {
    const key = `${normalizeSpecies(foe.species || foe.name)}|${Number(foe.level)}`;
    return trainerMovesByKey.get(key) || null;
}

// identifica um "oponente recorrente" por espécie+nível (o jogo não expõe
// id/nome de treinador nem um identificador de mapa confiável, então essa é a
// melhor aproximação disponível — pode confundir dois treinadores diferentes
// com o mesmo Pokémon no mesmo nível, mas é o que dá pra fazer sem esse dado).
function discoveryKey(species, level) {
    return `${normalizeSpecies(species)}|${Number(level)}`;
}

function discoveredMovesFor(foe) {
    return discoveredMovesByKey.get(discoveryKey(foe.species || foe.name, foe.level)) || null;
}

// golpe visto de fato num turno de batalha: guarda permanentemente vinculado
// a esse oponente recorrente (espécie+nível), mesmo que a luta atual seja
// perdida — na próxima vez que ele aparecer, já mostramos o que já vimos.
function recordDiscoveredMove(slug) {
    if (!state.foe || !MOVE_TYPES[slug]) return;
    const key = discoveryKey(state.foe.species || state.foe.name, state.foe.level);
    const existing = discoveredMovesByKey.get(key) || [];
    if (existing.includes(slug)) return;
    discoveredMovesByKey.set(key, [...existing, slug]);
    saveDiscoveredMoves();
    render();
}

// resolve os golpes do oponente mesclando as fontes (dedupe por slug, máx. 4):
// 1) golpes já vistos em batalhas anteriores contra esse mesmo oponente recorrente;
// 2) moveset exato de treinador (quando é batalha de treinador e casa espécie+nível);
// 3) heurística por nível (fallback pra selvagens/sem dados de treinador).
// Cada golpe carrega sua origem — confirmados ganham selo VISTO na renderização.
// Mesclar (em vez de substituir pela fonte de maior prioridade) garante que a
// lista nunca encolhe no meio da luta quando um golpe é confirmado.
function resolveFoeMoves(foe) {
    const discovered = discoveredMovesFor(foe) || [];
    const merged = [];
    const seen = new Set();
    const push = (moves, source) => moves.forEach((move) => {
        if (merged.length >= 4 || seen.has(move.slug)) return;
        seen.add(move.slug);
        merged.push({ ...move, source });
    });
    push(movesWithTypes(discovered), 'discovered');
    if (state.kind === 'trainer') push(movesWithTypes(trainerMovesFor(foe) || []), 'trainer');
    push(probableMoves(foe), 'heuristic');
    return { moves: merged, seenCount: merged.filter((move) => move.source === 'discovered').length };
}

const MOVE_SOURCE_LABELS = {
    discovered: 'Visto em batalhas anteriores contra esse mesmo oponente.',
    trainer: 'Confirmado: moveset exato desse treinador, vindo da wiki.',
    heuristic: 'Estimado pelo nível do Pokémon — ainda sem dados exatos.'
};

// texto do ⓘ do cabeçalho GOLPES DELE: fonte única usa o rótulo existente;
// lista mista enumera só as fontes realmente presentes
function foeMovesHint(resolved) {
    const sources = new Set(resolved.moves.map((move) => move.source));
    if (sources.size <= 1) return MOVE_SOURCE_LABELS[resolved.moves[0]?.source] || '';
    const parts = [];
    if (sources.has('discovered')) parts.push(`${resolved.seenCount} confirmado(s) em batalha (selo VISTO)`);
    if (sources.has('trainer')) parts.push('moveset do treinador (wiki)');
    if (sources.has('heuristic')) parts.push('estimados pelo nível');
    return `Mistura de fontes: ${parts.join(' + ')}.`;
}

// avisa quando os golpes conhecidos do oponente estão perto de acabar o PP
// (ele seria forçado a usar Impasse/Struggle). Só entra na conta golpe com
// PP máximo conhecido (data/move-details.js) — golpes nunca usados sempre
// estão com PP cheio, então isso só dispara quando o uso real foi detectado.
function foeStrugglingSoon(resolved) {
    const known = resolved.moves.filter((move) => MOVE_DETAILS[move.slug]?.pp != null);
    if (!known.length) return null;
    const totalRemaining = known.reduce((sum, move) => {
        const details = MOVE_DETAILS[move.slug];
        const used = state.foeMoveUses[move.slug] || 0;
        return sum + Math.max(0, details.pp - used);
    }, 0);
    if (totalRemaining === 0) return 'out';
    if (totalRemaining <= 3) return 'low';
    return null;
}

const MOVE_CATEGORY_LABELS = { physical: 'Físico', special: 'Especial', status: 'Status' };

// tooltip nativo (title) com poder/precisão/PP/categoria/efeito — dados vêm
// de data/move-details.js (PokeAPI); texto de efeito fica em inglês porque
// não há tradução oficial disponível.
function moveTooltip(slug) {
    const details = MOVE_DETAILS[slug];
    if (!details) return moveLabel(slug);
    const category = MOVE_CATEGORY_LABELS[details.category] || details.category || '?';
    const power = details.power ?? '—';
    const accuracy = details.accuracy != null ? `${details.accuracy}%` : '—';
    const pp = details.pp ?? '—';
    const lines = [moveLabel(slug), `Categoria: ${category}`, `Poder: ${power} · Precisão: ${accuracy} · PP: ${pp}`];
    if (details.effect) lines.push(details.effect);
    return lines.join('\n');
}

// tipos que causam dano extra no oponente (resistências/imunidades ficam de fora)
function renderWeaknesses(foe) {
    const foeTypes = typeNames(foe.types);
    if (!foeTypes.length) return '';
    const weak = TYPES
        .map((type) => ({ type, value: defMultiplier(type, foeTypes) }))
        .filter((entry) => entry.value > 1)
        .sort((a, b) => b.value - a.value);
    if (!weak.length) return '';
    const chips = weak.map(({ type, value }) =>
        typeTagHTML(type, { title: `${LABELS[type]} causa ${multLabel(value)} de dano nele.` })).join('');
    return `<div class="section">
        <div class="section-head"><span class="px-label">FRAQUEZAS DELE</span>${PokemonHelperTooltip.iconHTML('Tipos que causam dano extra nele. Resistências e imunidades ficam de fora.')}</div>
        <div class="chip-row">${chips}</div>
    </div>`;
}

// pior caso contra o meu time: maior multiplicador desse golpe contra
// qualquer Pokémon do meu time
function moveWorstCase(moveType) {
    const values = state.party.filter(Boolean).map((pokemon) => defMultiplier(moveType, typeNames(pokemon.types)));
    return values.length ? Math.max(...values) : null;
}

function renderFoeMoves(foe) {
    const resolved = resolveFoeMoves(foe);
    if (!resolved.moves.length) return '';
    const sourceHint = foeMovesHint(resolved);
    const items = resolved.moves.map((move) => {
        const isStatus = STATUS_MOVES.has(move.slug);
        const worst = isStatus ? null : moveWorstCase(move.type);
        const multChip = worst === null
            ? '<span class="move-mult mult-1">—</span>'
            : `<span class="move-mult ${multClass(worst)}" data-tip="Pior caso contra o seu time.">${multLabel(worst)}</span>`;
        const details = MOVE_DETAILS[move.slug];
        // PP restante é uma estimativa: só contamos usos vistos NESTA troca do
        // oponente (foeMoveUses zera ao trocar de Pokémon) a partir do PP máximo
        // da wiki — se o golpe nunca foi visto sendo usado, mostra o PP cheio.
        const used = state.foeMoveUses[move.slug] || 0;
        const ppLabel = details?.pp == null
            ? '—'
            : used > 0
                ? `${Math.max(0, details.pp - used)}/${details.pp} PP`
                : `${details.pp} PP`;
        const ppEmpty = details?.pp != null && used >= details.pp;
        return `<div class="row foe-row" data-tip="${escapeHtml(moveTooltip(move.slug))}">
                <span class="label">${escapeHtml(moveLabel(move.slug))}${move.source === 'discovered' ? '<span class="move-seen" data-tip="Golpe confirmado: visto em batalha contra esse oponente.">VISTO</span>' : ''}</span>
                <span class="value">${multChip}<span class="move-pp-mine${ppEmpty ? ' pp-empty' : ''}">${ppLabel}</span></span>
            </div>`;
    }).join('');
    const struggleStatus = foeStrugglingSoon(resolved);
    const ppWarning = struggleStatus === 'out'
        ? `<div class="pp-warning pp-warning-out" data-tip="Todos os golpes conhecidos dele estão sem PP — ele deve usar Impasse (Struggle) e se ferir a cada turno.">🚨 SEM PP — VAI USAR IMPASSE</div>`
        : struggleStatus === 'low'
            ? `<div class="pp-warning pp-warning-low" data-tip="Restam poucos PP entre os golpes conhecidos dele — pode ficar sem PP em breve.">⚠️ QUASE SEM PP</div>`
            : '';
    return `<div class="section">
        <div class="section-head"><span class="px-label">GOLPES DELE</span>${PokemonHelperTooltip.iconHTML(sourceHint)}</div>
        ${ppWarning}
        <div class="rows">${items}</div>
    </div>`;
}

function renderEffRows(moveType) {
    const entries = TYPES.map((type) => ({ combo: [type], value: defMultiplier(moveType, [type]) }));
    const groups = groupByValue(entries).filter(([value]) => value !== 1);
    if (!groups.length) return '<div class="status-note">Sem interação especial.</div>';
    return groups.map(([value, combos]) =>
        `<div class="eff-row"><span class="eff-mult ${multClass(value)}">${multLabel(value)}</span>` +
        `<span class="eff-types">${combos.map((combo) => typeTagHTML(combo, { stack: true })).join('')}</span></div>`
    ).join('');
}

function renderBalls(foe) {
    if (!state.canCatch || state.kind === 'trainer') return '';
    const pokedex = pokedexBySlug.get(normalizeSpecies(foe.species || foe.name));
    const catchRate = Number(pokedex?.catchRate);
    const context = { types:typeNames(foe.types), level:foe.level, turn:state.turn };
    const balls = Object.entries(state.bag).map(([slug,quantity]) => ({ slug:PokemonCatchRate.normalizeSlug(slug), quantity:Number(quantity || 0) })).filter((item) => PokemonCatchRate.isBall(item.slug) && item.quantity > 0);
    if (!balls.length) return '';
    return `<div class="section"><div class="section-head"><span class="px-label">POKÉBOLAS</span>${PokemonHelperTooltip.iconHTML('Chance de captura pela fórmula clássica de Gen III/IV — a MESMA que o InfinityMMO usa (confirmado pelo desenvolvedor). Só a Master Ball é 100% garantido; mesmo com HP baixo sobra uma pequena chance de escapar. Pode variar um pouco se o catchRate da espécie no servidor diferir da wiki.')}</span></div><div class="rows">` +
        balls.map((ball) => {
            const definition = PokemonCatchRate.BALLS[ball.slug];
            const chance = PokemonCatchRate.chance({ hp:foe.hp, maxHp:foe.maxHp, catchRate, status:foe.status, ballMultiplier:PokemonCatchRate.multiplier(ball.slug, context) });
            return row(`${definition.name} ×${ball.quantity}`, `<span class="ball-rate">${chance === null ? '—' : `${chance.toFixed(1)}%`}</span>`);
        }).join('') +
        '</div></div>';
}

// sprite do oponente: mesma arte (PokeAPI dream-world) usada em Meus Pokémon;
// POKEMON_NAME_TO_ID casa por nome de exibição, então tentamos name e species
// (inclusive com _/- viram espaço) antes de cair no placeholder
const SPRITE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/dream-world/';
function foeSpriteId(foe) {
    if (typeof POKEMON_NAME_TO_ID === 'undefined') return null;
    for (const value of [foe.name, foe.species]) {
        if (!value) continue;
        const key = String(value).trim().toLowerCase();
        const id = POKEMON_NAME_TO_ID[key] || POKEMON_NAME_TO_ID[key.replace(/[_-]+/g, ' ')];
        if (id) return id;
    }
    return null;
}

function render() {
    const content = document.getElementById('content'), foe = state.foe;
    if (!foe) { content.innerHTML = '<p class="empty">Nenhum encontro capturado ainda. Entre em uma batalha selvagem.</p>'; return; }
    const stats = foe.stats || {}, ivs = foe.ivs || {}, evaluation = PokemonIvEvaluation.evaluate(foe);
    const foeTypes = typeNames(foe.types);
    const hpPct = foe.maxHp > 0 ? Math.max(0, Math.min(100, foe.hp / foe.maxHp * 100)) : 0;
    const hpLevel = hpPct <= 20 ? 'low' : hpPct <= 50 ? 'mid' : 'high';
    const genderValue = String(foe.gender || '').toLowerCase();
    const gender = ['female', 'f', '♀'].includes(genderValue)
        ? '<span class="enc-gender-f">♀</span>'
        : ['male', 'm', '♂'].includes(genderValue)
            ? '<span class="enc-gender-m">♂</span>'
            : '';

    const spriteId = foeSpriteId(foe);
    const sprite = spriteId
        ? `<img class="enc-sprite" src="${SPRITE_URL}${spriteId}.svg" alt="${escapeHtml(foe.name || foe.species)}">`
        : '<div class="enc-sprite">?</div>';
    const head = `<div class="enc-head">
        ${sprite}
        <div class="enc-id">
            <div class="enc-name-row">
                <span class="enc-name">${escapeHtml(foe.name || foe.species)}</span>
                <span class="enc-level">Lv${foe.level ?? '-'}</span>${gender}
                ${foe.shiny ? '<span class="best-badge badge-stab" data-tip="Shiny!">★</span>' : ''}
            </div>
            <div class="enc-types">${foeTypes.map((type) => typeTagHTML(type)).join('')}</div>
            <div class="enc-hp">
                <div class="enc-hp-track"><div class="enc-hp-fill" data-level="${hpLevel}" style="width:${hpPct}%"></div></div>
                <span class="enc-hp-label">${Number(foe.hp || 0)}/${Number(foe.maxHp || 0)}</span>
            </div>
        </div>
    </div>`;

    const metaCell = (key, value, tip, color) =>
        `<div class="meta-cell" data-tip="${escapeHtml(tip)}"><span class="meta-key">${key}</span><span class="meta-val"${color ? ` style="color:${color}"` : ''}>${value}</span></div>`;
    const meta = `<div class="meta-grid">
        ${metaCell('HABILIDADE', `<span data-ability="${escapeHtml(foe.ability)}">${escapeHtml(PokemonAbilityInfo.label(foe.ability))}</span>`, 'Habilidade do oponente.')}
        ${metaCell('NATUREZA', natureEffectHTML(foe.nature), 'Natureza e atributos afetados.')}
        ${metaCell('ITEM', escapeHtml(foe.heldItem || '—'), foe.heldItem ? 'Item segurado.' : 'Nenhum item detectado neste encontro.', foe.heldItem ? null : 'var(--px-text-dim)')}
        ${metaCell('ATQ PRINCIPAL', evaluation.role, 'Estimado pelo maior stat ofensivo.')}
        ${metaCell('AVALIAÇÃO', PokemonIvEvaluation.html(foe), 'Avaliação combinando IVs, natureza e stats base.')}
        ${metaCell('IVS TOTAL', `${evaluation.percent}%`, 'Percentual dos IVs em relação ao máximo.', ivColor(evaluation.percent * 31 / 100))}
    </div>`;

    const ivsSection = `<div class="section">
        <div class="section-head"><span class="px-label">IVS / STATS</span><span class="head-extra" style="color:${ivColor(evaluation.percent * 31 / 100)}">${evaluation.percent}%</span></div>
        <div class="ivs-grid6">${STAT_KEYS.filter((key) => ivs[key] !== undefined).map((key) => `
            <div class="iv-cell" data-tip="${key.toUpperCase()} — IV ${ivs[key]}/31${stats[key] !== undefined ? ` · stat atual ${stats[key]}` : ''}">
                <span class="iv-key">${key.toUpperCase()}</span>
                <span class="px-bar"><span class="px-bar-fill" style="width:${Math.round(ivs[key] / 31 * 100)}%;background:${ivColor(ivs[key])}"></span></span>
                <span class="iv-num" style="color:${ivColor(ivs[key])}">${ivs[key]}</span>
                ${stats[key] !== undefined ? `<span class="iv-stat">${stats[key]}</span>` : ''}
            </div>`).join('')}</div>
    </div>`;

    // cada seção reordenável mapeia sua chave pra função que devolve o HTML
    // (respeitando os toggles de visibilidade). A ordem vem de SCREEN_PREFS.order,
    // editável em Configurações → BATALHA; cabeçalho + meta ficam sempre no topo.
    const sectionHtml = {
        ivs:        () => (SCREEN_PREFS.showIvs ? ivsSection : ''),
        best:       () => (!state.caught ? bestPlay(foe) : ''),
        weaknesses: () => (SCREEN_PREFS.showWeaknesses ? renderWeaknesses(foe) : ''),
        foeMoves:   () => (SCREEN_PREFS.showFoeMoves ? renderFoeMoves(foe) : ''),
        pokeballs:  () => (SCREEN_PREFS.showPokeballs ? renderBalls(foe) : ''),
        stages:     () => (SCREEN_PREFS.showStatChanges ? renderStages() : ''),
        myMoves:    () => (!state.caught && SCREEN_PREFS.showMyMoves && state.moves.length ? renderMyMoves(foe) : '')
    };
    const order = PokemonHelperStorage.sanitizeBattleOrder(SCREEN_PREFS.order);
    let html = `<div class="enc-screen">` + head + meta;
    order.forEach((key) => { html += sectionHtml[key] ? sectionHtml[key]() : ''; });
    if (state.caught) html += '<div class="gotcha"><span class="gotcha-badge">GOTCHA</span><p>Pokémon capturado</p></div>';
    html += `</div>`;
    content.innerHTML = html;
    // sprite pode não existir no repositório (formas regionais etc.) — volta
    // pro placeholder em vez de mostrar o ícone de imagem quebrada
    content.querySelectorAll('img.enc-sprite').forEach((img) => img.addEventListener('error', () => {
        const fallback = document.createElement('div');
        fallback.className = 'enc-sprite';
        fallback.textContent = '?';
        img.replaceWith(fallback);
    }));
    PokemonAbilityInfo.hydrate(content);
}

async function loadPokedex() {
    try {
        const cached = await PokemonHelperStorage.getPokedex();
        pokedexBySlug = new Map((cached.items || []).map((pokemon) => [normalizeSpecies(pokemon.slug || pokemon.name), pokemon]));
        render();
        chrome.runtime.sendMessage({ type:'pkmn-helper-refresh-pokedex' });
    } catch (error) {
        console.warn('[Infinity Dex Helper] Não foi possível carregar a Pokédex:', error);
    }
}

async function loadTrainerMoves() {
    try {
        const cached = await PokemonHelperStorage.getTrainerMoves();
        trainerMovesByKey = new Map((cached.items || []).map((item) => [`${normalizeSpecies(item.species)}|${item.level}`, item.moves]));
        render();
        chrome.runtime.sendMessage({ type:'pkmn-helper-refresh-trainer-moves' });
    } catch (error) {
        console.warn('[Infinity Dex Helper] Não foi possível carregar golpes de treinadores:', error);
    }
}

async function loadDiscoveredMoves() {
    try {
        const cached = await PokemonHelperStorage.getDiscoveredMoves();
        discoveredMovesByKey = new Map((cached.items || []).map((item) => [discoveryKey(item.species, item.level), item.moves]));
        render();
    } catch (error) {
        console.warn('[Infinity Dex Helper] Não foi possível carregar golpes descobertos:', error);
    }
}

async function saveDiscoveredMoves() {
    try {
        const items = [...discoveredMovesByKey.entries()].map(([key, moves]) => {
            const [species, level] = key.split('|');
            return { species, level: Number(level), moves };
        });
        await PokemonHelperStorage.setDiscoveredMoves({ items });
    } catch (error) {
        console.warn('[Infinity Dex Helper] Não foi possível salvar golpes descobertos:', error);
    }
}

window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'battle-data') return;
    updateBattle(event.data.payload);
    render();
});

document.getElementById('content').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="toggle-move"]');
    if (!btn) return;
    const slug = btn.dataset.slug;
    if (openMoves.has(slug)) openMoves.delete(slug); else openMoves.add(slug);
    render();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes[PokemonHelperStorage.KEYS.pokedex]) {
        const items = changes[PokemonHelperStorage.KEYS.pokedex].newValue?.items || [];
        pokedexBySlug = new Map(items.map((pokemon) => [normalizeSpecies(pokemon.slug || pokemon.name), pokemon]));
        render();
    }
    if (changes[PokemonHelperStorage.KEYS.trainerMoves]) {
        const items = changes[PokemonHelperStorage.KEYS.trainerMoves].newValue?.items || [];
        trainerMovesByKey = new Map(items.map((item) => [`${normalizeSpecies(item.species)}|${item.level}`, item.moves]));
        render();
    }
    if (changes[PokemonHelperStorage.KEYS.discoveredMoves]) {
        const items = changes[PokemonHelperStorage.KEYS.discoveredMoves].newValue?.items || [];
        discoveredMovesByKey = new Map(items.map((item) => [discoveryKey(item.species, item.level), item.moves]));
        render();
    }
});

loadPokedex();
loadTrainerMoves();
loadDiscoveredMoves();
