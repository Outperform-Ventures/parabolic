import { createHash } from 'node:crypto';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Collect evidence; this script never builds, runs tests, or rewrites their reports.
// Supply the observed typecheck exit code: silence alone does not prove success.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
  const [key, ...value] = arg.slice(2).split('=');
  args.set(key, value.length ? value.join('=') : process.argv[++i]);
}
const option = (name, fallback) => args.get(name) ?? fallback;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const label = path => isAbsolute(path) && !path.startsWith(root + '/') ? path : relative(root, resolve(root, path));
const clean = text => String(text ?? '').replace(/\x1b\[[0-9;]*m/g, '');
async function evidence(path, json = true) {
  try {
    const bytes = await readFile(resolve(root, path)), info = await stat(resolve(root, path));
    return { path: label(path), sha256: hash(bytes), modifiedAt: info.mtime.toISOString(), bytes: bytes.length, data: json ? JSON.parse(bytes) : clean(bytes.toString()) };
  } catch (error) {
    return { path: label(path), unavailable: error.code === 'ENOENT' ? 'missing' : error.message };
  }
}
const ref = ({ data, ...metadata }) => metadata;
function testsIn(report) {
  const rows = [];
  function walk(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) rows.push({
      file: spec.file, title: spec.title, project: test.projectName || 'chromium', status: test.status,
      attempts: (test.results ?? []).map(result => ({ status: result.status, durationMs: result.duration, error: result.error ? clean(result.error.message).slice(0,1500) : undefined })),
    });
    for (const child of suite.suites ?? []) walk(child);
  }
  walk(report); return rows;
}
async function browserReport(path, buildPath, expectedRenderer = build.data?.rendererSha256) {
  const file = await evidence(path), capture = buildPath ? await evidence(buildPath) : null;
  if (!file.data) return { status: 'unavailable', evidence: ref(file), build: capture && ref(capture) };
  const rows = testsIn(file.data), stats = file.data.stats;
  const count = selection => Object.fromEntries(['expected','unexpected','flaky','skipped'].map(status => [status, selection.filter(test => test.status === status).length]));
  const testStatus = !stats || !rows.length ? 'incomplete' : stats.unexpected || file.data.errors?.length ? 'failed' : stats.flaky ? 'passed-with-flaky-tests' : 'passed';
  const startedAt = Date.parse(stats?.startTime), builtAt = expectedRenderer === build.data?.rendererSha256 ? Date.parse(build.data?.builtAt) : NaN;
  const predatesSelectedBuild = Number.isFinite(startedAt) && Number.isFinite(builtAt) && startedAt < builtAt;
  const recordedRenderer = capture?.data?.indexSha256 ?? capture?.data?.rendererSha256;
  const mismatchedBuild = !!recordedRenderer && recordedRenderer !== expectedRenderer;
  return {
    status: mismatchedBuild ? 'different-renderer' : predatesSelectedBuild ? 'predates-selected-build' : testStatus,
    testStatus, predatesSelectedBuild,
    evidence: ref(file), stats, errors: (file.data.errors ?? []).map(error => clean(error.message).slice(0,1500)),
    byProject: Object.fromEntries([...new Set(rows.map(row => row.project))].map(project => [project, count(rows.filter(row => row.project === project))])),
    sourceHarness: { files: ['client/history-race.spec.ts'], counts: count(rows.filter(row => row.file === 'client/history-race.spec.ts')), note: 'The history race harness imports current store source through Vite; it does not exercise the frozen renderer bundle.' },
    failures: rows.filter(row => row.status === 'unexpected' || row.status === 'flaky'),
    build: capture ? { evidence: ref(capture), ...capture.data, rendererMatches: !!recordedRenderer && recordedRenderer === expectedRenderer } : null,
  };
}
async function nodeReport(path) {
  const file = await evidence(path, false);
  if (!file.data) return { status: 'unavailable', evidence: ref(file) };
  const counts = Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo','duration_ms'].map(key => {
    const matches = [...file.data.matchAll(new RegExp(`(?:^|\\n)[^\\n]*?\\b${key} (\\d+(?:\\.\\d+)?)\\s*(?=\\n|$)`, 'g'))];
    return [key, matches.length ? Number(matches.at(-1)[1]) : null];
  }));
  const complete = counts.tests !== null && counts.duration_ms !== null;
  return { status: !complete ? 'incomplete' : counts.fail || counts.cancelled ? 'failed' : 'passed', evidence: ref(file), counts };
}
async function checkReport(path) {
  const file = await evidence(path);
  return { status: file.data?.result ?? 'unavailable', evidence: ref(file), checkCount: file.data?.checks?.length ?? null, report: file.data ?? null };
}
async function packageReports(path, lifecyclePath = `${path}/service-lifecycle.json`) {
  return {
    native: await checkReport(`${path}/native-smoke.json`),
    serviceLifecycle: await checkReport(lifecyclePath),
    bundle: await checkReport(`${path}/bundle-inspection.json`),
    sdk: await checkReport(`${path}/sdk-package-smoke.json`),
    build: await evidence(`${path}/verified-build.json`),
    sourceVerification: await evidence(`${path}/source-verification.json`),
  };
}

