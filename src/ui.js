/**
 * ui.js — Scavenging Tracker UI Layer
 * All DOM interactions, tab switching, timer display, stats, CSV export.
 */

// ─── Sorting ──────────────────────────────────────────────────────────────────
const CATEGORY_ORDER = { rare: 0, uncommon: 1, common: 2 };
let currentSort = 'count';
const SORT_FNS = {
    count:    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    name:     (a, b) => a.name.localeCompare(b.name),
    category: (a, b) =>
        (CATEGORY_ORDER[a.category] ?? 2) - (CATEGORY_ORDER[b.category] ?? 2)
        || b.count - a.count,
};

// ─── Element cache ────────────────────────────────────────────────────────────
let $statusDot, $statusText;
let $totalProcs, $totalMaterials, $totalUncommon, $totalRare;
let $tableBody, $sessionStart;
let $resetBtn, $sortBtns;
let $sessionTimer, $statsTimer;

const _prev = { procs: -1, materials: -1, uncommon: -1, rare: -1 };
let _resetPending = false;
let _resetTimer   = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * @param {()=>void}     onReset
 * @param {()=>void}     onSortChange
 * @param {()=>void}     onExportCSV
 * @param {string}       version       e.g. '1.4.0'
 */
export function initUI(onReset, onSortChange, onExportCSV, version) {
    // Stamp version everywhere it appears
    document.querySelectorAll('#app-version, #about-version').forEach(el => {
        el.textContent = `v${version}`;
    });

    $statusDot      = document.getElementById('status-dot');
    $statusText     = document.getElementById('status-text');
    $totalProcs     = document.getElementById('total-procs');
    $totalMaterials = document.getElementById('total-materials');
    $totalUncommon  = document.getElementById('total-uncommon');
    $totalRare      = document.getElementById('total-rare');
    $tableBody      = document.getElementById('materials-body');
    $sessionTimer   = document.getElementById('session-timer');
    $statsTimer     = document.getElementById('stats-timer');
    $resetBtn       = document.getElementById('reset-btn');
    $sortBtns       = document.querySelectorAll('.sort-btn');

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const tabBtns   = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.toggle('active', b === btn));
            tabPanels.forEach(p => p.classList.toggle('active', p.id === `tab-${target}`));
        });
    });

    // ── Sort ──────────────────────────────────────────────────────────────────
    $sortBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentSort === btn.dataset.sort) return;
            currentSort = btn.dataset.sort;
            $sortBtns.forEach(b => b.classList.toggle('active', b === btn));
            onSortChange();
        });
    });

    // ── Reset — two-click inline confirmation (window.confirm blocked in CEF) ─
    $resetBtn.addEventListener('click', () => {
        if (!_resetPending) {
            _resetPending = true;
            $resetBtn.textContent = '✓ CONFIRM?';
            $resetBtn.classList.add('reset-confirm');
            _resetTimer = setTimeout(_cancelReset, 3000);
        } else {
            _cancelReset();
            onReset();
            Object.keys(_prev).forEach(k => (_prev[k] = -1));
        }
    });

    // ── Export CSV ────────────────────────────────────────────────────────────
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) exportBtn.addEventListener('click', onExportCSV);

    // ── About links — open in system browser ──────────────────────────────────
    document.querySelectorAll('.about-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const url = link.getAttribute('href');
            if (url && url.startsWith('http')) {
                window.open(url, '_blank');
            }
        });
    });
}

function _cancelReset() {
    _resetPending = false;
    clearTimeout(_resetTimer);
    _resetTimer = null;
    $resetBtn.innerHTML = '<span class="reset-icon">↺</span> RESET';
    $resetBtn.classList.remove('reset-confirm');
}

// ─── Status ───────────────────────────────────────────────────────────────────
const _statusClasses = ['status-idle','status-running','status-warn','status-error'];
const _statusCfg = {
    idle:       { cls: 'status-idle',    label: 'Idle'              },
    running:    { cls: 'status-running', label: 'Scanning'          },
    no_alt1:    { cls: 'status-error',   label: 'Alt1 Not Detected' },
    no_chatbox: { cls: 'status-warn',    label: 'Chatbox Not Found' },
    error:      { cls: 'status-error',   label: 'Error'             },
};
export function updateStatus(status, detail = '') {
    const cfg = _statusCfg[status] || _statusCfg.idle;
    _statusClasses.forEach(c => $statusDot.classList.remove(c));
    $statusDot.classList.add(cfg.cls);
    $statusText.textContent = cfg.label;
    detail ? $statusText.setAttribute('title', detail) : $statusText.removeAttribute('title');
}

// ─── Timer display ────────────────────────────────────────────────────────────
/**
 * Update both timer elements (tracker footer + stats tab hero).
 * @param {number} elapsedMs
 */
export function updateTimers(elapsedMs) {
    const str = _fmtDuration(elapsedMs);
    if ($sessionTimer) $sessionTimer.textContent = str;
    if ($statsTimer)   $statsTimer.textContent   = str;
}

