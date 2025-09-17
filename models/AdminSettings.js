/**
 * Admin Settings Model
 * Stores system-wide administrative settings
 */

const mongoose = require('mongoose');

const adminSettingsSchema = new mongoose.Schema({
    // Inappropriate word filtering
    bannedWords: [{
        word: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    
    // Contact directory management
    contacts: [{
        name: {
            type: String,
            required: true,
            maxlength: 100
        },
        title: {
            type: String,
            maxlength: 150
        },
        department: {
            type: String,
            required: true,
            maxlength: 100
        },
        email: {
            type: String,
            required: true,
            lowercase: true
        },
        phone: {
            type: String,
            maxlength: 20
        },
        office: {
            type: String,
            maxlength: 50
        },
        isActive: {
            type: Boolean,
            default: true
        },
        displayOrder: {
            type: Number,
            default: 0
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }],
    
    // Last updated tracking
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Indexes
adminSettingsSchema.index({ 'bannedWords.word': 1 });
adminSettingsSchema.index({ 'contacts.department': 1 });
adminSettingsSchema.index({ 'contacts.isActive': 1 });

/**
 * Static method to get or create settings document
 */
adminSettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = new this({
            bannedWords: [],
            contacts: []
        });
        await settings.save();
    }
    return settings;
};

/**
 * Instance method to add banned word
 */
adminSettingsSchema.methods.addBannedWord = function(word, userId) {
    const exists = this.bannedWords.some(bw => bw.word === word.toLowerCase());
    if (!exists) {
        this.bannedWords.push({
            word: word.toLowerCase(),
            addedBy: userId,
            isActive: true
        });
        this.lastUpdatedBy = userId;
    }
    return !exists;
};

/**
 * Instance method to remove banned word
 */
adminSettingsSchema.methods.removeBannedWord = function(word, userId) {
    const index = this.bannedWords.findIndex(bw => bw.word === word.toLowerCase());
    if (index > -1) {
        this.bannedWords.splice(index, 1);
        this.lastUpdatedBy = userId;
        return true;
    }
    return false;
};

/**
 * Instance method to add contact
 */
adminSettingsSchema.methods.addContact = function(contactData, userId) {
    const contact = {
        ...contactData,
        addedBy: userId,
        displayOrder: this.contacts.length
    };
    this.contacts.push(contact);
    this.lastUpdatedBy = userId;
    return contact;
};

/**
 * Instance method to update contact
 */
adminSettingsSchema.methods.updateContact = function(contactId, updateData, userId) {
    const contact = this.contacts.id(contactId);
    if (contact) {
        Object.assign(contact, updateData);
        this.lastUpdatedBy = userId;
        return contact;
    }
    return null;
};

/**
 * Instance method to remove contact
 */
adminSettingsSchema.methods.removeContact = function(contactId, userId) {
    const contact = this.contacts.id(contactId);
    if (contact) {
        contact.remove();
        this.lastUpdatedBy = userId;
        return true;
    }
    return false;
};

/**
 * Static method to check if message contains banned words
 */
adminSettingsSchema.statics.checkForBannedWords = async function(message) {
    const settings = await this.getSettings();
    const activeBannedWords = settings.bannedWords
        .filter(bw => bw.isActive)
        .map(bw => bw.word);
    
    const messageWords = message.toLowerCase().split(/\s+/);
    const foundBannedWords = [];
    
    for (const bannedWord of activeBannedWords) {
        if (messageWords.includes(bannedWord) || message.toLowerCase().includes(bannedWord)) {
            foundBannedWords.push(bannedWord);
        }
    }
    
    return {
        hasBannedWords: foundBannedWords.length > 0,
        bannedWords: foundBannedWords
    };
};

module.exports = mongoose.model('AdminSettings', adminSettingsSchema); 