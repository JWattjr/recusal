"""Generate docs/PROOF_MANIFEST.md and docs/portal.md from deploy/live.json."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
s = json.loads((ROOT / 'deploy/live.json').read_text(encoding='utf-8'))
T = s['transactions']
C = s['contract']
E = 'https://explorer-studio.genlayer.com'
wallet_path = ROOT / 'deploy/wallet-path.json'
wallet_proof = json.loads(wallet_path.read_text(encoding='utf-8')) if wallet_path.is_file() else None


def tx(key):
    return f'{E}/tx/{T[key]}'


ROWS = [
    ('Deploy Recusal contract', 'deploy'), ('Freeze demonstration wallet map', 'configure-wallets'),
    ('Open assignment roster', 'open-assignments'),
    ('Open A case 1 (goals, approvals, assessment)', 'open-supervision'),
    ('Open A case 2 (same public panel)', 'open-panel'),
    ('Open A case 3 ("we worked together")', 'open-vague-clarified'),
    ('Open B case 4 ("we worked together")', 'open-vague-expiring'),
    ('Rule case 1: CONFLICT, seat replaced by alternate 1', 'adjudicate-supervision'),
    ('Rule case 2: NO_CONFLICT, seat kept', 'adjudicate-panel'),
    ('Rule case 3: INSUFFICIENT, seat on hold', 'adjudicate-vague-clarified'),
    ('Rule case 4, attempt 1: malformed model answer, MAJORITY_DISAGREE, no state change', 'adjudicate-vague-expiring'),
    ('Rule case 4, attempt 2: INSUFFICIENT, seat on hold', 'adjudicate-vague-expiring-retry1'),
    ('Clarify case 3 (the single clarification)', 'clarify-vague-clarified'),
    ('Re-rule case 3: NO_CONFLICT, seat kept', 'adjudicate-vague-clarified-2'),
    ('Close expired case 4: seat vacant', 'close-expired'),
    ('Open ballot (eligible seats frozen)', 'open-ballot'),
    ('Former reviewer votes on A: REJECTED ON-CHAIN', 'vote-rejected-former-reviewer-A'),
    ('Alternate votes on A: accepted', 'vote-A-alternate'),
    ('Reviewer two votes on A: accepted', 'vote-A-reviewer-two'),
    ('Reviewer three votes on A: accepted', 'vote-A-reviewer-three'),
    ('Same former reviewer votes on B: accepted', 'vote-B-reviewer'),
    ('Reviewer two votes on B: accepted', 'vote-B-reviewer-two'),
    ('Reviewer three votes on B vacant seat: REJECTED ON-CHAIN', 'vote-rejected-vacant-seat-B'),
    ('Finalize A: YES (2 yes, 1 no)', 'finalize-A'),
    ('Finalize B: YES (2 yes, vacancy casts no vote)', 'finalize-B'),
]
table = '\n'.join(f'| {label} | [{T[key][:10]}…]({tx(key)}) |' for label, key in ROWS)
wallets = '\n'.join(f'- {role}: `{address}`' for role, address in s['wallets'].items())
wallet_section = ''
wallet_portal_row = ''
if wallet_proof:
    wallet_table = '\n'.join(
        f"| {item['action']} | [{item['hash']}]({E}/tx/{item['hash']}) | {item['status']} / {item['executionOutcome']} |"
        for item in wallet_proof['receipts']
    )
    wallet_section = f'''
## App wallet path

[GenLayer Explorer Contract for the verification round]({wallet_proof['explorerUrl']}) on StudioNet, chain 61999.

The verification harness executes the app's JavaScript controls and GenLayer SDK with an injected EIP-1193 provider. The provider signs the SDK's StudioNet transaction envelopes with the project's ignored test keys. The verification round uses the same contract source as the completed public demo. The app's receipt tracker observed each submitted action reach finality and distinguished execution success from rejection.

| Action | Receipt | Final result |
|---|---|---|
{wallet_table}

The same signer submitted both the rejected A vote and accepted B vote. The alternate signed the successful A vote. After the case deadline, a wallet other than the steward closed the vacant B seat and opened the ballot. Final public reads showed A and B at YES and B's expired seat empty in the frozen ballot.
'''
    wallet_portal_row = f"| GenLayer Explorer Contract | Recusal wallet path verification · StudioNet | {wallet_proof['explorerUrl']} |\n"

manifest = f'''# Proof manifest

**Status: live on StudioNet (chain 61999). Every case below ran through consensus; nothing here is simulated.** Recorded by `scripts/live_run.py` (state in `deploy/live.json`), signed by gitignored test keys, never by a person's wallet.

## Contract

- GenLayer Explorer Contract: <{E}/address/{C}>
- Runner: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
- The previous deployment (`0x59554770929B857bb3DED3AD971979505eEE8138`) is retired: it hardcoded a 2027-01-15 challenge cutoff, so no ballot could open for seven weeks. This deployment gives every case its own windows: challenge cutoff 30 minutes after opening, resolution deadline 30 minutes later.

## Featured proof: one reviewer, two applications

| Claim | Evidence |
|---|---|
| The former reviewer (Rowan Hale) is replaced on A only | Case 1 ruled `CONFLICT`; A seat 1 now holds alternate 1 (assignment version 2); B seat 1 still holds the same wallet (version 1). |
| That wallet cannot vote on A, even bypassing the app | Its vote transaction finalized with an execution error: `wallet is not eligible for this frozen seat` ([receipt]({tx('vote-rejected-former-reviewer-A')})). The rejection occurred during **execution** on StudioNet, after submission. |
| The same wallet can vote on B; the alternate can vote on A | Both votes accepted ([B]({tx('vote-B-reviewer')}), [A]({tx('vote-A-alternate')})). |
| Retained, clarified and vacated seats behave as specified | Case 2 `NO_CONFLICT` (kept). Case 3 `INSUFFICIENT`, then one clarification, then `NO_CONFLICT` (kept). Case 4 `INSUFFICIENT`, never clarified, expired: seat vacant, and the reviewer's vote on it was rejected on-chain ([receipt]({tx('vote-rejected-vacant-seat-B')})). |
| Outcome | A `YES` (votes 1, 1, 0 across seats 1 to 3), B `YES` (1, 1, vacancy). Round phase `FINALIZED`. |

## Transactions

| Action | Receipt |
|---|---|
{table}

Two receipts are expected failures by design (the rejected votes). One (case 4, attempt 1) is a consensus disagreement caused by a malformed model answer; it changed no state and was resubmitted.
{wallet_section}
## Test wallets (public addresses, fictional roles)

{wallets}

## Limits

- StudioNet now enforces a fee policy; the scripts deposit ten times the quoted fee and the unused part is refunded.
- Mocked-LLM direct tests prove contract transitions; the live run proves validator agreement on these four disclosures only.
- One operator controls all demo wallets.
'''
(ROOT / 'docs/PROOF_MANIFEST.md').write_text(manifest, encoding='utf-8')

desc = ("Recusal answers one question for a grants panel: when a disclosed relationship is challenged, may that reviewer still decide that application? "
        "GenLayer validators read the disclosure against a frozen demo policy and rule CONFLICT, NO_CONFLICT or INSUFFICIENT, citing the exact passage and the conduct it shows. "
        "Contract code then handles the 24-month date test, promotes the next alternate for that application only, and freezes the ballot. "
        "The same reviewer stays eligible on the other application, and the recused wallet's vote is rejected on-chain even if it bypasses the interface. "
        "Unresolved seats expire into a vacancy instead of locking the round. The live round has four cases, votes rejected on-chain, and a finalized tally. All people are fictional.")
outcome = ("Case 1 rules CONFLICT: the reviewer loses the A seat to alternate 1 but keeps B. That wallet's vote on A is rejected on-chain; the alternate's A vote and the reviewer's B vote are accepted. "
           "Case 2 keeps its seat, case 3 resolves after one clarification, case 4 expires into a vacancy. A and B finalize YES.")
assert len(desc) <= 1000 and len(outcome) <= 500, (len(desc), len(outcome))

portal = f'''# GenLayer Portal submission fields (not submitted)

## Contribution type
Projects

## Name
Recusal

## Tags
Primary: Dispute Resolution

Focus: Evidence Assessment

## One-liner
A grants panel can show its work: conflict rulings that change who can actually vote.

## Description
{desc}

## Demo URL
https://www.youtube.com/watch?v=kssoLo0jmxc

## Website
https://recusal.vercel.app

## Reviewer steps
1. Open https://recusal.vercel.app/#featured-ruling. The featured ruling loads without a wallet and shows LIVE CONTRACT READ.
2. Read the frozen clause beside the disclosure, the validator's relationship finding, and the before/after roster for Application A.
3. In the scope check, confirm the same reviewer is replaced on A but unchanged on B.
4. In Featured proof, open the three receipts: the former reviewer's vote rejected on-chain, the same wallet's B vote accepted, the alternate's A vote accepted.
5. In the evidence ledger, open the case-opening, ruling, clarification, expiry and finalization receipts.

## Expected outcome ({len(outcome)} of 500 characters)
{outcome}

## Evidence entries

Add each deployment in the Contract links section and as its own **GenLayer Explorer Contract** evidence entry. The Portal detects this type from each direct address URL.
| Type | Label | URL |
|---|---|---|
| GenLayer Explorer Contract | Recusal — StudioNet | {E}/address/{C} |
{wallet_portal_row}| Website | Recusal live app | https://recusal.vercel.app |
| GitHub repository | Recusal source | https://github.com/JWattjr/recusal |
| Transaction | Former reviewer's vote on A, rejected on-chain | {tx('vote-rejected-former-reviewer-A')} |
| Transaction | Conflict ruling, case 1 | {tx('adjudicate-supervision')} |
| Transaction | Same reviewer’s B vote accepted | {tx('vote-B-reviewer')} |
| Transaction | Alternate’s A vote accepted | {tx('vote-A-alternate')} |
| Transaction | Timeout vacancy | {tx('close-expired')} |

Proof manifest: docs/PROOF_MANIFEST.md. Description length: {len(desc)} of 1000 characters.
'''
(ROOT / 'docs/portal.md').write_text(portal, encoding='utf-8')
print('docs written', len(desc), len(outcome))
