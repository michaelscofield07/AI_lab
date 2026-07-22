const vm = require('vm');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const runJavaScript = (code, testCases) => {
  let passedCount = 0;
  let consoleOutput = '';
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const logs = [];
    const sandbox = {
      console: {
        log: (...args) => {
          logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
        },
      },
    };

    try {
      const context = vm.createContext(sandbox);
      
      // If code defines a function named 'solution', call it with the inputs.
      // Otherwise, just execute the script and check return or log.
      let runCode = code;
      if (code.includes('function solution')) {
        runCode += `\n\nsolution(${tc.input});`;
      } else {
        // If they wrote a simple script, we inject the input as a global variable
        sandbox.input = tc.input;
      }

      const script = new vm.Script(runCode);
      const result = script.runInContext(context, { timeout: 1000 });
      
      const actualOutput = logs.length > 0 
        ? logs[logs.length - 1].trim() 
        : (result !== undefined ? String(result).trim() : '');
        
      const expected = tc.expectedOutput.trim();
      const isPassed = actualOutput === expected;

      if (isPassed) passedCount++;

      results.push({
        testCaseIndex: i,
        input: tc.input,
        expectedOutput: expected,
        actualOutput: actualOutput,
        passed: isPassed,
        logs: logs.join('\n'),
      });

      consoleOutput += `Test Case ${i + 1}: Input [${tc.input}] => Expected [${expected}], Got [${actualOutput}] - ${isPassed ? 'PASSED' : 'FAILED'}\n`;
      if (logs.length > 0) {
        consoleOutput += `Logs:\n${logs.join('\n')}\n`;
      }
    } catch (err) {
      results.push({
        testCaseIndex: i,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: err.message,
        passed: false,
        error: true,
      });
      consoleOutput += `Test Case ${i + 1}: Error: ${err.message}\n`;
      break;
    }
  }

  return {
    passedCount,
    totalCount: testCases.length,
    results,
    consoleOutput,
    status: passedCount === testCases.length ? 'pass' : 'fail',
  };
};

const runPython = (code, testCases) => {
  let passedCount = 0;
  let consoleOutput = '';
  const results = [];
  const tempDir = path.join(__dirname, '../../temp');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFile = path.join(tempDir, `solution_${Date.now()}.py`);
  fs.writeFileSync(tempFile, code);

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    try {
      // Run Python script. We can pass the test case input as standard input or argument.
      // We will feed the input into stdin of the python process.
      // We run: python3 tempFile
      const stdout = execSync(`python3 "${tempFile}"`, {
        input: tc.input,
        encoding: 'utf-8',
        timeout: 1500,
      });

      const actualOutput = stdout.trim();
      const expected = tc.expectedOutput.trim();
      const isPassed = actualOutput === expected;

      if (isPassed) passedCount++;

      results.push({
        testCaseIndex: i,
        input: tc.input,
        expectedOutput: expected,
        actualOutput: actualOutput,
        passed: isPassed,
      });

      consoleOutput += `Test Case ${i + 1}: Input [${tc.input}] => Expected [${expected}], Got [${actualOutput}] - ${isPassed ? 'PASSED' : 'FAILED'}\n`;
    } catch (err) {
      results.push({
        testCaseIndex: i,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: err.stderr || err.message,
        passed: false,
        error: true,
      });
      consoleOutput += `Test Case ${i + 1}: Error: ${err.stderr || err.message}\n`;
      break;
    }
  }

  // clean up
  try {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  } catch (e) {
    // ignore clean up error
  }

  return {
    passedCount,
    totalCount: testCases.length,
    results,
    consoleOutput,
    status: passedCount === testCases.length ? 'pass' : 'fail',
  };
};

const runCode = (code, testCases, language = 'javascript') => {
  if (language === 'python') {
    try {
      // Check if python3 is available
      execSync('python3 --version');
      return runPython(code, testCases);
    } catch (e) {
      return {
        passedCount: 0,
        totalCount: testCases.length,
        results: [],
        consoleOutput: 'Python execution is not available on this server host. Please use JavaScript.',
        status: 'compile_error',
      };
    }
  } else {
    return runJavaScript(code, testCases);
  }
};

module.exports = { runCode };
