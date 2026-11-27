"""Publish the verified fields from the private StudioNet wallet-path journal."""
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'deploy/receipts/wallet-path-run.json'
OUTPUT = ROOT / 'deploy/wallet-path.json'
LABELS = {
    'wallet-path-deploy': 'Deploy wallet path verification contract',
    'wallet-map': 'Freeze wallet map',
    'assignments': 'Open assignments',
    'conflict-case': 'Open A disclosure',
    'timeout-case': 'Open unresolved B disclosure',
    'conflict-ruling': 'Record A conflict ruling',
    'timeout-vacancy': 'Close expired B seat as a vacancy',
    'open-ballot': 'Freeze the ballot',
    'rejected-A': 'Reject the former reviewer’s A vote',
    'accepted-B': 'Accept the same reviewer’s B vote',
    'accepted-A': 'Accept the alternate’s A vote',
    'finalize-A': 'Finalize A',
    'finalize-B': 'Finalize B',
}


def main():
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    assert source['network'] == 'studionet' and source['chainId'] == 61999
    address = source['contract']
    assert re.fullmatch('0x[0-9a-fA-F]{40}', address)
    final, rulings = source['finalRound'], source['rulings']
    assert final['phase'] == 'FINALIZED'
    assert rulings['conflict']['decision'] == 'CONFLICT'
    assert rulings['timeout']['status'] == 'EXPIRED_VACANT'
    app_a, app_b = (final['applications'][key] for key in ('A', 'B'))
    assert app_a['votes'][0] == app_b['votes'][0] == '1'
    assert app_a['result'] == app_b['result'] == 'YES'
    assert app_b['ballot'][2] == ''
    submitters = source['submitters']
    assert submitters['rejected-A'] == submitters['accepted-B']
    assert submitters['accepted-A'].lower() == app_a['ballot'][0].lower()
    assert submitters['accepted-B'].lower() == app_b['ballot'][0].lower()
    assert submitters['timeout-vacancy'] == submitters['open-ballot'] != source['wallets']['steward']

    receipts = []
    for key, label in LABELS.items():
        hash_value, outcome = source['transactions'][key], source['outcomes'][key]
        assert re.fullmatch('0x[0-9a-fA-F]{64}', hash_value)
        assert outcome['status'] == 'FINALIZED'
        if key == 'wallet-path-deploy':
            assert outcome['executed']
            execution = 'Execution succeeded'
        elif key == 'rejected-A':
            assert outcome['executionOutcome'].startswith('Execution rejected')
            assert 'wallet is not eligible for this frozen seat' in outcome['reason']
            execution = 'Execution rejected: wallet is not eligible for this frozen seat'
        else:
            execution = outcome['executionOutcome']
            assert execution == 'Execution succeeded'
        receipts.append({'id': key, 'action': label, 'hash': hash_value, 'status': 'FINALIZED',
                         'executionOutcome': execution})
    proof = {
        'network': 'studionet', 'chainId': 61999,
        'contractAddress': address,
        'explorerUrl': f'https://explorer-studio.genlayer.com/address/{address}',
        'receipts': receipts,
    }
    OUTPUT.write_text(json.dumps(proof, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
