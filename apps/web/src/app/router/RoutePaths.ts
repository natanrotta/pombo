export const ROUTE_PATHS = {
  signIn: "/sign-in",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",

  devices: "/devices",
  deviceDetail: "/devices/:id",
  sandbox: "/sandbox",
  profile: "/perfil",
  api: "/api",
  settings: "/settings",

  notFound: "/404",

  /** DEV-only design-system gallery — never mounted in a production build. */
  styleguide: "/dev/styleguide",
} as const;
