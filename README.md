# Recusal

A grants panel that shows its work: when a reviewer's disclosed relationship is challenged, GenLayer validators rule on the conduct, contract code replaces the seat for that application only, and the recused wallet cannot vote even by calling the contract directly.

Live app: [recusal.vercel.app](https://recusal.vercel.app) (no wallet needed to inspect).
Contract: [`0x1B18Bf76D50352C174aEeBAf1BeD9815CE3A43a3`](https://explorer-studio.genlayer.com/address/0x1B18Bf76D50352C174aEeBAf1BeD9815CE3A43a3) on GenLayer StudioNet (chain 61999).
Proof: [docs/PROOF_MANIFEST.md](docs/PROOF_MANIFEST.md), every transaction linked.

All names, applications and disclosures are fictional. The policy is a demo policy, not an official grant or conference policy.

## What it does

- A fictional round has two applications, three voting seats each, and two ordered alternates. One reviewer sits on both applications.
- A named participant can open one case per assignment version. Validators read the disclosure against the frozen clause and return `CONFLICT`, `NO_CONFLICT` or `INSUFFICIENT`, with an exact quoted passage, the relationship found and a reason. Code does the date test.
- `CONFLICT` removes the reviewer from that application only and promotes the first eligible alternate. `INSUFFICIENT` allows exactly one clarification. An unresolved case expires into a vacancy at its fixed deadline; a stalled judgment never locks the round.
- Opening the ballot freezes the eligible seats. One vote per occupied seat, from that seat's current wallet, and a stale or recused wallet is rejected on-chain.

## What the live run shows

Four cases on StudioNet: a conflict that replaces a seat, a public-panel disclosure that keeps its seat, a vague disclosure resolved by one clarification, and a vague disclosure that expires into a vacancy. The former reviewer's vote on A and a vote on the vacant seat are rejected on-chain; the same reviewer's vote on B and the alternate's vote on A are accepted; both applications finalize.

## Run it

Requirements: Node 20+, Python 3.12+.

```powershell
npm install
python -m pip install -r requirements-dev.txt
npm run bundle        # vendors genlayer-js into frontend/vendor
npm run build         # copies the static app to dist/
npm run dev           # serves frontend/ at http://localhost:4173
npm run test:contracts
npm run lint:contract
```

To rerun the live proof you need your own StudioNet test keys:

```powershell
python scripts/test_wallets.py     # writes ignored .test-wallets.json
python scripts/live_run.py         # funds from the Studio faucet, deploys, runs every case, resumable
python scripts/make_config.py      # writes frontend/config.json from deploy/live.json
python scripts/make_docs.py        # regenerates the proof manifest and Portal fields
```

The live run takes about 75 minutes because the expiry case must wait out its 30-minute resolution window.

## Files to inspect first

- `contracts/recusal.py`: `adjudicate`, `close_expired`, `open_ballot` and `vote` hold the invariants. Check that a stale or recused wallet cannot enter the tally: `vote` requires `app['ballot'][seat] == sender`, and the ballot is frozen from the roster at the phase change.
- `tests/direct/`: authorization, deadline boundaries, duplicate challenges, alternate exhaustion, one vote per seat.
- `scripts/live_run.py`: the resumable live proof.

## Limits

- Validators agree on four disclosures in the live run; this is not a general proof of ruling quality. Every ruling is public, with its quote.
- StudioNet enforces a fee policy; the app and scripts deposit ten times the quoted fee and the unused part is refunded.
- One operator controls all demo wallets.

See [architecture](docs/ARCHITECTURE.md) and [Portal fields](docs/portal.md).
