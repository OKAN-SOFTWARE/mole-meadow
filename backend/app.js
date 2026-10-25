import express from 'express';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createScoreStore } from './store.js';

export const frontendPath = fileURLToPath(new URL('../frontend/', import.meta.url));
export const vendorPath = fileURLToPath(new URL('../node_modules/three/build/', import.meta.url));
export function createApp({ scoreFile = fileURLToPath(new URL('./Highscores.JSON', import.meta.url)) } = {}) {
  const app = express();
  const store = createScoreStore(scoreFile);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2kb' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/highscores', async (_req, res) => {
    res.json({ highscores: await store.top() });
  });
  app.post('/api/highscores', async (req, res) => {
    const { name, score } = req.body ?? {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || [...cleanName].length > 24 || /[\p{C}]/u.test(cleanName)) {
      return res.status(400).json({ error: 'Enter a name with 1–24 characters and no control characters.' });
    }
    if (!Number.isSafeInteger(score) || score < 0 || score > 100000 || score % 10 !== 0) {
      return res.status(400).json({ error: 'Score must be a multiple of 10 between 0 and 100000.' });
    }
    // Use server time: the client cannot choose its leaderboard timestamp.
    const entry = { id: randomUUID(), name: cleanName, score, timestamp: new Date().toISOString() };
    await store.add(entry);
    res.status(201).json(entry);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use('/vendor', express.static(vendorPath));
  // Expose only frontend assets, never backend files or score storage.
  app.use(express.static(frontendPath, { index: 'index.html' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    console.error(error);
    res.status(500).json({ error: 'Unable to access high scores. Check the server console.' });
  });
  return app;
}
