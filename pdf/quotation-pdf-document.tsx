import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import type { QuotationPdfData } from '@/lib/services/pdf-data';

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

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: COLORS.ink900, paddingBottom: 56 },

  header: {
    backgroundColor: COLORS.harbor900,
    color: COLORS.sand50,
    paddingHorizontal: 36,
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  agencyName: { fontSize: 18, fontWeight: 700 },
  agencyContact: { fontSize: 8, color: COLORS.harbor100, marginTop: 4, lineHeight: 1.5 },
  quoteMeta: { alignItems: 'flex-end' },
  quoteNumber: { fontSize: 12, fontFamily: 'Courier', letterSpacing: 0.5 },
  quoteVersion: { fontSize: 8, color: COLORS.harbor100, marginTop: 2 },

  body: { paddingHorizontal: 36, paddingTop: 20 },

  customerBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.sand200,
    paddingBottom: 14,
    marginBottom: 16,
  },
  customerLabel: { fontSize: 7, textTransform: 'uppercase', color: COLORS.ink500, letterSpacing: 0.5 },
  customerValue: { fontSize: 11, marginTop: 2, fontWeight: 700 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.harbor700,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  dayBlock: { marginBottom: 10 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  dayBadge: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: COLORS.harbor700,
    backgroundColor: COLORS.harbor100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
  },
  dayTitle: { fontSize: 10.5, fontWeight: 700 },
  dayDescription: { fontSize: 9, color: COLORS.ink700, marginTop: 2, marginBottom: 3 },
  activityRow: { flexDirection: 'row', marginBottom: 1.5 },
  bullet: { width: 10, fontSize: 9, color: COLORS.harbor500 },
  activityText: { fontSize: 9, color: COLORS.ink700, flex: 1 },

  twoCol: { flexDirection: 'row', marginTop: 8, gap: 24 },
  col: { flex: 1 },

  priceBlock: {
    marginTop: 20,
    backgroundColor: COLORS.sand50,
    borderWidth: 1,
    borderColor: COLORS.sand200,
    borderRadius: 6,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: { fontSize: 8, textTransform: 'uppercase', color: COLORS.ink500, letterSpacing: 0.5 },
  priceValuePerPerson: { fontSize: 13, fontWeight: 700, marginTop: 3 },
  priceValueTotal: { fontSize: 18, fontWeight: 700, marginTop: 3, color: COLORS.harbor700 },

  termsBlock: { marginTop: 18, fontSize: 8, color: COLORS.ink500, lineHeight: 1.5 },
  termsTitle: { fontSize: 9, fontWeight: 700, color: COLORS.ink700, marginBottom: 3 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.harbor900,
    color: COLORS.sand50,
    paddingHorizontal: 36,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
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
        {/* Agency header */}
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
          {/* Customer information */}
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
          </View>

          {/* Trip overview */}
          {trip.hotelName && (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.sectionTitle}>Trip overview</Text>
              <Text style={{ fontSize: 9.5 }}>
                Hotel: {trip.hotelName}
                {trip.numBedrooms ? `  ·  ${trip.numBedrooms} bedroom${trip.numBedrooms !== 1 ? 's' : ''}` : ''}
              </Text>
            </View>
          )}

          {/* Itinerary */}
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
                  {day.activities.map((activity, i) => (
                    <View key={i} style={styles.activityRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.activityText}>{activity}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Inclusions / Exclusions */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>Inclusions</Text>
              {inclusions.length === 0 && <Text style={{ fontSize: 9, color: COLORS.ink500 }}>—</Text>}
              {inclusions.map((item, i) => (
                <View key={i} style={styles.activityRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.activityText}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={styles.col}>
              <Text style={styles.sectionTitle}>Exclusions</Text>
              {exclusions.length === 0 && <Text style={{ fontSize: 9, color: COLORS.ink500 }}>—</Text>}
              {exclusions.map((item, i) => (
                <View key={i} style={styles.activityRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.activityText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Additional fees / taxes — only shown when the agent has actually added one */}
          {fees.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.sectionTitle}>Additional Fees</Text>
              {fees.map((fee, i) => (
                <View key={i} style={[styles.activityRow, { justifyContent: 'space-between' }]}>
                  <Text style={styles.activityText}>{fee.label}</Text>
                  <Text style={{ fontSize: 9, color: COLORS.ink700 }}>
                    {formatMoney(fee.amount, pricing.currency)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Price — the only pricing shown anywhere in this document */}
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

          {/* Terms & payment */}
          <View style={styles.termsBlock}>
            <Text style={styles.termsTitle}>Terms and conditions</Text>
            <Text>{agency.termsAndConditions}</Text>
            {agency.paymentInstructions && (
              <>
                <Text style={[styles.termsTitle, { marginTop: 8 }]}>Payment instructions</Text>
                <Text>{agency.paymentInstructions}</Text>
              </>
            )}
          </View>
        </View>

        {/* Agent contact footer */}
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
