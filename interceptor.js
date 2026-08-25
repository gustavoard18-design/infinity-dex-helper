// Roda no MAIN world da página (não no isolated world do content script),
// porque só ali dá pra sobrescrever o window.fetch que o próprio jogo usa.
(function () {
    // Fica numa propriedade de window (não numa const fechada no escopo) pra
    // que reinjeções futuras (próximo clique no ícone) consigam atualizar o
    // padrão sem precisar recarregar a página — só o fetch em si é
    // sobrescrito uma única vez, o padrão de URL pode mudar depois.
    window.__pkmnHelperBattleUrlRe = /\/battle\//;
    window.__pkmnHelperCharacterUrlRe = /\/character/;

    if (window.__pkmnHelperFetchPatched) return;
    window.__pkmnHelperFetchPatched = true;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const input = args[0];
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        let requestActionPromise = Promise.resolve(null);
        if (window.__pkmnHelperBattleUrlRe.test(url)) {
            const initBody = args[1] && args[1].body;
            if (typeof initBody === 'string') {
                requestActionPromise = Promise.resolve().then(() => {
                    const body = JSON.parse(initBody);
                    return { battleId: body.battleId || null, action: body.action || null };
                }).catch(() => null);
            } else if (input && typeof input.clone === 'function') {
                requestActionPromise = input.clone().json().then((body) => ({ battleId: body?.battleId || null, action: body?.action || null })).catch(() => null);
            }
        }
        const response = await originalFetch.apply(this, args);
        try {
            if (window.__pkmnHelperBattleUrlRe.test(url)) {
                response
                    .clone()
                    .json()
                    .then(async (data) => {
                        const request = await requestActionPromise;
                        if (request) data.__pokemonHelperRequest = request;
                        window.dispatchEvent(new CustomEvent('pkmn-helper-battle-data', { detail: data }));
                    })
                    .catch(() => {});
            } else if (window.__pkmnHelperCharacterUrlRe.test(url)) {
                response
                    .clone()
                    .json()
                    .then((data) => {
                        window.dispatchEvent(new CustomEvent('pkmn-helper-character-data', { detail: data }));
                    })
                    .catch(() => {});
            }
        } catch (_) {
            // nunca deixa o hook quebrar a chamada real do jogo
        }
        return response;
    };
})();

