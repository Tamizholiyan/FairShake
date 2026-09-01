const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/auth/categories - List available service categories
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, description FROM service_categories ORDER BY id ASC');
    res.json({ categories: rows });
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ error: 'Failed to fetch service categories' });
  }
});

// POST /api/auth/register - Two-step signup flow per Section 5
router.post('/register', async (req, res) => {
  const { name, email, password, phone, role, service_category_id, admin_id, latitude, longitude, address_text } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  const requestedRole = (role || 'CLIENT').toUpperCase();
  if (!['CLIENT', 'PROVIDER', 'MEDIATOR'].includes(requestedRole)) {
    return res.status(400).json({ error: 'Invalid role selected. Must be CLIENT, PROVIDER, or MEDIATOR.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Check unique email
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    let validCategoryId = null;

    // Role-specific validation
    if (requestedRole === 'PROVIDER') {
      if (!service_category_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Please select a primary service category for your provider account.' });
      }
      const catCheck = await client.query('SELECT id FROM service_categories WHERE id = $1', [service_category_id]);
      if (catCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Selected service category does not exist.' });
      }
      validCategoryId = service_category_id;
    }

    if (requestedRole === 'MEDIATOR') {
      if (!admin_id || !/^ADM\d{3}$/.test(admin_id.trim().toUpperCase())) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid Admin ID format. Must be in the format ADM001.' });
      }

      const adminCode = admin_id.trim().toUpperCase();
      const { rows: codeRows } = await client.query(
        'SELECT id, is_used FROM admin_ids WHERE code = $1 FOR UPDATE',
        [adminCode]
      );

      if (codeRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Admin ID does not exist in the authorized whitelist.' });
      }

      if (codeRows[0].is_used) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'This Admin ID has already been claimed by another account.' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const { rows: userRows } = await client.query(
      `INSERT INTO users (name, email, password_hash, phone, role, service_category_id, latitude, longitude, address_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, email, phone, role, service_category_id, latitude, longitude, address_text, created_at`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        phone || null,
        requestedRole,
        validCategoryId,
        latitude || null,
        longitude || null,
        address_text || null,
      ]
    );

    const newUser = userRows[0];

    // If mediator, claim code atomically in the same transaction
    if (requestedRole === 'MEDIATOR') {
      const adminCode = admin_id.trim().toUpperCase();
      await client.query(
        'UPDATE admin_ids SET is_used = TRUE, used_by_user_id = $1 WHERE code = $2',
        [newUser.id, adminCode]
      );
    }

    await client.query('COMMIT');

    const token = generateToken(newUser);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        service_category_id: newUser.service_category_id,
        latitude: newUser.latitude,
        longitude: newUser.longitude,
        address_text: newUser.address_text,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account: ' + error.message });
  } finally {
    client.release();
  }
});

// POST /api/auth/login - Single login form for all roles per Section 4
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { rows } = await db.query(
      `SELECT u.*, sc.name as category_name 
       FROM users u
       LEFT JOIN service_categories sc ON u.service_category_id = sc.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      service_category_id: user.service_category_id,
      category_name: user.category_name,
      latitude: user.latitude,
      longitude: user.longitude,
      address_text: user.address_text,
    };

    const token = generateToken(safeUser);

    res.json({
      message: 'Login successful',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Failed to login' });
  }
});

// GET /api/auth/me - Current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.service_category_id, u.latitude, u.longitude, u.address_text,
              sc.name as category_name
       FROM users u
       LEFT JOIN service_categories sc ON u.service_category_id = sc.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
