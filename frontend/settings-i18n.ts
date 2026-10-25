import { I18N } from "./i18n.js";
import type { Language } from "./locales";

const saving: Record<Language, string> = {
  de: "Einstellungen werden gespeichert…",
  en: "Saving settings…",
  es: "Guardando ajustes…",
  fr: "Enregistrement des paramètres…",
  it: "Salvataggio delle impostazioni…",
  pt: "A guardar definições…",
  tr: "Ayarlar kaydediliyor…",
  pl: "Zapisywanie ustawień…",
  ru: "Сохранение настроек…",
  uk: "Збереження налаштувань…",
  ja: "設定を保存中…",
  zh: "正在保存设置…",
};
for (const [language, message] of Object.entries(saving)) {
  Object.assign(I18N[language as Language], { settings_saving: message });
}
