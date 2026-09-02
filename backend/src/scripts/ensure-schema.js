const fs = require('fs');
const path = require('path');
const db = require('../db');

async function ensureSchema() {
  console.log('Verifying & applying full Fairshake schema...');
  const client = await db.getClient();
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('✓ All tables, columns, and seeds verified successfully.');
  } catch (error) {
    console.error('Schema verification error:', error);
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

ensureSchema();
