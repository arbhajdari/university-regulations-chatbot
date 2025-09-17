/**
 * User Model for University Regulation Chatbot
 * Defines user schema with university email validation and roles
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Basic user information
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        validate: {
            validator: function(email) {
                // Enforce university email domain
                return email.endsWith('@york.citycollege.eu');
            },
            message: 'Please use your university email (@york.citycollege.eu)'
        }
    },
    
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    
    // User profile information
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    
    // User role - determined by university assignment (3 roles only)
    role: {
        type: String,
        enum: ['student', 'staff', 'admin'],
        default: 'student',
        required: true
    },
    
    // Additional profile fields
    department: {
        type: String,
        trim: true,
        maxlength: [100, 'Department cannot exceed 100 characters']
    },
    
    studentId: {
        type: String,
        trim: true,
        maxlength: [20, 'Student ID cannot exceed 20 characters'],
        sparse: true // Allows null values but ensures uniqueness when present
    },
    
    // Staff-specific fields
    employeeId: {
        type: String,
        trim: true,
        maxlength: [20, 'Employee ID cannot exceed 20 characters'],
        sparse: true
    },
    
    // Account status
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Email verification status
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    
    // Timestamps
    lastLogin: {
        type: Date,
        default: null
    },
    
    // Chat-related preferences
    preferences: {
        theme: {
            type: String,
            enum: ['light', 'dark'],
            default: 'light'
        },
        fontSize: {
            type: String,
            enum: ['small', 'medium', 'large'],
            default: 'medium'
        },
        notifications: {
            type: Boolean,
            default: true
        },
        // Staff-specific preferences
        showAnalytics: {
            type: Boolean,
            default: false
        }
    },
    
    // User-specific chat history
    chatHistory: {
        type: [{
            id: {
                type: String,
                required: true
            },
            title: {
                type: String,
                required: true,
                maxlength: [200, 'Chat title cannot exceed 200 characters']
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            messages: [{
                sender: {
                    type: String,
                    enum: ['user', 'bot'],
                    required: true
                },
                content: {
                    type: String,
                    required: true,
                    maxlength: [5000, 'Message content cannot exceed 5000 characters']
                },
                timestamp: {
                    type: Date,
                    default: Date.now
                }
            }]
        }],
        default: []
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

/**
 * Pre-save middleware to hash password before saving to database
 */
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with cost of 12
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

/**
 * Instance method to check password
 * @param {string} candidatePassword - The password to check
 * @returns {boolean} - True if password matches
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

/**
 * Instance method to get user's display name
 * @returns {string} - Full name of the user
 */
userSchema.methods.getDisplayName = function() {
    return `${this.firstName} ${this.lastName}`;
};

/**
 * Instance method to check if user has elevated privileges
 * @returns {boolean} - True if user has elevated privileges
 */
userSchema.methods.hasElevatedPrivileges = function() {
    return this.role === 'staff' || this.role === 'admin';
};

/**
 * Instance method to check if user is staff (admin privileges)
 * @returns {boolean} - True if user has admin privileges
 */
userSchema.methods.isStaff = function() {
    return this.role === 'staff' || this.role === 'admin';
};

/**
 * Instance method to check if user is student
 * @returns {boolean} - True if user is student
 */
userSchema.methods.isStudent = function() {
    return this.role === 'student';
};

/**
 * Instance method to check if user can manage documents
 * @returns {boolean} - True if user can add/edit PDFs
 */
userSchema.methods.canManageDocuments = function() {
    return this.role === 'staff' || this.role === 'admin'; // Only staff and admin can manage documents
};

/**
 * Instance method to check if user can view analytics
 * @returns {boolean} - True if user can view analytics
 */
userSchema.methods.canViewAnalytics = function() {
    return this.role === 'staff' || this.role === 'admin';
};

/**
 * Static method to find user by email
 * @param {string} email - The email to search for
 * @returns {Object|null} - User object or null
 */
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

/**
 * Virtual property for full name
 */
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

/**
 * Virtual property for role display name
 */
userSchema.virtual('roleDisplayName').get(function() {
    const roleNames = {
        'student': 'Student',
        'staff': 'Staff',
        'admin': 'Administrator'
    };
    return roleNames[this.role] || this.role;
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
    virtuals: true,
    transform: function(doc, ret) {
        // Remove sensitive information when converting to JSON
        delete ret.password;
        delete ret.__v;
        return ret;
    }
});

// Create indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ department: 1 });
userSchema.index({ studentId: 1 });
userSchema.index({ employeeId: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema); 