async function fontReport(path) {
  const file = await evidence(path);
  if (!file.data) return { status:'unavailable',evidence:ref(file) };
  const expectedNames = ['chromium','webkit','firefox'];
  const browsers = Array.isArray(file.data.browsers) ? file.data.browsers : [];
  const results = browsers.map(browser => ({
    name:browser.name,version:browser.version,passed:browser.passed === true,
    metricCount:Array.isArray(browser.rows) ? browser.rows.length : 0,
    metricsValid:Array.isArray(browser.rows) && browser.rows.every(row => typeof row.actual==='number' && Number.isFinite(row.actual) && typeof row.reference==='number' && Number.isFinite(row.reference)),
    maxMetricDelta:Array.isArray(browser.rows) && browser.rows.length ? Math.max(...browser.rows.map(row => Math.abs(row.actual-row.reference))) : null,
    checkCount:Array.isArray(browser.checks) ? browser.checks.length : 0,
  }));
  const complete = browsers.length === expectedNames.length && expectedNames.every(name => results.filter(browser => browser.name === name && browser.metricCount === 20).length === 1);
  const testStatus = !complete ? 'incomplete' : results.every(browser => browser.passed && browser.metricsValid && Number.isFinite(browser.maxMetricDelta) && browser.maxMetricDelta <= 0.02) ? 'passed' : 'failed';
  const rendererMatches = file.data.rendererSha256 === build.data?.rendererSha256;
  return {status:rendererMatches ? testStatus : 'different-renderer',testStatus,evidence:ref(file),rendererMatches,browserCount:browsers.length,metricCount:results.reduce((sum,browser)=>sum+browser.metricCount,0),browsers:results,report:file.data};
}

