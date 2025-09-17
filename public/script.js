/**
 * University Regulation Chatbot - Frontend JavaScript
 * Handles all UI interactions, authentication, and chat functionality
 */

// Global state management
let currentUser = null;
let currentChatId = null;
let chatHistory = [];
let isAuthenticated = false;
let authToken = null;
let currentChatMessages = []; // Track current chat messages for timestamps

/**
 * Document ready - Initialize the application
 */
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 University Regulation Chatbot initialized');

    // Initialize all event listeners first
    initializeEventListeners();



    // Check if we have stored authentication data - simplified check
    const hasAuthToken = localStorage.getItem('authToken');
    const hasUserData = localStorage.getItem('userData');



    // More robust check - only need token and user data
    if (hasAuthToken && hasUserData) {
        try {
            // Quick validation of user data structure
            const userData = JSON.parse(hasUserData);


            if (userData && userData.email && userData.firstName) {
                console.log('🔐 Found valid auth data, restoring session...');
                await verifyStoredAuth();
                return;
            } else {
                console.log('❌ Invalid user data structure, clearing auth');
                clearAuthData();
            }
        } catch (error) {
            console.log('❌ Error parsing user data, clearing auth:', error);
            clearAuthData();
        }
    } else {
        console.log('❌ No stored session found - missing token or userData');
    }

    // Show login if we reach here
    console.log('👋 Showing login flow');
    showLoginFlow();

    // Set up periodic token validation (every 5 minutes) for active sessions
    // This helps catch token expiration gracefully rather than during API calls
    setInterval(async () => {
        if (isAuthenticated && authToken) {
            console.log('🔄 Periodic token validation check...');
            try {
                const response = await fetch('/api/auth/verify', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok || response.status === 401) {
                    console.log('⚠️ Token expired during periodic check - user will be prompted on next action');
                    // Don't immediately log out, just mark for re-auth on next API call
                    // This prevents disrupting users who are actively using the app
                }
            } catch (error) {
                console.log('🔧 Periodic token check failed (likely network issue):', error.message);
                // Don't log out on network errors during background checks
            }
        }
    }, 5 * 60 * 1000); // Check every 5 minutes
});

function showLoginFlow() {
    // Just show login modal, no guidance here
    showLoginModal();
}

/**
 * Verify stored authentication token with the server
 */
async function verifyStoredAuth() {
    const storedToken = localStorage.getItem('authToken');
    const storedUserData = localStorage.getItem('userData');



    if (!storedToken || !storedUserData) {
        console.log('❌ Missing auth data in verifyStoredAuth');
        showLoginFlow();
        return;
    }

    // Parse and validate user data
    let userData;
    try {
        userData = JSON.parse(storedUserData);
        if (!userData.email || !userData.firstName || !userData.role) {
            console.log('❌ Invalid user data structure in verifyStoredAuth');
            clearAuthData();
            showLoginFlow();
            return;
        }
    } catch (parseError) {
        console.error('❌ Failed to parse stored user data in verifyStoredAuth:', parseError);
        clearAuthData();
        showLoginFlow();
        return;
    }

    // ALWAYS restore session from localStorage first (this ensures user stays logged in)
    isAuthenticated = true;
    authToken = storedToken;
    currentUser = userData;

    console.log('✅ Session restored from localStorage for:', userData.firstName);

    // Show the main app immediately - this is the most important part!
    showMainApp();
    loadChatHistory();

    console.log('🎯 Main app shown, user is now logged in');

    // Removed welcome back alert - user doesn't want it on refresh
    // showAlert(`Welcome back, ${currentUser.firstName}!`, 'success');

    // Show guidance modal for fresh logins only (after everything is set up)
    showGuidanceModalIfNeeded();

    // Now do optional server verification in the background (non-blocking)
    setTimeout(async () => {
        try {
            console.log('🚀 Background server verification starting...');

            const response = await fetch('/api/auth/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${storedToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Background server response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.user) {
                    // Update with fresh server data silently
                    currentUser = data.data.user;
                    localStorage.setItem('userData', JSON.stringify(data.data.user));
                    console.log('✅ Background server verification successful');
                } else {
                    console.log('⚠️ Server says token may be invalid, but keeping user logged in');
                }
            } else if (response.status === 401) {
                console.log('⚠️ Server says token is expired, but keeping user logged in for now');
                // We could show a subtle warning here, but don't log out immediately
            } else {
                console.log('🔧 Server error during background verification');
            }

        } catch (error) {
            console.log('🔴 Background server verification failed (likely offline):', error.message);
            // This is totally fine - we're already logged in from localStorage
        }
    }, 1000); // Do this 1 second later so it doesn't interfere with UI
}

/**
 * Clear authentication data
 * @param {boolean} keepUserPreferences - Whether to keep user preferences and non-sensitive data
 */
function clearAuthData(keepUserPreferences = false) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userData');

    // Clear session state
    isAuthenticated = false;
    authToken = null;
    currentUser = null;

    // Optionally keep user preferences for better UX
    if (!keepUserPreferences) {
        // Remove old global guidance modal preference (deprecated)
        localStorage.removeItem('hideGuidanceModal');
        localStorage.removeItem('chatHistory');
        // Note: We keep 'lastGuidanceUser' and user-specific guidance preferences
        // as they help improve UX for returning users
    }

    console.log('🧹 Authentication data cleared', keepUserPreferences ? '(preferences kept)' : '(all data cleared)');
}

/**
 * Enhanced API call wrapper with automatic token validation
 * Handles 401 errors and redirects to login if needed
 */
async function authenticatedApiCall(url, options = {}) {
    // Ensure we have an auth token
    if (!authToken) {
        throw new Error('No authentication token available');
    }

    // Add auth header if not already present
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        'Authorization': `Bearer ${authToken}`
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Handle authentication errors globally
    if (response.status === 401) {
        console.log('❌ API call failed - token expired or invalid');
        clearAuthData();
        showAlert('Your session has expired. Please sign in again.', 'warning');
        setTimeout(() => {
            hideMainApp();
            showLoginFlow();
        }, 1500);
        throw new Error('Authentication expired');
    }

    return response;
}

/**
 * Initialize all event listeners for the application
 */
function initializeEventListeners() {
    // Authentication events
    const loginForm = document.getElementById('loginForm');
    const showRegisterLink = document.getElementById('showRegister');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', handleShowRegister);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Chat interface events
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const newChatBtn = document.getElementById('newChatBtn');

    if (messageInput) {
        messageInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Real-time banned word checking with debouncing
        let contentCheckTimeout;
        messageInput.addEventListener('input', function (e) {
            const message = e.target.value.trim();

            // Clear previous timeout
            if (contentCheckTimeout) {
                clearTimeout(contentCheckTimeout);
            }

            // Clear warning if input is empty
            if (!message) {
                clearContentViolationWarning();
                return;
            }

            // Debounce the content check (wait 500ms after user stops typing)
            contentCheckTimeout = setTimeout(async () => {
                const contentCheck = await checkMessageContent(message);
                if (contentCheck.hasViolations) {
                    showContentViolationWarning(contentCheck.violations);
                } else {
                    clearContentViolationWarning();
                }
            }, 500);
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
    }

    const clearChatBtn = document.getElementById('clearChatBtn');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', function () {
            // Clear current chat messages
            const chatMessages = document.getElementById('chatMessages');
            const welcomeScreen = document.getElementById('welcomeScreen');

            if (chatMessages) {
                chatMessages.innerHTML = '';
                chatMessages.classList.add('hidden');
            }
            if (welcomeScreen) {
                welcomeScreen.classList.remove('hidden');
            }

            showAlert('Chat cleared', 'success');
        });
    }

    // Quick lookup category buttons
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const category = this.dataset.category;
            handleQuickLookup(category);
        });
    });

    // Settings and modal events
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeBtns = document.querySelectorAll('.close-btn');
    const formsBtn = document.getElementById('formsBtn');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => showModal('settingsModal'));
    }

    if (formsBtn) {
        formsBtn.addEventListener('click', () => showModal('formsModal'));
    }

    const contactBtn = document.getElementById('contactBtn');
    if (contactBtn) {
        contactBtn.addEventListener('click', () => showModal('contactModal'));
    }

    closeBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const modalId = this.dataset.modal;
            hideModal(modalId);
        });
    });

    // Settings functionality
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearChatHistory);
    }

    // Initialize settings system
    initializeSettings();

    // Guidance modal events
    const guidanceOkBtn = document.getElementById('guidanceOkBtn');
    const dontShowAgain = document.getElementById('dontShowAgain');

    if (guidanceOkBtn) {
        guidanceOkBtn.addEventListener('click', function () {
            if (dontShowAgain && dontShowAgain.checked && currentUser && currentUser.email) {
                // Store preference per user
                const userGuidanceKey = `hideGuidanceModal_${currentUser.email}`;
                localStorage.setItem(userGuidanceKey, 'true');
            }
            hideModal('guidanceModal');
        });
    }

    // Download buttons for forms
    const downloadBtns = document.querySelectorAll('.download-btn');
    downloadBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const formType = this.dataset.form;
            handleFormDownload(formType);
        });
    });

    // Delete chat functionality removed from sidebar (available in settings)

    const deleteChatBtn = document.getElementById('deleteChatBtn');
    if (deleteChatBtn) {
        deleteChatBtn.addEventListener('click', deleteCurrentChat);
    }

    // Individual chat delete buttons (will be added dynamically)
    document.addEventListener('click', function (e) {
        if (e.target.closest('.delete-chat-btn')) {
            const chatItem = e.target.closest('.chat-item');
            const chatId = chatItem.dataset.chatId;
            deleteSingleChat(chatId, chatItem);
        }
    });
}

