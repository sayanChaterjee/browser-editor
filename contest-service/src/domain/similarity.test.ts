import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, similarity } from './similarity';

const original = `
<div class="card">
  <h1 class="title">Weather</h1>
  <ul id="forecast"></ul>
  <button id="refresh">Refresh</button>
</div>
.card { display: flex; flex-direction: column; gap: 12px; padding: 24px; border-radius: 8px; }
.title { font-size: 28px; font-weight: 600; color: #222; }
#forecast li { list-style: none; padding: 4px 0; border-bottom: 1px solid #eee; }
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
function render() {
  const list = document.getElementById('forecast');
  list.innerHTML = '';
  for (const day of days) {
    const li = document.createElement('li');
    li.textContent = day + ': ' + Math.round(Math.random() * 30) + ' degrees';
    list.appendChild(li);
  }
}
document.getElementById('refresh').addEventListener('click', render);
render();
`;

const unrelated = `
<form id="signup"><input name="email" type="email"><input name="pw" type="password"><button>Join</button></form>
form { max-width: 320px; margin: 40px auto; display: grid; gap: 8px; }
input { padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
button { background: navy; color: white; padding: 10px; border: 0; }
const form = document.getElementById('signup');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  if (!String(data.get('email')).includes('@')) return alert('Bad email');
  if (String(data.get('pw')).length < 8) return alert('Password too short');
  alert('Welcome!');
});
`;

test('identical code scores 1; unrelated code scores low', () => {
  assert.equal(similarity(fingerprint(original), fingerprint(original)), 1);
  assert.ok(similarity(fingerprint(original), fingerprint(unrelated)) < 0.1);
});

test('reformatting, comments and case changes don\'t hide a copy', () => {
  const disguised = original
    .replace(/\n\s*/g, ' ')
    .replace('function render', '/* my own work */ function render')
    .replace('<h1 class="title">', '<H1 CLASS="title">');
  assert.ok(similarity(fingerprint(original), fingerprint(disguised)) > 0.9);
});

test('a partial copy scores in between', () => {
  const half = original.split('const days')[0] + unrelated.split('const form')[1];
  const score = similarity(fingerprint(original), fingerprint(half));
  assert.ok(score > 0.2 && score < 0.8, `score ${score}`);
});

test('too little code gets no fingerprint (two empty templates aren\'t "copies")', () => {
  assert.deepEqual(fingerprint('<h1>Hello</h1>'), []);
  assert.equal(similarity(fingerprint('<h1>Hi</h1>'), fingerprint('<h1>Hi</h1>')), 0);
});
