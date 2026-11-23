Build Recusal, a complete GenLayer application for resolving conflicts of interest on a grants review panel. Work in C:\Users\User\Desktop\Genlayer apps\recusal. Start building now and carry the project through contracts, frontend, tests, testnet deployment, live verification, and a Portal-ready evidence package.

You own routine product, design, and engineering decisions. The defaults below settle the important ones. If an unspecified choice is reversible, choose the smallest option that completes the workflow and continue. Record consequential assumptions in the final handoff. Do not pause for design approval, give me a plan and stop, or ask me to choose between libraries. If an external action requires a credential or permission you do not have, complete everything independent of it first. Report the exact remaining blocker once.

What to build

Recusal answers one question: when a disclosed relationship is challenged under the rules for a grants round, may that reviewer still decide that application? The product is complete when a steward can inspect the relationship, see GenLayer’s ruling, and verify that it changed who can actually vote.

Use a fictional microgrant round with two applications, three voting seats per application, and two ordered alternates. Use fictional names and intentionally public demo disclosures. Call the rule a demo grant policy. Do not present it as an official conference policy or collect confidential disclosures.

Freeze this policy before assignments open: “A reviewer may not assess an applicant whose project work they directly supervised during the previous 24 months. Speaking at the same public event, without evidence of supervision, does not disqualify a reviewer.” Freeze the reference date, application roster, reviewers, alternates, seat order, deadlines, and policy version. Seed these contrasting cases:

- A reviewer and applicant spoke on the same conference panel. The record expressly says they had no supervisory relationship. The reviewer keeps the seat.
- A reviewer set the applicant’s project goals, approved their work, and signed their performance assessment six months before the round. The evidence never uses the word “supervisor.” The reviewer loses the seat.
- A disclosure says only “we worked together.” The evidence is insufficient. The seat goes on hold pending clarification.

Contract behavior

1. The organizer sets up the round. Named participants can disclose a relationship or challenge an assignment. Bind every challenge to the exact round, application, seat, assignment version, policy, and evidence. Freeze those inputs for adjudication. Use caller authorization in the contract itself.
2. GenLayer validators independently assess whether the documented activity satisfies the frozen clause. Return CONFLICT, NO_CONFLICT, or INSUFFICIENT with verifiable references to the submitted evidence. Validators assess the substance. Code handles dates, permissions, replacement order, and ballot counting.
3. An open challenge suspends voting for that seat. NO_CONFLICT restores the assignment. CONFLICT permanently disqualifies that reviewer for that application and promotes the first eligible alternate under the frozen order. A reviewer cannot occupy two seats for the same application. An exhausted alternate list leaves an explicit vacancy.
4. INSUFFICIENT allows one bounded clarification creating a new evidence version. Give every pending or unresolved case a documented deadline and a callable recovery path. An expired unresolved seat is vacant and contributes no vote. Do not let a stalled judgment lock the entire round forever. A delayed or duplicate callback must never change a newer assignment.
5. Keep the voting lifecycle simple: assignments and challenges close before voting opens. Freeze the eligible seat list at that transition. Once voting starts, the contract accepts at most one vote per occupied seat from its current wallet. The former reviewer’s address must be rejected even if it bypasses the frontend. Freeze a simple outcome rule and disclose how vacancies and ties are handled. Count votes deterministically.
6. Use the fewest contracts needed to enforce these rules. Avoid tokens, escrow, simulated monetary rewards, and a general-purpose DAO platform.

Product experience

Build a usable, accessible frontend with a live read-only entry point and wallet-backed participant actions. The landing view should open directly onto the featured round. Show an application’s panel before and after a ruling, the relevant policy clause beside the disclosure, the current seat holder, and the contract decision that changed the assignment. Show a clear next action for the connected wallet. Make clarification, replacement, expiry, opening the ballot, voting, and finalization reachable from the interface whenever the state allows them.

Use a restrained editorial style suited to a grants committee. Give the panel roster and case comparison most of the screen. Design for both desktop and mobile. Distinguish wallet submission, pending consensus, finalized result, and failed execution. An unsigned visitor should be able to inspect the completed demo immediately. Label fictional participants and explain when separate wallets are controlled by the same demo operator.

Implementation and verification

