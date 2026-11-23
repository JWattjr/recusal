import json
import sys
from datetime import datetime, timezone

import pytest


POLICY_PANEL = 'We spoke together on a public conference panel and expressly had no supervisory relationship.'
POLICY_WORK = "Six months before this round I set the applicant's project goals, approved their work, and signed their performance assessment."
POLICY_VAGUE = 'We worked together on a project, but the disclosure gives no further detail.'
REVIEWER = '0x1111111111111111111111111111111111111111'
ALT_ONE = '0x4444444444444444444444444444444444444444'
BASE_TIME = '2026-11-23T00:00:00Z'


def deploy_open(direct_vm, direct_deploy):
    warp(direct_vm, BASE_TIME)
    contract = direct_deploy('contracts/recusal.py')
    direct_vm.sender = direct_vm.sender
    contract.open_assignments()
    return contract


def mock_ruling(direct_vm, decision, passage, relationship, explanation):
    direct_vm.mock_llm(
        'RECUSAL_POLICY_ADJUDICATION',
        json.dumps({'decision': decision, 'passage': passage,
                    'relationship': relationship, 'explanation': explanation}),
    )


def get_round(contract):
    return json.loads(contract.get_round())


def warp(direct_vm, timestamp):
    direct_vm.warp(timestamp)
    # Current gltest Windows direct mode refreshes sender but not message_raw datetime.
    genlayer_gl = sys.modules.get('genlayer.gl')
    if genlayer_gl is not None:
        genlayer_gl.message_raw['datetime'] = timestamp


def warp_seconds(direct_vm, timestamp):
    warp(direct_vm, datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace('+00:00', 'Z'))


def open_case(contract, app_id, passage, relationship_date):
    return contract.open_case(app_id, 0, passage, relationship_date)


def test_public_event_keeps_seat_and_records_explainable_ruling(direct_vm, direct_deploy):
    contract = deploy_open(direct_vm, direct_deploy)
    case_id = open_case(contract, 'A', POLICY_PANEL, '2026-05-01')
    mock_ruling(direct_vm, 'NO_CONFLICT', POLICY_PANEL,
                'The reviewer and applicant shared a public conference panel.',
                'The disclosure expressly says there was no supervision.')

    contract.adjudicate(case_id)

    case = json.loads(contract.get_case(case_id))
    state = get_round(contract)
    assert case['decision'] == 'NO_CONFLICT'
    assert case['policyClause'] == state['policy']
    assert case['evidenceVersion'] == 1
    assert case['passage'] == POLICY_PANEL
    assert 'public conference panel' in case['relationship']
    assert state['applications']['A']['seats'][0] == REVIEWER
    assert state['applications']['A']['holds'][0] is False


def test_conflict_replaces_only_application_a_and_scoped_vote_proof(direct_vm, direct_deploy):
    contract = deploy_open(direct_vm, direct_deploy)
    case_id = open_case(contract, 'A', POLICY_WORK, '2026-05-23')
    mock_ruling(direct_vm, 'CONFLICT', POLICY_WORK,
                'The reviewer set goals, approved work, and signed the applicant performance assessment.',
                'Those acts establish direct supervision under the clause.')
    contract.adjudicate(case_id)

    state = get_round(contract)
    assert state['applications']['A']['seats'][0] == ALT_ONE
    assert state['applications']['B']['seats'][0] == REVIEWER
    assert json.loads(contract.get_case(case_id))['decision'] == 'CONFLICT'

    case = json.loads(contract.get_case(case_id))
    warp_seconds(direct_vm, case['challengeCutoff'] + 1)
    contract.open_ballot()
    with direct_vm.prank(REVIEWER):
        with direct_vm.expect_revert('wallet is not eligible for this frozen seat'):
            contract.vote('A', 0, 1)
    with direct_vm.prank(REVIEWER):
        contract.vote('B', 0, 1)
    with direct_vm.prank(ALT_ONE):
        contract.vote('A', 0, 1)
    with direct_vm.prank(REVIEWER):
        with direct_vm.expect_revert('one vote per occupied seat'):
            contract.vote('B', 0, 0)
    with direct_vm.prank('0x2222222222222222222222222222222222222222'):
        contract.vote('A', 1, 1)
    contract.finalize('A')
    with direct_vm.prank('0x2222222222222222222222222222222222222222'):
        with direct_vm.expect_revert('this application ballot is finalized'):
            contract.vote('A', 2, 1)

    state = get_round(contract)
    assert state['applications']['A']['votes'][0] == '1'
    assert state['applications']['B']['votes'][0] == '1'
    assert state['applications']['A']['result'] == 'YES'
    with direct_vm.expect_revert('case is not ready for adjudication'):
        contract.adjudicate(case_id)