// ---- sonda do nome do mapa ------------------------------------------------
// IIFE própria (fora do patch de fetch), pra rodar mesmo se o fetch já tiver
// sido interceptado antes neste carregamento da página.
// O jogo é feito em Phaser e desenha o nome do mapa como um objeto de texto
// dentro do canvas (não é HTML, então não dá pra ler pelo DOM). Como este
// script roda no MAIN world, conseguimos alcançar o objeto do jogo e ler o
// texto direto — 100% confiável, sem OCR. Procuramos a instância do Phaser,
// varremos os textos/rótulos visíveis e mandamos os candidatos pro content
// script, que mostra no painel. (Fase de descoberta: mostra vários candidatos;
// depois travamos no campo certo.)
(function () {
    if (window.__pkmnHelperMapProbe) return;
    window.__pkmnHelperMapProbe = true;
    let game = null;

    function findGame() {
        if (game && game.isBooted) return game;
        // 0) instância capturada pelo hook do construtor (hook.js, document_start)
        try { if (window.__pkmnGame && window.__pkmnGame.scene) { game = window.__pkmnGame; return game; } } catch (_) {}
        // 1) registro global do Phaser — o jeito mais confiável (toda instância
        // de jogo é registrada em Phaser.GAMES quando Phaser está no window).
        try {
            const games = window.Phaser && window.Phaser.GAMES;
            if (games) for (const g of games) {
                try { if (g && g.scene && g.canvas) { game = g; return game; } } catch (_) {}
            }
        } catch (_) {}
        // 2) handles comuns em window
        for (const k of ['game', 'Game', 'phaserGame', 'PhaserGame']) {
            try { const v = window[k]; if (v && v.scene && v.canvas) { game = v; return game; } } catch (_) {}
        }
        // 3) varredura das props enumeráveis de window — cada acesso protegido,
        // porque referências de iframe cross-origin estouram SecurityError ao
        // ler qualquer propriedade (.scene etc).
        for (const k in window) {
            try {
                const v = window[k];
                if (v && typeof v === 'object' && v.scene && v.canvas && v.isBooted !== undefined) {
                    game = v; return game;
                }
            } catch (_) { /* frame cross-origin ou getter que lança — ignora */ }
        }
        return null;
    }

    // Âncora do texto do nome do mapa no HUD do jogo (descoberto na fase de
    // diagnóstico): fica no topo, à direita do nome do jogador. Travamos por
    // posição — o objeto de texto fica no mesmo lugar; só o conteúdo muda quando
    // se troca de mapa. Tolerância generosa pra aguentar pequenas variações.
    const MAP_ANCHOR_X = 428, MAP_ANCHOR_Y = 38, MAP_TOL = 60;

    // percorre recursivamente a árvore de exibição (Containers guardam filhos em
    // .list) e devolve o texto do objeto mais próximo da âncora do mapa.
    function findMapText(obj, depth, best) {
        if (!obj || depth > 8) return best;
        try {
            const t = obj.text;
            if (typeof t === 'string' && t.trim() && obj.visible !== false) {
                const x = obj.x, y = obj.y;
                if (typeof x === 'number' && typeof y === 'number') {
                    const dx = x - MAP_ANCHOR_X, dy = y - MAP_ANCHOR_Y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d <= MAP_TOL && (!best || d < best.d)) best = { d, text: t.trim() };
                }
            }
        } catch (_) {}
        let kids = null;
        try { kids = obj.list; } catch (_) {}
        if (Array.isArray(kids)) kids.forEach((k) => { best = findMapText(k, depth + 1, best); });
        return best;
    }

    function currentMapName() {
        const g = findGame();
        if (!g || !g.scene) return null;
        let scenes = [];
        try { scenes = g.scene.getScenes(true); } catch (_) { return null; }
        let best = null;
        scenes.forEach((s) => {
            try {
                const list = (s.children && s.children.list) || [];
                list.forEach((o) => { best = findMapText(o, 0, best); });
            } catch (_) {}
        });
        return best ? best.text : null;
    }

    // Geometria REAL da área renderizada do jogo. O <canvas> ocupa a largura
    // toda, mas o Phaser desenha o jogo centralizado preservando a proporção,
    // deixando barras pretas dos lados. Calculamos esse retângulo pela razão de
    // aspecto da resolução interna do jogo (FIT) e publicamos num atributo do
    // DOM, que o content script lê pra encaixar o painel na barra preta esquerda.
    function computeGameRect(g) {
        try {
            const canvas = g.canvas;
            if (!canvas) return null;
            const cr = canvas.getBoundingClientRect();
            if (!cr.width || !cr.height) return null;
            const gs = g.scale && g.scale.gameSize;
            const iw = gs && gs.width, ih = gs && gs.height;
            if (!iw || !ih) return null;
            const ar = iw / ih;
            let dw = cr.width, dh = cr.width / ar;
            if (dh > cr.height) { dh = cr.height; dw = cr.height * ar; }
            const left = cr.left + (cr.width - dw) / 2;
            const top = cr.top + (cr.height - dh) / 2;
            return { left: left, top: top, width: dw, height: dh };
        } catch (_) { return null; }
    }

    let last = null, lastRect = '', lastDex = '';
    const tick = () => {
        try {
            const g = findGame();
            // publica a geometria real do jogo (mesmo sem o painel montado ainda)
            if (g) {
                const r = computeGameRect(g);
                if (r) {
                    const s = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(',');
                    if (s !== lastRect) { lastRect = s; document.documentElement.dataset.pkmnGameRect = s; }
                }
            }
            // publica a Pokédex do jogador (window.G.dexCaught / dexSeen são Sets),
            // lida direto do estado do jogo — a aba Pokédex da extensão consome isso.
            try {
                const gg = window.G;
                if (gg && (gg.dexCaught || gg.dexSeen)) {
                    const toArr = (v) => (v instanceof Set ? Array.from(v) : Array.isArray(v) ? v : []);
                    const dex = JSON.stringify({ caught: toArr(gg.dexCaught), seen: toArr(gg.dexSeen) });
                    if (dex !== lastDex) { lastDex = dex; document.documentElement.dataset.pkmnDex = dex; }
                }
            } catch (_) {}
            const nameEl = document.querySelector('#pokemon-type-matchup-overlay .ph-map-name');
            if (!nameEl) return; // painel ainda não montado
            const name = currentMapName();
            const show = name || '—';
            if (show === last) return;
            last = show;
            nameEl.textContent = show;
        } catch (_) {}
    };
    setInterval(tick, 1000);
    tick();
})();
