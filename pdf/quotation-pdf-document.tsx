import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { QuotationPdfData } from '@/lib/services/pdf-data';
import { ZENARA_LOGO_DATA_URI } from './zenara-logo';
import { GUEST_TYPE_LABELS } from '@/lib/utils/guest-pricing';

// Harbor/sand palette, matched to the app's design tokens, rendered as flat
// hex since @react-pdf/renderer doesn't read CSS variables.
const COLORS = {
  harbor900: '#0c2020',
  harbor700: '#1a4141',
  harbor500: '#2b6868',
  harbor100: '#d3e6e6',
  sand50: '#faf8f4',
  sand200: '#e6ddcb',
  ink900: '#161b1b',
  ink700: '#3a4342',
  ink500: '#6b7473',
  coral500: '#e0693f',
};

// A long, fully-bulleted itinerary (one line per activity, per the spec --
// no more joining activities into a single compact line) genuinely doesn't
// fit on one page for a 4+ day trip, and the spec explicitly expects that:
// "if the itinerary is long, continue naturally onto additional pages."
// So this is no longer a forced one-pager -- sizing favors readability over
// squeezing onto a single sheet.
const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: COLORS.ink900, paddingBottom: 40 },

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
    paddingTop: 24,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  headerLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.sand200,
    backgroundColor: COLORS.sand50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    flexShrink: 0,
  },
  headerLogo: { width: '100%', height: '100%', objectFit: 'contain' },
  agencyName: { fontSize: 13, fontWeight: 700, color: COLORS.harbor900, marginBottom: 8 },

  // The 8 required fields, 2 per row -- kept to exactly this set per spec
  // ("do not add unnecessary company or client information").
  infoGrid: { flex: 1 },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoCell: { flex: 1, flexDirection: 'row' },
  infoLabel: { fontSize: 8, color: COLORS.ink500, width: 78 },
  infoValue: { fontSize: 8, fontWeight: 700, color: COLORS.ink900, flex: 1 },

  headerDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.sand200, marginHorizontal: 32 },

  // Tour package title -- visually separated from the header info block,
  // not crammed into it.
  packageTitleBlock: { paddingHorizontal: 32, paddingTop: 16, paddingBottom: 10 },
  packageTitleText: {
    fontSize: 15,
    fontWeight: 700,
    color: COLORS.harbor700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  body: { paddingHorizontal: 32, paddingTop: 4 },

  sectionTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    color: COLORS.harbor700,
    marginBottom: 6,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Itinerary (left, wider) | Inclusions above Exclusions (right), split by
  // a visible vertical divider.
  mainSplit: { flexDirection: 'row', marginTop: 4 },
  leftCol: { flex: 1.6, paddingRight: 16 },
  rightCol: { flex: 1, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: COLORS.sand200 },
  rightColSection: { marginBottom: 14 },

  // Two-level hierarchy: the day/tour title is its own line and is never a
  // bullet; every activity is its own bulleted, indented line beneath it.
  dayBlock: { marginBottom: 10 },
  dayBadge: {
    fontSize: 7,
    fontFamily: 'Courier',
    fontWeight: 700,
    color: COLORS.harbor700,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  dayTitle: { fontSize: 10, fontWeight: 700, color: COLORS.ink900, marginBottom: 4 },
  dayDescription: { fontSize: 8, color: COLORS.ink700, marginBottom: 3 },
  activityRow: { flexDirection: 'row', marginBottom: 2, paddingLeft: 4 },
  activityBullet: { fontSize: 8, color: COLORS.harbor700, width: 10 },
  activityText: { fontSize: 8.5, color: COLORS.ink700, flex: 1, lineHeight: 1.35 },

  listItem: { fontSize: 8.5, color: COLORS.ink700, lineHeight: 1.6 },

  // Full-width pricing section, placed after the two-column body -- no
  // longer a boxed-off card confined to one side of the page.
  pricingSection: { marginTop: 16, paddingTop: 12, borderTopWidth: 1.5, borderTopColor: COLORS.harbor700 },
  pricingTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.harbor700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  guestPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  guestPriceLabel: { fontSize: 9.5, fontWeight: 700, color: COLORS.ink900 },
  guestPriceDetail: { fontSize: 8, color: COLORS.ink500, marginTop: 1 },
  guestPriceSubtotal: { fontSize: 10.5, fontWeight: 700, color: COLORS.ink700 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.sand200,
    marginTop: 6,
    paddingTop: 8,
  },
  totalLabel: { fontSize: 10, fontWeight: 700, color: COLORS.ink900, textTransform: 'uppercase', letterSpacing: 0.3 },
  priceValueTotal: { fontSize: 16, fontWeight: 700, color: COLORS.harbor700 },

  termsBlock: { marginTop: 14, fontSize: 7, color: COLORS.ink500, lineHeight: 1.45 },
  termsTitle: { fontSize: 8.5, fontWeight: 700, color: COLORS.ink700, marginBottom: 3 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.harbor900,
    color: COLORS.sand50,
    paddingHorizontal: 32,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
  },
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatMoney(n: number | null, currency: string) {
  if (n === null || n === undefined) return '—';
  return `${currency} ${Number(n).toLocaleString('en-PH')}`;
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
              <InfoField label="Consultant" value={agent?.full_name ?? '—'} />
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
              another category's rate. */}
          <View style={styles.pricingSection} wrap={false}>
            <Text style={styles.pricingTitle}>Package Pricing</Text>
            {pricing.guestLines.map((line) => (
              <View key={line.guestType} style={styles.guestPriceRow}>
                <View>
                  <Text style={styles.guestPriceLabel}>{GUEST_TYPE_LABELS[line.guestType]}</Text>
                  <Text style={styles.guestPriceDetail}>
                    {line.quantity} guest{line.quantity !== 1 ? 's' : ''} × {formatMoney(line.pricePerPerson, pricing.currency)} per person
                  </Text>
                </View>
                <Text style={styles.guestPriceSubtotal}>{formatMoney(line.subtotal, pricing.currency)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Package</Text>
              <Text style={styles.priceValueTotal}>{formatMoney(pricing.totalPrice, pricing.currency)}</Text>
            </View>
          </View>

          <View style={styles.termsBlock}>
            <Text style={styles.termsTitle}>Terms and Conditions</Text>
            <Text>{agency.termsAndConditions}</Text>
            {agency.paymentInstructions && (
              <>
                <Text style={[styles.termsTitle, { marginTop: 8 }]}>Payment Instructions</Text>
                <Text>{agency.paymentInstructions}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {agent?.full_name ?? 'Your travel consultant'}
            {agent?.email ? `  ·  ${agent.email}` : ''}
          </Text>
          <Text>{agency.footer ?? 'Thank you for choosing ' + agency.name}</Text>
        </View>
      </Page>
    </Document>
  );
}
