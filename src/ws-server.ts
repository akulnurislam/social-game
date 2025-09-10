import { WebSocketServer } from 'ws';

const PORT = process.env['WS_PORT'] || 4000;

export function startWsServer() {
  const wss = new WebSocketServer({ port: Number(PORT) });

  wss.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('message', (msg) => {
      console.log('Received:', msg.toString());
      socket.send('Pong');
    });
  });

  console.log(`WS server running on ws://localhost:${PORT}`);
}
