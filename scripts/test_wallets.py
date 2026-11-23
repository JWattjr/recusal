"""Create or list throwaway StudioNet identities kept outside version control."""
import json
import sys
from pathlib import Path

from eth_account import Account


PATH = Path(__file__).resolve().parents[1] / '.test-wallets.json'
ROLES = (
    'steward', 'reviewer', 'reviewer_two', 'reviewer_three',
    'alternate_one', 'alternate_two', 'applicant_a', 'applicant_b',
)


def load_or_create():
    if PATH.exists():
        data = json.loads(PATH.read_text(encoding='utf-8'))
        if set(data.get('accounts', {})) != set(ROLES):
            raise SystemExit('Existing .test-wallets.json has an unexpected account set; refusing to overwrite it.')
        return data
    accounts = {}
    for role in ROLES:
        account = Account.create()
        accounts[role] = {
            'address': account.address,
            'privateKey': account.key.hex(),
        }
    data = {'network': 'studionet', 'chainId': 61999, 'accounts': accounts}
    PATH.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    return data


if __name__ == '__main__':
    wallets = load_or_create()['accounts']
    for role in ROLES:
        print(f"{role}: {wallets[role]['address']}")