/**
 * Handle user login with real backend authentication (accepts any email)
 */
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        showAlert('Please enter a valid email address', 'error');
        return;
    }

    if (!password || password.length < 6) {
        showAlert('Password must be at least 6 characters long', 'error');
        return;
    }

    showLoading('Signing you in...');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            hideLoading();
            console.error('Failed to parse login response:', jsonError);
            showAlert('Server response error. Please try again.', 'error');
            return;
        }

        if (data.success) {
            // Login successful
            isAuthenticated = true;
            authToken = data.data.token;
            currentUser = data.data.user;

            // Store auth info
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userEmail', currentUser.email);
            localStorage.setItem('userData', JSON.stringify(currentUser));

            console.log('💾 Login - Stored auth data:', {
                token: !!authToken,
                email: currentUser.email,
                userData: JSON.stringify(currentUser).substring(0, 100) + '...'
            });

            hideLoading();
            hideModal('loginModal');
            showMainApp();
            loadChatHistory();

            // Removed welcome back alert - user doesn't want it on refresh
            // showAlert(`Welcome back, ${currentUser.firstName}!`, 'success');

            // Show guidance modal for fresh logins only (after everything is set up)
            showGuidanceModalIfNeeded();
        } else {
            hideLoading();
            showAlert(data.message || 'Login failed. Please try again.', 'error');
        }

    } catch (error) {
        hideLoading();
        showAlert('Connection error. Please check your internet connection.', 'error');
        console.error('Login error:', error);
    }
}

/**
 * Handle registration modal display - Simple email/password registration
 */
function handleShowRegister(e) {
    e.preventDefault();

    // Create clean registration modal without Google OAuth
    const existingModal = document.getElementById('registerModal');
    if (existingModal) {
        existingModal.remove();
    }

    const registerModal = document.createElement('div');
    registerModal.id = 'registerModal';
    registerModal.className = 'modal';
    registerModal.innerHTML = `
        <div class="modal-content">
            <div class="login-header">
                <h2><i class="fas fa-graduation-cap"></i> City College University of York</h2>
                <p>Create New Account</p>
            </div>
            
            <!-- Registration Form -->
            <form id="registerForm">
                <div class="input-group">
                    <i class="fas fa-envelope"></i>
                    <input type="email" id="regEmail" placeholder="Your City College University of York email" required>
                </div>
                <div class="input-group">
                    <i class="fas fa-user"></i>
                    <input type="text" id="regFirstName" placeholder="First Name" required>
                </div>
                <div class="input-group">
                    <i class="fas fa-user"></i>
                    <input type="text" id="regLastName" placeholder="Last Name" required>
                </div>
                <div class="input-group">
                    <i class="fas fa-lock"></i>
                    <input type="password" id="regPassword" placeholder="Password (min 6 characters)" required>
                </div>
                <div class="input-group">
                    <i class="fas fa-user-tag"></i>
                    <select id="regRole" required>
                        <option value="">Select Your Role</option>
                        <option value="student">Student</option>

                        <option value="staff">Staff (Administrative)</option>
                    </select>
                </div>
                <div class="input-group">
                    <i class="fas fa-building"></i>
                    <select id="regDepartment" required>
                        <option value="">Select Your Department</option>
                        <option value="Business Administration & Economics Department">Business Administration & Economics Department</option>
                        <option value="Psychology Department">Psychology Department</option>
                        <option value="Computer Science Department">Computer Science Department</option>
                        <option value="Humanities Department">Humanities Department</option>
                    </select>
                </div>
                <div class="input-group">
                    <i class="fas fa-id-card"></i>
                    <input type="text" id="regUniversityId" placeholder="Student/Employee ID" required>
                </div>
                <div class="role-info" id="roleInfo" style="display: none;">
                    <p><strong>Role Capabilities:</strong></p>
                    <ul id="roleCapabilities"></ul>
                </div>
                <button type="submit" class="btn-primary">
                    <i class="fas fa-user-plus"></i> Create Account
                </button>
            </form>
            
            <p class="auth-switch">
                Already have an account? <a href="#" id="showLogin">Sign in here</a>
            </p>
        </div>
    `;

    document.body.appendChild(registerModal);
    hideModal('loginModal');

    // Add event listeners
    document.getElementById('showLogin').addEventListener('click', function (e) {
        e.preventDefault();
        hideModal('registerModal');
        showModal('loginModal');
    });

    // Registration form event listener
    document.getElementById('registerForm').addEventListener('submit', handleRegistration);

    // Role change event listener
    document.getElementById('regRole').addEventListener('change', function () {
        showRoleInfo(this.value);
        updateUniversityIdPlaceholder(this.value);
    });
}

/**
 * Handle registration form submission
 */
async function handleRegistration(e) {
    e.preventDefault();

    const email = document.getElementById('regEmail').value.trim();
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const password = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    const department = document.getElementById('regDepartment').value;
    const universityId = document.getElementById('regUniversityId').value.trim();

    // Validate all fields
    if (!email || !firstName || !lastName || !password || !role || !department || !universityId) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        showAlert('Please enter a valid email address', 'error');
        return;
    }

    // Validate password
    if (password.length < 6) {
        showAlert('Password must be at least 6 characters long', 'error');
        return;
    }

    showLoading('Creating your account...');

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                firstName,
                lastName,
                password,
                role,
                department,
                universityId,
                isGoogleAuth: false
            })
        });

        const data = await response.json();

        if (data.success) {
            // Registration successful
            isAuthenticated = true;
            authToken = data.data.token;
            currentUser = data.data.user;

            // Store auth info
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userEmail', currentUser.email);
            localStorage.setItem('userData', JSON.stringify(currentUser));

            hideLoading();
            hideModal('registerModal');
            showMainApp(); // No need to show guidance modal - already shown on load
            loadChatHistory();

            showAlert(`Welcome to City College University of York, ${currentUser.firstName}! Your ${currentUser.role} account has been created.`, 'success');

            // Show guidance modal for new registrations
            showGuidanceModalIfNeeded();
        } else {
            hideLoading();
            showAlert(data.message || 'Registration failed. Please try again.', 'error');
        }

    } catch (error) {
        hideLoading();
        showAlert('Connection error. Please check your internet connection.', 'error');
        console.error('Registration error:', error);
    }
}

/**
 * Handle user logout
 */
async function handleLogout() {
    try {
        // Call logout endpoint if token exists
        if (authToken) {
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (error) {
                console.warn('Logout request failed, proceeding with client-side logout');
            }
        }

        // Save current chat history for this user before clearing
        if (currentUser && currentUser.email) {
            saveChatHistory();
        }

        // Clear authentication data
        clearAuthData();

        // Clear current chat history from memory
        chatHistory = [];

        // Clear current chat interface to prepare for next user
        clearCurrentChatInterface();

        // Hide main app and show login screen
        hideMainApp();
        showLoginFlow();

        // Show logout success message
        showAlert('Successfully logged out', 'success');

    } catch (error) {
        console.error('Logout error:', error);
        // Force logout even if there's an error
        clearAuthData();
        chatHistory = [];
        clearCurrentChatInterface();
        hideMainApp();
        showLoginFlow();
        showAlert('Logged out with errors', 'warning');
    }
}

