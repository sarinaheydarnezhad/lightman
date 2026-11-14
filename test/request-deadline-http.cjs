// Runs outside the RN Jest preset to exercise Node's actual standards-based fetch/streams.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const Module = require('node:module');
const ts = require('typescript');
const file = require.resolve('../src/core/sync/request-deadline.ts');
const compiled = new Module(file, module);
compiled._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  file,
);
const { withRequestDeadline } = compiled.exports;

function barrier() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function main() {
  let handle = (_request, response) => response.end('{}');
  const server = http.createServer((request, response) => handle(request, response));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const requests = new Set();
  const results = [];
  const request = (consume = (response) => response.json(), init = {}, timeout = 500) =>
    withRequestDeadline(url, init, consume, requests, timeout);
  async function scenario(name, run) {
    await run();
    assert.equal(requests.size, 0);
    results.push({ name, passed: true });
  }
  try {
    await fetch(url).then((response) => response.json()); // Warm the native transport before short deadlines.
    await scenario('headers received; body never ends', async () => {
      const entered = barrier();
      handle = (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.flushHeaders();
      };
      const work = request((response) => {
        entered.resolve();
        return response.json();
      });
      await entered.promise;
      await assert.rejects(work, { code: 'request_timeout' });
    });
    await scenario('delayed headers exceed overall deadline', async () => {
      handle = () => {};
      await assert.rejects(request(), { code: 'request_timeout' });
    });
    await scenario('partial JSON followed by a stall', async () => {
      handle = (_req, res) => {
        res.writeHead(200);
        res.write('{"partial":');
      };
      await assert.rejects(request(), { code: 'request_timeout' });
    });
    await scenario('partial JSON then interrupted TCP response', async () => {
      let current;
      handle = (_req, res) => {
        current = res;
        res.writeHead(200, { 'Content-Length': '100' });
        res.write('{"partial":');
      };
      await assert.rejects(
        request((response) => {
          const body = response.json();
          current.destroy();
          return body;
        }),
        TypeError,
      );
    });
    await scenario('delayed body within deadline completes', async () => {
      const gate = barrier();
      handle = async (_req, res) => {
        res.writeHead(200);
        res.flushHeaders();
        await gate.promise;
        res.end('{"complete":true}');
      };
      const result = await request((response) => {
        gate.resolve();
        return response.json();
      });
      assert.deepEqual(result, { complete: true });
    });
    await scenario('caller cancels during body consumption', async () => {
      const external = new AbortController();
      handle = (_req, res) => {
        res.writeHead(200);
        res.write('{"partial":');
      };
      await assert.rejects(
        request(
          (response) => {
            const body = response.json();
            external.abort();
            return body;
          },
          { signal: external.signal },
        ),
        { code: 'request_cancelled' },
      );
    });
    await scenario('delayed HTTP error body is bounded', async () => {
      handle = (_req, res) => {
        res.writeHead(503);
        res.flushHeaders();
      };
      await assert.rejects(request(), { code: 'request_timeout' });
    });
    await scenario('binary body is covered by the same transport primitive', async () => {
      handle = (_req, res) => {
        res.writeHead(200);
        res.end(Buffer.from([1, 2, 3]));
      };
      const body = await request((response) => response.arrayBuffer());
      assert.deepEqual([...new Uint8Array(body)], [1, 2, 3]);
    });
    await scenario('large JSON body remains supported', async () => {
      const data = 'x'.repeat(1_493_000);
      handle = (_req, res) => res.end(JSON.stringify({ data }));
      assert.equal((await request(undefined, {}, 12_000)).data.length, data.length);
    });
    await scenario('empty and invalid JSON terminal outcomes', async () => {
      handle = (_req, res) => {
        res.writeHead(204);
        res.end();
      };
      assert.equal(await request(async (response) => response.status), 204);
      handle = (_req, res) => res.end('{');
      await assert.rejects(request(), SyntaxError);
    });
    process.stdout.write(
      JSON.stringify({ transport: 'Node native fetch over loopback TCP', results }) + '\n',
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  process.stderr.write(error.stack + '\n');
  process.exitCode = 1;
});
