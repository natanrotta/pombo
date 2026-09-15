import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { AppError } from "@/core/errors/AppError";
import { ErrorCodes } from "@/core/errors/errorCodes";

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
        name: ["Nome é obrigatório"],
        phone: ["Telefone inválido"],
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
});
