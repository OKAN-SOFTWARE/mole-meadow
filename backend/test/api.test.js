import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';

test('API validation, concurrent persistence, top ten, restart, and static isolation', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'mole-test-'));
  const scoreFile = join(directory, 'Highscores.JSON');
  let server = createApp({ scoreFile }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true }); });
  let base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(`${base}/api/highscores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.deepEqual(await (await fetch(`${base}/api/highscores`)).json(), { highscores: [] });
  for (const body of [{ name: '', score: 10 }, { name: 'A', score: -10 }, { name: 'A', score: 11 }, { name: 'A', score: '10' }, { name: 'x'.repeat(25), score: 10 }, { name: 'A\nB', score: 10 }]) {
    assert.equal((await post(body)).status, 400);
  }
  const before = Date.now();
  const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => post({ name: `Player ${i}`, score: i * 10, timestamp: 'fake' })));
  assert.ok(responses.every(r => r.status === 201));
  const entries = await Promise.all(responses.map(r => r.json()));
  assert.ok(entries.every(s => Date.parse(s.timestamp) >= before));
  assert.equal(new Set(entries.map(s => s.id)).size, 20);
  const persisted = JSON.parse(await readFile(scoreFile, 'utf8'));
  assert.equal(persisted.length, 20);
  const { highscores } = await (await fetch(`${base}/api/highscores`)).json();
  assert.deepEqual(highscores.map(s => s.score), [190, 180, 170, 160, 150, 140, 130, 120, 110, 100]);
  assert.equal((await fetch(`${base}/Highscores.JSON`)).status, 404);
  assert.equal((await fetch(`${base}/vendor/three.module.js`)).status, 200);
  assert.match(await (await fetch(base)).text(), /Mole Meadow/);
  await new Promise(resolve => server.close(resolve));
  server = createApp({ scoreFile }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await fetch(`${base}/api/highscores`)).json()).highscores.length, 10);
  const brokenJson = await fetch(`${base}/api/highscores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  assert.equal(brokenJson.status, 400);
  // Corrupt files must never be silently erased by a new submission.
  await writeFile(scoreFile, 'broken');
  assert.equal((await post({ name: 'A', score: 10 })).status, 500);
  assert.equal(await readFile(scoreFile, 'utf8'), 'broken');
});
