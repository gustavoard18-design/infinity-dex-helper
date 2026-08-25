// Roda no MAIN world em document_start (antes do jogo bootar). O Phaser 3 não
// expõe a instância do jogo no window, então interceptamos o construtor
// Phaser.Game e guardamos a instância criada em window.__pkmnGame — de onde a
// sonda (interceptor.js) lê o nome do mapa. Sem isso, não há como alcançar o
// objeto do jogo a partir de fora.
(function () {
    if (window.__pkmnHookInstalled) return;
    window.__pkmnHookInstalled = true;

    let installed = false;
    function tryHook() {
        if (installed) return true;
        const P = window.Phaser;
        if (!P || !P.Game) return false;
        const Orig = P.Game;
        function Patched() {
            const inst = new Orig(...arguments);
            try { window.__pkmnGame = inst; } catch (_) {}
            return inst;
        }
        Patched.prototype = Orig.prototype;
        try { Object.setPrototypeOf(Patched, Orig); } catch (_) {}
        try { P.Game = Patched; installed = true; return true; } catch (_) { return false; }
    }

    // Phaser pode ainda não ter carregado em document_start; tenta em intervalos
    // curtos até instalar (ou desiste após alguns segundos).
    if (!tryHook()) {
        const t = setInterval(() => { if (tryHook()) clearInterval(t); }, 25);
        setTimeout(() => clearInterval(t), 20000);
    }
})();
