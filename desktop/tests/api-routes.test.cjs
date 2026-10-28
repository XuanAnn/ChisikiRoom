const { test } = require('node:test');
const assert = require('node:assert/strict');

test('shared API routing keeps identifiers out of paths unless validated', async () => {
  const { route } = await import('../electron/api-routes.mjs');
  const id = '00000000-0000-4000-8000-000000000001';
  assert.deepEqual(route('login'), ['POST', '/api/auth/login']);
  assert.deepEqual(route('callSignal', { id }), ['POST', `/api/calls/${id}/signal`]);
  assert.deepEqual(route('saveQuiz', { id }), ['PUT', `/api/question-sets/${id}`]);
  assert.deepEqual(route('searchMessages', { id, q: 'a&b', before: 12 }), [
    'GET',
    `/api/chat-rooms/${id}/messages/search?q=a%26b&before=12`,
  ]);
  assert.throws(() => route('sendMessage', { id: '../auth/logout' }));
  assert.throws(() => route('editMessage', { id, messageId: '../1' }));
  assert.throws(() => route('constructor', { id }));
  assert.throws(() => route('unknown', { id }));
});
