const fs = require('fs');
const path = require('path');
const db = require('../db');

async function migrate() {
  console.log('Running database migrations...');
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Create extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS cube');
    await client.query('CREATE EXTENSION IF NOT EXISTS earthdistance');

    // If deals table exists, drop legacy test constraints or migrate
    await client.query(`
      DROP TABLE IF EXISTS audit_log CASCADE;
      DROP TABLE IF EXISTS fund_events CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS disputes CASCADE;
      DROP TABLE IF EXISTS submissions CASCADE;
      DROP TABLE IF EXISTS milestones CASCADE;
      DROP TABLE IF EXISTS requests CASCADE;
      DROP TABLE IF EXISTS deals CASCADE;
    `);

    const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    await client.query(schemaSql);

    await client.query('COMMIT');
    console.log('Database migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;
