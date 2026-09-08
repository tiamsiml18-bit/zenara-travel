import airportsData from '@/lib/data/airports.json';
import { formatAirportLabel, extractCodeFromLabel } from './airport-label';

// Re-exported for backward compatibility — callers that only need label
// formatting/parsing (no dataset lookup) should prefer importing
// directly from './airport-label' instead, since that file has no JSON
// dependency and keeps their own bundle lighter.
export { formatAirportLabel, extractCodeFromLabel };

export interface Airport {
  code: string; // IATA, e.g. "MNL"
  name: string; // e.g. "Ninoy Aquino International Airport"
  city: string; // e.g. "Manila"
  country: string; // ISO 2-letter, e.g. "PH"
}

const AIRPORTS = airportsData as Airport[];

const byCode = new Map<string, Airport>();
for (const a of AIRPORTS) byCode.set(a.code, a);

export function getAirportByCode(code: string): Airport | undefined {
  return byCode.get(code.trim().toUpperCase());
}

/**
 * Searches by code (exact/prefix), city, or airport name — worldwide, not
 * limited to any single country (spec: "do not limit this functionality
 * to Philippine airports"). Ranked so an exact code match and
 * city-name-starts-with matches surface first, since those are what an
 * agent typing "Manila" or "MNL" almost always means; "do not guess"
 * still holds because this only ever returns candidates for the agent to
 * pick from, it never silently resolves an ambiguous query on its own.
 */
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const scored: { airport: Airport; score: number }[] = [];
  for (const a of AIRPORTS) {
    const code = a.code.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();

    let score = -1;
    if (code === q) score = 100;
    else if (city === q) score = 95;
    else if (city.startsWith(q)) score = 80;
    else if (code.startsWith(q)) score = 75;
    else if (name.startsWith(q)) score = 60;
    else if (city.includes(q)) score = 40;
    else if (name.includes(q)) score = 30;

    if (score > 0) scored.push({ airport: a, score });
  }

  // Covers well-known destination names the raw dataset's municipality
  // field doesn't contain at all (see CITY_ALIASES above) — without
  // this, typing "Caticlan" would surface nothing to pick from, even
  // though it unambiguously means one specific airport.
  for (const [alias, code] of Object.entries(CITY_ALIASES)) {
    if (alias.startsWith(q) || q.startsWith(alias)) {
      const airport = byCode.get(code);
      if (airport && !scored.some((s) => s.airport.code === code)) {
        scored.push({ airport, score: 90 });
      }
    }
  }

  scored.sort((x, y) => y.score - x.score || x.airport.city.localeCompare(y.airport.city));
  return scored.slice(0, limit).map((s) => s.airport);
}

/**
 * A small set of explicit corrections for two recurring gaps in the raw
 * dataset, both surfaced by the spec's own examples:
 *  - the dataset's "city" is the airport's actual municipality, which
 *    for some well-known destinations differs from the name a travel
 *    agent would type (Caticlan/Boracay's airport sits in "Malay";
 *    Cebu's sits in "Lapu-Lapu City");
 *  - a few cities have two "International"-named airports where one is
 *    unambiguously the primary passenger gateway (Bangkok's Suvarnabhumi
 *    over the domestic-focused Don Mueang; Doha's current Hamad
 *    International over the long-closed old Doha International).
 * Kept deliberately tiny and explicit rather than a heuristic, so it
 * never silently "guesses" for a case not already known to be safe —
 * anything not listed here still falls through to the general
 * city-match logic below, which itself refuses to guess when genuinely
 * ambiguous (e.g. Tokyo, Seoul).
 */
const CITY_ALIASES: Record<string, string> = {
  caticlan: 'MPH',
  boracay: 'MPH',
  cebu: 'CEB',
  bangkok: 'BKK',
  doha: 'DOH',
};

/**
 * True only when the query unambiguously identifies exactly one airport
 * (an exact code match, a known alias, or a city match that's either the
 * only one for that city or clearly the major one — e.g. Manila has both
 * Ninoy Aquino International and a small US airfield that happens to
 * share the name "Manila"; preferring the sole "International" match
 * resolves that correctly without guessing between genuinely different
 * destinations like Tokyo's Narita vs Haneda, where more than one match
 * qualifies and this deliberately stays ambiguous). Any other case — no
 * match, or multiple equally-plausible airports — returns undefined so
 * the caller falls back to letting the agent choose, per spec ("do not
 * guess when the correct airport cannot be determined").
 */
export function resolveUnambiguousAirport(query: string): Airport | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  const exactCode = byCode.get(q.toUpperCase());
  if (exactCode) return exactCode;

  const aliasCode = CITY_ALIASES[q];
  if (aliasCode) return byCode.get(aliasCode);

  const cityMatches = AIRPORTS.filter((a) => a.city.toLowerCase() === q);
  if (cityMatches.length === 1) return cityMatches[0];
  if (cityMatches.length > 1) {
    const international = cityMatches.filter((a) => a.name.toLowerCase().includes('international'));
    if (international.length === 1) return international[0];
  }

  return undefined;
}