/**
 * Send a chat message
 */
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message) return;

    try {
        // Check for banned words first
        const contentCheckResponse = await fetch('/api/rag-chat/check-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (contentCheckResponse.ok) {
            const contentCheck = await contentCheckResponse.json();
            if (contentCheck.hasViolations) {
                // Show error message and don't send the message
                showAlert(contentCheck.message, 'error');
                return; // Stop execution here
            }
        }

        // Clear input and add user message to chat
        messageInput.value = '';
        addMessageToChat('user', message);
        showChatInterface();
        showTypingIndicator();

        // Make API call to RAG chat endpoint
        const response = await fetch('/api/rag-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                parameters: {
                    temperature: 0.2,
                    maxTokens: 1000
                }
            })
        });

        hideTypingIndicator();

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const botResponse = data.response;

                // Show API indicator
                showAPIIndicator('gpt4-rag', true);

                // Add bot response to chat
                addMessageToChat('bot', botResponse);

                // Update chat history
                updateChatHistory(message, botResponse);

            } else {
                const errorMessage = data.message || data.error || 'Sorry, I encountered an error processing your request.';
                addMessageToChat('bot', errorMessage);
                if (data.fallbackResponse) {
                    addMessageToChat('bot', data.fallbackResponse);
                }
            }
        } else {
            const errorData = await response.json();
            if (errorData.violations) {
                // This shouldn't happen since we check content first, but just in case
                showAlert(errorData.message, 'error');
            } else {
                addMessageToChat('bot', 'Sorry, I encountered an error. Please try again later.');
            }
        }

    } catch (error) {
        console.error('Error sending message:', error);
        hideTypingIndicator();
        addMessageToChat('bot', 'Sorry, I encountered a connection error. Please try again.');
    }
}

/**
 * Show API indicator to let user know which service responded
 */
function showAPIIndicator(apiType, isGPT) {
    // Remove existing indicator
    const existingIndicator = document.querySelector('.api-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }

    const indicator = document.createElement('div');
    indicator.className = 'api-indicator';
    indicator.innerHTML = `
        <i class="fas fa-${isGPT ? 'brain' : 'robot'}"></i>
        <span>Powered by ${apiType}</span>
    `;
    indicator.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: ${isGPT ? '#10a37f' : '#6c757d'};
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 1000;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.3s ease;
    `;

    document.body.appendChild(indicator);

    // Animate in
    setTimeout(() => {
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateY(0)';
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateY(20px)';
        setTimeout(() => indicator.remove(), 300);
    }, 3000);
}

/**
 * Handle quick lookup category selection with GPT-4
 */
async function handleQuickLookup(category) {
    const queries = {
        academic: "What are the academic structure, assessment methods and marking scheme?",
        admission: "What are the admission requirements and application process?",
        financial: "What are the tuition fees and financial policies?",
        attendance: "What are the attendance requirements and absence policies?",
        examination: "What are the examination procedures and requirements?",
        graduation: "What are the graduation requirements and degree classification?",
        support: "What student support and safety services are available?"
    };

    const message = queries[category];
    if (!message) return;

    try {
        // Check for banned words first (though quick lookup queries should be safe)
        const contentCheckResponse = await fetch('/api/rag-chat/check-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (contentCheckResponse.ok) {
            const contentCheck = await contentCheckResponse.json();
            if (contentCheck.hasViolations) {
                showAlert('This quick lookup query contains prohibited content.', 'error');
                return;
            }
        }

        // Show chat interface
        showChatInterface();

        // Add user query to chat
        const categoryNames = {
            academic: "Academic Policies & Assessment",
            admission: "Admission Requirements",
            financial: "Financial Policies",
            attendance: "Attendance Requirements",
            examination: "Examination Procedures",
            graduation: "Graduation Requirements",
            support: "Student Support & Safety"
        };

        addMessageToChat('user', `Quick lookup: ${categoryNames[category]}`);
        showTypingIndicator();

        // Call RAG endpoint
        const response = await fetch('/api/rag-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                parameters: {
                    temperature: 0.1,
                    maxTokens: 1200
                }
            })
        });

        hideTypingIndicator();

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const botResponse = data.response;

                // Show API indicator
                showAPIIndicator('gpt4-rag', true);

                // Add bot response
                addMessageToChat('bot', botResponse);

                // Show follow-up options
                addQuickFollowUpOptions(category);

                // Update chat history
                updateChatHistory(`Quick lookup: ${categoryNames[category]}`, botResponse);

            } else {
                const errorMessage = data.message || data.error || 'Sorry, I encountered an error with this lookup.';
                addMessageToChat('bot', errorMessage);
                if (data.fallbackResponse) {
                    addMessageToChat('bot', data.fallbackResponse);
                }
            }
        } else {
            addMessageToChat('bot', 'Sorry, I encountered an error with this quick lookup. Please try again.');
        }

    } catch (error) {
        console.error('Quick lookup error:', error);
        hideTypingIndicator();
        addMessageToChat('bot', 'Sorry, I encountered a connection error. Please try again.');
    }
}

/**
 * Add quick follow-up options after category selection
 */
function addQuickFollowUpOptions(category) {
    // Updated with intelligent suggestions based on our actual 22 policies
    const followUpOptions = {
        'academic': [
            'What is the marking scheme and grade classification system?',
            'How long does it take to receive feedback on assignments?',
            'What types of assessments are used (essays, exams, projects)?',
            'How are academic stages and progression structured?'
        ],
        'admission': [
            'What are the requirements for Bachelor\'s admission?',
            'What are the requirements for Master\'s admission?',
            'What are the requirements for Executive MBA admission?',
            'What English test scores do I need for each program?',
            'How many references do I need for each program?',
            'How do I appeal an admission decision?'
        ],
        'financial': [
            'What are the tuition refund rules?',
            'When do I get compensation if my program is cancelled?',
            'What happens if I miss payment deadlines?',
            'Are registration fees refundable?'
        ],
        'attendance': [
            'What are the attendance requirements?',
            'Can I use calculators in exams?',
            'What\'s the maximum study duration?',
            'How do I request leave of absence?'
        ],
        'support': [
            'How do I report concerning behavior?',
            'What support is available for gender equality?',
            'What types of harassment and discrimination are prohibited?',
            'Who investigates sexual harassment complaints against staff?'
        ]
    };

    const options = followUpOptions[category];
    if (!options) return;

    const chatMessages = document.getElementById('chatMessages');
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'quick-options';
    optionsDiv.innerHTML = `
        <div class="quick-options-title">❓ **Common questions you can ask about this category:**</div>
        <div class="quick-options-buttons">
            ${options.map(option =>
        `<button class="quick-option-btn" onclick="askAboutTopic('${option.replace(/'/g, '\\\'')}')">${option}</button>`
    ).join('')}
        </div>
    `;

    chatMessages.appendChild(optionsDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Ask about specific topic from quick options
 */
async function askAboutTopic(topic) {
    try {
        // Check for banned words first
        const contentCheckResponse = await fetch('/api/rag-chat/check-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: topic })
        });

        if (contentCheckResponse.ok) {
            const contentCheck = await contentCheckResponse.json();
            if (contentCheck.hasViolations) {
                showAlert('This topic query contains prohibited content.', 'error');
                return;
            }
        }

        // Add user message and show loading
        addMessageToChat('user', topic);
        showTypingIndicator();

        // Call RAG endpoint
        const response = await fetch('/api/rag-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: topic,
                parameters: {
                    temperature: 0.2,
                    maxTokens: 1000
                }
            })
        });

        hideTypingIndicator();

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const botResponse = data.response;

                // Show API indicator
                showAPIIndicator('gpt4-rag', true);

                // Add bot response
                addMessageToChat('bot', botResponse);

                // Update chat history
                updateChatHistory(topic, botResponse);

            } else {
                const errorMessage = data.message || data.error || 'Sorry, I encountered an error with this topic.';
                addMessageToChat('bot', errorMessage);
                if (data.fallbackResponse) {
                    addMessageToChat('bot', data.fallbackResponse);
                }
            }
        } else {
            addMessageToChat('bot', 'Sorry, I encountered an error. Please try again.');
        }

    } catch (error) {
        console.error('Ask about topic error:', error);
        hideTypingIndicator();
        addMessageToChat('bot', 'Sorry, I encountered a connection error. Please try again.');
    }
}

/**
 * Start a new chat conversation
 */
function startNewChat() {
    currentChatId = null;
    currentChatMessages = []; // Reset current chat messages

    // Clear the chat interface and show welcome screen
    const chatMessages = document.getElementById('chatMessages');
    const welcomeScreen = document.getElementById('welcomeScreen');

    if (chatMessages && welcomeScreen) {
        chatMessages.innerHTML = '';
        chatMessages.classList.add('hidden');
        welcomeScreen.classList.remove('hidden');
    }

    // Remove active state from all chat items
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
}

/**
 * Add a message to the chat interface
 */
function addMessageToChat(sender, content, isSource = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}${isSource ? ' sources' : ''}`;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    // Format content with basic markdown support
    const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

    // Check if timestamps should be shown
    const settings = getSettings();
    const showTimestamps = settings.toggles.timestampsToggle;

    messageDiv.innerHTML = `
        <div class="message-content">
            ${formattedContent}
        </div>
    `;

    // Add timestamp if setting is enabled
    if (showTimestamps && !isSource) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = timeString;
        messageDiv.appendChild(timeSpan);
        messageDiv.classList.add('has-timestamp');
    }

    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Show the chat interface (hide welcome screen)
 */
function showChatInterface() {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('chatMessages').classList.remove('hidden');
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;

    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

/**
 * Update chat history
 */
function updateChatHistory(userMessage, botResponse) {
    if (!currentChatId) {
        currentChatId = 'chat_' + Date.now();
    }

    // Create new message objects
    const newMessages = [
        { sender: 'user', content: userMessage, timestamp: new Date() },
        { sender: 'bot', content: botResponse, timestamp: new Date() }
    ];

    // Add to chat history array
    const chatEntry = {
        id: currentChatId,
        timestamp: new Date(),
        messages: newMessages
    };

    // Update or add to history
    const existingChatIndex = chatHistory.findIndex(chat => chat.id === currentChatId);
    if (existingChatIndex >= 0) {
        chatHistory[existingChatIndex].messages.push(...newMessages);
        currentChatMessages = chatHistory[existingChatIndex].messages; // Update current chat messages
    } else {
        chatHistory.unshift({ id: currentChatId, title: userMessage.substring(0, 30) + '...', timestamp: new Date(), messages: newMessages });
        currentChatMessages = newMessages; // Set current chat messages
    }

    // Update sidebar
    updateChatSidebar();

    // Save to both server and localStorage
    saveChatHistory();
}

/**
 * Save chat history to server (if authenticated) and user-specific localStorage
 */
async function saveChatHistory() {
    try {
        // Always save to user-specific localStorage as backup
        const userKey = currentUser && currentUser.email ? `chatHistory_${currentUser.email}` : 'chatHistory_guest';
        localStorage.setItem(userKey, JSON.stringify(chatHistory));

        // Also save to server if user is authenticated
        if (authToken && currentUser) {
            const response = await fetch('/api/rag-chat/history', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ chatHistory })
            });

            if (!response.ok) {
                console.warn('Failed to save chat history to server, using localStorage backup');
            }
        }
    } catch (error) {
        console.error('Error saving chat history:', error);
        // Fallback to user-specific localStorage
        const userKey = currentUser && currentUser.email ? `chatHistory_${currentUser.email}` : 'chatHistory_guest';
        localStorage.setItem(userKey, JSON.stringify(chatHistory));
    }
}

/**
 * Load chat history from server for the current user
 */
async function loadChatHistory() {
    try {
        // If user is not authenticated, use user-specific localStorage
        if (!authToken || !currentUser) {
            const userKey = currentUser && currentUser.email ? `chatHistory_${currentUser.email}` : 'chatHistory_guest';
            const saved = localStorage.getItem(userKey);
            if (saved) {
                chatHistory = JSON.parse(saved);
                updateChatSidebar();
            }
            return;
        }

        const response = await fetch('/api/rag-chat/history', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                chatHistory = data.data.history;
                updateChatSidebar();
            }
        } else {
            // Fall back to user-specific localStorage if server request fails
            const userKey = currentUser.email ? `chatHistory_${currentUser.email}` : 'chatHistory_guest';
            const saved = localStorage.getItem(userKey);
            if (saved) {
                chatHistory = JSON.parse(saved);
                updateChatSidebar();
            }
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        // Fall back to user-specific localStorage on error
        const userKey = currentUser && currentUser.email ? `chatHistory_${currentUser.email}` : 'chatHistory_guest';
        const saved = localStorage.getItem(userKey);
        if (saved) {
            chatHistory = JSON.parse(saved);
            updateChatSidebar();
        }
    }
}

/**
 * Update the chat history sidebar
 */
function updateChatSidebar() {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;

    chatList.innerHTML = '';

    // Use chatHistory variable (loaded from server for authenticated users, localStorage for guests)
    const savedHistory = chatHistory || [];

    // Show only the last 15 chats
    const recentChats = savedHistory.slice(0, 15);

    recentChats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = chat.id;
        chatItem.innerHTML = `
            <div class="chat-content">
                <div class="chat-title">${chat.title}</div>
                <div class="chat-time">${new Date(chat.timestamp).toLocaleDateString()}</div>
            </div>
            <button class="delete-chat-btn" title="Delete this chat">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add click handler for chat content only (not delete button)
        const chatContent = chatItem.querySelector('.chat-content');
        chatContent.addEventListener('click', () => loadChat(chat.id));

        chatList.appendChild(chatItem);
    });

    // Add a note if there are more than 15 chats
    if (savedHistory.length > 15) {
        const moreChatsNote = document.createElement('div');
        moreChatsNote.className = 'chat-item more-chats-note';
        moreChatsNote.innerHTML = `
            <div class="chat-content">
                <div class="chat-title">+ ${savedHistory.length - 15} more chats</div>
                <div class="chat-time">Older conversations</div>
            </div>
        `;
        moreChatsNote.style.opacity = '0.6';
        moreChatsNote.style.fontStyle = 'italic';
        chatList.appendChild(moreChatsNote);
    }
}

/**
 * Load a specific chat
 */
function loadChat(chatId) {
    const chat = chatHistory.find(c => c.id === chatId);
    if (!chat) return;

    currentChatId = chatId;
    currentChatMessages = chat.messages; // Store current chat messages for timestamp function

    // Clear current messages
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    // Check if timestamps should be shown
    const settings = getSettings();
    const showTimestamps = settings.toggles.timestampsToggle;

    // Load messages
    chat.messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender}`;

        // Format content with basic markdown support
        const formattedContent = message.content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

        messageDiv.innerHTML = `
            <div class="message-content">
                ${formattedContent}
            </div>
        `;

        // Add timestamp if setting is enabled
        if (showTimestamps) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'message-time';
            const timestamp = new Date(message.timestamp);
            timeSpan.textContent = timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            messageDiv.appendChild(timeSpan);
            messageDiv.classList.add('has-timestamp');
        }

        chatMessages.appendChild(messageDiv);
    });

    // Show chat interface
    showChatInterface();

    // Update active state - find the correct chat item by chatId
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.chatId === chatId) {
            item.classList.add('active');
        }
    });
}

/**
 * Clear chat history
 */
async function clearChatHistory() {
    if (confirm('🗑️ Are you sure you want to clear all chat history? This cannot be undone.')) {
        try {
            // Clear from server if authenticated
            if (authToken && currentUser) {
                const response = await fetch('/api/rag-chat/history', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.warn('Failed to clear chat history from server');
                }
            }

            // Clear user-specific localStorage
            const userKey = currentUser && currentUser.email ? `chatHistory_${currentUser.email}` : 'chatHistory_guest';
            localStorage.removeItem(userKey);

            // Clear current chat history in memory
            chatHistory = [];
            updateChatSidebar();

            showAlert('Chat history cleared successfully', 'info');
        } catch (error) {
            console.error('Error clearing chat history:', error);
            // Fallback: still clear localStorage
            const userKey = currentUser && currentUser.email ? `chatHistory_${currentUser.email}` : 'chatHistory_guest';
            localStorage.removeItem(userKey);
            chatHistory = [];
            updateChatSidebar();
            showAlert('Chat history cleared (with errors)', 'warning');
        }
    }
}

/**
 * Clear all chat history
 */
