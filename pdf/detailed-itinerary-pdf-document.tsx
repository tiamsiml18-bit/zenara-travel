import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { DetailedItineraryPdfData } from '@/lib/services/pdf-data';
import { ZENARA_LOGO_DATA_URI } from './zenara-logo';

// ============================================================================
// Detailed Itinerary PDF — a fully independent document from
// quotation-pdf-document.tsx. Zero shared styling, layout, or data path;
// the only thing the two documents have in common is the Zenara brand
// (logo, color palette) and the agency_settings read used to build
// `agency` on either data object. Intentionally duplicates (rather than
// imports) the color palette and small formatting helpers below instead
// of reaching into the quotation PDF file, so a future change to one
// document can never accidentally affect the other.
// ============================================================================

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

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10.5, color: COLORS.ink900, paddingBottom: 46 },

  watermark: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 440,
    marginTop: -124.35,
    marginLeft: -220,
    opacity: 0.06,
  },

  header: {
    paddingHorizontal: 32,
    paddingTop: 26,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  headerLogoWrap: { flexShrink: 0 },
  headerLogo: { width: 76, height: 43, objectFit: 'contain' },
  agencyName: { fontSize: 16, fontWeight: 700, color: COLORS.harbor900, marginBottom: 10 },

  infoGrid: { flex: 1 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoCell: { flexDirection: 'row' },
  infoLabel: { fontSize: 10, color: COLORS.ink500, width: 90 },
  infoValue: { fontSize: 10.5, fontWeight: 700, color: COLORS.ink900, flex: 1 },

  headerDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.sand200, marginHorizontal: 32 },

  titleBlock: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 12 },
  titleText: { fontSize: 18, fontWeight: 700, color: COLORS.harbor700, textTransform: 'uppercase', letterSpacing: 0.4 },
  titleSubtext: { fontSize: 10.5, color: COLORS.ink500, marginTop: 4 },

  body: { paddingHorizontal: 32, paddingTop: 4 },

  sectionBlock: { marginTop: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.harbor700,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: COLORS.sand200,
    borderRadius: 4,
    padding: 12,
  },
  fieldRow: { flexDirection: 'row', marginBottom: 5 },
  fieldLabel: { fontSize: 9.5, color: COLORS.ink500, width: 110 },
  fieldValue: { fontSize: 10.5, color: COLORS.ink900, flex: 1, lineHeight: 1.4 },
  noteText: { fontSize: 10, color: COLORS.ink700, lineHeight: 1.5, marginTop: 4 },

  dayBlock: { marginBottom: 14 },
  dayBadge: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.harbor700, letterSpacing: 1.1, marginBottom: 3 },
  dayTitle: { fontSize: 13.5, fontWeight: 700, color: COLORS.ink900, marginBottom: 4 },
  dayDescription: { fontSize: 10.5, color: COLORS.ink700, marginBottom: 4 },
  activityRow: { flexDirection: 'row', marginBottom: 3, paddingLeft: 4 },
  activityBullet: { fontSize: 10, color: COLORS.harbor700, width: 12 },
  activityText: { fontSize: 10.5, color: COLORS.ink700, flex: 1, lineHeight: 1.4 },
  dayOpsCard: {
    marginTop: 6,
    backgroundColor: COLORS.sand50,
    borderRadius: 3,
    padding: 8,
  },
  dayOpsRow: { flexDirection: 'row', marginBottom: 2 },
  dayOpsLabel: { fontSize: 9, color: COLORS.ink500, width: 90 },
  dayOpsValue: { fontSize: 9.5, color: COLORS.ink900, flex: 1 },

  transferBlock: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.sand200 },

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

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function InfoField({ label, value, width }: { label: string; value: string; width: '60%' | '40%' }) {
  return (
    <View style={[styles.infoCell, { width }]}>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function DetailedItineraryPdfDocument({ data }: { data: DetailedItineraryPdfData }) {
  const { agency, client, consultant, trip, itinerary, flightSegments, hotel, travelReminders, transfers, customNotes, bookingNumber, packageName } =
    data;

  const hasTravelReminders = Boolean(
    travelReminders.airportInstructions || travelReminders.contactInstructions || travelReminders.importantReminders || travelReminders.guideInstructions
  );
  const hasHotelDetail = Boolean(
    hotel.address || hotel.phone || hotel.checkinInfo || hotel.confirmationNumber || hotel.bookingNumber || hotel.pin
  );
  const hasFlightDetail = flightSegments.length > 0;
  const hasTransfers = transfers.length > 0;

  return (
    <Document title={`Detailed Itinerary — ${bookingNumber}`}>
      <Page size="A4" style={styles.page}>
        {/* Watermark — same Zenara mark/positioning convention as the
            quotation PDF, drawn independently (see file header) so a
            future change to one never touches the other. */}
        <Image src={agency.logoUrl ?? ZENARA_LOGO_DATA_URI} style={styles.watermark} fixed />

        <View style={styles.header} fixed>
          {agency.logoUrl && (
            <View style={styles.headerLogoWrap}>
              <Image src={agency.logoUrl} style={styles.headerLogo} />
            </View>
          )}
          <View style={styles.infoGrid}>
            <Text style={styles.agencyName}>{agency.name.toUpperCase()}</Text>
            <View style={styles.infoRow}>
              <InfoField label="Traveler" value={client?.name ?? '—'} width="60%" />
              <InfoField label="Consultant" value={consultant.name ?? '—'} width="40%" />
            </View>
            <View style={styles.infoRow}>
              <InfoField label="Booking No" value={bookingNumber} width="60%" />
              <InfoField label="Destination" value={trip.destination} width="40%" />
            </View>
            <View style={styles.infoRow}>
              <InfoField label="Travel Dates" value={`${formatDate(trip.travelStartDate)} - ${formatDate(trip.travelEndDate)}`} width="60%" />
              {packageName && <InfoField label="Package" value={packageName} width="40%" />}
            </View>
          </View>
        </View>
        <View style={styles.headerDivider} fixed />

        <View style={styles.titleBlock}>
          <Text style={styles.titleText}>Detailed Travel Itinerary</Text>
          <Text style={styles.titleSubtext}>Operational details for your trip — please review before departure.</Text>
        </View>

        <View style={styles.body}>
          {hasTravelReminders && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Travel Reminders</Text>
              <View style={styles.sectionCard}>
                <Field label="Airport" value={travelReminders.airportInstructions} />
                <Field label="Contact / WhatsApp" value={travelReminders.contactInstructions} />
                <Field label="Important" value={travelReminders.importantReminders} />
                <Field label="Guide" value={travelReminders.guideInstructions} />
              </View>
            </View>
          )}

          {hasHotelDetail && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Hotel</Text>
              <View style={styles.sectionCard}>
                {hotel.name && <Field label="Hotel" value={hotel.name} />}
                <Field label="Address" value={hotel.address} />
                <Field label="Phone" value={hotel.phone} />
                <Field label="Check-in" value={hotel.checkinInfo} />
                <Field label="Confirmation No" value={hotel.confirmationNumber} />
                <Field label="Booking No" value={hotel.bookingNumber} />
                <Field label="PIN / Access Code" value={hotel.pin} />
              </View>
            </View>
          )}

          {hasFlightDetail && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Flights</Text>
              <View style={styles.sectionCard}>
                {flightSegments.map((f, i) => (
                  <View key={i} style={i > 0 ? { marginTop: 10 } : undefined}>
                    <Field label="Flight" value={`${f.airline} ${f.flightNumber} — ${f.route}`} />
                    <Field label="Departure" value={f.departureTime} />
                    <Field label="Arrival" value={f.arrivalTime} />
                    <Field label="Booking Ref" value={f.bookingReference} />
                    <Field label="Terminal" value={f.terminal} />
                    <Field label="Special Instructions" value={f.specialInstructions} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {hasTransfers && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Transfers</Text>
              <View style={styles.sectionCard}>
                {transfers.map((t, i) => (
                  <View key={i} style={i < transfers.length - 1 ? styles.transferBlock : undefined}>
                    <Field label="Pickup" value={t.pickupLocation} />
                    <Field label="Pickup Time" value={t.pickupTime} />
                    <Field label="Driver/Guide" value={t.driverGuideName} />
                    <Field label="Contact" value={t.contactNumber} />
                    <Field label="Meeting Point" value={t.meetingPoint} />
                    <Field label="Vehicle" value={t.vehicleInfo} />
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Daily Itinerary</Text>
            {itinerary.map((day) => {
              const hasOps = Boolean(day.pickupTime || day.meetingPoint || day.meals || day.freeTime || day.operationalNotes);
              return (
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
                  {hasOps && (
                    <View style={styles.dayOpsCard}>
                      {day.pickupTime && (
                        <View style={styles.dayOpsRow}>
                          <Text style={styles.dayOpsLabel}>Pickup Time:</Text>
                          <Text style={styles.dayOpsValue}>{day.pickupTime}</Text>
                        </View>
                      )}
                      {day.meetingPoint && (
                        <View style={styles.dayOpsRow}>
                          <Text style={styles.dayOpsLabel}>Meeting Point:</Text>
                          <Text style={styles.dayOpsValue}>{day.meetingPoint}</Text>
                        </View>
                      )}
                      {day.meals && (
                        <View style={styles.dayOpsRow}>
                          <Text style={styles.dayOpsLabel}>Meals:</Text>
                          <Text style={styles.dayOpsValue}>{day.meals}</Text>
                        </View>
                      )}
                      {day.freeTime && (
                        <View style={styles.dayOpsRow}>
                          <Text style={styles.dayOpsLabel}>Free Time:</Text>
                          <Text style={styles.dayOpsValue}>{day.freeTime}</Text>
                        </View>
                      )}
                      {day.operationalNotes && (
                        <View style={styles.dayOpsRow}>
                          <Text style={styles.dayOpsLabel}>Notes:</Text>
                          <Text style={styles.dayOpsValue}>{day.operationalNotes}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {customNotes && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.noteText}>{customNotes}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerLine}>
            {[agency.name, agency.email, agency.phone, agency.whatsapp ? `WhatsApp: ${agency.whatsapp}` : null].filter(Boolean).join('   •   ')}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
