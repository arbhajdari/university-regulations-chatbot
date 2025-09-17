const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Environment variables check
if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 Environment check: Development mode');
}

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000']
}));

// Middleware setup
app.use(express.json({ limit: '10mb' })); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static('public')); // Serve static files from public directory

// MongoDB connection with environment variables
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_chatbot';
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ Connected to MongoDB');
    console.log(`📍 Database: ${mongoUri}`);
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// MongoDB connection event handlers
mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development',
        authType: 'email/password'
    });
});

// API routes
app.use('/api/auth', require('./routes/auth')); // Authentication routes
app.use('/api/rag-chat', require('./routes/ragChat')); // GPT-4 RAG chat system (ACTIVE)
app.use('/api/admin', require('./routes/admin')); // Admin panel routes

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    
    const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    res.status(500).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// 404 handler for other routes
app.use('*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 University Regulation Chatbot server running on port ${PORT}`);
    console.log(`📱 Access the application at: http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📧 Email policy: Any email domain accepted`);
    
    // Security warnings
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('your_super_secret')) {
        console.warn('⚠️  Warning: Please set a secure JWT_SECRET in your .env file');
    }
    
    if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 Development mode - detailed error logging enabled');
        console.log('🔑 Authentication: Email/Password only');
    }
});