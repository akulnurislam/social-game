import app from './app';

const PORT = process.env['API_PORT'] || 3000;

export function startApiServer() {
  app.listen(PORT, () => {
    console.log(`[API Server] running on http://localhost:${PORT}`);
  });
}
