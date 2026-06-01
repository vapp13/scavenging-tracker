/**
 * ui.js — Scavenging Tracker UI Layer
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

// ─── DOM Element Cache ────────────────────────────────────────────────────────

let $statusDot;
let $statusText;
let $totalProcs;
let $totalMaterials;
let $totalUncommon;
let $totalRare;
let $tableBody;
let $sessionStart;
let $resetBtn;
let $sortBtns;

// Previous stat values for bump animation
const _prevValues = { procs: -1, materials: -1, uncommon: -1, rare: -1 };

// Reset button confirmation state
let _resetPending = false;
let _resetTimer   = null;

// ─── Initialisation ───────────────────────────────────────────────────────────

export function initUI(onReset, onSortChange) {
    $statusDot      = document.getElementById('status-dot');
    $statusText     = document.getElementById('status-text');
    $totalProcs     = document.getElementById('total-procs');
    $totalMaterials = document.getElementById('total-materials');
    $totalUncommon  = document.getElementById('total-uncommon');
    $totalRare      = document.getElementById('total-rare');
    $tableBody      = document.getElementById('materials-body');
    $sessionStart   = document.getElementById('session-start');
    $resetBtn       = document.getElementById('reset-btn');
    $sortBtns       = document.querySelectorAll('.sort-btn');

    // ── Reset button — two-step inline confirmation ───────────────────────────
    // Alt1 (CEF browser) blocks window.confirm(), so we use a two-click pattern:
    //   First click:  button turns red and shows "CONFIRM?"
    //   Second click: actually resets
    //   No second click within 3 s: reverts to normal
    $resetBtn.addEventListener('click', () => {
        if (!_resetPending) {
            // First click — ask for confirmation
            _resetPending = true;
            $resetBtn.textContent = '✓ CONFIRM?';
            $resetBtn.classList.add('reset-confirm');

            // Auto-cancel after 3 seconds if not confirmed
            _resetTimer = setTimeout(() => {
                _cancelReset();
            }, 3000);
        } else {
            // Second click — confirmed, do the reset
            _cancelReset();
            onReset();
            _prevValues.procs     = -1;
            _prevValues.materials = -1;
            _prevValues.uncommon  = -1;
            _prevValues.rare      = -1;
        }
    });

    // ── Sort buttons ──────────────────────────────────────────────────────────
    $sortBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (currentSort === btn.dataset.sort) return;
            currentSort = btn.dataset.sort;
            $sortBtns.forEach(b => b.classList.toggle('active', b === btn));
            if (onSortChange) onSortChange(currentSort);
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

// ─── Status Indicator ─────────────────────────────────────────────────────────

const STATUS_CLASSES = ['status-idle', 'status-running', 'status-warn', 'status-error'];

const STATUS_CONFIG = {
    idle:       { cls: 'status-idle',    label: 'Idle'              },
    running:    { cls: 'status-running', label: 'Scanning'          },
    no_alt1:    { cls: 'status-error',   label: 'Alt1 Not Detected' },
    no_chatbox: { cls: 'status-warn',    label: 'Chatbox Not Found' },
    error:      { cls: 'status-error',   label: 'Error'             },
};

export function updateStatus(status, detail = '') {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
    STATUS_CLASSES.forEach(c => $statusDot.classList.remove(c));
    $statusDot.classList.add(cfg.cls);
    $statusText.textContent = cfg.label;
    detail
        ? $statusText.setAttribute('title', detail)
        : $statusText.removeAttribute('title');
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

export function renderSummary(state) {
    _updateStat($totalProcs,     state.totalProcs,     _prevValues, 'procs');
    _updateStat($totalMaterials, state.totalMaterials,  _prevValues, 'materials');
    _updateStat($totalUncommon,  state.totalUncommon,   _prevValues, 'uncommon');
    _updateStat($totalRare,      state.totalRare,        _prevValues, 'rare');

    if (state.sessionStart) {
        const d = new Date(state.sessionStart);
        $sessionStart.textContent =
            `Session: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
}

function _updateStat($el, value, prev, key) {
    const n = value || 0;
    if (n !== prev[key]) {
        $el.textContent = _fmt(n);
        if (n > prev[key] && prev[key] >= 0) {
            const card = $el.closest('.stat-card');
            if (card) {
                card.classList.remove('stat-bump');
                void card.offsetWidth;
                card.classList.add('stat-bump');
            }
        }
        prev[key] = n;
    }
}

// ─── Materials Table ──────────────────────────────────────────────────────────

export function renderTable(state) {
    const entries = Object.entries(state.materials || {}).map(([name, data]) => ({
        name,
        count:    data.count    || 0,
        category: data.category || 'common',
    }));

    if (entries.length === 0) {
        $tableBody.innerHTML =
            '<tr class="empty-row"><td colspan="3">' +
            'No materials detected yet — start killing monsters!' +
            '</td></tr>';
        return;
    }

    entries.sort(SORT_FNS[currentSort] || SORT_FNS.count);

    const frag = document.createDocumentFragment();

    for (const entry of entries) {
        const tr = document.createElement('tr');
        tr.className = `row-${entry.category}`;

        const tdName = document.createElement('td');
        tdName.className = 'col-name';
        if (entry.category === 'rare') {
            const star = document.createElement('span');
            star.className   = 'rare-star';
            star.textContent = '★ ';
            star.setAttribute('aria-hidden', 'true');
            tdName.appendChild(star);
        }
        tdName.appendChild(document.createTextNode(entry.name));
        tr.appendChild(tdName);

        const tdCount = document.createElement('td');
        tdCount.className   = 'col-count';
        tdCount.textContent = _fmt(entry.count);
        tr.appendChild(tdCount);

        const tdCat = document.createElement('td');
        tdCat.className = 'col-category';
        const badge = document.createElement('span');
        badge.className   = `badge badge-${entry.category}`;
        badge.textContent = _cap(entry.category);
        tdCat.appendChild(badge);
        tr.appendChild(tdCat);

        frag.appendChild(tr);
    }

    $tableBody.innerHTML = '';
    $tableBody.appendChild(frag);
}

// ─── Full Render ──────────────────────────────────────────────────────────────

export function renderAll(state) {
    renderSummary(state);
    renderTable(state);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _fmt(n) { return Number(n || 0).toLocaleString(); }
function _cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }