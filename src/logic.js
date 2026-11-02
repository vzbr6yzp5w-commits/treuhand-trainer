// Reine Logik (ohne DOM), auch in Node testbar.
(function (root) {
  var FAECHER = {
    '700': 'UWB',
    '701': 'Rechnungswesen',
    '702': 'Steuern',
    '703': 'Revision'
  };

  // Prüfungsdaten (anpassbar)
  var PRUEFUNG = {
    schriftlich: '2027-08-25',
    muendlich: '2027-10-04'
  };

  // Lernplan: Wochentag (0=So..6=Sa) -> Fokusfach. Rechnungswesen hat die grösste Hebelwirkung.
  var PLAN = {
    1: { fach: '701', titel: 'Rechnungswesen: Geldfluss, Investition, Teilkosten, BAB' },
    2: { fach: '702', titel: 'Steuern: Vorsorge, Beteiligungsabzug, geldwerte Leistungen, MWST' },
    3: { fach: '701', titel: 'Rechnungswesen: Kontieren, Abschluss, Reserven nach OR' },
    4: { fach: '703', titel: 'Revision: Sanierung, Revisionsbericht, Rechtsformen' },
    5: { fach: '701', titel: 'Rechnungswesen: Aufgaben unter Zeitdruck' },
    6: { fach: '700', titel: 'UWB: Breitenrunde (Wegleitung), Finanzierung, Recht' },
    0: { fach: 'ALLE', titel: 'Wiederholung gemischt: alle Fächer, Fehlerheft' }
  };

  function todayISO(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function addDays(iso, n) {
    var p = iso.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + n);
    return todayISO(d);
  }

  function daysBetween(aIso, bIso) {
    var a = aIso.split('-'), b = bIso.split('-');
    var da = Date.UTC(+a[0], +a[1] - 1, +a[2]);
    var db = Date.UTC(+b[0], +b[1] - 1, +b[2]);
    return Math.round((db - da) / 86400000);
  }

  function planFor(iso) {
    var p = iso.split('-');
    var wd = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay();
    return PLAN[wd];
  }

  function newState() {
    return { ease: 2.5, interval: 0, reps: 0, due: null, lapses: 0 };
  }

  // rating: 0 nochmal, 1 schwer, 2 gut, 3 einfach
  function review(state, rating, today) {
    var s = Object.assign(newState(), state || {});
    if (rating === 0) {
      s.reps = 0;
      s.lapses += 1;
      s.interval = 0;
      s.ease = Math.max(1.3, s.ease - 0.2);
      s.due = today;
    } else {
      if (rating === 1) {
        s.interval = Math.max(1, Math.round(s.interval * 1.2));
        s.ease = Math.max(1.3, s.ease - 0.15);
      } else if (rating === 2) {
        s.interval = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(s.interval * s.ease);
      } else {
        s.interval = s.reps === 0 ? 3 : Math.max(4, Math.round(s.interval * s.ease * 1.3));
        s.ease += 0.15;
      }
      s.reps += 1;
      s.due = addDays(today, s.interval);
    }
    return s;
  }

  function isDue(state, today) {
    return !state || !state.due || state.due <= today;
  }

  // Fällige Karten, Fokusfach zuerst, neue Karten limitiert
  function buildQueue(cards, states, today, focusFach, newLimit) {
    var due = [], fresh = [];
    cards.forEach(function (c) {
      var st = states[c.id];
      if (!st || !st.due) fresh.push(c);
      else if (st.due <= today) due.push(c);
    });
    due.sort(function (a, b) { return states[a.id].due < states[b.id].due ? -1 : 1; });
    function pri(c) { return focusFach && focusFach !== 'ALLE' && c.fach === focusFach ? 0 : 1; }
    due.sort(function (a, b) { return pri(a) - pri(b); });
    fresh.sort(function (a, b) { return pri(a) - pri(b); });
    return due.concat(fresh.slice(0, newLimit === undefined ? 10 : newLimit));
  }

  // Kaufmännische Rundung auf n Stellen
  function round(x, n) {
    var f = Math.pow(10, n || 0);
    return Math.sign(x) * Math.round(Math.abs(x) * f + 1e-9) / f;
  }

  function checkNumber(input, expected, tol) {
    var s = String(input).replace(/[’'\s]/g, '').replace(',', '.');
    var v = parseFloat(s);
    if (isNaN(v)) return false;
    return Math.abs(v - expected) <= (tol === undefined ? 0.5 : tol);
  }

  // 5.0 liegt in den Notenskalen bei ca. 68 % der Maximalpunktzahl.
  function zielErreicht(punkte, max) {
    return max > 0 && punkte / max >= 0.68;
  }

  // Zeitbudget: Minuten pro Punkt (Teil1 UWB: 90 min / 45 P = 2.0)
  function minutenFuer(punkte, minProPunkt) {
    return Math.round(punkte * (minProPunkt || 2));
  }

  // CSV: Fach;Thema;Frage;Antwort  (Fach = 700/701/702/703)
  function parseCSV(text, startId) {
    var out = [];
    var n = startId || 0;
    text.split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var parts = line.split(';');
      if (parts.length < 4) return;
      var fach = parts[0].trim();
      if (!FAECHER[fach]) return;
      n += 1;
      out.push({
        id: 'imp-' + Date.now() + '-' + n,
        fach: fach,
        thema: parts[1].trim(),
        frage: parts[2].trim(),
        antwort: parts.slice(3).join(';').trim()
      });
    });
    return out;
  }

  var api = {
    FAECHER: FAECHER, PRUEFUNG: PRUEFUNG, PLAN: PLAN,
    todayISO: todayISO, addDays: addDays, daysBetween: daysBetween, planFor: planFor,
    newState: newState, review: review, isDue: isDue, buildQueue: buildQueue,
    round: round, checkNumber: checkNumber, zielErreicht: zielErreicht,
    minutenFuer: minutenFuer, parseCSV: parseCSV
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : this);
