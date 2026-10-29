import { SortOption } from '../../src/pages/InventoryPage';
import { expect, test } from '../../src/fixtures';

test.describe('Product sorting', () => {
  test.beforeEach(async ({ inventoryPage }) => {
    await inventoryPage.goto();
  });

  const byName: { option: SortOption; label: string; compare: (a: string, b: string) => number }[] = [
    { option: 'az', label: 'name A to Z', compare: (a, b) => a.localeCompare(b) },
    { option: 'za', label: 'name Z to A', compare: (a, b) => b.localeCompare(a) },
  ];
  for (const { option, label, compare } of byName) {
    test(`sorts by ${label}`, async ({ inventoryPage }) => {
      await inventoryPage.sortBy(option);
      const names = await inventoryPage.names();
      expect(names.length).toBeGreaterThan(1);
      expect(names).toEqual([...names].sort(compare));
    });
  }

  const byPrice: { option: SortOption; label: string; compare: (a: number, b: number) => number }[] = [
    { option: 'lohi', label: 'price low to high', compare: (a, b) => a - b },
    { option: 'hilo', label: 'price high to low', compare: (a, b) => b - a },
  ];
  for (const { option, label, compare } of byPrice) {
    test(`sorts by ${label}`, async ({ inventoryPage }) => {
      await inventoryPage.sortBy(option);
      const prices = await inventoryPage.prices();
      expect(prices.length).toBeGreaterThan(1);
      expect(prices).toEqual([...prices].sort(compare));
    });
  }
});
