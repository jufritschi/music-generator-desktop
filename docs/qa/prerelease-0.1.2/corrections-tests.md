# Abschließende automatisierte Prüfung der 0.1.2-Korrekturen

Stand: 27. Oktober 2026. Geprüft wurden die lokalen 0.1.2-Korrekturen auf Basis `c8f8b0e15aeba986e2edd374800aa81a4d817eb1`. Host: macOS 26.6.2, Apple Silicon; Node 26.12.0 und Rust/Cargo 1.99.1. Die Tabellen beschreiben tatsächlich ausgeführte lokale Prüfungen. Neue native CI-Läufe auf allen Zielplattformen und die aktuelle Inferenzabnahme werden dadurch nicht vorweggenommen.

| Prüfung | Letztes Ergebnis | Beleg |
| --- | --- | --- |
| Frontend (`npm test`) | **337 bestanden**, 0 Fehler; **37 Dateien** | [Frontendlog](evidence/corrections-frontend.log) |
| Desktopskripte (`npm run test:desktop`) | **28 bestanden**, 0 Fehler; 2 Suiten | [Desktoplog aus rc012](evidence/corrections-desktop.log) |
| Vollständige gesperrte Rust-Suite | **193 bestanden**, 0 Fehler, **1 absichtlich ignoriert**; 26 Test-/Docphasen | [Rustlog](evidence/corrections-rust.log) |
| TypeScript und Vite-Produktion (`npm run build`) | bestanden | [Buildlog](evidence/corrections-build.log) |
| ESLint (`npm run lint`) | bestanden | [Lintlog](evidence/corrections-lint.log) |
| Clippy, alle Targets, Warnungen als Fehler | bestanden | [Clippylog](evidence/corrections-clippy.log) |
| Rustfmt nach dem unten beschriebenen Test-Fix | bestanden, Exit 0 | `cargo fmt --manifest-path src-tauri/Cargo.toml --check` |
| Betroffene Rust-Suite nach dem Windows-Test-Fix | **4 bestanden**, 0 Fehler | [Audio-Facts-Wiederholung](evidence/corrections-audio-facts.log) |

**558 verschiedene Tests bestanden: 337 Frontend + 28 Desktop + 193 Rust.** Die vier erneut ausgeführten Audio-Facts-Tests und die 67 zuletzt gezielt ausgeführten Retry-/Generierungs-Frontendtests sind Teilmengen; sie werden nicht nochmals addiert. Die ignorierte Rust-Funktion `process_output::tests::probe_fixture` dient als ausdrücklich markierte Subprozess-Fixture und ist kein übersprungener Produktabnahmetest.

## Iterationen, Varianten und Wiederholung

Der sichtbare IT-Bereich entspricht dem gepinnten Engine-Limit von **1–100**. Tests reproduzierten zuerst rot, dass 120/200 Schritte und gespeicherte 120er Formularwerte unverändert blieben. Die Korrektur zeigt und übermittelt höchstens 100. Das Frontend normalisiert beim Laden ohne zusätzlichen Save-IPC; das Backend migriert gespeicherte Altpräferenzen über 100 dauerhaft per Compare-and-Swap. Historische Songparameter bleiben unverändert.

Legacywerte 0/fehlend erhalten die tatsächlichen Engine-Defaults: **50 Standard, 8 Turbo**. Songübernahme und neue Varianten berücksichtigen das gespeicherte Modell oder die aktive Creator-Auswahl. Ein Retry ohne historische Modellwahl verwendet dagegen die tatsächliche Backend-Settingswahl. Deren `legacy_inference_steps` liefert exakt 50/8; die CPU-Empfehlung von 30 wird nicht als Engine-Default missverstanden. Eine abweichende rein lokale Creatorwahl beeinflusst diesen Retry-Guard nicht. Bei Policy-Ausfall bleibt die Entscheidung mit „unknown“ und Legacy-Default 50 konservativ. Ein generischer Aufruf ohne Modellkontext lässt den Sentinel bis zum Backend stehen. Fünf zunächst rote Retry-Kontext-/Fallback-Prüfungen wurden korrigiert; die [gezielte 67er-Suite](evidence/corrections-retry.log) und anschließend die gesamte Frontendsuite bestanden. Die [rote Reproduktion](evidence/corrections-retry-red.log) dokumentiert insbesondere lokale Turboauswahl versus gespeichertes Standardmodell und die umgekehrte Konstellation. Auch Hybridnamen mit `turbo` folgen derselben Regel. „＋“ nutzt denselben bestehenden Generierungs-/CPU-Guard wie Formular und Retry. Tests prüfen unveränderte Originalparameter und dass ein GPU-Auftrag mit normalisierten 100 Schritten keinen falschen CPU-Dialog erhält.

Die Bibliothek bevorzugt lokal ermittelte `effective_inference_steps`. Ihr angeforderter Fallback akzeptiert ausschließlich positive Integer, begrenzt auf 100, beziehungsweise automatische Werte bei bekanntem Modell. Beschädigte Werte wie `"80"`, negative Zahlen, Brüche, Objekte oder Arrays erzeugen keine erfundene effektive Schrittzahl. Für automatische Altsongs ohne bestimmbares Modell bleibt die IT-Angabe leer.

## Gemessene Dauer und Hinweise

Die Oberfläche zeigt Audiodauer nur mit `duration_source: "wav"`. Eine LM-Vorhersage, ein angeforderter Sollwert oder unmessbares historisches Audio gelten nicht als Messbeleg. Frontendtests prüfen ausdrücklich, dass etwa ein alter unbestätigter 85-Sekunden-Metadatenwert ausgeblendet bleibt. Rusttests messen WAV-Header, projizieren tatsächliche Dauer auf vorhandene Songs und erhalten gespeicherte Requests, ursprüngliche Metadaten und Audio unverändert.

Bibliothek und Player verwenden denselben bisherigen Floor-Clock. Öffentliche Studio-UI-Tests prüfen **5,6 Sekunden → `0:05`** und **29,8 Sekunden → `0:29`**, sowohl beim Laden als auch nach Playback-Ende. Exakte WAV-Messwerte werden hierfür nicht gerundet oder umgeschrieben. WaveSurfer ist in diesen automatisierten Tests simuliert; dies ersetzt keinen nativen Wiedergabenachweis.

Nur das Backend bestimmt erhebliche Abweichungen. Ein gültiges `duration_warning`-Objekt führt zu einem knappen Inline-Hinweis, zum Beispiel „Kürzer als angefordert: 0:22 statt 0:30.“ oder dem entsprechenden Hinweis bei Überlänge. Keine Modals und keine zweite Frontendschwelle. Die Oberfläche prüft bekannte Codes, positive Zahlen und Übereinstimmung mit der gemessenen tatsächlichen Dauer. 29,8 statt 30 Sekunden ohne erheblichen Backendhinweis bleibt ohne Warnung. Beide Hinweistexte sind in allen **zwölf** registrierten Sprachen geprüft.

## Statische Portabilitätsprüfung der neuen Rusttests

Die PR-Matrix enthält macOS arm64, macOS Intel, Windows x64 und Linux Vulkan. Die zusätzliche Linux-CUDA-Ausgabe ist ein eigener Release-Job. Die Prüfung hier war statisch; sie bescheinigt keine Ausführung dieser Korrekturen auf Windows, Intel oder Linux.

- WAV-/Iterations-/historische Projektionstests verwenden portable Rust-APIs, temporäre Dateien und explizite Little-Endian-Fixtures. Die HTTP-Vertragstests binden nur einen freien lokalen IPv4-Port und benötigen keine Modelle, Audiogeräte, GPU oder externen Dienste.
- `synthesis_probe_macos.rs` ist als vollständige Datei mit `cfg(target_os = "macos")` begrenzt. Sein C-/Dylib-/Metal-Fixture wird auf Windows und Linux nicht gebaut. Der Intelpfad erwartet CPU; ein fehlendes natives Metal-Gerät auf arm64 darf „unknown“ bleiben. Die Metal-Produktimplementierung ist ebenfalls nur unter macOS kompiliert.
- **Ein konkretes Windows-Testproblem wurde gefunden und auf ausdrücklichen Auftrag testseitig korrigiert:** Der Mtime-Cachetest öffnete seine Fixture nur lesend und rief anschließend `set_times` auf. Windows verlangt dafür `FILE_WRITE_ATTRIBUTES`; Rust verwendet den vorhandenen Handle für `SetFileTime`. Die Fixture wird jetzt mit `OpenOptions` lesend und schreibend geöffnet. Anschließend bestanden alle vier `audio_facts`-Tests erneut sowie Rustfmt. Der Fix ändert keinen Anwendungscode und erfordert keinen neuen nativen Appbuild. [Microsoft-API-Vertrag](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfiletime), [Rust-Windowsimplementierung](https://github.com/rust-lang/rust/blob/main/library/std/src/sys/fs/windows.rs).

Nach diesem Fix wurde kein weiterer konkreter plattformspezifischer Blocker in den neuen Testquellen gefunden. Die bewusst engen lokalen Timeout-/Kaltstarttests bleiben erst durch die tatsächlichen vier CI-Jobs auf den jeweiligen Runnern bestätigt. Die abschließende vollständige 193er Rust-Suite enthält sowohl den Windows-Fixture-Fix als auch den zusätzlichen Policy-Test für echte Legacy-Defaults. Rustfmt wurde nach einer reinen Zeilenumbruchkorrektur am neuen Policyfeld nochmals erfolgreich geprüft.

## Grenzen dieser Abnahme

Die hier dokumentierten Tests sind automatisierte Quell-/Paketvertragstests. Aktuelle native Screenshots, tatsächliche 0.1.2-Generierung, Datei-/Audioprüfung und Paketnachweise werden im [Hauptbericht](README.md) separat ergänzt. Die früheren Berichte zu Warnung und Header bleiben historische Zwischenstände mit ihren damaligen Testzahlen. Neue CI-Ergebnisse dürfen nur für die dazugehörige Revision ergänzt werden.
