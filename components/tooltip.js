// ---------------------------------------------------------------------------
// Tooltip global do design system v2: caixa fixa exibida junto de qualquer
// elemento com data-tip, por delegação de eventos. Respeita a preferência
// tooltipsEnabled (Configurações) e reage a mudanças dela em tempo real.
// Injeta o próprio <style> pra funcionar tanto nos iframes quanto no shell.
// A caixa nunca sai da viewport: clampa na horizontal e vira pra cima quando
// não há espaço abaixo do elemento.
// iconHTML() é o marcador ⓘ padrão — todo tooltip com ícone deve usá-lo.
// ---------------------------------------------------------------------------
var PokemonHelperTooltip = globalThis.PokemonHelperTooltip || (() => {
    let enabled = true;

    PokemonHelperStorage.getUiPreferences()
        .then((preferences) => { enabled = preferences.tooltipsEnabled; })
        .catch(() => {});
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
            enabled = changes[PokemonHelperStorage.KEYS.uiPreferences].newValue?.tooltipsEnabled !== false;
        });
    }

    const escapeHtml = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

    function iconHTML(text) {
        return `<span class="px-tip-icon" tabindex="0" role="img" aria-label="${escapeHtml(text)}" data-tip="${escapeHtml(text)}">ⓘ</span>`;
    }

    function ensureStyle(doc) {
        if (doc.getElementById('px-tooltip-style')) return;
        const style = doc.createElement('style');
        style.id = 'px-tooltip-style';
        style.textContent = `
            #px-tooltip {
                position: fixed; z-index: 2147483647; max-width: 260px;
                padding: 6px 9px; background: #1a1a1a; border: 2px solid #1a1a1a;
                border-radius: var(--px-radius-sm, 6px);
                box-shadow: 0 4px 12px rgba(0,0,0,.3);
                font-family: var(--px-font-mono, sans-serif); font-size: 12px; font-weight: 600; line-height: 1.35;
                color: #faf7ef; pointer-events: none; display: none; white-space: pre-line;
            }
            .px-tip-icon { color: var(--px-info, #e3350d); cursor: help; outline: none; }`;
        doc.head.appendChild(style);
    }

    function ensureBox(doc) {
        let box = doc.getElementById('px-tooltip');
        if (box) return box;
        ensureStyle(doc);
        box = doc.createElement('div');
        box.id = 'px-tooltip';
        // appendado no <html>, não no <body>: no content script do jogo o
        // overlay do painel (#pokemon-type-matchup-overlay) também é filho de
        // documentElement com o mesmo z-index — em empate, quem vem depois na
        // ordem do DOM pinta por cima, e o body normalmente vem antes.
        doc.documentElement.appendChild(box);
        return box;
    }

    function position(box, rect, win) {
        // zera a posição antes de medir: um left herdado perto da borda direita
        // comprimiria a caixa (shrink-to-fit) e a medida sairia errada
        box.style.left = '0px';
        box.style.top = '0px';
        const width = box.offsetWidth, height = box.offsetHeight;
        const left = Math.max(4, Math.min(rect.left, win.innerWidth - width - 4));
        let top = rect.bottom + 5;
        if (top + height > win.innerHeight - 4) top = Math.max(4, rect.top - height - 5);
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
    }

    function attach(doc) {
        if (doc.__pxTooltipAttached) return;
        doc.__pxTooltipAttached = true;
        // o estilo do .px-tip-icon precisa existir já no primeiro render,
        // não só no primeiro hover (quando a caixa é criada)
        ensureStyle(doc);
        const win = doc.defaultView;
        doc.addEventListener('mouseover', (event) => {
            const target = event.target.closest && event.target.closest('[data-tip]');
            if (!target || !enabled) return;
            const text = target.getAttribute('data-tip');
            if (!text) return;
            const box = ensureBox(doc);
            box.textContent = text;
            box.style.display = 'block';
            position(box, target.getBoundingClientRect(), win);
        });
        doc.addEventListener('mouseout', (event) => {
            if (event.target.closest && event.target.closest('[data-tip]')) {
                const box = doc.getElementById('px-tooltip');
                if (box) box.style.display = 'none';
            }
        });
    }

    return Object.freeze({ attach, iconHTML });
})();
globalThis.PokemonHelperTooltip = PokemonHelperTooltip;
// auto-attach: páginas de extensão (MV3) bloqueiam <script> inline por CSP,
// então o attach precisa acontecer aqui; no content script o attach explícito
// vira no-op graças ao guard __pxTooltipAttached.
PokemonHelperTooltip.attach(document);
