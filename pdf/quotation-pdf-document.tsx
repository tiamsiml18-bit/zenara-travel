import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { QuotationPdfData } from '@/lib/services/pdf-data';
import { ZENARA_LOGO_DATA_URI } from './zenara-logo';

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

// Deliberately tight throughout — the brief is a one-page brochure, not a
// multi-page document, so every size/spacing choice below trades a little
// breathing room for fitting a typical 3-6 day itinerary on a single page.
const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: COLORS.ink900, paddingBottom: 40 },

  watermark: {
    position: 'absolute',
    top: '38%',
    left: '22%',
    width: 320,
    opacity: 0.06,
  },

  header: {
    backgroundColor: COLORS.harbor900,
    color: COLORS.sand50,
    paddingHorizontal: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  agencyName: { fontSize: 15, fontWeight: 700 },
  agencyContact: { fontSize: 7, color: COLORS.harbor100, marginTop: 3, lineHeight: 1.4 },
  quoteMeta: { alignItems: 'flex-end' },
  quoteNumber: { fontSize: 11, fontFamily: 'Courier', letterSpacing: 0.5 },
  quoteVersion: { fontSize: 7, color: COLORS.harbor100, marginTop: 2 },

  body: { paddingHorizontal: 32, paddingTop: 12 },

  customerBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.sand200,
    paddingBottom: 9,
    marginBottom: 10,
  },
  customerLabel: { fontSize: 6.5, textTransform: 'uppercase', color: COLORS.ink500, letterSpacing: 0.5 },
  customerValue: { fontSize: 9.5, marginTop: 1, fontWeight: 700 },

  sectionTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    color: COLORS.harbor700,
    marginBottom: 5,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  dayBlock: { marginBottom: 6 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  dayBadge: {
    fontSize: 7,
    fontFamily: 'Courier',
    color: COLORS.harbor700,
    backgroundColor: COLORS.harbor100,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    marginRight: 6,
  },
  dayTitle: { fontSize: 9.5, fontWeight: 700 },
  dayDescription: { fontSize: 8, color: COLORS.ink700, marginTop: 1, marginBottom: 1.5 },
  dayActivities: { fontSize: 8, color: COLORS.ink700, lineHeight: 1.45 },

  twoCol: { flexDirection: 'row', marginTop: 6, gap: 20 },
  col: { flex: 1 },
  listItem: { fontSize: 8, color: COLORS.ink700, lineHeight: 1.5 },

  priceBlock: {
    marginTop: 10,
    backgroundColor: COLORS.sand50,
    borderWidth: 1,
    borderColor: COLORS.sand200,
    borderRadius: 5,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: { fontSize: 7, textTransform: 'uppercase', color: COLORS.ink500, letterSpacing: 0.5 },
  priceValuePerPerson: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  priceValueTotal: { fontSize: 15, fontWeight: 700, marginTop: 2, color: COLORS.harbor700 },

  termsBlock: { marginTop: 9, fontSize: 6.5, color: COLORS.ink500, lineHeight: 1.4 },
  termsTitle: { fontSize: 7.5, fontWeight: 700, color: COLORS.ink700, marginBottom: 2 },

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

export function QuotationPdfDocument({ data }: { data: QuotationPdfData }) {
  const { agency, client, trip, itinerary, inclusions, exclusions, fees, pricing, quotationNumber, versionLabel, agent } =
    data;

  return (
    <Document title={`${quotationNumber} — ${trip.destination}`}>
      <Page size="A4" style={styles.page}>
        <Image src={ZENARA_LOGO_DATA_URI} style={styles.watermark} fixed />

        <View style={styles.header}>
          <View>
            <Text style={styles.agencyName}>{agency.name}</Text>
            <Text style={styles.agencyContact}>
              {[agency.phone, agency.email, agency.website].filter(Boolean).join('   ·   ')}
            </Text>
            {(agency.facebook || agency.instagram || agency.whatsapp) && (
              <Text style={styles.agencyContact}>
                {[
                  agency.facebook && `FB: ${agency.facebook}`,
                  agency.instagram && `IG: ${agency.instagram}`,
                  agency.whatsapp && `WhatsApp: ${agency.whatsapp}`,
                ]
                  .filter(Boolean)
                  .join('   ·   ')}
              </Text>
            )}
          </View>
          <View style={styles.quoteMeta}>
            <Text style={styles.quoteNumber}>{quotationNumber}</Text>
            <Text style={styles.quoteVersion}>{versionLabel}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.customerBlock}>
            <View>
              <Text style={styles.customerLabel}>Prepared for</Text>
              <Text style={styles.customerValue}>{client.name}</Text>
            </View>
            <View>
              <Text style={styles.customerLabel}>Destination</Text>
              <Text style={styles.customerValue}>{trip.destination}</Text>
            </View>
            <View>
              <Text style={styles.customerLabel}>Travel dates</Text>
              <Text style={styles.customerValue}>
                {formatDate(trip.travelStartDate)} – {formatDate(trip.travelEndDate)}
              </Text>
            </View>
            <View>
              <Text style={styles.customerLabel}>Guests</Text>
              <Text style={styles.customerValue}>
                {trip.numAdults} adult{trip.numAdults !== 1 ? 's' : ''}
                {trip.numChildren > 0 ? `, ${trip.numChildren} child${trip.numChildren !== 1 ? 'ren' : ''}` : ''}
              </Text>
            </View>
            {trip.hotelName && (
              <View>
                <Text style={styles.customerLabel}>Hotel</Text>
                <Text style={styles.customerValue}>
                  {trip.hotelName}
                  {trip.numBedrooms ? ` · ${trip.numBedrooms}BR` : ''}
                </Text>
              </View>
            )}
          </View>

          {itinerary.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Itinerary</Text>
              {itinerary.map((day) => (
                <View key={day.dayNumber} style={styles.dayBlock} wrap={false}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayBadge}>Day {day.dayNumber}</Text>
                    <Text style={styles.dayTitle}>{day.title}</Text>
                  </View>
                  {day.description && <Text style={styles.dayDescription}>{day.description}</Text>}
                  {day.activities.length > 0 && (
                    <Text style={styles.dayActivities}>{day.activities.join('  ·  ')}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>Inclusions</Text>
              {inclusions.length === 0 && <Text style={styles.listItem}>—</Text>}
              {inclusions.map((item, i) => (
                <Text key={i} style={styles.listItem}>
                  • {item}
                </Text>
              ))}
            </View>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>Exclusions</Text>
              {exclusions.length === 0 && <Text style={styles.listItem}>—</Text>}
              {exclusions.map((item, i) => (
                <Text key={i} style={styles.listItem}>
                  • {item}
                </Text>
              ))}
            </View>
          </View>

          {fees.length > 0 && (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.sectionTitle}>Additional Fees</Text>
              {fees.map((fee, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1.5 }}>
                  <Text style={styles.listItem}>{fee.label}</Text>
                  <Text style={styles.listItem}>{formatMoney(fee.amount, pricing.currency)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.priceBlock}>
            <View>
              <Text style={styles.priceLabel}>Package rate</Text>
              <Text style={styles.priceValuePerPerson}>
                {pricing.pricePerPerson ? `${formatMoney(pricing.pricePerPerson, pricing.currency)} / person` : '—'}
              </Text>
            </View>
            <View>
              <Text style={styles.priceLabel}>Total tour package</Text>
              <Text style={styles.priceValueTotal}>{formatMoney(pricing.totalPrice, pricing.currency)}</Text>
            </View>
          </View>

          <View style={styles.termsBlock}>
            <Text style={styles.termsTitle}>Terms and conditions</Text>
            <Text>{agency.termsAndConditions}</Text>
            {agency.paymentInstructions && (
              <>
                <Text style={[styles.termsTitle, { marginTop: 5 }]}>Payment instructions</Text>
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
