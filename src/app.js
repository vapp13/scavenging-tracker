/**
 * app.js — Scavenging Tracker Entry Point
 */

// CSS is bundled by style-loader — import here so webpack includes it
import '../style.css';

// Import icon + appconfig so webpack copies them to dist/
import '../icon.png';
import '../appconfig.json';

import { TrackerState, ChatboxWatcher } from './tracker.js';
import { initUI, renderAll, renderStats, updateStatus, updateTimers, exportToCSV } from './ui.js';

export const VERSION = '1.4.0';

document.addEventListener('DOMContentLoaded', () => {

    const tracker = new TrackerState();
    const watcher = new ChatboxWatcher(tracker);

    tracker.onUpdate(state => renderAll(state));
    watcher.onStatusChange = (status, message) => updateStatus(status, message);

    initUI(
        // onReset
        () => {
            tracker.reset();
            const s = tracker.getState();
            renderAll(s);
            renderStats(s, 0);
            updateTimers(0);
        },
        // onSortChange
        () => renderAll(tracker.getState()),
        // onExportCSV
        () => exportToCSV(tracker.getState()),
        // version string
        VERSION,
    );

    renderAll(tracker.getState());
    watcher.start();

    // ── Active timer ───────────────────────────────────────────────────────────
    // Ticks every second regardless of chat activity.
    // Reads sessionStart from state so reset is automatic — no need to restart.
    setInterval(() => {
        const state   = tracker.getState();
        const elapsed = Date.now() - new Date(state.sessionStart).getTime();
        updateTimers(elapsed);
        renderStats(state, elapsed);
    }, 1000);

    // Dev helpers
    if (process.env.NODE_ENV !== 'production') {
        window.ScavDev = {
            proc(name, qty = 1) {
                const msg = `Your Scavenging perk produced ${qty}x ${name}.`;
                tracker.processLine(msg);
                console.info(`[ScavDev] Simulated: ${msg}`);
            },
            dump()  { console.table(Object.entries(tracker.getState().materials).map(([n,d])=>({name:n,count:d.count,category:d.category})).sort((a,b)=>b.count-a.count)); },
            reset() { tracker.reset(); },
        };
        console.info(`[ScavTracker] v${VERSION} — dev mode. ScavDev.proc("Base Parts", 3)`);
    } else {
        console.info(`[ScavTracker] v${VERSION} loaded.`);
    }
});