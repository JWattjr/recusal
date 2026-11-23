"""Full-consensus semantic cases; run only against configured StudioNet."""
import json

import pytest
from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded


@pytest.mark.slow
@pytest.mark.parametrize(('passage', 'relationship_date', 'decision'), [
    ('We spoke together on the same conference panel and expressly had no supervisory relationship.',
     '2026-05-01', 'NO_CONFLICT'),
    ("Six months before the round I set the applicant's project goals, approved their work, and signed their performance assessment.",
     '2026-05-23', 'CONFLICT'),
    ('We worked together.', '', 'INSUFFICIENT'),
])
def test_semantic_case_is_independently_ruled_on_studionet(passage, relationship_date, decision):
    factory = get_contract_factory('Recusal')
    contract = factory.deploy(args=[])

    opened = contract.open_assignments(args=[]).transact()
    assert tx_execution_succeeded(opened)
    challenged = contract.open_case(args=['A', 0, passage, relationship_date]).transact()
    assert tx_execution_succeeded(challenged)
    ids = json.loads(contract.get_case_ids(args=[]).call())
    case_id = ids[-1]
    ruling = contract.adjudicate(args=[case_id]).transact()
    assert tx_execution_succeeded(ruling)

    case = json.loads(contract.get_case(args=[case_id]).call())
    assert case['decision'] == decision
    latest = case['rulings'][-1]
    assert latest['policyClause'] == case['policyClause']
    assert latest['evidenceVersion'] == 1
    if decision != 'INSUFFICIENT':
        assert latest['disclosurePassage'] in passage
        assert latest['relationship']
    print(json.dumps({'caseId': case_id, 'decision': decision,
                      'challengeTx': getattr(challenged, 'transaction_hash', None),
                      'rulingTx': getattr(ruling, 'transaction_hash', None),
                      'ruling': latest}, sort_keys=True))
