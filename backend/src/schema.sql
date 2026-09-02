-- ====================================================================
-- FAIRSHAKE v2 CONSOLIDATED DATABASE SCHEMA & SEED SCRIPT
-- Paste and run this entire file in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/yjmparxanihpycnmzqgm/sql/new
-- ====================================================================

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- 2. Service Categories Table
CREATE TABLE IF NOT EXISTS service_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Admin IDs Table for Mediator Signup Whitelisting
CREATE TABLE IF NOT EXISTS admin_ids (
  id SERIAL PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL, -- e.g. 'ADM001'
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  used_by_user_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'CLIENT', -- 'CLIENT', 'PROVIDER', 'MEDIATOR'
  service_category_id INTEGER REFERENCES service_categories(id),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  address_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Requests Table (formerly deals)
CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id),
  provider_id INTEGER REFERENCES users(id), -- NULL until accepted by a provider
  category_id INTEGER REFERENCES service_categories(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  total_amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  -- Statuses: DRAFT | PENDING_PAYMENT | OPEN | IN_PROGRESS | COMPLETED | CANCELLED
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  address_text TEXT,
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Milestones Table
CREATE TABLE IF NOT EXISTS milestones (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  sequence INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  -- Statuses: PENDING | SUBMITTED | DISPUTED | IN_MEDIATION | REVISION_REQUESTED | RELEASED
  due_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Submissions Table (Supports Multiple Revision Rounds)
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  original_filename TEXT,
  sha256_hash VARCHAR(64) NOT NULL,
  revision_round INTEGER NOT NULL DEFAULT 1,
  submitted_by INTEGER NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- 8. Disputes / Reported Issues Table
CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  raised_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN | RESOLVED
  resolution VARCHAR(30), -- RELEASED | REVISION_REQUESTED
  mediator_notes TEXT,
  resolved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- 9. Messages Table (Two-Way Support & Dispute Communication)
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  dispute_id INTEGER REFERENCES disputes(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- 10. Internal Fund Events (Server-side Audit Trail)
CREATE TABLE IF NOT EXISTS fund_events (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  milestone_id INTEGER REFERENCES milestones(id),
  event_type VARCHAR(40) NOT NULL,
  -- LOCK_COLLECTED | MILESTONE_RELEASE_SIMULATED | REQUEST_CANCEL_REFUND_REAL
  amount NUMERIC(12, 2) NOT NULL,
  is_real_money BOOLEAN NOT NULL,
  razorpay_reference_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 11. Internal Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  milestone_id INTEGER REFERENCES milestones(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB,
  actor_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

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
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | ACCEPTED | REJECTED | WITHDRAWN
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
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
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

-- ====================================================================
-- SEED INITIAL DATA
-- ====================================================================

-- 1. Insert 10 Service Categories
INSERT INTO service_categories (name) VALUES
  ('Plumber'),
  ('Electrician'),
  ('Carpenter'),
  ('Painter'),
  ('Interior Designer'),
  ('Mason / Construction'),
  ('Appliance Repair'),
  ('Cleaning'),
  ('Landscaping / Gardening'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Admin Whitelist Codes ADM001 to ADM010
INSERT INTO admin_ids (code, is_used) VALUES
  ('ADM001', TRUE),
  ('ADM002', FALSE),
  ('ADM003', FALSE),
  ('ADM004', FALSE),
  ('ADM005', FALSE),
  ('ADM006', FALSE),
  ('ADM007', FALSE),
  ('ADM008', FALSE),
  ('ADM009', FALSE),
  ('ADM010', FALSE)
ON CONFLICT (code) DO NOTHING;

-- 3. Insert Default Test Accounts (Password: 'password123')
-- Client Account: client@fairshake.com
INSERT INTO users (name, email, password_hash, phone, role, latitude, longitude, address_text)
VALUES (
  'Arjun Mehta',
  'client@fairshake.com',
  '$2a$10$6z/3KHHBypk4YF5NKUkkxeNpLGAXJ8NTuzJyz7x77oey0pck7jFJ6',
  '+919876543210',
  'CLIENT',
  12.9716,
  77.5946,
  'Indiranagar, Bangalore, Karnataka'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Provider Account: provider@fairshake.com (Mason / Construction)
INSERT INTO users (name, email, password_hash, phone, role, service_category_id, latitude, longitude, address_text)
VALUES (
  'Rohan Builders',
  'provider@fairshake.com',
  '$2a$10$6z/3KHHBypk4YF5NKUkkxeNpLGAXJ8NTuzJyz7x77oey0pck7jFJ6',
  '+919876543211',
  'PROVIDER',
  (SELECT id FROM service_categories WHERE name = 'Mason / Construction' LIMIT 1),
  12.9784,
  77.6408,
  'Koramangala, Bangalore, Karnataka'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, service_category_id = EXCLUDED.service_category_id;

-- Fairshake Support Mediator Account: mediator@fairshake.com (ADM001)
INSERT INTO users (name, email, password_hash, phone, role)
VALUES (
  'Fairshake Support Agent',
  'mediator@fairshake.com',
  '$2a$10$6z/3KHHBypk4YF5NKUkkxeNpLGAXJ8NTuzJyz7x77oey0pck7jFJ6',
  '+919876543212',
  'MEDIATOR'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Link ADM001 to mediator account
UPDATE admin_ids 
SET is_used = TRUE, used_by_user_id = (SELECT id FROM users WHERE email = 'mediator@fairshake.com')
WHERE code = 'ADM001';
