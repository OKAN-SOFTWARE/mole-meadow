import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const server = createApp().listen(port, '127.0.0.1', () => {
  console.log(`Mole Meadow: http://localhost:${port}`);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
