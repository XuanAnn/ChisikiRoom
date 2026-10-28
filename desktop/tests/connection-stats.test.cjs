const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

async function loadSummary() {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/lib/connectionStats.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function report(localType, remoteType) {
  return new Map([
    ['transport', { type: 'transport', selectedCandidatePairId: 'selected' }],
    ['unselected', { type: 'candidate-pair', state: 'succeeded', localCandidateId: 'other' }],
    ['other', { type: 'local-candidate', candidateType: 'relay' }],
    [
      'selected',
      {
        type: 'candidate-pair',
        localCandidateId: 'local',
        remoteCandidateId: 'remote',
        currentRoundTripTime: 0.032,
      },
    ],
    [
      'local',
      {
        type: 'local-candidate',
        candidateType: localType,
        protocol: 'udp',
        address: 'private-address',
      },
    ],
    ['remote', { type: 'remote-candidate', candidateType: remoteType, protocol: 'udp' }],
  ]);
}

test('only the selected pair determines direct or TURN routing; private addresses are not exposed', async () => {
  const { summarizeConnection } = await loadSummary();
  const direct = summarizeConnection(report('host', 'srflx'));
  assert.equal(direct.route, 'direct');
  assert.equal(direct.roundTripMs, 32);
  assert.equal(direct.protocol, 'udp');
  assert.equal(JSON.stringify(direct).includes('private-address'), false);
  assert.equal(summarizeConnection(report('host', 'relay')).route, 'relay');
  const relay = report('relay', 'host');
  relay.get('local').relayProtocol = 'tls';
  assert.equal(summarizeConnection(relay).relayProtocol, 'tls');
  assert.equal(summarizeConnection(relay).protocol, 'udp');
});

test('missing selection or candidates are unknown and missing latency is not zero', async () => {
  const { summarizeConnection } = await loadSummary();
  const pending = report('host', 'host');
  pending.delete('transport');
  assert.deepEqual(summarizeConnection(pending), { route: 'unknown' });
  const incomplete = report('host', 'host');
  incomplete.delete('remote');
  incomplete.get('selected').currentRoundTripTime = undefined;
  assert.equal(summarizeConnection(incomplete).route, 'unknown');
  assert.equal(summarizeConnection(incomplete).roundTripMs, undefined);
});
