const express = require('express');
const router = express.Router();
const { generateRAGResponse } = require('../services/gpt4RagService');
const User = require('../models/User');
const AdminSettings = require('../models/AdminSettings');

// POST /api/rag-chat/check-content - Check message for banned words
router.post('/check-content', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string'
      });
    }

    // Check for banned words
    const bannedWordCheck = await AdminSettings.checkForBannedWords(message);
    
    res.json({
      success: true,
      hasViolations: bannedWordCheck.hasBannedWords,
      violations: bannedWordCheck.bannedWords,
      message: bannedWordCheck.hasBannedWords 
        ? `Your message contains prohibited content: ${bannedWordCheck.bannedWords.join(', ')}. Please revise your message.`
        : 'Message is acceptable'
    });

  } catch (error) {
    console.error('❌ Content Check Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/rag-chat - Main chat endpoint using GPT-4 RAG
router.post('/', async (req, res) => {
  try {
    const { message, parameters = {} } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string'
      });
    }

    // Check for banned words before processing
    const bannedWordCheck = await AdminSettings.checkForBannedWords(message);
    if (bannedWordCheck.hasBannedWords) {
      return res.status(400).json({
        success: false,
        error: 'Message contains prohibited content',
        violations: bannedWordCheck.bannedWords,
        message: `Your message contains prohibited content: ${bannedWordCheck.bannedWords.join(', ')}. Please revise your message.`
      });
    }

    console.log(`📝 RAG Chat Request: "${message}"`);
    console.log(`🎛️ Parameters:`, parameters);

    // Generate response using GPT-4 RAG system
    const result = await generateRAGResponse(message, parameters);
    
    if (result.success) {
      res.json({
        success: true,
        response: result.response,
        sources: result.sources,
        tokensUsed: result.tokensUsed,
        parameters: result.parameters
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        fallbackResponse: result.fallbackResponse
      });
    }

  } catch (error) {
    console.error('❌ RAG Chat Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      fallbackResponse: 'I apologize, but I encountered an error. Please contact Student Services for assistance.'
    });
  }
});

// GET /api/rag-chat/history - Get user's chat history
router.get('/history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No valid authentication token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Return user's chat history (default to empty array if none exists)
      const chatHistory = user.chatHistory || [];
      
      res.json({
        success: true,
        data: {
          history: chatHistory
        }
      });

    } catch (tokenError) {
      console.error('Token verification error:', tokenError);
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

  } catch (error) {
    console.error('❌ Get Chat History Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/rag-chat/history - Save/update user's chat history
router.post('/history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No valid authentication token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    const { chatHistory } = req.body;
    
    if (!Array.isArray(chatHistory)) {
      return res.status(400).json({
        success: false,
        error: 'Chat history must be an array'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Update user's chat history
      user.chatHistory = chatHistory;
      await user.save();
      
      res.json({
        success: true,
        message: 'Chat history saved successfully'
      });

    } catch (tokenError) {
      console.error('Token verification error:', tokenError);
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

  } catch (error) {
    console.error('❌ Save Chat History Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// DELETE /api/rag-chat/history - Clear user's chat history
router.delete('/history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No valid authentication token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Clear user's chat history
      user.chatHistory = [];
      await user.save();
      
      res.json({
        success: true,
        message: 'Chat history cleared successfully'
      });

    } catch (tokenError) {
      console.error('Token verification error:', tokenError);
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

  } catch (error) {
    console.error('❌ Clear Chat History Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/rag-chat/test - Test endpoint
router.get('/test', async (req, res) => {
  try {
    const testQueries = [
      "How many semesters are there in an academic year?",
      "When are tuition fees due?",
      "How many absences are allowed in a module?",
      "Can I bring my calculator to an exam?",
      "What is the normal study period for a BA degree?"
    ];

    const results = [];
    
    for (const query of testQueries) {
      const result = await generateRAGResponse(query, { temperature: 0.1 });
      results.push({
        query,
        success: result.success,
        response: result.success ? result.response : result.error,
        sources: result.sources || [],
        tokensUsed: result.tokensUsed || 0
      });
    }

    res.json({
      success: true,
      testResults: results,
      totalQueries: testQueries.length
    });

  } catch (error) {
    console.error('❌ Test Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 