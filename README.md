# Recusal

A grants panel that shows its work: when a reviewer's disclosed relationship is challenged, GenLayer validators rule on the conduct, contract code replaces the seat for that application only, and the recused wallet cannot vote even by calling the contract directly.

Live app: [recusal.vercel.app](https://recusal.vercel.app) (no wallet needed to inspect).
Contract: [`0x1B18Bf76D50352C174aEeBAf1BeD9815CE3A43a3`](https://explorer-studio.genlayer.com/address/0x1B18Bf76D50352C174aEeBAf1BeD9815CE3A43a3) on GenLayer StudioNet (chain 61999).
Proof: [docs/PROOF_MANIFEST.md](docs/PROOF_MANIFEST.md), every transaction linked.

Open [Inspect this ruling](https://recusal.vercel.app/#featured-ruling) to compare the disclosure, policy clause and before and after roster. The featured proof links the rejected A vote, the same reviewer's accepted B vote and the alternate's accepted A vote. The steward desk tracks submitted wallet writes until StudioNet records finality and displays the execution outcome.

All names, applications and disclosures are fictional. The policy is a demo policy, not an official grant or conference policy.

## What it does

- A fictional round has two applications, three voting seats each, and two ordered alternates. One reviewer sits on both applications.
- A named participant can open one case per assignment version. Validators read the disclosure against the frozen clause and return `CONFLICT`, `NO_CONFLICT` or `INSUFFICIENT`, with an exact quoted passage, the relationship found and a reason. Code does the date test.
- `CONFLICT` removes the reviewer from that application only and promotes the first eligible alternate. `INSUFFICIENT` allows exactly one clarification. An unresolved case expires into a vacancy at its fixed deadline; a stalled judgment never locks the round.
- Opening the ballot freezes the eligible seats. One vote per occupied seat, from that seat's current wallet, and a stale or recused wallet is rejected on-chain.

## Review the live proof

1. Open [Inspect this ruling](https://recusal.vercel.app/#featured-ruling) without a wallet. Read the clause, disclosure and relationship finding alongside the before and after roster.
2. Check that Rowan is replaced on A and remains on B. Follow the three receipt links for [A rejection](https://explorer-studio.genlayer.com/tx/0xb63168eb29e055bac7e95b577705861d013a0674501cf427c97d614458c79091), [B acceptance](https://explorer-studio.genlayer.com/tx/0x2cba91ef0bb500b450b7e84445b0779fb25cb4b99f764e7547a8e18d18f55aa8) and [alternate A acceptance](https://explorer-studio.genlayer.com/tx/0x71b04de4efb660c9bb60978d5884c4359a5304f7cfeb249360edbb6926ccada5).
3. Open the [evidence ledger](https://recusal.vercel.app/#records) and inspect the vacancy and finalization receipts.

**Expected outcome.** The conflict replaces Rowan on A only. StudioNet rejects Rowan’s A vote, accepts Rowan’s B vote and accepts the alternate’s A vote. The public-panel case keeps its seat, one case resolves after clarification, and the unresolved case becomes vacant. A and B both finalize YES.

## Run it

Requirements: Node 20+, Python 3.12+.

```powershell
npm install
python -m pip install -r requirements-dev.txt
npm run bundle        # vendors genlayer-js into frontend/vendor
npm run build         # copies the static app to dist/
npm run dev           # serves frontend/ at http://localhost:4173
npm run test:contracts
npm run test:frontend
npm run lint:contract
```

To rerun the live proof you need your own StudioNet test keys:

```powershell
python scripts/test_wallets.py     # writes ignored .test-wallets.json
python scripts/live_run.py         # funds from the Studio faucet, deploys, runs every case, resumable
python scripts/make_config.py      # writes frontend/config.json from deploy/live.json
python scripts/make_docs.py        # regenerates the proof manifest and Portal fields
```

The live run takes about 75 minutes. A case reaches its resolution deadline 60 minutes after opening, and the final votes take additional time to finalize.

To verify the app's write path on an isolated StudioNet round, use the project's local funded test wallets and run:

```powershell
python scripts/live_run.py --prepare-wallet-path
node scripts/verify-wallet-path.mjs
python scripts/record-wallet-proof.py
python scripts/make_config.py
python scripts/make_docs.py
npm run build
```

The app harness runs the existing controls and SDK with an injected EIP-1193 test provider. The local journal resumes from submitted hashes and is excluded from Git. The published evidence contains the contract address and verified receipt fields.

## Files to inspect first

- `contracts/recusal.py`: `adjudicate`, `close_expired`, `open_ballot` and `vote` hold the invariants. Check that a stale or recused wallet cannot enter the tally: `vote` requires `app['ballot'][seat] == sender`, and the ballot is frozen from the roster at the phase change.
- `tests/direct/`: authorization, deadline boundaries, duplicate challenges, alternate exhaustion, one vote per seat.
- `scripts/live_run.py`: the resumable live proof.

## Limits

- Validators agree on four disclosures in the live run; this is not a general proof of ruling quality. Every ruling is public, with its quote.
- StudioNet enforces a fee policy; the app and scripts deposit ten times the quoted fee and the unused part is refunded.
- One operator controls all demo wallets.

See [architecture](docs/ARCHITECTURE.md) and [Portal fields](docs/portal.md).
