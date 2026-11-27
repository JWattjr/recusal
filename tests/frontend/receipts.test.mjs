import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../../frontend/app.js', import.meta.url), 'utf8'))
  .replace(/\binit\(\);\s*$/, '');
const address = '0x' + '12'.repeat(20);
const hash = '0x' + '12'.repeat(32);
const wrongSeat = 'wallet is not eligible for this frozen seat';

function appFixture(responses, { failAfterHash = false } = {}) {
  const nodes = new Map();
  const storage = new Map();
  const provider = {
    async request({ method }) {
      if (method === 'eth_requestAccounts') return [address];
      if (method === 'eth_chainId') return '0xf22f';
      if (method === 'eth_sendTransaction') return hash;
      return null;
    },
  };
  const app = vm.createContext({
    address,
    window: {
      ethereum: provider, setTimeout: (callback) => queueMicrotask(callback),
      GenLayer: {
        studionet: { id: 61999 },
        createClient: ({ provider: signer }) => signer ? {
          async estimateTransactionFees() { return { distribution: {}, feeValue: 10n }; },
          async writeContract() {
            await signer.request({ method: 'eth_sendTransaction' });
            if (failAfterHash) throw new Error('Envelope lookup timed out');
            return hash;
          },
        } : {
          async getTransaction() {
            const next = responses.shift();
            if (next instanceof Error) throw next;
            return next;
          },
        },
      },
    },
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: { getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', dataset: {} });
      return nodes.get(id);
    } },
  });
  vm.runInContext(source, app);
  vm.runInContext('contractAddress = address; refreshContract = async () => {}', app);
  return { nodes, run: (code) => vm.runInContext(code, app) };
}

test('submission follows pending consensus to a successful final receipt', async () => {
  const app = appFixture([new Error('Not indexed'), { statusName: 'ACCEPTED' }, {
    statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_RETURN',
  }]);
  await app.run("sendWrite('vote', ['B', 0, 1], 'Vote on B')");
  const receipt = await app.run('pendingTrackers.get(feedbackHash) || walletReceipts()[0]');
  assert.equal(receipt.hash, hash);
  assert.equal(receipt.status, 'FINALIZED');
  assert.equal(receipt.executionOutcome, 'Execution succeeded');
  assert.match(app.nodes.get('receiptList').innerHTML, new RegExp('/tx/' + hash));
  assert.equal(app.nodes.get('actionFeedback').dataset.state, 'success');
});

test('a returned hash survives SDK timeout and tracks finalized execution rejection', async () => {
  const app = appFixture([{ statusName: 'PENDING' }, {
    statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_ERROR', result_name: 'MAJORITY_AGREE',
    consensus_data: { leader_receipt: [{ result: { payload: wrongSeat } }] },
  }], { failAfterHash: true });
  assert.equal(await app.run("sendWrite('vote', ['A', 0, 1], 'Vote on A')"), hash);
  const receipt = await app.run('pendingTrackers.get(feedbackHash) || walletReceipts()[0]');
  assert.equal(receipt.status, 'FINALIZED');
  assert.equal(receipt.executionOutcome, 'Execution rejected: ' + wrongSeat);
  assert.equal(app.nodes.get('actionFeedback').dataset.state, 'error');
});

test('RPC timeout preserves a reloadable hash and canceled transactions finish tracking', async () => {
  const app = appFixture(Array.from({ length: 100 }, () => new Error('Temporarily offline')));
  await app.run("sendWrite('vote', ['B', 0, 1], 'Vote on B')");
  const pending = await app.run('pendingTrackers.get(feedbackHash) || walletReceipts()[0]');
  assert.equal(pending.status, 'SUBMITTED');
  assert.equal(pending.trackingPaused, true);
  assert.match(app.nodes.get('receiptList').innerHTML, /Check status/);

  const reloaded = appFixture([{ statusName: 'CANCELED' }]);
  const canceled = await reloaded.run(`trackReceipt(${JSON.stringify(pending)})`);
  assert.equal(canceled.status, 'CANCELED');
  assert.equal(canceled.executionOutcome, '');
  assert.doesNotMatch(reloaded.nodes.get('receiptList').innerHTML, /Check status/);
});

test('a finalized leader return still reports a consensus disagreement', async () => {
  const app = appFixture([{
    statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_RETURN', result_name: 'MAJORITY_DISAGREE',
  }]);
  await app.run("sendWrite('adjudicate', ['1'], 'Request ruling')");
  const receipt = await app.run('pendingTrackers.get(feedbackHash) || walletReceipts()[0]');
  assert.equal(receipt.executionOutcome, 'Consensus did not accept execution');
  assert.equal(app.nodes.get('actionFeedback').dataset.state, 'error');
});
