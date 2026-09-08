export interface AirportLike {
  code: string;
  city: string;
}

export function formatAirportLabel(airport: AirportLike): string {
  return `${airport.city} (${airport.code})`;
}

/** Pulls a trailing "(XXX)" IATA code out of a label like "Manila (MNL)" — used to recover the resolved code from a saved/displayed field without a separate hidden state field. */
export function extractCodeFromLabel(label: string): string | null {
  const match = label.trim().match(/\(([A-Z]{3})\)\s*$/);
  return match?.[1] ?? null;
}
