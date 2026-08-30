/**
 * The 3 standard Free Time slots every itinerary needs at some point
 * (arrival day, a rest day, departure day) — selectable from the same
 * dropdown as a real tour, but never carry tour pricing since there's
 * nothing being sold on a free day.
 */
export interface FreeTimeOption {
  id: string;
  title: string;
  activities: string[];
}

export const FREE_TIME_OPTIONS: FreeTimeOption[] = [
  {
    id: 'free_time_arrival',
    title: 'Arrival | Free Time',
    activities: ['Arrival at airport', 'Airport transfer', 'Hotel check-in', 'Free time for leisure', 'Overnight at the hotel'],
  },
  {
    id: 'free_time_standard',
    title: 'Free Time',
    activities: ['Breakfast', 'Free time for leisure', 'Explore the destination at your own pace', 'Overnight at the hotel'],
  },
  {
    id: 'free_time_departure',
    title: 'Free Time | Departure',
    activities: ['Breakfast', 'Free time until check-out', 'Hotel check-out', 'Airport transfer', 'Departure flight'],
  },
];
