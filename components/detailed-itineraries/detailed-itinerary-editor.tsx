'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui/status-badge';
import { saveDetailedItineraryAction, transitionDetailedItineraryStatusAction } from '@/app/(app)/detailed-itineraries/actions';
import type { DetailedItineraryStatus } from '@/lib/validation/detailed-itinerary';
import type { InheritedQuotationData } from '@/lib/services/detailed-itineraries';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface DetailProp {
  id: string;
  status: DetailedItineraryStatus;
  sent_at: string | null;
  airport_instructions: string | null;
  contact_instructions: string | null;
  important_reminders: string | null;
  guide_instructions: string | null;
  hotel_address: string | null;
  hotel_phone: string | null;
  hotel_checkin_info: string | null;
  hotel_confirmation_number: string | null;
  hotel_booking_number: string | null;
  hotel_pin: string | null;
  custom_notes: string | null;
  inherited: InheritedQuotationData;
  flightDetails: { quotation_flight_segment_id: string; booking_reference: string | null; terminal: string | null; special_instructions: string | null }[];
  dailyDetails: {
    quotation_itinerary_day_id: string;
    pickup_time: string | null;
    meeting_point: string | null;
    meals: string | null;
    free_time: string | null;
    operational_notes: string | null;
  }[];
  transfers: {
    id: string;
    pickup_location: string | null;
    pickup_time: string | null;
    driver_guide_name: string | null;
    contact_number: string | null;
    meeting_point: string | null;
    vehicle_info: string | null;
  }[];
}

