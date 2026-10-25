import { I18N } from "./i18n.js";
import type { Language } from "./locales";

const keys = ["status", "details", "synthesis", "language_model", "not_started", "unconfirmed", "stopped", "unknown", "cpu_requested", "cpu_only", "lm_selftest_failed", "cuda_architecture_unsupported", "cuda_initialization_failed", "reason_unknown", "compatibility", "cuda_compatible", "cuda_incompatible", "cuda_unknown", "driver", "compute_capability", "setup_result", "enter_studio"] as const;
const translations: Record<Language, string[]> = {
  de: [
    "Rechen-Backend", "Backend-Details", "Klangerzeugung", "Sprachmodell", "Noch nicht gestartet", "Noch nicht bestätigt", "Engine beendet", "Unbekannt",
    "CPU ausdrücklich ausgewählt.", "Dieses App-Bundle verwendet ausschließlich die CPU.", "Der Sprachmodelltest war nicht erfolgreich; das Sprachmodell verwendet deshalb die CPU.",
    "Die GPU-Architektur wird vom enthaltenen CUDA-Build nicht unterstützt.", "Die CUDA-Initialisierung ist laut aktuellem Engine-Log fehlgeschlagen.", "Ein Grund für die Backend-Auswahl ist nicht belegt.",
    "CUDA-Build-Kompatibilität", "Die GPU-Architektur ist enthalten. Ein passender Treiber ist zusätzlich erforderlich; CUDA-Nutzung ist noch nicht bestätigt.", "Die GPU-Architektur ist in diesem CUDA-Build nicht enthalten. Vulkan oder CPU können weiterhin funktionieren.", "Die CUDA-Kompatibilität konnte nicht bestimmt werden.",
    "Treiber", "Compute Capability", "Ergebnis des Hardwaretests", "Zum Studio",
  ],
  en: [
    "Compute backend", "Backend details", "Sound generation", "Language model", "Not started yet", "Not confirmed yet", "Engine stopped", "Unknown",
    "CPU explicitly selected.", "This app bundle uses the CPU only.", "The language model test did not succeed; the language model therefore uses the CPU.",
    "The GPU architecture is not supported by the included CUDA build.", "CUDA initialization failed according to the current engine log.", "No reason for the backend selection has been established.",
    "CUDA build compatibility", "The GPU architecture is included. A compatible driver is also required; CUDA use is not confirmed yet.", "The GPU architecture is not included in this CUDA build. Vulkan or CPU may still work.", "CUDA compatibility could not be determined.",
    "Driver", "Compute capability", "Hardware test result", "Go to studio",
  ],
  es: [
    "Motor de cálculo", "Detalles del motor", "Generación de sonido", "Modelo de lenguaje", "Aún no iniciado", "Aún no confirmado", "Motor detenido", "Desconocido",
    "CPU seleccionada expresamente.", "Este paquete de la aplicación solo usa la CPU.", "La prueba del modelo de lenguaje no tuvo éxito; por eso el modelo usa la CPU.",
    "La arquitectura de la GPU no es compatible con la compilación CUDA incluida.", "La inicialización de CUDA falló según el registro actual del motor.", "No se ha establecido el motivo de la selección del motor.",
    "Compatibilidad de la compilación CUDA", "La arquitectura de la GPU está incluida. También se necesita un controlador compatible; el uso de CUDA aún no está confirmado.", "La arquitectura de la GPU no está incluida en esta compilación CUDA. Vulkan o CPU podrían funcionar.", "No se pudo determinar la compatibilidad con CUDA.",
    "Controlador", "Capacidad de cálculo", "Resultado de la prueba de hardware", "Ir al estudio",
  ],
  fr: [
    "Moteur de calcul", "Détails du moteur", "Génération sonore", "Modèle de langage", "Pas encore démarré", "Pas encore confirmé", "Moteur arrêté", "Inconnu",
    "CPU explicitement sélectionné.", "Ce paquet de l’application utilise uniquement le CPU.", "Le test du modèle de langage n’a pas réussi ; le modèle utilise donc le CPU.",
    "L’architecture du GPU n’est pas prise en charge par la version CUDA incluse.", "L’initialisation CUDA a échoué selon le journal actuel du moteur.", "La raison du choix du moteur n’a pas été établie.",
    "Compatibilité de la version CUDA", "L’architecture du GPU est incluse. Un pilote compatible est aussi nécessaire ; l’utilisation de CUDA n’est pas encore confirmée.", "L’architecture du GPU n’est pas incluse dans cette version CUDA. Vulkan ou le CPU peuvent fonctionner.", "La compatibilité CUDA n’a pas pu être déterminée.",
    "Pilote", "Capacité de calcul", "Résultat du test matériel", "Aller au studio",
  ],
  it: [
    "Motore di calcolo", "Dettagli del motore", "Generazione audio", "Modello linguistico", "Non ancora avviato", "Non ancora confermato", "Motore arrestato", "Sconosciuto",
    "CPU selezionata esplicitamente.", "Questo pacchetto dell’app usa solo la CPU.", "Il test del modello linguistico non è riuscito; il modello usa quindi la CPU.",
    "L’architettura della GPU non è supportata dalla build CUDA inclusa.", "L’inizializzazione CUDA è fallita secondo il registro attuale del motore.", "Il motivo della scelta del motore non è stato accertato.",
    "Compatibilità della build CUDA", "L’architettura della GPU è inclusa. Serve anche un driver compatibile; l’uso di CUDA non è ancora confermato.", "L’architettura della GPU non è inclusa in questa build CUDA. Vulkan o CPU potrebbero funzionare.", "Non è stato possibile determinare la compatibilità CUDA.",
    "Driver", "Capacità di calcolo", "Risultato del test hardware", "Vai allo studio",
  ],
  pt: [
    "Motor de cálculo", "Detalhes do motor", "Geração de som", "Modelo de linguagem", "Ainda não iniciado", "Ainda não confirmado", "Motor parado", "Desconhecido",
    "CPU selecionada explicitamente.", "Este pacote da aplicação usa apenas a CPU.", "O teste do modelo de linguagem não teve sucesso; por isso o modelo usa a CPU.",
    "A arquitetura da GPU não é suportada pela compilação CUDA incluída.", "A inicialização CUDA falhou segundo o registo atual do motor.", "Não foi comprovado o motivo da seleção do motor.",
    "Compatibilidade da compilação CUDA", "A arquitetura da GPU está incluída. Também é necessário um controlador compatível; o uso de CUDA ainda não foi confirmado.", "A arquitetura da GPU não está incluída nesta compilação CUDA. Vulkan ou CPU podem funcionar.", "Não foi possível determinar a compatibilidade CUDA.",
    "Controlador", "Capacidade de cálculo", "Resultado do teste de hardware", "Ir para o estúdio",
  ],
  tr: [
    "Hesaplama arka ucu", "Arka uç ayrıntıları", "Ses üretimi", "Dil modeli", "Henüz başlatılmadı", "Henüz doğrulanmadı", "Motor durdu", "Bilinmiyor",
    "CPU açıkça seçildi.", "Bu uygulama paketi yalnızca CPU kullanır.", "Dil modeli testi başarılı olmadı; bu nedenle dil modeli CPU kullanır.",
    "GPU mimarisi, paketteki CUDA derlemesi tarafından desteklenmiyor.", "Güncel motor günlüğüne göre CUDA başlatılamadı.", "Arka uç seçiminin nedeni doğrulanamadı.",
    "CUDA derlemesi uyumluluğu", "GPU mimarisi dahildir. Uyumlu bir sürücü de gereklidir; CUDA kullanımı henüz doğrulanmadı.", "GPU mimarisi bu CUDA derlemesine dahil değildir. Vulkan veya CPU çalışabilir.", "CUDA uyumluluğu belirlenemedi.",
    "Sürücü", "Hesaplama yeteneği", "Donanım testi sonucu", "Stüdyoya git",
  ],
  pl: [
    "Silnik obliczeniowy", "Szczegóły silnika", "Generowanie dźwięku", "Model językowy", "Jeszcze nie uruchomiono", "Jeszcze nie potwierdzono", "Silnik zatrzymany", "Nieznany",
    "CPU wybrano świadomie.", "Ten pakiet aplikacji korzysta wyłącznie z CPU.", "Test modelu językowego nie powiódł się; dlatego model korzysta z CPU.",
    "Architektura GPU nie jest obsługiwana przez dołączoną kompilację CUDA.", "Inicjalizacja CUDA nie powiodła się według bieżącego dziennika silnika.", "Nie ustalono przyczyny wyboru silnika.",
    "Zgodność kompilacji CUDA", "Architektura GPU jest uwzględniona. Potrzebny jest też zgodny sterownik; użycie CUDA nie zostało jeszcze potwierdzone.", "Architektura GPU nie jest uwzględniona w tej kompilacji CUDA. Vulkan lub CPU mogą działać.", "Nie udało się określić zgodności z CUDA.",
    "Sterownik", "Zdolność obliczeniowa", "Wynik testu sprzętu", "Przejdź do studia",
  ],
  ru: [
    "Вычислительный движок", "Сведения о движке", "Генерация звука", "Языковая модель", "Ещё не запущен", "Ещё не подтверждено", "Движок остановлен", "Неизвестно",
    "CPU выбран явно.", "Эта сборка приложения использует только CPU.", "Тест языковой модели не прошёл успешно; поэтому модель использует CPU.",
    "Архитектура GPU не поддерживается включённой сборкой CUDA.", "Согласно текущему журналу движка, инициализация CUDA завершилась ошибкой.", "Причина выбора движка не установлена.",
    "Совместимость сборки CUDA", "Архитектура GPU включена. Также нужен совместимый драйвер; использование CUDA ещё не подтверждено.", "Архитектура GPU не включена в эту сборку CUDA. Vulkan или CPU могут работать.", "Не удалось определить совместимость с CUDA.",
    "Драйвер", "Вычислительная способность", "Результат проверки оборудования", "Перейти в студию",
  ],
  uk: [
    "Обчислювальний рушій", "Відомості про рушій", "Генерація звуку", "Мовна модель", "Ще не запущено", "Ще не підтверджено", "Рушій зупинено", "Невідомо",
    "CPU вибрано явно.", "Ця збірка застосунку використовує лише CPU.", "Тест мовної моделі не був успішним; тому модель використовує CPU.",
    "Архітектура GPU не підтримується включеною збіркою CUDA.", "Згідно з поточним журналом рушія, ініціалізація CUDA завершилася помилкою.", "Причину вибору рушія не встановлено.",
    "Сумісність збірки CUDA", "Архітектуру GPU включено. Також потрібен сумісний драйвер; використання CUDA ще не підтверджено.", "Архітектуру GPU не включено до цієї збірки CUDA. Vulkan або CPU можуть працювати.", "Не вдалося визначити сумісність із CUDA.",
    "Драйвер", "Обчислювальна здатність", "Результат перевірки обладнання", "Перейти до студії",
  ],
  ja: [
    "計算バックエンド", "バックエンドの詳細", "音声生成", "言語モデル", "まだ起動していません", "まだ確認されていません", "エンジン停止", "不明",
    "CPUが明示的に選択されています。", "このアプリパッケージはCPUのみを使用します。", "言語モデルのテストが成功しなかったため、言語モデルはCPUを使用します。",
    "GPUアーキテクチャは同梱のCUDAビルドでサポートされていません。", "現在のエンジンログによるとCUDAの初期化に失敗しました。", "バックエンドが選択された理由は確認されていません。",
    "CUDAビルドの互換性", "GPUアーキテクチャは含まれています。対応するドライバーも必要です。CUDAの使用はまだ確認されていません。", "GPUアーキテクチャはこのCUDAビルドに含まれていません。VulkanまたはCPUは動作する可能性があります。", "CUDAの互換性を判定できませんでした。",
    "ドライバー", "Compute Capability", "ハードウェアテスト結果", "スタジオへ",
  ],
  zh: [
    "计算后端", "后端详情", "声音生成", "语言模型", "尚未启动", "尚未确认", "引擎已停止", "未知",
    "已明确选择 CPU。", "此应用包仅使用 CPU。", "语言模型测试未成功，因此语言模型使用 CPU。",
    "GPU 架构不受内置 CUDA 构建支持。", "根据当前引擎日志，CUDA 初始化失败。", "尚未确认选择此后端的原因。",
    "CUDA 构建兼容性", "已包含此 GPU 架构。还需要兼容的驱动程序；尚未确认 CUDA 的实际使用。", "此 CUDA 构建不包含该 GPU 架构。Vulkan 或 CPU 仍可能运行。", "无法确定 CUDA 兼容性。",
    "驱动程序", "计算能力", "硬件测试结果", "进入工作室",
  ],
};

for (const [language, values] of Object.entries(translations)) {
  if (values.length !== keys.length) throw new Error(`Incomplete backend translation: ${language}`);
  Object.assign(I18N[language as Language], Object.fromEntries(keys.map((key, i) => [`backend_${key}`, values[i]])));
}
