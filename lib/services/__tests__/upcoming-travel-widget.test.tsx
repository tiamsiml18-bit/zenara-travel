import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UpcomingTravelWidget } from '@/components/dashboard/upcoming-travel-widget';

(globalThis as any).React = React;

const row = (over: Record<string, unknown>) => ({
  quotationId: 'q',
  quotationNumber: 'QT-1',
  clientName: 'Client',
  destination: 'Somewhere',
  travelStartDate: '2099-12-10',
  travelEndDate: '2099-12-14',
  paymentStatus: 'paid' as const,
  ...over,
});

const render = (rows: any[]) => renderToStaticMarkup(<UpcomingTravelWidget rows={rows} />);

describe('UpcomingTravelWidget grouping', () => {
  const rows = [
    row({ quotationId: 'a', clientName: 'Irabon', travelStartDate: '2099-12-02', paymentStatus: 'paid' }),
    row({ quotationId: 'b', clientName: 'Romeo', travelStartDate: '2099-12-12', paymentStatus: 'partial' }),
    row({ quotationId: 'c', clientName: 'Joe Marie', travelStartDate: '2099-12-19', paymentStatus: 'paid' }),
  ];

  it('lists Fully Paid first (earliest first), then a divider, then Partially Paid', () => {
    const html = render(rows);
    const fully = html.indexOf('Fully Paid (2)');
    const irabon = html.indexOf('Irabon');
    const joe = html.indexOf('Joe Marie');
    const divider = html.indexOf('<hr');
    const partially = html.indexOf('Partially Paid (1)');
    const romeo = html.indexOf('Romeo');
    expect(fully).toBeGreaterThan(-1);
    expect(fully).toBeLessThan(irabon);
    expect(irabon).toBeLessThan(joe);
    expect(joe).toBeLessThan(divider);
    expect(divider).toBeLessThan(partially);
    expect(partially).toBeLessThan(romeo);
  });

  it('keeps everything in the one card, with the same heading', () => {
    const html = render(rows);
    expect(html.match(/<section/g)).toHaveLength(1);
    expect(html).toContain('Upcoming confirmed travel');
  });

  it('shows client, destination, travel date and a payment label on each booking', () => {
    const html = render([row({ clientName: 'Romeo', destination: 'Cebu', travelStartDate: '2099-12-12', paymentStatus: 'partial' })]);
    expect(html).toContain('Romeo');
    expect(html).toContain('Cebu');
    expect(html).toContain('>12<'); // day
    expect(html).toContain('Dec'); // month
    // the per-row label
    expect(html.match(/>Partially Paid</g)).toHaveLength(1);
  });

  it('shows no divider when only one group has bookings', () => {
    expect(render([rows[0]!])).not.toContain('<hr');
    expect(render([rows[1]!])).not.toContain('<hr');
    expect(render([rows[0]!])).not.toContain('Partially Paid');
    expect(render([rows[1]!])).not.toContain('Fully Paid');
  });

  it('keeps the existing empty-state wording', () => {
    expect(render([])).toContain('No confirmed trips departing soon.');
  });
});
