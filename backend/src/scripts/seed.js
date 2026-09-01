// scripts/seed.js
// Seeds service categories, admin whitelist IDs, and default test accounts

const bcrypt = require('bcryptjs');
const db = require('../db');

async function seed() {
  console.log('Seeding Fairshake database...');
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    // 1. Seed Service Categories (Section 5)
    const categories = [
      'Plumber',
      'Electrician',
      'Carpenter',
      'Painter',
      'Interior Designer',
      'Mason / Construction',
      'Appliance Repair',
      'Cleaning',
      'Landscaping / Gardening',
      'Other',
    ];

    const categoryMap = {};
    for (const cat of categories) {
      const { rows } = await client.query(
        `INSERT INTO service_categories (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name`,
        [cat]
      );
      categoryMap[cat] = rows[0].id;
    }
    console.log('✓ Seeded 10 Service Categories');

    // 2. Seed Admin Whitelist Codes ADM001 - ADM010 (Section 5)
    const adminCodes = ['ADM001', 'ADM002', 'ADM003', 'ADM004', 'ADM005', 'ADM006', 'ADM007', 'ADM008', 'ADM009', 'ADM010'];
    for (const code of adminCodes) {
      await client.query(
        `INSERT INTO admin_ids (code, is_used)
         VALUES ($1, FALSE)
         ON CONFLICT (code) DO NOTHING`,
        [code]
      );
    }
    console.log('✓ Seeded Admin IDs: ADM001 to ADM010');

    // 3. Seed Default Test Accounts
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // Client
    const { rows: clientUser } = await client.query(
      `INSERT INTO users (name, email, password_hash, phone, role, latitude, longitude, address_text)
       VALUES ($1, $2, $3, $4, 'CLIENT', $5, $6, $7)
       ON CONFLICT (email) DO UPDATE 
       SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['Arjun Mehta', 'client@fairshake.com', passwordHash, '+919876543210', 12.9716, 77.5946, 'Indiranagar, Bangalore, Karnataka']
    );

    // Provider (Mason / Construction)
    const { rows: providerUser } = await client.query(
      `INSERT INTO users (name, email, password_hash, phone, role, service_category_id, latitude, longitude, address_text)
       VALUES ($1, $2, $3, $4, 'PROVIDER', $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE 
       SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash, service_category_id = EXCLUDED.service_category_id
       RETURNING id`,
      ['Rohan Builders', 'provider@fairshake.com', passwordHash, '+919876543211', categoryMap['Mason / Construction'], 12.9784, 77.6408, 'Koramangala, Bangalore, Karnataka']
    );

    // Mediator
    const { rows: mediatorUser } = await client.query(
      `INSERT INTO users (name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, 'MEDIATOR')
       ON CONFLICT (email) DO UPDATE 
       SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash
       RETURNING id`,
      ['Fairshake Support Agent', 'mediator@fairshake.com', passwordHash, '+919876543212']
    );

    // Mark ADM001 as used by default mediator
    await client.query(
      'UPDATE admin_ids SET is_used = TRUE, used_by_user_id = $1 WHERE code = $2',
      [mediatorUser[0].id, 'ADM001']
    );

    console.log('✓ Seeded Users: client@fairshake.com, provider@fairshake.com, mediator@fairshake.com');

    await client.query('COMMIT');
    console.log('✅ Database initialization and seeding complete.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
