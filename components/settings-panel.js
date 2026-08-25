// ---------------------------------------------------------------------------
// Painel "Configurações" do overlay (content.js): largura do painel encaixado,
// avisos de atualização/beta, tooltips e atalhos. Não tem acesso ao closure
// de content.js — recebe tudo que precisa (leitura/gravação de settings,
// acesso ao container do overlay) via objeto `shell`.
// ---------------------------------------------------------------------------

function buildSettingsPanel(shell) {
        const panel = document.createElement('div');
        panel.className = 'ph-settings';
        panel.id = 'pokemon-settings-panel';
        panel.innerHTML = `
            <div class="ph-set-head" data-tip="Ajustes do painel">PAINEL</div>
            <div class="ph-setting-row" data-tip="Largura do painel encaixado, de 250 a 380 px.">
                <span class="ph-setting-label">Largura</span>
                <button type="button" class="ph-step" id="ph-width-minus">-</button>
                <span class="ph-width-value" id="ph-width-value"></span>
                <button type="button" class="ph-step" id="ph-width-plus">+</button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-update-notifications-label">Avisar sobre atualizações</span>
                <button type="button" class="ph-toggle" id="ph-update-notifications" role="switch" aria-checked="false" aria-labelledby="ph-update-notifications-label"></button>
            </div>
            <div class="ph-setting-row" id="ph-beta-channel-row" hidden>
                <span class="ph-setting-label" id="ph-beta-channel-label">Canal beta</span>
                <button type="button" class="ph-toggle" id="ph-beta-channel" role="switch" aria-checked="false" aria-labelledby="ph-beta-channel-label"></button>
            </div>
            <div class="ph-setting-row" data-tip="Desligue se as dicas atrapalharem durante a batalha.">
                <span class="ph-setting-label" id="ph-tooltips-label">Tooltips ao passar o mouse</span>
                <button type="button" class="ph-toggle" id="ph-tooltips" role="switch" aria-checked="true" aria-labelledby="ph-tooltips-label"></button>
            </div>
            <div class="ph-set-head">COMPORTAMENTO</div>
            <div class="ph-setting-row" data-tip="Qual aba o painel mostra ao carregar a página.">
                <span class="ph-setting-label">View inicial</span>
                <button type="button" class="ph-cycle" id="ph-start-view"></button>
            </div>
            <div class="ph-setting-row" data-tip="Se o painel começa aberto ou como bolha ao carregar a página.">
                <span class="ph-setting-label">Estado ao abrir</span>
                <button type="button" class="ph-cycle" id="ph-start-collapsed"></button>
            </div>
            <div class="ph-setting-row" data-tip="Trocar sozinho pra aba Encontro quando uma batalha começa.">
                <span class="ph-setting-label" id="ph-auto-battle-label">Auto-troca no encontro</span>
                <button type="button" class="ph-toggle" id="ph-auto-battle" role="switch" aria-checked="true" aria-labelledby="ph-auto-battle-label"></button>
            </div>
            <div class="ph-setting-row" data-tip="Recolher o painel pra bolha quando a batalha termina.">
                <span class="ph-setting-label" id="ph-min-after-label">Minimizar após a batalha</span>
                <button type="button" class="ph-toggle" id="ph-min-after" role="switch" aria-checked="false" aria-labelledby="ph-min-after-label"></button>
            </div>
            <div class="ph-setting-row" data-tip="Recolher o painel pra bolha ao sair da aba/tela do jogo.">
                <span class="ph-setting-label" id="ph-min-leave-label">Minimizar ao sair do jogo</span>
                <button type="button" class="ph-toggle" id="ph-min-leave" role="switch" aria-checked="true" aria-labelledby="ph-min-leave-label"></button>
            </div>
            <div class="ph-setting-row" data-tip="Ao abrir, encaixar o painel na faixa preta que o jogo deixa à esquerda.">
                <span class="ph-setting-label" id="ph-dock-gap-label">Encaixar na faixa do jogo</span>
                <button type="button" class="ph-toggle" id="ph-dock-gap" role="switch" aria-checked="true" aria-labelledby="ph-dock-gap-label"></button>
            </div>
            <div class="ph-set-head">TELAS</div>
            <div class="ph-subhead">MEUS POKÉMON</div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-mp-groups-label">Grupos já expandidos</span>
                <button type="button" class="ph-toggle" id="ph-mp-groups" role="switch" aria-checked="true" aria-labelledby="ph-mp-groups-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-mp-pokemon-label">Pokémon já expandidos</span>
                <button type="button" class="ph-toggle" id="ph-mp-pokemon" role="switch" aria-checked="false" aria-labelledby="ph-mp-pokemon-label"></button>
            </div>
            <div class="ph-subhead">BATALHA</div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-stats-label">IVs / Stats</span>
                <button type="button" class="ph-toggle" id="ph-bt-stats" role="switch" aria-checked="true" aria-labelledby="ph-bt-stats-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-weak-label">Fraquezas dele</span>
                <button type="button" class="ph-toggle" id="ph-bt-weak" role="switch" aria-checked="true" aria-labelledby="ph-bt-weak-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-moves-label">Golpes dele</span>
                <button type="button" class="ph-toggle" id="ph-bt-moves" role="switch" aria-checked="true" aria-labelledby="ph-bt-moves-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-balls-label">Pokébolas</span>
                <button type="button" class="ph-toggle" id="ph-bt-balls" role="switch" aria-checked="true" aria-labelledby="ph-bt-balls-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-stages-label">Atributos alterados</span>
                <button type="button" class="ph-toggle" id="ph-bt-stages" role="switch" aria-checked="true" aria-labelledby="ph-bt-stages-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-mymoves-label">Seus golpes</span>
                <button type="button" class="ph-toggle" id="ph-bt-mymoves" role="switch" aria-checked="true" aria-labelledby="ph-bt-mymoves-label"></button>
            </div>
            <div class="ph-subhead">ORDEM DAS SEÇÕES</div>
            <p class="ph-hint">Use ▲▼ pra reordenar as seções da aba Encontro.</p>
            <div class="ph-order-list" id="ph-order-list"></div>
            <div class="ph-set-head">APOIE O PROJETO 💛</div>
            <p class="ph-hint">A extensão é <b>gratuita</b>. Se ela te ajuda, considere uma doação — ajuda a manter e melhorar o Infinity Dex Helper. Obrigado!</p>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-donate">💛 Fazer uma doação</button>
            <div class="ph-setting-row" id="ph-pix-row" data-tip="Chave Pix para doação — clique pra copiar.">
                <span class="ph-setting-label">Chave Pix</span>
                <button type="button" class="ph-step" id="ph-pix-copy" style="width:auto;padding:0 10px;">Copiar</button>
            </div>
            <p class="ph-data-feedback" id="ph-donate-msg"></p>
            <div class="ph-set-head">DADOS</div>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-export">Exportar configurações</button>
            <p class="ph-hint">Baixa um .json só com preferências (nada de pokédex ou golpes descobertos).</p>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-import">Importar configurações</button>
            <input type="file" id="ph-import-file" accept="application/json,.json" hidden>
            <p class="ph-hint">Substitui as configurações atuais pelas do arquivo.</p>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-reset-all">Restaurar tudo</button>
            <p class="ph-data-feedback" id="ph-data-feedback"></p>
        `;

        const dataFeedback = panel.querySelector('#ph-data-feedback');
        function showDataFeedback(message, ok) {
            dataFeedback.textContent = message;
            dataFeedback.className = `ph-data-feedback ${ok ? 'ok' : 'err'}`;
        }

        panel.querySelector('#ph-export').addEventListener('click', async () => {
            try {
                const [ui, updatePrefs, overlay] = await Promise.all([
                    PokemonHelperStorage.getUiPreferences(),
                    PokemonHelperStorage.getUpdatePreferences(),
                    PokemonHelperStorage.getOverlaySettings()
                ]);
                const payload = { pokemonHelperConfig: 1, uiPreferences: ui, updatePreferences: updatePrefs, overlaySettings: overlay };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'pokemon-helper-config.json';
                link.click();
                URL.revokeObjectURL(link.href);
                showDataFeedback('CONFIGURAÇÕES EXPORTADAS', true);
            } catch (error) {
                showDataFeedback('FALHA AO EXPORTAR', false);
                console.warn('[Infinity Dex Helper] Falha ao exportar configurações:', error);
            }
        });

        // copia recursivamente só os campos que existem nos defaults e têm o
        // mesmo tipo — qualquer chave desconhecida do arquivo é descartada
        function pickKnown(defaults, source) {
            if (!source || typeof source !== 'object') return null;
            const out = {};
            Object.keys(defaults).forEach((key) => {
                if (!(key in source)) return;
                const def = defaults[key];
                if (Array.isArray(def)) {
                    // arrays (ex.: ordem das seções) são copiados inteiros, não
                    // fundidos por índice — só quando o valor importado também é array
                    if (Array.isArray(source[key])) out[key] = source[key].slice();
                } else if (def !== null && typeof def === 'object') {
                    const nested = pickKnown(def, source[key]);
                    if (nested) out[key] = nested;
                } else if (source[key] === null || def === null || typeof source[key] === typeof def) {
                    out[key] = source[key];
                }
            });
            return out;
        }

        const START_VIEW_VALUES = ['last', 'battle', 'myPokemons'];
        const START_COLLAPSED_VALUES = ['remember', 'collapsed', 'open'];

        // pickKnown só garante tipo — não garante que o valor seja um dos
        // válidos pro enum (deixaria o cycle button sem opção que bata, e
        // setActiveView() sem view pra mostrar). Roda depois do pickKnown,
        // antes de qualquer gravação; campos removidos aqui mantêm o valor
        // atual via merge do storage.
        function sanitizeUiPreferences(ui) {
            if (!ui) return ui;
            if ('startView' in ui && !START_VIEW_VALUES.includes(ui.startView)) delete ui.startView;
            if ('startCollapsed' in ui && !START_COLLAPSED_VALUES.includes(ui.startCollapsed)) delete ui.startCollapsed;
            return ui;
        }

        panel.querySelector('#ph-import').addEventListener('click', () => panel.querySelector('#ph-import-file').click());
        panel.querySelector('#ph-import-file').addEventListener('change', async (event) => {
            const file = event.target.files[0];
            event.target.value = '';
            if (!file) return;
            // vira true assim que a primeira gravação (storage ou DOM) começa —
            // a partir daí um erro não quer dizer mais "nada foi aplicado"
            let writesStarted = false;
            try {
                const parsed = JSON.parse(await file.text());
                if (!parsed || parsed.pokemonHelperConfig !== 1) throw new Error('formato desconhecido');
                const ui = sanitizeUiPreferences(pickKnown(PokemonHelperStorage.DEFAULT_UI_PREFERENCES, parsed.uiPreferences));
                const updatePrefs = pickKnown(PokemonHelperStorage.DEFAULT_UPDATE_PREFERENCES, parsed.updatePreferences);
                const overlay = pickKnown(PokemonHelperStorage.DEFAULT_OVERLAY_SETTINGS, parsed.overlaySettings);
                writesStarted = true;
                if (ui) await PokemonHelperStorage.setUiPreferences(ui);
                if (updatePrefs) await PokemonHelperStorage.setUpdatePreferences(updatePrefs);
                const container = shell.getContainer();
                if (overlay && container && container.__phSettings) {
                    // aplica a aparência importada no painel vivo (posição/tamanho),
                    // preservando aberto/visível da sessão atual
                    Object.assign(container.__phSettings, overlay, { open: true, collapsed: container.__phSettings.collapsed });
                    // mesma sincronização dataset <-> __phSettings que "Restaurar tudo"
                    // faz logo abaixo: sem isso currentSettings() lê maximized/restore*
                    // velhos do dataset (nunca tocado aqui) e persiste um estado
                    // incoerente com o que a tela acabou de mostrar
                    container.dataset.maximized = String(container.__phSettings.maximized === true);
                    container.dataset.restoreWidth = String(container.__phSettings.restoreWidth || '');
                    container.dataset.restoreRight = String(container.__phSettings.restoreRight ?? '');
                    container.dataset.restoreTop = String(container.__phSettings.restoreTop ?? '');
                    container.dataset.restoreHeight = String(container.__phSettings.restoreHeight || '');
                    shell.applyBox(container, container.__phSettings);
                    shell.syncFullSide(container, container.__phSettings);
                    shell.updateStatus(container, container.__phSettings);
                    shell.persist(shell.currentSettings(container));
                }
                showDataFeedback('CONFIGURAÇÕES IMPORTADAS', true);
            } catch (error) {
                // antes de qualquer gravação (JSON inválido ou marcador ausente):
                // nada foi tocado. Depois: alguma gravação pode ter ido pro storage
                // antes da falha, então não dá pra prometer que nada foi aplicado
                showDataFeedback(
                    writesStarted
                        ? 'FALHA AO IMPORTAR — CONFIG PODE TER SIDO APLICADA EM PARTE'
                        : 'ARQUIVO INVÁLIDO — NADA FOI APLICADO',
                    false
                );
                console.warn('[Infinity Dex Helper] Falha ao importar configurações:', error);
            }
        });

        panel.querySelector('#ph-reset-all').addEventListener('click', async () => {
            if (!window.confirm('Restaurar TODAS as configurações do Infinity Dex Helper para o padrão?')) return;
            try {
                await PokemonHelperStorage.setUiPreferences(Object.assign({}, PokemonHelperStorage.DEFAULT_UI_PREFERENCES));
                await PokemonHelperStorage.setUpdatePreferences(Object.assign({}, PokemonHelperStorage.DEFAULT_UPDATE_PREFERENCES));
                const container = shell.getContainer();
                if (container && container.__phSettings) {
                    const defaults = PokemonHelperStorage.DEFAULT_OVERLAY_SETTINGS;
                    Object.assign(container.__phSettings, {
                        top: defaults.top, right: defaults.right, width: defaults.width, height: defaults.height,
                        maximized: false, restoreWidth: null, restoreRight: null, restoreTop: null, restoreHeight: null
                    });
                    container.dataset.maximized = 'false';
                    shell.applyBox(container, container.__phSettings);
                    shell.syncFullSide(container, container.__phSettings);
                    shell.updateStatus(container, container.__phSettings);
                    shell.persist(shell.currentSettings(container));
                }
                showDataFeedback('TUDO RESTAURADO PARA O PADRÃO', true);
            } catch (error) {
                showDataFeedback('FALHA AO RESTAURAR', false);
                console.warn('[Infinity Dex Helper] Falha ao restaurar configurações:', error);
            }
        });

        const notificationsToggle = panel.querySelector('#ph-update-notifications');
        const betaToggle = panel.querySelector('#ph-beta-channel');
        const betaRow = panel.querySelector('#ph-beta-channel-row');

        function setToggleState(toggle, enabled) {
            toggle.setAttribute('aria-checked', String(enabled));
        }

        // botão que cicla entre opções [{value, label}] e persiste via save(value)
        function bindCycle(id, options, current, save) {
            const btn = panel.querySelector(`#${id}`);
            let index = Math.max(0, options.findIndex((option) => option.value === current));
            const paint = () => { btn.textContent = options[index].label; };
            paint();
            btn.addEventListener('click', () => {
                const previousIndex = index;
                index = (index + 1) % options.length;
                paint();
                save(options[index].value).catch((error) => {
                    index = previousIndex;
                    paint();
                    console.warn('[Infinity Dex Helper] Não foi possível salvar a preferência:', error);
                });
            });
        }

        function bindPrefToggle(id, current, save) {
            const toggle = panel.querySelector(`#${id}`);
            setToggleState(toggle, current);
            toggle.addEventListener('click', () => {
                const enabled = toggle.getAttribute('aria-checked') !== 'true';
                setToggleState(toggle, enabled);
                save(enabled).catch((error) => {
                    setToggleState(toggle, !enabled);
                    console.warn('[Infinity Dex Helper] Não foi possível salvar a preferência:', error);
                });
            });
        }

        function applyUpdatePreferences(preferences) {
            setToggleState(notificationsToggle, preferences.notificationsEnabled);
            setToggleState(betaToggle, preferences.betaChannelEnabled);
            betaRow.hidden = !preferences.notificationsEnabled;
        }

        PokemonHelperStorage.getUpdatePreferences()
            .then(applyUpdatePreferences)
            .catch((error) => console.warn('[Infinity Dex Helper] Não foi possível carregar preferências de atualização:', error));

        notificationsToggle.addEventListener('click', () => {
            const notificationsEnabled = notificationsToggle.getAttribute('aria-checked') !== 'true';
            setToggleState(notificationsToggle, notificationsEnabled);
            betaRow.hidden = !notificationsEnabled;
            PokemonHelperStorage.setUpdatePreferences({ notificationsEnabled }).catch((error) => {
                setToggleState(notificationsToggle, !notificationsEnabled);
                betaRow.hidden = notificationsEnabled;
                console.warn('[Infinity Dex Helper] Não foi possível salvar a preferência de atualização:', error);
            });
        });

        betaToggle.addEventListener('click', () => {
            const betaChannelEnabled = betaToggle.getAttribute('aria-checked') !== 'true';
            setToggleState(betaToggle, betaChannelEnabled);
            PokemonHelperStorage.setUpdatePreferences({ betaChannelEnabled }).catch((error) => {
                setToggleState(betaToggle, !betaChannelEnabled);
                console.warn('[Infinity Dex Helper] Não foi possível salvar a preferência do beta:', error);
            });
        });

        const widthValue = panel.querySelector('#ph-width-value');
        function applyWidth(delta) {
            const container = shell.getContainer();
            // usa o MESMO objeto que arrastar/redimensionar/maximizar mutam
            // (container.__phSettings), nunca uma cópia via currentSettings() —
            // senão a próxima ação nesses outros caminhos reverte e persiste
            // por cima da edição feita aqui.
            const settings = container && container.__phSettings;
            if (!container || !settings) return;
            if (settings.maximized) {
                settings.restoreWidth = shell.clampNum(shell.dockedWidth(settings) + delta, 250, 380, shell.dockedWidth(settings));
                container.dataset.restoreWidth = String(settings.restoreWidth);
                shell.syncFullSide(container, settings); // atualiza --ph-side-width já, pro caso o modo lado a lado esteja ativo
            } else {
                settings.width = shell.clampNum(settings.width + delta, 250, 380, settings.width);
                shell.applyBox(container, settings);
            }
            widthValue.textContent = `${shell.dockedWidth(settings)}px`;
            shell.updateStatus(container, settings);
            shell.persist(shell.currentSettings(container));
        }
        panel.querySelector('#ph-width-minus').addEventListener('click', () => applyWidth(-20));
        panel.querySelector('#ph-width-plus').addEventListener('click', () => applyWidth(20));
        widthValue.textContent = '—';
        setTimeout(() => { // preenche após o container existir
            const container = shell.getContainer();
            const settings = container && container.__phSettings;
            if (settings) widthValue.textContent = `${shell.dockedWidth(settings)}px`;
        });

        const tooltipsToggle = panel.querySelector('#ph-tooltips');
        PokemonHelperStorage.getUiPreferences()
            .then((preferences) => setToggleState(tooltipsToggle, preferences.tooltipsEnabled))
            .catch(() => {});
        tooltipsToggle.addEventListener('click', () => {
            const tooltipsEnabled = tooltipsToggle.getAttribute('aria-checked') !== 'true';
            setToggleState(tooltipsToggle, tooltipsEnabled);
            PokemonHelperStorage.setUiPreferences({ tooltipsEnabled }).catch((error) => {
                setToggleState(tooltipsToggle, !tooltipsEnabled);
                console.warn('[Infinity Dex Helper] Não foi possível salvar a preferência de tooltips:', error);
            });
        });

        // se a leitura falhar (ex.: contexto da extensão momentaneamente
        // inválido), cai pros padrões em vez de deixar TODOS os controles
        // abaixo sem listener nenhum — um erro de storage não pode travar
        // botões que não dependem de nenhum valor salvo pra funcionar.
        PokemonHelperStorage.getUiPreferences().catch((error) => {
            console.warn('[Infinity Dex Helper] Não foi possível carregar preferências, usando padrão:', error);
            return PokemonHelperStorage.DEFAULT_UI_PREFERENCES;
        }).then((prefs) => {
            bindCycle('ph-start-view', [
                { value: 'last', label: 'ÚLTIMA USADA' },
                { value: 'battle', label: 'ENCONTRO' },
                { value: 'myPokemons', label: 'MEUS POKÉMON' }
            ], prefs.startView, (startView) => PokemonHelperStorage.setUiPreferences({ startView }));

            bindCycle('ph-start-collapsed', [
                { value: 'remember', label: 'LEMBRAR' },
                { value: 'collapsed', label: 'MINIMIZADO' },
                { value: 'open', label: 'ABERTO' }
            ], prefs.startCollapsed, (startCollapsed) => PokemonHelperStorage.setUiPreferences({ startCollapsed }));

            bindPrefToggle('ph-auto-battle', prefs.autoSwitchToBattle,
                (autoSwitchToBattle) => PokemonHelperStorage.setUiPreferences({ autoSwitchToBattle }));

            bindPrefToggle('ph-min-after', prefs.minimizeAfterBattle === true,
                (minimizeAfterBattle) => PokemonHelperStorage.setUiPreferences({ minimizeAfterBattle }));

            bindPrefToggle('ph-min-leave', prefs.minimizeOnLeave !== false,
                (minimizeOnLeave) => PokemonHelperStorage.setUiPreferences({ minimizeOnLeave }));

            bindPrefToggle('ph-dock-gap', prefs.dockToGameGap !== false,
                (dockToGameGap) => PokemonHelperStorage.setUiPreferences({ dockToGameGap }));

            bindPrefToggle('ph-mp-groups', prefs.screens.myPokemons.expandGroupsByDefault,
                (v) => PokemonHelperStorage.setUiPreferences({ screens: { myPokemons: { expandGroupsByDefault: v } } }));
            bindPrefToggle('ph-mp-pokemon', prefs.screens.myPokemons.expandPokemonByDefault,
                (v) => PokemonHelperStorage.setUiPreferences({ screens: { myPokemons: { expandPokemonByDefault: v } } }));

            const battleToggles = [
                ['ph-bt-stats', 'showIvs'], ['ph-bt-weak', 'showWeaknesses'],
                ['ph-bt-moves', 'showFoeMoves'], ['ph-bt-balls', 'showPokeballs'],
                ['ph-bt-stages', 'showStatChanges'], ['ph-bt-mymoves', 'showMyMoves']
            ];
            battleToggles.forEach(([id, field]) => {
                bindPrefToggle(id, prefs.screens.battle[field],
                    (v) => PokemonHelperStorage.setUiPreferences({ screens: { battle: { [field]: v } } }));
            });

            bindBattleOrder(prefs.screens.battle.order);
        }).catch((error) => console.warn('[Infinity Dex Helper] Não foi possível carregar preferências:', error));

        // lista de reordenação das seções da aba Encontro (▲▼ move a seção
        // uma posição; salva a ordem inteira em screens.battle.order — o iframe
        // de batalha reage à mudança de storage e re-renderiza na hora)
        const orderList = panel.querySelector('#ph-order-list');
        const sectionLabels = Object.fromEntries(
            PokemonHelperStorage.BATTLE_SECTIONS.map((section) => [section.key, section.label]));

        function renderOrderList(order) {
            const clean = PokemonHelperStorage.sanitizeBattleOrder(order);
            orderList.innerHTML = clean.map((key, index) => `
                <div class="ph-order-item">
                    <span class="ph-order-label">${sectionLabels[key] || key}</span>
                    <button type="button" class="ph-order-btn" data-move="up" data-key="${key}" ${index === 0 ? 'disabled' : ''} aria-label="Mover para cima">▲</button>
                    <button type="button" class="ph-order-btn" data-move="down" data-key="${key}" ${index === clean.length - 1 ? 'disabled' : ''} aria-label="Mover para baixo">▼</button>
                </div>`).join('');
        }

        function bindBattleOrder(order) {
            renderOrderList(order);
        }

        orderList.addEventListener('click', (event) => {
            const btn = event.target.closest('.ph-order-btn');
            if (!btn || btn.disabled) return;
            PokemonHelperStorage.getUiPreferences().then((prefs) => {
                const order = PokemonHelperStorage.sanitizeBattleOrder(prefs.screens.battle.order);
                const from = order.indexOf(btn.dataset.key);
                const to = btn.dataset.move === 'up' ? from - 1 : from + 1;
                if (from < 0 || to < 0 || to >= order.length) return;
                [order[from], order[to]] = [order[to], order[from]];
                renderOrderList(order); // feedback imediato antes do storage resolver
                return PokemonHelperStorage.setUiPreferences({ screens: { battle: { order } } });
            }).catch((error) => console.warn('[Infinity Dex Helper] Não foi possível salvar a ordem das seções:', error));
        });

        // ---- Doação: link externo + copiar chave Pix ----
        // PREENCHA com seus dados de doação:
        const DONATE_URL = 'https://ko-fi.com/SEU_USUARIO';   // link de doação (Ko-fi, PayPal, etc.) — opcional
        const PIX_KEY = 'dec6216e-9365-4c69-8780-f0a0301bf39e'; // chave Pix (aleatória)

        const donateBtn = panel.querySelector('#ph-donate');
        const pixRow = panel.querySelector('#ph-pix-row');
        const pixCopy = panel.querySelector('#ph-pix-copy');
        const donateMsg = panel.querySelector('#ph-donate-msg');

        // esconde o link se ainda não foi configurado
        if (donateBtn && /SEU_USUARIO/.test(DONATE_URL)) donateBtn.style.display = 'none';
        if (pixRow && /SUA_CHAVE_PIX/.test(PIX_KEY)) pixRow.style.display = 'none';

        if (donateBtn) donateBtn.addEventListener('click', () => {
            window.open(DONATE_URL, '_blank', 'noopener,noreferrer');
        });
        if (pixCopy) pixCopy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(PIX_KEY);
                donateMsg.className = 'ph-data-feedback ok';
                donateMsg.textContent = 'CHAVE PIX COPIADA 💛';
            } catch (_) {
                donateMsg.className = 'ph-data-feedback';
                donateMsg.textContent = PIX_KEY;
            }
        });

        return panel;
}
