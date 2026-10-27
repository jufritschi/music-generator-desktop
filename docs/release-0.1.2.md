# Music Generator 0.1.2 — überarbeiteter Prerelease

## Korrektur des ersten 0.1.2-Builds

Der ursprüngliche 0.1.2-Prerelease begrenzte die Auswahl auf 100 Schritte, um die bisherige interne Engine-Grenze korrekt abzubilden. Dieser überarbeitete Build stellt den gewünschten Bereich **1–200** wieder her und erweitert auch die tatsächliche Synthese auf 200 Schritte. Vorherige 120er Anfragen, die die alte Engine auf 100 begrenzt hatte, bleiben als historische 100-Schritt-Ergebnisse erkennbar. Bereits gültige 100er Formularwerte werden nicht automatisch auf 200 erhöht.

Die neuen Pakete und Release-Prüfsummen müssen vollständig erneut geprüft werden. Der erste veröffentlichte Stand wird einschließlich Quelle und Originalpaketen nachvollziehbar archiviert; der überarbeitete Stand trägt weiterhin Version 0.1.2.

## Änderungen seit 0.1.1

- Tatsächliche WAV-Dauer in der Bibliothek und Ergebnis-Metadaten statt ungeprüfter Dauerangaben des Sprachmodells. Auch vorhandene WAVs werden beim Lesen korrekt eingeordnet; die ursprünglichen Auftragsparameter bleiben erhalten.
- Ein begrenzter zusätzlicher Sprachmodellversuch kann deutlich zu kurze Audiocodes vor der Synthese verbessern. Bleibt eine erhebliche Dauerabweichung bestehen, wird sie am fertigen Song mit Soll- und Ist-Dauer sichtbar. Es werden keine Stille oder Audioschleifen angehängt.
- Iterationen passen zum erweiterten Enginebereich von 1–200. Gültige gespeicherte Formularwerte bleiben erhalten; neue Aufträge, Varianten und Wiederholungen verwenden denselben wirksamen Bereich. Historische Vorgaben bleiben als ursprüngliche Anfragen nachvollziehbar.
- Kompakte Backendanzeige neben Sprache und Einstellungen. Auf unterstützten Macs ist Metal bereits vor der ersten Generierung sichtbar. Verfügbarkeit, tatsächlich bestätigte Synthese und die getrennte Sprachmodellwahl bleiben unterscheidbar.
- Keine falsche CPU-/Unbekannt-Warnung auf Apple Silicon durch einen abgebrochenen Metal-Shader-Kaltstart. Bestätigte CPU-Ausweichlösungen erhalten weiterhin die passenden Hinweise. Einstellungen für hohe CPU-Iterationen lassen sich merken und später ändern.
- Gerätewahl wird sofort gespeichert; Generierungsaktionen sind während noch laufender Einstellungsspeicherung geschützt. Modellverwaltung und Einrichtungsassistent sind klar bezeichnet.
- Native Exportdialoge teilen ein dauerhaft gespeichertes Ziel für WAV/MP3, TXT und ZIP. Modell-, Song- und Importordner behalten ihre jeweils passenden Dialogpfade; manuell eingegebene Pfade werden geprüft.
- Der automatisch eingesetzte Prompt ist vor der Auftragsannahme sichtbar und bleibt bearbeitbar.
- Ein direkter Start vom schreibgeschützten macOS-DMG zeigt eine Installationsanleitung. Importtexte berücksichtigen die jeweilige Plattform und nötige Ordnerfreigaben.

## Downloads und Installation

Der überarbeitete Stand liefert erneut die vier geprüften Plattformziele: ZIP und DMG für macOS Apple Silicon und Intel, ein portables Windows-x64-ZIP und das Linux-AppImage für Vulkan/CPU. Eine separate Linux-CUDA-Ausgabe gehört nicht zu diesem Prerelease. Zu jedem Paket gehört eine SHA-256-Datei. Modelle und Songs bleiben außerhalb des App-Bundles; ein Update tauscht das Bundle aus.

Wer den ersten 0.1.2-Build bereits installiert hat, muss das neue Paket nochmals herunterladen und die App ersetzen. Die Versionsnummer bleibt 0.1.2; die Release-Notizen und neuen Prüfsummen kennzeichnen den überarbeiteten Build.

Vor einem Update die App schließen und Bibliotheksdatenbank sowie separat gewählte Songordner sichern. Auf macOS die App aus dem DMG kopieren, das Image auswerfen und die kopierte App starten. Intel-Macs verwenden das separate x64-Paket und rechnen ausschließlich auf der CPU.

## Bekannte Grenzen

- Experimenteller Prerelease; die Pakete sind nicht mit einer macOS Developer ID notarisiert. Betriebssystem-Warnungen sind möglich.
- Die gewünschte Songlänge ist eine Modellvorgabe. Ein begrenzter Nachversuch und eine ehrliche Ist-Anzeige ersetzen keine Garantie, dass jedes Modell exakt die gewünschte Musiklänge erzeugt. Erhebliche Abweichungen werden sichtbar gemeldet.
- Intel-CPU-Inferenz, vollständige Windows-GUI-/Audiodauerabnahme, Pascal-/GTX-1060-Treiber, reale Linux-CUDA-Inferenz und Mindestversionen der Betriebssysteme benötigen weitere Hardwareabnahme.
- Physisches Mikrofon, tatsächliche Screenreader-Bedienung und lange Songs auf Intel-/8-GiB-Systemen sind nicht vollständig abgenommen.

## Freigabestand

Der erste 0.1.2-Stand ist bereits veröffentlicht. Die Korrektur auf tatsächlich 200 Schritte benötigt einen neuen erfolgreichen Vierplattformlauf, eine erneute native M5-Abnahme und neue Paketprüfungen. Erst danach werden Tag, Pakete und Release-Notizen zusammen auf den überarbeiteten Stand gebracht. Der ursprüngliche Stand bleibt nachvollziehbar.

Die [Abnahme mit Screenshots](qa/prerelease-0.1.2/README.md) trennt den ursprünglich heruntergeladenen Stand, die späteren Korrekturen, native Generierungsversuche und automatisierte Plattformprüfungen. Testergebnisse und konkrete Testbuild-Links werden mit dem finalen Kandidaten festgehalten.
