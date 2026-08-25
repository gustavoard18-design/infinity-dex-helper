var PokemonCatchRate = globalThis.PokemonCatchRate || (() => {
    const BALLS = Object.freeze({
        poke_ball: { name: 'Poké Ball', multiplier: 1 },
        great_ball: { name: 'Great Ball', multiplier: 1.5 },
        ultra_ball: { name: 'Ultra Ball', multiplier: 2 },
        master_ball: { name: 'Master Ball', multiplier: 255 },
        safari_ball: { name: 'Safari Ball', multiplier: 1.5 },
        premier_ball: { name: 'Premier Ball', multiplier: 1 },
        luxury_ball: { name: 'Luxury Ball', multiplier: 1 },
        heal_ball: { name: 'Heal Ball', multiplier: 1 },
        net_ball: { name: 'Net Ball', multiplier: 1 },
        nest_ball: { name: 'Nest Ball', multiplier: 1 },
        repeat_ball: { name: 'Repeat Ball', multiplier: 1 },
        timer_ball: { name: 'Timer Ball', multiplier: 1 },
        quick_ball: { name: 'Quick Ball', multiplier: 1 },
        dive_ball: { name: 'Dive Ball', multiplier: 1 },
        dusk_ball: { name: 'Dusk Ball', multiplier: 1 }
    });

    const normalizeSlug = (value) => String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const isBall = (value) => Boolean(BALLS[normalizeSlug(value)]);

    function multiplier(ballSlug, context = {}) {
        const slug = normalizeSlug(ballSlug);
        const foeTypes = (context.types || []).map((type) => String(type).toLowerCase());
        if (slug === 'net_ball' && foeTypes.some((type) => type === 'water' || type === 'bug' || type === 'insect')) return 3.5;
        if (slug === 'nest_ball') return Math.max(1, Math.min(4, (41 - Number(context.level || 1)) / 10));
        if (slug === 'quick_ball') return Number(context.turn || 1) <= 1 ? 5 : 1;
        if (slug === 'timer_ball') return Math.min(4, 1 + Math.max(0, Number(context.turn || 1) - 1) * 0.3);
        return BALLS[slug]?.multiplier || 1;
    }

    function statusMultiplier(status) {
        const value = String(status || '').toLowerCase();
        if (/sleep|asleep|freeze|frozen/.test(value)) return 2;
        if (/poison|burn|paraly/.test(value)) return 1.5;
        return 1;
    }

    function chance({ hp, maxHp, catchRate, ballMultiplier = 1, status }) {
        if (ballMultiplier >= 255) return 100;
        const maximum = Math.max(1, Number(maxHp || 1));
        const current = Math.max(1, Math.min(maximum, Number(hp ?? maximum)));
        const rate = Number(catchRate);
        if (!Number.isFinite(rate) || rate <= 0) return null;
        const value = ((3 * maximum - 2 * current) * rate * ballMultiplier * statusMultiplier(status)) / (3 * maximum);
        if (value <= 0) return 0;
        const shakeThreshold = 1048560 / Math.sqrt(Math.sqrt(16711680 / value));
        const pct = (shakeThreshold / 65536) ** 4 * 100;
        // Só a Master Ball (tratada no topo) é captura 100% garantida. A fórmula
        // clássica dá ~100% pra espécies de catchRate alto com HP baixo, mas o
        // InfinityMMO é mais difícil que o padrão (um Bronzor catchRate 255,
        // dormindo e a 1 de HP, ainda escapou). Então isto é uma ESTIMATIVA e
        // nunca mostramos 100% aqui — no máximo 99,9%.
        return Math.max(0, Math.min(99.9, pct));
    }

    return Object.freeze({ BALLS, normalizeSlug, isBall, multiplier, statusMultiplier, chance });
})();
globalThis.PokemonCatchRate = PokemonCatchRate;
