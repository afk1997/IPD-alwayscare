import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const patientQueriesSource = readFileSync(
  new URL("../src/lib/patient-page-queries.ts", import.meta.url),
  "utf8"
);

const patientPageSource = readFileSync(
  new URL("../src/app/(app)/patients/[admissionId]/page.tsx", import.meta.url),
  "utf8"
);

function getFunctionSource(source: string, name: string) {
  const signature = `export async function ${name}`;
  const start = source.indexOf(signature);

  assert.notEqual(start, -1, `Could not find function ${name}`);

  const next = source.indexOf("\nexport async function ", start + signature.length);
  return source.slice(start, next === -1 ? source.length : next);
}

test("patient shell and tab reads are cache-tagged for live clinical reuse", () => {
  assert.match(
    getFunctionSource(patientQueriesSource, "getPatientPageShell"),
    /"use cache";[\s\S]*cacheLife\(CLINICAL_LIVE_PROFILE\);[\s\S]*cacheTag\(patientShellTag\(admissionId\)\);/
  );

  for (const [fnName, tag] of [
    ["getPatientVitalsData", "vitals"],
    ["getPatientMedsData", "meds"],
    ["getPatientFoodData", "food"],
    ["getPatientNotesData", "notes"],
    ["getPatientLabsData", "labs"],
    ["getPatientBathData", "bath"],
    ["getPatientIsolationData", "isolation"],
    ["getPatientLogsData", "logs"],
  ]) {
    assert.match(
      getFunctionSource(patientQueriesSource, fnName),
      new RegExp(
        String.raw`"use cache";[\s\S]*cacheLife\(CLINICAL_LIVE_PROFILE\);[\s\S]*cacheTag\(patientTabTag\(admissionId, "${tag}"\)\);`
      )
    );
  }
});

test("patient detail page loads shell-adjacent reads in parallel after the shell fetch", () => {
  assert.match(
    patientPageSource,
    /const \[[\s\S]*profilePhoto,[\s\S]*availableCages,[\s\S]*vitals,[\s\S]*medsData,[\s\S]*foodData,[\s\S]*notes,[\s\S]*labResults,[\s\S]*bathLogs,[\s\S]*isolationData,[\s\S]*logEntries,[\s\S]*patientMedia,[\s\S]*\] = await Promise\.all\(\[/
  );
});
