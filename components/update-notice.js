// Aviso compartilhado de atualização para as telas internas da extensão.
(function () {
    const NOTICE_ID = 'pokemon-helper-update-notice';

    async function renderUpdateNotice() {
        const [preferences, status] = await Promise.all([
            PokemonHelperStorage.getUpdatePreferences(),
            PokemonHelperStorage.getUpdateStatus()
        ]);
        const expectedChannel = preferences.betaChannelEnabled ? 'beta' : 'stable';
        const shouldShow = preferences.notificationsEnabled
            && status.updateAvailable
            && status.channel === expectedChannel;
        let notice = document.getElementById(NOTICE_ID);

        if (!shouldShow) {
            if (notice) notice.remove();
            return;
        }

        if (!notice) {
            notice = document.createElement('div');
            notice.id = NOTICE_ID;
            notice.className = 'update-notice';
            notice.setAttribute('role', 'status');
            document.body.prepend(notice);
        }
        notice.textContent = 'Atualização de versão disponível';
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        const relevantKeys = [
            PokemonHelperStorage.KEYS.updatePreferences,
            PokemonHelperStorage.KEYS.updateStatus
        ];
        if (relevantKeys.some((key) => changes[key])) {
            renderUpdateNotice().catch((error) => {
                console.warn('[Infinity Dex Helper] Não foi possível atualizar o aviso de versão:', error);
            });
        }
    });

    renderUpdateNotice().catch((error) => {
        console.warn('[Infinity Dex Helper] Não foi possível carregar o aviso de versão:', error);
    });
})();
