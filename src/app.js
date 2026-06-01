/**
 * app.js — Scavenging Tracker Entry Point
 */

import { TrackerState, ChatboxWatcher } from './tracker.js';
import { initUI, renderAll, updateStatus } from './ui.js';

export const VERSION = '1.3.0';

document.addEventListener('DOMContentLoaded', () => {

    // Stamp version into toolbar immediately — confirms which build is loaded
    const vEl = document.getElementById('app-version');
    if (vEl) vEl.textContent = `v${VERSION}`;

    const tracker = new TrackerState();
    const watcher = new ChatboxWatcher(tracker);

    tracker.onUpdate(state => renderAll(state));
    watcher.onStatusChange = (status, message) => updateStatus(status, message);

    initUI(
        () => { tracker.reset(); renderAll(tracker.getState()); },
        () => renderAll(tracker.getState()),
    );

    renderAll(tracker.getState());

    // Start watcher — it polls internally for window.alt1 before proceeding,
    // so timing is no longer a problem regardless of how fast the page loads.
    watcher.start();

    // Dev helpers (tree-shaken out of production build)
    if (process.env.NODE_ENV !== 'production') {
        window.ScavDev = {
            proc(name, qty = 1) {
                const msg = `Your Scavenging perk produced ${qty}x ${name}.`;
                tracker.processLine(msg);
                console.info(`[ScavDev] Simulated: ${msg}`);
            },
            dump() {
                console.table(
                    Object.entries(tracker.getState().materials)
                        .map(([n, d]) => ({ name: n, count: d.count, category: d.category }))
                        .sort((a, b) => b.count - a.count)
                );
            },
            reset() { tracker.reset(); },

            // Simulate the chatbox border flash without needing Alt1
            flash() { console.info('[ScavDev] Flash would appear in Alt1.'); },
        };
        console.info(`[ScavTracker] v${VERSION} — dev mode. Try ScavDev.proc("Base Parts", 3)`);
    } else {
        console.info(`[ScavTracker] v${VERSION} loaded.`);
    }
});