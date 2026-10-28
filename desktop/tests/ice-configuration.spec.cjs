const { test, expect, _electron } = require('@playwright/test');
const { build } = require('esbuild');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');

// Run the actual React hook with a delayed configuration API and observable peers.
const harness = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { usePeerMedia } from './src/hooks/usePeerMedia';
const callbacks = new Set();
window.createdPeers = [];
window.signalRequests = [];
window.configurationRequested = false;
window.MediaStream = class {
  getTracks() { return []; }
};
const configuration = new Promise((resolve, reject) => {
  window.resolveConfiguration = resolve;
  window.rejectConfiguration = reject;
});
window.chisiki = {
  connection: async () => 'online',
  onEvent: (callback) => {
    callbacks.add(callback);
    return () => callbacks.delete(callback);
  },
  request: async (action) => {
    if (action === 'callIce') {
      window.configurationRequested = true;
      return { data: await configuration };
    }
    window.signalRequests.push(action);
    return { data: {} };
  },
};
window.emitSignal = () => callbacks.forEach(callback => callback({
  type: 'CALL_SIGNAL',
  data: { callId: 'call', senderId: 'a', kind: 'offer', payload: { type: 'offer', sdp: 'offer' } },
}));
window.RTCPeerConnection = class {
  constructor(config) {
    this.configuration = config;
    this.signalingState = 'stable';
    window.createdPeers.push(this);
  }
  getTransceivers() { return []; }
  async setRemoteDescription(value) { this.remoteDescription = value; }
  async setLocalDescription() { this.localDescription = { toJSON: () => ({ type: 'answer' }) }; }
  close() { this.signalingState = 'closed'; }
};
function Harness() {
  const media = usePeerMedia('call', 'z', [{ id: 'a', status: 'ACTIVE', camera: false }], 'call');
  return <div>{media.iceReady ? 'Ready' : 'Loading'} {media.mediaError}</div>;
}
const root = createRoot(document.getElementById('harness'));
root.render(<Harness />);
window.unmountHarness = () => root.unmount();
`;

test('WebRTC waits for ICE configuration, including an early incoming offer', async () => {
  const bundle = await build({
    stdin: { contents: harness, resolveDir: path.resolve(__dirname, '..'), loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
  });
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'chisiki-ice-'));
  const env = { ...process.env, CHISIKI_API_URL: 'http://localhost:18081' };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.CHISIKI_DEV;
  const application = await _electron.launch({
    args: [path.resolve(__dirname, '..'), '--user-data-dir=' + userData],
    env,
  });

  try {
    // A separate blank window isolates the harness from the app's preload and session.
    const windowPromise = application.waitForEvent('window');
    await application.evaluate(({ BrowserWindow }) => {
      const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
      void window.loadURL('about:blank');
    });
    const page = await windowPromise;
    async function mount() {
      await page.goto('about:blank');
      await page.setContent('<div id="harness"></div>');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await expect.poll(() => page.evaluate(() => window.configurationRequested)).toBe(true);
    }

    await mount();
    await page.evaluate(() => window.emitSignal());
    expect(await page.evaluate(() => window.createdPeers.length)).toBe(0);
    await page.evaluate(() =>
      window.resolveConfiguration({ iceServers: [{ urls: 'turn:example.test:3478' }] }),
    );
    await expect.poll(() => page.evaluate(() => window.createdPeers.length)).toBe(1);
    expect(await page.evaluate(() => window.createdPeers[0].configuration.iceServers)).toEqual([
      { urls: 'turn:example.test:3478' },
    ]);
    await expect
      .poll(() => page.evaluate(() => window.signalRequests.includes('callSignal')))
      .toBe(true);

    await mount();
    await page.evaluate(() => {
      window.emitSignal();
      window.unmountHarness();
      window.resolveConfiguration({ iceServers: [] });
    });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.createdPeers.length)).toBe(0);

    await mount();
    await page.evaluate(() => window.rejectConfiguration(new Error('Offline')));
    await expect(page.locator('#harness')).toContainText('Không tải được cấu hình');
    expect(await page.evaluate(() => window.createdPeers.length)).toBe(0);
  } finally {
    await application.close();
  }
});
