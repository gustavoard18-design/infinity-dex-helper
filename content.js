(function () {
    const ID = 'pokemon-type-matchup-overlay';
    const DEFAULT_SETTINGS = PokemonHelperStorage.DEFAULT_OVERLAY_SETTINGS;
    const MIN_WIDTH = 220;
    const MIN_HEIGHT = 180;
    const BATTLE_RETURN_DELAY_MS = 4000;
    const FLEE_RETURN_DELAY_MS = 1000;
    let battleReturnTimer = null;
    let dataSeen = false;

    // 'toggle' (ícone/atalho) fecha se já existir; 'ensure' (injeção automática
    // ao carregar a página) nunca fecha o que já está aberto — só garante que
    // exista, senão um F5 rápido pode disparar essa injeção mais de uma vez
    // e derrubar um overlay recém-minimizado.
    const mode = window.__pkmnHelperInjectMode || 'toggle';
    delete window.__pkmnHelperInjectMode;

    const existing = document.getElementById(ID);
    if (existing) {
        if (mode === 'ensure') return;
        existing.remove();
        const style = document.getElementById('pokemon-helper-style');
        if (style) style.remove();
        // fechado explicitamente: não deixa a injeção automática reabrir sozinha
        persist(Object.assign({}, currentSettings(existing), { open: false }));
        return;
    }

    // a leitura do storage é assíncrona, e o <div> só entra no DOM depois que
    // ela resolve — se 'ensure' disparar mais de uma vez pra mesma navegação
    // (tabs.onUpdated pode emitir 'complete' repetido), a checagem de
    // `existing` acima não vê nada ainda em nenhuma das duas e cada uma monta
    // seu próprio overlay duplicado. Essa flag síncrona reserva a construção
    // antes do await, então a segunda chamada desiste na hora.
    if (mode === 'ensure') {
        if (window.__pkmnHelperEnsurePending) return;
        window.__pkmnHelperEnsurePending = true;
    }

    Promise.all([
        PokemonHelperStorage.getOverlaySettings(),
        PokemonHelperStorage.getUiPreferences()
    ]).then(async ([storedSettings, prefs]) => {
        if (mode === 'ensure') window.__pkmnHelperEnsurePending = false;
        window.__pkmnHelperUiPrefs = prefs;

        // extensão gratuita: sem licença nem período de teste — sempre abre.
        const settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings);
        if (mode === 'ensure' && settings.open === false) return;
        settings.open = true;
        // preferências de abertura: 'last'/'remember' preservam o comportamento
        // atual (usa o que está persistido em overlaySettings)
        if (prefs.startView !== 'last') settings.view = prefs.startView;
        if (prefs.startCollapsed !== 'remember') settings.collapsed = prefs.startCollapsed === 'collapsed';
        build(settings);
    }).catch((error) => {
        if (mode === 'ensure') window.__pkmnHelperEnsurePending = false;
        console.warn('[Infinity Dex Helper] Não foi possível carregar as configurações:', error);
        window.__pkmnHelperUiPrefs = window.__pkmnHelperUiPrefs || PokemonHelperStorage.DEFAULT_UI_PREFERENCES;
        build(Object.assign({}, DEFAULT_SETTINGS, { open: true }));
    });

    function uiPrefs() {
        return window.__pkmnHelperUiPrefs || PokemonHelperStorage.DEFAULT_UI_PREFERENCES;
    }

    if (!window.__pkmnHelperPrefsListenerAdded) {
        window.__pkmnHelperPrefsListenerAdded = true;
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
            PokemonHelperStorage.getUiPreferences().then((prefs) => {
                window.__pkmnHelperUiPrefs = prefs;
            });
        });
    }

    function build(settings) {
        injectStyle();

        const container = document.createElement('div');
        container.id = ID;
        // referência ao MESMO objeto `settings` que arrastar/redimensionar/
        // maximizar mutam neste build() — o painel de configurações (função
        // separada, sem acesso a este closure) usa isso pra editar o estado
        // real em vez de uma cópia desconectada (currentSettings() lida do
        // DOM só devolve uma leitura pontual, não o objeto vivo).
        container.__phSettings = settings;
        positionDocked(settings);
        applyBox(container, settings);

        // A geometria real do jogo (faixa preta) só é publicada pelo interceptor
        // (data-pkmn-game-rect) até ~1s depois da página carregar — bem depois do
        // painel abrir. Então re-encaixamos assim que ela aparece/muda, via
        // MutationObserver, além de algumas tentativas cedo. Sem isso o painel
        // abre na posição salva (sobreposta ao jogo, topo desalinhado).
        const redock = () => {
            const ov = document.getElementById(ID);
            const s = ov && ov.__phSettings;
            if (!ov || !s || s.maximized) return;
            if (uiPrefs().dockToGameGap === false) return;
            if (ov.classList.contains('collapsed')) bubbleCorner(s);
            else positionDocked(s);
            applyBox(ov, s);
            persist(currentSettings(ov));
        };
        if (!window.__phGameRectObserver) {
            window.__phGameRectObserver = new MutationObserver(redock);
            try {
                window.__phGameRectObserver.observe(document.documentElement, {
                    attributes: true, attributeFilter: ['data-pkmn-game-rect']
                });
            } catch (_) {}
        }
        [300, 1200, 2500].forEach((ms) => setTimeout(redock, ms));

        // ---- bolha flutuante: estado recolhido (menor espaço possível na tela) ----
        // pokébola desenhada (SVG) preenchendo a bolha — arraste move, clique abre.
        const bubble = document.createElement('button');
        bubble.className = 'ph-bubble pxl-bubble';
        bubble.innerHTML =
            '<svg viewBox="0 0 48 48" aria-hidden="true">' +
                '<circle cx="24" cy="24" r="22.5" fill="#fff"/>' +
                '<path d="M1.5 24A22.5 22.5 0 0 1 46.5 24Z" fill="#e3350d"/>' +
                '<rect x="1.5" y="21" width="45" height="6" fill="#1a1a1a"/>' +
                '<circle cx="24" cy="24" r="22.5" fill="none" stroke="#1a1a1a" stroke-width="3"/>' +
                '<circle cx="24" cy="24" r="7.5" fill="#1a1a1a"/>' +
                '<circle cx="24" cy="24" r="4.6" fill="#fff"/>' +
            '</svg>';
        bubble.title = 'Abrir Infinity Dex Helper';

        // ---- cabeçalho: ícones em linha (encontro / meus pokémons / pokédex / config) + recolher ----
        // buildHeaderButtons vem de components/header-buttons.js
        const header = document.createElement('div');
        header.className = 'ph-header';

        const { collapseBtn, maximizeBtn } = buildHeaderButtons(header, [
            { icon: 'enc', tip: 'Encontro atual', view: 'battle' },
            { icon: 'team', tip: 'Meus Pokémon', view: 'myPokemons' },
            { icon: 'dex', tip: 'Pokédex (capturados)', view: 'pokedex' },
            { icon: 'cfg', tip: 'Configurações', view: 'settings' },
        ], { tip: 'Minimizar' }, { tip: 'Expandir' });

        // ---- barra do mapa (nome do mapa atual, lido do jogo) ----
        const mapBar = document.createElement('div');
        mapBar.className = 'ph-mapbar';
        mapBar.innerHTML = '<span class="ph-map-pin">📍</span><span class="ph-map-name">—</span>';

        // ---- corpo ----
        const body = document.createElement('div');
        body.className = 'ph-body';


        const battleFrame = document.createElement('iframe');
        battleFrame.id = 'pokemon-battle-frame';
        battleFrame.className = 'ph-frame';
        battleFrame.src = chrome.runtime.getURL('battle.html');

        const myPokemonsFrame = document.createElement('iframe');
        myPokemonsFrame.id = 'pokemon-myPokemons-frame';
        myPokemonsFrame.className = 'ph-frame';
        myPokemonsFrame.src = chrome.runtime.getURL('myPokemons.html');

        const pokedexFrame = document.createElement('iframe');
        pokedexFrame.id = 'pokemon-pokedex-frame';
        pokedexFrame.className = 'ph-frame';
        pokedexFrame.src = chrome.runtime.getURL('pokedex.html');

        const chartFrame = document.createElement('iframe');
        chartFrame.id = 'pokemon-chart-frame';
        chartFrame.className = 'ph-frame';
        chartFrame.src = chrome.runtime.getURL('chart.html');

        const settingsPanel = buildSettingsPanel({
            getContainer: () => document.getElementById(ID),
            dockedWidth, clampNum, applyBox, syncFullSide,
            updateStatus, persist, currentSettings
        });

        // syncFullSide (chamado no build()) roda ANTES desses iframes
        // terminarem de carregar, e a guarda de assinatura em __phFullSignature
        // suprime reenvios quando o estado não muda — então um 'maximized'
        // persistido do storage nunca chega no iframe recém-criado por aquele
        // caminho. Cada frame recebe seu próprio postMessage direto assim que
        // carrega, sem passar pela guarda, com o estado atual lido do MESMO
        // objeto `settings` que o resto do build() usa.
        [battleFrame, myPokemonsFrame, pokedexFrame, chartFrame].forEach((frame) => {
            frame.addEventListener('load', () => {
                frame.contentWindow?.postMessage({ type: 'panel-mode', full: settings.maximized === true }, '*');
            });
        });

        // repasse da Pokédex do jogo pro iframe: o interceptor publica os
        // capturados/vistos em data-pkmn-dex; aqui lemos e mandamos pro frame,
        // no load dele e sempre que o atributo mudar (novo Pokémon capturado).
        const relayDex = () => {
            const raw = document.documentElement.dataset.pkmnDex;
            if (!raw) return;
            const frame = document.getElementById('pokemon-pokedex-frame');
            if (!frame) return;
            try {
                frame.contentWindow?.postMessage({ type: 'dex-data', payload: JSON.parse(raw) }, '*');
            } catch (_) {}
        };
        pokedexFrame.addEventListener('load', () => { relayDex(); });
        if (!window.__phDexObserver) {
            window.__phDexObserver = new MutationObserver(relayDex);
            try {
                window.__phDexObserver.observe(document.documentElement, {
                    attributes: true, attributeFilter: ['data-pkmn-dex']
                });
            } catch (_) {}
        }
        [400, 1500].forEach((ms) => setTimeout(relayDex, ms));
        // rede de segurança: reenvia periodicamente (o iframe ignora se não mudou),
        // caso o MutationObserver perca alguma atualização de captura ao vivo.
        if (!window.__phDexRelayTimer) window.__phDexRelayTimer = setInterval(relayDex, 2500);

        body.appendChild(battleFrame);
        body.appendChild(myPokemonsFrame);
        body.appendChild(pokedexFrame);
        body.appendChild(chartFrame);
        body.appendChild(settingsPanel);

        const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        const resizeHandles = RESIZE_DIRS.map((dir) => {
            const handle = document.createElement('div');
            handle.className = `ph-resize-handle ph-resize-${dir}`;
            handle.dataset.dir = dir;
            return handle;
        });

        const statusBar = document.createElement('div');
        statusBar.className = 'ph-status';
        statusBar.innerHTML = '<div class="ph-status-dot"></div><div class="ph-status-text"></div>';

        container.appendChild(bubble);
        container.appendChild(header);
        container.appendChild(mapBar);
        container.appendChild(body);
        container.appendChild(statusBar);
        resizeHandles.forEach((handle) => container.appendChild(handle));
        document.documentElement.appendChild(container);

        // ---- mover: arrastar pelo cabeçalho (fora dos botões) ----
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ph-icon-btn')) return;
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startTop = settings.top;
            const startRight = settings.right;
            const maxTop = Math.max(0, window.innerHeight - settings.height);
            const maxRight = Math.max(0, window.innerWidth - settings.width);

            let rafScheduled = false;
            const onMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                settings.top = clampNum(startTop + dy, 0, maxTop, startTop);
                settings.right = clampNum(startRight - dx, 0, maxRight, startRight);
                if (!rafScheduled) {
                    rafScheduled = true;
                    requestAnimationFrame(() => {
                        rafScheduled = false;
                        applyBox(container, settings);
                    });
                }
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                persist(currentSettings(container));
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // ---- redimensionar: arrastar qualquer borda/canto ----
        resizeHandles.forEach((handle) => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dir = handle.dataset.dir;
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = settings.width;
                const startHeight = settings.height;
                const startTop = settings.top;
                const startRight = settings.right;

                let rafScheduled = false;
                const onMove = (moveEvent) => {
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;

                    if (dir.includes('e')) {
                        const newWidth = clampNum(startWidth + dx, MIN_WIDTH, 4000, startWidth);
                        settings.right = startRight - (newWidth - startWidth);
                        settings.width = newWidth;
                    } else if (dir.includes('w')) {
                        settings.width = clampNum(startWidth - dx, MIN_WIDTH, 4000, startWidth);
                    }

                    if (dir.includes('s')) {
                        settings.height = clampNum(startHeight + dy, MIN_HEIGHT, 4000, startHeight);
                    } else if (dir.includes('n')) {
                        const newHeight = clampNum(startHeight - dy, MIN_HEIGHT, 4000, startHeight);
                        settings.top = startTop + (startHeight - newHeight);
                        settings.height = newHeight;
                    }

                    if (!rafScheduled) {
                        rafScheduled = true;
                        requestAnimationFrame(() => {
                            rafScheduled = false;
                            applyBox(container, settings);
                        });
                    }
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    persist(currentSettings(container));
                    updateStatus(container, settings);
                    const widthValue = container.querySelector('#ph-width-value');
                    if (widthValue) widthValue.textContent = `${dockedWidth(settings)}px`;
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });

        container.dataset.maximized = String(settings.maximized === true);
        container.dataset.restoreWidth = String(settings.restoreWidth || '');
        container.dataset.restoreRight = String(settings.restoreRight ?? '');
        container.dataset.restoreTop = String(settings.restoreTop ?? '');
        container.dataset.restoreHeight = String(settings.restoreHeight || '');
        setCollapsed(container, settings, settings.collapsed);
        setActiveView(settings.view || 'myPokemons', container);

        // bolha minimizada: arrastável (distingue clique de arraste). Clicar
        // sem mover expande o painel; arrastar reposiciona a bolha e persiste.
        let bubbleDragged = false;
        bubble.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            const startX = e.clientX, startY = e.clientY;
            const startTop = settings.top, startRight = settings.right;
            const w = container.offsetWidth || 48, h = container.offsetHeight || 48;
            const maxTop = Math.max(0, window.innerHeight - h);
            const maxRight = Math.max(0, window.innerWidth - w);
            let moved = false;
            const onMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
                if (!moved) return;
                settings.top = clampNum(startTop + dy, 0, maxTop, startTop);
                settings.right = clampNum(startRight - dx, 0, maxRight, startRight);
                // colapsado applyBox não faz nada — posiciona direto no estilo
                container.style.top = `${settings.top}px`;
                container.style.right = `${settings.right}px`;
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                if (moved) {
                    bubbleDragged = true; // suprime o click de expandir logo abaixo
                    persist(currentSettings(container));
                    setTimeout(() => { bubbleDragged = false; }, 0);
                }
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        bubble.addEventListener('click', () => {
            if (bubbleDragged) return;
            setCollapsed(container, settings, false);
        });
        collapseBtn.addEventListener('click', () => setCollapsed(container, settings, true));
        maximizeBtn.setAttribute('aria-label', settings.maximized ? 'Voltar ao tamanho anterior' : 'Maximizar para 90% da largura');
        maximizeBtn.addEventListener('click', () => {
            if (!settings.maximized) {
                settings.restoreWidth = settings.width;
                settings.restoreRight = settings.right;
                settings.restoreTop = settings.top;
                settings.restoreHeight = settings.height;
                // expande nas DUAS dimensões — o modo full ocupa ~90% da
                // viewport inteira, não só da largura (senão a tabela 18×18
                // fica espremida numa faixa baixa e os controles do topo
                // somem do viewport ao rolar)
                settings.width = Math.round(window.innerWidth * 0.9);
                settings.right = Math.round(window.innerWidth * 0.05);
                settings.top = Math.round(window.innerHeight * 0.05);
                settings.height = Math.round(window.innerHeight * 0.9);
                settings.maximized = true;
            } else {
                settings.width = settings.restoreWidth || DEFAULT_SETTINGS.width;
                settings.right = settings.restoreRight ?? DEFAULT_SETTINGS.right;
                settings.top = settings.restoreTop ?? DEFAULT_SETTINGS.top;
                settings.height = settings.restoreHeight || DEFAULT_SETTINGS.height;
                settings.maximized = false;
            }
            container.dataset.maximized = String(settings.maximized);
            container.dataset.restoreWidth = String(settings.restoreWidth || '');
            container.dataset.restoreRight = String(settings.restoreRight ?? '');
            container.dataset.restoreTop = String(settings.restoreTop ?? '');
            container.dataset.restoreHeight = String(settings.restoreHeight || '');
            applyBox(container, settings);
            maximizeBtn.setAttribute('aria-label', settings.maximized ? 'Voltar ao tamanho anterior' : 'Maximizar para 90% da largura');
            persist(currentSettings(container));
            syncFullSide(container, settings);
            updateStatus(container, settings);
        });

        header.addEventListener('click', (e) => {
            const btn = e.target.closest('.ph-view-btn');
            if (!btn) return;
            delete container.dataset.preBattleView; // navegação manual cancela o retorno automático
            setActiveView(btn.dataset.view, container);
        });

        // cliques no shell (cabeçalho, botões) focam o elemento clicado e
        // "roubam" o teclado do jogo — devolve o foco após o clique. Exceção:
        // aba Configurações, onde inputs e captura de atalho precisam de foco.
        container.addEventListener('click', () => {
            if (container.dataset.activeView === 'settings') return;
            const active = document.activeElement;
            if (active && container.contains(active) && !/INPUT|TEXTAREA|SELECT/.test(active.tagName)) active.blur();
        });

        // registrado uma única vez em `window` (persiste entre toggles da
        // extensão, ao contrário do `container`, que é recriado do zero a cada
        // vez)
        if (!window.__pkmnHelperShortcutListenerAdded) {
            window.__pkmnHelperShortcutListenerAdded = true;
            window.addEventListener('message', (event) => {
                const data = event.data;
                if (!data || typeof data !== 'object') return;
                if (data.type === 'panel-exit-full') {
                    const overlay = document.getElementById(ID);
                    const settings = overlay && currentSettings(overlay);
                    if (settings?.maximized) overlay.querySelector('.ph-maximize-btn')?.click();
                }
                if (data.type === 'panel-interaction') {
                    // clique dentro de um iframe do painel moveu o foco pra ele e o
                    // jogo parou de receber teclado — devolve o foco ao documento
                    // do jogo tirando-o do iframe
                    const overlay = document.getElementById(ID);
                    if (!overlay || overlay.dataset.activeView === 'settings') return;
                    const active = document.activeElement;
                    if (active && active.classList && active.classList.contains('ph-frame')) active.blur();
                }
            });
        }

        // reajusta o painel quando a janela do navegador muda de tamanho, pra
        // não sobrar borda pra fora da tela (registrado uma única vez em window)
        if (!window.__pkmnHelperResizeAdded) {
            window.__pkmnHelperResizeAdded = true;
            window.addEventListener('resize', () => {
                const overlay = document.getElementById(ID);
                if (!overlay || overlay.classList.contains('collapsed')) return;
                const s = overlay.__phSettings;
                if (!s || s.maximized) return;
                positionDocked(s);
                applyBox(overlay, s);
                persist(currentSettings(overlay));
            });
        }

        if (!window.__pkmnHelperPayloadListenerAdded) {
            window.__pkmnHelperPayloadListenerAdded = true;

            const handleHelperPayload = (ev) => {
                const overlay = document.getElementById(ID);
                if (!overlay) return;
                dataSeen = true;
                updateStatus(overlay, currentSettings(overlay));

                const data = ev.detail;
                // payload precisa ser objeto — se vier null/primitivo (resposta
                // atípica do jogo), sai sem quebrar (data.party etc. lançariam)
                if (!data || typeof data !== 'object') return;
                const battleFrame = document.getElementById('pokemon-battle-frame');
                const myPokemonsFrame = document.getElementById('pokemon-myPokemons-frame');
                if (battleFrame) battleFrame.contentWindow.postMessage({ type: 'battle-data', payload: data }, '*');
                if (myPokemonsFrame) myPokemonsFrame.contentWindow.postMessage({ type: 'character-data', payload: data }, '*');

                const isCharacterPayload = !!(data.party || data.pc);
                // sinal real de fim de luta: só usado aqui pra saber quando voltar
                // pra aba anterior — battle.js ignora isso de propósito (ele só olha
                // pra presença de `foe`), esse "over" não deve virar estado de tela lá.
                const battleEnded = !!(data.state && data.state.over === true);
                const isBattlePayload = !!(data.foe || data.state?.foe?.mon || data.battleId);

                if (isCharacterPayload && !battleEnded) {
                    // só age a partir da view ociosa (Meus Pokémon); assim não
                    // atropela navegação manual pra outras abas (Pokédex, config...).
                    if ((overlay.dataset.activeView || 'myPokemons') === 'myPokemons') {
                        if (overlay.classList.contains('collapsed')) {
                            setCollapsed(overlay, currentSettings(overlay), false);
                        }
                        setActiveView('myPokemons', overlay);
                    }
                    return;
                }

                if (battleEnded) {
                    const returnView = overlay.dataset.preBattleView;
                    const minimizeAfter = uiPrefs().minimizeAfterBattle === true;
                    const onBattleView = (overlay.dataset.activeView || 'myPokemons') === 'battle';
                    // age quando: a) o painel auto-abriu pra batalha (returnView),
                    // ou b) a opção "minimizar após a luta" está ligada e o painel
                    // está na aba Encontro (funciona mesmo sem a auto-troca).
                    if (returnView || (minimizeAfter && onBattleView)) {
                        const fledSuccessfully = data.state?.outcome === 'fled'
                            || (data.events || []).some((event) => event.t === 'flee' && event.ok === true);
                        const returnDelay = fledSuccessfully ? FLEE_RETURN_DELAY_MS : BATTLE_RETURN_DELAY_MS;
                        if (battleReturnTimer) clearTimeout(battleReturnTimer);
                        battleReturnTimer = setTimeout(() => {
                            battleReturnTimer = null;
                            // opção "minimizar após a luta": recolhe pra bolha, só
                            // se ainda estiver na aba Encontro (usuário não navegou)
                            if (minimizeAfter) {
                                if ((overlay.dataset.activeView || 'myPokemons') !== 'battle') return;
                                delete overlay.dataset.preBattleView;
                                if (!overlay.classList.contains('collapsed')) {
                                    setCollapsed(overlay, currentSettings(overlay), true);
                                }
                                return;
                            }
                            // senão: volta pra aba anterior (comportamento padrão),
                            // guardado contra navegação manual durante a espera
                            if (overlay.dataset.preBattleView !== returnView) return;
                            delete overlay.dataset.preBattleView;
                            if (overlay.classList.contains('collapsed')) {
                                setCollapsed(overlay, currentSettings(overlay), false);
                            }
                            setActiveView(returnView, overlay);
                        }, returnDelay);
                    }
                    return;
                }

                if (isBattlePayload) {
                    if (battleReturnTimer) {
                        clearTimeout(battleReturnTimer);
                        battleReturnTimer = null;
                    }
                    // usuário pode desligar a troca automática pra aba Encontro;
                    // sem preBattleView setado, o retorno automático também não roda
                    if (uiPrefs().autoSwitchToBattle === false) return;
                    if (overlay.dataset.activeView !== 'battle' && !overlay.dataset.preBattleView) {
                        overlay.dataset.preBattleView = overlay.dataset.activeView || 'myPokemons';
                    }
                    if (overlay.classList.contains('collapsed')) {
                        setCollapsed(overlay, currentSettings(overlay), false);
                    }
                    setActiveView('battle', overlay);
                }
            };

            window.addEventListener('pkmn-helper-battle-data', handleHelperPayload);
            window.addEventListener('pkmn-helper-character-data', handleHelperPayload);
        }

        // guard próprio: o listener do mapa foi adicionado depois, então não pode
        // depender da flag acima (que uma versão antiga já pode ter ligado, o que
        // faria este listener ser pulado numa reinjeção sem recarregar a página).
        if (!window.__pkmnHelperMapListenerAdded) {
            window.__pkmnHelperMapListenerAdded = true;
            window.addEventListener('pkmn-helper-map', handleMapPayload);
        }

        // minimizar ao sair da tela/aba do jogo: quando a aba fica oculta (troca
        // de aba, minimiza a janela), recolhe o painel pra bolha se a opção
        // estiver ligada. Guard próprio pra sobreviver a reinjeções.
        if (!window.__pkmnHelperVisListener) {
            window.__pkmnHelperVisListener = true;
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) return;
                if (uiPrefs().minimizeOnLeave === false) return;
                const overlay = document.getElementById(ID);
                if (!overlay || overlay.classList.contains('collapsed')) return;
                setCollapsed(overlay, currentSettings(overlay), true);
            });
        }

        updateStatus(container, settings);
        PokemonHelperTooltip.attach(document);
    }

    function injectStyle() {
        if (document.getElementById('pokemon-helper-style')) return;

        if (!document.getElementById('pokemon-helper-pixel-theme')) {
            const link = document.createElement('link');
            link.id = 'pokemon-helper-pixel-theme';
            link.rel = 'stylesheet';
            link.href = chrome.runtime.getURL('pixel-theme.css');
            document.head.appendChild(link);
        }

        const style = document.createElement('style');
        style.id = 'pokemon-helper-style';
        style.textContent = `
            #${ID} {
                position: fixed; z-index: 2147483647;
                display: flex; flex-direction: column;
                background: var(--px-bg, #faf7ef); color: var(--px-text, #1a1a1a);
                font-family: var(--px-font-mono);
                border: 3px solid var(--px-border-panel, #1a1a1a); border-radius: var(--px-radius-lg, 10px);
                overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.25);
            }
            #${ID} .ph-header {
                display: flex; align-items: center; gap: 3px;
                height: 36px; padding: 0 4px; flex: 0 0 auto;
                background: var(--px-accent, #e3350d); border-bottom: 3px solid var(--px-border-panel, #1a1a1a);
                cursor: move; user-select: none;
            }
            #${ID} .ph-icon-btn {
                width: 30px; height: 27px; flex: 0 0 auto;
                display: flex; align-items: center; justify-content: center;
                border: 2px solid var(--px-border-panel, #1a1a1a); border-radius: var(--px-radius-sm, 6px);
                padding: 0; background: var(--px-bg-btn, #fff);
                cursor: pointer;
                transition: background-color .12s ease;
            }
            #${ID} .ph-icon-btn:hover { background: var(--px-bg-cell, #f4f1e4); }
            #${ID} .ph-view-btn.active { background: var(--px-mid, #f0c419); }
            #${ID} .ph-collapse-btn { width: 26px; }
            #${ID} .ph-spacer { flex: 1; }
            #${ID} .ph-mapbar {
                flex: 0 0 auto;
                display: flex; align-items: center; gap: 6px; padding: 4px 8px;
                background: var(--px-bg-bar, #f2efe4);
                border-bottom: 2px solid var(--px-border-panel, #1a1a1a);
                font-family: var(--px-font-mono); font-size: 10px;
                flex-wrap: wrap; max-height: 64px; overflow-y: auto;
            }
            #${ID} .ph-map-pin { flex: 0 0 auto; }
            #${ID} .ph-map-name { color: var(--px-text-hi, #1a1a1a); font-weight: 700; display: flex; flex-wrap: wrap; gap: 4px; }
            #${ID} .ph-map-cand {
                display: inline-flex; align-items: center; gap: 3px;
                background: var(--px-bg-cell, #fff); border: 1px solid var(--px-border-panel, #1a1a1a);
                border-radius: 4px; padding: 1px 4px; text-transform: uppercase;
            }
            #${ID} .ph-map-cand i { font-style: normal; opacity: .5; font-size: 8px; text-transform: none; }
            #${ID}.collapsed .ph-mapbar { display: none !important; }
            #${ID} .ph-body { flex: 1; position: relative; min-height: 0; display: flex; }
            #${ID} .ph-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: none; }
            #${ID}.full-side .ph-frame { position: static; height: 100%; }
            #${ID}.full-side #pokemon-chart-frame { display: block; flex: 1 1 auto; min-width: 0; order: 1; }
            #${ID}.full-side .ph-frame.side-active { display: block; flex: 0 0 var(--ph-side-width, 360px); border-right: 3px solid var(--px-border-panel, #1a1a1a); order: 0; }
            #${ID} .ph-status {
                flex: 0 0 auto; height: 24px;
                display: flex; align-items: center; gap: 7px; padding: 0 8px;
                background: var(--px-bg-bar, #f2efe4); border-top: 2px solid var(--px-border-panel, #1a1a1a);
            }
            #${ID} .ph-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--px-good, #4fa84a); animation: ph-blip 1.6s steps(2,end) infinite; }
            @keyframes ph-blip { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
            #${ID} .ph-status-text {
                font-family: var(--px-font-mono); font-size: 11px; font-weight: 700; letter-spacing: .2px;
                color: var(--px-text-dim, #7a7460); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            #${ID} .ph-bubble {
                display: none;
                padding: 0; background: none; border: 0;
            }
            #${ID} .ph-bubble svg { width: 100%; height: 100%; display: block; }
            #${ID}.collapsed {
                width: 48px !important;
                height: 48px !important;
                min-width: 0 !important;
                min-height: 0 !important;
                border-radius: 50%;
                border: 0;
                background: transparent;
                box-shadow: 0 4px 12px rgba(0,0,0,.3);
            }
            #${ID}.collapsed .ph-bubble { display: flex; cursor: grab; }
            #${ID}.collapsed .ph-bubble:active { cursor: grabbing; }
            #${ID}.collapsed .ph-header,
            #${ID}.collapsed .ph-body,
            #${ID}.collapsed .ph-status { display: none !important; }
            #${ID} .ph-settings { position: absolute; inset: 0; display: none; overflow-y: auto; padding: 9px 10px 14px; box-sizing: border-box; background: var(--px-bg, #faf7ef); }
            #${ID} .ph-set-head {
                display: flex; align-items: center; gap: 7px; margin: 11px 0 8px;
                font-family: var(--px-font-mono); font-size: 11px; font-weight: 800; color: var(--px-text-dim, #7a7460); letter-spacing: .8px;
            }
            #${ID} .ph-set-head:first-child { margin-top: 0; }
            #${ID} .ph-set-head::after { content: ''; flex: 1; height: 2px; background: var(--px-line, #ddd6bf); }
            #${ID} .ph-setting-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
            #${ID} .ph-setting-row[hidden] { display: none; }
            #${ID} .ph-setting-label { flex: 1; font-size: 12px; color: var(--px-text-val, #2b2820); }
            #${ID} .ph-step { width: 26px; height: 24px; background: var(--px-bg-btn, #fff); border: 2px solid var(--px-border-btn, #1a1a1a); border-radius: var(--px-radius-sm, 6px); color: var(--px-text-val, #2b2820); font-family: var(--px-font-mono); font-size: 13px; font-weight: 800; padding: 0; cursor: pointer; }
            #${ID} .ph-width-value { font-family: var(--px-font-mono); font-size: 12px; font-weight: 800; color: var(--px-accent, #e3350d); width: 44px; text-align: center; }
            #${ID} .ph-toggle { position: relative; flex: 0 0 auto; width: 38px; height: 21px; padding: 0; border: 2px solid var(--px-border, #1a1a1a); border-radius: 11px; background: var(--px-bg-track, #e9e4d2); cursor: pointer; transition: background-color .15s ease; }
            #${ID} .ph-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: var(--px-text-dim, #7a7460); transition: transform .15s ease, background-color .15s ease; }
            #${ID} .ph-toggle[aria-checked="true"] { background: var(--px-good, #4fa84a); }
            #${ID} .ph-toggle[aria-checked="true"]::after { background: #fff; transform: translateX(17px); }
            #${ID} .ph-cycle { min-width: 116px; height: 26px; padding: 0 10px; background: var(--px-bg-btn, #fff); border: 2px solid var(--px-border-btn, #1a1a1a); border-radius: var(--px-radius-sm, 6px); color: var(--px-accent, #e3350d); font-family: var(--px-font-mono); font-size: 11px; font-weight: 800; cursor: pointer; }
            #${ID} .ph-subhead { font-family: var(--px-font-mono); font-size: 10px; font-weight: 800; color: var(--px-text-dim, #7a7460); letter-spacing: .5px; margin: 8px 0 6px; }
            #${ID} .ph-order-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
            #${ID} .ph-order-item { display: flex; align-items: center; gap: 5px; background: var(--px-bg-card, #fff); border: 2px solid var(--px-border, #1a1a1a); border-radius: var(--px-radius-sm, 6px); padding: 5px 8px; }
            #${ID} .ph-order-label { flex: 1; font-size: 12px; font-weight: 600; color: var(--px-text-val, #2b2820); }
            #${ID} .ph-order-btn { width: 24px; height: 22px; flex: 0 0 auto; background: var(--px-bg-btn, #fff); border: 2px solid var(--px-border-btn, #1a1a1a); border-radius: var(--px-radius-sm, 6px); color: var(--px-text-val, #2b2820); font-size: 10px; padding: 0; cursor: pointer; }
            #${ID} .ph-order-btn:hover:not(:disabled) { background: var(--px-bg-cell, #f4f1e4); }
            #${ID} .ph-order-btn:disabled { opacity: .3; cursor: not-allowed; }
            #${ID} .ph-hint { color: var(--px-text-dim, #7a7460); font-size: 11px; margin: 4px 0 12px; }
            #${ID} .ph-btn-shortcut { width: 100%; }
            #${ID} .ph-data-feedback { font-family: var(--px-font-mono); font-size: 11px; font-weight: 700; min-height: 13px; margin: 6px 0 0; }
            #${ID} .ph-data-feedback.ok { color: var(--px-good, #4fa84a); }
            #${ID} .ph-data-feedback.err { color: var(--px-bad, #d62839); }
            #${ID} .ph-resize-handle {
                position: absolute;
                z-index: 10;
            }
            #${ID}.collapsed .ph-resize-handle { display: none; }
            #${ID} .ph-resize-n, #${ID} .ph-resize-s {
                left: 6px;
                right: 6px;
                height: 6px;
                cursor: ns-resize;
            }
            #${ID} .ph-resize-n { top: 0; }
            #${ID} .ph-resize-s { bottom: 0; }
            #${ID} .ph-resize-e, #${ID} .ph-resize-w {
                top: 6px;
                bottom: 6px;
                width: 6px;
                cursor: ew-resize;
            }
            #${ID} .ph-resize-e { right: 0; }
            #${ID} .ph-resize-w { left: 0; }
            #${ID} .ph-resize-ne, #${ID} .ph-resize-nw, #${ID} .ph-resize-se, #${ID} .ph-resize-sw {
                width: 12px;
                height: 12px;
            }
            #${ID} .ph-resize-ne {
                top: 0;
                right: 0;
                cursor: nesw-resize;
                background: linear-gradient(45deg, transparent 50%, var(--px-text-dim, #7a7460) 50%);
            }
            #${ID} .ph-resize-nw {
                top: 0;
                left: 0;
                cursor: nwse-resize;
                background: linear-gradient(315deg, transparent 50%, var(--px-text-dim, #7a7460) 50%);
            }
            #${ID} .ph-resize-se {
                bottom: 0;
                right: 0;
                cursor: nwse-resize;
                background: linear-gradient(135deg, transparent 50%, var(--px-text-dim, #7a7460) 50%);
            }
            #${ID} .ph-resize-sw {
                bottom: 0;
                left: 0;
                cursor: nesw-resize;
                background: linear-gradient(225deg, transparent 50%, var(--px-text-dim, #7a7460) 50%);
            }
        `;
        document.head.appendChild(style);
    }

    function clampNum(value, min, max, fallback) {
        const n = parseInt(value, 10);
        if (Number.isNaN(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    // "largura" no painel de config é sempre a largura ENCAIXADA — com o
    // painel expandido (F) não existe uma largura encaixada visível, então
    // mostramos/editamos o valor guardado em `restoreWidth` (o que volta
    // a valer quando o usuário sair do modo expandido). Vive no escopo do
    // módulo (não só dentro de buildSettingsPanel) porque o onUp do
    // redimensionamento, em build(), também precisa dele.
    function dockedWidth(settings) {
        return settings.maximized ? (settings.restoreWidth || DEFAULT_SETTINGS.width) : settings.width;
    }

    // garante que o painel encaixado caiba na janela: limita largura/altura ao
    // espaço disponível e reposiciona pra que a borda de baixo/direita apareça
    // dentro da tela (evita a borda preta ficando pra fora embaixo). Não mexe
    // no modo expandido (maximizado), que já é calculado pro tamanho da tela.
    function fitToViewport(settings) {
        if (settings.maximized) return;
        const vw = window.innerWidth, vh = window.innerHeight, margin = 8;
        settings.width = clampNum(settings.width, MIN_WIDTH, Math.max(MIN_WIDTH, vw - 2 * margin), settings.width);
        settings.height = clampNum(settings.height, MIN_HEIGHT, Math.max(MIN_HEIGHT, vh - 2 * margin), settings.height);
        settings.right = clampNum(settings.right, margin, Math.max(margin, vw - settings.width - margin), settings.right);
        settings.top = clampNum(settings.top, margin, Math.max(margin, vh - settings.height - margin), settings.top);
    }

    // acha o retângulo REAL onde o jogo é desenhado. O interceptor (MAIN world)
    // calcula pela proporção do Phaser e publica em data-pkmn-game-rect como
    // "left,top,width,height" — é a fonte confiável, porque o <canvas> ocupa a
    // largura toda e a faixa preta é interna a ele (invisível ao DOM). Se o
    // atributo não existir ainda, cai pro retângulo do maior <canvas>.
    function findGameCanvasRect() {
        const raw = document.documentElement.dataset.pkmnGameRect;
        if (raw) {
            const p = raw.split(',').map(Number);
            if (p.length === 4 && p.every((n) => !isNaN(n)) && p[2] > 120 && p[3] > 120) {
                return { left: p[0], top: p[1], width: p[2], height: p[3] };
            }
        }
        let best = null, bestArea = 0;
        document.querySelectorAll('canvas').forEach((c) => {
            if (c.closest(`#${ID}`)) return; // ignora canvas nosso, se houver
            const r = c.getBoundingClientRect();
            const area = r.width * r.height;
            if (area > bestArea && r.width > 120 && r.height > 120) { bestArea = area; best = r; }
        });
        return best;
    }

    // encaixa o painel na faixa preta que o jogo deixa à esquerda (quando o
    // canvas dele não começa em x=0). Ancora pela borda direita em canvas.left
    // (right = vw - canvas.left, width = canvas.left → left efetivo = 0) e casa a
    // altura com a do canvas. Devolve true se encaixou; false se não há faixa.
    function fitToGameGap(settings) {
        if (settings.maximized) return false;
        const rect = findGameCanvasRect();
        if (!rect) return false;
        const vw = window.innerWidth, vh = window.innerHeight;
        const gapWidth = Math.floor(rect.left);
        if (gapWidth < MIN_WIDTH) return false; // sem faixa preta suficiente à esquerda
        // gruda nas bordas: coluna de altura total encostada no canto superior
        // esquerdo, com a largura exata da faixa preta (left efetivo = 0).
        settings.width = Math.min(gapWidth, vw);
        settings.right = Math.max(0, vw - gapWidth);
        settings.top = 0;
        settings.height = Math.max(MIN_HEIGHT, vh);
        return true;
    }

    // posiciona o painel encaixado: tenta preencher a faixa preta do jogo (opção
    // ligada por padrão); se não houver faixa, só garante que caiba na janela.
    function positionDocked(settings) {
        if (uiPrefs().dockToGameGap !== false && fitToGameGap(settings)) return;
        fitToViewport(settings);
    }

    function applyBox(container, settings) {
        // posição (top/right) vale nos dois estados; o tamanho 48×48 da bolha vem
        // do CSS (.collapsed), então só aplicamos width/height quando expandido.
        container.style.top = `${settings.top}px`;
        container.style.right = `${settings.right}px`;
        if (container.classList.contains('collapsed')) return;
        container.style.width = `${settings.width}px`;
        container.style.height = `${settings.height}px`;
    }

    // posição da bolha minimizada: canto superior esquerdo da tela (dentro da
    // faixa preta que o jogo deixa à esquerda). Não depende da geometria do jogo.
    function bubbleCorner(settings) {
        const margin = 6, size = 48;
        settings.top = margin;
        settings.right = Math.max(0, window.innerWidth - size - margin);
    }

    // fase de descoberta: mostra os candidatos a nome de mapa lidos do jogo, com
    // o rótulo da origem (src), pra identificarmos qual campo é o certo. Depois
    // trocamos isso por exibir só o mapa correto.
    function handleMapPayload(ev) {
        const overlay = document.getElementById(ID);
        if (!overlay) return;
        const nameEl = overlay.querySelector('.ph-map-name');
        if (!nameEl) return;
        const cand = (ev.detail && ev.detail.candidates) || [];
        if (!cand.length) { nameEl.textContent = '(procurando o jogo…)'; return; }
        nameEl.innerHTML = cand.map((c) =>
            `<span class="ph-map-cand" title="${c.src}">${escapeHtml(c.val)}<i>${escapeHtml(c.src)}</i></span>`
        ).join('');
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    function updateStatus(container, settings) {
        const text = container.querySelector('.ph-status-text');
        if (!text) return;
        const mode = settings.maximized ? 'EXPANDIDO' : `ENCAIXADO ${settings.width}PX`;
        text.textContent = `${dataSeen ? 'CONECTADO' : 'AGUARDANDO DADOS'} · ${mode}`;
    }

    function syncFullSide(container, settings) {
        const view = container.dataset.activeView || 'myPokemons';
        // lado a lado só pra views em iframe de conteúdo: 'settings' é um <div>
        // absoluto (cobriria a tabela) e 'chart'/'myPokemons' ocupam tudo sozinhos
        const sideBySide = settings.maximized === true && view === 'battle';
        container.classList.toggle('full-side', sideBySide);
        container.style.setProperty('--ph-side-width', `${settings.restoreWidth || DEFAULT_SETTINGS.width}px`);
        container.querySelectorAll('.ph-frame').forEach((frame) => frame.classList.remove('side-active'));
        if (sideBySide) {
            const active = container.querySelector(`#pokemon-${view}-frame`);
            if (active) active.classList.add('side-active');
        }
        // só reposta pros iframes quando o estado de fato muda — setActiveView
        // roda a cada payload de batalha (uma vez por turno), então sem essa
        // guarda o postMessage inundaria os iframes com a mesma mensagem
        // repetida durante uma luta inteira.
        const full = settings.maximized === true;
        const signature = `${full}|${sideBySide}`;
        if (container.__phFullSignature === signature) return;
        container.__phFullSignature = signature;
        container.querySelectorAll('.ph-frame').forEach((frame) => {
            frame.contentWindow?.postMessage({ type: 'panel-mode', full }, '*');
        });
    }

    function setCollapsed(container, settings, collapsed) {
        settings.collapsed = collapsed;
        container.classList.toggle('collapsed', collapsed);
        const docking = uiPrefs().dockToGameGap !== false;
        if (collapsed) {
            // minimizou: joga a bolha pro canto superior esquerdo
            if (docking) bubbleCorner(settings);
        } else if (!settings.maximized && docking) {
            // expandiu: re-encaixa o painel na faixa preta
            positionDocked(settings);
        }
        applyBox(container, settings);
        persist(currentSettings(container));
    }

    function currentSettings(container) {
        return {
            top: parseInt(container.style.top, 10) || DEFAULT_SETTINGS.top,
            right: parseInt(container.style.right, 10) || DEFAULT_SETTINGS.right,
            width: parseInt(container.style.width, 10) || DEFAULT_SETTINGS.width,
            height: parseInt(container.style.height, 10) || DEFAULT_SETTINGS.height,
            maximized: container.dataset.maximized === 'true',
            restoreWidth: parseInt(container.dataset.restoreWidth, 10) || null,
            restoreRight: container.dataset.restoreRight === '' ? null : parseInt(container.dataset.restoreRight, 10),
            restoreTop: container.dataset.restoreTop === '' ? null : parseInt(container.dataset.restoreTop, 10),
            restoreHeight: parseInt(container.dataset.restoreHeight, 10) || null,
            collapsed: container.classList.contains('collapsed'),
            view: container.dataset.activeView || DEFAULT_SETTINGS.view,
            open: true,
        };
    }

    function persist(settings) {
        PokemonHelperStorage.setOverlaySettings(settings).catch((error) => {
            console.warn('[Infinity Dex Helper] Não foi possível salvar as configurações:', error);
        });
    }

    // Busca os elementos por classe (em vez de usar closures) porque o layout
    // pode ser recriado do zero entre toggles da extensão.
    function setActiveView(view, container) {
        const battle = container.querySelector('#pokemon-battle-frame');
        const myPokemons = container.querySelector('#pokemon-myPokemons-frame');
        const pokedex = container.querySelector('#pokemon-pokedex-frame');
        const chart = container.querySelector('#pokemon-chart-frame');
        const settingsPanel = container.querySelector('#pokemon-settings-panel');
        if (!battle || !myPokemons || !pokedex || !chart || !settingsPanel) return;

        container.dataset.activeView = view;
        syncFullSide(container, currentSettings(container));

        // no modo lado a lado (.full-side), o frame ativo (.side-active) e a
        // tabela (#pokemon-chart-frame) são exibidos via CSS — o laço não pode
        // forçar display:none neles (isso venceria a regra do stylesheet, já
        // que estilo inline sempre tem prioridade). Em vez de simplesmente
        // pular esses dois casos, o laço limpa (`''`) o estilo inline deles
        // sempre que não são a view ativa "sozinha": assim a folha de estilo
        // decide sozinha (nada de display:none preso de uma navegação anterior
        // sobrevivendo até o próximo toggle de F, que não passa por este laço).
        [battle, myPokemons, pokedex, chart].forEach((frame) => {
            const active = frame.id === `pokemon-${view}-frame`;
            const cssManaged = frame === chart || frame.classList.contains('side-active');
            frame.style.display = active ? 'block' : (cssManaged ? '' : 'none');
        });
        settingsPanel.style.display = view === 'settings' ? 'block' : 'none';

        paintHeaderButtons(container, view);

        persist(currentSettings(container));
    }
})();