function clearAllChatHistory() {
    if (confirm('🗑️ Are you sure you want to delete ALL your chat conversations? This cannot be undone.')) {
        // Clear user-specific localStorage
        const userKey = currentUser && currentUser.email ? `chatHistory_${currentUser.email}` : 'chatHistory_guest';
        localStorage.removeItem(userKey);

        // Clear current chat history in memory
        chatHistory = [];
        updateChatSidebar();

        // Also clear current chat if any
        const chatMessages = document.getElementById('chatMessages');
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (chatMessages && welcomeScreen) {
            chatMessages.innerHTML = '';
            chatMessages.classList.add('hidden');
            welcomeScreen.classList.remove('hidden');
        }

        showAlert('All chat history deleted successfully', 'success');
    }
}

/**
 * Delete current active chat
 */
function deleteCurrentChat() {
    if (!currentChatId) {
        showAlert('No active chat to delete', 'warning');
        return;
    }

    if (confirm('🗑️ Are you sure you want to delete this chat conversation? This cannot be undone.')) {
        // Remove from chatHistory array
        const updatedHistory = chatHistory.filter(chat => chat.id !== currentChatId);
        chatHistory = updatedHistory;

        // Update sidebar
        updateChatSidebar();

        // Save updated history
        saveChatHistory();

        // Clear current chat display and return to welcome screen
        const chatMessages = document.getElementById('chatMessages');
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (chatMessages && welcomeScreen) {
            chatMessages.innerHTML = '';
            chatMessages.classList.add('hidden');
            welcomeScreen.classList.remove('hidden');
        }

        currentChatId = null;
        showAlert('Chat deleted successfully', 'success');
    }
}

/**
 * Delete a single chat from history
 */
function deleteSingleChat(chatId, chatElement) {
    if (confirm('🗑️ Delete this chat conversation?')) {
        // Remove from chatHistory array
        const updatedHistory = chatHistory.filter(chat => chat.id !== chatId);
        chatHistory = updatedHistory;

        // Save updated history
        saveChatHistory();

        // Remove the chat element from DOM
        chatElement.remove();

        // If this was the current active chat, reset to welcome screen
        if (currentChatId === chatId) {
            const chatMessages = document.getElementById('chatMessages');
            const welcomeScreen = document.getElementById('welcomeScreen');
            if (chatMessages && welcomeScreen) {
                chatMessages.innerHTML = '';
                chatMessages.classList.add('hidden');
                welcomeScreen.classList.remove('hidden');
            }
            currentChatId = null;
        }

        showAlert('Chat deleted', 'info');
    }
}

/**
 * Show/hide modals
 */
function showModal(modalId) {
    console.log('🔓 showModal called for:', modalId);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        console.log('✅ Modal shown successfully:', modalId);
    } else {
        console.error('❌ Modal not found:', modalId);
    }
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

/**
 * Show guidance modal if user hasn't disabled it and meets criteria
 * Only shows for: 1) First-time visitors, 2) Different account login
 */
function showGuidanceModalIfNeeded() {
    // Check if user has opted out globally
    const hideForAllUsers = localStorage.getItem('hideGuidanceModal') === 'true';

    // Check if this specific user has opted out
    const userSpecificKey = `hideGuidance_${currentUser?.email || 'unknown'}`;
    const hideForThisUser = localStorage.getItem(userSpecificKey) === 'true';

    console.log('🔍 Checking guidance modal:', {
        hideForAllUsers,
        hideForThisUser,
        userEmail: currentUser?.email,
        userSpecificKey
    });

    // Don't show if either global or user-specific opt-out is set
    if (hideForAllUsers || hideForThisUser) {
        return;
    }

    // Show the guidance modal
    console.log('📋 Showing guidance modal now');
    const guidanceModal = document.getElementById('guidanceModal');
    if (guidanceModal) {
        guidanceModal.classList.remove('hidden');
    }
}

/**
 * Clear the current chat interface to show a fresh start
 */
function clearCurrentChatInterface() {
    // Clear current chat messages
    const chatMessages = document.getElementById('chatMessages');
    const welcomeScreen = document.getElementById('welcomeScreen');

    if (chatMessages) {
        chatMessages.innerHTML = '';
        chatMessages.classList.add('hidden');
    }

    if (welcomeScreen) {
        welcomeScreen.classList.remove('hidden');
    }

    // Reset current chat ID
    currentChatId = null;

    // Remove active state from all chat items
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });

    console.log('🆕 Chat interface cleared for new user session');
}

function showMainApp() {
    // Hide the login modal properly
    hideModal('loginModal');
    hideLoading();

    // Show main app container
    const mainApp = document.getElementById('mainApp');
    if (mainApp) {
        mainApp.classList.remove('hidden');
    }

    // Update user information in UI
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.fullName || `${currentUser.firstName} ${currentUser.lastName}`;
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userRole').textContent = currentUser.roleDisplayName || currentUser.role;

        // Add staff/admin specific UI elements
        addRoleSpecificUI();

        // Clear any generic/guest chat history when user logs in
        // Remove any old non-user-specific chat history
        localStorage.removeItem('chatHistory');
        localStorage.removeItem('chatHistory_guest');

        // Reset chat history array
        chatHistory = [];

        // Clear current chat interface to start fresh for new user
        clearCurrentChatInterface();

        // Load user-specific chat history
        loadChatHistory();
    }

    // Show guidance modal if needed for this user
    showGuidanceModalIfNeeded();
}

/**
 * Add role-specific UI elements for admin and staff
 */
function addRoleSpecificUI() {
    // Remove any existing role-specific elements
    const existingElements = document.querySelectorAll('.role-specific');
    existingElements.forEach(el => el.remove());

    if (currentUser.role === 'staff' || currentUser.role === 'admin') {
        addStaffUI();
    }
}

/**
 * Add staff-specific UI elements
 */
function addStaffUI() {
    // Add staff management section to sidebar
    const sidebar = document.querySelector('.sidebar');
    const staffSection = document.createElement('div');
    staffSection.className = 'staff-management role-specific';
    staffSection.innerHTML = `
        <h3><i class="fas fa-users-cog"></i> Staff Tools</h3>
        <div class="staff-tools">
            <button class="category-btn staff-btn" data-action="user-management">
                <i class="fas fa-users"></i> User Management
            </button>
            <button class="category-btn staff-btn" data-action="banned-words">
                <i class="fas fa-ban"></i> Content Filter
            </button>
        </div>
    `;

    // Insert after quick lookup section
    const quickLookup = sidebar.querySelector('.quick-lookup');
    quickLookup.parentNode.insertBefore(staffSection, quickLookup.nextSibling);

    // Add event listeners for staff tools
    document.querySelectorAll('.staff-btn').forEach(btn => {
        btn.addEventListener('click', handleStaffAction);
    });

    // Add staff indicator to header
    const userRole = document.getElementById('userRole');
    userRole.innerHTML = `${currentUser.role} <span class="role-badge staff-badge">STAFF ACCESS</span>`;
}



/**
 * Handle staff-specific actions
 */
async function handleStaffAction(e) {
    const action = e.currentTarget.getAttribute('data-action');

    switch (action) {
        case 'user-management':
            await showUserManagement();
            break;
        case 'banned-words':
            await showBannedWordManagement();
            break;
    }
}





/**
 * Show usage analytics (placeholder)
 */
async function showUsageAnalytics() {
    showAlert('Usage Analytics: Feature in development. Will show document access patterns, popular queries, and user engagement metrics.', 'info');
}

/**
 * Show student analytics for faculty (placeholder)
 */
async function showStudentAnalytics() {
    showAlert('Student Analytics: Feature in development. Will show anonymized student query patterns and policy access trends.', 'info');
}

function hideMainApp() {
    document.getElementById('mainApp').classList.add('hidden');
}

/**
 * Show/hide login modal
 */
function showLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
}

/**
 * Show/hide loading indicator
 */
function showLoading(message = 'Loading...') {
    const loading = document.getElementById('loadingIndicator');
    loading.querySelector('p').textContent = message;
    loading.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingIndicator').classList.add('hidden');
}

/**
 * Show alert messages
 */
