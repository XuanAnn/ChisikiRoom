// An individual endpoint can incorrectly return 401 (for example an older
// backend during error dispatch). Only /me establishes that the session ended.
async function sessionExpired(apiUrl, token, fetcher = fetch) {
  if (!token) {
    return false;
  }
  try {
    const response = await fetcher(apiUrl + '/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    return response.status === 401;
  } catch {
    return false;
  }
}
module.exports = { sessionExpired };