// ─── Summary cards ────────────────────────────────────────────────────────────
export function renderSummary(state) {
    _setStat($totalProcs,     state.totalProcs,     'procs');
    _setStat($totalMaterials, state.totalMaterials, 'materials');
    _setStat($totalUncommon,  state.totalUncommon,  'uncommon');
    _setStat($totalRare,      state.totalRare,      'rare');
}
function _setStat($el, value, key) {
    const n = value || 0;
    if (n === _prev[key]) return;
    $el.textContent = _fmt(n);
    if (n > _prev[key] && _prev[key] >= 0) {
        const card = $el.closest('.stat-card');
        if (card) { card.classList.remove('stat-bump'); void card.offsetWidth; card.classList.add('stat-bump'); }
    }
    _prev[key] = n;
}

// ─── Materials table ──────────────────────────────────────────────────────────
export function renderTable(state) {
    const entries = Object.entries(state.materials || {})
        .map(([name, d]) => ({ name, count: d.count || 0, category: d.category || 'common' }));

    if (!entries.length) {
        $tableBody.innerHTML = '<tr class="empty-row"><td colspan="3">No materials detected yet — start killing monsters!</td></tr>';
        return;
    }

    entries.sort(SORT_FNS[currentSort] || SORT_FNS.count);
    const frag = document.createDocumentFragment();

    for (const e of entries) {
        const tr = document.createElement('tr');
        tr.className = `row-${e.category}`;

        const tdN = document.createElement('td'); tdN.className = 'col-name';
        if (e.category === 'rare') {
            const star = document.createElement('span');
            star.className = 'rare-star'; star.textContent = '★ ';
            star.setAttribute('aria-hidden','true');
            tdN.appendChild(star);
        }
        tdN.appendChild(document.createTextNode(e.name));
        tr.appendChild(tdN);

        const tdC = document.createElement('td'); tdC.className = 'col-count'; tdC.textContent = _fmt(e.count); tr.appendChild(tdC);

        const tdR = document.createElement('td'); tdR.className = 'col-category';
        const badge = document.createElement('span');
        badge.className = `badge badge-${e.category}`; badge.textContent = _cap(e.category);
        tdR.appendChild(badge); tr.appendChild(tdR);

        frag.appendChild(tr);
    }
    $tableBody.innerHTML = '';
    $tableBody.appendChild(frag);
}

// ─── Stats panel ──────────────────────────────────────────────────────────────
/**
 * Update the Stats tab with current rates.
 * Call every second from the timer interval.
 * @param {object} state
 * @param {number} elapsedMs
 */
export function renderStats(state, elapsedMs) {
    const elMin = elapsedMs / 60000;
    const elHr  = elapsedMs / 3600000;
    const safe  = (n, d) => d > 0.01 ? (n / d).toFixed(1) : '—';
    const safeI = (n, d) => d > 0.01 ? Math.round(n / d).toString() : '—';

    _setText('stat-procs-min',   safe (state.totalProcs,     elMin));
    _setText('stat-procs-hr',    safeI(state.totalProcs,     elHr));
    _setText('stat-mats-min',    safe (state.totalMaterials, elMin));
    _setText('stat-mats-hr',     safeI(state.totalMaterials, elHr));
    _setText('stat-uncommon-hr', safeI(state.totalUncommon,  elHr));
    _setText('stat-rare-hr',     safeI(state.totalRare,      elHr));

    const commonCount = Math.max(0, state.totalMaterials - state.totalUncommon - state.totalRare);
    const total = state.totalMaterials || 1;

    _setWidth('bar-common',   (commonCount           / total * 100).toFixed(1));
    _setWidth('bar-uncommon', (state.totalUncommon   / total * 100).toFixed(1));
    _setWidth('bar-rare',     (state.totalRare        / total * 100).toFixed(1));

    _setText('count-common',   _fmt(commonCount));
    _setText('count-uncommon', _fmt(state.totalUncommon));
    _setText('count-rare',     _fmt(state.totalRare));
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
export function exportToCSV(state) {
    const rows = [['Material', 'Count', 'Category']];
    Object.entries(state.materials || {})
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([name, d]) => rows.push([name, d.count, d.category]));

    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `scavenging_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Full render ──────────────────────────────────────────────────────────────
export function renderAll(state) {
    renderSummary(state);
    renderTable(state);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _fmt(n)    { return Number(n || 0).toLocaleString(); }
function _cap(s)    { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function _setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function _setWidth(id, pct) { const el = document.getElementById(id); if (el) el.style.width = `${pct}%`; }

function _fmtDuration(ms) {
    const s   = Math.max(0, Math.floor(ms / 1000));
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${_pad(h)}:${_pad(m)}:${_pad(sec)}`;
}
function _pad(n) { return String(n).padStart(2, '0'); }