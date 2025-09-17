/**
 * Authentication Middleware
 * Handles JWT token verification and user authentication
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify JWT token and authenticate user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        const token = authHeader && authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : null;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Find user by ID from token
            const user = await User.findById(decoded.userId).select('-password');
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token. User not found.'
                });
            }

            // Check if user account is active
            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Account has been deactivated.'
                });
            }

            // Attach user to request object
            req.user = user;
            next();

        } catch (jwtError) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.',
                error: process.env.NODE_ENV === 'development' ? jwtError.message : undefined
            });
        }

    } catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during authentication.'
        });
    }
};

/**
 * Middleware to check if user has required role
 * @param {Array} allowedRoles - Array of allowed roles ['student', 'staff', 'admin']
 * @returns {Function} - Middleware function
 */
const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        try {
            // Ensure user is authenticated first
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required.'
                });
            }

            // Check if user role is in allowed roles
            if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
                });
            }

            next();
        } catch (error) {
            console.error('Authorization middleware error:', error);
            return res.status(500).json({
                success: false,
                message: 'Server error during authorization.'
            });
        }
    };
};

/**
 * Middleware to require staff/admin privileges only (admin functions)
 * Only staff and admin can manage documents, users, and system settings
 */
const requireStaff = (req, res, next) => {
    return authorize(['staff', 'admin'])(req, res, next);
};

/**
 * Middleware to require student privileges
 * Mainly for student-specific features
 */
const requireStudent = (req, res, next) => {
    return authorize(['student'])(req, res, next);
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * Useful for routes that work for both authenticated and guest users
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        const token = authHeader && authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : null;

        if (!token) {
            // No token provided, continue without user
            req.user = null;
            return next();
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-password');
            
            if (user && user.isActive) {
                req.user = user;
            } else {
                req.user = null;
            }
        } catch (jwtError) {
            // Invalid token, continue without user
            req.user = null;
        }

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        req.user = null;
        next();
    }
};

/**
 * Utility function to generate JWT token
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
const generateToken = (user) => {
    const payload = {
        userId: user._id,
        email: user.email,
        role: user.role
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '7d' // Token expires in 7 days
    });
};

/**
 * Utility function to extract user info for token
 * @param {Object} user - User object
 * @returns {Object} - User info for frontend
 */
const getUserInfo = (user) => {
    return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        roleDisplayName: user.roleDisplayName,
        department: user.department,
        studentId: user.studentId,
        employeeId: user.employeeId,
        preferences: user.preferences,
        lastLogin: user.lastLogin,
        isEmailVerified: user.isEmailVerified,
        // Role capabilities
        canManageDocuments: user.canManageDocuments(),
        canViewAnalytics: user.canViewAnalytics(),

        isStaff: user.isStaff(),
        isStudent: user.isStudent()
    };
};

module.exports = {
    authenticate,
    authorize,
    requireStaff,
    requireStudent,
    optionalAuth,
    generateToken,
    getUserInfo
}; 