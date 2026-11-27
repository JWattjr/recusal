"""Resumable StudioNet run of the featured Recusal case, driven by the ignored .test-wallets.json keys.

Every submitted hash is stored in deploy/live.json before polling, so a rerun resumes instead of resending.
"""
import json
import sys
import time
from pathlib import Path

import requests
from eth_account import Account
from genlayer_py import create_client, studionet
from genlayer_py.provider import provider
from genlayer_py.types import TransactionHashVariant

ROOT = Path(__file__).resolve().parent.parent
LIVE = ROOT / 'deploy/live.json'
RPC = 'https://studio.genlayer.com/api'
UA = {'User-Agent': 'Mozilla/5.0 Recusal/1.0'}

_post = provider.requests.post


def browser_post(url, **kwargs):
    kwargs['headers'] = {**kwargs.get('headers', {}), **UA}
    kwargs.setdefault('timeout', 45)
    method = kwargs.get('json', {}).get('method', '')
    safe = method.startswith(('eth_get', 'gen_get', 'sim_get')) or method in ('eth_chainId', 'gen_call')
    for attempt in range(4 if safe else 1):
        try:
            response = _post(url, **kwargs)
            if response.status_code not in (429, 502, 503, 504) or not safe or attempt == 3:
                return response
        except provider.requests.exceptions.RequestException:
            if not safe or attempt == 3:
                raise
        time.sleep(5 * (attempt + 1))


provider.requests.post = browser_post

WALLETS = json.loads((ROOT / '.test-wallets.json').read_text(encoding='utf-8'))['accounts']
ACCOUNTS = {role: Account.from_key(w['privateKey']) for role, w in WALLETS.items()}
ADDR = {role: a.address for role, a in ACCOUNTS.items()}

if LIVE.exists():
    STATE = json.loads(LIVE.read_text(encoding='utf-8'))
else:
    STATE = {'network': 'studionet', 'chainId': 61999, 'wallets': ADDR, 'transactions': {}, 'outcomes': {}}


def save():
    temp = LIVE.with_suffix('.tmp')
    temp.write_text(json.dumps(STATE, indent=2), encoding='utf-8')
    temp.replace(LIVE)


def client(role):
    return create_client(chain=studionet, account=ACCOUNTS[role])


def fund():
    for role, address in ADDR.items():
        key = 'fund-' + role
        if key in STATE['transactions']:
            continue
        reply = requests.post(RPC, json={'jsonrpc': '2.0', 'id': 1, 'method': 'sim_fundAccount',
                                         'params': [address, 5 * 10 ** 17]}, headers=UA, timeout=45).json()
        STATE['transactions'][key] = str(reply.get('result', reply))
        save()
        print(key, STATE['transactions'][key][:20], flush=True)
        time.sleep(3)


