# Architecture

One GenLayer intelligent contract owns frozen round inputs, case lifecycle, role permissions, reviewer seat assignment, ballot roster, and vote counting. The validator judgment is the only subjective step: independently decide whether the cited conduct establishes direct supervision under the frozen clause. The contract then applies the supported-date 24-month comparison, promotes the first eligible alternate, and freezes ballot membership. The browser is a read-only public dossier until a wallet connects; wallet writes call the same contract directly.

## Boundaries

- **Contract:** authorization, exact assignment/evidence version binding, one active case per assignment version, fixed deadlines, clarification count, judgment finalization, alternates, vacancies, frozen ballot roster, one vote per occupied seat, and deterministic results.
- **Validators:** assess the described conduct against the recorded clause and cite an exact disclosure passage. They do not calculate date windows or change assignments.
- **Browser:** display contract reads and receipts, collect wallet actions, and label local previews separately. It is not authoritative for eligibility or tally.
- **Demo data:** fictional and public. The same reviewer appears on A and B to demonstrate application-scoped recusal.

## Frozen policy

“A reviewer may not assess an applicant whose project work they directly supervised during the previous 24 months. Speaking at the same public event, without evidence of supervision, does not disqualify a reviewer.”

Reference date is 2026-11-23. Each case freezes its own windows when opened (challenge cutoff 30 minutes, resolution deadline 30 minutes later). The exact date comparison is deterministic: a missing/invalid supported date produces INSUFFICIENT; a relationship date strictly within the prior 24 months can disqualify; the exact boundary date is included in “previous 24 months.”
