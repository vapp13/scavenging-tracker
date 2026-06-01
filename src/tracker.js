/**
 * tracker.js — Scavenging Tracker Core Logic
 *
 * Key fixes in this version:
 *   1. Alt1 timing: window.alt1 is injected ~50-200ms after page load.
 *      We now poll for it (up to 3s) instead of checking once at startup.
 *   2. Chatbox re-find: if reader.pos becomes null mid-session we re-locate.
 *   3. Overlay rect: amber border drawn around the chatbox when found,
 *      matching the visual feedback from other Alt1 plugins.
 *   4. Debug logging: every assembled chat line is logged so you can
 *      open Alt1's DevTools (right-click app → Inspect) and see what
 *      the reader is actually returning.
 */

import * as a1lib from 'alt1/base';
import ChatboxReader from 'alt1/chatbox';
import { resolveMaterial, CATEGORY } from './materials.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const SCAN_INTERVAL_MS  = 600;
const STORAGE_KEY       = 'scav_tracker_v2';

/** Amber — matches the app's UI theme */
const OVERLAY_COLOR = a1lib.mixColor(232, 160, 32);

// ─── Scavenging Patterns ──────────────────────────────────────────────────────
// Group 1 = quantity, Group 2 = material name.
// Ordered from most-specific to most-general to avoid wrong matches.
const SCAVENGING_PATTERNS = [
    /your scavenging perk produced:?\s+(\d+)\s*x\s+(.+?)\.?\s*$/i,
    /your scavenging perk has found you:?\s+(\d+)\s*x\s+(.+?)\.?\s*$/i,
    /your scavenging perk found you:?\s+(\d+)\s*x\s+(.+?)\.?\s*$/i,
    /your scavenging\s*perk\s+\w+:?\s+(\d+)\s*x\s+(.+?)\.?\s*$/i,
    /scavenging(?:\s+perk)?:?\s+(\d+)\s*x\s+(.+?)\.?\s*$/i,
    // Fallback: "2 x Base Parts" anywhere on a line with a known keyword
    /(\d+)\s+x\s+([\w '-]+(?:parts|components|junk)[\w '-]*?)(?:\.|,|$)/i,
];

// ─── State ────────────────────────────────────────────────────────────────────

function createEmptyState() {
    return {
        version:        2,
        sessionStart:   new Date().toISOString(),
        totalProcs:     0,
        totalMaterials: 0,
        totalUncommon:  0,
        totalRare:      0,
        materials:      {},
    };
}

export class TrackerState {
    constructor() {
        this.state     = createEmptyState();
        this._onUpdate = null;
        this._loadFromStorage();
    }

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.version === 2) {
                this.state = { ...createEmptyState(), ...parsed };
                console.info('[ScavTracker] State restored.');
            }
        } catch (err) {
            console.warn('[ScavTracker] Failed to restore state:', err);
        }
    }

    _saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch (err) {
            console.warn('[ScavTracker] Failed to save state:', err);
        }
    }

    onUpdate(cb) { this._onUpdate = cb; }
    getState()   { return { ...this.state }; }

    reset() {
        this.state = createEmptyState();
        this._saveToStorage();
        this._emit();
        console.info('[ScavTracker] State reset.');
    }

    processLine(text) {
        if (!text) return;
        for (const pattern of SCAVENGING_PATTERNS) {
            const match = text.match(pattern);
            if (!match) continue;
            const qty  = Math.max(1, parseInt(match[1], 10) || 1);
            const name = match[2].trim().replace(/\.$/, ''); // strip trailing dot
            if (name.length < 3) continue;
            this._record(name, qty);
            return;
        }
    }

    _record(rawName, qty) {
        const entry    = resolveMaterial(rawName);
        const category = entry ? entry.category : CATEGORY.COMMON;
        const name     = entry ? entry.name : _titleCase(rawName);

        if (!this.state.materials[name]) {
            this.state.materials[name] = { count: 0, category };
        }
        this.state.materials[name].count += qty;
        this.state.totalProcs     += 1;
        this.state.totalMaterials += qty;
        if (category === CATEGORY.RARE)     this.state.totalRare     += qty;
        if (category === CATEGORY.UNCOMMON) this.state.totalUncommon += qty;

        this._saveToStorage();
        this._emit();
        console.info(`[ScavTracker] +${qty}× ${name} (${category})`);
    }

    _emit() {
        if (this._onUpdate) this._onUpdate(this.getState());
    }
}

