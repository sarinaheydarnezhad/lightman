import { execFile } from 'node:child_process';

test('real loopback HTTP: stalled, partial, interrupted, cancelled and large response bodies', async () => {
  const result = await new Promise<string>((resolve, reject) => {
    execFile(
      process.execPath,
      [require.resolve('../../../test/request-deadline-http.cjs')],
      { timeout: 45_000, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${error.message}\n${stdout}\n${stderr}`));
        else resolve(stdout);
      },
    );
  });
  const evidence = JSON.parse(result);
  expect(evidence.results).toHaveLength(10);
  expect(evidence.results.every((item: { passed: boolean }) => item.passed)).toBe(true);
}, 50_000);
