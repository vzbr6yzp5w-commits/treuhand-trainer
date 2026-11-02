# Treuhand Trainer

Desktop-Lern-App für die Treuhänder-Berufsprüfung 2027 (Electron).

- **Heute**: Lernplan des Tages, Countdown, Stand pro Fach (700 UWB, 701 Rechnungswesen, 702 Steuern, 703 Revision)
- **Karteikarten**: Spaced Repetition (Nochmal / Schwer / Gut / Einfach), Fokusfach laut Lernplan zuerst
- **Prüfung**: Aufgaben pro Fach mit Zeitbudget (2 Min. pro Punkt), Rechnen, Multiple Choice, Freitext mit Selbstbewertung, Ziel ca. 68 % für Note 5.0
- **Fehlerheft**: Fehler nach Muster (Begründung fehlt, Vorzeichen, Gesetzesartikel …)
- **Daten**: eigene Karten per CSV (`Fach;Thema;Frage;Antwort`), Backup des Fortschritts

## Starten
```
npm install
npm start
```
Tests: `npm test`. Installer bauen: `npm run dist`.

## Anpassen
- Lernplan und Prüfungsdaten: `src/logic.js` (`PLAN`, `PRUEFUNG`)
- Karten und Aufgaben: `data/cards.json`, `data/exams.json` (danach `npm run build-data`)

## Wichtig
Die mitgelieferten Karten und Aufgaben sind Beispiele und ein Startpunkt. Inhalte vor dem Lernen mit dem eigenen Skript und den aktuellen Gesetzen abgleichen (Beträge, Sätze und Fristen ändern sich).
