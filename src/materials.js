/**
 * materials.js — Scavenging Tracker Material Database
 * =====================================================
 * Complete database of RuneScape 3 Invention materials,
 * categorised by rarity as produced by the Scavenging perk.
 *
 * Categories align with Scavenging perk drop tiers:
 *   common   — Basic parts, most frequently produced
 *   uncommon — Standard components, moderately rare
 *   rare     — Valuable components, rarely produced
 *
 * ADDING NEW MATERIALS:
 * Simply append an entry to MATERIALS_DATA below.
 * The rest of the app will pick it up automatically.
 *
 * Example:
 *   { name: "New Parts", category: "common" }
 */

// ─── Category Constants ──────────────────────────────────────────────────────

export const CATEGORY = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
};

// ─── Full Material Database ──────────────────────────────────────────────────

export const MATERIALS_DATA = [

    // =========================================================================
    // COMMON — Basic Parts
    // These form the bulk of Scavenging drops.
    // =========================================================================
    { name: 'Simple parts', category: 'common' },
    { name: 'Magic parts', category: 'common' },
    { name: 'Spiritual parts', category: 'common' },
    { name: 'Stave parts', category: 'common' },
    { name: 'Tensile parts', category: 'common' },
    { name: 'Head parts', category: 'common' },
    { name: 'Connector parts', category: 'common' },
    { name: 'Cover parts', category: 'common' },
    { name: 'Organic parts', category: 'common' },
    { name: 'Crafted parts', category: 'common' },
    { name: 'Plated parts', category: 'common' },
    { name: 'Padded parts', category: 'common' },
    { name: 'Crystal parts', category: 'common' },
    { name: 'Blade parts', category: 'common' },
    { name: 'Delicate parts', category: 'common' },
    { name: 'Clear parts', category: 'common' },
    { name: 'Smooth parts', category: 'common' },
    { name: 'Spiked parts', category: 'common' },
    { name: 'Deflecting parts', category: 'common' },
    { name: 'Base parts', category: 'common' },
    { name: 'Metallic parts', category: 'common' },
    { name: 'Flexible parts', category: 'common' },

    // =========================================================================
    // UNCOMMON — Standard Components
    // Produced with moderate probability by higher Scavenging ranks.
    // =========================================================================
    { name: 'Refined components', category: 'uncommon' },
    { name: 'Powerful components', category: 'uncommon' },
    { name: 'Healthy components', category: 'uncommon' },
    { name: 'Stunning components', category: 'uncommon' },
    { name: 'Enhancing components', category: 'uncommon' },
    { name: 'Evasive components', category: 'uncommon' },
    { name: 'Precious components', category: 'uncommon' },
    { name: 'Pious components', category: 'uncommon' },
    { name: 'Living components', category: 'uncommon' },
    { name: 'Ethereal components', category: 'uncommon' },
    { name: 'Variable components', category: 'uncommon' },
    { name: 'Dextrous components', category: 'uncommon' },
    { name: 'Strong components', category: 'uncommon' },
    { name: 'Swift components', category: 'uncommon' },
    { name: 'Imbued components', category: 'uncommon' },
    { name: 'Direct components', category: 'uncommon' },
    { name: 'Subtle components', category: 'uncommon' },
    { name: 'Light components', category: 'uncommon' },
    { name: 'Protective components', category: 'uncommon' },
    { name: 'Sharp components', category: 'uncommon' },
    { name: 'Heavy components', category: 'uncommon' },
    { name: 'Precise components', category: 'uncommon' },
    { name: 'Offcut components', category: 'uncommon' },

    // =========================================================================
    // RARE — Valuable Components
    // Low-probability drops; tracked separately for quick visibility.
    // =========================================================================
    { name: 'Knightly components', category: 'rare' },
    { name: 'Dragonfire components', category: 'rare' },
    { name: 'Fungal components', category: 'rare' },
    { name: 'Explosive components', category: 'rare' },
    { name: 'Corporeal components', category: 'rare' },
    { name: 'Armadyl components', category: 'rare' },
    { name: 'Bandos components', category: 'rare' },
    { name: 'Brassican components', category: 'rare' },
    { name: 'Saradomin components', category: 'rare' },
    { name: 'Seren components', category: 'rare' },
    { name: 'Zamorak components', category: 'rare' },
    { name: 'Zaros components', category: 'rare' },
    { name: 'Resilient components', category: 'rare' },
    { name: 'Silent components', category: 'rare' },
    { name: 'Noxious components', category: 'rare' },
    { name: 'Rumbling components', category: 'rare' },
    { name: 'Pestiferous components', category: 'rare' },
    { name: 'Fortunate components', category: 'rare' },
    { name: 'Third-age components', category: 'rare' }, 
    { name: 'Culinary components', category: 'rare' },
    { name: 'Shifting components', category: 'rare' },
    { name: 'Harnessed components', category: 'rare' },
    { name: 'Oceanic components', category: 'rare' },
    { name: 'Ascended components', category: 'rare' },
    { name: 'Undead components', category: 'rare' },
    { name: 'Avernic components', category: 'rare' },
    { name: 'Shadow components', category: 'rare' },
    { name: 'Ilujankan components', category: 'rare' },
    { name: 'Cywir components', category: 'rare' },
    { name: 'Faceted components', category: 'rare' },
    { name: 'Clockwork components', category: 'rare' },
    { name: 'Manufactured components', category: 'rare' },
    { name: 'Ecliptic components', category: 'rare' }
];

// ─── Lookup Helpers ──────────────────────────────────────────────────────────

/**
 * Map of lowercase name → material entry for O(1) lookup.
 * Built once at module load.
 */
export const MATERIAL_MAP = new Map(
    MATERIALS_DATA.map(m => [m.name.toLowerCase(), m])
);

/**
 * Resolve a raw OCR-detected name to a database entry.
 * Performs:
 *   1. Exact (case-insensitive) match
 *   2. Substring match (handles minor OCR artifacts)
 *
 * @param {string} rawName  Name as read from the chatbox
 * @returns {{ name: string, category: string } | null}
 */
export function resolveMaterial(rawName) {
    if (!rawName) return null;
    const normalised = rawName.trim().toLowerCase();

    // 1. Exact match
    const exact = MATERIAL_MAP.get(normalised);
    if (exact) return exact;

    // 2. Partial / fuzzy match — useful when OCR drops a character
    for (const [key, entry] of MATERIAL_MAP) {
        if (key.includes(normalised) || normalised.includes(key)) {
            return entry;
        }
    }

    return null;
}

/**
 * Return all materials belonging to a given category.
 * @param {'common'|'uncommon'|'rare'} category
 * @returns {Array<{name:string, category:string}>}
 */
export function getMaterialsByCategory(category) {
    return MATERIALS_DATA.filter(m => m.category === category);
}
