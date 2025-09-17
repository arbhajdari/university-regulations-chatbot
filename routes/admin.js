/**
 * Admin Routes
 * Handles administrative functions for user management
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AdminSettings = require('../models/AdminSettings');
const { authenticate, requireStaff } = require('../middleware/auth');

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination, filtering, and activity data
 * @access  Staff only
 */
router.get('/users', authenticate, requireStaff, async (req, res) => {
    try {
        const { role, department, active, page = 1, limit = 50, search } = req.query;
        
        // Build filter
        const filter = {};
        if (role) filter.role = role;
        if (department) filter.department = new RegExp(department, 'i');
        if (active !== undefined) filter.isActive = active === 'true';
        
        // Add search functionality
        if (search) {
            filter.$or = [
                { firstName: new RegExp(search, 'i') },
                { lastName: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') },
                { studentId: new RegExp(search, 'i') },
                { employeeId: new RegExp(search, 'i') }
            ];
        }
        
        // Get paginated results
        const skip = (page - 1) * limit;
        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await User.countDocuments(filter);

        // Get chat activity for each user (last 30 days)
        const usersWithActivity = users.map(user => ({
            ...user.toJSON(),
            activityLast30Days: 0,
            lastChatActivity: null,
            activityLevel: 'inactive'
        }));
        
        res.json({
            success: true,
            data: {
                users: usersWithActivity,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                },
                userRole: req.user.role // Let frontend know what role is requesting
            }
        });
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching users'
        });
    }
});

/**
 * @route   PUT /api/admin/users/:id/status
 * @desc    Activate/deactivate user account
 * @access  Staff only
 */
router.put('/users/:id/status', authenticate, requireStaff, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isActive must be a boolean value'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent staff from deactivating themselves
        if (user._id.toString() === req.user._id.toString() && !isActive) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate your own account'
            });
        }

        user.isActive = isActive;
        await user.save();
        
        const action = isActive ? 'activated' : 'deactivated';
        console.log(`👤 User ${action}: ${user.email} by ${req.user.email}`);

        res.json({
            success: true,
            message: `User account ${action} successfully`,
            data: { user: { id: user._id, email: user.email, isActive: user.isActive } }
        });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating user status'
        });
    }
});

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Update user role (for staff to verify/correct roles)
 * @access  Staff only
 */
router.put('/users/:id/role', authenticate, requireStaff, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        // Validate role
        if (!['student', 'staff', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be student, staff, or admin'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent staff from changing their own role to non-staff
        if (user._id.toString() === req.user._id.toString() && role !== 'staff') {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own role from staff'
            });
        }

        const oldRole = user.role;
        user.role = role;
        await user.save();
        
        console.log(`🔄 User role changed: ${user.email} from ${oldRole} to ${role} by ${req.user.email}`);

        res.json({
            success: true,
            message: `User role updated from ${oldRole} to ${role} successfully`,
            data: { 
                user: { 
                    id: user._id, 
                    email: user.email, 
                    role: user.role,
                    oldRole 
                } 
            }
        });

    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating user role'
        });
    }
});

/**
 * @route   GET /api/admin/stats
 * @desc    Get system statistics
 * @access  Staff only
 */
router.get('/stats', authenticate, requireStaff, async (req, res) => {
    try {
        // User statistics
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const usersByRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        // Recent registrations (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentRegistrations = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        // Department statistics
        const departmentStats = await User.aggregate([
            { $match: { department: { $ne: null, $ne: '' } } },
            { $group: { _id: '$department', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Registration trends (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
        
        const registrationTrends = await User.aggregate([
            { $match: { createdAt: { $gte: twelveMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    inactive: totalUsers - activeUsers,
                    byRole: usersByRole,
                    recentRegistrations,
                    byDepartment: departmentStats,
                    registrationTrends
                },
                systemInfo: {
                    registrationMethod: 'Self-selected roles with university email validation',
                    emailDomain: '@york.citycollege.eu',
                    availableRoles: ['student', 'staff', 'admin']
                }
            }
        });

    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching statistics'
        });
    }
});

/**
 * @route   GET /api/admin/banned-words
 * @desc    Get list of banned words
 * @access  Staff only
 */
router.get('/banned-words', authenticate, requireStaff, async (req, res) => {
    try {
        const settings = await AdminSettings.getSettings();
        const bannedWords = settings.bannedWords
            .filter(bw => bw.isActive)
            .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

        res.json({
            success: true,
            data: {
                bannedWords: bannedWords.map(bw => ({
                    id: bw._id,
                    word: bw.word,
                    addedAt: bw.addedAt,
                    addedBy: bw.addedBy
                })),
                total: bannedWords.length
            }
        });

    } catch (error) {
        console.error('Get banned words error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching banned words'
        });
    }
});

/**
 * @route   POST /api/admin/banned-words
 * @desc    Add a new banned word
 * @access  Staff only
 */
router.post('/banned-words', authenticate, requireStaff, async (req, res) => {
    try {
        const { word } = req.body;
        
        if (!word || typeof word !== 'string' || word.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Word is required and must be a non-empty string'
            });
        }

        const cleanWord = word.trim().toLowerCase();
        if (cleanWord.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Word cannot exceed 50 characters'
            });
        }

        const settings = await AdminSettings.getSettings();
        const wasAdded = settings.addBannedWord(cleanWord, req.user._id);
        
        if (!wasAdded) {
            return res.status(400).json({
                success: false,
                message: 'Word is already in the banned list'
            });
        }

        await settings.save();
        
        console.log(`🚫 Banned word added: "${cleanWord}" by ${req.user.email}`);

        res.json({
            success: true,
            message: 'Word added to banned list successfully',
            data: { word: cleanWord }
        });

    } catch (error) {
        console.error('Add banned word error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding banned word'
        });
    }
});

