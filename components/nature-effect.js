// Relação entre cada Nature e os atributos influenciados por ela.
const NATURE_EFFECTS = {
    adamant: { increases: 'ATK', decreases: 'SPA' },
    bashful: { increases: 'SPA', decreases: 'SPA' },
    bold: { increases: 'DEF', decreases: 'ATK' },
    brave: { increases: 'ATK', decreases: 'SPE' },
    calm: { increases: 'SPD', decreases: 'ATK' },
    careful: { increases: 'SPD', decreases: 'SPA' },
    docile: { increases: 'DEF', decreases: 'DEF' },
    gentle: { increases: 'SPD', decreases: 'DEF' },
    hardy: { increases: 'ATK', decreases: 'ATK' },
    hasty: { increases: 'SPE', decreases: 'DEF' },
    impish: { increases: 'DEF', decreases: 'SPA' },
    jolly: { increases: 'SPE', decreases: 'SPA' },
    lax: { increases: 'DEF', decreases: 'SPD' },
    lonely: { increases: 'ATK', decreases: 'DEF' },
    mild: { increases: 'SPA', decreases: 'DEF' },
    modest: { increases: 'SPA', decreases: 'ATK' },
    naive: { increases: 'SPE', decreases: 'SPD' },
    naughty: { increases: 'ATK', decreases: 'SPD' },
    quiet: { increases: 'SPA', decreases: 'SPE' },
    quirky: { increases: 'SPD', decreases: 'SPD' },
    rash: { increases: 'SPA', decreases: 'SPD' },
    relaxed: { increases: 'DEF', decreases: 'SPE' },
    sassy: { increases: 'SPD', decreases: 'SPE' },
    serious: { increases: 'SPE', decreases: 'SPE' },
    timid: { increases: 'SPE', decreases: 'ATK' }
};

const NATURE_NAMES = Object.keys(NATURE_EFFECTS).map((nature) => (
    nature.charAt(0).toUpperCase() + nature.slice(1)
));

function getNatureEffect(nature) {
    if (!nature) return null;
    return NATURE_EFFECTS[String(nature).trim().toLowerCase()] || null;
}

function natureEffectHTML(nature) {
    if (!nature) return '-';

    const effect = getNatureEffect(nature);
    if (!effect) return nature;

    const effectHTML = effect.increases === effect.decreases
        ? '<span class="nature-neutral">Neutra</span>'
        : `<span class="nature-increase">${effect.increases}⬆</span>
           <span class="nature-decrease">${effect.decreases}⬇</span>`;

    return `
        <span class="nature-name">${nature}</span>
        <span class="nature-effects">${effectHTML}</span>
    `;
}
