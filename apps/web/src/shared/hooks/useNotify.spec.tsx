import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { AppError } from "@/core/errors/AppError";
import { ErrorCodes } from "@pombo/shared-types";
import commonPtBR from "@/shared/i18n/locales/pt-BR/common.json";

const createMock = vi.fn();
const isVisibleMock = vi.fn((_id: string) => false);

// Stub the toaster store, not the hook: the contract under test is exactly what
// `useNotify` hands to it (type, title, description, duration, dedupe id).
vi.mock("@/components/ui/toaster", () => ({
  toaster: {
    create: (options: unknown) => createMock(options),
    isVisible: (id: string) => isVisibleMock(id),
  },
}));

const { useNotify } = await import("@/shared/hooks/useNotify");

/** The localized "wait" sentence, built from the pt-BR copy itself. */
const retryIn = (time: string) =>
  commonPtBR.notify.retryIn.replace("{{time}}", time);

const rateLimited = (message: string, details?: unknown) =>
  new AppError(message, ErrorCodes.RATE_LIMIT, 429, details);

function lastDescription(): unknown {
  const options = createMock.mock.lastCall?.[0] as
    | { description?: unknown }
    | undefined;
  return options?.description;
}

describe("useNotify", () => {
  beforeEach(() => {
    createMock.mockClear();
    isVisibleMock.mockReset();
    isVisibleMock.mockReturnValue(false);
  });

  it("publishes a success toast", () => {
    const { result } = renderHook(() => useNotify());
    result.current.showSuccess("Salvo");

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "Salvo" }),
    );
  });

  it("publishes info and warning toasts with their own durations", () => {
    const { result } = renderHook(() => useNotify());
    result.current.showInfo("Info");
    result.current.showWarning("Cuidado");

    expect(createMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "info", title: "Info", duration: 2500 }),
    );
    expect(createMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "warning",
        title: "Cuidado",
        duration: 3000,
      }),
    );
  });

  it("surfaces an AppError message as the toast description", () => {
    const { result } = renderHook(() => useNotify());
    result.current.showError(new AppError("Dispositivo não encontrado"));

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        description: "Dispositivo não encontrado",
      }),
    );
  });

  it("flattens VALIDATION_ERROR field details into one readable line", () => {
    const { result } = renderHook(() => useNotify());
    result.current.showError(
      new AppError("inválido", ErrorCodes.VALIDATION_ERROR, 422, {
        formErrors: [],
        fieldErrors: {
          name: ["Nome é obrigatório"],
          phone: ["Telefone inválido"],
        },
      }),
    );

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Nome é obrigatório. Telefone inválido",
      }),
    );
  });

  it("does not stack a duplicate error toast that is still on screen", () => {
    isVisibleMock.mockReturnValue(true);
    const { result } = renderHook(() => useNotify());

    result.current.showError(new AppError("mesma falha"));

    expect(createMock).not.toHaveBeenCalled();
  });

  describe("rate-limit wait hint", () => {
    it.each([
      [30, "30 s"],
      [1, "1 s"],
      [0.4, "1 s"],
      [59, "59 s"],
    ])("appends the wait in seconds for retryAfter=%s", (retryAfter, time) => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(
        rateLimited("Muitas tentativas", { retryAfter }),
      );

      expect(lastDescription()).toBe(`Muitas tentativas. ${retryIn(time)}`);
    });

    it.each([
      [60, "1 min"],
      [61, "2 min"],
      [90, "2 min"],
      [120, "2 min"],
      [900, "15 min"],
    ])("appends the wait in rounded-up minutes for retryAfter=%s", (retryAfter, time) => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(
        rateLimited("Muitas tentativas", { retryAfter }),
      );

      expect(lastDescription()).toBe(`Muitas tentativas. ${retryIn(time)}`);
    });

    it.each([
      "Muitas tentativas.",
      "Muitas tentativas!",
      "Muitas tentativas?",
    ])("does not add a second period after %j", (message) => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(rateLimited(message, { retryAfter: 30 }));

      expect(lastDescription()).toBe(`${message} ${retryIn("30 s")}`);
    });

    it.each([
      ["no details", undefined],
      ["details without retryAfter", {}],
      ["an undefined retryAfter", { retryAfter: undefined }],
      ["a zero retryAfter", { retryAfter: 0 }],
      ["a negative retryAfter", { retryAfter: -5 }],
      ["a numeric-string retryAfter", { retryAfter: "30" }],
      ["a NaN retryAfter (unparseable HTTP-date header)", { retryAfter: NaN }],
      ["an infinite retryAfter", { retryAfter: Infinity }],
    ])("leaves the message untouched for %s", (_label, details) => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(rateLimited("Muitas tentativas", details));

      expect(lastDescription()).toBe("Muitas tentativas");
    });

    it("never adds the wait hint to a non-429 error", () => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(
        new AppError("Serviço indisponível", ErrorCodes.INTERNAL_ERROR, 503, {
          retryAfter: 30,
        }),
      );

      expect(lastDescription()).toBe("Serviço indisponível");
    });

    it("keys the dedupe id on the message including the wait hint", () => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(
        rateLimited("Muitas tentativas", { retryAfter: 30 }),
      );

      expect(isVisibleMock).toHaveBeenCalledWith(
        `error:Muitas tentativas. ${retryIn("30 s")}`,
      );
    });
  });

  describe("validation errors", () => {
    it("still flattens field details when the error is not a rate limit", () => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(
        new AppError("inválido", ErrorCodes.VALIDATION_ERROR, 422, {
          formErrors: [],
          fieldErrors: {
            email: ["E-mail inválido", "E-mail já cadastrado"],
            name: ["Nome é obrigatório"],
          },
        }),
      );

      expect(lastDescription()).toBe(
        "E-mail inválido. E-mail já cadastrado. Nome é obrigatório",
      );
    });

    it("keeps the error message when the validation details carry no field errors", () => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(
        new AppError("inválido", ErrorCodes.VALIDATION_ERROR, 422, {
          formErrors: [],
          fieldErrors: {},
        }),
      );

      expect(lastDescription()).toBe("inválido");
    });

    it("includes form-level errors before the field errors", () => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(
        new AppError("inválido", ErrorCodes.VALIDATION_ERROR, 422, {
          formErrors: ["Envie ao menos um campo"],
          fieldErrors: { name: ["Nome é obrigatório"], phone: undefined },
        }),
      );

      expect(lastDescription()).toBe(
        "Envie ao menos um campo. Nome é obrigatório",
      );
    });

    it("keeps the error message when the details are not the API shape", () => {
      const { result } = renderHook(() => useNotify());
      result.current.showError(
        new AppError("inválido", ErrorCodes.VALIDATION_ERROR, 422, "oops"),
      );

      expect(lastDescription()).toBe("inválido");
    });
  });

  it("falls back to the localized default error for a non-error value", () => {
    const { result } = renderHook(() => useNotify());
    result.current.showError(undefined);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: commonPtBR.notify.errorTitle,
        description: commonPtBR.notify.defaultError,
      }),
    );
  });
});