/**
 * @route   DELETE /api/admin/banned-words/:word
 * @desc    Remove a banned word
 * @access  Staff only
 */
router.delete('/banned-words/:word', authenticate, requireStaff, async (req, res) => {
    try {
        const { word } = req.params;
        
        const settings = await AdminSettings.getSettings();
        const wasRemoved = settings.removeBannedWord(word, req.user._id);
        
        if (!wasRemoved) {
            return res.status(404).json({
                success: false,
                message: 'Word not found in banned list'
            });
        }

        await settings.save();
        
        console.log(`✅ Banned word removed: "${word}" by ${req.user.email}`);

        res.json({
            success: true,
            message: 'Word removed from banned list successfully'
        });

    } catch (error) {
        console.error('Remove banned word error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error removing banned word'
        });
    }
});

/**
 * @route   GET /api/admin/contacts
 * @desc    Get all department contacts
 * @access  Staff only
 */
router.get('/contacts', authenticate, requireStaff, async (req, res) => {
    try {
        const settings = await AdminSettings.getSettings();
        const activeContacts = settings.contacts
            .filter(contact => contact.isActive)
            .sort((a, b) => a.displayOrder - b.displayOrder);

        res.json({
            success: true,
            data: {
                contacts: activeContacts.map(contact => ({
                    id: contact._id,
                    name: contact.name,
                    title: contact.title,
                    department: contact.department,
                    email: contact.email,
                    phone: contact.phone,
                    office: contact.office,
                    displayOrder: contact.displayOrder
                })),
                total: activeContacts.length
            }
        });

    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching contacts'
        });
    }
});

/**
 * @route   POST /api/admin/contacts
 * @desc    Add a new contact
 * @access  Staff only
 */
router.post('/contacts', authenticate, requireStaff, async (req, res) => {
    try {
        const { name, title, department, email, phone, office } = req.body;
        
        // Validation
        if (!name || !department || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name, department, and email are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        const settings = await AdminSettings.getSettings();
        const newContact = settings.addContact({
            name: name.trim(),
            title: title?.trim() || '',
            department: department.trim(),
            email: email.trim().toLowerCase(),
            phone: phone?.trim() || '',
            office: office?.trim() || ''
        }, req.user._id);

        await settings.save();
        
        console.log(`👤 Contact added: ${name} (${department}) by ${req.user.email}`);

        res.json({
            success: true,
            message: 'Contact added successfully',
            data: { contact: newContact }
        });

    } catch (error) {
        console.error('Add contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding contact'
        });
    }
});

/**
 * @route   PUT /api/admin/contacts/:id
 * @desc    Update a contact
 * @access  Staff only
 */
router.put('/contacts/:id', authenticate, requireStaff, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, title, department, email, phone, office } = req.body;
        
        // Validation
        if (!name || !department || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name, department, and email are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        const settings = await AdminSettings.getSettings();
        const updatedContact = settings.updateContact(id, {
            name: name.trim(),
            title: title?.trim() || '',
            department: department.trim(),
            email: email.trim().toLowerCase(),
            phone: phone?.trim() || '',
            office: office?.trim() || ''
        }, req.user._id);

        if (!updatedContact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        await settings.save();
        
        console.log(`📝 Contact updated: ${name} (${department}) by ${req.user.email}`);

        res.json({
            success: true,
            message: 'Contact updated successfully',
            data: { contact: updatedContact }
        });

    } catch (error) {
        console.error('Update contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating contact'
        });
    }
});

/**
 * @route   DELETE /api/admin/contacts/:id
 * @desc    Remove a contact
 * @access  Staff only
 */
router.delete('/contacts/:id', authenticate, requireStaff, async (req, res) => {
    try {
        const { id } = req.params;
        
        const settings = await AdminSettings.getSettings();
        const wasRemoved = settings.removeContact(id, req.user._id);
        
        if (!wasRemoved) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        await settings.save();
        
        console.log(`🗑️ Contact removed by ${req.user.email}`);

        res.json({
            success: true,
            message: 'Contact removed successfully'
        });

    } catch (error) {
        console.error('Remove contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error removing contact'
        });
    }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user account entirely (admin only)
 * @access  Admin only
 */
router.delete('/users/:id', authenticate, requireStaff, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if the requesting user is admin (staff role)
        if (req.user.role !== 'staff') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can delete users'
            });
        }

        const userToDelete = await User.findById(id);
        if (!userToDelete) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent admin from deleting themselves
        if (userToDelete._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        // Remove user
        await User.findByIdAndDelete(id);
        
        console.log(`🗑️ User deleted: ${userToDelete.email} by admin ${req.user.email}`);

        res.json({
            success: true,
            message: `User ${userToDelete.email} deleted successfully`,
            data: { deletedUser: { id: userToDelete._id, email: userToDelete.email } }
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting user'
        });
    }
});



module.exports = router; 