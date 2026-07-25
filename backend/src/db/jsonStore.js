const fs = require('fs/promises');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'database.json');

async function readDb() {
  const raw = await fs.readFile(dbPath, 'utf8');
  return JSON.parse(raw);
}

async function writeDb(data) {
  await fs.writeFile(dbPath, `${JSON.stringify(data, null, 2)}\n`);
}

async function updateDb(mutator) {
  const data = await readDb();
  const result = await mutator(data);
  await writeDb(data);
  return result;
}

module.exports = { readDb, writeDb, updateDb };
