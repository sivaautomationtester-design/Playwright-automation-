import { Locator, Page } from '@playwright/test';

export class CartPage {
  readonly items: Locator;
  readonly itemNames: Locator;
  readonly checkoutButton: Locator;

  constructor(private readonly page: Page) {
    this.items = page.locator('.cart_item');
    this.itemNames = page.locator('.cart_item .inventory_item_name');
    this.checkoutButton = page.getByRole('button', { name: 'Checkout' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/cart.html');
  }

  async names(): Promise<string[]> {
    return this.itemNames.allInnerTexts();
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }
}
