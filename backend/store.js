import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createScoreStore(file) {
  // Serialize read-modify-write operations within this server process.
  let pending = Promise.resolve();
  const serialize = (operation) => {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };
  async function read() {
    let text;
    try { text = await readFile(file, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    const scores = JSON.parse(text);
    if (!Array.isArray(scores) || scores.some(s =>
      typeof s.name !== 'string' || !Number.isSafeInteger(s.score) ||
      s.score < 0 || typeof s.timestamp !== 'string' ||
      !Number.isFinite(Date.parse(s.timestamp)))) {
      throw new Error('Invalid high-score file; restore or repair it before restarting.');
    }
    return scores;
  }
  return {
    top: () => serialize(async () => (await read())
      .sort((a, b) => b.score - a.score || a.timestamp.localeCompare(b.timestamp))
      .slice(0, 10)),
    add: (entry) => serialize(async () => {
      const scores = await read();
      scores.push(entry);
      await mkdir(dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, `${JSON.stringify(scores, null, 2)}\n`, { flag: 'wx' });
        await rename(temporary, file);
      } finally {
        await unlink(temporary).catch(error => {
          if (error.code !== 'ENOENT') throw error;
        });
      }
      return entry;
    }),
  };
}
