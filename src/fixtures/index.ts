import { test as base, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { BookingClient } from '../api/BookingClient';
import { Booking, CreateBookingResponse } from '../api/types';
import { env } from '../config/env';
import { buildBooking } from '../data/bookingFactory';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { InventoryPage } from '../pages/InventoryPage';
import { LoginPage } from '../pages/LoginPage';

type Fixtures = {
  // API
  bookingApi: BookingClient;
  token: string;
  /** A fresh booking created before the test and deleted after it. */
  booking: { id: number; data: Booking };
  // UI
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
};

export const test = base.extend<Fixtures & { allureProject: void }>({
  allureProject: [
    async ({}, use, testInfo) => {
      const project = testInfo.project.name === 'api' ? 'API Tests' : 'UI Tests';
      await allure.parentSuite(project);
      await allure.label('project', project);
      await use();
    },
    { auto: true },
  ],

  bookingApi: async ({ request }, use) => {
    await use(new BookingClient(request));
  },

  token: async ({ bookingApi }, use) => {
    const res = await bookingApi.createToken(env.apiUsername, env.apiPassword);
    expect(res.ok(), 'login should succeed').toBeTruthy();
    const { token } = await res.json();
    expect(token, 'token should be returned').toBeTruthy();
    await use(token);
  },

  booking: async ({ bookingApi, token }, use) => {
    const data = buildBooking();
    const res = await bookingApi.createBooking(data);
    expect(res.status(), 'test data setup: create booking').toBe(200);
    const body = (await res.json()) as CreateBookingResponse;
    await use({ id: body.bookingid, data });
    // Teardown: best-effort clean-up, never fails the test.
    await bookingApi.deleteBooking(body.bookingid, token).catch(() => undefined);
  },

  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  inventoryPage: async ({ page }, use) => use(new InventoryPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
});

export { expect };