const buildPath = option('build', 'artifacts/verification/verified-build.json');
const build = await evidence(buildPath);
const renderer = await evidence(option('renderer', 'dist/index.html'), false);
const rendererId = build.data?.rendererSha256?.slice(0,8) ?? 'unverified';
const criticalSources = {};
for (const [path, expected] of Object.entries(build.data?.criticalSources ?? {})) {
  const actual = await evidence(path, false);
  criticalSources[path] = { expected, actual: actual.sha256 ?? null, matches: actual.sha256 === expected };
}
// Binary assets and licenses are outside the textual runtime-source scan.
// They must be captured explicitly in the selected build, not silently inferred here.
const requiredFontCriticalPaths = [
  'index.html','src/client/main.tsx','src/client/fonts.css','src/client/font-scale.ts',
  'src/client/fonts/InterVariable.woff2','src/client/fonts/InterVariable-Italic.woff2',
  'src/client/fonts/LICENSE.txt','public/licenses/inter.txt',
];
const fontCriticalFiles = {};
for (const path of requiredFontCriticalPaths) {
  const actual = await evidence(path,false),expected = build.data?.criticalSources?.[path];
  fontCriticalFiles[path] = {evidence:ref(actual),expected:expected??null,captured:typeof expected==='string',matches:expected ? actual.sha256===expected : null};
}
const nativeBaselineRoot = 'artifacts/platform/native-frozen-7571fd01';
const utilityComparisonRoot = 'artifacts/platform/native-utility-7571fd01';
const historicalBuild = await evidence(`${nativeBaselineRoot}/verified-build.json`);
const historicalRenderer = historicalBuild.data?.rendererSha256;
const nativeRoot = option('native-dir', `artifacts/platform/native-integrated-${rendererId}`);
const engineRoot = option('engine-dir', `artifacts/verification/full-engines-${rendererId}`);
const engineFollowup = args.has('engine-followup') ? await browserReport(args.get('engine-followup'), option('engine-followup-build', null)) : null;
const typecheckFile = await evidence(option('typecheck-log', '/tmp/parabolic-webhook-lifecycle-typecheck.log'), false);
const exitArgument = option('typecheck-exit-code', null);
if (exitArgument !== null && !/^\d+$/.test(exitArgument)) throw new Error('typecheck-exit-code must be an observed nonnegative integer');
const typecheckExitCode = exitArgument === null ? null : Number(exitArgument);
const summary = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  scope: 'Evidence for the recorded build and test cases, not a declaration of complete Parabolic parity or production readiness.',
  build: { evidence: ref(build), record: build.data ?? null, currentRendererSha256: renderer.sha256 ?? null, rendererMatches: !!build.data && renderer.sha256 === build.data.rendererSha256, criticalSources,
    fontCriticalFiles:{files:fontCriticalFiles,missingFromCapture:requiredFontCriticalPaths.filter(path=>!fontCriticalFiles[path].captured),allCaptured:requiredFontCriticalPaths.every(path=>fontCriticalFiles[path].captured),allCurrentFilesMatch:requiredFontCriticalPaths.every(path=>fontCriticalFiles[path].matches===true)},
  },
  node: await nodeReport(option('node-log', '/tmp/parabolic-webhook-lifecycle-full-node.log')),
  typecheck: {
    status: typecheckFile.unavailable ? 'unavailable' : typecheckExitCode === null ? 'unconfirmed' : typecheckExitCode || /error TS\d+/.test(typecheckFile.data) ? 'failed' : 'passed',
    evidence: ref(typecheckFile), exitCode: typecheckExitCode, exitCodeSource: 'Observed runner exit supplied through --typecheck-exit-code; never inferred from an empty log.',
  },
  browsers: {
    chromiumCurrentFull: await browserReport(option('chromium-report', 'artifacts/verification/browser-chromium.json'), option('chromium-build', null)),
    enginesCurrentFull: await browserReport(option('engine-report', `${engineRoot}/report.json`), option('engine-build', `${engineRoot}/traces/engine-build.json`)),
    currentFocusedFollowup: engineFollowup,
    historical: {
      build: ref(historicalBuild), rendererSha256: historicalRenderer,
      chromiumFirstFull: await browserReport('artifacts/verification/chromium-first-7571fd01/report.json', null, historicalRenderer),
      chromiumCorrectedFull: await browserReport('artifacts/verification/chromium-frozen-7571fd01/report.json', null, historicalRenderer),
      enginesFirstFull: await browserReport('artifacts/verification/full-engines-7571fd01/report.json', 'artifacts/verification/full-engines-7571fd01/traces/engine-build.json', historicalRenderer),
      enginesCorrectedSubissuesFollowup: await browserReport('artifacts/verification/full-engines-7571fd01/subissues-followup/report.json', 'artifacts/verification/full-engines-7571fd01/subissues-followup/traces/engine-build.json', historicalRenderer),
      correction: 'The sub-issue fixture explicitly selects Todo when testing active-cycle inheritance. The failed first full runs remain preserved; focused follow-ups do not replace full-run results.',
    },
    boundary: 'A frozen browser build record identifies the renderer. The API service uses repository source; the history race cases also load current client store source through Vite. A Playwright report without an accompanying build record does not independently establish renderer identity.',
  },
  packages: await packageReports(nativeRoot, option('native-lifecycle-report', `${nativeRoot}/service-lifecycle.json`)),
  historicalPackages: {
    original: await packageReports(nativeBaselineRoot),
    utilityComparison: { ...await packageReports(utilityComparisonRoot), equivalence: await evidence(`${utilityComparisonRoot}/service-equivalence.json`), isolationBuild: await evidence(`${utilityComparisonRoot}/isolation-build.json`), note: 'Controlled desktop service-isolation comparison using the old server reconstructed from the original ASAR. It does not validate subsequent comment/draft changes in a new integrated package.' },
  },
  priorVerificationSnapshot: await evidence(option('prior-summary', 'artifacts/verification/summary-73b5d586.json')),
  fontAssets: {
    current:await fontReport(option('font-report','artifacts/verification/font-audit/integrated/report.json')),
    historicalPrivate:await fontReport('artifacts/verification/font-audit/private/report.json'),
    boundary:'Compares emitted Inter assets and same-engine metrics against byte-verified upstream files. It does not establish installed-app pixel, glyph-rasterization, or full typography parity.',
  },
  performance: [],
  limitations: [
    'Passing checks cover their explicit assertions; no claim is made that every pixel, feature, or production scenario has been verified.',
    'Historical failed full runs and their focused corrections remain separate. Current full runs are independently reported and never inferred from a union of prior tests.',
    'Packaged native smoke and utility-service lifecycle checks are distinct suites. A controlled old-server utility comparison is not a substitute for the selected integrated package and its exact-ASAR responsiveness probe.',
    'Renderer input timing measures pointerdown capture to a second requestAnimationFrame callback, not physical display latency. Playwright action duration and full hydration are separate measurements.',
    'Temporary log paths may expire. Their hashes and parsed results are retained here, but the collector does not copy or fabricate missing evidence.',
  ],
};
for (const size of [10000,100000]) {
  const file = await evidence(option(`performance-${size}`, `artifacts/performance/ui-${size}.json`));
  summary.performance.push({ evidence: ref(file), rendererMatches: !!file.data && file.data.environment?.rendererIndexSha256 === build.data?.rendererSha256, report: file.data ?? null });
}
const baselineProbePath = 'artifacts/platform/desktop-main-responsiveness/report.json';
const comparisonProbePath = 'artifacts/platform/desktop-utility-responsiveness/report.json';
const probe = await evidence(option('native-probe', 'artifacts/platform/desktop-integrated-responsiveness/report.json'));
const compactProbe = file => ({ evidence: ref(file), report: file.data ? {
  ...file.data,
  phases: file.data.phases?.map(({ main, renderer, heartbeats, rendererHeartbeats, ...phase }) => phase),
} : null });
summary.nativeResponsivenessProbe = compactProbe(probe);
summary.historicalNativeResponsiveness = { original: compactProbe(await evidence(baselineProbePath)), utilityComparison: compactProbe(await evidence(comparisonProbePath)) };
const packageAsar = summary.packages.native.report?.build?.asarSha256;
const lifecycle = summary.packages.serviceLifecycle.report;
summary.nativeEvidenceConsistency = {
  selectedPackageRendererMatches: summary.packages.native.report ? summary.packages.native.report.build?.rendererSha256 === build.data?.rendererSha256 : null,
  selectedPackageAndProbeAsarMatch: probe.data && packageAsar ? probe.data.packagedAsarSha256 === packageAsar : null,
  selectedPackageAndLifecycleAsarMatch: lifecycle && packageAsar ? lifecycle.asarSha256 === packageAsar : null,
  selectedLifecycleRendererMatches: lifecycle ? lifecycle.rendererSha256 === build.data?.rendererSha256 : null,
};
const output = resolve(root, option('output', 'artifacts/verification/summary.json'));
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(summary, null, 2) + '\n');

