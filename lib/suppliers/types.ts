/**
 * Supplier URL import — shared types.
 *
 * The design goal here is stated directly in the product spec: "do not
 * tightly couple the system to Klook" and "use a supplier adapter/service
 * architecture." Concretely that means:
 *   - Every supplier-specific parser implements the same `SupplierAdapter`
 *     interface and lives in its own file (klook-adapter.ts, etc).
 *   - The orchestration layer (lib/services/supplier-import.ts) never
 *     branches on "is this Klook?" — it asks the registry for whichever
 *     adapter claims the URL, falls back to a generic adapter for anything
 *     unrecognized, and treats both identically from that point on.
 *   - Adding a second real supplier later means adding one new file and one
 *     line in the registry, not touching the fetch/robots/error-handling
 *     plumbing.
 */

export interface ExtractedItineraryDay {
  dayNumber: number;
  title: string;
  description: string;
  activities: string[];
}

export interface ExtractedPackageData {
  title: string;
  destination: string | null;
  durationDays: number | null;
  durationNights: number | null;
  itinerary: ExtractedItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  pickupInfo: string | null;
  meals: string | null;
  importantNotes: string | null;
  sourceUrl: string;
  supplierName: string;
}

/**
 * A supplier-specific parser. `extract` is handed already-fetched HTML (the
 * adapter never does its own networking — see supplier-import.ts for why:
 * fetching, robots.txt compliance, and error classification are cross-
 * cutting concerns that belong in one place, not duplicated per adapter).
 *
 * `extract` returns `null` only when it found essentially nothing usable —
 * the caller treats that as a soft failure and tells the agent to enter the
 * details manually, per spec, rather than surfacing a raw parsing error.
 */
export interface SupplierAdapter {
  id: string;
  displayName: string;
  matches(url: URL): boolean;
  extract(html: string, url: URL): ExtractedPackageData | null;
}

export interface ExtractionResult {
  ok: boolean;
  data: ExtractedPackageData | null;
  /** Fields the adapter expected but couldn't find — shown to the agent so they know what to check/fill in by hand. */
  warnings: string[];
  /** Set only on a hard failure (network, robots.txt, blocked, nothing extractable at all). */
  error: string | null;
}
