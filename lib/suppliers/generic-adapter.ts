import * as cheerio from 'cheerio';
import type { SupplierAdapter, ExtractedPackageData, ExtractedItineraryDay } from './types';

/**
 * The fallback adapter — always matches, and is only ever reached when no
 * more specific adapter claims the URL (see registry.ts). It relies entirely
 * on conventions that are common but not guaranteed (Open Graph tags,
 * schema.org JSON-LD, headings that look like "Day 1" / "Inclusions" /
 * "Exclusions"), which is exactly why every extraction — from this adapter
 * or any other — lands on an editable review screen instead of being
 * trusted outright. This is the honest baseline: a page that doesn't follow
 * any of these conventions will come back mostly empty, and the caller
 * (lib/services/supplier-import.ts) turns that into a "couldn't find much
 * here, please fill in manually" message rather than a crash.
 */
function extractJsonLd($: cheerio.CheerioAPI): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // Malformed JSON-LD is common enough in the wild that we just skip it.
    }
  });
  return blocks;
}

function findSectionText($: cheerio.CheerioAPI, keywords: string[]): string[] {
  // Looks for a heading-like element whose text matches one of the keywords,
  // then reads the bullet points in the list that immediately follows it.
  const results: string[] = [];
  $('h1, h2, h3, h4, strong, b').each((_, el) => {
    const heading = $(el).text().trim().toLowerCase();
    if (!keywords.some((k) => heading.includes(k))) return;

    const list = $(el).nextAll('ul, ol').first();
    if (list.length) {
      list.find('li').each((_, li) => {
        const text = $(li).text().trim();
        if (text) results.push(text);
      });
    }
  });
  return results;
}

function findItinerary($: cheerio.CheerioAPI): ExtractedItineraryDay[] {
  const days: ExtractedItineraryDay[] = [];
  $('h2, h3, h4').each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/^day\s*(\d+)\b[:\-–]?\s*(.*)$/i);
    if (!match) return;

    const dayNumber = Number(match[1]);
    const title = (match[2] ?? '').trim() || `Day ${dayNumber}`;
    const activities: string[] = [];
    const list = $(el).nextAll('ul, ol').first();
    if (list.length) {
      list.find('li').each((_, li) => {
        const t = $(li).text().trim();
        if (t) activities.push(t);
      });
    }
    days.push({ dayNumber, title, description: '', activities });
  });
  return days.sort((a, b) => a.dayNumber - b.dayNumber);
}

export const genericAdapter: SupplierAdapter = {
  id: 'generic',
  displayName: 'Generic (best-effort)',
  matches: () => true,

  extract(html: string, url: URL): ExtractedPackageData | null {
    const $ = cheerio.load(html);
    const jsonLd = extractJsonLd($);
    const product = jsonLd.find((b) => {
      const type = b['@type'];
      return type === 'Product' || type === 'TouristTrip' || type === 'TouristAttraction' || type === 'Event';
    });

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const title = (product?.name as string) || ogTitle || $('title').first().text().trim() || '';

    const ogDescription = $('meta[property="og:description"]').attr('content');
    const description = (product?.description as string) || ogDescription || '';

    const inclusions = findSectionText($, ['inclusion', "what's included", 'included']);
    const exclusions = findSectionText($, ['exclusion', "what's not included", 'excluded', 'not included']);
    const itinerary = findItinerary($);

    if (!title && itinerary.length === 0 && inclusions.length === 0) {
      return null; // genuinely nothing usable — let the caller report a soft failure
    }

    // Duration: try "N Days / N Nights" or "N-Day" patterns anywhere in the visible text.
    const bodyText = $('body').text();
    const durationMatch = bodyText.match(/(\d+)\s*-?\s*days?\s*\/?\s*(\d+)?\s*-?\s*nights?/i);

    return {
      title,
      destination: null, // the generic adapter has no reliable signal for this; left for the agent to fill in
      durationDays: durationMatch ? Number(durationMatch[1]) : null,
      durationNights: durationMatch?.[2] ? Number(durationMatch[2]) : null,
      itinerary,
      inclusions,
      exclusions,
      pickupInfo: null,
      meals: null,
      importantNotes: description || null,
      sourceUrl: url.toString(),
      supplierName: url.hostname.replace(/^www\./, ''),
    };
  },
};
