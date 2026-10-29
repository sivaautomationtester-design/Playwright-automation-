import { APIResponse } from '@playwright/test';
import { BookingClient } from '../../src/api/BookingClient';
import { Booking, BookingSummary } from '../../src/api/types';
import { buildBooking } from '../../src/data/bookingFactory';
import { expect, test } from '../../src/fixtures';

test.describe('Booking API: rejected requests', () => {
  test('reading a booking that does not exist returns 404', async ({ bookingApi }) => {
    const res = await bookingApi.getBooking(999_999_999);
    expect(res.status()).toBe(404);
  });

  // Same check for every write operation, without a token and with a fake one.
  type WriteCall = (api: BookingClient, id: number, token?: string) => Promise<APIResponse>;
  const writes: { name: string; call: WriteCall }[] = [
    { name: 'PUT', call: (api, id, t) => api.updateBooking(id, buildBooking({ firstname: 'Hacker' }), t) },
    { name: 'PATCH', call: (api, id, t) => api.patchBooking(id, { firstname: 'Hacker' }, t) },
    { name: 'DELETE', call: (api, id, t) => api.deleteBooking(id, t) },
  ];
  for (const { name, call } of writes) {
    for (const [label, badToken] of [['no token', undefined], ['an invalid token', 'not-a-real-token']] as const) {
      test(`${name} with ${label} is forbidden and changes nothing`, async ({ bookingApi, booking }) => {
        const res = await call(bookingApi, booking.id, badToken);
        expect(res.status()).toBe(403);

        const after = await bookingApi.getBooking(booking.id);
        expect(after.status(), 'booking should still exist').toBe(200);
        expect((await after.json()) as Booking).toEqual(booking.data);
      });
    }
  }

  test('search with no matches returns an empty list', async ({ bookingApi }) => {
    const res = await bookingApi.searchBookings({ firstname: `Nobody${Date.now()}` });
    expect(res.status()).toBe(200);
    expect((await res.json()) as BookingSummary[]).toEqual([]);
  });
});
