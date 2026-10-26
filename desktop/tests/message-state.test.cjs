const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
async function load() {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/features/chat/messageState.ts'),
    'utf8',
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}
test('late history must not resurrect edited or deleted messages', async () => {
  const { mergeMessages } = await load();
  const original = { id: 1, revision: 0, content: 'Old' };
  const edited = { ...original, revision: 1, content: 'New' };
  const deleted = { ...original, revision: 2, content: '', deletedAt: '2026-10-26', reply: null };
  assert.equal(mergeMessages([edited], [original])[0].content, 'New');
  assert.equal(mergeMessages([deleted], [edited])[0].deletedAt, '2026-10-26');
  assert.equal(mergeMessages([deleted], [original])[0].content, '');
});
test('quote and message revisions advance independently', async () => {
  const { latestMessage } = await load();
  const local = {
    id: 2,
    revision: 2,
    content: 'Edited reply',
    reply: { id: 1, revision: 1, content: 'Parent old' },
  };
  const remote = {
    id: 2,
    revision: 0,
    content: 'Original reply',
    reply: { id: 1, revision: 3, content: '', deleted: true },
  };
  const merged = latestMessage(local, remote);
  assert.equal(merged.content, 'Edited reply');
  assert.equal(merged.reply.revision, 3);
  assert.equal(merged.reply.deleted, true);
  const late = latestMessage(merged, local);
  assert.equal(late.reply.deleted, true);
});
