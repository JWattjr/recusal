# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Delegated: single GenLayer intelligent contract and a lightweight browser frontend; chosen to keep enforcement and deployment minimal.

## Users
Grant round stewards managing a fictional review panel, and reviewers, applicants, and alternates who need to disclose, challenge, adjudicate, and vote.

## Product Purpose
Recusal resolves whether a disclosed reviewer relationship disqualifies that reviewer from one application under a frozen grant policy, and makes the resulting ballot eligibility verifiable.

## Positioning
Validators independently interpret the disclosed conduct against the frozen clause; deterministic contract code applies the date window and enforces the seat and ballot changes.

## Operating Context
The demo is a fictional microgrant round with applications A and B, three seats per application, and two ordered alternates. Fictional people and intentionally public disclosures are used for demonstration only.

## Capabilities and Constraints
Freeze policy, reference date, participants, seat and alternate order, challenge cutoff, and resolution deadline before assignments open. Challenges bind to an exact assignment and evidence version. One clarification is allowed. Ballot eligibility freezes at opening. A conflict removes a reviewer from that application only. No identity verification, token, escrow, or second contract.

## Brand Commitments
Use the name Recusal, the term “demo grant policy,” a restrained editorial style suited to a grants committee, and explicit labeling that demo participants and disclosures are fictional.

## Evidence on Hand
The supplied build brief and fictional scenario definitions in BUILD_BRIEF.md. No deployed contract, live transaction, or real participant evidence existed at project start; do not imply otherwise.

## Product Principles
- Explain each ruling with its clause, evidence passage, relationship, and reason.
- Keep recusal scoped to one application.
- Make every deadline and fallback visible and callable.
- Treat the contract as the authority for seat eligibility and vote counting.
- Label simulation, recorded receipts, and live contract reads distinctly.

## Accessibility & Inclusion
The browser experience must support keyboard navigation, visible focus, readable contrast, and narrow mobile viewports.
