// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { importKeys, importMessages, plainImportKeys, plainImportMessages } from "./import-i18n";
import { I18N } from "./i18n.js";

it("provides every import and sandbox message in all supported languages", () => {
  expect(Object.keys(importMessages).sort()).toEqual(Object.keys(I18N).sort());
  for (const values of Object.values(importMessages)) {
    expect(values).toHaveLength(importKeys.length);
    expect(values.every(value => typeof value === "string" && value.length > 0)).toBe(true);
  }
});

it("provides and registers all five neutral folder messages in all supported languages", () => {
  expect(Object.keys(plainImportMessages).sort()).toEqual(Object.keys(I18N).sort());
  expect(plainImportKeys).toHaveLength(5);
  for (const [language, values] of Object.entries(plainImportMessages)) {
    expect(values).toHaveLength(plainImportKeys.length);
    const translations = I18N[language as keyof typeof I18N] as Record<string, unknown>;
    for (const key of plainImportKeys) {
      expect(translations[`import_${key}_plain`]).toEqual(expect.any(String));
      expect(String(translations[`import_${key}_plain`]).trim()).not.toBe("");
    }
  }
});
