const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sessionExpired } = require('../electron/session.cjs');
test('a valid profile keeps the session despite an endpoint failure', async () => {
  assert.equal(
    await sessionExpired('http://localhost:8080', 'test-token', async (url, options) => {
      assert.equal(url, 'http://localhost:8080/api/auth/me');
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      return { status: 200 };
    }),
    false,
  );
});
test('only an unauthorized profile confirms expiration', async () => {
  assert.equal(
    await sessionExpired('http://localhost:8080', 'test-token', async () => ({ status: 401 })),
    true,
  );
  for (const status of [403, 404, 500, 503]) {
    assert.equal(
      await sessionExpired('http://localhost:8080', 'test-token', async () => ({ status })),
      false,
    );
  }
});
test('network failures and a missing token do not force logout', async () => {
  assert.equal(
    await sessionExpired('http://localhost:8080', 'test-token', async () => {
      throw new Error('offline');
    }),
    false,
  );
  assert.equal(
    await sessionExpired('http://localhost:8080', undefined, async () => {
      throw new Error('must not call');
    }),
    false,
  );
});
