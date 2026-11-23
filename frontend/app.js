const RPC = 'https://studio.genlayer.com/api';
const CHAIN_ID = '0xf22f';
const EXPLORER_BASE = 'https://explorer-studio.genlayer.com';
const SELECTOR = {
  get_round: '0xb9802e3e', get_case: '0x515ce7f5', get_case_ids: '0x858d9ffc',
  configure_wallets: '0xc5d918e3', open_assignments: '0x7f2c5e32',
  open_case: '0x700dd279', clarify: '0x34d5ba84', adjudicate: '0x2b1436c6',
  close_expired: '0x7a40181f', open_ballot: '0x1eb2181e', vote: '0x0891d358', finalize: '0x70b581ad',
};
const POLICY = 'A reviewer may not assess an applicant whose project work they directly supervised during the previous 24 months. Speaking at the same public event, without evidence of supervision, does not disqualify a reviewer.';
const DEMO = {
  panel: {
    title: 'Same public panel', app: 'A', outcome: 'NO_CONFLICT', date: '2026-05-01', status: 'Finalized ruling',
    passage: 'We spoke together on the same conference panel. The disclosure says we had no supervisory relationship.',
    relationship: 'The reviewer and applicant shared a public conference panel; the record expressly says they had no supervisory relationship.',
    explanation: 'Speaking at the same public event, without evidence of supervision, does not meet the frozen clause.',
  },
  supervision: {
    title: 'Goals, approvals, assessment', app: 'A', outcome: 'CONFLICT', date: '2026-05-23', status: 'Finalized ruling',
    passage: 'Six months before the round I set Mara’s project goals, approved her work, and signed her performance assessment.',
    relationship: 'The reviewer set the applicant’s goals, approved project work, and signed a performance assessment. Those acts establish direct supervision under the clause.',
    explanation: 'The supported date falls inside the frozen 24-month window; code applies the date comparison and records CONFLICT.',
  },
  vague: {
    title: '“We worked together”', app: 'A', outcome: 'INSUFFICIENT', date: '', status: 'Clarification required',
    passage: 'We worked together.',
    relationship: 'The record does not identify what the reviewer did or establish a usable date for the relationship.',
    explanation: 'The relationship could be relevant, but the record does not establish conduct or a usable date. The seat is on hold pending its one clarification.',
  },
};
const DEFAULT_WALLETS = {
  reviewer: '0x1111111111111111111111111111111111111111',
  reviewerTwo: '0x2222222222222222222222222222222222222222',
  reviewerThree: '0x3333333333333333333333333333333333333333',
  alternateOne: '0x4444444444444444444444444444444444444444',
  alternateTwo: '0x5555555555555555555555555555555555555555',
  applicantA: '0x6666666666666666666666666666666666666666',
  applicantB: '0x7777777777777777777777777777777777777777',
};

