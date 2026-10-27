import { I18N } from "./i18n.js";
import type { Language } from "./locales";

const keys = ["chip_label", "ready", "observed"] as const;
const translations: Record<Language, readonly [string, string, string]> = {
  de: ["Rechenbackend", "Erkannt und verfügbar", "In der Engine bestätigt"],
  en: ["Compute", "Detected and available", "Confirmed by the engine"],
  es: ["Cálculo", "Detectado y disponible", "Confirmado por el motor"],
  fr: ["Calcul", "Détecté et disponible", "Confirmé par le moteur"],
  it: ["Calcolo", "Rilevato e disponibile", "Confermato dal motore"],
  pt: ["Cálculo", "Detetado e disponível", "Confirmado pelo motor"],
  tr: ["Hesaplama", "Algılandı ve kullanılabilir", "Motor tarafından doğrulandı"],
  pl: ["Obliczenia", "Wykryty i dostępny", "Potwierdzony przez silnik"],
  ru: ["Вычисления", "Обнаружен и доступен", "Подтверждён движком"],
  uk: ["Обчислення", "Виявлено й доступно", "Підтверджено рушієм"],
  ja: ["計算", "検出済み・利用可能", "エンジンで確認済み"],
  zh: ["计算", "已检测到，可使用", "已由引擎确认"],
};

for (const [language, values] of Object.entries(translations)) {
  Object.assign(I18N[language as Language], Object.fromEntries(keys.map((key, i) => [`backend_${key}`, values[i]])));
}
