import { CustomerInfo } from '../../src/pages/CheckoutPage';
import { expect, test } from '../../src/fixtures';

const ITEMS = ['Sauce Labs Backpack', 'Sauce Labs Bolt T-Shirt'];
const CUSTOMER: CustomerInfo = { firstName: 'Asha', lastName: 'Sharma', postalCode: '560001' };
const round2 = (n: number) => Math.round(n * 100) / 100;

test.describe('Checkout', () => {
  test.beforeEach(async ({ inventoryPage }) => {
    await inventoryPage.goto();
  });

  test('completes an order and the totals add up', async ({ inventoryPage, cartPage, checkoutPage }) => {
    const prices = await Promise.all(ITEMS.map((name) => inventoryPage.priceOf(name)));

    await test.step('add items and go to checkout', async () => {
      await inventoryPage.addToCart(...ITEMS);
      await inventoryPage.openCart();
      await cartPage.checkout();
    });

    await test.step('enter customer details', async () => {
      await checkoutPage.fillInfo(CUSTOMER);
    });

    await test.step('overview totals are correct', async () => {
      const { subtotal, tax, total } = await checkoutPage.amounts();
      expect(subtotal).toBeCloseTo(prices.reduce((a, b) => a + b, 0), 2);
      expect(tax).toBeCloseTo(round2(subtotal * 0.08), 2); // SauceDemo applies 8% tax
      expect(total).toBeCloseTo(subtotal + tax, 2);
    });

    await test.step('finish the order', async () => {
      await checkoutPage.finish();
      await expect(checkoutPage.completeHeader).toHaveText('Thank you for your order!');
      await expect(inventoryPage.cartBadge).toBeHidden();
    });
  });

  const missing: { field: keyof CustomerInfo; error: string }[] = [
    { field: 'firstName', error: 'First Name is required' },
    { field: 'lastName', error: 'Last Name is required' },
    { field: 'postalCode', error: 'Postal Code is required' },
  ];
  for (const { field, error } of missing) {
    test(`missing ${field} shows "${error}"`, async ({ inventoryPage, cartPage, checkoutPage }) => {
      await inventoryPage.addToCart(ITEMS[0]);
      await inventoryPage.openCart();
      await cartPage.checkout();
      await checkoutPage.fillInfo({ ...CUSTOMER, [field]: '' });
      await expect(checkoutPage.error).toContainText(error);
    });
  }
});
