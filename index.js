require('dotenv').config();
const express = require('express');
const http = require('http');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');


const app = express();
const server = http.createServer(app);

const CONFIG = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cjuyyb2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`,
  DB_NAME: process.env.DB_NAME || 'courier_tracking',
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret_change_in_production',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_change_in_production',
  JWT_EXPIRE: '15m',
  REFRESH_EXPIRE: '7d',
  BCRYPT_ROUNDS: 12,
  GOOGLE_MAPS_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  CLIENT_URL: process.env.CLIENT_URL || 'https://curier-client.vercel.app/'
};

// MongoDB Client
let db;
let mongoClient;
 const cleanClientUrl = CONFIG.CLIENT_URL.endsWith('/') 
  ? CONFIG.CLIENT_URL.slice(0, -1) 
  : CONFIG.CLIENT_URL;
// Socket.IO
const io = require('socket.io')(server, {
  cors: {
    origin: cleanClientUrl,  
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
});


let emailTransporter = null;
if (CONFIG.SMTP_USER && CONFIG.SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: CONFIG.SMTP_HOST,
    port: CONFIG.SMTP_PORT,
    secure: false,
    auth: {
      user: CONFIG.SMTP_USER,
      pass: CONFIG.SMTP_PASS
    }
  });
}


app.use(helmet());


app.use(cors({
  origin: cleanClientUrl,  
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);


async function connectDatabase() {
  try {
    mongoClient = new MongoClient(CONFIG.MONGO_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    await mongoClient.connect();
    
    // Test connection
    await mongoClient.db("admin").command({ ping: 1 });
    
    db = mongoClient.db(CONFIG.DB_NAME);

    // Create indexes
    await createIndexes();

    console.log('✅ MongoDB Connected Successfully → ' + CONFIG.DB_NAME);
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    process.exit(1);
  }
}

async function createIndexes() {
  try {
    const users = db.collection('users');
    const parcels = db.collection('parcels');
    const tracking = db.collection('tracking');
    
    await users.createIndex({ email: 1 }, { unique: true });
    await parcels.createIndex({ trackingId: 1 }, { unique: true });
    await parcels.createIndex({ customerId: 1 });
    await parcels.createIndex({ assignedAgentId: 1 });
    await parcels.createIndex({ status: 1 });
    await parcels.createIndex({ createdAt: -1 });
    await tracking.createIndex({ parcelId: 1, timestamp: -1 });
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('⚠️  Index creation warning:', error.message);
  }
}

function generateTrackingId() {
  const prefix = 'TRK';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${timestamp}${random}`;
}

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, CONFIG.JWT_SECRET, {
    expiresIn: CONFIG.JWT_EXPIRE
  });
  
  const refreshToken = jwt.sign({ userId }, CONFIG.JWT_REFRESH_SECRET, {
    expiresIn: CONFIG.REFRESH_EXPIRE
  });
  
  return { accessToken, refreshToken };
}

async function sendEmail(to, subject, html) {
  if (!emailTransporter) {
    console.log('Email not configured, skipping...');
    return;
  }
  
  try {
    await emailTransporter.sendMail({
      from: CONFIG.SMTP_USER,
      to,
      subject,
      html
    });
    console.log('Email sent to: ' + to);
  } catch (error) {
    console.error('Email error:', error.message);
  }
}

async function generateQRCode(trackingId) {
  try {
    const qrData = JSON.stringify({
      trackingId,
      type: 'parcel',
      url: `${CONFIG.CLIENT_URL}/track/${trackingId}`,
      timestamp: new Date().toISOString()
    });
    
    const qrBase64 = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2
    });
    
    return qrBase64;
  } catch (error) {
    console.error('QR generation error:', error.message);
    return null;
  }
}

