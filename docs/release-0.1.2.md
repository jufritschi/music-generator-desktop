# Music Generator 0.1.2 — Prerelease

## Änderungen seit 0.1.1

- Tatsächliche WAV-Dauer in der Bibliothek und Ergebnis-Metadaten statt ungeprüfter Dauerangaben des Sprachmodells. Auch vorhandene WAVs werden beim Lesen korrekt eingeordnet; die ursprünglichen Auftragsparameter bleiben erhalten.
- Ein begrenzter zusätzlicher Sprachmodellversuch kann deutlich zu kurze Audiocodes vor der Synthese verbessern. Bleibt eine erhebliche Dauerabweichung bestehen, wird sie am fertigen Song mit Soll- und Ist-Dauer sichtbar. Es werden keine Stille oder Audioschleifen angehängt.
- Iterationen passen zum unterstützten Enginebereich von 1–100. Gespeicherte höhere Formularwerte werden angepasst; neue Aufträge, Varianten und Wiederholungen verwenden denselben wirksamen Bereich. Historische Vorgaben bleiben als ursprüngliche Anfragen nachvollziehbar.
- Kompakte Backendanzeige neben Sprache und Einstellungen. Auf unterstützten Macs ist Metal bereits vor der ersten Generierung sichtbar. Verfügbarkeit, tatsächlich bestätigte Synthese und die getrennte Sprachmodellwahl bleiben unterscheidbar.
- Keine falsche CPU-/Unbekannt-Warnung auf Apple Silicon durch einen abgebrochenen Metal-Shader-Kaltstart. Bestätigte CPU-Ausweichlösungen erhalten weiterhin die passenden Hinweise. Einstellungen für hohe CPU-Iterationen lassen sich merken und später ändern.
- Gerätewahl wird sofort gespeichert; Generierungsaktionen sind während noch laufender Einstellungsspeicherung geschützt. Modellverwaltung und Einrichtungsassistent sind klar bezeichnet.
- Native Exportdialoge teilen ein dauerhaft gespeichertes Ziel für WAV/MP3, TXT und ZIP. Modell-, Song- und Importordner behalten ihre jeweils passenden Dialogpfade; manuell eingegebene Pfade werden geprüft.
- Der automatisch eingesetzte Prompt ist vor der Auftragsannahme sichtbar und bleibt bearbeitbar.
- Ein direkter Start vom schreibgeschützten macOS-DMG zeigt eine Installationsanleitung. Importtexte berücksichtigen die jeweilige Plattform und nötige Ordnerfreigaben.

## Downloads und Installation

Geplant sind ZIP und DMG für macOS Apple Silicon und Intel, ein portables Windows-x64-ZIP sowie Linux-AppImages für Vulkan/CPU und separat CUDA. Zu jedem Paket gehört eine SHA-256-Datei. Modelle und Songs bleiben außerhalb des App-Bundles; ein Update tauscht das Bundle aus.

Vor einem Update die App schließen und Bibliotheksdatenbank sowie separat gewählte Songordner sichern. Auf macOS die App aus dem DMG kopieren, das Image auswerfen und die kopierte App starten. Intel-Macs verwenden das separate x64-Paket und rechnen ausschließlich auf der CPU.

## Bekannte Grenzen

- Experimenteller Prerelease; die Pakete sind nicht mit einer macOS Developer ID notarisiert. Betriebssystem-Warnungen sind möglich.
- Die gewünschte Songlänge ist eine Modellvorgabe. Ein begrenzter Nachversuch und eine ehrliche Ist-Anzeige ersetzen keine Garantie, dass jedes Modell exakt die gewünschte Musiklänge erzeugt. Erhebliche Abweichungen werden sichtbar gemeldet.
- Intel-CPU-Inferenz, vollständige Windows-GUI-/Audiodauerabnahme, Pascal-/GTX-1060-Treiber, reale Linux-CUDA-Inferenz und Mindestversionen der Betriebssysteme benötigen weitere Hardwareabnahme.
- Physisches Mikrofon, tatsächliche Screenreader-Bedienung und lange Songs auf Intel-/8-GiB-Systemen sind nicht vollständig abgenommen.

## Freigabestand

Version 0.1.2 ist in npm, Cargo und Tauri einschließlich Lockfiles vorbereitet. Lokale Tests, echte Standard-/XL-Inferenz auf dem M5 und ZIP-/DMG-Paketprüfungen sind dokumentiert. Vier native CI-Plattformbuilds müssen für den endgültigen PR-Head erfolgreich sein; deren Pakete werden am Pull Request verlinkt. Es wurden kein Release-Tag und keine öffentlichen Release-Assets angelegt.

Die [Abnahme mit Screenshots](qa/prerelease-0.1.2/README.md) trennt den ursprünglich heruntergeladenen Stand, die späteren Korrekturen, native Generierungsversuche und automatisierte Plattformprüfungen. Testergebnisse und konkrete Testbuild-Links werden mit dem finalen Kandidaten festgehalten.
