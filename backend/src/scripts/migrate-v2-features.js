const { pool } = require('../db');

async function migrate() {
  console.log('Running Fairshake v2 Feature Migration...');

  const migrationQueries = `
    -- 12. Saved Addresses Table
    CREATE TABLE IF NOT EXISTS addresses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label VARCHAR(50) DEFAULT 'Home',
      address_text TEXT NOT NULL,
      area_text VARCHAR(150),
      district_text VARCHAR(150),
      latitude NUMERIC(10, 7),
      longitude NUMERIC(10, 7),
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- 13. Provider Applications / Proposals Table
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      proposed_amount NUMERIC(12, 2),
      message TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(request_id, provider_id)
    );

    -- 14. Cancellation / Refund Requests Table
    CREATE TABLE IF NOT EXISTS cancellation_requests (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      unreleased_amount NUMERIC(12, 2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      mediator_notes TEXT,
      resolved_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
    );

    -- 15. Provider Ratings Table
    CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
      review_text TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(request_id, client_id)
    );

    -- 16. Multi-photo Submissions Files Table
    CREATE TABLE IF NOT EXISTS submission_files (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      file_url TEXT NOT NULL,
      original_filename TEXT,
      sha256_hash VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    await pool.query(migrationQueries);
    console.log('✓ Migration completed successfully: All new tables created.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