def test_missing_date_is_insufficient_then_one_clarification_can_resolve(direct_vm, direct_deploy):
    contract = deploy_open(direct_vm, direct_deploy)
    case_id = open_case(contract, 'A', POLICY_WORK, '')
    mock_ruling(direct_vm, 'CONFLICT', POLICY_WORK,
                'The reviewer set goals, approved work, and signed the applicant performance assessment.',
                'The conduct is direct supervision.')
    contract.adjudicate(case_id)

    case = json.loads(contract.get_case(case_id))
    assert case['decision'] == 'INSUFFICIENT'
    assert case['status'] == 'NEEDS_CLARIFICATION'
    assert get_round(contract)['applications']['A']['holds'][0] is True

    with pytest.raises(Exception):
        open_case(contract, 'A', POLICY_WORK, '2026-05-23')
    contract.clarify(case_id, POLICY_WORK, '2026-05-23')
    clarified = json.loads(contract.get_case(case_id))
    assert clarified['openedAt'] == case['openedAt']
    assert clarified['challengeCutoff'] == case['challengeCutoff']
    assert clarified['resolutionDeadline'] == case['resolutionDeadline']
    mock_ruling(direct_vm, 'CONFLICT', POLICY_WORK,
                'The reviewer set goals, approved work, and signed the applicant performance assessment.',
                'The conduct is direct supervision.')
    contract.adjudicate(case_id)
    case = json.loads(contract.get_case(case_id))
    assert case['evidenceVersion'] == 2
    assert case['clarificationUsed'] is True
    assert case['decision'] == 'CONFLICT'
    with direct_vm.expect_revert('case is not awaiting clarification'):
        contract.clarify(case_id, POLICY_WORK, '2026-05-23')


