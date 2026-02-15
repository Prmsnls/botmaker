
import { initDb, getDb } from './src/db/index.js';
import { getConfig } from './src/config.js';

const config = getConfig();
initDb(config.dataDir);
const db = getDb();

const hostname = 'rosh-test';
const uri = 'http://tb5s815m9pban78kbs28f163hs.ingress.dal.leet.haus';

console.log(`Updating ${hostname} with URI: ${uri}`);

const result = db.prepare('UPDATE bots SET akash_uri = ? WHERE hostname = ?').run(uri, hostname);

console.log('Update result:', result);
