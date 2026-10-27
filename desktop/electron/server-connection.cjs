function normalizeServerUrl(value) {
  if (typeof value !== 'string') {
    throw new Error('Nhập địa chỉ dạng http://IP:8080 hoặc https://tên-miền');
  }

  const parsed = new URL(value.trim());
  const supportedProtocol = ['http:', 'https:'].includes(parsed.protocol);
  const hasExtraParts = Boolean(
    parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash,
  );

  if (!supportedProtocol || hasExtraParts) {
    throw new Error('Nhập địa chỉ dạng http://IP:8080 hoặc https://tên-miền');
  }

  return parsed.origin;
}

async function checkServerConnection(value, fetchRequest = fetch) {
  let serverUrl;

  try {
    serverUrl = normalizeServerUrl(value);
  } catch {
    return { error: 'Nhập địa chỉ dạng http://IP:8080 hoặc https://tên-miền' };
  }

  try {
    const startedAt = performance.now();
    const response = await fetchRequest(`${serverUrl}/actuator/health`, {
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });

    if (!response.ok) {
      return { error: `Máy chủ trả về HTTP ${response.status}. Kiểm tra backend hoặc proxy.` };
    }

    const health = await response.json();

    if (health.status !== 'UP') {
      return { error: 'Máy chủ có phản hồi nhưng chưa sẵn sàng. Kiểm tra backend và database.' };
    }

    return {
      data: {
        url: serverUrl,
        latencyMs: Math.round(performance.now() - startedAt),
      },
    };
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return { error: 'Quá 8 giây chưa có phản hồi. Kiểm tra địa chỉ, mạng và firewall.' };
    }

    return {
      error: 'Không kiểm tra được backend. Kiểm tra địa chỉ, kết nối mạng và chứng chỉ HTTPS.',
    };
  }
}

module.exports = { normalizeServerUrl, checkServerConnection };
