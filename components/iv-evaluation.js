var PokemonIvEvaluation = globalThis.PokemonIvEvaluation || (() => {
    const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
    const TOOLTIP = 'Avalia Atributos, IVs e Natureza para classificar o Pokemon';
    const clampIv = (value) => Math.min(31, Math.max(0, Number(value) || 0));
    const clampScore = (value) => Math.min(100, Math.max(0, value));

    function roleFor(pokemon) {
        const stats = pokemon?.stats || {};
        const atk = Number(stats.atk ?? pokemon?.atk ?? 0);
        const spa = Number(stats.spa ?? pokemon?.spa ?? 0);
        const neutral = Math.abs(atk - spa) <= Math.max(atk, spa, 1) * 0.1;
        return neutral ? 'Neutro' : atk > spa ? 'Físico' : 'Especial';
    }

    function weightsFor(role) {
        if (role === 'Físico') return { hp: 0.15, atk: 0.45, def: 0.1, spa: 0, spd: 0.1, spe: 0.2 };
        if (role === 'Especial') return { hp: 0.15, atk: 0, def: 0.1, spa: 0.45, spd: 0.1, spe: 0.2 };
        return { hp: 0.15, atk: 0.225, def: 0.1, spa: 0.225, spd: 0.1, spe: 0.2 };
    }

    function natureAdjustment(pokemon, weights) {
        if (typeof getNatureEffect !== 'function') return { points: 0, decreasesPrimary: false };
        const effect = getNatureEffect(pokemon?.nature);
        if (!effect || effect.increases === effect.decreases) return { points: 0, decreasesPrimary: false };
        const increases = String(effect.increases).toLowerCase();
        const decreases = String(effect.decreases).toLowerCase();
        return {
            points: ((weights[increases] || 0) - (weights[decreases] || 0)) * 10,
            decreasesPrimary: (weights[decreases] || 0) >= 0.225
        };
    }

    function evaluate(pokemon) {
        const ivs = Object.fromEntries(STATS.map((stat) => [stat, clampIv(pokemon?.ivs?.[stat])]));
        const role = roleFor(pokemon);
        const primary = role === 'Neutro' ? ['atk', 'spa'] : [role === 'Físico' ? 'atk' : 'spa'];
        const weights = weightsFor(role);
        const average = STATS.reduce((sum, stat) => sum + ivs[stat], 0) / STATS.length;
        const importantQuality = STATS.reduce((sum, stat) => sum + (ivs[stat] / 31) * weights[stat], 0) * 100;
        const ivScore = (average / 31) * 55 + importantQuality * 0.45;
        const nature = natureAdjustment(pokemon, weights);
        const score = Math.round(clampScore(ivScore + nature.points));
        const mainMinimum = Math.min(...primary.map((stat) => ivs[stat]));
        let rating = score < 40 ? 'Ruim' : score < 60 ? 'Médio' : score < 75 ? 'Bom' : score < 90 ? 'Muito bom' : 'Excelente';
        if (mainMinimum <= 5) rating = 'Ruim';
        else if (mainMinimum <= 15 && ['Muito bom', 'Excelente'].includes(rating)) rating = 'Bom';
        else if (nature.decreasesPrimary && rating === 'Excelente') rating = 'Muito bom';
        const percent = Math.round((average / 31) * 100);
        return { rating, role, score, percent, primary, ivs, natureAdjustment: nature.points };
    }

    function ratingSlug(rating) {
        return rating.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    }

    function html(pokemon) {
        const result = evaluate(pokemon);
        return `<span class="iv-rating" data-rating="${ratingSlug(result.rating)}">${result.rating}</span>`;
    }

    function labelHTML() {
        return `Avaliação [BETA] ${PokemonHelperTooltip.iconHTML(TOOLTIP)}`;
    }

    return Object.freeze({ evaluate, html, labelHTML, roleFor });
})();
globalThis.PokemonIvEvaluation = PokemonIvEvaluation;
globalThis.PokemonEvaluation = PokemonIvEvaluation;