const $ = (id) => document.getElementById(id);
let provider = null;
let account = '';
let contractAddress = '';
let explorerUrl = '';
let explorerTxBase = '';
let contractState = null;
let contractCases = [];
let recordedReceipts = [];
let selectedScenario = 'supervision';
let featuredCase = null;
let liveReadsAvailable = false;
let walletNames = {};

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function word(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function encodeString(value) {
  const bytes = new TextEncoder().encode(String(value));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  return word(bytes.length) + padded;
}
function encodeCall(method, args = []) {
  const selector = SELECTOR[method];
  if (!selector) throw new Error(`Unknown contract method: ${method}`);
  const types = {
    configure_wallets: ['string','string','string','string','string','string','string'],
    open_assignments: [], open_case: ['string','uint','string','string'],
    clarify: ['string','string','string'], adjudicate: ['string'], close_expired: ['string'],
    open_ballot: [], vote: ['string','uint','uint'], finalize: ['string'],
  }[method] || [];
  let head = '';
  let tail = '';
  for (let i = 0; i < types.length; i++) {
    if (types[i] === 'string') {
      head += word(types.length * 32 + tail.length / 2);
      tail += encodeString(args[i]);
    } else {
      head += word(args[i]);
    }
  }
  return selector + head + tail;
}
function decodeString(hex) {
  if (!hex || hex === '0x') return '';
  const data = hex.replace(/^0x/, '');
  const offset = Number(BigInt(`0x${data.slice(0, 64)}`)) * 2;
  const length = Number(BigInt(`0x${data.slice(offset, offset + 64)}`));
  const bytesHex = data.slice(offset + 64, offset + 64 + length * 2);
  const bytes = new Uint8Array((bytesHex.match(/.{2}/g) || []).map((part) => parseInt(part, 16)));
  return new TextDecoder().decode(bytes);
}
async function rpc(method, params) {
  if (provider) return provider.request({ method, params });
  const response = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
  const result = await response.json();
  if (result.error) throw new Error(result.error.message || 'GenLayer RPC request failed');
  return result.result;
}
function glClient(withAccount) {
  const options = { chain: window.GenLayer.studionet };
  if (withAccount) Object.assign(options, { account, provider: window.ethereum });
  return window.GenLayer.createClient(options);
}
async function readContract(method, args = []) {
  const value = await glClient(false).readContract({ address: contractAddress, functionName: method, args });
  return typeof value === 'string' ? value : JSON.stringify(value);
}
async function connectWallet() {
  if (!window.ethereum) throw new Error('No EIP-1193 wallet found. You can still inspect the public demo without a wallet.');
  provider = window.ethereum;
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  account = accounts[0] || '';
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: CHAIN_ID, chainName: 'GenLayer StudioNet',
      nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: [EXPLORER_BASE] }] });
  }
  $('connectButton').textContent = `${account.slice(0, 6)}…${account.slice(-4)}`;
  $('networkState').innerHTML = '<span class="status-dot" style="background:var(--green)"></span>StudioNet connected';
  return account;
}
function shortWallet(address) { return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Vacant'; }
function formatDeadline(timestamp) {
  return Number.isFinite(Number(timestamp)) && Number(timestamp) > 0
    ? new Date(Number(timestamp) * 1000).toLocaleString()
    : 'not set';
}
function fictionalName(address) {
  const w = address?.toLowerCase();
  if (w && walletNames[w]) return walletNames[w];
  if (w === '0xdcea2e3dec12a65e46cc43e20c84ecfb519be378') return 'Rowan Hale';
  if (w === '0xf47594ea6d2606d72fdaa4372ded76c9546d6769') return 'Jules Park';
  if (w === DEFAULT_WALLETS.reviewer) return 'Rowan Hale';
  if (w === DEFAULT_WALLETS.reviewerTwo) return 'Ari Bello';
  if (w === DEFAULT_WALLETS.reviewerThree) return 'Tessa Morgan';
  if (w === DEFAULT_WALLETS.alternateOne) return 'Jules Park';
  if (w === DEFAULT_WALLETS.alternateTwo) return 'Niko Vale';
  return shortWallet(address);
}
function createSeatRows(wallets, options = {}) {
  return wallets.map((wallet, index) => {
    const removed = options.removedIndex === index;
    const promoted = options.promotedIndex === index;
    const held = options.heldIndex === index;
    const vacant = options.vacantIndex === index || !wallet;
    const classes = [removed && 'removed', promoted && 'promoted', held && 'on-hold', vacant && 'vacant'].filter(Boolean).join(' ');
    const role = vacant ? 'VACANT · NO VOTE' : held ? 'ON HOLD' : promoted ? 'ALTERNATE 1 · PROMOTED' : removed ? 'RECUSAL · CONFLICT' : `REVIEWER${index === 0 ? ' · SAME ON B' : ''}`;
    return `<li class="${classes}"><span class="seat-number">0${index + 1}</span><span class="seat-name">${esc(fictionalName(wallet))}</span><span class="seat-role">${role}</span></li>`;
  }).join('');
}
function renderSimulation() {
  const scenario = DEMO[selectedScenario];
  const conflict = scenario.outcome === 'CONFLICT';
  const insuff = scenario.outcome === 'INSUFFICIENT';
  const before = [DEFAULT_WALLETS.reviewer, DEFAULT_WALLETS.reviewerTwo, DEFAULT_WALLETS.reviewerThree];
  const after = [...before];
  if (conflict) after[0] = DEFAULT_WALLETS.alternateOne;
  if (insuff) after[0] = DEFAULT_WALLETS.reviewer;
  $('policyText').textContent = POLICY;
  $('disclosureText').textContent = `“${scenario.passage}”`;
  $('relationshipText').textContent = scenario.relationship;
  $('explanationText').textContent = scenario.explanation;
  $('evidenceVersion').textContent = selectedScenario === 'vague' ? 'Evidence v1 · clarification available' : 'Evidence v1';
  $('decisionBadge').className = `decision-badge ${conflict ? 'conflict' : insuff ? 'insufficient' : 'no-conflict'}`;
  $('decisionBadge').innerHTML = `<span class="decision-dot"></span><span>${scenario.outcome}</span>`;
  $('beforeRoster').innerHTML = createSeatRows(before, { removedIndex: conflict ? 0 : -1 });
  $('afterRoster').innerHTML = createSeatRows(after, { promotedIndex: conflict ? 0 : -1, heldIndex: insuff ? 0 : -1 });
  $('afterCount').textContent = insuff ? '2 eligible · 1 on hold' : '3 eligible';
  $('seatChange').textContent = conflict ? 'Seat 1 · Rowan Hale → Jules Park' : insuff ? 'Seat 1 · held pending clarification' : 'Seat 1 · Rowan Hale retained';
  $('seatChangeNote').textContent = conflict ? 'Conflict applies to Application A only.' : insuff ? 'No vote from a held seat; deadlines remain fixed.' : 'The public event alone does not disqualify.';
  $('appName').textContent = scenario.app === 'A' ? 'Civic cooling map' : 'Library repair grants';
  $('rulingSource').textContent = 'Illustrative record · no contract receipt';
  $('caseDeadlines').textContent = 'Example case windows · 30 minutes from opening · resolution 30 minutes later';
  $('caseStatus').textContent = scenario.status;
  $('modeBadge').textContent = 'POLICY EXAMPLE';
  $('networkState').innerHTML = '<span class="status-dot"></span>Read-only demo';
  $('walletPrompt').textContent = 'Read-only inspection is open. Connect a wallet to see its next participant action.';
  $('walletPrompt').classList.remove('connected');
  $('proofLiveState').textContent = 'No live transactions recorded';
  $('proofSteps').innerHTML = `
    <li><span class="proof-number">01</span><div><strong>Former reviewer · Application A</strong><p>${conflict ? 'Rejected: wallet is not eligible for this frozen seat.' : insuff ? 'Seat on hold: voting is unavailable while clarification is pending.' : 'Retained: the public-panel disclosure does not disqualify.'}</p><span class="proof-observation example-observation">Illustrative policy example · no live vote receipt</span></div><span class="proof-check">${conflict ? '×' : insuff ? '△' : '✓'}</span></li>
    <li><span class="proof-number">02</span><div><strong>Same reviewer · Application B</strong><p>Eligible: B’s assignment remains unchanged.</p><span class="proof-observation example-observation">Illustrative roster example · no live vote receipt</span></div><span class="proof-check">✓</span></li>
    <li><span class="proof-number">03</span><div><strong>Alternate reviewer · Application A</strong><p>${conflict ? 'Eligible: Jules Park holds the promoted seat.' : insuff ? 'Available after a conflict ruling or the published vacancy rule.' : 'No replacement is needed for this disclosure.'}</p><span class="proof-observation example-observation">Illustrative roster example · no live vote receipt</span></div><span class="proof-check">${conflict ? '✓' : '·'}</span></li>`;
  if (contractState) {
    $('contractReadState').textContent = `${contractState.phase} · ${contractAddress.slice(0, 8)}…${contractAddress.slice(-6)}`;
    $('contractReadSummary').textContent = `Round ${contractState.id} · ${contractState.policyVersion} · ${contractState.phase}. Current vote results: A ${contractState.applications.A.result}; B ${contractState.applications.B.result}. This is a current contract read, separate from the illustrative record above.`;
    $('explorerLink').classList.toggle('hidden', !explorerUrl);
    if (explorerUrl) { $('explorerLink').href = explorerUrl; $('explorerLink').textContent = 'GenLayer Explorer Contract · verified address ↗'; }
  } else {
    $('contractReadState').textContent = contractAddress ? 'Contract address set · read pending' : 'No contract address configured';
    $('contractReadSummary').textContent = 'The public dossier is showing an illustrative policy example. No current contract read is available.';
  }
  renderReceipts();
}
function renderLive() {
  const state = contractState;
  if (!state) return;
  const id = state.featuredCase;
  featuredCase = contractCases.find((item) => item.id === id) || contractCases[0] || null;
  const appId = featuredCase?.appId || 'A';
  const app = state.applications[appId];
  if (!app) return;
  const seat = featuredCase?.seat ?? 0;
  const ruling = featuredCase?.rulings?.[featuredCase.rulings.length - 1];
  const conflict = featuredCase?.decision === 'CONFLICT';
  const insuff = !featuredCase || ['INSUFFICIENT', ''].includes(featuredCase.decision) && featuredCase.status !== 'RESOLVED';
  $('policyText').textContent = featuredCase?.policyClause || state.policy;
  $('disclosureText').textContent = featuredCase?.passage ? `“${featuredCase.passage}”` : 'No disclosure case has been opened yet.';
  $('relationshipText').textContent = featuredCase?.relationship || 'A validator finding will appear here after adjudication.';
  $('explanationText').textContent = featuredCase?.explanation || 'The contract read is current; no ruling is recorded for this assignment yet.';
  $('evidenceVersion').textContent = `Evidence v${featuredCase?.evidenceVersion || 1}`;
  $('decisionBadge').className = `decision-badge ${conflict ? 'conflict' : insuff ? 'insufficient' : 'no-conflict'}`;
  $('decisionBadge').innerHTML = `<span class="decision-dot"></span><span>${esc(featuredCase?.decision || 'NO RULING')}</span>`;
  const beforeWallets = [...app.seats];
  if (featuredCase?.replacedWallet) beforeWallets[seat] = featuredCase.replacedWallet;
  $('beforeRoster').innerHTML = createSeatRows(beforeWallets, { removedIndex: conflict ? seat : -1 });
  $('afterRoster').innerHTML = createSeatRows(app.seats, { promotedIndex: conflict ? seat : -1, heldIndex: app.holds[seat] ? seat : -1, vacantIndex: app.vacancies[seat] ? seat : -1 });
  $('afterCount').textContent = `${app.ballot?.filter(Boolean).length ?? app.seats.filter(Boolean).length} eligible`;
  $('seatChange').textContent = conflict ? `Seat ${seat + 1} · ${fictionalName(featuredCase.replacedWallet)} → ${fictionalName(featuredCase.replacementWallet)}` : insuff ? `Seat ${seat + 1} · held pending clarification` : `Seat ${seat + 1} · ${fictionalName(app.seats[seat])} retained`;
  $('seatChangeNote').textContent = `Conflict applies to Application ${appId} only.`;
  $('appName').textContent = app.name;
  $('rulingSource').textContent = ruling ? `Current contract read · ruling v${ruling.evidenceVersion}` : 'Current contract read · no ruling receipt';
  $('caseDeadlines').innerHTML = featuredCase
    ? `Case ${esc(featuredCase.id)} · Challenge cutoff ${esc(formatDeadline(featuredCase.challengeCutoff))} <span>·</span> Resolution deadline ${esc(formatDeadline(featuredCase.resolutionDeadline))}`
    : 'Each case starts a 30-minute challenge window when opened; resolution is due 30 minutes later.';
  $('caseStatus').textContent = featuredCase?.status || state.phase;
  $('modeBadge').textContent = 'LIVE CONTRACT READ';
  $('networkState').innerHTML = `<span class="status-dot" style="background:var(--green)"></span>${account ? 'StudioNet connected' : 'StudioNet read'}`;
  $('contractReadState').textContent = `${state.phase} · ${contractAddress.slice(0, 8)}…${contractAddress.slice(-6)}`;
  const latestCase = [...contractCases].sort((a, b) => Number(b.openedAt) - Number(a.openedAt))[0];
  const deadlineSummary = latestCase
    ? `Latest case ${latestCase.id}: challenge cutoff ${formatDeadline(latestCase.challengeCutoff)}, resolution deadline ${formatDeadline(latestCase.resolutionDeadline)}.`
    : 'No case deadlines are active; a case starts its own 30-minute windows when opened.';
  $('contractReadSummary').textContent = `Round ${state.id} · ${state.policyVersion} · ${state.phase}. Current vote results: A ${state.applications.A.result}; B ${state.applications.B.result}. ${deadlineSummary} This current read is not a transaction receipt.`;
  const rosterA = state.applications.A;
  const rosterB = state.applications.B;
  const conflictCase = contractCases.find((item) => item.appId === 'A' && item.decision === 'CONFLICT');
  $('scope-table').innerHTML = `<div class="scope-row scope-header" role="row"><span role="columnheader">Application</span><span role="columnheader">Assignment</span><span role="columnheader">Ballot result</span><span role="columnheader">Scope</span></div>
    <div class="scope-row" role="row"><span class="application-cell"><b>A</b><span>${esc(rosterA.name)}</span></span><span class="assignment-cell"><span class="replacement-name">${esc(fictionalName(rosterA.seats[0]))}</span><small>seat 1</small></span><span class="result-cell"><span class="status-label ${conflictCase ? 'conflict-label' : 'eligible-label'}">${conflictCase ? 'RECUSAL · CONFLICT' : esc(rosterA.result)}</span></span><span class="scope-cell">This application</span></div>
    <div class="scope-row" role="row"><span class="application-cell"><b>B</b><span>${esc(rosterB.name)}</span></span><span class="assignment-cell"><span>${esc(fictionalName(rosterB.seats[0]))}</span><small>seat 1</small></span><span class="result-cell"><span class="status-label eligible-label">${esc(rosterB.result)}</span></span><span class="scope-cell">Unaffected</span></div>`;
  const sameReviewerSurvives = conflictCase && rosterB.seats[0]?.toLowerCase() === conflictCase.replacedWallet?.toLowerCase();
  const alternatePromoted = conflictCase && rosterA.seats[seat]?.toLowerCase() === conflictCase.replacementWallet?.toLowerCase();
  const proofReceipt = (action, fallback) => {
    const receipt = recordedReceipts.find((item) => item.action === action);
    if (!receipt) return `<span class="proof-observation example-observation">${fallback}</span>`;
    const outcome = receipt.executionOutcome ? ` · ${esc(receipt.executionOutcome)}` : '';
    return `<span class="proof-observation chain-observation">${esc(receipt.status)}${outcome}</span> <a class="proof-receipt-link" href="${esc(explorerTxBase + receipt.hash)}" target="_blank" rel="noreferrer">Explorer transaction ↗</a>`;
  };
  const rejected = recordedReceipts.find((item) => item.action === 'Former reviewer vote on A');
  const acceptedB = recordedReceipts.find((item) => item.action === 'Shared reviewer vote on B');
  const acceptedA = recordedReceipts.find((item) => item.action === 'Alternate vote on A');
  $('proofSteps').innerHTML = `<li><span class="proof-number">01</span><div><strong>Former reviewer · Application A</strong><p>${rejected ? `The on-chain ballot rejected the former reviewer: ${esc(rejected.executionOutcome || 'see finalized transaction receipt')}.` : conflictCase ? 'The current read confirms removal from A; the live ballot transaction is not recorded yet.' : 'No conflict ruling recorded for A yet.'}</p>${proofReceipt('Former reviewer vote on A', 'Awaiting the on-chain rejected-vote receipt.')}</div><span class="proof-check">${rejected ? '×' : conflictCase ? '✓' : '·'}</span></li>
    <li><span class="proof-number">02</span><div><strong>Same reviewer · Application B</strong><p>${esc(fictionalName(rosterB.seats[0]))} remains assigned to B${acceptedB ? ' and the on-chain vote was accepted.' : '; the live vote is not recorded yet.'}</p>${proofReceipt('Shared reviewer vote on B', sameReviewerSurvives ? 'Current contract read confirms the B assignment; awaiting its on-chain vote receipt.' : 'Current contract read')}</div><span class="proof-check">${acceptedB ? '✓' : sameReviewerSurvives ? '✓' : '·'}</span></li>
    <li><span class="proof-number">03</span><div><strong>Alternate reviewer · Application A</strong><p>${esc(fictionalName(rosterA.seats[seat]))} holds A’s promoted seat${acceptedA ? ' and the on-chain vote was accepted.' : '; the live vote is not recorded yet.'}</p>${proofReceipt('Alternate vote on A', alternatePromoted ? 'Current contract read confirms promotion; awaiting its on-chain vote receipt.' : 'Current contract read')}</div><span class="proof-check">${acceptedA ? '✓' : alternatePromoted ? '✓' : '·'}</span></li>`;
  $('scopeCaption')?.remove();
  $('modeBadge').textContent = 'LIVE CONTRACT READ';
  $('explorerLink').classList.toggle('hidden', !explorerUrl);
  if (explorerUrl) { $('explorerLink').href = explorerUrl; $('explorerLink').textContent = 'GenLayer Explorer Contract · verified address ↗'; }
  if (featuredCase?.id) $('actionCaseId').value = featuredCase.id;
  renderReceipts();
  updateWalletPrompt();
}
function updateWalletPrompt() {
  const prompt = $('walletPrompt');
  if (!account) {
    prompt.textContent = 'Read-only inspection is open. Connect a wallet to see its next participant action.';
    prompt.classList.remove('connected');
    return;
  }
  prompt.classList.add('connected');
  if (!contractState) {
    prompt.textContent = 'Wallet connected. Load a verified contract address to see eligible participant actions.';
    return;
  }
  const address = account.toLowerCase();
  if (address === contractState.steward) {
    if (contractState.phase === 'SETUP') prompt.textContent = 'Next for the steward: freeze the seven-wallet map, then open assignments.';
    else if (contractState.phase === 'CHALLENGES') prompt.textContent = 'Next for the steward: review open cases, then open the ballot after the frozen cutoff and case recovery rules allow it.';
    else if (contractState.phase === 'VOTING') prompt.textContent = 'Next for the steward: finalize each application after its votes are recorded.';
    else prompt.textContent = 'Round finalized. Inspect the current roster and recorded contract reads below.';
    return;
  }
  for (const appId of ['A', 'B']) {
    const app = contractState.applications[appId];
    for (let i = 0; i < 3; i++) {
      const sameAssignmentCase = contractCases.find((item) => item.appId === appId && item.seat === i && item.assignmentVersion === app.versions[i]);
      const canAct = app.seats[i] === address || app.applicant === address;
      if (contractState.phase === 'VOTING' && app.ballot?.[i] === address && !app.votes?.[i]) {
        $('actionApplication').value = appId;
        $('actionSeat').value = String(i);
        prompt.textContent = `Next for this wallet: cast one vote on ${appId}, seat ${i + 1}. The contract roster is frozen.`;
        return;
      }
      if (contractState.phase === 'CHALLENGES' && canAct && sameAssignmentCase?.status === 'NEEDS_CLARIFICATION') {
        $('actionApplication').value = appId;
        $('actionSeat').value = String(i);
        $('actionCaseId').value = sameAssignmentCase.id;
        prompt.textContent = `Next for this wallet: submit the single clarification for ${appId}, seat ${i + 1}, before ${formatDeadline(sameAssignmentCase.resolutionDeadline)}.`;
        return;
      }
      if (contractState.phase === 'CHALLENGES' && canAct && sameAssignmentCase?.status === 'OPEN') {
        $('actionApplication').value = appId;
        $('actionSeat').value = String(i);
        $('actionCaseId').value = sameAssignmentCase.id;
        prompt.textContent = `Next for this wallet: request the GenLayer ruling for case ${sameAssignmentCase.id}. Its frozen resolution deadline is ${formatDeadline(sameAssignmentCase.resolutionDeadline)}.`;
        return;
      }
      if (contractState.phase === 'CHALLENGES' && canAct && !sameAssignmentCase && !app.vacancies[i]) {
        $('actionApplication').value = appId;
        $('actionSeat').value = String(i);
        prompt.textContent = `Next for this wallet: open one case for ${appId}, seat ${i + 1}. The case will freeze its own 30-minute challenge and resolution windows.`;
        return;
      }
    }
  }
  prompt.textContent = 'No open action is assigned to this wallet. You can still inspect all public ruling and ballot records.';
}
async function refreshContract() {
  if (!contractAddress) return;
  try {
    const raw = await readContract('get_round');
    contractState = JSON.parse(raw);
    const ids = JSON.parse(await readContract('get_case_ids'));
    contractCases = [];
    for (const id of ids) contractCases.push(JSON.parse(await readContract('get_case', [id])));
    liveReadsAvailable = true;
    renderLive();
  } catch (error) {
    liveReadsAvailable = false;
    $('contractReadState').textContent = 'Read failed · local dossier remains available';
    $('contractReadSummary').textContent = `${error.message}. The illustrative record is not a contract read.`;
    $('modeBadge').textContent = 'POLICY EXAMPLE';
  }
}
function setFeedback(message, state = '') {
  const element = $('actionFeedback');
  element.textContent = message;
  element.dataset.state = state;
}
function renderReceipts() {
  const receipts = JSON.parse(localStorage.getItem('recusal.receipts') || '[]');
  const list = $('receiptList');
  const recorded = recordedReceipts.map((item) => `<li class="receipt-item"><span>${esc(item.action)}<br /><span class="receipt-status">StudioNet consensus receipt · ${esc(item.status)}${item.executionOutcome ? ` · ${esc(item.executionOutcome)}` : ''}${item.fee ? ` · fee ${esc(item.fee)}` : ''}</span></span>${explorerTxBase ? `<a href="${esc(explorerTxBase + item.hash)}" target="_blank" rel="noreferrer">Explorer receipt ↗</a>` : `<code>${esc(item.hash.slice(0, 10))}…</code>`}</li>`);
  const walletSubmissions = receipts.slice().reverse().map((item) => `<li class="receipt-item"><span>${esc(item.action)}<br /><span class="receipt-status">Browser wallet submission · ${esc(item.status || 'execution not attested')}${item.executionOutcome ? ` · ${esc(item.executionOutcome)}` : ''}</span></span>${explorerTxBase ? `<a href="${esc(explorerTxBase + item.hash)}" target="_blank" rel="noreferrer">Transaction ↗</a>` : `<code>${esc(item.hash.slice(0, 10))}…</code>`}</li>`);
  list.innerHTML = [...recorded, ...walletSubmissions].join('') || '<li class="empty-record">No recorded receipts or wallet submissions yet.</li>';
  $('proofLiveState').textContent = `${recordedReceipts.length} finalized StudioNet receipt${recordedReceipts.length === 1 ? '' : 's'} · ${receipts.length} browser wallet submission${receipts.length === 1 ? '' : 's'}`;
}
async function sendWrite(method, args = [], label = method) {
  if (!contractAddress) throw new Error('Load a deployed contract address before sending a wallet action.');
  if (!account) await connectWallet();
  const chain = await provider.request({ method: 'eth_chainId' });
  if (chain.toLowerCase() !== CHAIN_ID) await connectWallet();
  setFeedback(`Waiting for wallet approval: ${label}…`, 'pending');
  // The chain enforces a fee policy: estimate the fee distribution and deposit ten times the quote (unused fee is refunded).
  const client = glClient(true);
  const estimate = await client.estimateTransactionFees({});
  const fees = { distribution: estimate.distribution, feeValue: estimate.feeValue * 10n };
  const hash = await client.writeContract({ address: contractAddress, functionName: method, args, value: 0n, fees });
  const receipts = JSON.parse(localStorage.getItem('recusal.receipts') || '[]');
  receipts.push({ action: label, hash, account, at: new Date().toISOString(), status: 'submitted' });
  localStorage.setItem('recusal.receipts', JSON.stringify(receipts.slice(-30)));
  renderReceipts();
  setFeedback(`Transaction hash returned for ${label}. This records wallet submission; contract execution and consensus are not confirmed yet.`, 'submitted');
  window.setTimeout(() => refreshContract(), 3500);
  return hash;
}
function walletValues() {
  return [
    $('walletReviewer').value.trim(), $('walletReviewer2').value.trim(), $('walletReviewer3').value.trim(),
    $('walletAlternate1').value.trim(), $('walletAlternate2').value.trim(), $('walletApplicantA').value.trim(), $('walletApplicantB').value.trim(),
  ];
}
function currentCaseId() { return $('actionCaseId').value.trim() || featuredCase?.id || ''; }
async function actionFor(method) {
  const app = $('actionApplication').value;
  const seat = Number($('actionSeat').value);
  const caseId = currentCaseId();
  switch (method) {
    case 'open_assignments': return sendWrite(method, [], 'Open assignments');
    case 'open_case': return sendWrite(method, [app, seat, $('actionPassage').value.trim(), $('actionDate').value], `Open ${app} case`);
    case 'clarify': return sendWrite(method, [caseId, $('actionPassage').value.trim(), $('actionDate').value], `Clarify case ${caseId}`);
    case 'adjudicate': return sendWrite(method, [caseId], `Request ruling for case ${caseId}`);
    case 'close_expired': return sendWrite(method, [caseId], `Close expired case ${caseId}`);
    case 'open_ballot': return sendWrite(method, [], 'Open ballot');
    case 'vote_yes': return sendWrite('vote', [app, seat, 1], `Vote yes · ${app} seat ${seat + 1}`);
    case 'vote_no': return sendWrite('vote', [app, seat, 0], `Vote no · ${app} seat ${seat + 1}`);
    case 'finalize': return sendWrite(method, [app], `Finalize ${app}`);
  }
}
function setScenario(name) {
  selectedScenario = name;
  document.querySelectorAll('.scenario-row').forEach((row) => {
    const active = row.dataset.scenario === name;
    row.classList.toggle('active', active);
    row.setAttribute('aria-pressed', String(active));
  });
  renderSimulation();
}
async function init() {
  document.querySelectorAll('.scenario-row').forEach((row) => row.addEventListener('click', () => setScenario(row.dataset.scenario)));
  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', async () => {
    try { await actionFor(button.dataset.action); }
    catch (error) {
      const canceled = error.code === 4001;
      const stage = canceled ? 'Wallet approval was canceled; no transaction was submitted.' : `No transaction hash returned. Provider rejection occurred before a recorded chain submission: ${error.message}`;
      setFeedback(stage, 'error');
    }
  }));
  $('connectButton').addEventListener('click', async () => {
    try { await connectWallet(); if (contractAddress) await refreshContract(); }
    catch (error) { setFeedback(error.message, 'error'); }
  });
  $('configureWallets').addEventListener('click', async () => {
    try { await sendWrite('configure_wallets', walletValues(), 'Configure frozen demo wallet map'); }
    catch (error) { setFeedback(error.message, 'error'); }
  });
  $('saveContract').addEventListener('click', async () => {
    const value = $('contractInput').value.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) { setFeedback('Enter a 20-byte GenLayer contract address.', 'error'); return; }
    contractAddress = value;
    localStorage.setItem('recusal.contractAddress', contractAddress);
    await refreshContract();
  });
  renderSimulation();
  renderReceipts();
  try {
    const response = await fetch('./config.json', { cache: 'no-store' });
    const config = await response.json();
    contractAddress = localStorage.getItem('recusal.contractAddress') || config.contractAddress || '';
    explorerUrl = config.explorerUrl || '';
    explorerTxBase = config.explorerTxBase || `${config.explorerBase || EXPLORER_BASE}/tx/`;
    recordedReceipts = config.recordedReceipts || [];
    walletNames = Object.fromEntries(Object.entries(config.walletNames || {}).map(([a, n]) => [a.toLowerCase(), n]));
    if (explorerUrl) {
      $('explorerLink').href = explorerUrl;
      $('explorerLink').textContent = 'GenLayer Explorer Contract · verified address ↗';
      $('explorerLink').classList.remove('hidden');
    }
    $('contractInput').value = contractAddress;
    renderReceipts();
    if (contractAddress) await refreshContract();
  } catch { /* Local file previews intentionally use the built-in policy examples. */ }
  if (window.ethereum) {
    window.ethereum.on?.('accountsChanged', (accounts) => { account = accounts[0] || ''; $('connectButton').textContent = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'; });
    window.ethereum.on?.('chainChanged', () => { if (contractAddress) refreshContract(); });
  }
  if (location.hash === '#featured-ruling') $('featured-ruling').scrollIntoView({ behavior: 'smooth' });
}

init();
