# Patient Route Performance Design

**Problem**

Patient tab navigation feels slow because [`src/app/(app)/patients/[admissionId]/page.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/(app)/patients/%5BadmissionId%5D/page.tsx) loads nearly every admission-related relation on every request, regardless of which tab is active. The later tab-feedback commit only adds loading affordances, so the heavy server render remains the root cause.

**Decision**

Split patient detail loading into:

1. A light shared shell query for header/navigation/doctor-action state.
2. Tab-specific data queries that only run for the active tab.
3. A small load-plan helper that makes the tab-to-data mapping explicit and testable.

**Scope**

- Optimize the internal patient route at `/patients/[admissionId]`.
- Keep current UI behavior and tab components intact.
- Avoid unrelated visual refactors or navigation redesign.

**Architecture**

- Add a server-side helper module to centralize patient page data loading.
- Keep one base admission query for shell data used on every tab.
- Move heavy relations like media, full notes, labs, diet logs, and log-history inputs behind tab-gated queries.
- Leave the `logs` tab as the intentionally heavy path, since it needs the broadest dataset.

**Testing**

- Add a small `node:test` coverage file for the tab load-plan helper.
- Verify the helper marks only the expected relations as required per tab.
- Run targeted lint/type/test verification after the refactor.

**Success Criteria**

- Switching to a light tab like `vitals`, `notes`, or `photos` no longer fetches unrelated heavy relations.
- The patient page keeps rendering the same tab content and doctor controls.
- The load-plan logic is covered by an automated test so the route does not silently regress back into over-fetching.
