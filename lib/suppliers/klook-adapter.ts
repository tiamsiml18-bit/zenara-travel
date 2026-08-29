import * as cheerio from 'cheerio';
import type { SupplierAdapter, ExtractedPackageData } from './types';
import { genericAdapter } from './generic-adapter';

/**
 * Klook adapter.
 *
 * HONEST LIMITATION: Klook's activity pages are a client-rendered SPA — the
 * itinerary, inclusions, and most trip detail live in JavaScript-populated
 * DOM that a plain server-side fetch never sees, only the initial HTML shell
 * plus whatever the page embeds as static SEO metadata (Open Graph tags and,
 * on many listing pages, schema.org JSON-LD `Product`/`TouristAttraction`
 * data). This adapter extracts everything reliably available from that
 * static shell — title, description, and duration where Klook encodes it in
 * the URL slug or meta tags — and otherwise falls through to the generic
 * heuristics for anything else. It does not attempt to execute JavaScript or
 * simulate a browser, which would cross into "bypass the site's normal
 * access model" territory the spec explicitly rules out.
 *
 * This is exactly why every extraction result — regardless of source — lands
 * on an editable review screen rather than being trusted or saved directly:
 * for a heavy SPA like Klook, the honest expectation is "title and maybe
 * duration come through cleanly; itinerary/inclusions/exclusions will
 * usually need to be filled in by the agent," and the UI should say that
 * plainly rather than pretend otherwise.
 */
export const klookAdapter: SupplierAdapter = {
  id: 'klook',
  displayName: 'Klook',
  matches: (url) => url.hostname.toLowerCase().includes('klook.com'),

  extract(html: string, url: URL): ExtractedPackageData | null {
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
    const title = ogTitle || $('title').first().text().trim() || '';

    const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() || null;

    // Klook URLs are typically /activity/{id}-{slug-with-destination}/ — the
    // slug is a weak but often-present signal for destination, e.g.
    // "12345-ha-long-bay-cruise-from-hanoi" hints at "Ha Long Bay". This is
    // intentionally treated as a low-confidence guess: it populates the
    // field so the agent has a starting point, never as a silent authority.
    const slugMatch = url.pathname.match(/\/activity\/\d+-([a-z0-9-]+)/i);
    const slugCapture = slugMatch?.[1];
    const destinationGuess = slugCapture
      ? slugCapture
          .split('-')
          .slice(0, 4)
          .join(' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : null;

    const durationMatch = (ogDescription ?? '').match(/(\d+)\s*-?\s*days?\s*\/?\s*(\d+)?\s*-?\s*nights?/i);

    if (!title) return null; // nothing at all to work with — soft-fail to manual entry

    // Fall through to the generic adapter's structural heuristics (JSON-LD,
    // "Day N" headings, Inclusions/Exclusions lists) in case this particular
    // page happens to be server-rendered enough to expose them — some Klook
    // pages do include more static content than others.
    const genericResult = genericAdapter.extract(html, url);

    return {
      title,
      destination: destinationGuess,
      durationDays: durationMatch ? Number(durationMatch[1]) : genericResult?.durationDays ?? null,
      durationNights: durationMatch?.[2] ? Number(durationMatch[2]) : genericResult?.durationNights ?? null,
      itinerary: genericResult?.itinerary ?? [],
      inclusions: genericResult?.inclusions ?? [],
      exclusions: genericResult?.exclusions ?? [],
      pickupInfo: null,
      meals: null,
      importantNotes: ogDescription,
      sourceUrl: url.toString(),
      supplierName: 'Klook',
    };
  },
};