def receipt(hash_value, label, poll=10, attempts=400):
    target = ROOT / 'deploy/receipts' / (label + '.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(attempts):
        result = client('steward').provider.make_request('eth_getTransactionByHash', [hash_value])['result']
        status = result.get('status_name', result.get('status')) if result else None
        if result and status in ('CANCELED', 8, '8', 'FINALIZED', 7, '7'):
            target.write_text(json.dumps(result, indent=2), encoding='utf-8')
            return result
        if attempt % 6 == 0:
            print(label, status or 'SUBMITTED', flush=True)
        time.sleep(poll)
    raise RuntimeError('Still pending; rerun to resume ' + hash_value)


def succeeded(result):
    leader = ((result.get('consensus_data') or {}).get('leader_receipt') or [{}])[0]
    executed = result.get('txExecutionResultName', leader.get('execution_result')) in ('SUCCESS', 'FINISHED_WITH_RETURN')
    return result.get('status_name', result.get('status')) in ('FINALIZED', 7, '7') and executed \
        and result.get('result_name') not in ('DISAGREE', 'MAJORITY_DISAGREE')


def tx(label, role, method=None, args=None, code=None, expect_error=False, heavy=False):
    if label not in STATE['transactions']:
        instance = client(role)
        # The chain now enforces a fee policy; estimate a full distribution. Judgment calls get 4x headroom.
        options = {'leaderTimeunitsAllocation': 300, 'validatorTimeunitsAllocation': 600,
                   'executionBudgetPerRound': 78852000000000 * 10} if heavy else None
        fees = dict(instance.estimate_transaction_fees(options=options))
        # The chain rejects the bare estimate with InsufficientFees; ten times the quoted deposit is accepted (unused fee is refunded).
        fees['feeValue'] = fees['fee_value'] = fees['feeValue'] * 10
        time.sleep(2)
        handle = (instance.deploy_contract(code, args=args or [], fees=fees) if code is not None
                  else instance.write_contract(STATE['contract'], method, args=args or [], fees=fees))
        value = handle.hex() if hasattr(handle, 'hex') else str(handle)
        STATE['transactions'][label] = value if value.startswith('0x') else '0x' + value
        STATE.setdefault('submitters', {})[label] = ADDR[role]
        save()
        print(label, 'SUBMITTED', STATE['transactions'][label], flush=True)
    result = receipt(STATE['transactions'][label], label)
    ok = succeeded(result)
    STATE['outcomes'][label] = {'executed': ok, 'status': str(result.get('status_name', result.get('status')))}
    save()
    if ok == expect_error:
        raise RuntimeError(label + (' unexpectedly executed' if expect_error else ' failed to execute'))
    print(label, 'FINALIZED', 'ok' if ok else 'rejected-as-expected', flush=True)
    return result


def adjudicate(label, case_id):
    """A judgment whose leader returns a malformed LLM answer ends MAJORITY_DISAGREE with no state change; resubmit."""
    for attempt in range(4):
        name = label if attempt == 0 else label + '-retry' + str(attempt)
        try:
            return tx(name, 'steward', 'adjudicate', [case_id], heavy=True)
        except RuntimeError as error:
            print(name, 'did not execute; will retry', error, flush=True)
    raise RuntimeError(label + ' failed four times')


def read(method, args=None):
    value = client('steward').read_contract(STATE['contract'], method, args=args or [],
                                             transaction_hash_variant=TransactionHashVariant.LATEST_FINAL)
    time.sleep(3)
    return json.loads(value) if isinstance(value, str) and value.startswith(('{', '[')) else value


CASES = [
    ('supervision', 'A', 0, 'applicant_a',
     "Six months before the round I set the applicant's project goals, approved their work, and signed their performance assessment.",
     '2026-05-23'),
    ('panel', 'A', 1, 'steward',
     'We spoke together on the same conference panel and expressly had no supervisory relationship.',
     '2026-05-01'),
    ('vague-clarified', 'A', 2, 'steward', 'We worked together last year.', ''),
    ('vague-expiring', 'B', 2, 'steward', 'We worked together last year.', ''),
]
CLARIFICATION = ('I reviewed one pull request in the same shared repository as an ordinary peer. I never set goals, '
                 'approved work, or assessed their performance; we had no supervisory relationship.')


def deploy_if_needed(label):
    if 'contract' not in STATE:
        code = (ROOT / 'contracts/recusal.py').read_text(encoding='utf-8')
        if not code.startswith('# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'):
            raise RuntimeError('runner header changed')
        result = tx(label, 'steward', code=code, heavy=True)
        STATE['contract'] = (result.get('data') or {}).get('contract_address') or result.get('to_address') or result.get('recipient')
        if not STATE['contract']:
            raise RuntimeError('no contract address in deployment receipt')
        save()
    print('contract', STATE['contract'])


def prepare_wallet_path():
    global LIVE, STATE
    LIVE = ROOT / 'deploy/receipts/wallet-path-run.json'
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    if LIVE.exists():
        STATE = json.loads(LIVE.read_text(encoding='utf-8'))
    else:
        STATE = {'network': 'studionet', 'chainId': 61999, 'wallets': ADDR, 'transactions': {}, 'outcomes': {}}
    if STATE['wallets'] != ADDR:
        raise RuntimeError('This verification round belongs to a different test wallet map.')
    deploy_if_needed('wallet-path-deploy')


def main():
    if sys.argv[1:] == ['--prepare-wallet-path']:
        prepare_wallet_path()
        return
    fund()
    deploy_if_needed('deploy')
    tx('configure-wallets', 'steward', 'configure_wallets',
       [ADDR['reviewer'], ADDR['reviewer_two'], ADDR['reviewer_three'], ADDR['alternate_one'],
        ADDR['alternate_two'], ADDR['applicant_a'], ADDR['applicant_b']])
    tx('open-assignments', 'steward', 'open_assignments')
    ids = {}
    for name, app, seat, role, passage, date in CASES:
        tx('open-' + name, role, 'open_case', [app, seat, passage, date])
        if name not in STATE.setdefault('caseIds', {}):
            STATE['caseIds'][name] = str(len(read('get_case_ids')))
            save()
    for name, *_ in CASES:
        adjudicate('adjudicate-' + name, STATE['caseIds'][name])
    for name, *_ in CASES:
        STATE.setdefault('rulings', {})[name] = read('get_case', [STATE['caseIds'][name]])
    save()
    clarified = STATE['caseIds']['vague-clarified']
    if STATE['rulings']['vague-clarified']['status'] == 'NEEDS_CLARIFICATION':
        tx('clarify-vague-clarified', 'steward', 'clarify', [clarified, CLARIFICATION, '2026-03-01'])
        adjudicate('adjudicate-vague-clarified-2', clarified)
        STATE['rulings']['vague-clarified'] = read('get_case', [clarified])
        save()
    expiring = STATE['caseIds']['vague-expiring']
    case = read('get_case', [expiring])
    wait = case['resolutionDeadline'] - int(time.time()) + 90
    if case['status'] != 'EXPIRED_VACANT':
        while wait > 0:
            print('waiting for resolution deadline, seconds left', wait, flush=True)
            time.sleep(min(wait, 240))
            wait = case['resolutionDeadline'] - int(time.time()) + 90
        tx('close-expired', 'steward', 'close_expired', [expiring])
    STATE['rulings']['vague-expiring'] = read('get_case', [expiring])
    tx('open-ballot', 'steward', 'open_ballot')
    STATE['roundAtBallot'] = read('get_round')
    save()
    tx('vote-rejected-former-reviewer-A', 'reviewer', 'vote', ['A', 0, 1], expect_error=True)
    tx('vote-A-alternate', 'alternate_one', 'vote', ['A', 0, 1])
    tx('vote-A-reviewer-two', 'reviewer_two', 'vote', ['A', 1, 1])
    tx('vote-A-reviewer-three', 'reviewer_three', 'vote', ['A', 2, 0])
    tx('vote-B-reviewer', 'reviewer', 'vote', ['B', 0, 1])
    tx('vote-B-reviewer-two', 'reviewer_two', 'vote', ['B', 1, 1])
    tx('vote-rejected-vacant-seat-B', 'reviewer_three', 'vote', ['B', 2, 1], expect_error=True)
    tx('finalize-A', 'steward', 'finalize', ['A'])
    tx('finalize-B', 'steward', 'finalize', ['B'])
    STATE['finalRound'] = read('get_round')
    save()
    print('DONE', STATE['contract'])


if __name__ == '__main__':
    main()
