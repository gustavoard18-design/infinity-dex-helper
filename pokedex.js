// Aba Pokédex: mostra todas as espécies com status capturado / visto / ?,
// filtro por geração e "só faltam". Os capturados/vistos vêm do estado do jogo
// (window.G.dexCaught / dexSeen), lidos pelo interceptor e repassados pra cá
// via postMessage ({type:'dex-data'}). A lista de espécies vem da mesma Pokédex
// da wiki que a extensão já guarda (PokemonHelperStorage.getPokedex()).

(() => {
    let SPECIES = [];            // [{dex, slug, name, types}]
    let caught = new Set();      // ids/slugs capturados
    let seen = new Set();        // ids/slugs vistos
    let gotDex = false;          // já recebeu dados do jogo?
    let filterGen = 'all';
    let onlyMissing = false;

    const body = document.getElementById('pdx-body');
    const countEl = document.getElementById('pdx-count');
    const progEl = document.getElementById('pdx-progress');
    const gensEl = document.getElementById('pdx-gens');

    const GEN_BOUNDS = [151, 251, 386, 493, 649, 721, 809, 905, 1025];
    function genOf(dex) {
        for (let i = 0; i < GEN_BOUNDS.length; i++) if (dex <= GEN_BOUNDS[i]) return i + 1;
        return GEN_BOUNDS.length + 1;
    }
    // um Pokémon pode estar registrado por número da dex OU por slug — cobre os dois
    function inSet(set, sp) {
        return set.has(sp.dex) || set.has(String(sp.dex)) || set.has(sp.slug);
    }

    // A base guardada pela extensão é enxuta (sem o número da dex), então
    // buscamos a Pokédex completa direto do jogo (tem dex, nome e tipos). A
    // página da extensão tem permissão de host pra infinitymmo.net.
    const POKEDEX_URL = 'https://infinitymmo.net/assets/data/wiki-pokedex.json';
    function mapMons(mons) {
        return (mons || [])
            .filter((m) => m && m.dex != null && m.slug)
            .map((m) => ({ dex: Number(m.dex), slug: m.slug, name: m.name || m.slug, types: m.types || [], locations: Array.isArray(m.locations) ? m.locations : [] }))
            .sort((a, b) => a.dex - b.dex);
    }

    // tradução dos métodos de encontro pro banner de "onde capturar"
    const METHOD = {
        grass: 'grama', tallgrass: 'grama', cave: 'caverna', surf: 'surfe/água',
        water: 'água', old_rod: 'vara velha', good_rod: 'vara boa', super_rod: 'super vara',
        fishing: 'pesca', rod: 'pesca', headbutt: 'cabeçada', rock_smash: 'quebra-pedra',
        gift: 'presente', trade: 'troca', egg: 'ovo', special: 'especial', roaming: 'errante'
    };
    const methodLabel = (m) => METHOD[m] || m || '?';

    // sprite do jogo (mesmo asset que a Pokédex nativa usa), por número da dex.
    const gifUrl = (dex) => `https://infinitymmo.net/assets/pokemon-bw/${dex}/front.gif`;
    const pngUrl = (slug) => `https://infinitymmo.net/assets/pokemon/${slug}.png`;

    function locHTML(sp) {
        const head = `<div class="loc-head"><img class="loc-spr" alt=""><span class="loc-title">📍 ${escapeHtml(sp.name)}</span></div>`;
        const locs = sp.locations || [];
        if (!locs.length) {
            return head + '<div class="loc-none">Sem local de encontro conhecido<br>(evolução, ovo, troca ou evento)</div>';
        }
        const sorted = locs.slice().sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0)).slice(0, 12);
        const rows = sorted.map((l) => {
            const lvl = l.max != null && l.max !== l.min ? `Nv${l.min}-${l.max}` : `Nv${l.min}`;
            const pct = l.pct != null ? `${l.pct}%` : '?';
            return `<div class="loc-row"><span class="loc-map">${escapeHtml(l.map)}</span>` +
                `<span class="loc-meta">${escapeHtml(methodLabel(l.method))} · ${lvl} · ${pct}</span></div>`;
        }).join('');
        return head + rows +
            (locs.length > 12 ? `<div class="loc-more">+${locs.length - 12} outros locais…</div>` : '');
    }
    function loadSpecies() {
        return fetch(POKEDEX_URL)
            .then((r) => r.json())
            .then((d) => { SPECIES = mapMons(d && d.mons); })
            .catch(() => {
                // fallback: base da extensão (pode não ter dex → lista vazia)
                return PokemonHelperStorage.getPokedex().then((data) => { SPECIES = mapMons(data && data.items); });
            });
    }

    function buildGenButtons() {
        const gensPresent = Array.from(new Set(SPECIES.map((s) => genOf(s.dex)))).sort((a, b) => a - b);
        const mk = (label, value) => {
            const b = document.createElement('button');
            b.className = 'pdx-gen' + (String(filterGen) === String(value) ? ' active' : '');
            b.textContent = label;
            b.addEventListener('click', () => { filterGen = value; render(); });
            return b;
        };
        gensEl.innerHTML = '';
        gensEl.appendChild(mk('Todas', 'all'));
        gensPresent.forEach((g) => gensEl.appendChild(mk('G' + g, g)));
        // toggle "só faltam"
        const miss = document.createElement('label');
        miss.className = 'pdx-miss';
        miss.innerHTML = `<input type="checkbox" ${onlyMissing ? 'checked' : ''}> só faltam`;
        miss.querySelector('input').addEventListener('change', (e) => { onlyMissing = e.target.checked; render(); });
        gensEl.appendChild(miss);
    }

    function statusOf(sp) {
        if (inSet(caught, sp)) return 'caught';
        if (inSet(seen, sp)) return 'seen';
        return 'unknown';
    }

    function render() {
        buildGenButtons();

        if (!SPECIES.length) { body.innerHTML = '<div class="pdx-wait">Carregando a base de Pokémon…<br>Se não aparecer, abra o jogo e recarregue.</div>'; return; }

        // contagem global (independe do filtro de geração, mas respeita "capturados")
        const totalAll = SPECIES.length;
        const caughtAll = SPECIES.filter((s) => inSet(caught, s)).length;
        const pct = totalAll ? Math.round(caughtAll / totalAll * 100) : 0;
        countEl.innerHTML = `${caughtAll}/${totalAll} <span class="pct">(${pct}%)</span>`;
        progEl.style.width = pct + '%';

        // lista filtrada
        let list = SPECIES;
        if (filterGen !== 'all') list = list.filter((s) => genOf(s.dex) === Number(filterGen));
        if (onlyMissing) list = list.filter((s) => statusOf(s) !== 'caught');

        if (!gotDex) {
            body.innerHTML = '<div class="pdx-wait">Aguardando os dados do jogo…<br>Abra o InfinityMMO nesta aba (F5) e entre no jogo. A lista de capturados aparece aqui automaticamente.</div>';
            return;
        }
        if (!list.length) { body.innerHTML = '<div class="pdx-empty">Nada aqui — você já capturou tudo desse filtro! 🎉</div>'; return; }

        const listEl = document.createElement('div');
        listEl.className = 'pdx-list';
        const frag = document.createDocumentFragment();
        list.forEach((sp) => {
            const st = statusOf(sp);
            const row = document.createElement('div');
            row.className = 'pdx-row ' + st;
            const label = st === 'caught' ? '<span class="pdx-st c">✅ capturado</span>'
                : st === 'seen' ? '<span class="pdx-st s">👁 visto</span>'
                : '<span class="pdx-st u">⬜ não visto</span>';
            const shownName = st === 'unknown' ? '???' : escapeHtml(sp.name);
            row.innerHTML = `<span class="pdx-num">Nº${String(sp.dex).padStart(3, '0')}</span>` +
                `<span class="pdx-nm">${shownName}</span>${label}`;
            // banner "onde capturar" no hover
            row.addEventListener('mouseenter', (e) => showTip(sp, e));
            row.addEventListener('mousemove', moveTip);
            row.addEventListener('mouseleave', hideTip);
            frag.appendChild(row);
        });
        listEl.appendChild(frag);
        body.innerHTML = '';
        body.appendChild(listEl);
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ---- banner flutuante "onde capturar" ----
    let tip = null;
    function ensureTip() {
        if (tip && document.body.contains(tip)) return tip;
        tip = document.createElement('div');
        tip.className = 'pdx-tip';
        tip.style.display = 'none';
        document.body.appendChild(tip);
        return tip;
    }
    function showTip(sp, e) {
        const el = ensureTip();
        el.innerHTML = locHTML(sp);
        // onerror inline é bloqueado pelo CSP da extensão, então ligamos por JS:
        // tenta o gif animado do jogo → cai pro png estático → some se falhar.
        const img = el.querySelector('.loc-spr');
        if (img) {
            // não-visto vira silhueta preta (sem spoiler), mantendo a forma
            if (statusOf(sp) === 'unknown') img.classList.add('sil');
            img.onerror = () => {
                if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = pngUrl(sp.slug); }
                else { img.style.display = 'none'; }
            };
            img.src = gifUrl(sp.dex);
        }
        el.style.display = 'block';
        moveTip(e);
    }
    function moveTip(e) {
        if (!tip || tip.style.display === 'none') return;
        const pad = 12, vw = window.innerWidth, vh = window.innerHeight;
        const w = tip.offsetWidth, h = tip.offsetHeight;
        let x = e.clientX + 14, y = e.clientY + 14;
        if (x + w + pad > vw) x = e.clientX - w - 14;
        if (y + h + pad > vh) y = Math.max(pad, vh - h - pad);
        if (x < pad) x = pad;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
    }
    function hideTip() { if (tip) tip.style.display = 'none'; }

    let lastDexMsg = '';
    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || msg.type !== 'dex-data') return;
        const p = msg.payload || {};
        // dedupe: o content script reenvia periodicamente; só re-renderiza se mudou
        const sig = JSON.stringify([(p.caught || []).length, (p.seen || []).length, p.caught, p.seen]);
        if (sig === lastDexMsg) { gotDex = true; return; }
        lastDexMsg = sig;
        caught = new Set(Array.isArray(p.caught) ? p.caught : []);
        seen = new Set(Array.isArray(p.seen) ? p.seen : []);
        gotDex = true;
        render();
    });

    loadSpecies().then(render).catch(() => render());
})();
