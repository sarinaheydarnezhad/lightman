// Exercises SQLite's real file locks on two worker-thread connections, never a user database.
const { DatabaseSync } = require('node:sqlite');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

if (!isMainThread) {
  const database = new DatabaseSync(workerData.file);
  database.exec('PRAGMA busy_timeout = 5000');
  parentPort.once('message', () => {
    let result;
    try {
      database
        .prepare(
          `INSERT INTO study_sessions
        SELECT ?, scope_json, 'in-progress', started_at, NULL, NULL,
          initial_queue_json, retry_queue_json, 0, 0, workflow_json
        FROM study_sessions WHERE id = ?`,
        )
        .run(workerData.id, workerData.sourceId);
      result = { status: 'created' };
    } catch (error) {
      result = { status: 'rejected', error: error.message };
    } finally {
      database.close();
    }
    parentPort.postMessage(result);
  });
  parentPort.postMessage({ status: 'ready' });
} else {
  if (process.argv[2] === '--interrupt-migration') {
    const database = new DatabaseSync(process.argv[3]);
    database.exec('BEGIN IMMEDIATE');
    database.exec(process.argv[4]);
    database.exec('PRAGMA user_version = 9');
    process.exit(23); // Simulated process interruption before COMMIT, using a synthetic file only.
  }
  if (process.argv[2] === '--inspect') {
    const database = new DatabaseSync(process.argv[3]);
    const version = database.prepare('PRAGMA user_version').get().user_version;
    const triggers = database
      .prepare("SELECT name FROM sqlite_master WHERE name LIKE 'study_single_active_%'")
      .all();
    database.close();
    process.stdout.write(JSON.stringify({ version, triggers }));
    process.exit(0);
  }
  const [one, two, sourceId] = process.argv.slice(2);
  async function main() {
    const workers = [one, two].map(
      (file, index) =>
        new Worker(require.resolve('./sqlite-concurrency.cjs'), {
          workerData: { file, id: `connection-${index}`, sourceId },
        }),
    );
    const resultPromises = workers.map(
      (worker) =>
        new Promise((resolve, reject) => {
          worker.once('error', reject);
          worker.on('message', (message) => {
            if (message.status !== 'ready') resolve(message);
          });
        }),
    );
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise((resolve, reject) => {
            worker.once('error', reject);
            worker.on('message', (message) => {
              if (message.status === 'ready') resolve();
            });
          }),
      ),
    );
    workers.forEach((worker) => worker.postMessage('start'));
    const results = await Promise.all(resultPromises);
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise((resolve, reject) => {
            if (worker.threadId === -1) return resolve();
            worker.once('exit', (code) =>
              code === 0 ? resolve() : reject(new Error(`Worker exit ${code}`)),
            );
          }),
      ),
    );
    const counts = [...new Set([one, two])].map((file) => {
      const database = new DatabaseSync(file);
      try {
        return database
          .prepare("SELECT count(*) AS count FROM study_sessions WHERE status = 'in-progress'")
          .get().count;
      } finally {
        database.close();
      }
    });
    process.stdout.write(JSON.stringify({ results, counts }));
  }
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
