import { type Page, type Locator } from "@playwright/test";

/**
 * The persistent app chrome mounted on every authenticated route: the
 * primary nav (sidebar on desktop, bottom pill on mobile — see `mainNav`),
 * the user menu (profile / color mode / sign out), the sidebar collapse
 * toggle, and the 404 fallback it renders for an unmatched route.
 */
export class AppShellPage {
  readonly page: Page;
  /**
   * `SidebarNavItems` and `MobileBottomNav` both render a
   * `<nav aria-label="Navegação principal">` landmark — one hidden by a CSS
   * breakpoint, never unmounted. `.filter({ visible: true })` resolves to
   * whichever one the current viewport actually shows instead of reaching
   * for `nth()`/`first()`, so the same locator drives both the desktop
   * sidebar and the mobile bottom-nav specs.
   */
  readonly mainNav: Locator;
  readonly collapseToggle: Locator;
  readonly userMenuTrigger: Locator;
  readonly userMenuProfileItem: Locator;
  readonly userMenuColorModeItem: Locator;
  readonly userMenuSignOutItem: Locator;
  readonly notFoundHeading: Locator;
  readonly notFoundBackHomeButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.mainNav = page
      .getByRole("navigation", { name: /navegação principal|main navigation/i })
      .filter({ visible: true });

    this.collapseToggle = page.getByRole("button", {
      name: /expandir menu|recolher menu|expand menu|collapse menu/i,
    });

    this.userMenuTrigger = page.getByTestId("user-menu-trigger");
    this.userMenuProfileItem = page.getByRole("menuitem", {
      name: /^perfil$|^profile$/i,
    });
    this.userMenuColorModeItem = page.getByRole("menuitem", {
      name: /mudar para tema|switch to (light|dark) theme/i,
    });
    this.userMenuSignOutItem = page.getByTestId("user-menu-sign-out");

    this.notFoundHeading = page.getByRole("heading", { name: "404" });
    this.notFoundBackHomeButton = page.getByRole("button", {
      name: /voltar ao início|back to home/i,
    });
  }

  /** The nav link for a given item, scoped to whichever landmark is
   *  actually visible at the current viewport. */
  navLink(name: RegExp): Locator {
    return this.mainNav.getByRole("link", { name });
  }

  async clickNav(name: RegExp): Promise<void> {
    await this.navLink(name).click();
  }

  async toggleSidebarCollapse(): Promise<void> {
    await this.collapseToggle.click();
  }

  /** Reads the sidebar's persisted preference straight from storage —
   *  faster and less brittle than inferring it from rendered widths. */
  async isSidebarCollapsed(): Promise<boolean> {
    return this.page.evaluate(
      () => localStorage.getItem("@pombo-web:sidebar-collapsed") === "true",
    );
  }

  async openUserMenu(): Promise<void> {
    await this.userMenuTrigger.click();
  }

  async toggleColorMode(): Promise<void> {
    await this.openUserMenu();
    await this.userMenuColorModeItem.click();
  }

  /** `next-themes` writes the explicit choice synchronously on toggle —
   *  safe to read right after the click resolves, no poll needed. */
  async getColorMode(): Promise<string | null> {
    return this.page.evaluate(() => localStorage.getItem("pombo-color-mode"));
  }

  async signOut(): Promise<void> {
    await this.openUserMenu();
    await this.userMenuSignOutItem.click();
  }
}
