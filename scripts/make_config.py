"""Write frontend/config.json from the recorded live run (deploy/live.json)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
live = json.loads((ROOT / 'deploy/live.json').read_text(encoding='utf-8'))
address = live['contract']
tx = live['transactions']
out = live['outcomes']

NAMES = {'reviewer': 'Rowan Hale', 'reviewer_two': 'Ari Bello', 'reviewer_three': 'Tessa Morgan',
         'alternate_one': 'Jules Park', 'alternate_two': 'Niko Vale', 'applicant_a': 'Mara Ellis',
         'applicant_b': 'Sam Okoro', 'steward': 'Steward'}
LABELS = [
    ('deploy', 'Deploy Recusal contract'),
    ('configure-wallets', 'Freeze demonstration wallet map'),
    ('open-assignments', 'Open assignment roster'),
    ('open-supervision', 'Open Application A case 1 (goals, approvals, assessment)'),
    ('open-panel', 'Open Application A case 2 (same public panel)'),
    ('open-vague-clarified', 'Open Application A case 3 ("we worked together")'),
    ('open-vague-expiring', 'Open Application B case 4 ("we worked together")'),
    ('adjudicate-supervision', 'Adjudicate case 1: conflict, seat replaced'),
    ('adjudicate-panel', 'Adjudicate case 2: no conflict, seat kept'),
    ('adjudicate-vague-clarified', 'Adjudicate case 3: insufficient, on hold'),
    ('adjudicate-vague-expiring', 'Case 4 ruling attempt 1: model answer malformed, no consensus, no state change'),
    ('adjudicate-vague-expiring-retry1', 'Adjudicate case 4: insufficient, on hold'),
    ('clarify-vague-clarified', 'Clarify case 3 (single clarification)'),
    ('adjudicate-vague-clarified-2', 'Re-adjudicate case 3 after clarification'),
    ('close-expired', 'Close expired case 4: seat vacant'),
    ('open-ballot', 'Open ballot'),
    ('vote-rejected-former-reviewer-A', 'Former reviewer vote on A'),
    ('vote-A-alternate', 'Alternate vote on A'),
    ('vote-A-reviewer-two', 'Reviewer two vote on A'),
    ('vote-A-reviewer-three', 'Reviewer three vote on A'),
    ('vote-B-reviewer', 'Shared reviewer vote on B'),
    ('vote-B-reviewer-two', 'Reviewer two vote on B'),
    ('vote-rejected-vacant-seat-B', 'Expired reviewer vote on vacant B seat 3'),
    ('finalize-A', 'Finalize Application A'),
    ('finalize-B', 'Finalize Application B'),
]
receipts = []
for key, action in LABELS:
    if key not in tx:
        continue
    result = out.get(key, {})
    executed = result.get('executed', True)
    item = {'action': action, 'hash': tx[key], 'status': 'FINALIZED'}
    if not executed:
        item['executionOutcome'] = ('MAJORITY_DISAGREE: no consensus, contract state unchanged' if key.startswith('adjudicate')
                                    else 'REJECTED ON-CHAIN: wallet is not eligible for this frozen seat')
    receipts.append(item)

config = {
    'contractAddress': address, 'network': 'studionet', 'chainId': 61999,
    'rpcUrl': 'https://studio.genlayer.com/api', 'explorerBase': 'https://explorer-studio.genlayer.com',
    'explorerUrl': 'https://explorer-studio.genlayer.com/address/' + address,
    'explorerTxBase': 'https://explorer-studio.genlayer.com/tx/',
    'walletNames': {live['wallets'][role]: name for role, name in NAMES.items()},
    'recordedReceipts': receipts,
}
if live.get('finalRound', {}).get('phase') == 'FINALIZED':
    config['recordedRound'] = {'round': live['finalRound'], 'cases': list(live['rulings'].values())}
wallet_path = ROOT / 'deploy/wallet-path.json'
if wallet_path.is_file():
    config['walletPathProof'] = json.loads(wallet_path.read_text(encoding='utf-8'))
(ROOT / 'frontend/config.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
print('config written with', len(receipts), 'receipts for', address)
