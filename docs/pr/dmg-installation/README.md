# Installationshinweis beim DMG-Start — Issue #22

Die Screenshots zeigen eine tatsächlich paketierte Debug-App unter macOS, ad-hoc mit den unveränderten App-Sandbox-Entitlements signiert. Die separate Bundle-ID `de.alphatester.music-generator.dmg-test` isoliert App-Daten und WebKit-Speicher von der normalen Installation. Es wurden keine Modelle heruntergeladen und keine Songs erzeugt.

- `dmg-installation-de.png`: Start direkt aus dem schreibgeschützten DMG, unter einem benutzerdefinierten Mountpunkt in `/private/tmp/`. Der deutsche Installationshinweis blieb auch nach 15 Sekunden bestehen; Beenden schloss die App. Vor dem ersten Beenden existierte der isolierte App-Datenordner noch nicht.
- `copied-start-de.png`: Dieselbe App wurde in einen regulären Benutzerordner kopiert. Nach dem Auswerfen des DMG erreichte sie ohne Installationshinweis den Einrichtungsassistenten.

Die signierte App prüfte außerdem ihren tatsächlichen Startort über `--startup-location-probe`: im DMG `installation_required: true`, nach Kopieren und Auswerfen `false`, in einer temporären Kopie unter `/Applications` `false` und auf einem beschreibbaren Test-Image unter `/Volumes` `false`. Testkopie und Mounts wurden danach entfernt. Dieser lesende Probeaufruf öffnet weder Fenster noch Benutzerdaten und wird nun auch bei den macOS-Paketprüfungen für DMG und kopierte App ausgeführt.

Ein physisches externes Laufwerk war nicht angeschlossen. Das beschreibbare Image überprüft den nativen `/Volumes`-Fall, ersetzt aber keinen Hardwaretest. Reguläre externe Volumes einschließlich Schreibschutz sowie App Translocation sind zusätzlich durch Tests der Mount-Zuordnung abgedeckt. Ein tatsächlicher Gatekeeper-Translocation-Start und die Mindestversionen von macOS wurden lokal nicht geprüft; die CI prüft die paketierten ARM- und Intel-Apps auf ihren jeweiligen Runnern.
