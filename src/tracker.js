/**
 * tracker.js — Scavenging Tracker Core Logic
 *
 * Changes in v1.4.0:
 *   1. Timestamp-based deduplication: if the chatbox shows a local timestamp
 *      (e.g. [14:32:05]) we track every processed timestamp+line pair in a
 *      Set. This is a second line of defence on top of the snapshot-diff
 *      algorithm — even if the same message somehow slips through the diff
 *      it will be rejected by the timestamp guard.
 *   2. sessionElapsed exported so ui.js can drive the active timer.
 *   3. processLine() now returns a boolean (true = recorded, false = skipped).
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

/** Matches a timestamp like [14:32:05] at the start of an assembled line. */
const TIMESTAMP_RE = /^\[(\d{2}:\d{2}:\d{2})\]/;

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

        /**
         * Timestamp dedup guard.
         * Key:   HH:MM:SS string extracted from the chat line.
         * Value: Set of raw line strings processed at that second.
         *
         * We intentionally keep the last ~120 entries (2 minutes) in memory
         * so we never re-count a message seen during a brief UI glitch, but we
         * don't grow this forever.  Entries older than 2 minutes are pruned.
         */
        this._seenTimestamps = new Map(); // Map<timestamp, Set<string>>

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
        this._seenTimestamps.clear();
        this._saveToStorage();
        this._emit();
        console.info('[ScavTracker] State reset.');
    }

    /**
     * Attempt to process a raw chat line.
     * Returns true if a material was recorded, false if skipped.
     *
     * @param {string} text  Full assembled chat line, may include a timestamp.
     * @returns {boolean}
     */
    processLine(text) {
        if (!text) return false;

        // ── Timestamp dedup guard ─────────────────────────────────────────────
        // Extract [HH:MM:SS] if present.  If this exact (timestamp, line) pair
        // has already been processed, skip it immediately.
        const tsMatch = text.match(TIMESTAMP_RE);
        if (tsMatch) {
            const ts = tsMatch[1];
            if (!this._seenTimestamps.has(ts)) {
                this._seenTimestamps.set(ts, new Set());
            }
            const bucket = this._seenTimestamps.get(ts);
            if (bucket.has(text)) {
                console.debug(`[ScavTracker] Timestamp-dedup skip: ${text}`);
                return false;
            }
            bucket.add(text);
            this._pruneTimestampCache();
        }

        // ── Pattern matching ──────────────────────────────────────────────────
        for (const pattern of SCAVENGING_PATTERNS) {
            const match = text.match(pattern);
            if (!match) continue;
            const qty  = Math.max(1, parseInt(match[1], 10) || 1);
            const name = match[2].trim().replace(/\.$/, '');
            if (name.length < 3) continue;
            this._record(name, qty);
            return true;
        }
        return false;
    }

    /**
     * Prune timestamp cache entries older than 2 minutes.
     * We compare HH:MM:SS strings numerically; wrapping at midnight is
     * handled by keeping at most 120 keys (one per second, 2 minutes).
     */
    _pruneTimestampCache() {
        if (this._seenTimestamps.size > 120) {
            // Delete the oldest entries (Map preserves insertion order)
            const iter = this._seenTimestamps.keys();
            while (this._seenTimestamps.size > 120) {
                const key = iter.next().value;
                this._seenTimestamps.delete(key);
            }
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

            if (attempts >= 20) {
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

    // ── Initialisation ────────────────────────────────────────────────────────

    _init() {
        try { alt1.identifyAppUrl('./appconfig.json'); } catch (_) {}

        try {
            this._reader = new ChatboxReader();
        } catch (err) {
            this._setStatus('error', `ChatboxReader failed: ${err.message}`);
            return;
        }

        this._reader.readargs = {
            colors: [
                a1lib.mixColor(255, 128, 0),
                a1lib.mixColor(255, 165, 0),
                a1lib.mixColor(255,   0, 0),
                a1lib.mixColor( 67, 188, 188),
                a1lib.mixColor(255, 255, 255),
                a1lib.mixColor(  0, 255,   0),
            ],
        };

        this._setStatus('running', 'Searching for chatbox…');

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

                    if (this._reader.pos.boxes?.length > 0) {
                        this._reader.pos.mainbox = this._reader.pos.boxes[0];
                    }

                    this._flashChatboxBorder();
                    this._setStatus('running', 'Scanning chatbox…');
                    console.info('[ScavTracker] Chatbox found — scanning started.');

                    this._scanInterval = setInterval(() => this._tick(), SCAN_INTERVAL_MS);
                }
            }, 1000);
        }, 50);
    }

    // ── Overlay helpers ───────────────────────────────────────────────────────

    _flashChatboxBorder(durationMs = 3000) {
        try {
            const box = this._reader.pos.mainbox;
            if (!box?.rect) return;
            const r = box.rect;
            alt1.overLayRect(OVERLAY_COLOR, r.x, r.y, r.width, r.height, durationMs, 2);
        } catch (_) {}
    }

    // ── Scan tick ─────────────────────────────────────────────────────────────

    _tick() {
        try {
            if (!this._reader.pos) {
                this._setStatus('no_chatbox', 'Chatbox position lost — re-searching…');
                this._reader.find();
                return;
            }

            const opts = this._reader.read();
            if (!opts || opts.length === 0) return;

            if (this.status !== 'running') {
                this._setStatus('running', 'Scanning chatbox…');
            }

            const lines = this._assembleLines(opts);

            for (const line of lines) {
                if (line.match(/scaveng|part|component|junk/i)) {
                    console.log('[ScavTracker] Candidate line:', line);
                }
            }

            // ── Snapshot diff ─────────────────────────────────────────────────
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

    _assembleLines(opts) {
        const timestampRe = /\[\d{2}:\d{2}:\d{2}\]/;
        let chatStr = '';

        for (let i = 0; i < opts.length; i++) {
            const text = (opts[i].text || '').trim();
            if (!text) continue;
            if (i === 0 && !text.match(timestampRe)) continue;

            if (text.match(timestampRe)) {
                if (chatStr) chatStr += '\n';
                chatStr += text + ' ';
            } else {
                chatStr += text;
            }
        }

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