// Turns playwright-report/results.json (the 'json' reporter output, see playwright.config.ts) into a
// markdown table written to $GITHUB_STEP_SUMMARY, so a PR reviewer sees pass/fail/known-bug counts
// directly on the Actions run without downloading the HTML report artifact.
import { readFileSync, appendFileSync, existsSync } from 'node:fs';

const resultsPath = 'playwright-report/results.json';
// Falls back to stdout outside CI (GITHUB_STEP_SUMMARY is only set by Actions), so this script can be
// previewed locally without an actual job summary file to append to.
const writeSummary = (text) =>
  process.env.GITHUB_STEP_SUMMARY ? appendFileSync(process.env.GITHUB_STEP_SUMMARY, text) : process.stdout.write(text);

function collectTests(suites, out = []) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        out.push({ title: spec.title, status: test.status });
      }
    }
    collectTests(suite.suites ?? [], out);
  }
  return out;
}

if (!existsSync(resultsPath)) {
  writeSummary(
    '## Test Results\n\n⚠️ No results file found — the test run likely crashed before any reporter could write output.\n',
  );
  process.exit(0);
}

const report = JSON.parse(readFileSync(resultsPath, 'utf-8'));
const tests = collectTests(report.suites ?? []);

const isBug = (t) => t.title.startsWith('BUG:');
const passed = tests.filter((t) => t.status === 'expected' && !isBug(t));
const knownBugs = tests.filter((t) => t.status === 'expected' && isBug(t));
const unexpected = tests.filter((t) => t.status === 'unexpected');
const flaky = tests.filter((t) => t.status === 'flaky');
const skipped = tests.filter((t) => t.status === 'skipped');

const lines = [];
lines.push('## 🧪 Test Results');
lines.push('');
lines.push(`API: \`${process.env.API_BASE_URL ?? 'unknown'}\``);
lines.push('');
lines.push('| | Count |');
lines.push('| --- | --- |');
lines.push(`| ✅ Passed | ${passed.length} |`);
lines.push(`| 🐛 Known bugs (expected failures, see README) | ${knownBugs.length} |`);
lines.push(`| ❌ Unexpected failures | ${unexpected.length} |`);
if (flaky.length > 0) lines.push(`| 🔁 Flaky | ${flaky.length} |`);
if (skipped.length > 0) lines.push(`| ⏭️ Skipped | ${skipped.length} |`);
lines.push(`| **Total** | **${tests.length}** |`);
lines.push('');

if (unexpected.length > 0) {
  lines.push('### ❌ Unexpected failures');
  lines.push('');
  lines.push(
    'A test that should pass failed, *or* a `BUG:` regression test unexpectedly started passing (which means that bug got fixed — promote/remove its `test.fail()`). Either way, this needs a look:',
  );
  lines.push('');
  for (const t of unexpected) lines.push(`- ${t.title}`);
  lines.push('');
} else {
  lines.push('No unexpected failures — every known bug is still open and every other test passed.');
  lines.push('');
}

lines.push('<details><summary>🐛 Known bugs currently documented</summary>');
lines.push('');
for (const t of knownBugs) lines.push(`- ${t.title}`);
lines.push('');
lines.push('</details>');
lines.push('');

writeSummary(lines.join('\n'));