const markdownOutput = resolve(root, option('markdown-output', 'docs/verification.md'));
const link = path => `[${path}](${relative(dirname(markdownOutput), resolve(root,path))})`;
const browserLine = report => report?.stats ? `${report.stats.expected} passed, ${report.stats.unexpected} failed, ${report.stats.flaky} flaky, ${report.stats.skipped} skipped` : report?.status ?? 'not supplied';
const history = summary.browsers.historical;
const rows = [
  ['Node unit/domain/platform', `${summary.node.counts?.pass ?? '?'} / ${summary.node.counts?.tests ?? '?'} passed`, summary.node.status],
  ['Typecheck', `Observed exit ${summary.typecheck.exitCode ?? 'unknown'}`, summary.typecheck.status],
  ['Current Chromium full run', browserLine(summary.browsers.chromiumCurrentFull), summary.browsers.chromiumCurrentFull.status],
  ['Current WebKit / Firefox full run', browserLine(summary.browsers.enginesCurrentFull), summary.browsers.enginesCurrentFull.status],
  ...(engineFollowup ? [['Current focused engine follow-up', browserLine(engineFollowup), engineFollowup.status]] : []),
  ['Font asset/browser selection',`${summary.fontAssets.current.browserCount ?? '?'} engines; ${summary.fontAssets.current.metricCount ?? '?'} metric comparisons`,summary.fontAssets.current.status],
  ['Font build fingerprints',`${requiredFontCriticalPaths.length-summary.build.fontCriticalFiles.missingFromCapture.length} / ${requiredFontCriticalPaths.length} required files captured`,summary.build.fontCriticalFiles.allCaptured ? summary.build.fontCriticalFiles.allCurrentFilesMatch ? 'matched' : 'current-files-differ' : 'incomplete'],
  ['Selected packaged macOS smoke', `${summary.packages.native.checkCount ?? '?'} explicit checks`, summary.packages.native.status],
  ['Selected utility-service lifecycle', `${summary.packages.serviceLifecycle.checkCount ?? '?'} explicit checks`, summary.packages.serviceLifecycle.status],
  ['Selected ASAR inspection', `${summary.packages.bundle.report?.asarEntries ?? '?'} entries`, summary.packages.bundle.status],
  ['Selected installed SDK archive smoke', `${summary.packages.sdk.checkCount ?? '?'} explicit checks`, summary.packages.sdk.status],
];
const historicalRows = [
  ['7571 first Chromium full', history.chromiumFirstFull], ['7571 corrected Chromium full', history.chromiumCorrectedFull],
  ['7571 WebKit / Firefox full', history.enginesFirstFull], ['7571 corrected sub-issue follow-up', history.enginesCorrectedSubissuesFollowup],
];
const prior = summary.priorVerificationSnapshot.data,priorId = prior?.build?.record?.rendererSha256?.slice(0,8);
if (prior?.browsers?.chromiumCurrentFull) historicalRows.push([`${priorId} previous Chromium full`,prior.browsers.chromiumCurrentFull]);
if (prior?.browsers?.enginesCurrentFull) historicalRows.push([`${priorId} previous WebKit / Firefox full`,prior.browsers.enginesCurrentFull]);
if (prior?.browsers?.currentFocusedFollowup) historicalRows.push([`${priorId} previous focused follow-up`,prior.browsers.currentFocusedFollowup]);
const fmt = value => typeof value === 'number' ? value.toFixed(1) : '?';
const busyPhases = summary.nativeResponsivenessProbe.report?.phases?.filter(phase => phase.nativeMenu) ?? [];
const nativeProbeNote = busyPhases.length ? `The selected packaged ${link(probe.path)} measured ${busyPhases.map(phase => `${phase.name}: maximum main timer gap ${fmt(phase.mainHeartbeat?.maxMs)} ms, ${phase.nativeMenu.label} dispatch ${fmt(phase.nativeMenu.mainClickRoundTripMs)} ms`).join('; ')}. Selected package/probe ASAR hashes match: **${summary.nativeEvidenceConsistency.selectedPackageAndProbeAsarMatch}**.` : 'The selected integrated package responsiveness probe is not yet available in this collection.';
const markdown = `# Verification record

Generated ${summary.generatedAt}. This records tested behavior and limits; it does not declare the project complete or establish perfect Parabolic parity.

Renderer SHA-256: \`${build.data?.rendererSha256 ?? 'unavailable'}\`. Current renderer matches: **${summary.build.rendererMatches}**. Build/source fingerprints, report hashes, failures, and measurements are retained in ${link(output)} and ${link(buildPath)}.

| Current evidence | Result | Status |
| --- | --- | --- |
${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}

| Historical evidence retained separately | Result | Status |
| --- | --- | --- |
${historicalRows.map(([name,report]) => `| ${link(report.evidence.path)} — ${name} | ${browserLine(report)} | ${report.status} |`).join('\n')}

The earlier failed full runs remain preserved. The sub-issue fixture correction explicitly selects Todo for active-cycle inheritance; its focused follow-up does not replace a full matrix. The prior verification snapshot remains in ${link(summary.priorVerificationSnapshot.path)}.

Browser build records identify the renderer only. Their API service runs repository source; history-race tests additionally load current client store source through Vite. These source-harness cases have separate counts in the JSON. Current reports without their own build records require the enclosing frozen-run provenance to establish renderer identity.

The ${link(summary.fontAssets.current.evidence.path)} records normal/italic asset delivery and 20 actual-app/reference text-metric comparisons per browser. A partial engine report is incomplete; a different renderer remains separate evidence. The WOFF2 files, source/public licenses, root HTML, font entrypoint, declarations, and size helper require explicit hashes in the selected build's critical-file map because the general runtime-source scan excludes binary/license assets. Missing capture keys are listed in the JSON. These checks establish asset selection, not installed-app pixel or rasterization parity.

Native smoke, service lifecycle and installed SDK archive checks remain separate suites. Selected package/lifecycle ASAR hashes match: **${summary.nativeEvidenceConsistency.selectedPackageAndLifecycleAsarMatch ?? 'unavailable'}**. The original package and ${link(baselineProbePath)} remain preserved. The old-server utility comparison is separately recorded in ${link(`${utilityComparisonRoot}/service-equivalence.json`)} and ${link(comparisonProbePath)}; it is not proof for subsequent integrated source changes.

${nativeProbeNote}

| Issues | Matches current renderer | First row (ms) | Full hydration (ms) | Warm input p95 (ms) | Mounted rows | Last-row scroll (ms) |
| --- | --- | --- | --- | --- | --- | --- |
${summary.performance.map(({ report: p,rendererMatches }) => `| ${p?.issueCount ?? '?'} | ${rendererMatches} | ${fmt(p?.firstRowMs)} | ${fmt(p?.hydratedMs)} | ${fmt(p?.rendererInput?.warmP95Ms)} | ${p?.mountedRows ?? '?'} | ${fmt(p?.scrollToLastMs)} |`).join('\n')}

Warm input is pointerdown to the second animation-frame callback, not physical display latency. A benchmark whose renderer hash differs is historical evidence. The archived 7571 100,000-issue run occurred alongside other browser suites, not on an isolated machine; each raw report retains its environment and execution context.

Regenerate without building or running tests:

\`\`\`sh
node scripts/verification-summary.mjs --typecheck-exit-code 0
\`\`\`

Use the exit code actually observed for the referenced typecheck log. Defaults derive the current engine and integrated native folders from the verified renderer hash. Override paths with \`--build\`, \`--renderer\`, \`--node-log\`, \`--typecheck-log\`, \`--chromium-report\`, \`--chromium-build\`, \`--engine-dir\`, \`--engine-report\`, \`--engine-build\`, \`--engine-followup\`, \`--engine-followup-build\`, \`--font-report\`, \`--native-dir\`, \`--native-lifecycle-report\`, \`--native-probe\`, \`--performance-10000\`, \`--performance-100000\`, and \`--prior-summary\`. \`--output\` and \`--markdown-output\` select generated destinations. Missing or incomplete evidence stays explicit; the collector never converts a failed baseline into a pass.
`;
await mkdir(dirname(markdownOutput), {recursive:true});
await writeFile(markdownOutput, markdown);
console.log(JSON.stringify({ output: label(output), node: summary.node.status, typecheck: summary.typecheck.status, chromium: summary.browsers.chromiumCurrentFull.status, engines: summary.browsers.enginesCurrentFull.status, native:summary.packages.native.status, lifecycle:summary.packages.serviceLifecycle.status }));