- Work only in recusal. Inspect applicable AGENTS.md files. Other chats may edit sibling projects. Use the installed GenLayer write-contract, lint, direct-test, integration-test, and CLI skills as applicable. Use the relevant frontend skill. Reuse a proven wallet connection or receipt-reading pattern from one nearby project if useful. Keep the grant logic original. Pin a concrete supported GenVM runner.
- First prove the three contrasting semantic cases on the target Studio test network. Use that evidence to refine the policy or evidence schema if needed. Preserve disagreement receipts and explain any material change. Meanwhile complete work that does not depend on a successful network call.
- Test authorization, deadline boundaries, duplicate challenges, stale judgments, alternate exhaustion, one vote per seat, and a recused wallet trying to vote directly. Run the app build and verify the actual UI with a browser on desktop and mobile.
- For the featured live proof, demonstrate one reviewer retained, another replaced, the recused wallet’s vote rejected, and the replacement’s vote recorded. Verify final state by reading the contract. For the rejected call, report precisely whether rejection occurred during simulation, submission, or execution. Exercise at least one clarification or expiry path through the UI. Keep local, mocked, and live outcomes clearly identified.
- Use existing configured development wallets, a supported GenLayer test network, and faucet funds only. Never print credentials. Do not take keys from sibling projects or use real funds. If already-authenticated hosting permits a free preview, deploy this app to a new isolated preview and verify it in a signed-out browser. Do not overwrite an existing production app, make a repository public, or submit the Portal form.

Definition of done

Deliver the functioning app, reproducible setup and test commands, exact deployment addresses and network, a short README, a proof manifest, and draft Portal title, description, and evidence entries. For every deployed intelligent contract, give the direct address URL as its own “GenLayer Explorer Contract” evidence entry and verify the link opens the right contract on the right network. List transaction links and source links separately. Make the featured case reachable from the app’s first screen.

Finish with the live app URL if available, what was verified through the UI, outstanding limitations, and the files and invariants the higher-model reviewer should inspect first. The most important review question is whether a stale assignment or recused wallet can influence the tally.
## Controlling refinements

These requirements refine and control any inconsistent wording elsewhere in this brief.

### Explainable conflict rulings

For every adjudication, persist and expose all of the following as part of the ruling record:

- The exact frozen policy clause/version used for that case.
- The relevant passage from the frozen disclosure evidence, with a stable reference to its evidence version.
- The relationship that passage establishes, expressed as concrete conduct and the parties involved.
- The resulting CONFLICT, NO_CONFLICT, or INSUFFICIENT decision and an explanation of whether that conduct satisfies the clause.

GenLayer validators independently assess the substance of the conduct against the clause. The word “supervisor” is neither necessary nor sufficient: assess what the evidence says the reviewer did. If the record contains no usable date for an otherwise relevant relationship, the ruling is INSUFFICIENT. Once a supported relationship date is available, ordinary code performs the 24-month comparison against the frozen reference date; validators do not calculate the cutoff.

Keep the three fictional disclosures and their contrasting intended outcomes: same public panel with an express lack of supervisory relationship is NO_CONFLICT; setting project goals, approving work, and signing an assessment six months earlier is CONFLICT even without the “supervisor” label; “we worked together” without enough detail or a usable date is INSUFFICIENT.

### Fixed challenge and resolution windows

Before assignments open, freeze a challenge cutoff and a later resolution deadline. A challenge accepted before the cutoff may be decided through the resolution interval ending at the resolution deadline. Opening a case, submitting a clarification, or any other case action must never extend either deadline.

Allow at most one active case for an exact assignment version. Replaying the same disclosure or challenge cannot reopen a resolved case or repeatedly reopen the seat. Keep clarification bounded to the existing one-clarification rule, with a new immutable evidence version and the same frozen deadlines.

After the resolution deadline, anyone may close an unresolved seat using the published vacancy rule and advance the round. Late, duplicate, or stale judgments cannot restore the former reviewer’s voting rights, change the frozen ballot roster, or alter a newer assignment. Freeze the eligible roster at ballot opening and enforce it in the contract.

### Featured scoped-recusal proof

Use applications A and B and assign the same reviewer wallet to both. Trigger and resolve a conflict only for that reviewer’s seat on A. The featured proof must show, with the contract enforcing each result:

1. The former reviewer is rejected when attempting to vote on A because that wallet is no longer the current eligible holder of A’s conflicted seat.
2. The same reviewer remains eligible to vote on B, and can successfully do so.
3. The ordered alternate is promoted on A and successfully records the replacement vote there.

Present this as the main proof: the former reviewer is rejected for the correct conflict-based authorization reason, the replacement can act, and the unrelated assignment survives. Distinguish local/mock/simulation observations from submitted and on-chain outcomes. For a rejected vote, state exactly whether rejection happened during simulation, submission, or execution, and link a transaction only if one exists.

### Public ruling inspection and evidence

Provide one “Inspect this ruling” link usable without a wallet. It should land directly on the ruling and expose the frozen policy clause, relevant disclosure passage, relationship finding, before-and-after roster, and recorded vote results. Clearly separate recorded receipts from current contract reads.

For every deployed intelligent contract, include and verify a separate direct GenLayer Explorer URL for that contract address on the correct network. In Portal evidence, label it “GenLayer Explorer Contract.” Transaction links, source links, and repository links are separate evidence entries and never replace the contract address link. Do not submit the Portal form or change repository visibility.

Keep the fictional disclosures. Do not expand the workflow into identity verification and do not add another contract unless the workflow actually requires it.
