import { Locator, Page } from '@playwright/test';
import { toAmount } from './InventoryPage';

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  postalCode: string;
}

/** Covers the three checkout screens: your information, overview and complete. */
export class CheckoutPage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly postalCode: Locator;
  readonly continueButton: Locator;
  readonly finishButton: Locator;
  readonly error: Locator;
  readonly subtotal: Locator;
  readonly tax: Locator;
  readonly total: Locator;
  readonly completeHeader: Locator;

  constructor(private readonly page: Page) {
    this.firstName = page.getByPlaceholder('First Name');
    this.lastName = page.getByPlaceholder('Last Name');
    this.postalCode = page.getByPlaceholder('Zip/Postal Code');
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.finishButton = page.getByRole('button', { name: 'Finish' });
    this.error = page.getByTestId('error');
    this.subtotal = page.locator('.summary_subtotal_label');
    this.tax = page.locator('.summary_tax_label');
    this.total = page.locator('.summary_total_label');
    this.completeHeader = page.locator('.complete-header');
  }

  async fillInfo(info: Partial<CustomerInfo>): Promise<void> {
    if (info.firstName !== undefined) await this.firstName.fill(info.firstName);
    if (info.lastName !== undefined) await this.lastName.fill(info.lastName);
    if (info.postalCode !== undefined) await this.postalCode.fill(info.postalCode);
    await this.continueButton.click();
  }

  async amounts(): Promise<{ subtotal: number; tax: number; total: number }> {
    return {
      subtotal: toAmount(await this.subtotal.innerText()),
      tax: toAmount(await this.tax.innerText()),
      total: toAmount(await this.total.innerText()),
    };
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }
}