function showAlert(message, type = 'info') {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;

    // Add styles for alert
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        z-index: 3000;
        max-width: 300px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        animation: slideInRight 0.3s ease;
    `;

    // Set background color based on type
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };

    alert.style.backgroundColor = colors[type] || colors.info;

    document.body.appendChild(alert);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// Add CSS for typing indicator animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .typing-dots {
        display: flex;
        gap: 4px;
        align-items: center;
    }
    
    .typing-dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary-orange);
        animation: typing 1.4s infinite ease-in-out;
    }
    
    .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
    .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes typing {
        0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1); }
    }
`;
document.head.appendChild(style);

/**
 * Show role information and capabilities (only for staff)
 */
function showRoleInfo(role) {
    const roleInfo = document.getElementById('roleInfo');
    const roleCapabilities = document.getElementById('roleCapabilities');

    // Hide initially
    roleInfo.style.display = 'none';

    if (!role || role === 'student') {
        // No info shown for students - keep it clean
        return;
    }

    // Show capabilities only for staff
    const capabilities = {
        'staff': [
            '📄 Manage all PDF documents and policies',
            '👥 Full user and system administration',
            '📈 Complete analytics and reporting access',
            '⚙️ Configure system settings and features'
        ]
    };

    if (capabilities[role]) {
        roleCapabilities.innerHTML = capabilities[role].map(cap => `<li>${cap}</li>`).join('');
        roleInfo.style.display = 'block';
    }
}

/**
 * Update university ID placeholder based on role
 */
function updateUniversityIdPlaceholder(role) {
    const universityIdInput = document.getElementById('regUniversityId');

    const placeholders = {
        'student': 'Student ID (e.g., STU2024001)',
        'staff': 'Employee ID (e.g., STAFF001)'
    };

    universityIdInput.placeholder = placeholders[role] || 'University ID';
}

/**
 * Handle form download functionality
 */
function handleFormDownload(formType) {
    // Define the form file mappings - updated to match actual file names in uploads/forms
    const formFiles = {
        'undergraduate-application': 'Undergraduate-application-form.pdf',
        'postgraduate-application': 'Postgraduate-application-form.pdf',
        'mba-application': 'MBA-application-form.pdf',
        'enrollment-statement': 'Student-Enrolment-Statement.pdf',
        'equal-opportunities': 'Equal-Opportunities-Monitoring-Form.pdf',
        'equal-opportunities-mba': 'Equal-Opportunities-Monitoring-Form-MBA.pdf',
        'appeals-complaints': 'AdmissionsAppealsAndComplaintsForm.pdf'
    };

    const fileName = formFiles[formType];
    if (!fileName) {
        showAlert('Form not found. Please contact the Admissions Office.', 'error');
        return;
    }

    // Create download link - updated to use uploads/forms directory
    const downloadUrl = `/uploads/forms/${fileName}`;

    // Create temporary link element and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.style.display = 'none';

    // Add to DOM, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show success message
    const formName = document.querySelector(`[data-form="${formType}"]`).closest('.form-item').querySelector('.form-name').textContent;
    showAlert(`${formName} downloaded successfully!`, 'success');

    // Log the download for analytics (optional)
    console.log(`Form downloaded: ${fileName}`);
}

/**
 * Initialize Settings System
 */
function initializeSettings() {
    // Load saved settings from localStorage
    loadSavedSettings();

    // Theme selector
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', function () {
            applyTheme(this.value);
            saveSettings();
        });
    }

    // Font size selector
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', function () {
            applyFontSize(this.value);
            saveSettings();
        });
    }

    // All toggle switches
    const toggles = [
        'autoSaveToggle',
        'timestampsToggle'
    ];

    toggles.forEach(toggleId => {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            toggle.addEventListener('change', function () {
                handleToggleChange(toggleId, this.checked);
                saveSettings();
            });
        }
    });

    // Export data button
    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportUserData);
    }
}

/**
 * Load saved settings from localStorage
 */
function loadSavedSettings() {
    const settings = getSettings();

    // Apply theme
    applyTheme(settings.theme);
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = settings.theme;

    // Apply font size
    applyFontSize(settings.fontSize);
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    if (fontSizeSelect) fontSizeSelect.value = settings.fontSize;

    // Apply toggle settings
    Object.keys(settings.toggles).forEach(toggleId => {
        const toggle = document.getElementById(toggleId);
        const value = settings.toggles[toggleId];
        if (toggle) {
            toggle.checked = value;
            handleToggleChange(toggleId, value, false); // false = don't save again
        }
    });
}

/**
 * Get current settings from localStorage with defaults
 */
function getSettings() {
    const defaultSettings = {
        theme: 'light',
        fontSize: 'medium',
        toggles: {
            autoSaveToggle: true,
            timestampsToggle: false
        }
    };

    const saved = localStorage.getItem('chatbotSettings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
}

/**
 * Save current settings to localStorage
 */
function saveSettings() {
    const settings = {
        theme: document.getElementById('themeSelect')?.value || 'light',
        fontSize: document.getElementById('fontSizeSelect')?.value || 'medium',
        toggles: {}
    };

    // Save all toggle states
    ['autoSaveToggle', 'timestampsToggle'].forEach(toggleId => {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            settings.toggles[toggleId] = toggle.checked;
        }
    });

    localStorage.setItem('chatbotSettings', JSON.stringify(settings));
    console.log('⚙️ Settings saved:', settings);
}

/**
 * Apply theme to the application
 */
function applyTheme(theme) {
    const body = document.body;

    // Remove existing theme classes
    body.classList.remove('dark-theme', 'light-theme');

    if (theme === 'dark') {
        body.classList.add('dark-theme');
    }
    // light theme is default (no class needed)

    console.log(`🎨 Theme applied: ${theme}`);
}

/**
 * Apply font size to the application
 */
function applyFontSize(fontSize) {
    const body = document.body;

    // Remove existing font size classes
    body.classList.remove('font-small', 'font-medium', 'font-large');

    // Add new font size class
    body.classList.add(`font-${fontSize}`);

    console.log(`📝 Font size applied: ${fontSize}`);
}

/**
 * Handle toggle switch changes
 */
function handleToggleChange(toggleId, isChecked, shouldSave = true) {
    console.log(`🔄 Toggle ${toggleId}: ${isChecked}`);

    switch (toggleId) {
        case 'autoSaveToggle':
            // This will be used when saving chat history - no notification popup
            break;

        case 'timestampsToggle':
            // This would show/hide message timestamps
            toggleMessageTimestamps(isChecked);
            break;
    }

    if (shouldSave) {
        saveSettings();
    }
}

/**
 * Toggle message timestamps visibility
 */
function toggleMessageTimestamps(show) {
    const style = document.getElementById('timestamp-style');

    if (show) {
        // Create or ensure the timestamp CSS style exists
        if (!style) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'timestamp-style';
            styleSheet.textContent = `
                .message-time {
                    display: block !important;
                    font-size: 11px;
                    color: var(--text-light);
                    margin-top: 5px;
                    opacity: 0.7;
                    font-style: italic;
                }
            `;
            document.head.appendChild(styleSheet);
        }

        // Add timestamps to existing messages
        const messages = document.querySelectorAll('.message:not(.has-timestamp)');
        messages.forEach((message, index) => {
            // Try to get timestamp from current chat messages
            let timestamp = new Date();

            if (currentChatMessages && currentChatMessages[index]) {
                timestamp = new Date(currentChatMessages[index].timestamp);
            }

            const timeSpan = document.createElement('span');
            timeSpan.className = 'message-time';
            timeSpan.textContent = timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            message.appendChild(timeSpan);
            message.classList.add('has-timestamp');
        });
    } else {
        // Remove the timestamp CSS
        if (style) {
            style.remove();
        }

        // Remove timestamp elements and classes from messages
        document.querySelectorAll('.message.has-timestamp').forEach(message => {
            const timeSpan = message.querySelector('.message-time');
            if (timeSpan) {
                timeSpan.remove();
            }
            message.classList.remove('has-timestamp');
        });
    }
}

/**
 * Export user data
 */
function exportUserData() {
    const userData = {
        user: currentUser,
        chatHistory: JSON.parse(localStorage.getItem('chatHistory') || '[]'),
        settings: getSettings(),
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    showAlert('📥 Your data has been exported successfully!', 'success');
}

/**
 * Reset all settings to defaults
 */
function resetAllSettings() {
    if (confirm('🔄 Are you sure you want to reset all settings to their defaults? This cannot be undone.')) {
        localStorage.removeItem('chatbotSettings');

        // Reset UI to defaults
        const defaultSettings = getSettings();

        // Reset theme
        applyTheme(defaultSettings.theme);
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) themeSelect.value = defaultSettings.theme;

        // Reset font size
        applyFontSize(defaultSettings.fontSize);
        const fontSizeSelect = document.getElementById('fontSizeSelect');
        if (fontSizeSelect) fontSizeSelect.value = defaultSettings.fontSize;

        // Reset all toggles
        Object.keys(defaultSettings.toggles).forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            const value = defaultSettings.toggles[toggleId];
            if (toggle) {
                toggle.checked = value;
                handleToggleChange(toggleId, value, false);
            }
        });

        saveSettings();
        showAlert('✅ All settings have been reset to defaults!', 'success');
    }
}

