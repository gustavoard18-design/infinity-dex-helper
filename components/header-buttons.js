// ---------------------------------------------------------------------------
// Barra de abas do overlay (content.js): botões com ícone SVG sólido
// (encontro / meus pokémons / pokédex / config) + expandir + minimizar.
// ---------------------------------------------------------------------------

// cor dos ícones do cabeçalho. Definida DENTRO das funções (não no topo do
// arquivo) de propósito: este script é reinjetado a cada toggle/reabertura, e
// um `const` no topo estouraria "already declared" na 2ª injeção.
function headerIconColor() { return '#1a1a1a'; }

// items: [{ icon: chave de PokemonPixelIcons.UI_SVG, tip, view }]
function buildHeaderButtons(header, items, collapseItem, maximizeItem = { tip: 'Expandir — F' }) {
    const HEADER_ICON_COLOR = headerIconColor();
    items.forEach((item) => {
        const btn = document.createElement('button');
        btn.className = 'ph-icon-btn ph-view-btn';
        btn.dataset.view = item.view;
        btn.dataset.icon = item.icon;
        btn.dataset.tip = item.tip;
        btn.innerHTML = PokemonPixelIcons.uiIcon(item.icon, HEADER_ICON_COLOR);
        header.appendChild(btn);
    });

    const spacer = document.createElement('div');
    spacer.className = 'ph-spacer';
    header.appendChild(spacer);

    const maximizeBtn = document.createElement('button');
    maximizeBtn.className = 'ph-icon-btn ph-maximize-btn';
    maximizeBtn.dataset.tip = maximizeItem.tip;
    maximizeBtn.innerHTML = PokemonPixelIcons.uiIcon('tbl', HEADER_ICON_COLOR);
    header.appendChild(maximizeBtn);

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'ph-icon-btn ph-collapse-btn';
    collapseBtn.dataset.tip = collapseItem.tip;
    collapseBtn.innerHTML = PokemonPixelIcons.uiIcon('min', HEADER_ICON_COLOR);
    header.appendChild(collapseBtn);

    return { collapseBtn, maximizeBtn };
}

// repinta os ícones conforme a view ativa (chamado por setActiveView)
function paintHeaderButtons(container, activeView) {
    const HEADER_ICON_COLOR = headerIconColor();
    container.querySelectorAll('.ph-view-btn').forEach((btn) => {
        const active = btn.dataset.view === activeView;
        btn.classList.toggle('active', active);
        btn.innerHTML = PokemonPixelIcons.uiIcon(btn.dataset.icon, HEADER_ICON_COLOR);
    });
}
