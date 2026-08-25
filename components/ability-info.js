var PokemonAbilityInfo = globalThis.PokemonAbilityInfo || (() => {
    function normalize(value) {
        return String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
    }

    function label(value) {
        if (!value) return '—';
        return String(value).replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    async function hydrate(root = document) {
        const nodes = [...root.querySelectorAll('[data-ability]')];
        if (!nodes.length || typeof PokemonHelperStorage === 'undefined') return;
        try {
            const cached = await PokemonHelperStorage.getAbilities();
            const items = Array.isArray(cached.items) ? cached.items : [];
            const bySlug = new Map(items.map((item) => [normalize(item.slug || item.name), item]));
            nodes.forEach((node) => {
                const item = bySlug.get(normalize(node.dataset.ability));
                const name = item?.name || label(node.dataset.ability);
                const description = item?.desc || item?.description || item?.effect;
                node.innerHTML = '';
                node.append(document.createTextNode(name));
                if (description) {
                    // ícone/caixa padrão do design system (components/tooltip.js)
                    const info = document.createElement('span');
                    info.className = 'px-tip-icon';
                    info.tabIndex = 0;
                    info.setAttribute('role', 'img');
                    info.setAttribute('aria-label', `${name}: ${description}`);
                    info.dataset.tip = description;
                    info.textContent = 'ⓘ';
                    node.append(document.createTextNode(' '), info);
                }
            });
        } catch (error) {
            console.warn('[Infinity Dex Helper] Não foi possível carregar habilidades:', error);
        }
    }

    return Object.freeze({ normalize, label, hydrate });
})();
globalThis.PokemonAbilityInfo = PokemonAbilityInfo;
