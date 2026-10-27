const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkServerConnection, normalizeServerUrl } = require('../electron/server-connection.cjs');

test('server checks reject credentials, paths and unsupported protocols before sending a request', async () => {
  const invalidAddresses = [
    'file:///tmp/server',
    'https://user:password@example.com',
    'https://example.com/api',
    'https://example.com?token=secret',
    'https://example.com/#fragment',
    null,
  ];

  for (const address of invalidAddresses) {
    const result = await checkServerConnection(address, async () => {
      assert.fail('Invalid addresses must not be fetched');
    });
    assert.ok(result.error);
  }

  assert.equal(normalizeServerUrl(' https://example.com/ '), 'https://example.com');
});

test('health checks send no session credentials and do not follow redirects', async () => {
  const result = await checkServerConnection('https://example.com', async (url, options) => {
    assert.equal(url, 'https://example.com/actuator/health');
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({ status: 'UP' }) };
  });

  assert.equal(result.data.url, 'https://example.com');
  assert.ok(result.data.latencyMs >= 0);
});

test('health checks report unavailable services, invalid responses and timeouts', async () => {
  const responses = [
    async () => ({ ok: false, status: 503 }),
    async () => ({ ok: true, json: async () => ({ status: 'DOWN' }) }),
    async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('HTML');
      },
    }),
    async () => {
      throw new DOMException('Timeout', 'TimeoutError');
    },
    async () => {
      throw new TypeError('Network failed');
    },
  ];

  for (const response of responses) {
    const result = await checkServerConnection('http://localhost:8080', response);
    assert.ok(result.error);
    assert.equal(result.data, undefined);
  }
});
