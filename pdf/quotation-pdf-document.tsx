import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { QuotationPdfData } from '@/lib/services/pdf-data';
import { ZENARA_LOGO_DATA_URI } from './zenara-logo';
import { GUEST_TYPE_LABELS } from '@/lib/utils/guest-pricing';

// Harbor/sand palette, matched to the app's design tokens, rendered as flat
// hex since @react-pdf/renderer doesn't read CSS variables.
const COLORS = {
  harbor900: '#222659',
  harbor700: '#3841b2',
  harbor500: '#666dcc',
  harbor100: '#E9EBFF',
  sand50: '#F8F9FC',
  sand200: '#E5E7EB',
  ink900: '#374151',
  ink700: '#576275',
  ink500: '#7e899a',
  coral500: '#F47B73',
};

// A long, fully-bulleted itinerary (one line per activity, per the spec --
// no more joining activities into a single compact line) genuinely doesn't
// fit on one page for a 4+ day trip, and the spec explicitly expects that:
// "if the itinerary is long, continue naturally onto additional pages."
// So this is no longer a forced one-pager -- sizing favors readability over
// squeezing onto a single sheet. Font sizes below were bumped up a second
// time after the first pass still read too small in practice — Helvetica
// stays (it's the standard, clean choice for this kind of document), just
// noticeably larger throughout, especially the itinerary/inclusions body
// text people actually have to read start to finish.
const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10.5, color: COLORS.ink900, paddingBottom: 46 },

  watermark: {
    position: 'absolute',
    top: '38%',
    left: '22%',
    width: 320,
    opacity: 0.06,
  },

  // Header: light, information-style block (logo + structured fields),
  // not a dark brand bar -- the spec is explicit that this should read like
  // a professional quotation's info panel, not a marketing banner.
  header: {
    paddingHorizontal: 32,
    paddingTop: 26,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  // No box/border/background around the logo — just the mark itself,
  // sized to its own natural wide-rectangle aspect ratio (roughly 300:169)
  // rather than forced into a square, which is what made it look cramped
  // even before the box existed.
  headerLogoWrap: { flexShrink: 0 },
  headerLogo: { width: 76, height: 43, objectFit: 'contain' },
  agencyName: { fontSize: 16, fontWeight: 700, color: COLORS.harbor900, marginBottom: 10 },

  // The 8 required fields, 2 per row -- kept to exactly this set per spec
  // ("do not add unnecessary company or client information").
  infoGrid: { flex: 1 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoCell: { width: '50%', flexDirection: 'row' },
  infoLabel: { fontSize: 10, color: COLORS.ink500, width: 88 },
  infoValue: { fontSize: 10.5, fontWeight: 700, color: COLORS.ink900, flex: 1 },

  headerDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.sand200, marginHorizontal: 32 },

  // Tour package title -- visually separated from the header info block,
  // not crammed into it.
  packageTitleBlock: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 12 },
  packageTitleText: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.harbor700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Package Type -- deliberately its own prominent element, not just
  // another info-grid field, since misreading All-In vs Land Arrangement
  // Only is exactly the kind of client confusion this exists to prevent.
  packageTypeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  packageTypeBadge: {
    backgroundColor: COLORS.harbor100,
    color: COLORS.harbor700,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
  },
  packageTypeNote: { fontSize: 9.5, color: COLORS.coral500, fontWeight: 700 },

  body: { paddingHorizontal: 32, paddingTop: 4 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.harbor700,
    marginBottom: 8,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Itinerary (left, wider) | Inclusions above Exclusions (right), split by
  // a visible vertical divider.
  mainSplit: { flexDirection: 'row', marginTop: 4 },
  leftCol: { flex: 1.6, paddingRight: 16 },
  rightCol: { flex: 1, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: COLORS.sand200 },
  rightColSection: { marginBottom: 16 },

  // Two-level hierarchy: the day/tour title is its own line and is never a
  // bullet; every activity is its own bulleted, indented line beneath it.
  // DAY N is an "eyebrow" label -- a standard editorial pattern (a small,
  // bold, letter-spaced marker sitting above a larger headline) -- sized
  // to actually read as a clear marker while scanning down the page, not
  // a barely-visible afterthought, and set in the same typeface as the
  // rest of the document rather than a mismatched monospace font.
  dayBlock: { marginBottom: 14 },
  dayBadge: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.harbor700,
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  dayTitle: { fontSize: 14.5, fontWeight: 700, color: COLORS.ink900, marginBottom: 5 },
  dayDescription: { fontSize: 10.5, color: COLORS.ink700, marginBottom: 4 },
  activityRow: { flexDirection: 'row', marginBottom: 3.5, paddingLeft: 4 },
  activityBullet: { fontSize: 10, color: COLORS.harbor700, width: 12 },
  activityText: { fontSize: 11, color: COLORS.ink700, flex: 1, lineHeight: 1.4 },

  listItem: { fontSize: 11, color: COLORS.ink700, lineHeight: 1.7 },

  // Full-width pricing section, placed after the two-column body -- no
  // longer a boxed-off card confined to one side of the page.
  pricingSection: { marginTop: 18, paddingTop: 14, borderTopWidth: 1.5, borderTopColor: COLORS.harbor700 },
  pricingTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.harbor700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  guestPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  guestPriceLabel: { fontSize: 12, fontWeight: 700, color: COLORS.ink900 },
  guestPriceDetail: { fontSize: 10, color: COLORS.ink500, marginTop: 2 },
  guestPriceSubtotal: { fontSize: 13, fontWeight: 700, color: COLORS.ink700 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.sand200,
    marginTop: 8,
    paddingTop: 10,
  },
  totalLabel: { fontSize: 13, fontWeight: 700, color: COLORS.ink900, textTransform: 'uppercase', letterSpacing: 0.3 },
  priceValueTotal: { fontSize: 19, fontWeight: 700, color: COLORS.harbor700 },

  termsBlock: { fontSize: 9.5, color: COLORS.ink500, lineHeight: 1.5 },
  termsTitle: { fontSize: 11, fontWeight: 700, color: COLORS.ink700, marginBottom: 4 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.harbor900,
    color: COLORS.sand50,
    paddingHorizontal: 32,
    paddingVertical: 10,
    alignItems: 'center',
    fontSize: 8.5,
  },
  footerLine: { textAlign: 'center' },
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
/**
 * Standard international spacing for a Philippine mobile number:
 * "+63 917 123 4567" rather than however it happens to be stored
 * ("+639063769898", "0906-376-9898", etc.). Only reformats spacing/
 * grouping of the actual stored number — never a different number, and
 * never invents one. Falls back to the raw stored value unchanged for
 * anything that isn't recognizably a PH mobile number (a landline, or a
 * different country's format), since guessing at a reformat for a shape
 * this function doesn't recognize risks garbling a real number.
 */
function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const withCountryCode = digits.startsWith('63') ? digits : digits.startsWith('0') ? `63${digits.slice(1)}` : digits;
  if (withCountryCode.length !== 12 || !withCountryCode.startsWith('63')) return raw;
  const national = withCountryCode.slice(2);
  return `+63 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}
function formatMoney(n: number | null, currency: string) {
  if (n === null || n === undefined) return '—';
  // The calculation itself never rounds (see guest-pricing.ts) — only this
  // final display step does, consistently to whole pesos, so amounts don't
  // show a different number of decimals depending on what a given number's
  // underlying floating-point value happens to look like.
  return `${currency} ${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function QuotationPdfDocument({ data }: { data: QuotationPdfData }) {
  const { agency, client, trip, itinerary, inclusions, exclusions, fees, pricing, quotationNumber, agent, packageTitle, validUntil } =
    data;

  const guestSummary = [
    trip.numSeniors > 0 ? `${trip.numSeniors} Senior${trip.numSeniors !== 1 ? 's' : ''}` : null,
    `${trip.numAdults} Adult${trip.numAdults !== 1 ? 's' : ''}`,
    trip.numChildren > 0 ? `${trip.numChildren} Child${trip.numChildren !== 1 ? 'ren' : ''}` : null,
    trip.numInfants > 0 ? `${trip.numInfants} Infant${trip.numInfants !== 1 ? 's' : ''}` : null,
    trip.numPwd > 0 ? `${trip.numPwd} PWD` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Document title={`${quotationNumber} — ${trip.destination}`}>
      <Page size="A4" style={styles.page}>
        {/* Uses the agency's uploaded logo for the watermark once one exists;
            falls back to the built-in default Zenara mark otherwise, so a
            fresh install still looks finished before anyone uploads a logo.
            Fixed so it repeats on every page of a multi-page itinerary. */}
        <Image src={agency.logoUrl ?? ZENARA_LOGO_DATA_URI} style={styles.watermark} fixed />

        {/* HEADER -- information-style: logo + exactly the 8 fields the spec
            calls for, nothing else. Fixed so it repeats on continuation
            pages of a long itinerary, per "maintaining the same layout and
            branding." */}
        <View style={styles.header} fixed>
          {agency.logoUrl && (
            <View style={styles.headerLogoWrap}>
              <Image src={agency.logoUrl} style={styles.headerLogo} />
            </View>
          )}
          <View style={styles.infoGrid}>
            <Text style={styles.agencyName}>{agency.name.toUpperCase()}</Text>
            <View style={styles.infoRow}>
              <InfoField label="Prepared For" value={client.name} />
              <InfoField label="Consultant" value={agent?.full_name?.split(' ')[0] ?? '—'} />
            </View>
            <View style={styles.infoRow}>
              <InfoField label="Tour Package" value={packageTitle} />
              <InfoField label="Quotation No" value={quotationNumber} />
            </View>
            <View style={styles.infoRow}>
              <InfoField label="Validity" value={validUntil ? formatDate(validUntil) : '—'} />
              <InfoField label="Travel Dates" value={`${formatDate(trip.travelStartDate)} - ${formatDate(trip.travelEndDate)}`} />
            </View>
            <View style={styles.infoRow}>
              <InfoField label="Destination" value={trip.destination} />
              <InfoField label="Guests" value={guestSummary} />
            </View>
          </View>
        </View>
        <View style={styles.headerDivider} fixed />

        {/* TOUR PACKAGE TITLE -- prominent, clearly separated from the header */}
        <View style={styles.packageTitleBlock}>
          <Text style={styles.packageTitleText}>{packageTitle}</Text>
          <View style={styles.packageTypeRow}>
            <Text style={styles.packageTypeBadge}>
              {trip.packageType === 'land_arrangement' ? 'Land Arrangement Only' : 'All-In Package'}
            </Text>
            {trip.packageType === 'land_arrangement' && <Text style={styles.packageTypeNote}>Airfare not included</Text>}
          </View>
        </View>

        <View style={styles.body}>
          {/* Itinerary (left) | Inclusions above Exclusions (right), split
              by a vertical divider. Itinerary gets more width (flex: 1.6
              vs 1) since it's reliably the longer section. */}
          <View style={styles.mainSplit}>
            <View style={styles.leftCol}>
              {itinerary.length > 0 && (
                <View>
                  <Text style={styles.sectionTitle}>Itinerary</Text>
                  {itinerary.map((day) => (
                    <View key={day.dayNumber} style={styles.dayBlock} wrap={false}>
                      <Text style={styles.dayBadge}>DAY {day.dayNumber}</Text>
                      <Text style={styles.dayTitle}>{day.title}</Text>
                      {day.description && <Text style={styles.dayDescription}>{day.description}</Text>}
                      {day.activities.map((activity, i) => (
                        <View key={i} style={styles.activityRow}>
                          <Text style={styles.activityBullet}>•</Text>
                          <Text style={styles.activityText}>{activity}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.rightCol}>
              <View style={styles.rightColSection}>
                <Text style={styles.sectionTitle}>Inclusions</Text>
                {inclusions.length === 0 && <Text style={styles.listItem}>—</Text>}
                {inclusions.map((item, i) => (
                  <Text key={i} style={styles.listItem}>
                    • {item}
                  </Text>
                ))}
              </View>
              <View>
                <Text style={styles.sectionTitle}>Exclusions</Text>
                {exclusions.length === 0 && <Text style={styles.listItem}>—</Text>}
                {exclusions.map((item, i) => (
                  <Text key={i} style={styles.listItem}>
                    • {item}
                  </Text>
                ))}
              </View>
            </View>
          </View>

          {fees.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.sectionTitle}>Additional Fees</Text>
              {fees.map((fee, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={styles.listItem}>{fee.label}</Text>
                  <Text style={styles.listItem}>{formatMoney(fee.amount, pricing.currency)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* PACKAGE PRICING -- full width, after the two-column body. One
              row per guest type actually present, never combined with
              another category's rate. Deliberately NOT wrap={false} on the
              outer section -- that forced the entire block (every guest
              row + total) to jump to a new page as one atomic unit even
              when only the first row or two would have fit, wasting the
              remaining space on the page before it and leaving the next
              page sparse. Each row is its own wrap={false} unit instead,
              so a single row's label/detail/subtotal never splits
              mid-row, but the SET of rows can flow naturally across a
              page break like any other list. The heading is grouped with
              the first row specifically so "Package Pricing" can never be
              orphaned alone at the bottom of a page with its rows pushed
              to the next one. */}
          <View style={styles.pricingSection}>
            {pricing.guestLines.map((line, i) => (
              <View key={line.guestType} wrap={false}>
                {i === 0 && <Text style={styles.pricingTitle}>Package Pricing</Text>}
                <View style={styles.guestPriceRow}>
                  <View>
                    <Text style={styles.guestPriceLabel}>{GUEST_TYPE_LABELS[line.guestType]}</Text>
                    <Text style={styles.guestPriceDetail}>
                      {line.quantity} guest{line.quantity !== 1 ? 's' : ''} × {formatMoney(line.pricePerPerson, pricing.currency)} per person
                    </Text>
                  </View>
                  <Text style={styles.guestPriceSubtotal}>{formatMoney(line.subtotal, pricing.currency)}</Text>
                </View>
              </View>
            ))}
            <View style={styles.totalRow} wrap={false}>
              <Text style={styles.totalLabel}>Total Package</Text>
              <Text style={styles.priceValueTotal}>{formatMoney(pricing.totalPrice, pricing.currency)}</Text>
            </View>
          </View>

          {/* TERMS AND CONDITIONS / PAYMENT INSTRUCTIONS -- the heading and
              body are one continuous Text block, not separate elements
              inside a wrap={false} View. A wrap={false} wrapper forced the
              ENTIRE paragraph to be treated as one atomic unit — fine for
              a short paragraph, but for a genuinely long Terms section
              (which does happen) it meant the whole thing jumped to a new
              page the moment it didn't fit in whatever space remained,
              wasting that remaining space rather than using it. Combining
              heading + body into one Text lets react-pdf's normal
              line-by-line text flow carry it across as many pages as it
              needs, while still guaranteeing the heading is never
              orphaned from its own first line -- they're the same text
              node, so they can only ever separate at a genuine line
              break, never with a boundary landing between them. */}
          <Text style={{ marginTop: 16 }}>
            <Text style={styles.termsTitle}>Terms and Conditions{'\n'}</Text>
            <Text style={styles.termsBlock}>{agency.termsAndConditions}</Text>
          </Text>
          {agency.paymentInstructions && (
            <Text style={{ marginTop: 8 }}>
              <Text style={styles.termsTitle}>Payment Instructions{'\n'}</Text>
              <Text style={styles.termsBlock}>{agency.paymentInstructions}</Text>
            </Text>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerLine}>
            {[
              agency.name,
              agency.email,
              agency.phone ? formatPhoneDisplay(agency.phone) : null,
              agency.whatsapp ? `WhatsApp: ${formatPhoneDisplay(agency.whatsapp)}` : null,
            ]
              .filter(Boolean)
              .join('   •   ')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
