// ---------------------------------------------------------------------------
// Ícones do design system. Os ícones da barra do cabeçalho (uiIcon) são SVGs
// sólidos — combinam com o traço de tinta grosso do visual "Quadro de Tipos".
// Tipo elemental (typeIcon) usa um quadrado sólido de cor com contorno.
// Também centraliza o contraste automático de texto sobre cores de tipo.
// ---------------------------------------------------------------------------
var PokemonPixelIcons = globalThis.PokemonPixelIcons || (() => {
    // corpo (paths) de cada ícone SVG do cabeçalho, viewBox 0 0 24 24, sólido.
    const UI_SVG = {
        // alvo/mira (anéis concêntricos + retículo) — aba Encontro/Batalha
        enc:  '<path fill-rule="evenodd" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2.6a7.4 7.4 0 110 14.8 7.4 7.4 0 010-14.8zm0 3.9a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"/><path d="M11 0h2v4h-2zM11 20h2v4h-2zM0 11h4v2H0zM20 11h4v2h-4z"/>',
        // pokébola: aro + linha central + botão — Meus Pokémon
        team: '<path d="M12 3a9 9 0 018.94 8H15.7a3.7 3.7 0 00-7.4 0H3.06A9 9 0 0112 3zm0 6.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM3.06 13h5.24a3.7 3.7 0 007.4 0h5.24A9 9 0 013.06 13z"/>',
        // engrenagem clássica com furo central — Configurações
        cfg:  '<path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.61-.22l-2.39.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 00-.61.22L2.74 8.84a.5.5 0 00.12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.14.24.42.34.68.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.26.12.54.02.68-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.6a3.6 3.6 0 110-7.2 3.6 3.6 0 010 7.2z"/>',
        // janela maximizada (moldura + barra de título) — Tabela de tipos (expandir)
        tbl:  '<path d="M3 4h18v16H3V4zm2 4v10h14V8H5z"/>',
        // barra de minimizar — Recolher pra bolha
        min:  '<rect x="5" y="14.5" width="14" height="3" rx="1.5"/>',
        // dispositivo Pokédex: lente redonda + luzes + linhas — aba Pokédex
        dex:  '<path d="M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm4 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM14 6h5v2h-5V6zm0 3.5h5v2h-5v-2zM6 14h12v2H6v-2zm0 3.5h12v2H6v-2z"/>'
    };
    const TYPE_COLORS = {
        normal: '#9a9a80', fire: '#f0803c', water: '#4a90e2', electric: '#f5cd35',
        grass: '#63bb5b', ice: '#7fd6d6', fighting: '#d3425f', poison: '#b763cf',
        ground: '#d9a642', flying: '#8f7fe0', psychic: '#f56a8a', bug: '#92bc2c',
        rock: '#c9b787', ghost: '#7b62a3', dragon: '#5f6fe8', dark: '#6f6880',
        steel: '#8fa5b8', fairy: '#ee90c0'
    };

    // ícone SVG sólido da barra do cabeçalho, na cor pedida
    function uiIcon(name, color, size = 18) {
        const body = UI_SVG[name] || '';
        return `<span class="px-icon" style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;flex:0 0 auto;">` +
            `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" style="display:block;">${body}</svg>` +
            `</span>`;
    }

    function lum(hex) {
        const channel = (i) => {
            const c = parseInt(hex.slice(i, i + 2), 16) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    }
    function ratio(a, b) {
        const x = lum(a), y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    function onColor(bg) {
        return ratio('#0c0c11', bg) >= ratio('#f4f4fa', bg) ? '#0c0c11' : '#f4f4fa';
    }
    function mix(hex, base, amount) {
        const part = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
        const a = part(hex), b = part(base);
        return '#' + a.map((v, i) => Math.round(b[i] + (v - b[i]) * amount).toString(16).padStart(2, '0')).join('');
    }

    // marcador de tipo do visual "Quadro de Tipos": um quadrado sólido de cor,
    // arredondado, com contorno de tinta — sem pontinhos de LCD nem emoji.
    // A cor identifica o tipo; onde há texto ao lado (tabela, cards,
    // filtros) ele complementa. `color` é a cor de preenchimento do marcador.
    function typeIcon(typeKey, color, scale = 2) {
        const size = Math.round(7 * scale * 0.82);
        return `<span class="px-icon" style="display:inline-block;width:${size}px;height:${size}px;border-radius:3px;background:${color};box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.4);flex:0 0 auto;"></span>`;
    }

    return Object.freeze({
        UI_SVG, uiIcon, typeIcon, onColor, mix,
        typeColor: (typeKey) => TYPE_COLORS[typeKey] || '#9a9a80'
    });
})();
globalThis.PokemonPixelIcons = PokemonPixelIcons;
