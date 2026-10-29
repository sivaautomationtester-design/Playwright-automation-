import { Locator, Page } from '@playwright/test';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

export class InventoryPage {
  readonly title: Locator;
  readonly items: Locator;
  readonly itemNames: Locator;
  readonly itemPrices: Locator;
  readonly itemImages: Locator;
  readonly sortSelect: Locator;
  readonly cartBadge: Locator;
  readonly cartLink: Locator;

  constructor(private readonly page: Page) {
    this.title = page.locator('.title');
    this.items = page.locator('.inventory_item');
    this.itemNames = page.locator('.inventory_item_name');
    this.itemPrices = page.locator('.inventory_item_price');
    this.itemImages = page.locator('.inventory_item img');
    this.sortSelect = page.locator('.product_sort_container');
    this.cartBadge = page.locator('.shopping_cart_badge');
    this.cartLink = page.locator('.shopping_cart_link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/inventory.html');
  }

  private item(name: string): Locator {
    return this.items.filter({ hasText: name });
  }

  async addToCart(...names: string[]): Promise<void> {
    for (const name of names) {
      await this.item(name).getByRole('button', { name: 'Add to cart' }).click();
    }
  }

  async removeFromCart(name: string): Promise<void> {
    await this.item(name).getByRole('button', { name: 'Remove' }).click();
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sortSelect.selectOption(option);
  }

  async names(): Promise<string[]> {
    return this.itemNames.allInnerTexts();
  }

  /** Prices as numbers, e.g. "$29.99" -> 29.99 */
  async prices(): Promise<number[]> {
    return (await this.itemPrices.allInnerTexts()).map(toAmount);
  }

  async priceOf(name: string): Promise<number> {
    return toAmount(await this.item(name).locator('.inventory_item_price').innerText());
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }
}

export const toAmount = (text: string): number => Number(text.replace(/[^0-9.]/g, ''));
