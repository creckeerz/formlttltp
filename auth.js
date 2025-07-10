/**
 * FIXED LTT Authentication & Session Management System
 * File: auth-fixed.js
 * 
 * Sistem autentikasi yang diperbaiki untuk Form Monitoring LTT & LTP
 * dengan session management yang akurat dan reliable
 */

(function() {
    'use strict';

    // Konfigurasi yang diperbaiki
    const CONFIG = {
        SESSION_KEY: 'ltt_session',
        SESSION_DURATION: 1 * 60 * 60 * 1000, // TEPAT 1 JAM (3.600.000 ms)
        WARNING_TIME: 5 * 60 * 1000, // Warning 5 menit sebelum expired
        CHECK_INTERVAL: 30 * 1000, // Check setiap 30 detik
        ACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 menit tanpa activity = logout
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
    let sessionCheckInterval = null;
    let sessionWarningInterval = null;
    let isWarningShown = false;
    let lastActivityTime = Date.now();

    /**
     * FIXED Authentication Object
     */
    const LTTAuth = {
        
        /**
         * Check if user is currently logged in
         * @returns {boolean}
         */
        isLoggedIn: function() {
            const session = this.getSession();
            if (!session) {
                this._logDebug('❌ No session found');
                return false;
            }
            
            const currentTime = Date.now();
            const isValid = currentTime < session.expiresAt;
            
            if (!isValid) {
                this._logDebug(`❌ Session expired - Current: ${new Date(currentTime).toLocaleString()}, Expires: ${new Date(session.expiresAt).toLocaleString()}`);
                this.clearSession();
                return false;
            }
            
            // Check activity timeout
            const timeSinceActivity = currentTime - session.lastActivity;
            if (timeSinceActivity > CONFIG.ACTIVITY_TIMEOUT) {
                this._logDebug(`❌ Session expired due to inactivity - Last activity: ${new Date(session.lastActivity).toLocaleString()}`);
                this.clearSession();
                return false;
            }
            
            this._logDebug(`✅ Session valid - Expires: ${new Date(session.expiresAt).toLocaleString()}`);
            return true;
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
                this._logDebug('❌ Error parsing session:', error);
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
            const now = Date.now();
            const sessionData = {
                accessCode: accessCode.toUpperCase(),
                loginTime: now,
                expiresAt: now + CONFIG.SESSION_DURATION, // TEPAT 1 JAM
                lastActivity: now,
                userAgent: navigator.userAgent,
                sessionId: this._generateSessionId(),
                version: '2.0' // untuk tracking version
            };
            
            try {
                localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessionData));
                this._logDebug(`✅ Session created - Expires at: ${new Date(sessionData.expiresAt).toLocaleString()}`);
                this._logDebug(`⏰ Session duration: ${CONFIG.SESSION_DURATION / (60 * 1000)} minutes`);
                return sessionData;
            } catch (error) {
                this._logDebug('❌ Error creating session:', error);
                throw new Error('Failed to create session');
            }
        },

        /**
         * Extend current session
         * @returns {boolean} Success status
         */
        extendSession: function() {
            const session = this.getSession();
            if (!session) {
                this._logDebug('❌ No session to extend');
                return false;
            }

            try {
                const now = Date.now();
                session.expiresAt = now + CONFIG.SESSION_DURATION; // Perpanjang 1 jam dari sekarang
                session.lastActivity = now;
                localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
                
                this.hideSessionWarning();
                this._logDebug(`✅ Session extended - New expiry: ${new Date(session.expiresAt).toLocaleString()}`);
                return true;
            } catch (error) {
                this._logDebug('❌ Error extending session:', error);
                return false;
            }
        },

        /**
         * Update last activity timestamp
         */
        updateActivity: function() {
            const session = this.getSession();
            if (session) {
                const now = Date.now();
                session.lastActivity = now;
                lastActivityTime = now;
                
                try {
                    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
                    // this._logDebug(`📱 Activity updated: ${new Date(now).toLocaleTimeString()}`);
                } catch (error) {
                    this._logDebug('❌ Error updating activity:', error);
                }
            }
        },

        /**
         * Clear session data
         */
        clearSession: function() {
            localStorage.removeItem(CONFIG.SESSION_KEY);
            this.stopSessionMonitoring();
            this._logDebug('🗑️ Session cleared');
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
                                message: 'Login berhasil - Sesi berlaku selama 1 jam',
                                session: session
                            });
                        } catch (error) {
                            reject(new Error('Gagal membuat session'));
                        }
                    } else {
                        reject(new Error('Kode akses tidak valid'));
                    }
                }, 1000);
            });
        },

        /**
         * Perform logout
         * @param {boolean} redirect - Whether to redirect to login page
         */
        logout: function(redirect = true) {
            this._logDebug('🚪 User logout initiated');
            this.clearSession();
            
            // Clear any cached form data
            localStorage.removeItem('ltt_form_data');
            localStorage.removeItem('ltt_pending_submissions');
            
            if (redirect) {
                this.redirectToLogin();
            }
        },

        /**
         * Redirect to login page
         */
        redirectToLogin: function() {
            if (typeof window !== 'undefined') {
                this._logDebug('🔄 Redirecting to login page');
                window.location.href = CONFIG.PAGES.LOGIN;
            }
        },

        /**
         * Redirect to main page
         */
        redirectToMain: function() {
            if (typeof window !== 'undefined') {
                this._logDebug('🔄 Redirecting to main page');
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
         * Start session monitoring - FIXED VERSION
         */
        startSessionMonitoring: function() {
            this.stopSessionMonitoring(); // Clear existing intervals
            
            this._logDebug('🔍 Starting session monitoring...');
            
            // Check session setiap 30 detik
            sessionCheckInterval = setInterval(() => {
                this._checkSession();
            }, CONFIG.CHECK_INTERVAL);

            // Setup activity tracking
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
            this._logDebug('⏹️ Session monitoring stopped');
        },

        /**
         * FIXED: Check session status
         * @private
         */
        _checkSession: function() {
            const session = this.getSession();
            if (!session) {
                this._logDebug('❌ No session found during check');
                this.stopSessionMonitoring();
                return;
            }

            const now = Date.now();
            const timeLeft = session.expiresAt - now;
            const timeSinceActivity = now - session.lastActivity;

            this._logDebug(`🔍 Session check - Time left: ${Math.floor(timeLeft / 60000)}m, Activity: ${Math.floor(timeSinceActivity / 60000)}m ago`);

            // Check if expired by time
            if (timeLeft <= 0) {
                this._logDebug(`⏰ Session expired by time at ${new Date().toLocaleString()}`);
                this.clearSession();
                this._onSessionExpired('time');
                return;
            }

            // Check if expired by inactivity
            if (timeSinceActivity > CONFIG.ACTIVITY_TIMEOUT) {
                this._logDebug(`💤 Session expired by inactivity at ${new Date().toLocaleString()}`);
                this.clearSession();
                this._onSessionExpired('inactivity');
                return;
            }

            // Show warning if time left <= 5 minutes and not already shown
            if (timeLeft <= CONFIG.WARNING_TIME && !isWarningShown) {
                this.showSessionWarning(Math.ceil(timeLeft / 60000));
            }

            // Reset warning if time increased (session was extended)
            if (timeLeft > CONFIG.WARNING_TIME && isWarningShown) {
                this.hideSessionWarning();
            }
        },

        /**
         * Show session warning dialog
         * @param {number} minutesLeft - Minutes left before expiry
         */
        showSessionWarning: function(minutesLeft) {
            if (isWarningShown) return;
            
            isWarningShown = true;
            this._logDebug(`⚠️ Showing session warning - ${minutesLeft} minutes left`);
            
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
                    this._logDebug(`⚠️ Session warning countdown: ${minutes} minutes`);
                }, 60000); // Update setiap 1 menit
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
            this._logDebug('✅ Session warning hidden');
        },

        /**
         * Handle session expiry
         * @param {string} reason - Reason for expiry
         * @private
         */
        _onSessionExpired: function(reason) {
            this._logDebug(`🕐 Session expired - Reason: ${reason}`);
            
            // Show appropriate message
            const message = reason === 'inactivity' 
                ? '🕐 Session berakhir karena tidak ada aktivitas selama 30 menit!'
                : '🕐 Session telah berakhir setelah 1 jam!';
            
            alert(message + ' Anda akan diarahkan ke halaman login.');
            
            // In real app, redirect to login
            this.redirectToLogin();
        },

        /**
         * Get session info for display
         * @returns {Object|null}
         */
        getSessionInfo: function() {
            const session = this.getSession();
            if (!session) return null;

            const now = Date.now();
            const timeLeft = session.expiresAt - now;
            const timeSinceActivity = now - session.lastActivity;
            const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

            return {
                accessCode: session.accessCode,
                loginTime: new Date(session.loginTime).toLocaleString(),
                expiresAt: new Date(session.expiresAt).toLocaleString(),
                timeLeft: timeLeft,
                timeLeftFormatted: `${hoursLeft} jam ${minutesLeft} menit`,
                lastActivity: new Date(session.lastActivity).toLocaleString(),
                timeSinceActivity: Math.floor(timeSinceActivity / 60000), // dalam menit
                isValid: this.isLoggedIn()
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
         * Private: Setup activity tracking - FIXED VERSION
         */
        _setupActivityTracking: function() {
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
            
            // Debounce activity updates to avoid too frequent localStorage writes
            let activityUpdateTimeout = null;
            
            const throttledUpdateActivity = () => {
                clearTimeout(activityUpdateTimeout);
                activityUpdateTimeout = setTimeout(() => {
                    this.updateActivity();
                }, 5000); // Update activity maksimal setiap 5 detik
            };
            
            events.forEach(event => {
                document.addEventListener(event, throttledUpdateActivity, { passive: true });
            });
            
            this._logDebug('📱 Activity tracking setup complete');
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
                        <p><small>Sesi berlaku selama 1 jam sejak login atau perpanjangan terakhir</small></p>
                        <div class="ltt-modal-actions">
                            <button onclick="LTTAuth.extendSession(); LTTAuth.hideSessionWarning();" class="ltt-btn-extend">
                                ⏱️ Perpanjang Sesi (1 Jam)
                            </button>
                            <button onclick="LTTAuth.logout()" class="ltt-btn-logout">
                                🚪 Logout
                            </button>
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
                    background: rgba(0, 0, 0, 0.7);
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .ltt-modal-content {
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 450px;
                    margin: 20px;
                    animation: modalSlideIn 0.3s ease-out;
                }
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                .ltt-modal-content h4 {
                    color: #f39c12;
                    margin: 0 0 15px 0;
                    font-size: 20px;
                }
                .ltt-modal-content p {
                    color: #2c3e50;
                    margin: 0 0 15px 0;
                    line-height: 1.5;
                }
                .ltt-modal-content small {
                    color: #7f8c8d;
                    font-size: 13px;
                }
                .ltt-modal-actions {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin-top: 25px;
                }
                .ltt-btn-extend, .ltt-btn-logout {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.3s ease;
                }
                .ltt-btn-extend {
                    background: #2ecc71;
                    color: white;
                }
                .ltt-btn-extend:hover {
                    background: #27ae60;
                    transform: translateY(-2px);
                }
                .ltt-btn-logout {
                    background: #e74c3c;
                    color: white;
                }
                .ltt-btn-logout:hover {
                    background: #c0392b;
                    transform: translateY(-2px);
                }
                @media (max-width: 480px) {
                    .ltt-modal-content {
                        padding: 25px 20px;
                        margin: 15px;
                    }
                    .ltt-modal-actions {
                        flex-direction: column;
                    }
                    .ltt-btn-extend, .ltt-btn-logout {
                        width: 100%;
                    }
                }
            `;

            document.head.appendChild(style);
            document.body.appendChild(modal);
        },

        /**
         * Private: Debug logging
         * @param {string} message - Debug message
         */
        _logDebug: function(message) {
            const timestamp = new Date().toLocaleTimeString();
            const logMessage = `[${timestamp}] LTTAuth: ${message}`;
            console.log(logMessage);
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
            LTTAuth._logDebug('🚀 Auth system initializing...');
            
            if (this.isProtectedPage()) {
                // Protected page - require authentication
                LTTAuth._logDebug('🔒 Protected page detected');
                if (LTTAuth.isLoggedIn()) {
                    LTTAuth._logDebug('✅ Valid session found, starting monitoring');
                    LTTAuth.startSessionMonitoring();
                } else {
                    LTTAuth._logDebug('❌ No valid session, redirecting to login');
                    LTTAuth.redirectToLogin();
                }
            } else {
                // Login page - redirect if already logged in
                LTTAuth._logDebug('🔓 Login page detected');
                if (LTTAuth.isLoggedIn()) {
                    LTTAuth._logDebug('✅ Already logged in, redirecting to main');
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
                    padding: 15px 25px;
                    border-radius: 10px;
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    z-index: 10002;
                    display: none;
                    max-width: 400px;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.2);
                    animation: toastSlideIn 0.3s ease-out;
                `;
                
                // Add animation
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes toastSlideIn {
                        from {
                            opacity: 0;
                            transform: translateX(-50%) translateY(20px);
                        }
                        to {
                            opacity: 1;
                            transform: translateX(-50%) translateY(0);
                        }
                    }
                `;
                document.head.appendChild(style);
                document.body.appendChild(toast);
            }

            toast.textContent = message;
            toast.style.background = success ? 
                'linear-gradient(135deg, #2ecc71, #27ae60)' : 
                'linear-gradient(135deg, #e74c3c, #c0392b)';
            toast.style.display = 'block';

            setTimeout(() => {
                toast.style.display = 'none';
            }, 4000);
        },

        /**
         * Get formatted session info
         * @returns {string}
         */
        getSessionSummary: function() {
            const info = LTTAuth.getSessionInfo();
            if (!info) return 'No active session';
            
            return `Session: ${info.accessCode} | Expires: ${info.timeLeftFormatted} | Activity: ${info.timeSinceActivity}m ago`;
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

        // Handle page visibility change untuk security
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden && AuthUtils.isProtectedPage()) {
                LTTAuth._logDebug('🔍 Page visible - checking session');
                if (!LTTAuth.isLoggedIn()) {
                    LTTAuth._logDebug('❌ Session invalid on page focus');
                    LTTAuth.logout();
                }
            }
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', function() {
            LTTAuth.stopSessionMonitoring();
        });

        // Handle browser back/forward
        window.addEventListener('pageshow', function(event) {
            if (event.persisted && AuthUtils.isProtectedPage()) {
                LTTAuth._logDebug('🔍 Page restored from cache - checking session');
                if (!LTTAuth.isLoggedIn()) {
                    LTTAuth.logout();
                }
            }
        });
    }

    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { LTTAuth, AuthUtils, CONFIG };
    }

})();
