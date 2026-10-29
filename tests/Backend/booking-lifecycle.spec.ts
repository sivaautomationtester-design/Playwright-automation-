import { Booking, BookingSummary, CreateBookingResponse } from '../../src/api/types';
import { env } from '../../src/config/env';
import { buildBooking } from '../../src/data/bookingFactory';
import { expect, test } from '../../src/fixtures';

test.describe('Booking API: health and auth', () => {
  test('API is up', async ({ bookingApi }) => {
    const res = await bookingApi.ping();
    // Restful-Booker answers its health check with 201 Created.
    expect(res.status()).toBe(201);
  });

  test('valid credentials return a token', async ({ bookingApi }) => {
    const res = await bookingApi.createToken(env.apiUsername, env.apiPassword);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.token.length).toBeGreaterThan(0);
  });
});

test.describe('Booking API: full lifecycle', () => {
  test('create, read, search, update, patch and delete a booking', async ({ bookingApi, token }) => {
    const original = buildBooking();
    let id = 0;

    await test.step('create booking', async () => {
      const res = await bookingApi.createBooking(original);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('application/json');
      const body = (await res.json()) as CreateBookingResponse;
      expect(body.bookingid).toBeGreaterThan(0);
      expect(body.booking).toEqual(original);
      id = body.bookingid;
    });

    await test.step('read it back: every field was saved', async () => {
      const res = await bookingApi.getBooking(id);
      expect(res.status()).toBe(200);
      const saved = (await res.json()) as Booking;
      expect(saved).toEqual(original);
      expect(saved.bookingdates.checkin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    await test.step('find it by name', async () => {
      const res = await bookingApi.searchBookings({ firstname: original.firstname, lastname: original.lastname });
      expect(res.status()).toBe(200);
      const ids = ((await res.json()) as BookingSummary[]).map((b) => b.bookingid);
      expect(ids).toContain(id);
    });

    const replacement = buildBooking();
    await test.step('replace every field (PUT)', async () => {
      const res = await bookingApi.updateBooking(id, replacement, token);
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual(replacement);
    });

    await test.step('change only two fields (PATCH), the rest stays untouched', async () => {
      const changes = { firstname: 'Patched', additionalneeds: 'Dinner' };
      const res = await bookingApi.patchBooking(id, changes, token);
      expect(res.status()).toBe(200);
      expect(await res.json()).toEqual({ ...replacement, ...changes });
    });

    await test.step('changes were persisted', async () => {
      const res = await bookingApi.getBooking(id);
      expect(await res.json()).toEqual({ ...replacement, firstname: 'Patched', additionalneeds: 'Dinner' });
    });

    await test.step('delete it', async () => {
      const res = await bookingApi.deleteBooking(id, token);
      // Restful-Booker returns 201 for a successful delete; 200 or 204 would be standard.
      expect([200, 201, 204]).toContain(res.status());
    });

    await test.step('it is gone', async () => {
      const res = await bookingApi.getBooking(id);
      expect(res.status()).toBe(404);
    });
  });
});
