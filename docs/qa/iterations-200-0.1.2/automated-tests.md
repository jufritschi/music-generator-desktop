# Wiederherstellung von 1–200 Iterationen

Basis: lokaler Zweig `codex/iterations-200-0.1.2`; Datum: 27. Oktober 2026. Dieser Teilagent hat keine laufende Benutzerinstallation, Benutzerpräferenzen oder Bibliotheksdateien verändert.

- Frontend-/Backend-Anfragen und neue Formularwerte erlauben wieder1–200. 120/200 bleiben erhalten;201 wird im Formular-/Samplingvertrag auf200 begrenzt, direkte neue DB-Anfragen über200 werden abgewiesen.
- Bereits gespeicherte100er Präferenzen bleiben100. Standard-/Turbo-Legacydefaults50/8 sowie CPU-Warnungen bleiben erhalten. Neue Varianten und Wiederholungen verwenden den aktualisierten Bereich; alte Songparameter bleiben unverändert.
- Für abgeschlossene/unbekannte Historie gilt weiterhin der frühere100er Cap, solange kein tatsächlicher neuer Runtimebeleg vorliegt. Alte raw120→100 und bereits verifizierte100→100 bleiben wahr. Offene queued/running/error Requests zeigen ihre geplanten200 statt eines fälschlichen historischen100er Caps.
- Tatsächliche neue200 werden nur aus dem Synthese-JSON-Part übernommen: `inference_steps_limit:200` und ein gültiges `effective_inference_steps` aus dem realen SynthState. Gleichnamige User-/LM-Felder werden vor dem Syntheseaufruf entfernt. Alte Antworten ohne solchen Beleg werden höchstens als100 interpretiert. Ein unvollständiger neuer Beleg wird nicht als verifiziertes fertiges Ergebnis gespeichert.
- `engine/response.rs` verarbeitet Synthese-Multipart mit JSON-Array und WAV in einem Durchlauf. Die bisherigen öffentlichen JSON-/Audio-Parser bleiben kompatibel; die lange Audiodatei wird nicht für zwei getrennte Multipart-Parses erneut eingelesen/kopiert.

## Tatsächlich ausgeführte Prüfungen

- Frontend: **348 bestanden**,0 Fehler;37 Dateien.
- Vollständige Rust-Suite: **197 bestanden**,0 Fehler,1 absichtlich ignorierte Subprozess-Fixture.
- Gezielt Rust:12 Engine-/Duration-Verträge,5 Iterations-/Queue-Verträge,2 historische Projektionen und7 Formularpräferenztests bestanden.
- TypeScript/Vite-Build, ESLint, Rustfmt und Clippy für alle Targets mit Warnungen als Fehler bestanden.
- `git diff --check` bestanden.
- Test-first:13 Frontend- und4 Rustfälle zunächst rot; zusätzlich3 öffentliche UI-Statusfälle und ein echter Synthese-Belegvertrag rot reproduziert und korrigiert.
- Unabhängiger Schlussreview durch `warning_fix_review` ohne konkreten Blocker.

Die HTTP- und Playerfixtures der Quelltests sind simuliert. Tatsächliche C++-Core-/CLI-200-Prüfung erfolgt separat beim Engineagenten; native M5-Generierung und Paket-/Vierplattform-CI koordiniert der Hauptagent. Für diese Prüfungen wird hier kein Ergebnis vorweggenommen.

Die vollständigen Logs liegen im zugehörigen [evidence-Ordner](evidence/).
