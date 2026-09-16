import { type Page, type Locator, type FileChooser } from "@playwright/test";

type LanguageCode = "pt-BR" | "en" | "es";

/**
 * Page Object for `/perfil` (Settings module) — `ProfileTab` (autosaved name
 * + avatar + "change password") inside `ProfilePage`, plus the language
 * selector in its header (driven by the shell-navigation flow).
 */
export class ProfilePage {
  readonly page: Page;
  readonly pageTitle: Locator;

  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly saveButton: Locator;
  readonly changePasswordButton: Locator;
  readonly avatarButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole("heading", {
      level: 1,
      name: /^perfil$|^profile$/i,
    });

    this.fullNameInput = page.getByLabel(/nome completo|full name/i);
    // Anchored to the exact label — the page also renders "Alterar foto de
    // perfil" (avatar) and the security card, neither of which contains the
    // bare word "e-mail"/"email" on its own.
    this.emailInput = page.getByLabel(/^e-mail$|^email$/i);
    this.saveButton = page.getByTestId("save-button");
    this.changePasswordButton = page.getByRole("button", {
      name: /alterar senha|change password/i,
    });
    this.avatarButton = page.getByRole("button", {
      name: /alterar foto de perfil|change profile picture/i,
    });
  }

  async goto() {
    await this.page.goto("/perfil");
  }

  /** Each option's accessible name is the language's own native name, so the
   *  `language-option-<code>` test id is the locale-independent locator. */
  languageOption(code: LanguageCode): Locator {
    return this.page.getByTestId(`language-option-${code}`);
  }

  async selectLanguage(code: LanguageCode) {
    await this.languageOption(code).click();
  }

  async fillFullName(value: string) {
    await this.fullNameInput.fill(value);
  }

  async save() {
    await this.saveButton.click();
  }

  /** A toast row whose text matches `pattern` (bilingual regex). */
  toast(pattern: RegExp): Locator {
    return this.page.getByTestId("toast").filter({ hasText: pattern });
  }

  async requestPasswordReset() {
    await this.changePasswordButton.click();
  }

  /**
   * Opens the native file chooser via the visible avatar button (mirrors the
   * real click → hidden `<input type="file">` interaction) and picks `file`.
   * The hidden input carries no accessible name of its own, so intercepting
   * the `filechooser` event is the only role/label-safe way in.
   */
  async selectAvatarFile(file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser"),
      this.avatarButton.click(),
    ]);
    await (chooser as FileChooser).setFiles(file);
  }
}
