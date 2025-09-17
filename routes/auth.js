/**
 * Authentication Routes
 * Handles user registration, login, and token validation
 * Simple email/password authentication only
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, generateToken, getUserInfo } = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user with email/password
 * @access  Public
 */
router.post('/register', async (req, res) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            role,
            department,
            universityId
        } = req.body;

        // Validate required fields
        if (!email || !password || !firstName || !lastName || !role || !department || !universityId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: email, password, firstName, lastName, role, department, universityId'
            });
        }

        // Validate email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Validate university domain
        if (!email.toLowerCase().endsWith('@york.citycollege.eu')) {
            return res.status(400).json({
                success: false,
                message: 'Please use only your York City College email address (@york.citycollege.eu)'
            });
        }

        // Validate password
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Validate role
        if (!['student', 'staff', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Please select a valid role: student, staff, or admin'
            });
        }

        // Validate department
        const validDepartments = [
            'Business Administration & Economics Department',
            'Psychology Department',
            'Computer Science Department',
            'Humanities Department'
        ];

        if (!validDepartments.includes(department)) {
            return res.status(400).json({
                success: false,
                message: 'Please select a valid department'
            });
        }

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Validate university ID format and uniqueness
        if (universityId.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'University ID must be at least 3 characters long'
            });
        }

        // Check if university ID already exists
        const existingIdUser = await User.findOne({
            $or: [
                { studentId: universityId },
                { employeeId: universityId }
            ]
        });

        if (existingIdUser) {
            return res.status(400).json({
                success: false,
                message: 'This University ID is already registered'
            });
        }

        // Create user data
        const userData = {
            email: email.toLowerCase(),
            password: password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role: role,
            department: department.trim(),
            // Set appropriate ID field based on role
            studentId: role === 'student' ? universityId.trim() : undefined,
            employeeId: (role === 'staff' || role === 'admin') ? universityId.trim() : undefined,
            isGoogleAuth: false
        };

        // Create new user
        const newUser = new User(userData);

        // Save user to database (password will be hashed automatically)
        await newUser.save();

        // Generate JWT token
        const token = generateToken(newUser);

        // Update last login
        newUser.lastLogin = new Date();
        await newUser.save();

        console.log(`✅ New user registered: ${email} (${newUser.role}) in ${department} - ID: ${universityId}`);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                token,
                user: getUserInfo(newUser)
            }
        });

    } catch (error) {
        console.error('Registration error:', error);

        // Handle MongoDB validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        // Handle duplicate key error
        if (error.code === 11000) {
            if (error.keyPattern && error.keyPattern.email) {
                return res.status(400).json({
                    success: false,
                    message: 'User with this email already exists'
                });
            } else if (error.keyPattern && (error.keyPattern.studentId || error.keyPattern.employeeId)) {
                return res.status(400).json({
                    success: false,
                    message: 'This University ID is already registered'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Registration data already exists'
                });
            }
        }

        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    User login with email/password
 * @access  Public
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

  


        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account has been deactivated. Please contact support.'
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = generateToken(user);

        console.log(`✅ User logged in: ${email} (${user.role})`);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: getUserInfo(user)
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token and return user info
 * @access  Private
 */
router.get('/verify', authenticate, async (req, res) => {
    try {
        // User info is attached to req.user by authenticate middleware
        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                user: getUserInfo(req.user)
            }
        });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during token verification'
        });
    }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user's profile information
 * @access  Private
 */
router.get('/profile', authenticate, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                user: getUserInfo(req.user)
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching profile'
        });
    }
});



/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', authenticate, async (req, res) => {
    try {
        // In a JWT setup, logout is mainly handled client-side by removing the token
        // But we can log the logout action server-side for monitoring
        console.log(`👋 User logged out: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout'
        });
    }
});

module.exports = router; 