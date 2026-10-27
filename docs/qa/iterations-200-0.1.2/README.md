# Tatsächlich 200 Iterationen — Nachtrag zu 0.1.2

Der Benutzer hat die Rückkehr des maximalen Iterationswerts auf 200 ausdrücklich angefordert. Der erste 0.1.2-Build hatte Oberfläche und neue Aufträge auf die damalige interne Engine-Grenze von 100 abgestimmt. Dieser Nachtrag dokumentiert die neue Korrektur; die [erste Abnahme](../prerelease-0.1.2/README.md) bleibt als historischer Beleg bestehen.

## Zielverhalten

- Formular, Varianten und Wiederholungen unterstützen 1–200; die Engine führt angeforderte 200 Schritte tatsächlich aus.
- Standard-/Turbo-Defaults sowie CPU-Hinweise bleiben bestehen. Bestehende gültige Präferenzen werden nicht verändert.
- Neue wartende und laufende 200er Aufträge zeigen 200. Fertige neue Ergebnisse weisen die tatsächliche Ausführung und die unterstützte Enginegrenze nach.
- Historische 120er Anfragen aus der alten 100er Engine bleiben als tatsächliche 100er Ergebnisse erkennbar. Originalparameter und gespeicherte Audiofakten werden nicht umgeschrieben.
- Geänderte Buildrezepte invalidieren alte Runtime-Caches. Alle vier Plattformpakete müssen ihren echten Produktionsvertrag ohne Modellgewichte prüfen.

## Verifikation

**576 lokale Tests bestanden:** 348 Frontend, 31 Desktopskripte und 197 Rust; eine absichtlich ignorierte Rust-Subprozess-Fixture. TypeScript/Vite, ESLint, Rustfmt und Clippy mit Warnungen als Fehler bestanden. [Automatisierter Bericht](automated-tests.md).

Die macOS-Engine wurde tatsächlich neu gebaut. Ihr Produktionsvertrag liefert 0→50, 120→120, 200→200 und 201→200; Titelruntime und Engineprovenienz sind verifiziert. Die Buildrezepte prüfen denselben Vertrag auch beim verlagerten Bundle.

## Native M5-Abnahme

Tatsächlicher optimierter Tauri-Release-Bundle aus seinem ZIP, App Sandbox aktiv, bestehende Q8-Modelle und vorhandenes Benutzerprofil. Der Regler erreicht per Tastatur-Ende 200; der Start wird ohne falschen CPU-Dialog auf Metal angenommen. Die ursprünglichen 13 Songdatensätze behalten Parameter, rohe Ergebnis-Metadaten, Datei, Status, Engine, Lyrics, Favorit und Ordner. Zwei neue QA-Aufträge bleiben erhalten.

| Tatsächliches Modell | Angefordert | Engine-Log | Verifizierte Ergebnis-Metadaten | Gemessene WAV-Dauer |
|---|---|---|---|---|
| Standard SFT Q8 + 4B Q8 | 10 s, 200 IT | `Step 200/200` | effektiv 200, Enginegrenze 200 | 6,80 s; erhebliche Modellabweichung korrekt sichtbar |
| XL SFT Q8 + 4B Q8 | 10 s, 200 IT | `Step 200/200` | effektiv 200, Enginegrenze 200 | 9,84 s; innerhalb der bestehenden Toleranz |

Nach vollständigem Beenden und Neustart bleibt der neu eingestellte Wert 200 erhalten; beide fertigen Ergebnisse zeigen weiter 200 IT, während alte 100er Ergebnisse unverändert bleiben. [Persistenz-Screenshot](screenshots/04-persisted200-after-restart.png).

Der Titel des zweiten Auftrags wurde unverändert aus dem ersten Formular übernommen; der gespeicherte Modellsnapshot belegt XL. Beide Aufträge wurden nativ in der laufenden App ausgeführt. Die gewünschte Audiolänge bleibt wie im ersten 0.1.2-Build eine Modellvorgabe und wird nicht durch Padding erzwungen.

[Aufträge und WAV-Fakten](evidence/native-evidence.json) · [Standard-Log](evidence/standard-200-engine.log) · [XL-Log](evidence/xl-200-engine.log). [Vorher: 100er-Grenze](screenshots/01-before-max100.png), [neuer maximaler Formularwert 200](screenshots/02-max200-form.png), [abgeschlossener und weiterer laufender 200er-Auftrag](screenshots/03-standard-completed200.png).

Die neuen Pakete bestehen lokal die [verlagerte ZIP-Prüfung](evidence/verify-zip.log) und [DMG-Prüfung](evidence/verify-dmg.log), einschließlich tatsächlicher Engine-Proben, Sandbox, Exporten, Signatur und DMG-Startschutz. Der neue Vierplattform-CI-Lauf muss insbesondere den Windows-Source-Rebuild und die nativen Importbibliotheken bestätigen. CI-Artefaktlinks werden am endgültigen PR ergänzt.

## Veröffentlichung

Der bestehende Prerelease ist technisch veränderbar, wurde aber bereits heruntergeladen. Sein ursprünglicher Tag, die zwölf Originaldateien mit Prüfsummen und seine Releasebeschreibung werden vor einem Austausch archiviert. Der korrigierte Stand wird ausdrücklich als überarbeiteter 0.1.2-Build mit neuem Quellcommit, neuem CI-Nachweis und neuen SHA-256-Dateien gekennzeichnet.
