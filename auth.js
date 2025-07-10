/**
 * LTT Authentication & Session Management System
 * File: auth.js
 * 
 * Sistem autentikasi untuk Form Monitoring LTT & LTP
 * dengan fitur session management, auto-logout, dan keamanan
 */

(function() {
    'use strict';

    // Konfigurasi
    const CONFIG = {
        SESSION_KEY: 'ltt_session',
        SESSION_DURATION: 8 * 60 * 60 * 1000, // 8 jam dalam milliseconds
        WARNING_TIME: 5 * 60 * 1000, // Warning 5 menit sebelum expired
        VALID_ACCESS_CODES: [
            'SAMBAS2025',
            'LTT2025', 
            'PENYULUH2025',
            'ADMIN123',
            'DINAS2025'
        ],
        PAGES: {
            LOGIN: 'login.html',
            MAIN: 'index.html'
        }
    };

    // Global variables
    let sessionWarningInterval = null;
    let sessionCheckInterval = null;
    let isWarningShown = false;

    /**
     * Main Authentication Object
     */
    const LTTAuth = {
        
        /**
         * Check if user is currently logged in
         * @returns {boolean}
         */
        isLoggedIn: function() {
            const session = this.getSession();
            if (!session) return false;
            
            const currentTime = Date.now();
            const isValid = currentTime < session.expiresAt;
            
            if (!isValid) {
                this.clearSession();
            }
            
            return isValid;
        },

        /**
         * Get current session data
         * @returns {Object|null}
         */
        getSession: function() {
            try {
                const session = localStorage.getItem(CONFIG.SESSION_KEY);
                return session ? JSON.parse(session) : null;
            } catch (error) {
                console.error('Error parsing session:', error);
                this.clearSession();
                return null;
            }
        },

        /**
         * Create new session
         * @param {string} accessCode - The access code used for login
         * @returns {Object} Session data
         */
        createSession: function(accessCode) {
            const sessionData = {
                accessCode: accessCode.toUpperCase(),
                loginTime: Date.now(),
                expiresAt: Date.now() + CONFIG.SESSION_DURATION,
                userAgent: navigator.userAgent,
                lastActivity: Date.now(),
                sessionId: this._generateSessionId()
            };
            
            try {
                localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessionData));
                console.log('Session created successfully');
                return sessionData;
            } catch (error) {
                console.error('Error creating session:', error);
                throw new Error('Failed to create session');
            }
        },

        /**
         * Extend current session
         * @returns {boolean} Success status
         */
        extendSession: function() {
            const session = this.getSession();
            if (!session) return false;

            try {
                session.expiresAt = Date.now() + CONFIG.SESSION_DURATION;
                session.lastActivity = Date.now();
                localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
                
                this.hideSessionWarning();
                console.log('Session extended successfully');
                return true;
            } catch (error) {
                console.error('Error extending session:', error);
                return false;
            }
        },

        /**
         * Update last activity timestamp
         */
        updateActivity: function() {
            const session = this.getSession();
            if (session) {
                session.lastActivity = Date.now();
                localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
            }
        },

        /**
         * Clear session data
         */
        clearSession: function() {
            localStorage.removeItem(CONFIG.SESSION_KEY);
            this.stopSessionMonitoring();
        },

        /**
         * Validate access code
         * @param {string} code - Access code to validate
         * @returns {boolean}
         */
        validateAccessCode: function(code) {
            return CONFIG.VALID_ACCESS_CODES.includes(code.toUpperCase());
        },

        /**
         * Perform login
         * @param {string} accessCode - Access code
         * @returns {Promise<Object>} Login result
         */
        login: async function(accessCode) {
            return new Promise((resolve, reject) => {
                if (!accessCode || accessCode.trim() === '') {
                    reject(new Error('Kode akses tidak boleh kosong'));
                    return;
                }

                // Simulate validation delay
                setTimeout(() => {
                    if (this.validateAccessCode(accessCode)) {
                        try {
                            const session = this.createSession(accessCode);
                            resolve({
                                success: true,
                                message: 'Login berhasil',
                                session: session
                            });
                        } catch (error) {
                            reject(new Error('Gagal membuat session'));
                        }
                    } else {
                        reject(new Error('Kode akses tidak valid'));
                    }
                }, 1000); // Delay 1 detik untuk simulasi
            });
        },

        /**
         * Perform logout
         * @param {boolean} redirect - Whether to redirect to login page
         */
        logout: function(redirect = true) {
            this.clearSession();
            
            // Clear any cached form data
            localStorage.removeItem('ltt_form_data');
            localStorage.removeItem('ltt_pending_submissions');
            
            console.log('User logged out');
            
            if (redirect) {
                this.redirectToLogin();
            }
        },

        /**
         * Redirect to login page
         */
        redirectToLogin: function() {
            if (typeof window !== 'undefined') {
                window.location.href = CONFIG.PAGES.LOGIN;
            }
        },

        /**
         * Redirect to main page
         */
        redirectToMain: function() {
            if (typeof window !== 'undefined') {
                window.location.href = CONFIG.PAGES.MAIN;
            }
        },

        /**
         * Require authentication - redirect if not logged in
         * @returns {boolean}
         */
        requireAuth: function() {
            if (!this.isLoggedIn()) {
                this.redirectToLogin();
                return false;
            }
            return true;
        },

        /**
         * Start session monitoring
         */
        startSessionMonitoring: function() {
            this.stopSessionMonitoring(); // Clear existing intervals
            
            // Check session every 30 seconds
            sessionCheckInterval = setInterval(() => {
                if (!this.isLoggedIn()) {
                    this.logout();
                    return;
                }
                
                const session = this.getSession();
                if (session) {
                    const timeLeft = session.expiresAt - Date.now();
                    
                    // Show warning if time left <= warning time and not already shown
                    if (timeLeft <= CONFIG.WARNING_TIME && timeLeft > 0 && !isWarningShown) {
                        this.showSessionWarning(Math.ceil(timeLeft / 60000));
                    }
                }
            }, 30000);

            // Track user activity
            this._setupActivityTracking();
        },

        /**
         * Stop session monitoring
         */
        stopSessionMonitoring: function() {
            if (sessionCheckInterval) {
                clearInterval(sessionCheckInterval);
                sessionCheckInterval = null;
            }
            if (sessionWarningInterval) {
                clearInterval(sessionWarningInterval);
                sessionWarningInterval = null;
            }
            isWarningShown = false;
        },

        /**
         * Show session warning dialog
         * @param {number} minutesLeft - Minutes left before expiry
         */
        showSessionWarning: function(minutesLeft) {
            if (isWarningShown) return;
            
            isWarningShown = true;
            
            // Create warning modal if it doesn't exist
            this._createSessionWarningModal();
            
            const warningEl = document.getElementById('ltt-session-warning');
            const countdownEl = document.getElementById('ltt-session-countdown');
            
            if (warningEl && countdownEl) {
                countdownEl.textContent = minutesLeft;
                warningEl.style.display = 'block';
                
                // Update countdown every minute
                sessionWarningInterval = setInterval(() => {
                    const session = this.getSession();
                    if (!session) {
                        this.hideSessionWarning();
                        this.logout();
                        return;
                    }
                    
                    const timeLeft = session.expiresAt - Date.now();
                    const minutes = Math.ceil(timeLeft / 60000);
                    
                    if (minutes <= 0) {
                        this.hideSessionWarning();
                        this.logout();
                        return;
                    }
                    
                    countdownEl.textContent = minutes;
                }, 60000);
            }
        },

        /**
         * Hide session warning
         */
        hideSessionWarning: function() {
            const warningEl = document.getElementById('ltt-session-warning');
            if (warningEl) {
                warningEl.style.display = 'none';
            }
            
            if (sessionWarningInterval) {
                clearInterval(sessionWarningInterval);
                sessionWarningInterval = null;
            }
            
            isWarningShown = false;
        },

        /**
         * Get session info for display
         * @returns {Object}
         */
        getSessionInfo: function() {
            const session = this.getSession();
            if (!session) return null;

            return {
                accessCode: session.accessCode,
                loginTime: new Date(session.loginTime).toLocaleString(),
                expiresAt: new Date(session.expiresAt).toLocaleString(),
                timeLeft: session.expiresAt - Date.now(),
                lastActivity: new Date(session.lastActivity).toLocaleString()
            };
        },

        /**
         * Private: Generate unique session ID
         * @returns {string}
         */
        _generateSessionId: function() {
            return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * Private: Setup activity tracking
         */
        _setupActivityTracking: function() {
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
            
            events.forEach(event => {
                document.addEventListener(event, () => {
                    this.updateActivity();
                }, { passive: true });
            });
        },

        /**
         * Private: Create session warning modal
         */
        _createSessionWarningModal: function() {
            if (document.getElementById('ltt-session-warning')) return;

            const modal = document.createElement('div');
            modal.id = 'ltt-session-warning';
            modal.innerHTML = `
                <div class="ltt-modal-overlay">
                    <div class="ltt-modal-content">
                        <h4>⚠️ Sesi Akan Berakhir</h4>
                        <p>Sesi Anda akan berakhir dalam <span id="ltt-session-countdown">5</span> menit.</p>
                        <div class="ltt-modal-actions">
                            <button onclick="LTTAuth.extendSession()" class="ltt-btn-extend">Perpanjang Sesi</button>
                            <button onclick="LTTAuth.logout()" class="ltt-btn-logout">Logout</button>
                        </div>
                    </div>
                </div>
            `;

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                #ltt-session-warning {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10001;
                    display: none;
                }
                .ltt-modal-overlay {
                    background: rgba(0, 0, 0, 0.5);
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .ltt-modal-content {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 400px;
                    margin: 20px;
                }
                .ltt-modal-content h4 {
                    color: #f39c12;
                    margin: 0 0 15px 0;
                    font-size: 18px;
                }
                .ltt-modal-content p {
                    color: #2c3e50;
                    margin: 0 0 20px 0;
                }
                .ltt-modal-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                }
                .ltt-btn-extend, .ltt-btn-logout {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                }
                .ltt-btn-extend {
                    background: #2ecc71;
                    color: white;
                }
                .ltt-btn-extend:hover {
                    background: #27ae60;
                }
                .ltt-btn-logout {
                    background: #e74c3c;
                    color: white;
                }
                .ltt-btn-logout:hover {
                    background: #c0392b;
                }
            `;

            document.head.appendChild(style);
            document.body.appendChild(modal);
        }
    };

    /**
     * Utility functions
     */
    const AuthUtils = {
        /**
         * Check if current page requires authentication
         * @returns {boolean}
         */
        isProtectedPage: function() {
            const currentPage = window.location.pathname;
            return !currentPage.includes('login.html') && !currentPage.includes('login');
        },

        /**
         * Initialize authentication for the current page
         */
        init: function() {
            if (this.isProtectedPage()) {
                // Protected page - require authentication
                if (LTTAuth.isLoggedIn()) {
                    LTTAuth.startSessionMonitoring();
                } else {
                    LTTAuth.redirectToLogin();
                }
            } else {
                // Login page - redirect if already logged in
                if (LTTAuth.isLoggedIn()) {
                    LTTAuth.redirectToMain();
                }
            }
        },

        /**
         * Show toast notification
         * @param {string} message - Message to show
         * @param {boolean} success - Success status
         */
        showToast: function(message, success = true) {
            // Create toast if it doesn't exist
            let toast = document.getElementById('ltt-auth-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'ltt-auth-toast';
                toast.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 12px 24px;
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    z-index: 10002;
                    display: none;
                    max-width: 400px;
                `;
                document.body.appendChild(toast);
            }

            toast.textContent = message;
            toast.style.background = success ? '#2ecc71' : '#e74c3c';
            toast.style.display = 'block';

            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    };

    // Make objects globally available
    if (typeof window !== 'undefined') {
        window.LTTAuth = LTTAuth;
        window.AuthUtils = AuthUtils;

        // Auto-initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', AuthUtils.init.bind(AuthUtils));
        } else {
            AuthUtils.init();
        }

        // Handle page visibility change
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden && AuthUtils.isProtectedPage()) {
                if (!LTTAuth.isLoggedIn()) {
                    LTTAuth.logout();
                }
            }
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', function() {
            LTTAuth.stopSessionMonitoring();
        });
    }

    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { LTTAuth, AuthUtils };
    }

})();
