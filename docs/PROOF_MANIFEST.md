# Proof manifest

**Status: live on StudioNet (chain 61999). Every case below ran through consensus; nothing here is simulated.** Recorded by `scripts/live_run.py` (state in `deploy/live.json`), signed by gitignored test keys, never by a person's wallet.

## Contract

- GenLayer Explorer Contract: <https://explorer-studio.genlayer.com/address/0x1B18Bf76D50352C174aEeBAf1BeD9815CE3A43a3>
- Runner: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
- The previous deployment (`0x59554770929B857bb3DED3AD971979505eEE8138`) is retired: it hardcoded a 2027-01-15 challenge cutoff, so no ballot could open for seven weeks. This deployment gives every case its own windows: challenge cutoff 30 minutes after opening, resolution deadline 30 minutes later.

## Featured proof: one reviewer, two applications

| Claim | Evidence |
|---|---|
| The former reviewer (Rowan Hale) is replaced on A only | Case 1 ruled `CONFLICT`; A seat 1 now holds alternate 1 (assignment version 2); B seat 1 still holds the same wallet (version 1). |
| That wallet cannot vote on A, even bypassing the app | Its vote transaction finalized with an execution error: `wallet is not eligible for this frozen seat` ([receipt](https://explorer-studio.genlayer.com/tx/0xb63168eb29e055bac7e95b577705861d013a0674501cf427c97d614458c79091)). The rejection occurred during **execution** on StudioNet, after submission. |
| The same wallet can vote on B; the alternate can vote on A | Both votes accepted ([B](https://explorer-studio.genlayer.com/tx/0x2cba91ef0bb500b450b7e84445b0779fb25cb4b99f764e7547a8e18d18f55aa8), [A](https://explorer-studio.genlayer.com/tx/0x71b04de4efb660c9bb60978d5884c4359a5304f7cfeb249360edbb6926ccada5)). |
| Retained, clarified and vacated seats behave as specified | Case 2 `NO_CONFLICT` (kept). Case 3 `INSUFFICIENT`, then one clarification, then `NO_CONFLICT` (kept). Case 4 `INSUFFICIENT`, never clarified, expired: seat vacant, and the reviewer's vote on it was rejected on-chain ([receipt](https://explorer-studio.genlayer.com/tx/0x9a92d62d1766131ae4dbf889b481beee72a78a9b167896c16f4bd41ee813333f)). |
| Outcome | A `YES` (votes 1, 1, 0 across seats 1 to 3), B `YES` (1, 1, vacancy). Round phase `FINALIZED`. |

## Transactions

| Action | Receipt |
|---|---|
| Deploy Recusal contract | [0x3502ea96…](https://explorer-studio.genlayer.com/tx/0x3502ea96b34393b967e4184f38460f18b157a7b536a2b947cad49d4e731567b7) |
| Freeze demonstration wallet map | [0x33f4b785…](https://explorer-studio.genlayer.com/tx/0x33f4b78535e2b1ff944f0d547e8996955f1d5bf756b98f7d1e0a6c10601dd347) |
| Open assignment roster | [0xe82e114f…](https://explorer-studio.genlayer.com/tx/0xe82e114f0a48bf5b82900e3e6400f71761eacffd8de6a05d6eed4d3ef02858be) |
| Open A case 1 (goals, approvals, assessment) | [0xaaa1e567…](https://explorer-studio.genlayer.com/tx/0xaaa1e56770138159742b81ef49722a4d2425d73de0f1fa0e7a77fb7e4c01a6f3) |
| Open A case 2 (same public panel) | [0xb47f64be…](https://explorer-studio.genlayer.com/tx/0xb47f64be1d822cfde245636b21a5be6dd3364cd523ae8bfd91fb3c2da1739b66) |
| Open A case 3 ("we worked together") | [0xd9087454…](https://explorer-studio.genlayer.com/tx/0xd908745456644c6e7871a8f531a9ea7c10da56fbe3deebea1548a0befab6d9b9) |
| Open B case 4 ("we worked together") | [0x9af01ee9…](https://explorer-studio.genlayer.com/tx/0x9af01ee9e2bfb10323239ed846320d2aea05dee00ee73a5d5d9031c0d2e56665) |
| Rule case 1: CONFLICT, seat replaced by alternate 1 | [0xe242811d…](https://explorer-studio.genlayer.com/tx/0xe242811d7c42b6e6ef09cb196baf50097fb6f92c6f702b610dc84c757b6ae8ae) |
| Rule case 2: NO_CONFLICT, seat kept | [0x955ce2dd…](https://explorer-studio.genlayer.com/tx/0x955ce2ddfed580a5c695b27717e55557f3b8531a7fee0a30ffebd01b58a247f3) |
| Rule case 3: INSUFFICIENT, seat on hold | [0xd34a00a2…](https://explorer-studio.genlayer.com/tx/0xd34a00a2f2065b9bb19e05d3a48c356e7a83b46076d64ca60f34bb20d572ffd5) |
| Rule case 4, attempt 1: malformed model answer, MAJORITY_DISAGREE, no state change | [0xc3473de8…](https://explorer-studio.genlayer.com/tx/0xc3473de8c38ce727722f1ae865f56fef7bbaddbf73a35537d328457f6e5609ef) |
| Rule case 4, attempt 2: INSUFFICIENT, seat on hold | [0xf390f0f7…](https://explorer-studio.genlayer.com/tx/0xf390f0f78971fc434d574b5f537222d701f10cd29ff6d4188927daa73165b639) |
| Clarify case 3 (the single clarification) | [0x91c956ea…](https://explorer-studio.genlayer.com/tx/0x91c956ea0c0ee9a094841004f5ec68c9f0d9fc940ed5aa53b2735340a51e13ce) |
| Re-rule case 3: NO_CONFLICT, seat kept | [0xe9b9d190…](https://explorer-studio.genlayer.com/tx/0xe9b9d190c635773621c1448a3b491199f37709c8ea75409ee85cefd9e3a2242d) |
| Close expired case 4: seat vacant | [0xef85dd3c…](https://explorer-studio.genlayer.com/tx/0xef85dd3c9fec526cde62749726724dda8a96aa9a4743e09294d3fd78067951e2) |
| Open ballot (eligible seats frozen) | [0x852f4faa…](https://explorer-studio.genlayer.com/tx/0x852f4faa1db5bf45827b680e9d4ed5f8af271ba052a89000bd58aca7c4b24997) |
| Former reviewer votes on A: REJECTED ON-CHAIN | [0xb63168eb…](https://explorer-studio.genlayer.com/tx/0xb63168eb29e055bac7e95b577705861d013a0674501cf427c97d614458c79091) |
| Alternate votes on A: accepted | [0x71b04de4…](https://explorer-studio.genlayer.com/tx/0x71b04de4efb660c9bb60978d5884c4359a5304f7cfeb249360edbb6926ccada5) |
| Reviewer two votes on A: accepted | [0xdb65c4db…](https://explorer-studio.genlayer.com/tx/0xdb65c4db485bd88ae996219c86853561d25fc1f9bd1def31f04694536cf588a6) |
| Reviewer three votes on A: accepted | [0x1a753a32…](https://explorer-studio.genlayer.com/tx/0x1a753a32afbf1ef5e88abd2639ec1b2de1d43e9b930cd36d0ce1fb93912f69b4) |
| Same former reviewer votes on B: accepted | [0x2cba91ef…](https://explorer-studio.genlayer.com/tx/0x2cba91ef0bb500b450b7e84445b0779fb25cb4b99f764e7547a8e18d18f55aa8) |
| Reviewer two votes on B: accepted | [0xe17f5028…](https://explorer-studio.genlayer.com/tx/0xe17f5028fc0adf6e404d0fa69a09a139a82e9ba107add2c8bd00823a61d67843) |
| Reviewer three votes on B vacant seat: REJECTED ON-CHAIN | [0x9a92d62d…](https://explorer-studio.genlayer.com/tx/0x9a92d62d1766131ae4dbf889b481beee72a78a9b167896c16f4bd41ee813333f) |
| Finalize A: YES (2 yes, 1 no) | [0x5ee9980b…](https://explorer-studio.genlayer.com/tx/0x5ee9980b5e75500517d17daa1dd020cac1ef82711aa9fa3d021f2b55f377941d) |
| Finalize B: YES (2 yes, vacancy casts no vote) | [0x3e6d5073…](https://explorer-studio.genlayer.com/tx/0x3e6d5073a9e3c3c2b4b2068207d99543baa20b31fa45b789517ef78f1b0b9080) |

Two receipts are expected failures by design (the rejected votes). One (case 4, attempt 1) is a consensus disagreement caused by a malformed model answer; it changed no state and was resubmitted.

## Test wallets (public addresses, fictional roles)

- steward: `0xAFfd6CcE80BB44406CcaC874241F913CcD0Ffae3`
- reviewer: `0x92c62D01102ED3c866720dC0a92004426402f27d`
- reviewer_two: `0xA0210946c7Cb12fed65ffcC06189Ed6425909e70`
- reviewer_three: `0xdC672271ab77c56d826289535A213d824d37B098`
- alternate_one: `0xC5ae7f0de1C462827401Cf25714AcB0558ED992b`
- alternate_two: `0xFA64C0Fb5899E9955020B5CAB33E36751f8c1Bc8`
- applicant_a: `0xb9515e3ed3AAD5A634bBb5cEC0ec274a73D9Cfd4`
- applicant_b: `0xE6077631278b00a55F56ecb7dCa71E269c2d1716`

## Limits

- StudioNet now enforces a fee policy; the scripts deposit ten times the quoted fee and the unused part is refunded.
- Mocked-LLM direct tests prove contract transitions; the live run proves validator agreement on these four disclosures only.
- One operator controls all demo wallets.
