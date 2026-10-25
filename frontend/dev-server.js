import express from 'express';
import { request } from 'node:http';
import { frontendPath, vendorPath } from '../backend/app.js';

const app = express();
const port = Number(process.env.FRONTEND_PORT || 5173);
const backendPort = Number(process.env.PORT || 3000);
// Optional separate frontend server: proxy API traffic to Express on port 3000.
app.use('/api', (req, res) => {
  const upstream = request({ hostname: '127.0.0.1', port: backendPort,
    path: req.originalUrl, method: req.method, headers: req.headers }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.status(502).json({ error: 'Start the backend server first.' });
    else res.end();
  });
  req.pipe(upstream);
});
app.use('/vendor', express.static(vendorPath));
app.use(express.static(frontendPath));
app.listen(port, '127.0.0.1', () => console.log(`Frontend: http://localhost:${port}`));
