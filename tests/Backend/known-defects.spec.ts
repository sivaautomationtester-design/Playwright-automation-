import { env } from '../../src/config/env';
import { buildBooking } from '../../src/data/bookingFactory';
import { expect, test } from '../../src/fixtures';

/**
 * Real Restful-Booker defects. Each test asserts the CORRECT behaviour and is marked test.fail(),
 * so the suite stays green while the bug exists. If a bug gets fixed, Playwright reports
 * "expected to fail, but passed" — time to remove the marker.
 */
test.describe('Booking API: known defects @defect', () => {
  test('wrong password should return 401 Unauthorized', async ({ bookingApi }) => {
    test.fail(true, 'DEFECT: returns 200 OK with {"reason":"Bad credentials"}');
    const res = await bookingApi.createToken(env.apiUsername, 'wrong-password');
    expect(await res.json()).not.toHaveProperty('token'); // this part does hold
    expect(res.status()).toBe(401);
  });

  test('missing required fields should return 400, not a 500 server error', async ({ bookingApi }) => {
    test.fail(true, 'DEFECT: returns 500 Internal Server Error');
    const res = await bookingApi.createBooking({ firstname: 'OnlyAFirstName' });
    expect(res.status()).toBe(400);
  });

  test('checkout before checkin should be rejected', async ({ bookingApi, token }) => {
    test.fail(true, 'DEFECT: booking is accepted and saved');
    const res = await bookingApi.createBooking(
      buildBooking({ bookingdates: { checkin: '2030-01-10', checkout: '2030-01-01' } }),
    );
    if (res.ok()) {
      const { bookingid } = await res.json();
      await bookingApi.deleteBooking(bookingid, token); // clean up the invalid booking
    }
    expect(res.status()).toBe(400);
  });
});
