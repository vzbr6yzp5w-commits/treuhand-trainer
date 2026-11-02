(function () {
  var L = window.Logic;
  var KEY = 'treuhand-trainer-v1';
  var main = document.getElementById('main');

  // ---------- Speicher ----------
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    s = s || {};
    s.states = s.states || {};
    s.extraCards = s.extraCards || [];
    s.extraExams = s.extraExams || [];
    s.results = s.results || [];
    s.errors = s.errors || [];
    s.reviews = s.reviews || {};
    return s;
  }
  var S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function allCards() { return (window.SEED_CARDS || []).concat(S.extraCards); }
  function allExams() { return (window.SEED_EXAMS || []).concat(S.extraExams); }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fachName(f) { return f + ' ' + (L.FAECHER[f] || f); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d; }
  function fachOptions(sel, withAll) {
    var h = withAll ? '<option value="ALLE">Alle Fächer</option>' : '';
    Object.keys(L.FAECHER).forEach(function (f) {
      h += '<option value="' + f + '"' + (f === sel ? ' selected' : '') + '>' + esc(fachName(f)) + '</option>';
    });
    return h;
  }

  // ---------- Navigation ----------
  var timerHandle = null;
  function show(view) {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    document.querySelectorAll('#nav button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === view);
    });
    ({ heute: viewHeute, karten: viewKarten, pruefung: viewPruefung, fehler: viewFehler, daten: viewDaten })[view]();
  }
  document.getElementById('nav').addEventListener('click', function (e) {
    if (e.target.dataset.view) show(e.target.dataset.view);
  });

  // ---------- Heute ----------
  function viewHeute() {
    var today = L.todayISO();
    var plan = L.planFor(today);
    var cards = allCards();
    var queue = L.buildQueue(cards, S.states, today, plan.fach, 10);
    var dueCount = cards.filter(function (c) { return S.states[c.id] && S.states[c.id].due && S.states[c.id].due <= today; }).length;
    var newCount = cards.filter(function (c) { return !S.states[c.id]; }).length;
    var tageSchr = L.daysBetween(today, L.PRUEFUNG.schriftlich);
    var tageMuend = L.daysBetween(today, L.PRUEFUNG.muendlich);
    var wochen = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

    var h = '<div class="card"><div class="grid">' +
      '<div><div class="muted">Tage bis schriftlich</div><div class="stat">' + tageSchr + '</div><div class="muted">' + L.PRUEFUNG.schriftlich + ' (Datum anpassbar in logic.js)</div></div>' +
      '<div><div class="muted">Tage bis mündlich</div><div class="stat">' + tageMuend + '</div></div>' +
      '<div><div class="muted">Karten fällig</div><div class="stat">' + dueCount + '</div></div>' +
      '<div><div class="muted">Neue Karten</div><div class="stat">' + newCount + '</div></div></div></div>';

    h += '<div class="card"><div class="muted">Lernplan heute</div><h2 style="margin:4px 0 8px">' + esc(plan.titel) + '</h2>' +
      '<div class="row"><button class="btn" id="goCards">Karteikarten starten (' + queue.length + ')</button>' +
      '<button class="btn sec" id="goExam">Prüfung im Fokusfach</button></div></div>';

    h += '<div class="card"><h3 style="margin-top:0">Wochenplan</h3><table>';
    [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
      h += '<tr><td><b>' + wochen[d] + '</b></td><td>' + esc(L.PLAN[d].titel) + '</td></tr>';
    });
    h += '</table></div>';

    h += '<div class="card"><h3 style="margin-top:0">Stand pro Fach</h3><table><tr><th>Fach</th><th>Karten gelernt</th><th>Prüfungen</th><th>Ø Ergebnis</th></tr>';
    Object.keys(L.FAECHER).forEach(function (f) {
      var fc = cards.filter(function (c) { return c.fach === f; });
      var learned = fc.filter(function (c) { return S.states[c.id] && S.states[c.id].reps >= 1; }).length;
      var rs = S.results.filter(function (r) { return r.fach === f; });
      var avg = rs.length ? Math.round(rs.reduce(function (a, r) { return a + r.punkte / r.max; }, 0) / rs.length * 100) + ' %' : '–';
      h += '<tr><td>' + esc(fachName(f)) + '</td><td>' + learned + ' / ' + fc.length + '</td><td>' + rs.length + '</td><td>' + avg + '</td></tr>';
    });
    h += '</table><p class="muted">Ziel für Note 5.0 sind etwa 68 % der Punkte.</p></div>';
    main.innerHTML = h;
    document.getElementById('goCards').onclick = function () { runCards(plan.fach); };
    document.getElementById('goExam').onclick = function () { startExam(plan.fach === 'ALLE' ? '701' : plan.fach); };
  }

  // ---------- Karteikarten ----------
  function viewKarten() {
    main.innerHTML = '<div class="card"><h3 style="margin-top:0">Karteikarten</h3><div class="row">' +
      '<select id="kf">' + fachOptions(L.planFor(L.todayISO()).fach, true) + '</select>' +
      '<button class="btn" id="kgo">Starten</button></div>' +
      '<p class="muted">Fällige Karten kommen zuerst, dann bis zu 10 neue Karten pro Sitzung. Bewertung: Nochmal / Schwer / Gut / Einfach.</p></div>';
    document.getElementById('kgo').onclick = function () { runCards(document.getElementById('kf').value); };
  }

  function runCards(fach) {
    var today = L.todayISO();
    var pool = allCards().filter(function (c) { return fach === 'ALLE' || c.fach === fach; });
    var queue = L.buildQueue(pool, S.states, today, fach, 10);
    var total = queue.length, done = 0, showing = false;
    if (!total) { main.innerHTML = '<div class="card">Keine fälligen Karten. Gut gemacht!</div>'; return; }

    function render() {
      if (!queue.length) {
        main.innerHTML = '<div class="card"><h2>Fertig</h2><p>' + done + ' Bewertungen heute abgeschlossen.</p><button class="btn" id="back">Zur Übersicht</button></div>';
        document.getElementById('back').onclick = function () { show('heute'); };
        return;
      }
      var c = queue[0];
      var h = '<div class="card"><div class="row"><span class="pill">' + esc(fachName(c.fach)) + '</span><span class="pill">' + esc(c.thema) + '</span>' +
        '<span class="muted" style="margin-left:auto">' + queue.length + ' offen</span></div>' +
        '<div class="bar" style="margin:12px 0"><i style="width:' + Math.round(done / (done + queue.length) * 100) + '%"></i></div>' +
        '<div class="q">' + esc(c.frage) + '</div>';
      if (!showing) h += '<button class="btn" id="flip">Antwort zeigen</button>';
      else h += '<div class="ans">' + esc(c.antwort) + '</div><div class="row" style="margin-top:14px">' +
        '<button class="btn bad" data-r="0">Nochmal</button><button class="btn sec" data-r="1">Schwer</button>' +
        '<button class="btn ok" data-r="2">Gut</button><button class="btn sec" data-r="3">Einfach</button></div>';
      main.innerHTML = h + '</div>';
      if (!showing) document.getElementById('flip').onclick = function () { showing = true; render(); };
      else main.querySelectorAll('[data-r]').forEach(function (b) {
        b.onclick = function () { rate(Number(b.dataset.r)); };
      });
    }
    function rate(r) {
      var c = queue.shift();
      S.states[c.id] = L.review(S.states[c.id], r, today);
      done += 1;
      if (r === 0) queue.push(c); // in dieser Sitzung nochmals
      save(); showing = false; render();
    }
    render();
  }

  // ---------- Prüfung ----------
  function viewPruefung() {
    var f = L.planFor(L.todayISO()).fach;
    f = f === 'ALLE' ? '701' : f;
    main.innerHTML = '<div class="card"><h3 style="margin-top:0">Prüfung pro Fach</h3><div class="row">' +
      '<select id="pf">' + fachOptions(f, false) + '</select>' +
      '<label class="muted"><input type="checkbox" id="pt" checked> Zeitbudget (2 Min. pro Punkt)</label>' +
      '<button class="btn" id="pgo">Prüfung starten</button></div>' +
      '<p class="muted">Rechnen: Zahl eingeben (Lösungsweg im Heft aufschreiben!). Multiple Choice: automatisch bewertet. Freitext: du bewertest dich selbst nach der Musterlösung. Neue Aufgaben kannst du unter «Daten» importieren.</p></div>';
    document.getElementById('pgo').onclick = function () {
      startExam(document.getElementById('pf').value, document.getElementById('pt').checked);
    };
  }

  function startExam(fach, timed) {
    var qs = allExams().filter(function (e) { return e.fach === fach; });
    if (timed === undefined) timed = true;
    if (!qs.length) { main.innerHTML = '<div class="card">Keine Aufgaben für dieses Fach.</div>'; return; }
    var max = qs.reduce(function (a, q) { return a + q.punkte; }, 0);
    var budgetSec = L.minutenFuer(max, 2) * 60;
    var startedAt = Date.now();
    var idx = 0, punkte = 0, answers = [];

    function tick() {
      var t = document.getElementById('timer');
      if (!t) return;
      var left = budgetSec - Math.round((Date.now() - startedAt) / 1000);
      var a = Math.abs(left), m = String(Math.floor(a / 60)).padStart(2, '0'), s = String(a % 60).padStart(2, '0');
      t.textContent = (left < 0 ? '+' : '') + m + ':' + s;
      t.classList.toggle('late', left < 0);
    }
    if (timed) timerHandle = setInterval(tick, 1000);

    function render() {
      if (idx >= qs.length) return finish();
      var q = qs[idx];
      var h = '<div class="card"><div class="row"><span class="pill">' + esc(fachName(fach)) + '</span>' +
        '<span class="pill">Aufgabe ' + (idx + 1) + ' / ' + qs.length + ' · ' + q.punkte + ' P.</span>' +
        (timed ? '<span class="timer" id="timer" style="margin-left:auto"></span>' : '') + '</div>' +
        '<div class="q">' + esc(q.frage) + '</div><div id="inp"></div><div id="fb"></div></div>';
      main.innerHTML = h;
      if (timed) tick();
      var inp = document.getElementById('inp');
      if (q.typ === 'mc') {
        var chosen = -1;
        q.optionen.forEach(function (o, i) {
          var b = document.createElement('button');
          b.className = 'opt'; b.textContent = o;
          b.onclick = function () {
            if (chosen !== -1) return;
            chosen = i;
            inp.querySelectorAll('.opt').forEach(function (x, j) {
              if (j === q.richtig) x.classList.add('right');
              else if (j === i) x.classList.add('wrong');
            });
            conclude(i === q.richtig ? q.punkte : 0, String(o), q);
          };
          inp.appendChild(b);
        });
      } else if (q.typ === 'calc') {
        inp.innerHTML = '<div class="row"><input type="text" id="num" placeholder="Ergebnis" style="max-width:240px">' +
          '<button class="btn" id="chk">Prüfen</button></div>';
        document.getElementById('chk').onclick = function () {
          var v = document.getElementById('num').value;
          var ok = L.checkNumber(v, q.antwort, q.toleranz);
          conclude(ok ? q.punkte : 0, v, q);
        };
      } else {
        inp.innerHTML = '<textarea id="txt" rows="6" placeholder="Deine Antwort (Stichworte genügen)"></textarea>' +
          '<div style="margin-top:10px"><button class="btn" id="chk">Musterlösung zeigen</button></div>';
        document.getElementById('chk').onclick = function () {
          var txt = document.getElementById('txt').value;
          document.getElementById('inp').innerHTML = '<div class="muted">Deine Antwort:</div><div class="ans">' + esc(txt || '(leer)') + '</div>';
          var fb = document.getElementById('fb');
          fb.innerHTML = '<p class="muted">Musterlösung:</p><div class="ans">' + esc(q.loesung) + '</div>' +
            '<p>Wie viele Punkte hättest du erhalten? <input type="number" id="self" min="0" max="' + q.punkte + '" step="0.5" value="0" style="width:90px"> / ' + q.punkte +
            ' <button class="btn" id="ok">Weiter</button></p>' + musterSelect();
          document.getElementById('ok').onclick = function () {
            var p = Math.max(0, Math.min(q.punkte, parseFloat(document.getElementById('self').value) || 0));
            var m = document.getElementById('muster');
            finishQ(p, txt, q, m ? m.value : '');
          };
        };
      }
    }
    function musterSelect() {
      return '<p class="muted">Warum Punkte verloren? <select id="muster"><option value="">(keine / alles richtig)</option>' +
        ['Aufgabe nicht gelöst', 'Folgefehler nach Abbruch', 'Begründung fehlt', 'Gesetzesartikel/Formel fehlt', 'Vorzeichen/Detail', 'Nicht vollständig', 'Zeit'].map(function (m) {
          return '<option>' + m + '</option>';
        }).join('') + '</select></p>';
    }
    function conclude(p, given, q) {
      var fb = document.getElementById('fb');
      var good = p === q.punkte;
      fb.innerHTML = '<p class="' + (good ? 'ok' : 'bad') + '"><b>' + (good ? 'Richtig' : 'Nicht richtig') + ' (' + p + ' / ' + q.punkte + ' P.)</b></p>' +
        '<div class="ans">' + esc(q.loesung) + '</div>' + (good ? '' : musterSelect()) +
        '<p><button class="btn" id="next">Weiter</button></p>';
      document.getElementById('next').onclick = function () {
        var m = document.getElementById('muster');
        finishQ(p, given, q, m ? m.value : '');
      };
    }
    function finishQ(p, given, q, muster) {
      punkte += p;
      answers.push({ id: q.id, p: p, max: q.punkte });
      if (p < q.punkte) S.errors.push({ date: L.todayISO(), fach: fach, id: q.id, frage: q.frage, loesung: q.loesung, muster: muster || q.muster || '' });
      save(); idx += 1; render();
    }
    function finish() {
      if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
      var used = Math.round((Date.now() - startedAt) / 60000);
      var pct = Math.round(punkte / max * 100);
      S.results.push({ date: L.todayISO(), fach: fach, punkte: punkte, max: max, minuten: used });
      save();
      var ok = L.zielErreicht(punkte, max);
      main.innerHTML = '<div class="card"><h2>Ergebnis ' + esc(fachName(fach)) + '</h2>' +
        '<div class="stat ' + (ok ? 'ok' : 'bad') + '">' + punkte + ' / ' + max + ' Punkte (' + pct + ' %)</div>' +
        '<p>' + (ok ? 'Ziel 5.0 (ca. 68 %) erreicht.' : 'Unter dem Ziel von ca. 68 % für Note 5.0.') + ' Zeit: ' + used + ' Min. (Budget ' + Math.round(budgetSec / 60) + ' Min.)</p>' +
        '<div class="row"><button class="btn" id="home">Zur Übersicht</button><button class="btn sec" id="fh">Fehlerheft</button></div></div>';
      document.getElementById('home').onclick = function () { show('heute'); };
      document.getElementById('fh').onclick = function () { show('fehler'); };
    }
    render();
  }

  // ---------- Fehlerheft ----------
  function viewFehler() {
    var byMuster = {};
    S.errors.forEach(function (e) { var m = e.muster || '(ohne Muster)'; byMuster[m] = (byMuster[m] || 0) + 1; });
    var h = '<div class="card"><h3 style="margin-top:0">Fehlermuster</h3>';
    var keys = Object.keys(byMuster).sort(function (a, b) { return byMuster[b] - byMuster[a]; });
    h += keys.length ? '<table>' + keys.map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + byMuster[k] + '×</td></tr>'; }).join('') + '</table>'
      : '<p class="muted">Noch keine Fehler erfasst.</p>';
    h += '</div>';
    h += '<div class="card"><h3 style="margin-top:0">Letzte Fehler</h3>';
    S.errors.slice(-15).reverse().forEach(function (e) {
      h += '<div style="margin-bottom:14px"><div class="muted">' + esc(e.date) + ' · ' + esc(fachName(e.fach)) + ' · ' + esc(e.muster || '') + '</div>' +
        '<div><b>' + esc(e.frage) + '</b></div><div class="ans">' + esc(e.loesung) + '</div></div>';
    });
    main.innerHTML = h + '</div>';
  }

  // ---------- Daten ----------
  function viewDaten() {
    main.innerHTML = '<div class="card"><h3 style="margin-top:0">Eigene Karteikarten importieren (CSV)</h3>' +
      '<p class="muted">Eine Karte pro Zeile: <code>Fach;Thema;Frage;Antwort</code> (Fach = 700, 701, 702 oder 703). UTF-8, Trennzeichen Semikolon.</p>' +
      '<input type="file" id="csv" accept=".csv,.txt"><p id="csvmsg" class="muted"></p></div>' +
      '<div class="card"><h3 style="margin-top:0">Backup</h3><div class="row"><button class="btn" id="exp">Fortschritt exportieren</button>' +
      '<input type="file" id="imp" accept=".json"></div><p id="impmsg" class="muted"></p></div>' +
      '<div class="card"><h3 style="margin-top:0">Zurücksetzen</h3><button class="btn bad" id="reset">Fortschritt löschen</button></div>';
    document.getElementById('csv').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var cards = L.parseCSV(String(r.result), S.extraCards.length);
        S.extraCards = S.extraCards.concat(cards); save();
        document.getElementById('csvmsg').textContent = cards.length + ' Karten importiert.';
      };
      r.readAsText(f, 'utf-8');
    };
    document.getElementById('exp').onclick = function () {
      var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'treuhand-trainer-backup-' + L.todayISO() + '.json'; a.click();
    };
    document.getElementById('imp').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { S = Object.assign(load(), JSON.parse(String(r.result))); save(); document.getElementById('impmsg').textContent = 'Backup geladen.'; }
        catch (err) { document.getElementById('impmsg').textContent = 'Datei nicht lesbar.'; }
      };
      r.readAsText(f);
    };
    document.getElementById('reset').onclick = function () {
      if (document.getElementById('reset').dataset.sure) { localStorage.removeItem(KEY); S = load(); show('heute'); return; }
      document.getElementById('reset').dataset.sure = '1';
      document.getElementById('reset').textContent = 'Nochmals klicken zum Löschen';
    };
  }

  show('heute');
})();
