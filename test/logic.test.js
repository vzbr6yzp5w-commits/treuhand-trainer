const assert = require('assert');
const L = require('../src/logic.js');
const cards = require('../data/cards.json');
const exams = require('../data/exams.json');

// Datum
assert.strictEqual(L.addDays('2026-11-02', 30), '2026-12-02');
assert.strictEqual(L.daysBetween('2026-11-02', '2027-08-25'), 296);
assert.strictEqual(L.planFor('2026-11-02').fach, '701'); // Montag
assert.strictEqual(L.planFor('2026-11-03').fach, '702'); // Dienstag
assert.strictEqual(L.planFor('2026-11-08').fach, 'ALLE'); // Sonntag

// Spaced Repetition
let s = L.review(null, 2, '2026-11-02');
assert.strictEqual(s.interval, 1); assert.strictEqual(s.due, '2026-11-03');
s = L.review(s, 2, '2026-11-03'); assert.strictEqual(s.interval, 3);
s = L.review(s, 2, '2026-11-06'); assert.strictEqual(s.interval, Math.round(3 * s.ease) || s.interval);
s = L.review(s, 0, '2026-11-20'); assert.strictEqual(s.due, '2026-11-20'); assert.strictEqual(s.reps, 0);

// Queue: fällige zuerst, Fokusfach vor anderen, Neue limitiert
const states = { 'rw-001': { ease: 2.5, interval: 1, reps: 1, due: '2026-11-01' }, 'st-001': { ease: 2.5, interval: 1, reps: 1, due: '2026-11-01' } };
const q = L.buildQueue(cards, states, '2026-11-02', '702', 5);
assert.strictEqual(q[0].id, 'st-001');
assert.strictEqual(q.length, 2 + 5);

// Rundung / Zahlenprüfung
assert.strictEqual(L.round(2.5, 0), 3); assert.strictEqual(L.round(-2.5, 0), -3); assert.strictEqual(L.round(1.005, 2), 1.01);
assert(L.checkNumber("3'158", 3158, 0.5)); assert(L.checkNumber('3158,0', 3158, 0.5)); assert(!L.checkNumber('abc', 1));
assert(L.zielErreicht(34, 50)); assert(!L.zielErreicht(30, 50));
assert.strictEqual(L.minutenFuer(45), 90);

// CSV
const imp = L.parseCSV('702;MWST;Satz?;8.1 %\n999;x;y;z\n701;A;B;C;D');
assert.strictEqual(imp.length, 2); assert.strictEqual(imp[1].antwort, 'C;D');

// Datenintegrität
const ids = new Set();
cards.forEach(c => { assert(L.FAECHER[c.fach], c.id); assert(!ids.has(c.id), 'doppelt ' + c.id); ids.add(c.id); assert(c.frage && c.antwort); });
exams.forEach(e => {
  assert(L.FAECHER[e.fach], e.id); assert(e.punkte > 0 && e.loesung);
  if (e.typ === 'mc') assert(e.richtig >= 0 && e.richtig < e.optionen.length, e.id);
  if (e.typ === 'calc') assert(typeof e.antwort === 'number', e.id);
});
['700', '701', '702', '703'].forEach(f => assert(exams.some(e => e.fach === f) && cards.some(c => c.fach === f), f));

// Rechenaufgaben nachrechnen
const e = id => exams.find(x => x.id === id);
assert.strictEqual(Math.ceil(600000 / 190), e('e701-1').antwort);
assert.strictEqual(Math.ceil(620000 / 190), e('e701-2').antwort);
const rbf = (1 - Math.pow(1.06, -5)) / 0.06;
assert(Math.abs(Math.round(30000 * rbf - 100000) - e('e701-3').antwort) <= 2);
assert.strictEqual(L.round(500000 * (1 - 70000 / 500000) * 0.085, 0), e('e702-1').antwort);
assert.strictEqual(500000 * 0.081 - 12000, e('e702-2').antwort);
assert.strictEqual(200000 + 20000 - 130000, e('e703-1').antwort);
assert.strictEqual((700000 + 2 * 1000000) / 3, e('e700-1').antwort);

console.log('Alle Tests bestanden (' + cards.length + ' Karten, ' + exams.length + ' Prüfungsaufgaben).');
