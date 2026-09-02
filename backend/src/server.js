const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const milestoneRoutes = require('./routes/milestones');
const disputeRoutes = require('./routes/disputes');
const messageRoutes = require('./routes/messages');
const addressesRoutes = require('./routes/addresses');
const ratingsRoutes = require('./routes/ratings');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded deliverables
const uploadsPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/deals', requestRoutes); // Backward compatibility
app.use('/api/milestones', milestoneRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/addresses', addressesRoutes);
app.use('/api/ratings', ratingsRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Fairshake Secure Payment Engine',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.send('Fairshake API is active.');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[UNCAUGHT ERROR]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Fairshake Backend Server running on port ${PORT}`);
  });
}

module.exports = app;
