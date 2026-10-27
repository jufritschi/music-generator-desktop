# Header: kompaktes Rechenbackend neben der Sprache

Der Studioheader enthält nun Sprache, einen readonly Backendchip und das Zahnrad in einer gemeinsamen Zeile. Der Chip zeigt beispielsweise „Rechenbackend Metal“. Es gibt kein Dropdown, keine eigene Statuszeile und keine Live-Ansagen des Chips bei Health-Polls. Die vorhandene Offline-Ansage ändert ihren Text nur bei tatsächlichen Zustandsänderungen.

Die bestehende GenerationPolicy liefert `detected_backend`, die gewählte `lm_device`-Option und den exakt gleichen `backend_status`-Snapshot wie die Backendentscheidung. Vor Inferenz zeigt der Chip die geprüfte konkrete Art als „Erkannt und verfügbar“. Aktuelle bestätigte Synthese kann davon abweichen und wird als „In der Engine bestätigt“ ausgewiesen. Nach Stop bleibt nur die geprüfte Verfügbarkeit; alte Geräte-/Inferenzbeobachtungen verschwinden. Tooltip und ARIA nennen Sprachmodellwahl (Automatisch/Nur CPU) und gegebenenfalls die getrennte tatsächliche Ausführung. Sichtbar stehen ausschließlich knappes Label und Backendname.

Alle Angaben sind in zwölf Sprachen vorhanden. Der ausführliche Setup-Ergebnisbereich bleibt erhalten. Vorhandene Policy-, Settings-/ModelPicker-Ereignisse und Health-Aufrufe werden wiederverwendet; es gibt keine zusätzlichen IPCs, Engine-Starts oder Timer.

Test-first reproduziert und korrigiert:

- Das frühere Studio-Dropdown statt eines readonly Inline-Chips.
- Laufende bestätigte CPU-Synthese wurde bei neuer Policy fälschlich durch verfügbare Metal-Hardware ersetzt.
- Laufende bestätigte Metal-Synthese ging bei unbekannter unabhängiger Probe verloren.
- Die gewählte automatische LM-Option wurde durch gespeicherten Split-/Fallback-Modus als „Nur CPU“ angezeigt.

Abschließende Prüfung:

- **78/78 gezielte Tests** in Backendstatus/-Übersetzungen, Studio/Settings, GenerationPolicy und Setup-Ergebnis bestanden.
- **296/296 Frontendtests** in 35 Dateien bestanden.
- TypeScript/Vite-Produktionsbuild und ESLint bestanden.
- Unabhängiger finaler Headerreview ohne offenes konkretes Finding; CSS bei 480 px statisch passend. Tatsächliche native Sichtprüfung bei 1280 px und 480 px erfolgt durch den Hauptagenten.

Relevante neue Datei: `frontend/backend-chip-i18n.ts` (neu/untracked bis zum Staging durch den Hauptagenten). Weitere Änderungen liegen in Backendstatus/GenerationPolicy/Studio/HTML/CSS/Typen und vorhandenen Tests. Kein Versionsbump und keine GUI-/Benutzerdatenänderung durch diesen Teilagenten.

Logs: `backend-chip-red.log`, `backend-chip-observation-red.log`, `backend-chip-focused.log`, `backend-chip-frontend.log`, `backend-chip-build.log`, `backend-chip-lint.log`.
