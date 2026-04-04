import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const patientQueriesSource = readFileSync(
  new URL("../src/lib/patient-page-queries.ts", import.meta.url),
  "utf8"
);

test("patient food query uses cache components with a patient food tag", () => {
  assert.match(
    patientQueriesSource,
    /export async function getPatientFoodData\([\s\S]*?"use cache";/
  );
  assert.match(
    patientQueriesSource,
    /cacheTag\(patientTabTag\(admissionId,\s*"food"\)\);/
  );
});

test("patient food query splits active plan reads from history log reads", () => {
  assert.match(
    patientQueriesSource,
    /const \[activePlan,\s*historyLogs\] = await Promise\.all\(\[/
  );
  assert.match(
    patientQueriesSource,
    /db\.dietPlan\.findFirst\(\{/
  );
  assert.match(
    patientQueriesSource,
    /db\.feedingLog\.findMany\(\{/
  );
  assert.match(
    patientQueriesSource,
    /where:\s*\{\s*date:\s*\{\s*gte:\s*sevenDaysAgo,\s*lt:\s*today\s*\}/
  );
});
