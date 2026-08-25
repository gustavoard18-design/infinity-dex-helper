// ---------------------------------------------------------------------------
// Repassador de interação dos iframes do painel: avisa o shell (content.js)
// quando um clique dentro de um iframe rouba o foco do documento do jogo,
// pra que ele possa devolver o foco depois.
// ---------------------------------------------------------------------------
(() => {
    // só faz sentido dentro de um iframe do painel — nunca na página do jogo
    if (window.parent === window) return;

    window.addEventListener('click', (event) => {
        if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
        window.parent.postMessage({ type: 'panel-interaction' }, '*');
    });
})();
