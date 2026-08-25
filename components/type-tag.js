// ---------------------------------------------------------------------------
// Componente de tipo de Pokémon: dados compartilhados (nomes, abreviações,
// ícones) e o template de tag/pill usado nas telas de tipo (chart, batalha)
// quanto na tela de Meus Pokémons (myPokemons.html).
// ---------------------------------------------------------------------------

const TYPES = [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
    'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

const LABELS = {
    normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico', grass: 'Planta',
    ice: 'Gelo', fighting: 'Lutador', poison: 'Venenoso', ground: 'Terra', flying: 'Voador',
    psychic: 'Psíquico', bug: 'Inseto', rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão',
    dark: 'Sombrio', steel: 'Aço', fairy: 'Fada'
};

// abreviações oficiais de 3 letras (padrão de charts/telas de status dos jogos)
const ABBR = {
    normal: 'NRM', fire: 'FIR', water: 'WTR', electric: 'ELC', grass: 'GRS',
    ice: 'ICE', fighting: 'FGT', poison: 'PSN', ground: 'GRD', flying: 'FLY',
    psychic: 'PSY', bug: 'BUG', rock: 'RCK', ghost: 'GHO', dragon: 'DRG',
    dark: 'DRK', steel: 'STL', fairy: 'FRY'
};

// mapeia o id numérico de tipo usado pelo jogo para a chave de tipo (string)
const TYPE_MAPPER = {
    0: 'normal', 1: 'fighting', 2: 'flying', 3: 'poison', 4: 'ground',
    5: 'rock', 6: 'bug', 7: 'ghost', 8: 'steel', 10: 'fire',
    11: 'water', 12: 'grass', 13: 'electric', 14: 'psychic', 15: 'ice',
    16: 'dragon', 17: 'dark', 18: 'fairy'
};

// opts.colored mantido por compatibilidade (ignorado — o ícone pixel herda a cor)
function typeIconHTML(type, opts = {}) {
    const bg = PokemonPixelIcons.typeColor(type);
    const color = opts.color || (opts.onType ? PokemonPixelIcons.onColor(bg) : bg);
    const title = opts.title ? ` title="${LABELS[type]}"` : '';
    return `<span class="type-icon-px"${title}>${PokemonPixelIcons.typeIcon(type, color)}</span>`;
}

// pílula "Quadro de Tipos": fundo na cor do tipo, texto em negrito na cor de
// maior contraste, sem ícone (o próprio nome/abreviação + a cor identificam o
// tipo). Dois tipos = gradiente 50/50 (contraste calculado pela cor do 1º tipo).
function typeTagHTML(types, opts = {}) {
    if (!Array.isArray(types)) types = [types];
    const stacked = !!opts.stack;
    const dict = ABBR; // v2 sempre abrevia (o nome completo vive no tooltip)
    const cls = `type-tag${stacked ? ' mini' : ''}`;
    const background = types.length === 2
        ? `linear-gradient(135deg, var(--t-${types[0]}) 50%, var(--t-${types[1]}) 50%)`
        : `var(--t-${types[0]})`;
    const fg = PokemonPixelIcons.onColor(PokemonPixelIcons.typeColor(types[0]));
    const title = opts.title ?? types.map((type) => LABELS[type]).join(' / ');
    // pílula de tipo único (encontro, fraquezas) usa o nome completo em caixa
    // alta, como no mockup; combinações de 2 tipos e chips empilhados (grades
    // densas: tabela, cards, batalha) ficam com a abreviação de 3 letras.
    const label = opts.label ?? (
        (!stacked && types.length === 1)
            ? LABELS[types[0]].toUpperCase()
            : types.map((type) => dict[type]).join('/')
    );
    return `<span class="${cls}" style="background:${background};color:${fg}" data-tip="${title}">` +
        `<span class="abbr">${label}</span>` +
        `</span>`;
}
