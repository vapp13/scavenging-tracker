# ⚙ Scavenging Tracker — Alt1 Toolkit Plugin

A real-time RuneScape 3 overlay that reads the chatbox via Alt1's OCR and
tracks every material produced by the **Scavenging** perk, with persistent
per-session counters, category summaries, and a sortable breakdown table.

---

## Contents

1. [Features & Functionality](#features--functionality)
2. [Installation](#installation)
3. [Usage](#usage)
4. [Duplicate Prevention](#duplicate-prevention)
5. [Persistence](#persistence)
6. [Troubleshooting](#troubleshooting)

---

## Features & Functionality

- **Real-time OCR Tracking** — Automatically reads your chatbox every 600 ms inside Alt1 and logs every Scavenging perk proc
- **Material Database** — Recognizes 70+ Invention materials across common, uncommon, and rare tiers
- **Summary Cards** — Displays total procs, total materials, uncommon count, and rare count at a glance
- **Sortable Table** — Click column headers to sort materials by count (default), name, or rarity
- **Unknown Materials** — Even if a material isn't in the database, it's still tracked under "Unknown"
- **Persistent Counters** — Your session data survives Alt1 restarts thanks to browser storage
- **No Manual Logging** — Everything is automatic once you open the app in Alt1

---

## Installation

### Option 1 — Quick Install (Recommended)

Copy and paste this link in your browser:

```
alt1://addapp/https://vapp13.github.io/scavenging-tracker/appconfig.json
```

This automatically opens Alt1 and adds the app in one step.

### Option 2 — Manual Install via Alt1 Browser

1. Open Alt1 Toolkit
2. Go to the **Browser** (the grid icon)
3. Paste this URL in the search bar:

```
https://vapp13.github.io/scavenging-tracker/
```

4. Click **Detect App** — Alt1 will fetch the app config automatically
5. Confirm the app details and click **Add**
---

## Usage

### Getting Started

1. Open Alt1 Toolkit (RuneScape 3 must also be running)
2. Navigate to the **Apps** section and find **Scavenging Tracker**
3. Click to open it — the app will scan your chatbox automatically

### Dashboard Overview

- **Status Indicator** (top-right) — Shows whether the chatbox is being read successfully:
  - 🟢 **Green** — Chatbox is visible and being monitored
  - 🟡 **Amber** — Waiting for a readable message
  - 🔴 **Red** — Alt1 not detected (must be running inside Alt1)

- **Summary Cards** — Quick stats at the top:
  - Total Procs — Number of Scavenging triggers
  - Total Materials — Total item count across all materials
  - Uncommon Materials — Count of uncommon-tier items
  - Rare Materials — Count of rare-tier items

- **Materials Table** — Sortable list of all materials:
  - Click **Count**, **Name**, or **Rarity** column headers to sort
  - Materials are color-coded by rarity tier

### Controls

- **Reset** — Clear all counters and start fresh (for a new session)
- **Export** — Copy your current data (for manual backup or logging)

### Supported Messages

The tracker recognizes these Scavenging message formats from your chatbox:

- `Your Scavenging perk produced 2x Deflecting Parts.`
- `Your Scavenging perk produced: 1x Base Parts.`
- `Your Scavenging perk has found you 1x Precious Components.`
- `Your Scavenging perk found you 3x Clear Parts.`
- `Scavenging: 2x Metallic Parts.`

(All patterns are case-insensitive.)

If you see Scavenging messages that aren't being tracked, please open a GitHub Issue with the exact message text.

---

## Duplicate Prevention

**Problem:** The chatbox keeps messages visible for 30–60 seconds. If we checked every message every poll cycle (600 ms), we'd count the same proc 50–100 times.

**Solution:** Snapshot-Diff Algorithm

Each time we check the chatbox, we:

1. Capture all visible chat lines as an array of strings
2. Compare against the *previous* snapshot
3. Skip any line that appeared in both snapshots (already processed)
4. Process only *new* lines (lines that weren't visible last time)

**Result:**
- ✅ Each proc counted exactly once
- ✅ Two identical procs in a row are both counted
- ✅ Chat scrolling doesn't cause re-counting
- ✅ Works reliably across long sessions

---

## Persistence

Your material counts are saved automatically to **browser storage** (localStorage) so they survive:

- Alt1 restarts
- Browser crashes
- Computer restarts

**Storage Details:**
- Key: `scav_tracker_v2`
- Location: Stored locally on your computer
- Scope: Per-device (counts don't sync across devices)

**Clearing Your Data:**
- Click the **Reset** button in the app to clear all counters
- Or manually delete the `scav_tracker_v2` entry in your browser's developer tools (F12 → Application → Local Storage)

**Version Migration:**
If the app is updated with a major data format change, old data is automatically cleared and the counter starts fresh. This prevents corrupted data from carrying over.

---

## Troubleshooting

### The app won't open in Alt1

- Make sure Alt1 Toolkit is installed and running
- RuneScape 3 must be open and in focus
- In Alt1, go to **Apps** and look for "Scavenging Tracker"

### Status dot is red ("Alt1 Not Detected")

- The tracker must be running *inside* Alt1, not in a regular browser
- Open Alt1 first, then open the app from the Apps menu

### Status dot is amber, and nothing is being counted

- Make sure your RS3 chat window is visible and not minimized
- Click on the **All** or **Game** chat tab to activate it
- The app reads whatever chat tab is currently on-screen
- Try typing something in chat to confirm it's readable
- When a message appears, the status should briefly turn green

### My counts keep resetting

- Check that your browser hasn't cleared local storage (settings → privacy)
- On some mobile browsers, closing the tab clears storage — keep the app open if possible
- If counts reset after an app update, it's due to a version mismatch — this is normal and protects data integrity

### Chatbox text isn't being recognized

The most common reasons:

1. **Font Size** — If your RS3 chat text is too small, OCR may fail. Try increasing chat text size in RS3 settings.
2. **Message Format** — Verify the message matches one of the supported formats (see [Usage — Supported Messages](#supported-messages))
3. **Chat Not Visible** — The chat tab must be active and fully visible
4. **OCR Lag** — In crowded servers, OCR might take a cycle to process. Give it a moment.

If you're confident the message format is correct and the chat is readable, open a GitHub Issue with:
- The exact message text from your chatbox
- A screenshot if possible
- Your Alt1 version

### How do I test without RuneScape?

Open the app in a regular browser at `https://vapp13.github.io/scavenging-tracker/`. A yellow banner will appear saying Alt1 is not detected. You can still use the interface, but OCR won't work.