async function authMiddleware(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }
    
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }
    
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  socket.on('joinParcel', (trackingId) => {
    socket.join(`parcel:${trackingId}`);
    console.log(`📦 Socket ${socket.id} joined parcel:${trackingId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

function emitParcelUpdate(trackingId, data) {
  io.to(`parcel:${trackingId}`).emit('parcelUpdate', data);
}


// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: db ? 'Connected' : 'Disconnected'
  });
});

// Home Route
app.get('/', (req, res) => {
  res.json({
    message: 'Courier Tracking System API',
    version: '1.0.0',
    status: 'Running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      parcels: '/api/parcels',
      users: '/api/users',
      analytics: '/api/analytics',
      reports: '/api/reports'
    }
  });
});


// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const users = db.collection('users');
    
    // Check existing user
    const existingUser = await users.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, CONFIG.BCRYPT_ROUNDS);
    
    // Create user
    const newUser = {
      name,
      email: email.toLowerCase(),
      passwordHash,
      phone: phone || '',
      role: role || 'customer',
      isActive: true,
      refreshToken: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await users.insertOne(newUser);
    const userId = result.insertedId;
    
    // Generate tokens
    const tokens = generateTokens(userId);
    await users.updateOne(
      { _id: userId },
      { $set: { refreshToken: tokens.refreshToken } }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userId.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      },
      tokens
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }
    
    const users = db.collection('users');
    const user = await users.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    
    // Generate tokens
    const tokens = generateTokens(user._id);
    await users.updateOne(
      { _id: user._id },
      { $set: { refreshToken: tokens.refreshToken, updatedAt: new Date() } }
    );
    
    res.json({
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      },
      tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Refresh Token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    const decoded = jwt.verify(refreshToken, CONFIG.JWT_REFRESH_SECRET);
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const tokens = generateTokens(user._id);
    await users.updateOne(
      { _id: user._id },
      { $set: { refreshToken: tokens.refreshToken } }
    );
    
    res.json({ tokens });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});


// Get all users (Admin)
app.get('/api/users', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const users = db.collection('users');
    const allUsers = await users.find(
      {},
      { projection: { passwordHash: 0, refreshToken: 0 } }
    ).toArray();
    
    res.json(allUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get customer bookings
app.get('/api/users/customers/:id/bookings', authMiddleware, async (req, res) => {
  try {
    const customerId = new ObjectId(req.params.id);
    
    // Check access
    if (req.userRole !== 'admin' && req.userId.toString() !== customerId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const parcels = db.collection('parcels');
    const bookings = await parcels.find({ customerId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get agent parcels
app.get('/api/users/agents/:id/parcels', authMiddleware, authorize('agent', 'admin'), async (req, res) => {
  try {
    const agentId = new ObjectId(req.params.id);
    
    const parcels = db.collection('parcels');
    const agentParcels = await parcels.find({ assignedAgentId: agentId })
      .sort({ createdAt: -1 })
      .toArray();
    
    // Populate customer info
    const users = db.collection('users');
    for (let parcel of agentParcels) {
      const customer = await users.findOne(
        { _id: parcel.customerId },
        { projection: { name: 1, phone: 1, email: 1 } }
      );
      parcel.customer = customer;
    }
    
    res.json(agentParcels);
  } catch (error) {
    console.error('Get agent parcels error:', error);
    res.status(500).json({ error: 'Failed to fetch parcels' });
  }
});


// Create Parcel
app.post('/api/parcels', authMiddleware, authorize('customer', 'admin'), async (req, res) => {
  try {
    const {
      pickupAddress,
      deliveryAddress,
      pickupCoords,
      deliveryCoords,
      size,
      weight,
      type,
      codAmount,
      paymentStatus,
      declaredValue,
      notes
    } = req.body;
    
    // Validation
    if (!pickupAddress || !deliveryAddress || !size || !type) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }
    
    const trackingId = generateTrackingId();
    const qrCodeUrl = await generateQRCode(trackingId);
    
    const parcels = db.collection('parcels');
    const newParcel = {
      trackingId,
      customerId: req.userId,
      pickupAddress,
      deliveryAddress,
      pickupCoords: pickupCoords || null,
      deliveryCoords: deliveryCoords || null,
      size,
      weight: parseFloat(weight) || 0,
      type,
      codAmount: parseFloat(codAmount) || 0,
      paymentStatus: paymentStatus || 'Pending',
      declaredValue: parseFloat(declaredValue) || 0,
      notes: notes || '',
      assignedAgentId: null,
      status: 'Pending',
      statusHistory: [{
        status: 'Pending',
        by: req.userId,
        at: new Date(),
        note: 'Booking created'
      }],
      qrCodeUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await parcels.insertOne(newParcel);
    newParcel._id = result.insertedId;
    
    // Send email notification
    const users = db.collection('users');
    const customer = await users.findOne({ _id: req.userId });
    
    if (customer && customer.email) {
      const emailHtml = `
        <h2>Booking Confirmation</h2>
        <p>Dear ${customer.name},</p>
        <p>Your parcel has been successfully booked.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Tracking ID:</strong> ${trackingId}</p>
          <p><strong>Pickup:</strong> ${pickupAddress}</p>
          <p><strong>Delivery:</strong> ${deliveryAddress}</p>
          <p><strong>Status:</strong> ${newParcel.status}</p>
        </div>
        <p>Track your parcel at: ${CONFIG.CLIENT_URL}/track/${trackingId}</p>
      `;
      await sendEmail(customer.email, `Booking Confirmed - ${trackingId}`, emailHtml);
    }
    
    res.status(201).json({
      message: 'Parcel booking created successfully',
      parcel: newParcel
    });
  } catch (error) {
    console.error('Create parcel error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get Parcel by ID
app.get('/api/parcels/:id', authMiddleware, async (req, res) => {
  try {
    const parcels = db.collection('parcels');
    let parcel = await parcels.findOne({ trackingId: req.params.id });
    
    if (!parcel && ObjectId.isValid(req.params.id)) {
      parcel = await parcels.findOne({ _id: new ObjectId(req.params.id) });
    }
    
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    // Check access rights
    if (req.userRole === 'customer' && parcel.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Populate user data
    const users = db.collection('users');
    const customer = await users.findOne(
      { _id: parcel.customerId },
      { projection: { name: 1, email: 1, phone: 1 } }
    );
    parcel.customer = customer;
    
    if (parcel.assignedAgentId) {
      const agent = await users.findOne(
        { _id: parcel.assignedAgentId },
        { projection: { name: 1, phone: 1 } }
      );
      parcel.agent = agent;
    }
    
    res.json(parcel);
  } catch (error) {
    console.error('Get parcel error:', error);
    res.status(500).json({ error: 'Failed to fetch parcel' });
  }
});

// Get All Parcels (Admin)
app.get('/api/parcels', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const { status, startDate, endDate, limit = 100 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const parcels = db.collection('parcels');
    const allParcels = await parcels.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json(allParcels);
  } catch (error) {
    console.error('Get all parcels error:', error);
    res.status(500).json({ error: 'Failed to fetch parcels' });
  }
});

// Assign Agent (Admin)
app.post('/api/parcels/:id/assign', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const { agentId } = req.body;
    
    if (!agentId || !ObjectId.isValid(agentId)) {
      return res.status(400).json({ error: 'Valid agent ID required' });
    }
    
    const parcels = db.collection('parcels');
    const parcel = await parcels.findOne({ _id: new ObjectId(req.params.id) });
    
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    // Check if agent exists
    const users = db.collection('users');
    const agent = await users.findOne({ 
      _id: new ObjectId(agentId),
      role: 'agent'
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Update parcel
    const updateResult = await parcels.updateOne(
      { _id: parcel._id },
      {
        $set: {
          assignedAgentId: new ObjectId(agentId),
          status: 'Assigned',
          updatedAt: new Date()
        },
        $push: {
          statusHistory: {
            status: 'Assigned',
            by: req.userId,
            at: new Date(),
            note: `Assigned to ${agent.name}`
          }
        }
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ error: 'Failed to assign agent' });
    }
    
    // Get updated parcel
    const updatedParcel = await parcels.findOne({ _id: parcel._id });
    
    // Emit real-time update
    emitParcelUpdate(parcel.trackingId, updatedParcel);
    
    // Send email to agent
    if (agent.email) {
      const emailHtml = `
        <h2>New Parcel Assignment</h2>
        <p>Dear ${agent.name},</p>
        <p>A new parcel has been assigned to you.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">
          <p><strong>Tracking ID:</strong> ${parcel.trackingId}</p>
          <p><strong>Pickup:</strong> ${parcel.pickupAddress}</p>
          <p><strong>Delivery:</strong> ${parcel.deliveryAddress}</p>
        </div>
      `;
      await sendEmail(agent.email, `New Assignment - ${parcel.trackingId}`, emailHtml);
    }
    
    res.json({
      message: 'Agent assigned successfully',
      parcel: updatedParcel
    });
  } catch (error) {
    console.error('Assign agent error:', error);
    res.status(500).json({ error: 'Failed to assign agent' });
  }
});

// Update Status (Agent)
app.post('/api/parcels/:id/status', authMiddleware, authorize('agent'), async (req, res) => {
  try {
    const { status, coords, note } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const validStatuses = ['Assigned', 'Picked Up', 'In Transit', 'Delivered', 'Failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const parcels = db.collection('parcels');
    const parcel = await parcels.findOne({ _id: new ObjectId(req.params.id) });
    
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    // Verify agent assignment
    if (!parcel.assignedAgentId || parcel.assignedAgentId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this parcel' });
    }
    
    // Update parcel
    const updateResult = await parcels.updateOne(
      { _id: parcel._id },
      {
        $set: {
          status,
          updatedAt: new Date()
        },
        $push: {
          statusHistory: {
            status,
            by: req.userId,
            at: new Date(),
            coords: coords || null,
            note: note || ''
          }
        }
      }
    );
    
    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ error: 'Failed to update status' });
    }
    
    const updatedParcel = await parcels.findOne({ _id: parcel._id });
    
    // Emit real-time update
    emitParcelUpdate(parcel.trackingId, updatedParcel);
    
    // Send email to customer
    const users = db.collection('users');
    const customer = await users.findOne({ _id: parcel.customerId });
    
    if (customer && customer.email) {
      const emailHtml = `
        <h2>Parcel Status Update</h2>
        <p>Dear ${customer.name},</p>
        <p>Your parcel <strong>${parcel.trackingId}</strong> status has been updated.</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">
          <p><strong>New Status:</strong> ${status}</p>
          ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        </div>
        <p>Track your parcel at: ${CONFIG.CLIENT_URL}/track/${parcel.trackingId}</p>
      `;
      await sendEmail(customer.email, `Status Update - ${parcel.trackingId}`, emailHtml);
    }
    
    res.json({
      message: 'Status updated successfully',
      parcel: updatedParcel
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Update Tracking Location (Agent)
app.post('/api/parcels/:id/track', authMiddleware, authorize('agent'), async (req, res) => {
  try {
    const { coords, speed, heading } = req.body;
    
    if (!coords || !coords.lat || !coords.lng) {
      return res.status(400).json({ error: 'Coordinates required' });
    }
    
    const parcels = db.collection('parcels');
    const parcel = await parcels.findOne({ _id: new ObjectId(req.params.id) });
    
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    // Verify agent
    if (!parcel.assignedAgentId || parcel.assignedAgentId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Save tracking data
    const tracking = db.collection('tracking');
    const trackingData = {
      parcelId: parcel._id,
      agentId: req.userId,
      coords: {
        lat: parseFloat(coords.lat),
        lng: parseFloat(coords.lng)
      },
      speed: speed ? parseFloat(speed) : null,
      heading: heading ? parseFloat(heading) : null,
      timestamp: new Date()
    };
    
    await tracking.insertOne(trackingData);
    
    // Emit real-time location update
    emitParcelUpdate(parcel.trackingId, {
      coords: trackingData.coords,
      timestamp: trackingData.timestamp
    });
    
    res.json({
      message: 'Location updated successfully',
      tracking: trackingData
    });
  } catch (error) {
    console.error('Update tracking error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});


// Daily Metrics (Admin)
app.get('/api/analytics/daily', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const parcels = db.collection('parcels');
    
    const [todayBookings, inTransit, totalDelivered, codData] = await Promise.all([
      parcels.countDocuments({ createdAt: { $gte: today } }),
      parcels.countDocuments({ status: 'In Transit' }),
      parcels.countDocuments({ status: 'Delivered' }),
      parcels.aggregate([
        { $match: { paymentStatus: 'COD' } },
        { $group: { _id: null, total: { $sum: '$codAmount' } } }
      ]).toArray()
    ]);
    
    res.json({
      todayBookings,
      inTransit,
      totalDelivered,
      codTotal: codData[0]?.total || 0
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Booking Trends (Admin)
app.get('/api/analytics/trends', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const parcels = db.collection('parcels');
    const trends = await parcels.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    res.json(trends);
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});


// Bookings Report with CSV Export (Admin)
app.get('/api/reports/bookings', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate, status, agentId, format } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (status) query.status = status;
    if (agentId && ObjectId.isValid(agentId)) {
      query.assignedAgentId = new ObjectId(agentId);
    }
    
    const parcels = db.collection('parcels');
    const bookings = await parcels.find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    if (format === 'csv') {
      const csvHeaders = 'Tracking ID,Customer,Pickup,Delivery,Status,COD Amount,Created\n';
      const csvRows = bookings.map(p => 
        `${p.trackingId},"${p.customerId}","${p.pickupAddress}","${p.deliveryAddress}",${p.status},${p.codAmount},${p.createdAt.toISOString()}`
      ).join('\n');
      
      res.header('Content-Type', 'text/csv');
      res.attachment(`bookings-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csvHeaders + csvRows);
    }
    
    res.json(bookings);
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// COD Summary (Admin)
app.get('/api/reports/cod', authMiddleware, authorize('admin'), async (req, res) => {
  try {
    const parcels = db.collection('parcels');
    const codSummary = await parcels.aggregate([
      {
        $match: {
          paymentStatus: 'COD',
          status: { $in: ['Delivered', 'In Transit'] }
        }
      },
      {
        $group: {
          _id: '$assignedAgentId',
          totalCOD: { $sum: '$codAmount' },
          parcelCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent'
        }
      },
      {
        $unwind: { path: '$agent', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          agentName: { $ifNull: ['$agent.name', 'Unassigned'] },
          agentPhone: { $ifNull: ['$agent.phone', ''] },
          totalCOD: 1,
          parcelCount: 1
        }
      }
    ]).toArray();
    
    res.json(codSummary);
  } catch (error) {
    console.error('COD report error:', error);
    res.status(500).json({ error: 'Failed to generate COD report' });
  }
});

//  Error Handling 
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// tart Server 
async function startServer() {
  try {
    await connectDatabase();
    
    server.listen(CONFIG.PORT, () => {
      console.log('========================================================');
      console.log('');
      console.log('   📦 Courier Tracking System Backend');
      console.log('');
      console.log('   🚀 Server Running: http://localhost:' + CONFIG.PORT);
      console.log('   💾 Database: ' + CONFIG.DB_NAME);
      console.log('   🌍 Environment: ' + (process.env.NODE_ENV || 'development'));
      console.log('');
      console.log('   📡 API Endpoints:');
      console.log('   -> Health Check: GET /health');
      console.log('   -> Auth: POST /api/auth/login');
      console.log('   -> Parcels: POST /api/parcels');
      console.log('   -> Analytics: GET /api/analytics/daily');
      console.log('');
      console.log('========================================================');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful Shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  try {
    if (mongoClient) {
      await mongoClient.close();
      console.log('✅ MongoDB connection closed');
    }
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer();