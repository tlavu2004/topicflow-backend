const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Reporter = require('./ci-reporter.cjs');

test('failure diagnostics retain locations without retaining sensitive Jest payloads', (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'topicflow-ci-reporter-'),
  );
  t.after(() => {
    const target = path.resolve(directory);
    if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw new Error('Unexpected temporary directory');
    fs.rmSync(target, { recursive: true, force: true });
  });
  const reporter = new Reporter(
    { rootDir: process.cwd() },
    { group: 'integration' },
  );
  reporter.directory = directory;
  reporter.onRunStart();
  const read = () =>
    fs.readFileSync(path.join(directory, 'report.json'), 'utf8');
  assert.equal(JSON.parse(read()).status, 'running');
  const secret = 'sensitive-password-jwt-connection-string';
  reporter.onRunComplete(null, {
    success: false,
    numPassedTests: 0,
    numFailedTests: 1,
    numPendingTests: 0,
    testResults: [
      {
        testFilePath: path.join(process.cwd(), 'test/auth.integration-spec.ts'),
        numPassingTests: 0,
        numFailingTests: 1,
        numPendingTests: 0,
        testExecError: { message: secret },
        console: [secret],
        failureMessage: secret,
        testResults: [
          {
            title: secret,
            fullName: secret,
            status: 'failed',
            location: { line: 42 },
            duration: 10,
            failureMessages: [secret],
          },
        ],
      },
    ],
  });
  const report = JSON.parse(read());
  assert.equal(report.status, 'failed');
  assert.equal(report.suites[0].file, 'test/auth.integration-spec.ts');
  assert.equal(report.suites[0].assertions[0].line, 42);
  assert.equal(report.suites[0].runtimeError, true);
  assert.equal(read().includes(secret), false);
  assert.equal(
    fs
      .readFileSync(path.join(directory, 'execution.log'), 'utf8')
      .includes(secret),
    false,
  );
  // `success` is not available yet in Jest's onRunComplete callback.
  reporter.onRunComplete(null, {
    numPassedTests: 1,
    numFailedTests: 0,
    numFailedTestSuites: 0,
    numPendingTests: 0,
    numTotalTests: 1,
    testResults: [],
  });
  assert.equal(JSON.parse(read()).status, 'passed');
  reporter.onRunComplete(null, {
    numPassedTests: 1,
    numFailedTests: 0,
    numFailedTestSuites: 0,
    numPendingTests: 0,
    numTotalTests: 1,
    testResults: [],
    wasInterrupted: true,
  });
  assert.equal(JSON.parse(read()).status, 'failed');
});

test('report groups cannot escape the artifact directory', () => {
  assert.throws(
    () => new Reporter({ rootDir: '.' }, { group: '../../elsewhere' }),
    /Unknown test report group/,
  );
});