/**
 * Show privacy policy modal
 */
function showPrivacyPolicy() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h3><i class="fas fa-shield-alt"></i> Privacy Policy</h3>
                <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div style="padding: 20px; max-height: 400px; overflow-y: auto; line-height: 1.6;">
                <h4>🔒 Information We Collect</h4>
                <p>We collect information you provide directly to us, such as when you create an account, use our chatbot, or contact us for support. This includes your name, email, university ID, and chat conversations.</p>
                
                <h4>💼 How We Use Your Information</h4>
                <p>We use the information we collect to provide, maintain, and improve our services, including to respond to your inquiries and provide customer support. We also use this information to ensure appropriate access to university policies and regulations.</p>
                
                <h4>🤝 Information Sharing</h4>
                <p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as required by university policy or legal obligations.</p>
                
                <h4>🛡️ Data Security</h4>
                <p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All data is encrypted and stored securely.</p>
                
                <h4>📧 Contact Us</h4>
                <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:privacy@york.citycollege.eu" style="color: var(--primary-orange);">privacy@york.citycollege.eu</a></p>
                
                <div style="margin-top: 20px; padding: 15px; background: #f0f8ff; border-radius: 8px; border-left: 4px solid #2196f3;">
                    <p style="margin: 0; font-size: 14px; color: #1565c0;"><strong>📅 Last Updated:</strong> December 2024</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * Show terms of service modal
 */
function showTermsOfService() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h3><i class="fas fa-file-contract"></i> Terms of Service</h3>
                <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div style="padding: 20px; max-height: 400px; overflow-y: auto; line-height: 1.6;">
                <h4>✅ Acceptance of Terms</h4>
                <p>By accessing and using this chatbot service, you accept and agree to be bound by the terms and provision of this agreement. This service is provided exclusively for City College University of York students, faculty, and staff.</p>
                
                <h4>📋 Use License</h4>
                <p>Permission is granted to use this chatbot for personal, educational, and official university business. This includes asking questions about university policies, regulations, and procedures.</p>
                
                <h4>⚠️ Disclaimer</h4>
                <p>The information provided by this chatbot is for general informational purposes only. While we strive for accuracy, all information should be verified with official university sources for critical decisions.</p>
                
                <h4>🚫 Prohibited Uses</h4>
                <p>You may not use this service for any unlawful purpose, to harass others, or to share inappropriate content. Academic integrity policies apply to all interactions.</p>
                
                <h4>📞 Contact Information</h4>
                <p>If you have any questions about these Terms of Service, please contact us at <a href="mailto:support@york.citycollege.eu" style="color: var(--primary-orange);">support@york.citycollege.eu</a></p>
                
                <div style="margin-top: 20px; padding: 15px; background: #fff8f0; border-radius: 8px; border-left: 4px solid var(--primary-orange);">
                    <p style="margin: 0; font-size: 14px; color: #d84315;"><strong>📅 Last Updated:</strong> December 2024</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

/**
 * Toggle forms section in sidebar
 */
function toggleFormsSection() {
    const formsContent = document.getElementById('formsContent');
    const expandIcon = document.getElementById('formsExpandIcon');

    if (formsContent && expandIcon) {
        if (formsContent.style.display === 'none') {
            formsContent.style.display = 'block';
            expandIcon.style.transform = 'rotate(0deg)';
        } else {
            formsContent.style.display = 'none';
            expandIcon.style.transform = 'rotate(-90deg)';
        }
    }
}

/**
 * Open forms modal
 */
function openFormsModal() {
    showModal('formsModal');
}

/**
 * Show chat statistics dashboard
 */
async function showChatStatistics() {
    // Chat statistics functionality is currently unavailable
    showAlert('Chat Statistics: Feature temporarily unavailable. Analytics system is being updated.', 'info');
}


/**
 * Show user management interface
 */
async function showUserManagement() {
    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showUserManagementModal(data.data.users);
        } else {
            showAlert(data.message || 'Failed to load users', 'error');
        }
    } catch (error) {
        showAlert('Error loading users', 'error');
        console.error('User management error:', error);
    }
}

/**
 * Show user management modal
 */
function showUserManagementModal(users) {
    // Check if current user has admin privileges (admin or staff)
    const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'staff';



    const modal = document.createElement('div');
    modal.id = 'userManagementModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h3><i class="fas fa-users"></i> User Management</h3>
                <button class="close-btn" onclick="document.getElementById('userManagementModal').remove()">&times;</button>
            </div>
            <div class="user-management-content">
                ${!isAdmin ? `
                    <div class="access-denied">
                        <p><i class="fas fa-exclamation-triangle"></i> Only administrators can manage user roles.</p>
                    </div>
                ` : ''}
                <div class="users-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Current Role</th>
                                <th>Department</th>
                                ${isAdmin ? '<th>Promote to Admin</th>' : '<th>Actions</th>'}
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => `
                                <tr data-user-id="${user._id}">
                                    <td>${user.firstName} ${user.lastName}</td>
                                    <td>${user.email}</td>
                                    <td>
                                        <span class="role-display ${user.role}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                                    </td>
                                    <td>${user.department || 'N/A'}</td>
                                    <td>
                                        <div class="user-actions">
                                                                                          ${isAdmin && user.role === 'student' ? `
                                                  <button class="btn-small promote-btn" data-user-id="${user._id}">
                                                      Promote to Admin
                                                  </button>
                                              ` : isAdmin && user.role === 'admin' ? `
                                                  <span class="already-admin">Already Admin</span>
                                              ` : isAdmin && user.role === 'staff' ? `
                                                  <span class="staff-member">Staff Member</span>
                                              ` : `
                                                  <span class="access-restricted">Admin Only</span>
                                              `}
                                            ${isAdmin && user._id !== currentUser.id ? `
                                                <button class="btn-small delete-user-btn" data-user-id="${user._id}" style="background-color: #ff6b6b; margin-left: 8px;">
                                                    <i class="fas fa-trash"></i> Delete
                                                </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners for promote and delete buttons (only if admin)
    if (isAdmin) {
        modal.querySelectorAll('.promote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => promoteToAdmin(e.target.dataset.userId));
        });

        modal.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteUser(e.target.dataset.userId));
        });
    }
}

/**
 * Promote user to admin
 */
async function promoteToAdmin(userId) {
    // Double-check admin privileges (admin or staff)
    const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
    if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
        showAlert('Only administrators and staff can promote users to admin', 'error');
        return;
    }

    if (!confirm('Are you sure you want to promote this user to Administrator? This will give them full administrative privileges.')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'admin' })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('User promoted to Administrator successfully', 'success');
            // Refresh the user management modal
            document.getElementById('userManagementModal').remove();
            showUserManagement();
        } else {
            showAlert(data.message || 'Failed to promote user', 'error');
        }
    } catch (error) {
        showAlert('Error promoting user', 'error');
        console.error('Promote user error:', error);
    }
}

/**
 * Show banned word management interface
 */
async function showBannedWordManagement() {
    try {
        const response = await fetch('/api/admin/banned-words', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showBannedWordModal(data.data.bannedWords);
        } else {
            showAlert(data.message || 'Failed to load banned words', 'error');
        }
    } catch (error) {
        showAlert('Error loading banned words', 'error');
        console.error('Banned words error:', error);
    }
}

/**
 * Show banned word management modal
 */
