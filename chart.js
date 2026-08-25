// TYPES, LABELS, ABBR, typeTagHTML vêm de components/type-tag.js
// CHART, defMultiplier, multClass, multLabel vêm de components/type-chart-data.js

// ---------- tabela completa (referência 18×18, sem controles) ----------
// cabeçalho de tipo único: ícone pixel + (opcionalmente) abreviação de 3
// letras, sobre a cor do tipo.
function headTag(type, withLabel) {
    const bg = PokemonPixelIcons.typeColor(type);
    const fg = PokemonPixelIcons.onColor(bg);
    return `<span class="head-tag" style="background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;gap:4px;padding:3px 4px;">` +
        PokemonPixelIcons.typeIcon(type, fg) +
        (withLabel ? `<span style="font-family:var(--px-font-mono);font-size:11px;">${ABBR[type]}</span>` : '') +
        `</span>`;
}

function buildChart() {
    const table = document.getElementById('type-chart');

    const thead = `<thead><tr>
    <th class="corner"></th>
    ${TYPES.map(def => `<th class="col-head" data-col="${def}" data-tip="${LABELS[def]} — defendendo (coluna)">${headTag(def, false)}</th>`).join('')}
  </tr></thead>`;

    const tbody = `<tbody>${TYPES.map(atk => {
        const cells = TYPES.map(def => {
            const v = defMultiplier(atk, [def]);
            return `<td class="chart-cell ${multClass(v)}" data-row="${atk}" data-col="${def}" data-tip="${LABELS[atk]} → ${LABELS[def]} = ${multLabel(v)}">${multLabel(v)}</td>`;
        }).join('');
        return `<tr><th class="row-head" data-row="${atk}" data-tip="${LABELS[atk]} — atacando (linha)">${headTag(atk, true)}</th>${cells}</tr>`;
    }).join('')}</tbody>`;

    table.innerHTML = thead + tbody;
}

const chartTable = document.getElementById('type-chart');
let pinnedType = null;
let pinnedAttr = null;

function headerAttr(th) {
    return th.classList.contains('row-head') ? 'row' : 'col';
}

const chartCaption = document.getElementById('chart-caption');

function updateChartCaption(type, attr) {
    if (!type || !LABELS[type]) {
        chartCaption.textContent = 'linha = atacante · coluna = defensor';
    } else if (attr === 'row') {
        chartCaption.textContent = `Atacando com ${LABELS[type]}`;
    } else {
        chartCaption.textContent = `Defendendo como ${LABELS[type]}`;
    }
}

function applyChartHighlight(type, attr) {
    const cells = chartTable.querySelectorAll('td, th.row-head, th.col-head');
    updateChartCaption(type, attr);
    if (!type) {
        cells.forEach(el => el.classList.remove('dim', 'hl'));
        return;
    }
    cells.forEach(el => {
        const matches = el.dataset[attr] === type;
        el.classList.toggle('hl', matches);
        el.classList.toggle('dim', !matches);
    });
}

chartTable.addEventListener('mouseover', (e) => {
    if (pinnedType) return; // não sobrepõe um destaque fixado por clique
    const th = e.target.closest('th.row-head, th.col-head');
    if (!th) return;
    applyChartHighlight(th.dataset.row || th.dataset.col, headerAttr(th));
});
chartTable.addEventListener('mouseout', (e) => {
    if (pinnedType) return;
    if (!e.target.closest('th.row-head, th.col-head')) return;
    applyChartHighlight(null);
});
chartTable.addEventListener('click', (e) => {
    const th = e.target.closest('th.row-head, th.col-head');
    if (!th) return;
    const type = th.dataset.row || th.dataset.col;
    const attr = headerAttr(th);
    if (pinnedType === type && pinnedAttr === attr) {
        pinnedType = null;
        pinnedAttr = null;
        applyChartHighlight(null);
    } else {
        pinnedType = type;
        pinnedAttr = attr;
        applyChartHighlight(pinnedType, pinnedAttr);
    }
});

buildChart();

// botão VOLTAR: pede ao shell pra sair do modo full e voltar às abas
document.getElementById('chart-back').addEventListener('click', () => {
    window.parent.postMessage({ type: 'panel-exit-full' }, '*');
});
