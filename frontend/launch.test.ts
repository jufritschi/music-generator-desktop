// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), startApp: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("./main", () => ({ startApp: mocks.startApp }));

beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); document.body.innerHTML = '<p id="bootStatus"></p>'; });

it("does not load the main application when installation is required", async () => {
  mocks.invoke.mockResolvedValue(false);
  await import("./launch");
  await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("startup_allowed"));
  expect(mocks.startApp).not.toHaveBeenCalled();
});

it("starts a copied application after checking its location", async () => {
  mocks.invoke.mockResolvedValue(true);
  await import("./launch");
  await vi.waitFor(() => expect(mocks.startApp).toHaveBeenCalledOnce());
  expect(mocks.invoke).toHaveBeenCalledWith("startup_allowed");
});
