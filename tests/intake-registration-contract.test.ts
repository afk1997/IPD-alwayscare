import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registrationSource = readFileSync(
  new URL("../src/components/forms/registration-form.tsx", import.meta.url),
  "utf8"
);
const admissionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);
const pendingSetupSource = readFileSync(
  new URL("../src/components/dashboard/pending-setup.tsx", import.meta.url),
  "utf8"
);
const dashboardQueriesSource = readFileSync(
  new URL("../src/lib/dashboard-queries.ts", import.meta.url),
  "utf8"
);

test("registration defaults stray to false and captures the new intake fields", () => {
  assert.match(registrationSource, /useState\(false\)/);
  assert.match(registrationSource, /name="ambulancePersonName"/);
  assert.match(registrationSource, /name="locationGpsCoordinates"/);
  assert.match(registrationSource, /name="handlingNote"/);
  assert.match(registrationSource, /Location Photo/);
});

test("registration uploads the location photo separately from profile media", () => {
  assert.match(
    registrationSource,
    /buildDriveFolderPath\(patientName, "LOCATION"\)/
  );
  assert.match(registrationSource, /buildDriveFileName\("location",/);
  assert.match(
    registrationSource,
    /savePatientMedia\(patientId, locationUploads, false\)/
  );
});

test("registerPatient persists patient number and new intake metadata", () => {
  assert.match(
    admissionsSource,
    /const patientNumber = await reservePatientNumber\(tx\)/
  );
  assert.match(admissionsSource, /const handlingNote = validateHandlingNote/);
  assert.match(admissionsSource, /const ambulancePersonName =/);
  assert.match(admissionsSource, /const locationGpsCoordinates =/);
  assert.match(admissionsSource, /patientNumber,/);
  assert.match(admissionsSource, /ambulancePersonName,/);
  assert.match(admissionsSource, /handlingNote,/);
});

test("registered-patient editing covers the new intake fields", () => {
  assert.match(pendingSetupSource, /name="ambulancePersonName"/);
  assert.match(pendingSetupSource, /name="locationGpsCoordinates"/);
  assert.match(pendingSetupSource, /name="handlingNote"/);
  assert.match(admissionsSource, /editRegisteredPatient[\s\S]*handlingNote/);
  assert.match(admissionsSource, /updatePatient[\s\S]*handlingNote/);
  assert.match(pendingSetupSource, /patient\.patientNumber/);
  assert.match(dashboardQueriesSource, /patientNumber:\s*true/);
});