// ─── ChatboxWatcher ───────────────────────────────────────────────────────────

export class ChatboxWatcher {
    constructor(tracker) {
        this.tracker        = tracker;
        this.status         = 'idle';
        this.statusMessage  = '';
        this.onStatusChange = null;

        this._reader         = null;
        this._scanInterval   = null;
        this._findInterval   = null;
        this._alt1PollTimer  = null;
        this._prevSnapshot   = [];
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    start() {
        this.stop();
        this._setStatus('running', 'Waiting for Alt1…');

        // ── Wait for window.alt1 ──────────────────────────────────────────────
        // Alt1 injects window.alt1 asynchronously after the page loads.
        // A single check at startup loses the race ~20% of the time.
        // Poll every 200 ms for up to 4 seconds before giving up.
        let attempts = 0;
        this._alt1PollTimer = setInterval(() => {
            attempts++;

            if (window.alt1) {
                clearInterval(this._alt1PollTimer);
                this._alt1PollTimer = null;
                console.info('[ScavTracker] window.alt1 detected — initialising.');
                this._init();
                return;
            }

            if (attempts >= 20) { // 20 × 200ms = 4s
                clearInterval(this._alt1PollTimer);
                this._alt1PollTimer = null;
                this._setStatus('no_alt1',
                    'Alt1 not detected after 4 s. Open this app inside Alt1 Toolkit.');
            }
        }, 200);
    }

    stop() {
        if (this._scanInterval)  { clearInterval(this._scanInterval);  this._scanInterval  = null; }
        if (this._findInterval)  { clearInterval(this._findInterval);  this._findInterval  = null; }
        if (this._alt1PollTimer) { clearInterval(this._alt1PollTimer); this._alt1PollTimer = null; }
        this._setStatus('idle', '');
    }

    // ── Initialisation (called once window.alt1 is confirmed) ─────────────────

    _init() {
        try { alt1.identifyAppUrl('./appconfig.json'); } catch (_) {}

        try {
            this._reader = new ChatboxReader();
        } catch (err) {
            this._setStatus('error', `ChatboxReader failed: ${err.message}`);
            return;
        }

        // REQUIRED: without readargs.colors the reader silently ignores
        // all coloured text — Scavenging messages will never be seen.
        this._reader.readargs = {
            colors: [
                a1lib.mixColor(255, 128, 0),   // Uncommon component orange
                a1lib.mixColor(255, 165, 0),   // Scavenging message orange
                a1lib.mixColor(255,   0, 0),   // Rare component red
                a1lib.mixColor( 67, 188, 188), // Ancient component teal
                a1lib.mixColor(255, 255, 255), // White punctuation / commas
                a1lib.mixColor(  0, 255,   0), // Standard game-message green
            ],
        };

        this._setStatus('running', 'Searching for chatbox…');

        // Mirror the reference-plugin startup pattern exactly:
        // small initial delay → first find → poll every 1s until pos is set.
        setTimeout(() => {
            this._reader.find();

            this._findInterval = setInterval(() => {
                if (!this._reader.pos) {
                    this._reader.find();
                    this._setStatus('no_chatbox',
                        'Looking for chatbox — ensure the Game/All tab is visible in RS3.');
                } else {
                    clearInterval(this._findInterval);
                    this._findInterval = null;

                    // Select the first (top-most) detected chatbox
                    if (this._reader.pos.boxes?.length > 0) {
                        this._reader.pos.mainbox = this._reader.pos.boxes[0];
                    }

                    // ── Amber overlay border ──────────────────────────────────
                    // Draw a coloured rectangle around the chatbox for 3 s so
                    // the player can confirm the right box was detected.
                    this._flashChatboxBorder();

                    this._setStatus('running', 'Scanning chatbox…');
                    console.info('[ScavTracker] Chatbox found — scanning started.');

                    // Start the main scan loop
                    this._scanInterval = setInterval(() => this._tick(), SCAN_INTERVAL_MS);
                }
            }, 1000);
        }, 50);
    }

    // ── Overlay helpers ───────────────────────────────────────────────────────

    /**
     * Draw an amber rectangle around the active chatbox.
     * @param {number} [durationMs=3000]
     */
    _flashChatboxBorder(durationMs = 3000) {
        try {
            const box = this._reader.pos.mainbox;
            if (!box?.rect) return;
            const r = box.rect;
            alt1.overLayRect(
                OVERLAY_COLOR,
                r.x, r.y, r.width, r.height,
                durationMs,
                2          // border thickness in pixels
            );
        } catch (_) { /* overlay not available or pos changed */ }
    }

    // ── Scan tick ─────────────────────────────────────────────────────────────

    _tick() {
        try {
            // If reader lost its position (e.g. RS3 resized), try to re-find.
            if (!this._reader.pos) {
                this._setStatus('no_chatbox', 'Chatbox position lost — re-searching…');
                this._reader.find();
                return;
            }

            // read() returns null or [] when nothing new is visible — that's normal.
            const opts = this._reader.read();
            if (!opts || opts.length === 0) return;

            if (this.status !== 'running') {
                this._setStatus('running', 'Scanning chatbox…');
            }

            const lines = this._assembleLines(opts);

            // ── Debug: log every assembled line so you can verify what ────────
            // the reader is actually seeing. Open Alt1 DevTools with:
            //   Right-click the app window → Inspect Element → Console tab
            for (const line of lines) {
                if (line.match(/scaveng|part|component|junk/i)) {
                    console.log('[ScavTracker] Candidate line:', line);
                }
            }

            // ── Snapshot diff — process only genuinely new lines ──────────────
            const prev     = [...this._prevSnapshot];
            const newLines = [];

            for (const line of lines) {
                const idx = prev.indexOf(line);
                if (idx !== -1) {
                    prev.splice(idx, 1);
                } else {
                    newLines.push(line);
                }
            }

            for (const text of newLines) {
                this.tracker.processLine(text);
            }

            this._prevSnapshot = lines;

        } catch (err) {
            console.error('[ScavTracker] Tick error:', err);
            this._setStatus('error', err.message);
        }
    }

    // ── Line assembly ─────────────────────────────────────────────────────────

    /**
     * Convert the raw opts array from reader.read() into an array of complete
     * chat-message strings, using timestamps as line boundaries.
     * Matches the processChat() logic in the reference plugin exactly.
     *
     * @param {Array} opts
     * @returns {string[]}
     */
    _assembleLines(opts) {
        const timestampRe = /\[\d{2}:\d{2}:\d{2}\]/;
        let chatStr = '';

        for (let i = 0; i < opts.length; i++) {
            const text = (opts[i].text || '').trim();
            if (!text) continue;

            // Skip the very first fragment if it has no timestamp —
            // it's a partial line from before the current session.
            if (i === 0 && !text.match(timestampRe)) continue;

            if (text.match(timestampRe)) {
                if (chatStr) chatStr += '\n';
                chatStr += text + ' ';
            } else {
                chatStr += text;
            }
        }

        // Clean up double-x artifacts: "2 x x Base Parts" → "2 x Base Parts"
        chatStr = chatStr.replace(/(\d)\s+x\s+x\s+/g, '$1 x ');

        return chatStr.trim()
            ? chatStr.trim().split('\n').map(l => l.trim()).filter(Boolean)
            : [];
    }

    _setStatus(status, message = '') {
        this.status        = status;
        this.statusMessage = message;
        if (this.onStatusChange) this.onStatusChange(status, message);
    }
}

function _titleCase(str) {
    return str.replace(/\b\w/g, ch => ch.toUpperCase());
}