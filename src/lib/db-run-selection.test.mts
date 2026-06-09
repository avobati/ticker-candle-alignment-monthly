import test from "node:test";
import assert from "node:assert/strict";
import {
  datasetSourceFor,
  expectedTimeframeRows,
} from "./db-run-selection.ts";

test("expectedTimeframeRows requires weekly and monthly rows for every symbol", () => {
  assert.equal(expectedTimeframeRows(11_054), 22_108);
});

test("datasetSourceFor distinguishes coherent, legacy, and fallback reads", () => {
  assert.equal(datasetSourceFor({ completeRunFound: true, fallbackUsed: false }), "database-coherent");
  assert.equal(datasetSourceFor({ completeRunFound: false, fallbackUsed: false }), "database-legacy");
  assert.equal(datasetSourceFor({ completeRunFound: false, fallbackUsed: true }), "fallback");
});
