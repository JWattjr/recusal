import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import vm from 'node:vm';
import { createAccount, createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

// Execute the shipped app and its SDK with an injected test wallet.
// Keys stay in this local process and only signed StudioNet envelopes leave it.
const keys = JSON.parse(await readFile('.test-wallets.json', 'utf8'));
const journal = 'deploy/receipts/wallet-path-run.json';
const run = JSON.parse(await readFile(journal, 'utf8'));
const { contract } = run;
assert.equal(keys.chainId, 61999);
assert.equal(run.chainId, 61999);
assert.match(contract, /^0x[0-9a-f]{40}$/i);
const sdk = createClient({ chain: studionet });
const rpcUrl = studionet.rpcUrls.default.http[0];
const rpc = async (method, params = []) => {
  const response = await fetch(rpcUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(`${method}: ${result.error.message}`);
  return result.result;
};
assert.equal(await rpc('eth_chainId'), '0xf22f');
const accounts = Object.fromEntries(Object.entries(keys.accounts).map(([role, entry]) => [
  role, createAccount(`0x${entry.privateKey.replace(/^0x/, '')}`),
]));
assert.equal(accounts.steward.address.toLowerCase(), run.wallets.steward.toLowerCase());
const values = new Map();
const nodes = new Map();
const element = (id) => {
  if (!nodes.has(id)) nodes.set(id, {
    value: '', textContent: '', innerHTML: '', dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener() {},
  });
  return nodes.get(id);
};
let role = 'steward';
let action = '';
const bridge = {
  async request({ method, params = [] }) {
    const wallet = accounts[role];
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [wallet.address];
    if (method === 'wallet_switchEthereumChain') {
      assert.equal(params[0].chainId, '0xf22f');
      return null;
    }
    if (method !== 'eth_sendTransaction') return rpc(method, params);
    const request = params[0];
    assert.equal(request.from.toLowerCase(), wallet.address.toLowerCase());
    assert.equal(Number(request.chainId), 61999);
    assert.equal(request.to.toLowerCase(), studionet.consensusMainContract.address.toLowerCase());
    const signed = await wallet.signTransaction({
      type: 'legacy', chainId: 61999, to: request.to, data: request.data,
      value: BigInt(request.value), gas: BigInt(request.gas),
      nonce: Number(request.nonce), gasPrice: BigInt(request.gasPrice),
    });
    const hash = await rpc('eth_sendRawTransaction', [signed]);
    run.transactions[action] = hash;
    run.submitters ??= {};
    run.submitters[action] = wallet.address;
    await save();
    console.log(action, 'SUBMITTED', hash);
    return hash;
  },
};
const context = vm.createContext({
  document: { getElementById: element }, window: {
    ethereum: bridge, GenLayer: { createClient, studionet }, setTimeout,
  },
  localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  TextEncoder, TextDecoder, console,
});
const source = await readFile('frontend/app.js', 'utf8');
assert.match(source, /\binit\(\);\s*$/);
vm.runInContext(source.replace(/\binit\(\);\s*$/, ''), context);
context.deployment = contract;
vm.runInContext('contractAddress = deployment', context);

async function save() {
  await writeFile(journal, JSON.stringify(run, null, 2) + '\n');
}
async function read(method, args = []) {
  const result = await sdk.readContract({ address: contract, functionName: method, args });
  return typeof result === 'string' ? JSON.parse(result) : result;
}
async function tx(label, signer, method, args = [], expected = 'Execution succeeded') {
  role = signer;
  action = label;
  if (run.outcomes[label]?.status === 'FINALIZED') {
    assert.match(run.outcomes[label].executionOutcome,
      typeof expected === 'string' ? new RegExp(`^${expected}$`) : expected, label);
    return;
  }
  const hash = run.transactions[label];
  let result;
  if (hash) {
    context.resumeItem = { hash, action: label, contract, status: 'SUBMITTED' };
    result = await vm.runInContext('trackReceipt(resumeItem)', context);
  } else {
    await vm.runInContext('connectWallet()', context);
    let submitted;
    if (method === 'configure_wallets') {
      const walletFields = ['walletReviewer', 'walletReviewer2', 'walletReviewer3',
        'walletAlternate1', 'walletAlternate2', 'walletApplicantA', 'walletApplicantB'];
      walletFields.forEach((field, index) => { element(field).value = args[index]; });
      submitted = await vm.runInContext("sendWrite('configure_wallets', walletValues(), 'Configure frozen demo wallet map')", context);
    } else {
      if (method === 'open_case' || method === 'vote' || method === 'finalize') {
        element('actionApplication').value = args[0];
        element('actionSeat').value = String(args[1] ?? 0);
      }
      if (method === 'open_case') {
        element('actionPassage').value = args[2];
        element('actionDate').value = args[3];
      }
      if (method === 'adjudicate' || method === 'close_expired') element('actionCaseId').value = args[0];
      context.actionButton = method === 'vote' ? (args[2] ? 'vote_yes' : 'vote_no') : method;
      submitted = await vm.runInContext('actionFor(actionButton)', context);
    }
    assert.equal(submitted, run.transactions[label]);
    context.submitted = submitted;
    result = await vm.runInContext('pendingTrackers.get(submitted) || walletReceipts().find(({hash}) => hash === submitted)', context);
  }
  assert.equal(result.status, 'FINALIZED', label);
  const { executionOutcome } = result;
  // StudioNet also exposes the untransformed execution reason in the leader receipt.
  const raw = await rpc('eth_getTransactionByHash', [result.hash]);
  const leader = raw.consensus_data?.leader_receipt?.[0];
  const reason = leader?.execution_result === 'ERROR' && typeof leader.result === 'string'
    ? Buffer.from(leader.result, 'base64').subarray(1).toString('utf8') : '';
  run.outcomes[label] = { status: result.status, executionOutcome, reason };
  await save();
  assert.match(executionOutcome, typeof expected === 'string' ? new RegExp(`^${expected}$`) : expected, label);
  if (expected instanceof RegExp) assert.match(reason, /wallet is not eligible for this frozen seat/, label);
  console.log(label, result.status, executionOutcome, reason);
}

const walletMap = ['reviewer', 'reviewer_two', 'reviewer_three', 'alternate_one',
  'alternate_two', 'applicant_a', 'applicant_b'].map((key) => accounts[key].address);
await tx('wallet-map', 'steward', 'configure_wallets', walletMap);
await tx('assignments', 'steward', 'open_assignments');
await tx('conflict-case', 'applicant_a', 'open_case', ['A', 0,
  "On 2026-05-23 I directly supervised the applicant's project work, approving it and signing their performance assessment.", '2026-05-23']);
await tx('timeout-case', 'applicant_b', 'open_case', ['B', 2,
  'We worked together last year but the disclosure gives no further details about our roles.', '']);
await tx('conflict-ruling', 'steward', 'adjudicate', ['1']);
const ruling = await read('get_case', ['1']);
const timeout = await read('get_case', ['2']);
assert.equal(ruling.decision, 'CONFLICT');
assert.equal(timeout.challengeCutoff - timeout.openedAt, 1800);
assert.equal(timeout.resolutionDeadline - timeout.challengeCutoff, 1800);
const until = (timeout.resolutionDeadline + 5) * 1000;
while (Date.now() < until) {
  console.log('Waiting for timeout case deadline', new Date(until).toISOString());
  await sleep(Math.min(60000, until - Date.now()));
}
await tx('timeout-vacancy', 'alternate_two', 'close_expired', ['2']);
await tx('open-ballot', 'alternate_two', 'open_ballot');
const ballot = await read('get_round');
assert.equal(ballot.applications.A.ballot[0].toLowerCase(), accounts.alternate_one.address.toLowerCase());
assert.equal(ballot.applications.B.ballot[0].toLowerCase(), accounts.reviewer.address.toLowerCase());
assert.equal(ballot.applications.B.ballot[2], '');
await tx('rejected-A', 'reviewer', 'vote', ['A', 0, 1], /^Execution rejected/);
await tx('accepted-B', 'reviewer', 'vote', ['B', 0, 1]);
await tx('accepted-A', 'alternate_one', 'vote', ['A', 0, 1]);
await tx('finalize-A', 'steward', 'finalize', ['A']);
await tx('finalize-B', 'steward', 'finalize', ['B']);
const final = await read('get_round');
assert.equal(final.phase, 'FINALIZED');
assert.equal(final.applications.A.result, 'YES');
assert.equal(final.applications.B.result, 'YES');
run.finalRound = final;
run.rulings = { conflict: ruling, timeout: await read('get_case', ['2']) };
await save();
console.log('Wallet path verified', contract);