const inputClass = 'w-full rounded-md border border-sand-200 bg-surface px-3 py-2 text-sm';
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500';

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {textarea ? (
        <textarea className={inputClass} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

const STATUS_ACTIONS: Record<DetailedItineraryStatus, { label: string; next: DetailedItineraryStatus }[]> = {
  draft: [{ label: 'Mark Ready for Review', next: 'ready_for_review' }],
  ready_for_review: [
    { label: 'Back to Draft', next: 'draft' },
    { label: 'Approve', next: 'approved' },
  ],
  approved: [
    { label: 'Back to Review', next: 'ready_for_review' },
    { label: 'Send to Client', next: 'sent' },
  ],
  sent: [],
  updated: [
    { label: 'Mark Ready for Review', next: 'ready_for_review' },
    { label: 'Approve', next: 'approved' },
  ],
};

export function DetailedItineraryEditor({ detail }: { detail: DetailProp }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [airportInstructions, setAirportInstructions] = useState(detail.airport_instructions ?? '');
  const [contactInstructions, setContactInstructions] = useState(detail.contact_instructions ?? '');
  const [importantReminders, setImportantReminders] = useState(detail.important_reminders ?? '');
  const [guideInstructions, setGuideInstructions] = useState(detail.guide_instructions ?? '');

  const [hotelAddress, setHotelAddress] = useState(detail.hotel_address ?? '');
  const [hotelPhone, setHotelPhone] = useState(detail.hotel_phone ?? '');
  const [hotelCheckinInfo, setHotelCheckinInfo] = useState(detail.hotel_checkin_info ?? '');
  const [hotelConfirmationNumber, setHotelConfirmationNumber] = useState(detail.hotel_confirmation_number ?? '');
  const [hotelBookingNumber, setHotelBookingNumber] = useState(detail.hotel_booking_number ?? '');
  const [hotelPin, setHotelPin] = useState(detail.hotel_pin ?? '');

  const [customNotes, setCustomNotes] = useState(detail.custom_notes ?? '');

  const flightDetailById = new Map(detail.flightDetails.map((f) => [f.quotation_flight_segment_id, f]));
  const [flightRows, setFlightRows] = useState(
    detail.inherited.flightSegments.map((seg) => {
      const existing = flightDetailById.get(seg.id);
      return {
        quotationFlightSegmentId: seg.id,
        bookingReference: existing?.booking_reference ?? '',
        terminal: existing?.terminal ?? '',
        specialInstructions: existing?.special_instructions ?? '',
      };
    })
  );

  const dailyDetailById = new Map(detail.dailyDetails.map((d) => [d.quotation_itinerary_day_id, d]));
  const [dayRows, setDayRows] = useState(
    detail.inherited.itinerary.map((day) => {
      const existing = dailyDetailById.get(day.id);
      return {
        quotationItineraryDayId: day.id,
        pickupTime: existing?.pickup_time ?? '',
        meetingPoint: existing?.meeting_point ?? '',
        meals: existing?.meals ?? '',
        freeTime: existing?.free_time ?? '',
        operationalNotes: existing?.operational_notes ?? '',
      };
    })
  );

  const [transferRows, setTransferRows] = useState(
    detail.transfers.map((t) => ({
      pickupLocation: t.pickup_location ?? '',
      pickupTime: t.pickup_time ?? '',
      driverGuideName: t.driver_guide_name ?? '',
      contactNumber: t.contact_number ?? '',
      meetingPoint: t.meeting_point ?? '',
      vehicleInfo: t.vehicle_info ?? '',
    }))
  );

  function updateFlightRow(i: number, patch: Partial<(typeof flightRows)[number]>) {
    setFlightRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updateDayRow(i: number, patch: Partial<(typeof dayRows)[number]>) {
    setDayRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updateTransferRow(i: number, patch: Partial<(typeof transferRows)[number]>) {
    setTransferRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addTransfer() {
    setTransferRows((rows) => [
      ...rows,
      { pickupLocation: '', pickupTime: '', driverGuideName: '', contactNumber: '', meetingPoint: '', vehicleInfo: '' },
    ]);
  }
  function removeTransfer(i: number) {
    setTransferRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveDetailedItineraryAction({
        operational: {
          detailedItineraryId: detail.id,
          airportInstructions,
          contactInstructions,
          importantReminders,
          guideInstructions,
          hotelAddress,
          hotelPhone,
          hotelCheckinInfo,
          hotelConfirmationNumber,
          hotelBookingNumber,
          hotelPin,
          customNotes,
        },
        flightDetails: flightRows,
        dailyDetails: dayRows,
        transfers: transferRows,
      });
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error });
        return;
      }
      setMessage({ type: 'ok', text: 'Saved.' });
      router.refresh();
    });
  }

  function handleTransition(nextStatus: DetailedItineraryStatus) {
    setMessage(null);
    startTransition(async () => {
      const result = await transitionDetailedItineraryStatusAction({ detailedItineraryId: detail.id, nextStatus });
      if (!result.ok) {
        setMessage({ type: 'error', text: result.error });
        return;
      }
      setMessage({ type: 'ok', text: `Status updated to ${nextStatus.replace(/_/g, ' ')}.` });
      router.refresh();
    });
  }

  const { inherited } = detail;
  const actions = STATUS_ACTIONS[detail.status];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Summary — everything here is read-only, inherited from the
          booking's frozen quotation version. None of it can be edited
          from this page; it changes only if the underlying quotation or
          booking changes. */}
      <div className="rounded-lg border border-sand-200 bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink-900">Trip Summary</h2>
          <StatusBadge label={detail.status} />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-ink-500">Client:</span> <span className="text-ink-900">{inherited.client?.name ?? '—'}</span>
          </div>
          <div>
            <span className="text-ink-500">Consultant:</span> <span className="text-ink-900">{inherited.consultant.name ?? '—'}</span>
          </div>
          <div>
            <span className="text-ink-500">Destination:</span> <span className="text-ink-900">{inherited.trip.destination}</span>
          </div>
          <div>
            <span className="text-ink-500">Travel Dates:</span>{' '}
            <span className="text-ink-900">
              {formatDate(inherited.trip.travelStartDate)} – {formatDate(inherited.trip.travelEndDate)}
            </span>
          </div>
          <div>
            <span className="text-ink-500">Package:</span> <span className="text-ink-900">{inherited.packageName ?? '—'}</span>
          </div>
          <div>
            <span className="text-ink-500">Hotel:</span> <span className="text-ink-900">{inherited.trip.hotelName ?? '—'}</span>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            message.type === 'ok' ? 'border-success-100 bg-success-100/50 text-success-700' : 'border-coral-500/30 bg-coral-500/5 text-coral-600'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/detailed-itineraries/${detail.id}/pdf?preview=1`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-sand-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
        >
          Preview PDF
        </a>
        <a
          href={`/api/detailed-itineraries/${detail.id}/pdf`}
          className="rounded-md border border-sand-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-sand-100"
        >
          Download PDF
        </a>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-harbor-600 px-4 py-2 text-sm font-medium text-sand-50 hover:bg-harbor-700 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save Draft'}
        </button>
        {actions.map((a) => (
          <button
            key={a.next}
            type="button"
            onClick={() => handleTransition(a.next)}
            disabled={isPending}
            className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${
              a.next === 'sent'
                ? 'bg-success-700 text-sand-50 hover:bg-success-800'
                : 'border border-sand-200 text-ink-700 hover:bg-sand-100'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Travel Reminders */}
      <section className="rounded-lg border border-sand-200 bg-surface p-5">
        <h2 className="mb-3 font-display text-base font-semibold text-ink-900">Travel Reminders</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Airport Instructions" value={airportInstructions} onChange={setAirportInstructions} textarea />
          <Field label="Contact / WhatsApp Instructions" value={contactInstructions} onChange={setContactInstructions} textarea />
          <Field label="Important Reminders" value={importantReminders} onChange={setImportantReminders} textarea />
          <Field label="Guide Instructions" value={guideInstructions} onChange={setGuideInstructions} textarea />
        </div>
      </section>

      {/* Hotel */}
      <section className="rounded-lg border border-sand-200 bg-surface p-5">
        <h2 className="mb-1 font-display text-base font-semibold text-ink-900">Hotel</h2>
        <p className="mb-3 text-xs text-ink-500">
          Hotel name ({inherited.trip.hotelName ?? '—'}) comes from the quotation and can&apos;t be edited here.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Address" value={hotelAddress} onChange={setHotelAddress} />
          <Field label="Phone" value={hotelPhone} onChange={setHotelPhone} />
          <Field label="Check-in Information" value={hotelCheckinInfo} onChange={setHotelCheckinInfo} textarea />
          <Field label="Confirmation Number" value={hotelConfirmationNumber} onChange={setHotelConfirmationNumber} />
          <Field label="Booking Number" value={hotelBookingNumber} onChange={setHotelBookingNumber} />
          <Field label="PIN / Access Code" value={hotelPin} onChange={setHotelPin} />
        </div>
      </section>

      {/* Flights */}
      {flightRows.length > 0 && (
        <section className="rounded-lg border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 font-display text-base font-semibold text-ink-900">Flights</h2>
          <div className="space-y-4">
            {inherited.flightSegments.map((seg, i) => (
              <div key={seg.id} className="rounded-md border border-sand-100 p-3">
                <p className="mb-2 text-sm font-medium text-ink-900">
                  {seg.airline} {seg.flightNumber} — {seg.route}{' '}
                  <span className="font-normal text-ink-500">
                    ({seg.departureTime} → {seg.arrivalTime})
                  </span>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field
                    label="Booking Reference / PNR"
                    value={flightRows[i]!.bookingReference}
                    onChange={(v) => updateFlightRow(i, { bookingReference: v })}
                  />
                  <Field label="Terminal" value={flightRows[i]!.terminal} onChange={(v) => updateFlightRow(i, { terminal: v })} />
                  <Field
                    label="Special Instructions"
                    value={flightRows[i]!.specialInstructions}
                    onChange={(v) => updateFlightRow(i, { specialInstructions: v })}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transfers */}
      <section className="rounded-lg border border-sand-200 bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink-900">Transfers</h2>
          <button type="button" onClick={addTransfer} className="rounded-md border border-sand-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-sand-100">
            + Add Transfer
          </button>
        </div>
        <div className="space-y-4">
          {transferRows.map((row, i) => (
            <div key={i} className="rounded-md border border-sand-100 p-3">
              <div className="mb-2 flex justify-end">
                <button type="button" onClick={() => removeTransfer(i)} className="text-xs font-medium text-coral-600 hover:underline">
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Pickup Location" value={row.pickupLocation} onChange={(v) => updateTransferRow(i, { pickupLocation: v })} />
                <Field label="Pickup Time" value={row.pickupTime} onChange={(v) => updateTransferRow(i, { pickupTime: v })} />
                <Field label="Driver/Guide Name" value={row.driverGuideName} onChange={(v) => updateTransferRow(i, { driverGuideName: v })} />
                <Field label="Contact Number" value={row.contactNumber} onChange={(v) => updateTransferRow(i, { contactNumber: v })} />
                <Field label="Meeting Point" value={row.meetingPoint} onChange={(v) => updateTransferRow(i, { meetingPoint: v })} />
                <Field label="Vehicle Information" value={row.vehicleInfo} onChange={(v) => updateTransferRow(i, { vehicleInfo: v })} />
              </div>
            </div>
          ))}
          {transferRows.length === 0 && <p className="text-sm text-ink-500">No transfers added yet.</p>}
        </div>
      </section>

      {/* Daily Itinerary */}
      <section className="rounded-lg border border-sand-200 bg-surface p-5">
        <h2 className="mb-3 font-display text-base font-semibold text-ink-900">Daily Itinerary</h2>
        <div className="space-y-4">
          {inherited.itinerary.map((day, i) => (
            <div key={day.id} className="rounded-md border border-sand-100 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-harbor-700">Day {day.dayNumber}</p>
              <p className="mb-2 text-sm font-medium text-ink-900">{day.title}</p>
              {day.description && <p className="mb-2 text-sm text-ink-700">{day.description}</p>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Pickup Time" value={dayRows[i]!.pickupTime} onChange={(v) => updateDayRow(i, { pickupTime: v })} />
                <Field label="Meeting Point" value={dayRows[i]!.meetingPoint} onChange={(v) => updateDayRow(i, { meetingPoint: v })} />
                <Field label="Meals" value={dayRows[i]!.meals} onChange={(v) => updateDayRow(i, { meals: v })} />
                <Field label="Free Time" value={dayRows[i]!.freeTime} onChange={(v) => updateDayRow(i, { freeTime: v })} />
                <Field
                  label="Operational Notes"
                  value={dayRows[i]!.operationalNotes}
                  onChange={(v) => updateDayRow(i, { operationalNotes: v })}
                  textarea
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Custom Notes */}
      <section className="rounded-lg border border-sand-200 bg-surface p-5">
        <h2 className="mb-3 font-display text-base font-semibold text-ink-900">Custom Notes</h2>
        <Field label="Shown on the Detailed Itinerary PDF" value={customNotes} onChange={setCustomNotes} textarea />
      </section>
    </div>
  );
}