function showBannedWordModal(bannedWords) {
    const modal = document.createElement('div');
    modal.id = 'bannedWordModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-ban"></i> Content Filter Management</h3>
                <button class="close-btn" onclick="document.getElementById('bannedWordModal').remove()">&times;</button>
            </div>
            <div class="banned-word-content">
                <div class="add-word-section">
                    <h4>Add Banned Word</h4>
                    <div class="input-group">
                        <input type="text" id="newBannedWord" placeholder="Enter word to ban..." maxlength="50">
                        <button id="addBannedWordBtn" class="btn">Add Word</button>
                    </div>
                </div>
                
                <div class="banned-words-list">
                                            <h4 data-count="(${bannedWords.length})">Currently Banned Words</h4>
                    <div class="words-container">
                        ${bannedWords.map(word => `
                            <div class="word-item" data-word="${word.word}">
                                <span class="word">${word.word}</span>
                                <span class="word-date">Added ${new Date(word.addedAt).toLocaleDateString()}</span>
                                <button class="remove-word-btn" data-word="${word.word}">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    document.getElementById('addBannedWordBtn').addEventListener('click', addBannedWord);
    document.getElementById('newBannedWord').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addBannedWord();
    });

    modal.querySelectorAll('.remove-word-btn').forEach(btn => {
        btn.addEventListener('click', (e) => removeBannedWord(e.target.closest('button').dataset.word));
    });
}

/**
 * Add a banned word
 */
async function addBannedWord() {
    const wordInput = document.getElementById('newBannedWord');
    const word = wordInput.value.trim();

    if (!word) {
        showAlert('Please enter a word to ban', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/banned-words', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ word })
        });

        const data = await response.json();

        if (data.success) {
            showAlert(`Word "${word}" added to banned list`, 'success');
            wordInput.value = '';
            // Refresh the modal
            document.getElementById('bannedWordModal').remove();
            showBannedWordManagement();
        } else {
            showAlert(data.message || 'Failed to add banned word', 'error');
        }
    } catch (error) {
        showAlert('Error adding banned word', 'error');
        console.error('Add banned word error:', error);
    }
}

/**
 * Remove a banned word
 */
async function removeBannedWord(word) {
    if (!confirm(`Are you sure you want to remove "${word}" from the banned list?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/banned-words/${encodeURIComponent(word)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showAlert(`Word "${word}" removed from banned list`, 'success');
            // Refresh the modal
            document.getElementById('bannedWordModal').remove();
            showBannedWordManagement();
        } else {
            showAlert(data.message || 'Failed to remove banned word', 'error');
        }
    } catch (error) {
        showAlert('Error removing banned word', 'error');
        console.error('Remove banned word error:', error);
    }
}

/**
 * Show contact management interface
 */
async function showContactManagement() {
    try {
        const response = await fetch('/api/admin/contacts', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showContactManagementModal(data.data.contacts);
        } else {
            showAlert(data.message || 'Failed to load contacts', 'error');
        }
    } catch (error) {
        showAlert('Error loading contacts', 'error');
        console.error('Contact management error:', error);
    }
}

/**
 * Show contact management modal
 */
function showContactManagementModal(contacts) {
    const modal = document.createElement('div');
    modal.id = 'contactManagementModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <div class="modal-header">
                <h3><i class="fas fa-address-book"></i> Contact Directory Management</h3>
                <button class="close-btn" onclick="document.getElementById('contactManagementModal').remove()">&times;</button>
            </div>
            <div class="contact-management-content">
                <div class="add-contact-section">
                    <h4>Add New Contact</h4>
                    <form id="addContactForm">
                        <div class="form-row">
                            <input type="text" id="contactName" placeholder="Full Name" required>
                            <input type="text" id="contactTitle" placeholder="Title/Position">
                        </div>
                        <div class="form-row">
                            <input type="text" id="contactDepartment" placeholder="Department" required>
                            <input type="email" id="contactEmail" placeholder="Email Address" required>
                        </div>
                        <div class="form-row">
                            <input type="text" id="contactPhone" placeholder="Phone Number">
                            <input type="text" id="contactOffice" placeholder="Office Location">
                        </div>
                        <button type="submit" class="btn">Add Contact</button>
                    </form>
                </div>
                
                <div class="contacts-list">
                    <h4>Current Contacts (${contacts.length})</h4>
                    <div class="contacts-table">
                        ${contacts.map(contact => `
                            <div class="contact-item" data-contact-id="${contact.id}">
                                <div class="contact-info">
                                    <h5>${contact.name}</h5>
                                    <p class="contact-title">${contact.title}</p>
                                    <p class="contact-dept">${contact.department}</p>
                                    <p class="contact-details">
                                        <span class="contact-email">${contact.email}</span>
                                        ${contact.phone ? `<span class="contact-phone">${contact.phone}</span>` : ''}
                                        ${contact.office ? `<span class="contact-office">${contact.office}</span>` : ''}
                                    </p>
                                </div>
                                <div class="contact-actions">
                                    <button class="btn-small edit-contact" data-contact-id="${contact.id}">Edit</button>
                                    <button class="btn-small remove-contact" data-contact-id="${contact.id}">Remove</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    document.getElementById('addContactForm').addEventListener('submit', addContact);

    modal.querySelectorAll('.remove-contact').forEach(btn => {
        btn.addEventListener('click', (e) => removeContact(e.target.dataset.contactId));
    });
}

/**
 * Add a new contact
 */
async function addContact(e) {
    e.preventDefault();

    const contactData = {
        name: document.getElementById('contactName').value.trim(),
        title: document.getElementById('contactTitle').value.trim(),
        department: document.getElementById('contactDepartment').value.trim(),
        email: document.getElementById('contactEmail').value.trim(),
        phone: document.getElementById('contactPhone').value.trim(),
        office: document.getElementById('contactOffice').value.trim()
    };

    if (!contactData.name || !contactData.department || !contactData.email) {
        showAlert('Name, department, and email are required', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/contacts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contactData)
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Contact added successfully', 'success');
            // Refresh the modal
            document.getElementById('contactManagementModal').remove();
            showContactManagement();
        } else {
            showAlert(data.message || 'Failed to add contact', 'error');
        }
    } catch (error) {
        showAlert('Error adding contact', 'error');
        console.error('Add contact error:', error);
    }
}

/**
 * Remove a contact
 */
async function removeContact(contactId) {
    if (!confirm('Are you sure you want to remove this contact?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/contacts/${contactId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Contact removed successfully', 'success');
            // Refresh the modal
            document.getElementById('contactManagementModal').remove();
            showContactManagement();
        } else {
            showAlert(data.message || 'Failed to remove contact', 'error');
        }
    } catch (error) {
        showAlert('Error removing contact', 'error');
        console.error('Remove contact error:', error);
    }
}

/**
 * Delete user entirely (admin only)
 */
async function deleteUser(userId) {
    // Double-check admin privileges (admin or staff)
    const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
    if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
        showAlert('Only administrators can delete users', 'error');
        return;
    }

    // Prevent admin from deleting themselves
    if (userId === currentUser.id) {
        showAlert('You cannot delete your own account', 'error');
        return;
    }

    if (!confirm('⚠️ Are you sure you want to DELETE this user entirely? This action cannot be undone and will remove:\n\n• User account\n• All chat history\n• All user data\n\nThis is permanent!')) {
        return;
    }

    // Double confirmation for safety
    if (!confirm('🚨 FINAL CONFIRMATION: This will permanently delete the user and all their data. Are you absolutely sure?')) {
        return;
    }

    try {
        showLoading('Deleting user...');

        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        hideLoading();

        if (data.success) {
            showAlert('User deleted successfully', 'success');
            // Refresh the user management modal
            document.getElementById('userManagementModal').remove();
            showUserManagement();
        } else {
            showAlert(data.message || 'Failed to delete user', 'error');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error deleting user', 'error');
        console.error('Delete user error:', error);
    }
}

/**
 * Check message for banned words in real-time
 */
async function checkMessageContent(message) {
    if (!message || message.trim().length === 0) {
        return { hasViolations: false, violations: [] };
    }

    try {
        const response = await fetch('/api/rag-chat/check-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (response.ok) {
            const data = await response.json();
            return {
                hasViolations: data.hasViolations,
                violations: data.violations || [],
                message: data.message
            };
        }
    } catch (error) {
        console.error('Error checking message content:', error);
    }

    return { hasViolations: false, violations: [] };
}

/**
 * Show content violation warning
 */
function showContentViolationWarning(violations) {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    // Add visual indicator to input
    messageInput.classList.add('content-violation');
    sendBtn.disabled = true;
    sendBtn.classList.add('disabled');

    // Show tooltip or warning message
    let warningDiv = document.getElementById('contentWarning');
    if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.id = 'contentWarning';
        warningDiv.className = 'content-warning';
        messageInput.parentNode.appendChild(warningDiv);
    }

    warningDiv.innerHTML = `⚠️ Your message contains prohibited content: <strong>${violations.join(', ')}</strong>`;
    warningDiv.style.display = 'block';
}

/**
 * Clear content violation warning
 */
function clearContentViolationWarning() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const warningDiv = document.getElementById('contentWarning');

    messageInput.classList.remove('content-violation');
    sendBtn.disabled = false;
    sendBtn.classList.remove('disabled');

    if (warningDiv) {
        warningDiv.style.display = 'none';
    }
}