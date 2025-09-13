import WebSocket from 'ws';

const PORT = process.env['WS_PORT'] || 4000;

// Read playerId from command line argument
const PLAYER_ID = process.argv[2];

if (!PLAYER_ID) {
  console.error('Usage: npm run client:ws <playerId>');
  process.exit(1);
}

const ws = new WebSocket(`ws://localhost:${PORT}?playerId=${PLAYER_ID}`);

ws.on('open', () => {
  console.log(`Connected to server as ${PLAYER_ID}`);

  // ping to server
  // ws.send(JSON.stringify({ event: 'ping' }));

  // test battle event
  setTimeout(() => {
    ws.send(JSON.stringify({ event: 'battle', payload: { playerId: PLAYER_ID, battleId: '<UUID>', note: 'Test client to server' } }));
  }, 200);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('Received message:', msg);
  } catch (err) {
    console.error('Invalid JSON:', data.toString());
  }
});

ws.on('close', (code, reason) => {
  console.log(`Disconnected from server code: ${code} reason: ${reason}`);
});

ws.on('error', (err) => {
  console.error('Error:', err);
});
