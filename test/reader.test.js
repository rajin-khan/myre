const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

test("the branch snapshot contains only the Markdown reader test note", async () => {
  const { snapshot } = await import("../scripts/sync-learning.mjs");
  const root = path.resolve(__dirname, "..");
  const result = await snapshot(root, "main", "a".repeat(40));
  assert.deepEqual(result.files.map((file) => file.path), ["learning/rajin/markdown-test.md"]);
  assert.match(result.files[0].body, /\[!NOTE\]/);
  assert.match(result.files[0].body, /```mermaid/);
  assert.match(result.files[0].body, /\| Part \| Rough job \|/);
});
