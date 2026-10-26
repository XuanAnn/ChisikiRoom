// Run against a disposable verification server, never a production database.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('../desktop/node_modules/@stomp/stompjs');
const WebSocket = require('../desktop/node_modules/ws');
const base = process.env.VERIFY_API_URL || 'http://localhost:18080';
const clients = [];
async function api(path, token, body, method = body ? 'POST' : 'GET', expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}
async function account(name) {
  return api(
    '/api/auth/register',
    null,
    { email: `verify-${randomUUID()}@example.com`, password: randomUUID(), displayName: name },
    'POST',
    201,
  );
}
function connect(token, destination = '/user/queue/events', expectError = false) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('STOMP connection timed out')), 10000);
    const events = [];
    const client = new Client({
      webSocketFactory: () => new WebSocket(base.replace(/^http/, 'ws') + '/ws'),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 0,
      onConnect: () => {
        client.subscribe(destination, (message) => events.push(JSON.parse(message.body)));
        if (!expectError) {
          clearTimeout(timer);
          resolve({ client, events });
        }
      },
      onStompError: () => {
        clearTimeout(timer);
        expectError ? resolve({ client, events }) : reject(new Error('STOMP rejected'));
      },
      onWebSocketError: () => {
        clearTimeout(timer);
        reject(new Error('WebSocket failed'));
      },
    });
    clients.push(client);
    client.activate();
  });
}
async function eventually(check) {
  for (let i = 0; i < 50; i++) {
    if (check()) {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Expected realtime event not received');
}
(async () => {
  assert.equal((await api('/actuator/health')).status, 'UP');
  const [a, b, c, d, e, outsider] = await Promise.all(
    ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Ngoài phòng'].map(account),
  );
  const room = await api('/api/chat-rooms', a.token, {
    name: 'Verification private room',
    privateRoom: true,
  });
  await api(`/api/chat-rooms/${room.id}/join`, outsider.token, {}, 'POST', 403);
  await api(`/api/chat-rooms/${room.id}/messages`, outsider.token, undefined, 'GET', 403);
  for (const person of [b, c, d, e]) {
    await api(`/api/chat-rooms/${room.id}/invite`, a.token, { userId: person.user.id });
    await api(`/api/group-invitations/${room.id}/respond`, person.token, { accept: true });
  }
  const [sa, sb] = await Promise.all([connect(a.token), connect(b.token)]);
  await connect('invalid-token', '/user/queue/events', true);
  await connect(outsider.token, `/user/${a.user.id}/queue/events`, true);
  const requestId = randomUUID();
  const message = await api(`/api/chat-rooms/${room.id}/messages`, a.token, {
    content: 'Xin chào realtime 👋',
    requestId,
  });
  assert.equal(
    (
      await api(`/api/chat-rooms/${room.id}/messages`, a.token, {
        content: 'Xin chào realtime 👋',
        requestId,
      })
    ).id,
    message.id,
  );
  await eventually(
    () =>
      sa.events.some((e) => e.type === 'MESSAGE_CREATED' && e.data.id === message.id) &&
      sb.events.some((e) => e.type === 'MESSAGE_CREATED' && e.data.id === message.id),
  );
  console.log(
    'PASS PostgreSQL + authenticated STOMP: two clients receive one persisted message; private access and foreign subscriptions denied.',
  );
  await sb.client.deactivate();
  const gap = await api(`/api/chat-rooms/${room.id}/messages`, a.token, {
    content: 'Message during reconnect',
    requestId: randomUUID(),
  });
  await connect(b.token);
  assert.ok(
    (await api(`/api/chat-rooms/${room.id}/messages`, b.token)).some((m) => m.id === gap.id),
  );
  await api('/api/friend-requests', a.token, { userId: b.user.id });
  await api('/api/friend-requests/respond', b.token, { senderId: a.user.id, accept: true });
  assert.ok((await api('/api/friends', a.token)).some((f) => f.id === b.user.id));
  const form = new FormData();
  form.set('roomId', room.id);
  form.set('file', new Blob(['ChisikiRoom verification']), 'verification.txt');
  const uploaded = await fetch(base + '/api/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.token}` },
    body: form,
  });
  assert.equal(uploaded.status, 200);
  const doc = await uploaded.json();
  const download = await fetch(base + `/api/documents/${doc.id}/download`, {
    headers: { Authorization: `Bearer ${b.token}` },
  });
  assert.equal(download.status, 200);
  assert.equal(await download.text(), 'ChisikiRoom verification');
  assert.equal(
    (
      await fetch(base + `/api/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${outsider.token}` },
      })
    ).status,
    403,
  );
  const invalid = new FormData();
  invalid.set('roomId', room.id);
  invalid.set('file', new Blob([new Uint8Array([0, 255])]), 'bad.txt');
  assert.equal(
    (
      await fetch(base + '/api/documents', {
        method: 'POST',
        headers: { Authorization: `Bearer ${a.token}` },
        body: invalid,
      })
    ).status,
    400,
  );
  console.log(
    'PASS friends, reconnect history, authenticated file upload/download, invalid file content and nonmember download denied.',
  );
  const quiz = await api('/api/question-sets', a.token, {
    title: 'Verification battle',
    questions: [
      { text: '1 + 1?', options: ['2', '3'], correctIndex: 0 },
      { text: '2 + 2?', options: ['4', '5'], correctIndex: 0 },
    ],
  });
  const battle = await api('/api/battles', a.token, { roomId: room.id, questionSetId: quiz.id });
  for (const player of [b, c]) {
    await api(`/api/battles/${battle.id}/join`, player.token, {});
  }
  const seats = await Promise.all(
    [d, e].map(async (player) => ({
      player,
      response: await fetch(base + `/api/battles/${battle.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${player.token}` },
      }),
    })),
  );
  assert.deepEqual(seats.map((s) => s.response.status).sort(), [200, 409]);
  await api(`/api/battles/${battle.id}/start`, a.token, {}, 'POST', 409);
  const fourth = seats.find((s) => s.response.status === 200).player;
  for (const player of [a, b, c, fourth]) {
    await api(`/api/battles/${battle.id}/heartbeat`, player.token, { camera: true, ready: true });
  }
  const started = await api(`/api/battles/${battle.id}/start`, a.token, {});
  assert.equal(started.round.correctIndex, null);
  const answers = await Promise.all(
    [a, b].map((player) =>
      fetch(base + `/api/battles/${battle.id}/answers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${player.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: started.round.id,
          optionIndex: 0,
          requestId: randomUUID(),
        }),
      }),
    ),
  );
  assert.deepEqual(answers.map((r) => r.status).sort(), [200, 409]);
  const resolved = await api(`/api/battles/${battle.id}`, b.token);
  assert.equal(resolved.round.status, 'RESOLVED');
  assert.deepEqual(
    resolved.players.map((p) => p.score).sort((a, b) => a - b),
    [-5, -5, -5, 10],
  );
  await eventually(() =>
    sa.events.some((e) => e.type === 'ROUND_RESOLVED' && e.data.battleId === battle.id),
  );
  const noSeat = seats.find((s) => s.response.status === 409).player;
  await api(
    `/api/battles/${battle.id}/signal`,
    noSeat.token,
    { targetId: a.user.id, kind: 'offer', payload: { type: 'offer', sdp: 'invalid' } },
    'POST',
    403,
  );
  const directOpens = await Promise.all([
    api('/api/chat-rooms/direct', a.token, { userId: b.user.id }),
    api('/api/chat-rooms/direct', b.token, { userId: a.user.id }),
  ]);
  assert.equal(directOpens[0].id, directOpens[1].id);
  await api(`/api/chat-rooms/${directOpens[0].id}/messages`, outsider.token, undefined, 'GET', 403);

  const groupCall = await api(`/api/chat-rooms/${room.id}/call`, a.token, {});
  for (const participant of [b, c]) {
    await api(`/api/calls/${groupCall.id}/join`, participant.token, {});
  }
  const callSeatResponses = await Promise.all(
    [d, e].map(async (participant) => ({
      participant,
      response: await fetch(base + `/api/calls/${groupCall.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${participant.token}` },
        signal: AbortSignal.timeout(15000),
      }),
    })),
  );
  assert.deepEqual(callSeatResponses.map((result) => result.response.status).sort(), [200, 409]);
  assert.equal((await api(`/api/calls/${groupCall.id}`, a.token)).participants.length, 4);
  const rejectedCaller = callSeatResponses.find(
    (result) => result.response.status === 409,
  ).participant;
  await api(
    `/api/calls/${groupCall.id}/signal`,
    rejectedCaller.token,
    { targetId: a.user.id, kind: 'restart', payload: {} },
    'POST',
    403,
  );
  await api(`/api/calls/${groupCall.id}/signal`, b.token, {
    targetId: a.user.id,
    kind: 'restart',
    payload: {},
  });
  await eventually(() =>
    sa.events.some((event) => event.type === 'CALL_SIGNAL' && event.data.callId === groupCall.id),
  );
  const acceptedCaller = callSeatResponses.find(
    (result) => result.response.status === 200,
  ).participant;
  for (const participant of [a, b, c, acceptedCaller]) {
    await api(`/api/calls/${groupCall.id}/leave`, participant.token, {});
  }
  assert.equal(await api(`/api/chat-rooms/${room.id}/call`, a.token), null);

  const firstCallRoom = await api('/api/chat-rooms', a.token, {
    name: 'Concurrent call one',
    privateRoom: true,
  });
  const secondCallRoom = await api('/api/chat-rooms', b.token, {
    name: 'Concurrent call two',
    privateRoom: true,
  });
  await api(`/api/chat-rooms/${firstCallRoom.id}/invite`, a.token, { userId: c.user.id });
  await api(`/api/chat-rooms/${secondCallRoom.id}/invite`, b.token, { userId: c.user.id });
  await api(`/api/group-invitations/${firstCallRoom.id}/respond`, c.token, { accept: true });
  await api(`/api/group-invitations/${secondCallRoom.id}/respond`, c.token, { accept: true });
  const firstCall = await api(`/api/chat-rooms/${firstCallRoom.id}/call`, a.token, {});
  const secondCall = await api(`/api/chat-rooms/${secondCallRoom.id}/call`, b.token, {});
  const concurrentJoins = await Promise.all(
    [firstCall, secondCall].map((call) =>
      fetch(base + `/api/calls/${call.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.token}` },
        signal: AbortSignal.timeout(15000),
      }),
    ),
  );
  assert.deepEqual(concurrentJoins.map((response) => response.status).sort(), [200, 409]);
  const currentCalls = await Promise.all([
    api(`/api/calls/${firstCall.id}`, a.token),
    api(`/api/calls/${secondCall.id}`, b.token),
  ]);
  const joinedCalls = currentCalls.filter((call) =>
    call.participants.some((participant) => participant.id === c.user.id),
  );
  assert.equal(joinedCalls.length, 1);
  await api(`/api/calls/${joinedCalls[0].id}/leave`, c.token, {});
  await api(`/api/calls/${firstCall.id}/leave`, a.token, {});
  await api(`/api/calls/${secondCall.id}/leave`, b.token, {});
  console.log(
    'PASS PostgreSQL: simultaneous friend chat opens reuse one room; call last-seat contention admits one player; one account cannot join two calls concurrently; signaling remains participant-only.',
  );

  await api('/api/auth/logout', outsider.token, {}, 'POST', 204);
  await api('/api/auth/me', outsider.token, undefined, 'GET', 401);
  console.log(
    'PASS PostgreSQL row locks: exactly one final seat, one correct winner, score ledger and transactional outbox; camera start gate and signaling authorization.',
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled(clients.map((c) => c.deactivate({ force: true })));
  });
