import { z } from 'zod';

// Mirrors the enum stored in the database (0007_detailed_itineraries.sql).
// 'Not Created' is deliberately absent — the absence of a row IS that state.
export const DETAILED_ITINERARY_STATUSES = ['draft', 'ready_for_review', 'approved', 'sent', 'updated'] as const;
export type DetailedItineraryStatus = (typeof DETAILED_ITINERARY_STATUSES)[number];

export const operationalFieldsSchema = z.object({
  detailedItineraryId: z.string().uuid(),
  // Travel Reminders
  airportInstructions: z.string().trim().max(4000).optional().or(z.literal('')),
  contactInstructions: z.string().trim().max(4000).optional().or(z.literal('')),
  importantReminders: z.string().trim().max(4000).optional().or(z.literal('')),
  guideInstructions: z.string().trim().max(4000).optional().or(z.literal('')),
  // Hotel
  hotelAddress: z.string().trim().max(500).optional().or(z.literal('')),
  hotelPhone: z.string().trim().max(100).optional().or(z.literal('')),
  hotelCheckinInfo: z.string().trim().max(1000).optional().or(z.literal('')),
  hotelConfirmationNumber: z.string().trim().max(200).optional().or(z.literal('')),
  hotelBookingNumber: z.string().trim().max(200).optional().or(z.literal('')),
  hotelPin: z.string().trim().max(100).optional().or(z.literal('')),
  // Custom notes (shown on the PDF)
  customNotes: z.string().trim().max(4000).optional().or(z.literal('')),
});
export type OperationalFieldsInput = z.infer<typeof operationalFieldsSchema>;

export const flightDetailSchema = z.object({
  quotationFlightSegmentId: z.string().uuid(),
  bookingReference: z.string().trim().max(100).optional().or(z.literal('')),
  terminal: z.string().trim().max(100).optional().or(z.literal('')),
  specialInstructions: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type FlightDetailInput = z.infer<typeof flightDetailSchema>;

export const dailyDetailSchema = z.object({
  quotationItineraryDayId: z.string().uuid(),
  pickupTime: z.string().trim().max(100).optional().or(z.literal('')),
  meetingPoint: z.string().trim().max(500).optional().or(z.literal('')),
  meals: z.string().trim().max(500).optional().or(z.literal('')),
  freeTime: z.string().trim().max(500).optional().or(z.literal('')),
  operationalNotes: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type DailyDetailInput = z.infer<typeof dailyDetailSchema>;

export const transferSchema = z.object({
  pickupLocation: z.string().trim().max(500).optional().or(z.literal('')),
  pickupTime: z.string().trim().max(100).optional().or(z.literal('')),
  driverGuideName: z.string().trim().max(200).optional().or(z.literal('')),
  contactNumber: z.string().trim().max(100).optional().or(z.literal('')),
  meetingPoint: z.string().trim().max(500).optional().or(z.literal('')),
  vehicleInfo: z.string().trim().max(500).optional().or(z.literal('')),
});
export type TransferInput = z.infer<typeof transferSchema>;

export const statusTransitionSchema = z.object({
  detailedItineraryId: z.string().uuid(),
  nextStatus: z.enum(DETAILED_ITINERARY_STATUSES),
});
