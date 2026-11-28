# GenLayer Portal submission fields (not submitted)

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
Recusal answers one question for a grants panel: when a disclosed relationship is challenged, may that reviewer still decide that application? GenLayer validators read the disclosure against a frozen demo policy and rule CONFLICT, NO_CONFLICT or INSUFFICIENT, citing the exact passage and the conduct it shows. Contract code then handles the 24-month date test, promotes the next alternate for that application only, and freezes the ballot. The same reviewer stays eligible on the other application, and the recused wallet's vote is rejected on-chain even if it bypasses the interface. Unresolved seats expire into a vacancy instead of locking the round. The live round has four cases, votes rejected on-chain, and a finalized tally. All people are fictional.

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

## Expected outcome (306 of 500 characters)
Case 1 rules CONFLICT: the reviewer loses the A seat to alternate 1 but keeps B. That wallet's vote on A is rejected on-chain; the alternate's A vote and the reviewer's B vote are accepted. Case 2 keeps its seat, case 3 resolves after one clarification, case 4 expires into a vacancy. A and B finalize YES.

## Evidence entries

Add each deployment in the Contract links section and as its own **GenLayer Explorer Contract** evidence entry. The Portal detects this type from each direct address URL.
| Type | Label | URL |
|---|---|---|
| GenLayer Explorer Contract | Recusal — StudioNet | https://explorer-studio.genlayer.com/address/0x1B18Bf76D50352C174aEeBAf1BeD9815CE3A43a3 |
| GenLayer Explorer Contract | Recusal wallet path verification · StudioNet | https://explorer-studio.genlayer.com/address/0xa0077De3727EfF57C1CA39bb7823Fc396f52e829 |
| Website | Recusal live app | https://recusal.vercel.app |
| GitHub repository | Recusal source | https://github.com/JWattjr/recusal |
| Transaction | Former reviewer's vote on A, rejected on-chain | https://explorer-studio.genlayer.com/tx/0xb63168eb29e055bac7e95b577705861d013a0674501cf427c97d614458c79091 |
| Transaction | Conflict ruling, case 1 | https://explorer-studio.genlayer.com/tx/0xe242811d7c42b6e6ef09cb196baf50097fb6f92c6f702b610dc84c757b6ae8ae |
| Transaction | Same reviewer’s B vote accepted | https://explorer-studio.genlayer.com/tx/0x2cba91ef0bb500b450b7e84445b0779fb25cb4b99f764e7547a8e18d18f55aa8 |
| Transaction | Alternate’s A vote accepted | https://explorer-studio.genlayer.com/tx/0x71b04de4efb660c9bb60978d5884c4359a5304f7cfeb249360edbb6926ccada5 |
| Transaction | Timeout vacancy | https://explorer-studio.genlayer.com/tx/0xef85dd3c9fec526cde62749726724dda8a96aa9a4743e09294d3fd78067951e2 |

Proof manifest: docs/PROOF_MANIFEST.md. Description length: 759 of 1000 characters.
