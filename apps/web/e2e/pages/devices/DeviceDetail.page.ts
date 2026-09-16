import { type Page, type Locator } from "@playwright/test";

type WebhookField =
  | "onConnect"
  | "onDisconnect"
  | "onReceive"
  | "onMessageStatus"
  | "onSend";

const WEBHOOK_FIELD_LABELS: Record<WebhookField, RegExp> = {
  onConnect: /ao conectar|on connect/i,
  onDisconnect: /ao desconectar|on disconnect/i,
  onReceive: /ao receber|on receive/i,
  onMessageStatus: /status da mensagem|message status/i,
  onSend: /ao enviar|on send/i,
};

/** A single device's `/devices/:id` detail: status/actions header, the
 *  per-event webhooks section (autosave), the QR pairing modal and the
 *  delete confirm dialog. */
export class DeviceDetailPage {
  readonly page: Page;
  readonly backButton: Locator;
  readonly connectButton: Locator;
  readonly disconnectButton: Locator;
  readonly deleteButton: Locator;

  readonly qrModal: Locator;
  readonly qrGatewayDisabledTitle: Locator;
  readonly qrErrorText: Locator;
  readonly qrRetryButton: Locator;

  readonly saveButton: Locator;
  readonly webhooksSavedToast: Locator;
  readonly webhookInvalidUrlError: Locator;

  readonly confirmDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly confirmCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.backButton = page.getByRole("button", { name: /^voltar$|^back$/i });
    this.connectButton = page.getByRole("button", { name: /^conectar$|^connect$/i });
    this.disconnectButton = page.getByRole("button", { name: /^desconectar$|^disconnect$/i });
    this.deleteButton = page.getByRole("button", { name: /^excluir$|^delete$/i });

    this.qrModal = page.getByTestId("app-modal");
    this.qrGatewayDisabledTitle = page.getByText(
      /conexão indisponível neste ambiente|connection unavailable in this environment/i,
    );
    this.qrErrorText = page.getByText(
      /não foi possível iniciar a conexão|couldn't start the connection/i,
    );
    this.qrRetryButton = page.getByRole("button", { name: /tentar de novo|try again/i });

    this.saveButton = page.getByTestId("save-button");
    this.webhooksSavedToast = page.getByText(/webhooks salvos|webhooks saved/i);
    this.webhookInvalidUrlError = page.getByText(
      /use uma url http\(s\) válida|use a valid http\(s\) url/i,
    );

    this.confirmDialog = page.getByRole("alertdialog");
    this.confirmDeleteButton = this.confirmDialog.getByRole("button", {
      name: /^excluir$|^delete$/i,
    });
    this.confirmCancelButton = this.confirmDialog.getByRole("button", {
      name: /^cancelar$|^cancel$/i,
    });
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(`/devices/${id}`);
  }

  webhookInput(field: WebhookField): Locator {
    return this.page.getByLabel(WEBHOOK_FIELD_LABELS[field]);
  }

  async fillWebhookUrl(field: WebhookField, value: string): Promise<void> {
    await this.webhookInput(field).fill(value);
  }

  async clickConnect(): Promise<void> {
    await this.connectButton.click();
  }

  async clickDelete(): Promise<void> {
    await this.deleteButton.click();
  }

  async confirmDelete(): Promise<void> {
    await this.confirmDeleteButton.click();
  }

  async cancelDelete(): Promise<void> {
    await this.confirmCancelButton.click();
  }
}
