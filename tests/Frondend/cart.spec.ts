import { expect, test } from '../../src/fixtures';

const BACKPACK = 'Sauce Labs Backpack';
const BIKE_LIGHT = 'Sauce Labs Bike Light';

test.describe('Cart', () => {
  test.beforeEach(async ({ inventoryPage }) => {
    await inventoryPage.goto();
  });

  test('badge counts items as they are added and removed', async ({ inventoryPage }) => {
    await expect(inventoryPage.cartBadge).toBeHidden();

    await inventoryPage.addToCart(BACKPACK, BIKE_LIGHT);
    await expect(inventoryPage.cartBadge).toHaveText('2');

    await inventoryPage.removeFromCart(BACKPACK);
    await expect(inventoryPage.cartBadge).toHaveText('1');
  });

  test('cart page lists exactly the items added', async ({ inventoryPage, cartPage }) => {
    await inventoryPage.addToCart(BACKPACK, BIKE_LIGHT);
    await inventoryPage.openCart();
    await expect(cartPage.items).toHaveCount(2);
    expect((await cartPage.names()).sort()).toEqual([BACKPACK, BIKE_LIGHT].sort());
  });

  test('cart survives a page reload', async ({ inventoryPage, page }) => {
    await inventoryPage.addToCart(BACKPACK);
    await page.reload();
    await expect(inventoryPage.cartBadge).toHaveText('1');
  });
});
