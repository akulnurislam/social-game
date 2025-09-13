
const PORT = process.env['API_PORT'] || 3000;

// Mock player IDs and groups from 002_mock_data.sql
const PLAYER_A = '11111111-1111-1111-1111-111111111111';
const PLAYER_B = '22222222-2222-2222-2222-222222222222';
const GROUP_A = 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const GROUP_B = 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

async function post(url: string, body: any, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(`http://localhost:${PORT}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });


  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${res.status}] ${text}`);
  }
  return res.json();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    console.log('[Test] Creating battle as Player A...');
    const battle: any = await post('/battles', {
      groupAttacker: GROUP_A,
      groupDefender: GROUP_B,
    }, {
      'X-Player-ID': PLAYER_A,
    });
    const battleId = battle.id;
    console.log('[OK] Battle created:', battleId);

    console.log('[Test] Player B joining...');
    await post(`/battles/${battleId}/join`, {}, { 'X-Player-ID': PLAYER_B });
    console.log('[OK] Player B joined battle');

    console.log('[Test] Begin battle...');
    await post(`/battles/${battleId}/begin`, {}, { 'X-Player-ID': PLAYER_A });
    console.log('[OK] Battle begun');

    console.log('[Test] Waiting for 65 seconds...');
    await sleep(65_000);

    console.log('[Test] Finish battle...');
    await post(`/battles/${battleId}/finish`, {}, { 'X-Player-ID': PLAYER_A });
    console.log('[OK] Battle finished');
  } catch (err: any) {
    console.error('[Error during integration test]', err.message);
    console.error(err);
  }
}

main();
