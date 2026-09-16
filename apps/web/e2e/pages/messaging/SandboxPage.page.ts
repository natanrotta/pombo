import { type Page, type Locator } from "@playwright/test";

/**
 * Page Object for `/sandbox` (Messaging module).
 *
 * The e2e API always runs with `WHATSAPP_ENABLED=false`, so `GET /devices`
 * never returns a `CONNECTED` device for real — the composer/queue can only be
 * exercised against a mocked device + send/status responses (see
 * `tests/messaging/sandbox-send.spec.ts` for the `page.route` setup). This POM
 * only owns locators + atomic actions; it has no opinion on mocking.
 */
export class SandboxPage {
  readonly page: Page;
  readonly pageTitle: Locator;

  // Empty state (no connected device)
  readonly emptyStateTitle: Locator;
  readonly emptyStateAction: Locator;

  // Composer fields
  readonly deviceSelect: Locator;
  readonly typeSelect: Locator;
  readonly phoneInput: Locator;
  readonly phoneError: Locator;
  readonly groupSelect: Locator;
  readonly textArea: Locator;
  readonly mediaUrlInput: Locator;
  readonly captionInput: Locator;
  readonly countInput: Locator;
  readonly sendButton: Locator;
  readonly clearButton: Locator;

  // Queue (response panel)
  readonly queueEmptyTitle: Locator;
  readonly queueItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole("heading", { level: 1, name: /sandbox/i });

    this.emptyStateTitle = page.getByText(
      /nenhum dispositivo conectado|no connected device/i,
    );
    this.emptyStateAction = page.getByRole("button", {
      name: /ir para dispositivos|go to devices/i,
    });

    this.deviceSelect = page.getByRole("combobox", {
      name: /dispositivo|device/i,
    });
    this.typeSelect = page.getByRole("combobox", {
      name: /tipo da mensagem|message type/i,
    });
    this.phoneInput = page.getByLabel(/número de destino|recipient number/i);
    // Field-level error text rendered under the recipient input — scoped to
    // the field group, because the send status can repeat the API message.
    this.phoneError = page
      .getByRole("group")
      .filter({ has: this.phoneInput })
      .getByText(
        /este número não está no whatsapp|this number isn't on whatsapp|informe um número válido|enter a valid number/i,
      );
    this.groupSelect = page.getByRole("combobox", {
      name: /grupo de destino|recipient group/i,
    });
    this.textArea = page.getByLabel(/^mensagem$|^message$/i);
    this.mediaUrlInput = page.getByLabel(
      /url da imagem|image url|url do áudio|audio url|url do vídeo|video url|url do documento|document url/i,
    );
    this.captionInput = page.getByLabel(/^legenda$|^caption$/i);
    this.countInput = page.getByLabel(/quantidade|quantity/i);
    this.sendButton = page.getByRole("button", { name: /^enviar$|^send$/i });
    this.clearButton = page.getByRole("button", { name: /^limpar$|^clear$/i });

    this.queueEmptyTitle = page.getByText(/nenhum envio ainda|no send yet/i);
    this.queueItems = page.getByText(/^mensagem \d+\/\d+$|^message \d+\/\d+$/i);
  }

  async goto() {
    await this.page.goto("/sandbox");
  }

  /** Switches the composer's message type by the stable option value (not the
   *  translated label), so the selection is locale-independent. */
  async selectType(
    type: "text" | "image" | "audio" | "video" | "document" | "group",
  ) {
    await this.typeSelect.selectOption(type);
  }

  async selectGroup(groupJid: string) {
    await this.groupSelect.selectOption(groupJid);
  }

  async fillPhone(value: string) {
    await this.phoneInput.fill(value);
  }

  async fillText(value: string) {
    await this.textArea.fill(value);
  }

  async fillMediaUrl(value: string) {
    await this.mediaUrlInput.fill(value);
  }

  async fillCaption(value: string) {
    await this.captionInput.fill(value);
  }

  async setCount(value: number) {
    await this.countInput.fill(String(value));
  }

  async send() {
    await this.sendButton.click();
  }
}
