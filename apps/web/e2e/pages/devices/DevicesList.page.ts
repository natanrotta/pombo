import { type Page, type Locator, expect } from "@playwright/test";

/** The `/devices` list: stats, search, the device grid, the create modal
 *  (two-step: name form → one-time secret reveal) and the delete confirm
 *  dialog. */
export class DevicesListPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly addButton: Locator;
  readonly searchInput: Locator;
  readonly emptyState: Locator;
  readonly noResultsState: Locator;
  readonly deviceCards: Locator;

  readonly modal: Locator;
  readonly createNameInput: Locator;
  readonly createSubmitButton: Locator;
  readonly createNameError: Locator;
  readonly secretValueField: Locator;
  readonly secretGoToDeviceButton: Locator;

  readonly confirmDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly confirmCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole("heading", {
      level: 1,
      name: /dispositivos|devices/i,
    });
    // The header button; the empty state repeats the same label.
    this.addButton = page.getByTestId("devices-add");
    this.searchInput = page.getByTestId("filter-bar-search");
    this.emptyState = page.getByText(/nenhum dispositivo ainda|no devices yet/i);
    this.noResultsState = page.getByText(/nenhum resultado|no results/i);
    this.deviceCards = page.getByTestId("entity-card");

    this.modal = page.getByTestId("app-modal");
    this.createNameInput = this.modal.getByLabel(/nome do dispositivo|device name/i);
    this.createSubmitButton = this.modal.getByRole("button", { name: /^criar$|^create$/i });
    this.createNameError = this.modal.getByText(/informe um nome|enter a name/i);
    this.secretValueField = this.modal.getByLabel(/segredo do webhook|webhook secret/i);
    this.secretGoToDeviceButton = this.modal.getByRole("button", {
      name: /ir para o dispositivo|go to device/i,
    });

    this.confirmDialog = page.getByRole("alertdialog");
    this.confirmDeleteButton = this.confirmDialog.getByRole("button", {
      name: /^excluir$|^delete$/i,
    });
    this.confirmCancelButton = this.confirmDialog.getByRole("button", {
      name: /^cancelar$|^cancel$/i,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto("/devices");
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    // The list's own debounce is 300ms (`useDebounce(search, 300)` in
    // DevicesListPage.tsx); 500ms is the project's documented search-wait
    // convention and comfortably clears it.
    await this.page.waitForTimeout(500);
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.fill("");
    await this.page.waitForTimeout(500);
  }

  async clickAdd(): Promise<void> {
    await this.addButton.click();
  }

  async fillCreateName(name: string): Promise<void> {
    await this.createNameInput.fill(name);
  }

  async submitCreateForm(): Promise<void> {
    await this.createSubmitButton.click();
  }

  async goToDeviceFromSecret(): Promise<void> {
    await this.secretGoToDeviceButton.click();
  }

  cardByName(name: string): Locator {
    return this.deviceCards.filter({ hasText: name });
  }

  async openCardActions(name: string): Promise<void> {
    await this.cardByName(name)
      .first()
      .getByRole("button", { name: /ações|actions/i })
      .click();
  }

  async deleteFromList(name: string): Promise<void> {
    await this.openCardActions(name);
    await this.page.getByRole("menuitem", { name: /^excluir$|^delete$/i }).click();
  }

  async confirmDelete(): Promise<void> {
    await this.confirmDeleteButton.click();
  }

  async cancelDelete(): Promise<void> {
    await this.confirmCancelButton.click();
  }

  async openDevice(name: string): Promise<void> {
    await this.cardByName(name).first().click();
  }

  async expectDeviceVisible(name: string): Promise<void> {
    await expect(this.cardByName(name).first()).toBeVisible();
  }

  async expectDeviceNotVisible(name: string): Promise<void> {
    await expect(this.cardByName(name).first()).not.toBeVisible({ timeout: 10000 });
  }
}
