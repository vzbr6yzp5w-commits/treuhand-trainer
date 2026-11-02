// Erzeugt src/data.js aus data/*.json (damit die App ohne Server aus file:// läuft)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));
const out = 'window.SEED_CARDS = ' + JSON.stringify(read('cards.json')) + ';\n' +
            'window.SEED_EXAMS = ' + JSON.stringify(read('exams.json')) + ';\n';
fs.writeFileSync(path.join(root, 'src', 'data.js'), out);
console.log('src/data.js geschrieben');
