// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import html from "./splash.html?raw";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));

beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers();
  localStorage.setItem("ui_lang", "de");
  document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)![1].replace(/<script\b[\s\S]*?<\/script>/g, "");
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callback(0); return 0; });
  mocks.invoke.mockImplementation(async name => name === "startup_status" ? { sequence: 1, phase: "installation_required", error: null } : undefined);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("keeps the slow-start hint hidden and quits through either visible control", async () => {
  await import("./splash");
  await vi.advanceTimersByTimeAsync(16000);
  expect(document.querySelector<HTMLElement>("#splashSlow")!.hidden).toBe(true);
  expect(document.querySelector<HTMLElement>("#splashQuit")!.hidden).toBe(false);
  for (const id of ["#splashQuit", "#splashClose"]) {
    mocks.invoke.mockClear();
    document.querySelector<HTMLButtonElement>(id)!.click();
    expect(mocks.invoke).toHaveBeenCalledWith("exit_app");
  }
});
