const fs = require('node:fs');
const path = require('node:path');

// Persist only an allowlist: raw Jest errors, assertions and console output can
// include passwords, JWTs, connection strings or request/response bodies.
class CiReporter {
  constructor(globalConfig, options) {
    if (!['unit', 'e2e', 'integration'].includes(options.group)) {
      throw new Error('Unknown test report group');
    }
    this.root = globalConfig.rootDir;
    this.directory = path.resolve(
      __dirname,
      '../../test-results',
      options.group,
    );
    this.group = options.group;
  }

  onRunStart() {
    fs.mkdirSync(this.directory, { recursive: true });
    fs.writeFileSync(
      path.join(this.directory, 'execution.log'),
      'Test run started\n',
    );
    this.write({ status: 'running' });
  }

  onRunComplete(_contexts, results) {
    const suites = results.testResults.map((suite) => ({
      file: path.relative(this.root, suite.testFilePath).replaceAll('\\', '/'),
      passed: suite.numPassingTests,
      failed: suite.numFailingTests,
      skipped: suite.numPendingTests,
      runtimeError: Boolean(suite.testExecError),
      assertions: suite.testResults.map((test) => ({
        status: test.status,
        line: test.location?.line ?? null,
        durationMs: test.duration ?? null,
      })),
    }));
    // Jest populates `success` after calling reporters; derive it from counts.
    const passed =
      results.numFailedTests === 0 &&
      results.numFailedTestSuites === 0 &&
      !results.wasInterrupted &&
      results.numTotalTests > 0 &&
      suites.every((suite) => !suite.runtimeError);
    this.write({
      status: passed ? 'passed' : 'failed',
      passed: results.numPassedTests,
      failed: results.numFailedTests,
      skipped: results.numPendingTests,
      suites,
    });
    fs.appendFileSync(
      path.join(this.directory, 'execution.log'),
      `Test run ${passed ? 'passed' : 'failed'}: ${results.numPassedTests} passed, ${results.numFailedTests} failed\n`,
    );
  }

  write(report) {
    fs.writeFileSync(
      path.join(this.directory, 'report.json'),
      JSON.stringify({ group: this.group, ...report }, null, 2) + '\n',
    );
  }
}

module.exports = CiReporter;