def test_duplicate_case_and_unauthorized_configuration_are_rejected(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy('contracts/recusal.py')
    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert('steward only'):
            contract.configure_wallets(REVIEWER, REVIEWER, REVIEWER, ALT_ONE, ALT_ONE, REVIEWER, REVIEWER)
    with direct_vm.expect_revert('reviewers, alternates, and applicants must have distinct wallets'):
        contract.configure_wallets(REVIEWER, REVIEWER, REVIEWER, ALT_ONE, ALT_ONE,
                                   '0x6666666666666666666666666666666666666666',
                                   '0x7777777777777777777777777777777777777777')

    contract.open_assignments()
    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert('named participant or steward only'):
            open_case(contract, 'A', POLICY_PANEL, '2026-05-01')
    open_case(contract, 'A', POLICY_PANEL, '2026-05-01')
    with direct_vm.expect_revert('a case already exists for this assignment version'):
        open_case(contract, 'A', POLICY_PANEL, '2026-05-01')


def test_steward_freezes_shared_reviewer_and_ordered_alternates(direct_vm, direct_deploy):
    contract = direct_deploy('contracts/recusal.py')
    wallets = [f'0x{number:040x}' for number in range(1, 8)]
    contract.configure_wallets(*wallets)
    state = get_round(contract)
    assert state['applications']['A']['seats'][0] == wallets[0]
    assert state['applications']['B']['seats'][0] == wallets[0]
    assert state['applications']['A']['alternates'] == wallets[3:5]
    contract.open_assignments()
    with direct_vm.expect_revert('wallets are frozen after assignments open'):
        contract.configure_wallets(*wallets)


def test_per_case_windows_are_fixed_and_expired_seats_become_vacant(direct_vm, direct_deploy):
    contract = deploy_open(direct_vm, direct_deploy)
    case_id = open_case(contract, 'A', POLICY_VAGUE, '')
    first = json.loads(contract.get_case(case_id))
    assert first['challengeCutoff'] == first['openedAt'] + 30 * 60
    assert first['resolutionDeadline'] == first['challengeCutoff'] + 30 * 60
    expired_id = contract.open_case('B', 0, POLICY_VAGUE, '')
    expired = json.loads(contract.get_case(expired_id))
    assert expired['resolutionDeadline'] == first['resolutionDeadline']
    warp_seconds(direct_vm, first['openedAt'] + 31 * 60)
    late_id = contract.open_case('A', 1, POLICY_VAGUE, '')
    second = json.loads(contract.get_case(late_id))
    assert second['openedAt'] > first['openedAt']
    assert second['challengeCutoff'] == second['openedAt'] + 30 * 60
    assert second['resolutionDeadline'] == second['challengeCutoff'] + 30 * 60
    assert json.loads(contract.get_case(case_id))['resolutionDeadline'] == first['resolutionDeadline']
    warp_seconds(direct_vm, first['resolutionDeadline'])
    mock_ruling(direct_vm, 'INSUFFICIENT', POLICY_VAGUE,
                'The parties report working together but do not describe the conduct or a usable date.',
                'The record does not establish the conduct or timing needed to apply the clause.')
    contract.adjudicate(case_id)
    assert json.loads(contract.get_case(case_id))['status'] == 'NEEDS_CLARIFICATION'

    warp_seconds(direct_vm, first['resolutionDeadline'] + 1)
    with direct_vm.expect_revert('resolution deadline passed'):
        contract.adjudicate(expired_id)
    with direct_vm.expect_revert('resolution deadline has not passed'):
        contract.close_expired(late_id)
    contract.close_expired(case_id)
    contract.close_expired(expired_id)
    with direct_vm.expect_revert('a case challenge cutoff has not passed'):
        contract.open_ballot()
    warp_seconds(direct_vm, second['challengeCutoff'] + 1)
    with direct_vm.expect_revert('resolve or close every expired case before opening the ballot'):
        contract.open_ballot()
    warp_seconds(direct_vm, second['resolutionDeadline'] + 1)
    with direct_vm.prank('0x8888888888888888888888888888888888888888'):
        contract.close_expired(late_id)
        contract.open_ballot()
    state = get_round(contract)
    assert state['applications']['A']['seats'][0] == ''
    assert state['applications']['A']['vacancies'][0] is True
    assert state['applications']['A']['holds'][0] is False
    assert state['phase'] == 'VOTING'
    with direct_vm.expect_revert('case is not ready for adjudication'):
        contract.adjudicate(case_id)


def test_ballot_cannot_open_before_challenge_cutoff(direct_vm, direct_deploy):
    contract = deploy_open(direct_vm, direct_deploy)
    case_id = open_case(contract, 'A', POLICY_PANEL, '2026-05-01')
    mock_ruling(direct_vm, 'NO_CONFLICT', POLICY_PANEL,
                'A public conference panel without supervision.',
                'The disclosure does not establish the conduct prohibited by the clause.')
    contract.adjudicate(case_id)
    case = json.loads(contract.get_case(case_id))
    warp_seconds(direct_vm, case['challengeCutoff'])
    with direct_vm.expect_revert('a case challenge cutoff has not passed'):
        contract.open_ballot()
    warp_seconds(direct_vm, case['challengeCutoff'] + 1)
    contract.open_ballot()


def test_supported_date_boundary_is_inclusive(direct_vm, direct_deploy):
    contract = deploy_open(direct_vm, direct_deploy)
    case_id = open_case(contract, 'A', POLICY_WORK, '2024-11-23')
    mock_ruling(direct_vm, 'CONFLICT', POLICY_WORK,
                'The reviewer set goals, approved work, and signed the applicant performance assessment.',
                'The conduct is direct supervision.')
    contract.adjudicate(case_id)
    assert json.loads(contract.get_case(case_id))['decision'] == 'CONFLICT'


def test_conduct_outside_the_24_month_window_is_not_a_conflict(direct_vm, direct_deploy):
    contract = deploy_open(direct_vm, direct_deploy)
    case_id = open_case(contract, 'A', POLICY_WORK, '2024-11-22')
    mock_ruling(direct_vm, 'CONFLICT', POLICY_WORK,
                'The reviewer set goals, approved work, and signed the applicant performance assessment.',
                'The conduct establishes direct supervision.')
    contract.adjudicate(case_id)
    case = json.loads(contract.get_case(case_id))
    assert case['decision'] == 'NO_CONFLICT'
    assert 'before the frozen 24-month window' in case['explanation']


def test_alternate_exhaustion_leaves_an_explicit_vacancy(direct_vm, direct_deploy):
    contract = deploy_open(direct_vm, direct_deploy)
    for seat, passage, relationship_date in [
        (0, POLICY_WORK, '2026-05-23'),
        (1, POLICY_WORK, '2026-05-23'),
        (2, POLICY_WORK, '2026-05-23'),
    ]:
        case_id = contract.open_case('A', seat, passage, relationship_date)
        mock_ruling(direct_vm, 'CONFLICT', passage,
                    'The reviewer directly supervised the applicant work and signed the assessment.',
                    'The conduct is direct supervision within the frozen window.')
        contract.adjudicate(case_id)

    app = get_round(contract)['applications']['A']
    assert app['seats'][0] == ALT_ONE
    assert app['seats'][1] == '0x5555555555555555555555555555555555555555'
    assert app['seats'][2] == ''
    assert app['vacancies'][2] is True
