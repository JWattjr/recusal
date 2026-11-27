const RPC = 'https://studio.genlayer.com/api';
const CHAIN_ID = '0xf22f';
const EXPLORER_BASE = 'https://explorer-studio.genlayer.com';
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
let publishedAddress = '';
let explorerUrl = '';
let explorerTxBase = '';
let contractState = null;
let contractCases = [];
let recordedReceipts = [];
let recordedRound = null;
let walletPathProof = null;
let selectedScenario = 'supervision';
let featuredCase = null;
let walletNames = {};
const pendingTrackers = new Map();
const terminalStatuses = new Set(['FINALIZED', 'CANCELED']);
let feedbackHash = '';
let submitting = false;

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function glClient(withAccount, wallet = provider) {
  const options = { chain: window.GenLayer.studionet };
  if (withAccount) Object.assign(options, { account, provider: wallet });
  return window.GenLayer.createClient(options);
}
async function readContract(method, args = [], address = contractAddress) {
  const value = await glClient(false).readContract({ address, functionName: method, args });
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
function renderFeaturedProof() {
  const proof = [
    ['Former reviewer vote on A', 'Former reviewer on Application A', 'The contract rejected the vote because that wallet no longer held A’s frozen seat.', '×'],
    ['Shared reviewer vote on B', 'Same reviewer on Application B', 'The same wallet retained its B seat and cast a vote.', '✓'],
    ['Alternate vote on A', 'Alternate on Application A', 'The promoted alternate cast a vote in A’s frozen seat.', '✓'],
  ];
  $('proofSteps').innerHTML = proof.map(([action, title, detail, mark], index) => {
    const receipt = recordedReceipts.find((entry) => entry.action === action);
    const evidence = receipt
      ? `<span class="proof-observation chain-observation">${esc(receipt.status)}${receipt.executionOutcome ? ` · ${esc(receipt.executionOutcome)}` : ''}</span> <a class="proof-receipt-link" href="${esc(explorerTxBase + receipt.hash)}" target="_blank" rel="noreferrer">Explorer transaction ↗</a>`
      : '<span class="proof-observation example-observation">Awaiting recorded StudioNet receipt</span>';
    return `<li><span class="proof-number">0${index + 1}</span><div><strong>${title}</strong>${receipt ? `<p>${detail}</p>` : ''}${evidence}</div><span class="proof-check">${receipt ? mark : '·'}</span></li>`;
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
  renderFeaturedProof();
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
function renderLive(snapshot = null) {
  const state = snapshot?.round || contractState;
  const cases = snapshot?.cases || contractCases;
  const sourceLabel = snapshot ? 'Recorded finalized round' : 'Current contract read';
  if (!state) return;
  const id = state.featuredCase;
  featuredCase = cases.find((item) => item.id === id) || cases[0] || null;
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
  const eligibleSeats = app.ballot?.length
    ? app.ballot.filter(Boolean)
    : app.seats.filter((wallet, index) => wallet && !app.holds[index] && !app.vacancies[index]);
  $('afterCount').textContent = `${eligibleSeats.length} eligible`;
  $('seatChange').textContent = conflict ? `Seat ${seat + 1} · ${fictionalName(featuredCase.replacedWallet)} → ${fictionalName(featuredCase.replacementWallet)}` : insuff ? `Seat ${seat + 1} · held pending clarification` : `Seat ${seat + 1} · ${fictionalName(app.seats[seat])} retained`;
  $('seatChangeNote').textContent = conflict ? `Conflict applies to Application ${appId} only.`
    : insuff ? 'An unresolved seat can become vacant after its resolution deadline.'
    : 'The ruling leaves this assignment eligible.';
  $('appName').textContent = app.name;
  $('rulingSource').textContent = ruling ? `${sourceLabel} · ruling v${ruling.evidenceVersion}` : sourceLabel;
  $('caseDeadlines').innerHTML = featuredCase
    ? `Case ${esc(featuredCase.id)} · Challenge cutoff ${esc(formatDeadline(featuredCase.challengeCutoff))} <span>·</span> Resolution deadline ${esc(formatDeadline(featuredCase.resolutionDeadline))}`
    : 'Each case starts a 30-minute challenge window when opened; resolution is due 30 minutes later.';
  $('caseStatus').textContent = featuredCase?.status || state.phase;
  $('modeBadge').textContent = snapshot ? 'RECORDED FINALIZED ROUND' : 'LIVE CONTRACT READ';
  const networkLabel = snapshot ? 'Recorded StudioNet round' : account ? 'StudioNet connected' : 'StudioNet read';
  $('networkState').innerHTML = `<span class="status-dot" style="background:var(--green)"></span>${networkLabel}`;
  const latestCase = [...cases].sort((a, b) => Number(b.openedAt) - Number(a.openedAt))[0];
  const deadlineSummary = latestCase
    ? `Latest case ${latestCase.id}: challenge cutoff ${formatDeadline(latestCase.challengeCutoff)}, resolution deadline ${formatDeadline(latestCase.resolutionDeadline)}.`
    : 'No case deadlines are active; a case starts its own 30-minute windows when opened.';
  $('contractReadState').textContent = snapshot
    ? 'Loading current StudioNet state'
    : `${state.phase} · ${contractAddress.slice(0, 8)}…${contractAddress.slice(-6)}`;
  $('contractReadSummary').textContent = `Round ${state.id} · ${state.policyVersion} · ${state.phase}. ${snapshot ? 'Recorded' : 'Current'} vote results: A ${state.applications.A.result}; B ${state.applications.B.result}. ${deadlineSummary}`;
  const rosterA = state.applications.A;
  const rosterB = state.applications.B;
  const conflictCase = cases.find((item) => item.appId === 'A' && item.decision === 'CONFLICT');
  $('scope-table').innerHTML = `<div class="scope-row scope-header" role="row"><span role="columnheader">Application</span><span role="columnheader">Assignment</span><span role="columnheader">Ballot result</span><span role="columnheader">Scope</span></div>
    <div class="scope-row" role="row"><span class="application-cell"><b>A</b><span>${esc(rosterA.name)}</span></span><span class="assignment-cell"><span class="replacement-name">${esc(fictionalName(rosterA.seats[0]))}</span><small>seat 1</small></span><span class="result-cell"><span class="status-label ${conflictCase ? 'conflict-label' : 'eligible-label'}">${conflictCase ? 'RECUSAL · CONFLICT' : esc(rosterA.result)}</span></span><span class="scope-cell">This application</span></div>
    <div class="scope-row" role="row"><span class="application-cell"><b>B</b><span>${esc(rosterB.name)}</span></span><span class="assignment-cell"><span>${esc(fictionalName(rosterB.seats[0]))}</span><small>seat 1</small></span><span class="result-cell"><span class="status-label eligible-label">${esc(rosterB.result)}</span></span><span class="scope-cell">Unaffected</span></div>`;
  renderFeaturedProof();
  $('scopeCaption')?.remove();
  if (contractAddress.toLowerCase() !== publishedAddress.toLowerCase()) {
    $('contractReadSummary').textContent += ' The featured receipts belong to the published demo round.';
  }
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
  if (contractState.phase === 'CHALLENGES') {
    const timestamp = Math.floor(Date.now() / 1000);
    const unresolved = contractCases.filter((item) => ['OPEN', 'NEEDS_CLARIFICATION'].includes(item.status));
    const expired = unresolved.find((item) => timestamp > item.resolutionDeadline);
    if (expired) {
      $('actionCaseId').value = expired.id;
      prompt.textContent = `Next for any wallet: close expired case ${expired.id} to mark that seat vacant.`;
      return;
    }
    const latestCutoff = Math.max(0, ...contractCases.map((item) => item.challengeCutoff));
    const latestDeadline = Math.max(0, ...contractCases.map((item) => item.resolutionDeadline));
    if (!unresolved.length && timestamp > latestCutoff && (address === contractState.steward || timestamp > latestDeadline)) {
      prompt.textContent = 'Next for this wallet: open the ballot to freeze the eligible seats.';
      return;
    }
  }
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
  const address = contractAddress;
  try {
    const state = JSON.parse(await readContract('get_round', [], address));
    const ids = JSON.parse(await readContract('get_case_ids', [], address));
    const cases = await Promise.all(ids.map(async (id) => JSON.parse(await readContract('get_case', [id], address))));
    if (address !== contractAddress) return;
    contractState = state;
    contractCases = cases;
    renderLive();
  } catch (error) {
    if (address !== contractAddress) return;
    const fallback = address.toLowerCase() === publishedAddress.toLowerCase() ? recordedRound : null;
    if (fallback) renderLive(fallback);
    $('contractReadState').textContent = 'Current StudioNet read unavailable';
    $('contractReadSummary').textContent = fallback
      ? 'The dossier shows the recorded finalized round. Its Explorer receipts remain available.'
      : `StudioNet could not load this address: ${error.message}`;
  }
}
function setFeedback(message, state = '') {
  const element = $('actionFeedback');
  element.textContent = message;
  element.dataset.state = state;
}
function walletReceipts() {
  try {
    const items = JSON.parse(localStorage.getItem('recusal.receipts') || '[]');
    return Array.isArray(items) ? items.filter((item) => /^0x[0-9a-f]{64}$/i.test(item?.hash)) : [];
  } catch {
    return [];
  }
}
function saveWalletReceipt(item) {
  const items = walletReceipts().filter(({ hash }) => hash !== item.hash);
  localStorage.setItem('recusal.receipts', JSON.stringify([...items, item].slice(-30)));
  renderReceipts();
}
function executionOutcome(receipt) {
  const consensus = receipt.result_name || receipt.resultName;
  if (consensus === 'DISAGREE' || consensus === 'MAJORITY_DISAGREE') return 'Consensus did not accept execution';
  if (receipt.txExecutionResultName === 'FINISHED_WITH_RETURN') return 'Execution succeeded';
  if (receipt.txExecutionResultName === 'FINISHED_WITH_ERROR') {
    const leader = receipt.consensus_data?.leader_receipt;
    const reason = (Array.isArray(leader) ? leader[0] : leader)?.result?.payload;
    return typeof reason === 'string' ? `Execution rejected: ${reason}` : 'Execution rejected · see Explorer for the reason';
  }
  return receipt.txExecutionResultName || 'Execution outcome unavailable';
}
async function pollReceipt(item) {
  const client = glClient(false);
  // Keep the recorded hash on timeout so reopening the page can resume its status.
  for (let attempt = 0; attempt < 100; attempt++) {
    let receipt;
    try {
      receipt = await client.getTransaction({ hash: item.hash });
    } catch {
      // The indexer may still be catching up or RPC may temporarily be unavailable.
    }
    const status = receipt?.statusName || (typeof receipt?.status === 'string' ? receipt.status : '');
    if (status && (item.status !== status || item.trackingPaused)) {
      item = { ...item, status, trackingPaused: false,
        executionOutcome: status === 'FINALIZED' ? executionOutcome(receipt) : '' };
      saveWalletReceipt(item);
      if (feedbackHash === item.hash) {
        setFeedback(`${item.action} · ${status}${item.executionOutcome ? ` · ${item.executionOutcome}` : ''}.`,
          terminalStatuses.has(status) ? (item.executionOutcome === 'Execution succeeded' ? 'success' : 'error') : 'pending');
      }
      if (terminalStatuses.has(status)) {
        if (status === 'FINALIZED' && item.contract?.toLowerCase() === contractAddress.toLowerCase()) {
          void refreshContract();
        }
        return item;
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 6000));
  }
  item = { ...item, trackingPaused: true };
  saveWalletReceipt(item);
  if (feedbackHash === item.hash) setFeedback('StudioNet hasn’t reported a final result yet. Check the recorded transaction again from the evidence ledger.', 'pending');
  return item;
}
function trackReceipt(item) {
  if (pendingTrackers.has(item.hash)) return pendingTrackers.get(item.hash);
  const tracking = pollReceipt(item).finally(() => pendingTrackers.delete(item.hash));
  pendingTrackers.set(item.hash, tracking);
  return tracking;
}
function renderReceipts() {
  const receipts = walletReceipts();
  const list = $('receiptList');
  const receiptRow = (item) => `<li class="receipt-item"><span>${esc(item.action)}<br /><span class="receipt-status">StudioNet consensus receipt · ${esc(item.status)}${item.executionOutcome ? ` · ${esc(item.executionOutcome)}` : ''}${item.fee ? ` · fee ${esc(item.fee)}` : ''}</span></span>${explorerTxBase ? `<a href="${esc(explorerTxBase + item.hash)}" target="_blank" rel="noreferrer">Explorer receipt ↗</a>` : `<code>${esc(item.hash.slice(0, 10))}…</code>`}</li>`;
  const recorded = recordedReceipts.map(receiptRow);
  if (walletPathProof) {
    $('walletPathEvidence').classList.remove('hidden');
    $('walletPathExplorerLink').href = walletPathProof.explorerUrl;
    $('walletPathReceipts').innerHTML = walletPathProof.receipts.map(receiptRow).join('');
  }
  const walletSubmissions = receipts.slice().reverse().map((item) => `<li class="receipt-item"><span>${esc(item.action)}<br /><span class="receipt-status">Browser wallet submission · ${esc(item.status || 'SUBMITTED')}${item.executionOutcome ? ` · ${esc(item.executionOutcome)}` : ''}${item.trackingPaused ? ' · awaiting finality' : ''}</span></span><span><a href="${esc((explorerTxBase || EXPLORER_BASE + '/tx/') + item.hash)}" target="_blank" rel="noreferrer">Transaction ↗</a>${!terminalStatuses.has(item.status) ? ` <button type="button" data-track-receipt="${item.hash}">Check status</button>` : ''}</span></li>`);
  list.innerHTML = [...recorded, ...walletSubmissions].join('') || '<li class="empty-record">No recorded receipts or wallet submissions yet.</li>';
  $('proofLiveState').textContent = `${recordedReceipts.length} finalized StudioNet receipt${recordedReceipts.length === 1 ? '' : 's'} · ${receipts.length} browser wallet submission${receipts.length === 1 ? '' : 's'}`;
}
async function sendWrite(method, args = [], label = method) {
  if (submitting) return;
  if (!contractAddress) throw new Error('Load a deployed contract address before sending a wallet action.');
  submitting = true;
  feedbackHash = '';
  const address = contractAddress;
  try {
    if (!account) await connectWallet();
    const chain = await provider.request({ method: 'eth_chainId' });
    if (chain.toLowerCase() !== CHAIN_ID) await connectWallet();
    if (!account || (await provider.request({ method: 'eth_chainId' })).toLowerCase() !== CHAIN_ID) throw new Error('Connect a wallet on StudioNet.');
    const from = account;
    setFeedback(`Preparing ${label} for wallet approval…`, 'pending');
    let submitted = '';
    function recordSubmission(hash) {
      if (submitted || !/^0x[0-9a-f]{64}$/i.test(hash)) return;
      submitted = hash;
      const item = { action: label, hash, account: from, contract: address, at: new Date().toISOString(), status: 'SUBMITTED' };
      feedbackHash = hash;
      saveWalletReceipt(item);
      setFeedback(`${label} submitted. Waiting for StudioNet consensus.`, 'submitted');
      void trackReceipt(item);
    }
    const wallet = provider;
    const client = glClient(true, {
      async request(request) {
        const result = await wallet.request(request);
        // Preserve the wallet's hash even if the SDK times out waiting for the envelope.
        if (request.method === 'eth_sendTransaction') recordSubmission(result);
        return result;
      },
    });
    const estimate = await client.estimateTransactionFees({});
    const fees = { distribution: estimate.distribution, feeValue: estimate.feeValue * 10n };
    try {
      const hash = await client.writeContract({ address, functionName: method, args, value: 0n, fees });
      recordSubmission(hash);
      return hash;
    } catch (error) {
      if (!submitted) throw error;
      // StudioNet uses the same hash for the envelope and the consensus record.
      // Keep the link and let the receipt tracker determine the execution result.
      return submitted;
    }
  } finally {
    submitting = false;
  }
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
  $('receiptList').addEventListener('click', (event) => {
    const hash = event.target.closest('[data-track-receipt]')?.dataset.trackReceipt;
    const item = hash && walletReceipts().find((entry) => entry.hash === hash);
    if (!item || terminalStatuses.has(item.status)) return;
    feedbackHash = item.hash;
    setFeedback(`Checking ${item.action} · ${item.status}…`, 'pending');
    void trackReceipt(item);
  });
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
    contractState = null;
    contractCases = [];
    featuredCase = null;
    localStorage.setItem('recusal.contractAddress', contractAddress);
    await refreshContract();
  });
  renderSimulation();
  renderReceipts();
  try {
    const response = await fetch('./config.json', { cache: 'no-store' });
    const config = await response.json();
    publishedAddress = config.contractAddress || '';
    contractAddress = localStorage.getItem('recusal.contractAddress') || publishedAddress;
    explorerUrl = config.explorerUrl || '';
    explorerTxBase = config.explorerTxBase || `${config.explorerBase || EXPLORER_BASE}/tx/`;
    recordedReceipts = config.recordedReceipts || [];
    recordedRound = config.recordedRound || null;
    walletPathProof = config.walletPathProof || null;
    walletNames = Object.fromEntries(Object.entries(config.walletNames || {}).map(([a, n]) => [a.toLowerCase(), n]));
    if (explorerUrl) {
      $('explorerLink').href = explorerUrl;
      $('explorerLink').textContent = 'GenLayer Explorer Contract · verified address ↗';
      $('explorerLink').classList.remove('hidden');
    }
    $('contractInput').value = contractAddress;
    if (recordedRound && contractAddress.toLowerCase() === publishedAddress.toLowerCase()) renderLive(recordedRound);
    renderFeaturedProof();
    renderReceipts();
    if (contractAddress) await refreshContract();
  } catch { /* Local file previews intentionally use the built-in policy examples. */ }
  for (const item of walletReceipts().filter(({ status }) => !terminalStatuses.has(status)).slice(-3)) {
    void trackReceipt(item);
  }
  if (window.ethereum) {
    window.ethereum.on?.('accountsChanged', (accounts) => { account = accounts[0] || ''; $('connectButton').textContent = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'; });
    window.ethereum.on?.('chainChanged', () => { if (contractAddress) refreshContract(); });
  }
  if (location.hash === '#featured-ruling') $('featured-ruling').scrollIntoView({ behavior: 'smooth' });
}

init();
