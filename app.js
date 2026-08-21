/* ============================================ */
/* SkillSwap V1 — App Logic & Backend            */
/* localStorage State Management + Full UI       */
/* ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    // ═══════════════════════════════════════════
    // SUPABASE AUTH — browser client and real session state
    // ═══════════════════════════════════════════
    const supabaseConfig = window.SKILLSWAP_SUPABASE;
    const supabaseClient = window.supabase && supabaseConfig
        ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
        : null;
    let authSession = null;
    let authMode = 'signup';
    let sessionTimerId = null;

    // ═══════════════════════════════════════════
    // XSS SANITIZER — Escape user-controlled HTML
    // ═══════════════════════════════════════════
    function sanitize(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ═══════════════════════════════════════════
    // STORAGE MANAGER — localStorage wrapper
    // ═══════════════════════════════════════════
    const Storage = {
        get(key, fallback = null) {
            try {
                const data = localStorage.getItem(`skillswap_${key}`);
                return data ? JSON.parse(data) : fallback;
            } catch { return fallback; }
        },
        set(key, value) {
            try {
                localStorage.setItem(`skillswap_${key}`, JSON.stringify(value));
            } catch (e) { console.warn('Storage full:', e); }
        },
        remove(key) { localStorage.removeItem(`skillswap_${key}`); },
        clear() {
            Object.keys(localStorage)
                .filter(k => k.startsWith('skillswap_'))
                .forEach(k => localStorage.removeItem(k));
        }
    };

    // ═══════════════════════════════════════════
    // STATE MANAGER — Centralized app state
    // ═══════════════════════════════════════════
    const defaultState = {
        user: {
            name: '',
            email: '',
            bio: '',
            location: '',
            photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0vTl-ZT49a-ZH115FiYOjys9ynOWzT_yZTbDMVD0aZ2awDCC5K5yLjO8rmWFKX7zkqJTec89XNfUksRxrhMGuDwIYkuUtOYio45sUiJFhfkun5zarRwEgL5lT8pkbEh8cLnbzHoZk_mjsW39soWXuJzz2F6cCpUsBARK2v0PUv1Wic6sNSguALjWVAElw1AZQudRGpy5bVyo0sFdIBYmySXVcsrvLQcAprYlW3yyb6g6yINcKQutD5mEJBUmip0ds2Kwa_9cXcoM',
            skillsTeach: [],
            skillsLearn: [],
            trustScore: 4.6,
            swapsDone: 0,
            skillsTaught: 0,
            skillsLearned: 0,
        },
        settings: {
            onboarded: false,
            loggedIn: false,
            safetyDismissed: false,
            notifications: {
                swapRequests: true,
                newMatches: true,
                messages: true,
                reviews: true,
                systemUpdates: true,
            },
        },
        currentScreen: 'loading',
        currentTab: 'home',
        onboardingStep: 0,
        signupStep: 0,
        swapFilter: 'pending',
    };

    let state = Storage.get('state', null);
    if (!state) {
        state = { ...defaultState };
    } else {
        // Merge defaults for any new keys
        state = { ...defaultState, ...state, user: { ...defaultState.user, ...state.user }, settings: { ...defaultState.settings, ...state.settings } };
    }

    function saveState() {
        Storage.set('state', state);
    }

    function isAuthenticated() {
        return Boolean(authSession);
    }

    function syncUserFromSession(session) {
        if (!session?.user) return;
        const { user } = session;
        state.user.email = user.email || '';
        state.user.name = user.user_metadata?.full_name || state.user.name || user.email?.split('@')[0] || 'SkillSwap member';
        state.settings.loggedIn = true;
        saveState();
    }

    function handleAuthSwitch(event) {
        event.preventDefault();
        setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
    }

    function setAuthMode(mode) {
        authMode = mode;
        const isSignup = mode === 'signup';
        document.getElementById('auth-title').textContent = isSignup ? 'Create Account' : 'Welcome Back';
        document.getElementById('signup-name-group').style.display = isSignup ? '' : 'none';
        document.querySelector('#btn-signup-next span:first-child').textContent = isSignup ? 'Create Account' : 'Sign In';
        document.getElementById('auth-switch-copy').innerHTML = isSignup
            ? 'Already have an account? <a href="#" id="btn-auth-switch">Sign In</a>'
            : 'New to SkillSwap? <a href="#" id="btn-auth-switch">Create an account</a>';
        const switchBtn = document.getElementById('btn-auth-switch');
        switchBtn.removeEventListener('click', handleAuthSwitch);
        switchBtn.addEventListener('click', handleAuthSwitch);
    }

    // ═══════════════════════════════════════════
    // NETWORK DETECTOR — Online/offline detection
    // ═══════════════════════════════════════════
    const NetworkDetector = {
        overlay: document.getElementById('offline-overlay'),
        init() {
            window.addEventListener('online', () => this.updateStatus());
            window.addEventListener('offline', () => this.updateStatus());
            this.updateStatus();
        },
        updateStatus() {
            if (!navigator.onLine) {
                this.overlay.classList.add('active');
            } else {
                this.overlay.classList.remove('active');
            }
        },
        retry() {
            if (navigator.onLine) {
                this.overlay.classList.remove('active');
                showToast('Connected! You\'re back online.', 'success');
            } else {
                showToast('Still offline. Please check your connection.', 'error');
            }
        }
    };

    // ═══════════════════════════════════════════
    // FORM VALIDATOR
    // ═══════════════════════════════════════════
    const Validator = {
        email(val) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || /^\+?[\d\s-]{8,}$/.test(val);
        },
        required(val) {
            return val && val.trim().length > 0;
        },
        minLength(val, len) {
            return val && val.trim().length >= len;
        },
        showError(inputId, errorId) {
            const input = document.getElementById(inputId);
            const error = document.getElementById(errorId);
            if (input) input.classList.add('input-error');
            if (error) error.classList.add('visible');
        },
        clearError(inputId, errorId) {
            const input = document.getElementById(inputId);
            const error = document.getElementById(errorId);
            if (input) input.classList.remove('input-error');
            if (error) error.classList.remove('visible');
        },
        clearAll() {
            document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
            document.querySelectorAll('.form-error-msg').forEach(el => el.classList.remove('visible'));
        }
    };

    // ═══════════════════════════════════════════
    // TOAST NOTIFICATIONS — Enhanced with icons
    // ═══════════════════════════════════════════
    const toastEl = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    let toastTimer;

    const toastIcons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        warning: 'warning'
    };

    function showToast(message, type = 'info') {
        clearTimeout(toastTimer);
        toastMsg.textContent = message;
        if (toastIcon) {
            toastIcon.textContent = toastIcons[type] || 'info';
            toastIcon.style.fontVariationSettings = "'FILL' 1";
        }
        toastEl.className = 'toast';
        toastEl.classList.add(`toast-${type}`);
        requestAnimationFrame(() => {
            toastEl.classList.add('visible');
        });
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('visible');
        }, 3500);
    }

    // ═══════════════════════════════════════════
    // SCREEN NAVIGATION
    // ═══════════════════════════════════════════
    function showScreen(screenId) {
        const current = document.querySelector('.screen.active');
        const target = document.getElementById(`screen-${screenId}`);
        if (!target) return;

        if (current && current !== target) {
            current.classList.add('screen-exit');
            target.classList.add('screen-enter');
            target.classList.add('active');

            requestAnimationFrame(() => {
                target.classList.remove('screen-enter');
                target.classList.add('screen-enter-active');
            });

            setTimeout(() => {
                current.classList.remove('active', 'screen-exit');
                target.classList.remove('screen-enter-active');
            }, 350);
        } else {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            target.classList.add('active');
        }

        state.currentScreen = screenId;
        saveState();
    }

    // ═══════════════════════════════════════════
    // TAB NAVIGATION
    // ═══════════════════════════════════════════
    function navigateToTab(tabName) {
        // Every in-app tab is protected by the real Supabase session, not the
        // legacy localStorage flag. This also covers calls from hash routes.
        if (!isAuthenticated()) {
            showScreen('onboarding');
            startAutoSlide();
            return;
        }
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const tabContent = document.getElementById(`tab-${tabName}`);
        if (tabContent) tabContent.classList.add('active');

        // Update bottom nav tabs
        document.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.remove('active');
            t.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 0";
        });
        const navTab = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
        if (navTab) {
            navTab.classList.add('active');
            navTab.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 1";
        }

        // Update desktop sidebar
        document.querySelectorAll('.sidebar-nav-item').forEach(item => {
            item.classList.remove('active');
            const icon = item.querySelector('.material-symbols-outlined');
            if (icon) icon.style.fontVariationSettings = "'FILL' 0";
        });
        const sidebarItem = document.querySelector(`.sidebar-nav-item[data-tab="${tabName}"]`);
        if (sidebarItem) {
            sidebarItem.classList.add('active');
            const icon = sidebarItem.querySelector('.material-symbols-outlined');
            if (icon) icon.style.fontVariationSettings = "'FILL' 1";
        }

        state.currentTab = tabName;
        saveState();

        // Scroll to top
        const content = document.getElementById('app-content');
        if (content) content.scrollTop = 0;

        // Show/hide header & bottom nav for collaborate tab
        const appHeader = document.getElementById('app-header');
        const bottomNav = document.getElementById('bottom-nav');
        if (tabName === 'collaborate') {
            if (appHeader) appHeader.style.display = 'none';
            if (bottomNav) bottomNav.style.opacity = '0.3';
            startSessionTimer();
        } else {
            if (appHeader) appHeader.style.display = 'flex';
            if (bottomNav) bottomNav.style.opacity = '1';
            stopSessionTimer();
        }
    }

    window.navigateToTab = navigateToTab;

    // ═══════════════════════════════════════════
    // HASH ROUTER — Deep linking
    // ═══════════════════════════════════════════
    function handleRoute() {
        const hash = window.location.hash.slice(1);
        const validTabs = ['home', 'discover', 'swaps', 'collaborate', 'profile'];
        if (hash === '404') {
            showScreen('404');
        } else if (validTabs.includes(hash) && isAuthenticated()) {
            showScreen('app');
            navigateToTab(hash);
        } else if (validTabs.includes(hash)) {
            showScreen('onboarding');
            startAutoSlide();
        } else if (hash && !validTabs.includes(hash)) {
            showScreen('404');
        }
    }

    window.addEventListener('hashchange', handleRoute);

    // ═══════════════════════════════════════════
    // LOADING SCREEN
    // ═══════════════════════════════════════════
    async function initApp() {
        // Simulate loading (check images, etc.)
        setTimeout(() => {
            document.getElementById('screen-loading').classList.remove('active');

            if (isAuthenticated()) {
                showScreen('app');
                navigateToTab(state.currentTab || 'home');
                updateProfileDisplay();
            } else {
                showScreen('onboarding');
                startAutoSlide();
            }

            // Check hash route
            if (window.location.hash) handleRoute();
        }, 1800);
    }

    // ═══════════════════════════════════════════
    // ONBOARDING CAROUSEL
    // ═══════════════════════════════════════════
    const onboardingCards = document.querySelectorAll('.onboarding-card');
    const dots = document.querySelectorAll('.dot');
    let autoSlideInterval;

    function showOnboardingStep(step) {
        onboardingCards.forEach((card, i) => {
            card.classList.remove('active', 'exit');
            if (i === step) card.classList.add('active');
            else if (i < step) card.classList.add('exit');
        });
        dots.forEach((dot, i) => dot.classList.toggle('active', i === step));
        state.onboardingStep = step;
    }

    function startAutoSlide() {
        autoSlideInterval = setInterval(() => {
            showOnboardingStep((state.onboardingStep + 1) % 3);
        }, 3500);
    }

    function stopAutoSlide() { clearInterval(autoSlideInterval); }

    // Dot click
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            stopAutoSlide();
            showOnboardingStep(i);
            startAutoSlide();
        });
    });

    // Touch/Swipe on onboarding
    let touchStartX = 0;
    const onboardingContainer = document.getElementById('onboarding-cards');
    if (onboardingContainer) {
        onboardingContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            stopAutoSlide();
        }, { passive: true });

        onboardingContainer.addEventListener('touchend', (e) => {
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
                if (diff > 0 && state.onboardingStep < 2) showOnboardingStep(state.onboardingStep + 1);
                else if (diff < 0 && state.onboardingStep > 0) showOnboardingStep(state.onboardingStep - 1);
            }
            startAutoSlide();
        }, { passive: true });
    }

    // ═══════════════════════════════════════════
    // BUTTON HANDLERS
    // ═══════════════════════════════════════════

    // Get Started → Sign Up
    document.getElementById('btn-get-started')?.addEventListener('click', () => {
        stopAutoSlide();
        state.settings.onboarded = true;
        saveState();
        setAuthMode('signup');
        showScreen('signup');
    });

    // Sign In → Sign Up
    document.getElementById('btn-signin')?.addEventListener('click', (e) => {
        e.preventDefault();
        stopAutoSlide();
        state.settings.onboarded = true;
        saveState();
        setAuthMode('signin');
        showScreen('signup');
    });

    // Sign Up Back → Onboarding
    document.getElementById('signup-back')?.addEventListener('click', () => {
        showScreen('onboarding');
        startAutoSlide();
    });

    // Toggle password visibility
    document.getElementById('toggle-password')?.addEventListener('click', () => {
        const pwd = document.getElementById('signup-password');
        const icon = document.querySelector('#toggle-password .material-symbols-outlined');
        if (pwd.type === 'password') {
            pwd.type = 'text';
            icon.textContent = 'visibility';
        } else {
            pwd.type = 'password';
            icon.textContent = 'visibility_off';
        }
    });

    // Password sign-up and sign-in are handled by Supabase Auth.
    document.getElementById('btn-signup-next')?.addEventListener('click', async () => {
        Validator.clearAll();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        let valid = true;
        if (authMode === 'signup' && !Validator.required(name)) { Validator.showError('signup-name', 'error-name'); valid = false; }
        if (!Validator.email(email)) { Validator.showError('signup-email', 'error-email'); valid = false; }
        if (!Validator.minLength(password, 6)) { Validator.showError('signup-password', 'error-password'); valid = false; }
        if (!valid) return;
        if (!supabaseClient) {
            showToast('Authentication is not configured. Check the Supabase client scripts.', 'error');
            return;
        }

        const button = document.getElementById('btn-signup-next');
        button.disabled = true;
        try {
            if (authMode === 'signup') {
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name } }
                });
                if (error) throw error;
                state.user.name = name;
                state.user.email = email;
                saveState();
                if (!data.session) {
                    showToast('Check your email to confirm your account, then sign in.', 'success');
                    setAuthMode('signin');
                    return;
                }
                authSession = data.session;
                syncUserFromSession(authSession);
                showScreen('profile-setup');
            } else {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                authSession = data.session;
                syncUserFromSession(authSession);
                showScreen('app');
                navigateToTab('home');
                updateProfileDisplay();
                showToast('Welcome back!', 'success');
            }
        } catch (error) {
            showToast(error.message || 'Unable to authenticate. Please try again.', 'error');
        } finally {
            button.disabled = false;
        }
    });

    // Google OAuth
    document.getElementById('btn-google-auth')?.addEventListener('click', async () => {
        if (!supabaseClient) {
            showToast('Authentication is not configured.', 'error');
            return;
        }
        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + window.location.pathname }
            });
            if (error) throw error;
        } catch (err) {
            showToast(err.message || 'Google sign-in failed. Please try again.', 'error');
        }
    });

    // Apple Auth — Supabase OAuth
    document.getElementById('btn-apple-auth')?.addEventListener('click', async () => {
        if (!supabaseClient) {
            showToast('Authentication is not configured.', 'error');
            return;
        }
        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'apple',
                options: { redirectTo: window.location.origin + window.location.pathname }
            });
            if (error) throw error;
        } catch (err) {
            showToast(err.message || 'Apple sign-in failed. Please try again.', 'error');
        }
    });

    // Profile Setup Back → Sign Up
    document.getElementById('profile-setup-back')?.addEventListener('click', () => {
        showScreen('signup');
    });

    // ═══════════════════════════════════════════
    // PROFILE PHOTO UPLOAD
    // ═══════════════════════════════════════════
    const photoFileInput = document.getElementById('photo-file-input');
    const photoEditBtn = document.querySelector('.btn-photo-edit');

    photoEditBtn?.addEventListener('click', () => {
        if (photoFileInput) photoFileInput.click();
    });

    photoFileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file.', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be under 5MB.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            state.user.photo = base64;
            saveState();
            updateAllAvatars(base64);
            showToast('Profile photo updated! 📸', 'success');
        };
        reader.readAsDataURL(file);
    });

    function updateAllAvatars(src) {
        // Profile setup preview
        const preview = document.querySelector('#profile-photo-preview img');
        if (preview) preview.src = src;
        // Header avatar
        const headerAvatar = document.querySelector('#header-avatar-btn img');
        if (headerAvatar) headerAvatar.src = src;
        // Sidebar avatar
        const sidebarAvatar = document.querySelector('.sidebar-profile img');
        if (sidebarAvatar) sidebarAvatar.src = src;
        // Profile tab avatar
        const profileAvatar = document.getElementById('profile-avatar-display');
        if (profileAvatar) profileAvatar.src = src;
    }

    // Load saved photo on init
    if (state.user.photo) {
        updateAllAvatars(state.user.photo);
    }

    // Complete Profile → App Main
    document.getElementById('btn-profile-complete')?.addEventListener('click', () => {
        const bio = document.getElementById('setup-bio').value;
        const location = document.getElementById('setup-location').value;

        state.user.bio = bio || 'Passionate about learning and sharing skills!';
        state.user.location = location || 'Brooklyn, NY';
        if (!isAuthenticated()) {
            showScreen('onboarding');
            showToast('Please sign in to continue.', 'error');
            return;
        }
        state.settings.loggedIn = true;

        // Set demo stats
        state.user.swapsDone = 12;
        state.user.skillsTaught = 8;
        state.user.skillsLearned = 6;

        saveState();
        showScreen('app');
        navigateToTab('home');
        updateProfileDisplay();
        showToast('Welcome to SkillSwap! 🎉', 'success');
    });

    // ═══════════════════════════════════════════
    // ADD SKILL FUNCTIONALITY
    // ═══════════════════════════════════════════
    function createSkillChip(name, type, level = '') {
        const chip = document.createElement('div');
        chip.className = `skill-chip skill-chip-${sanitize(type)}`;
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        chip.appendChild(nameSpan);
        if (level) {
            const levelSpan = document.createElement('span');
            levelSpan.className = 'skill-level';
            levelSpan.textContent = level;
            chip.appendChild(levelSpan);
        }
        const removeBtn = document.createElement('button');
        removeBtn.className = 'chip-remove';
        removeBtn.setAttribute('aria-label', `Remove ${name}`);
        removeBtn.textContent = '×';
        chip.appendChild(removeBtn);
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chip.style.transition = 'all 0.3s ease';
            chip.style.opacity = '0';
            chip.style.transform = 'scale(0.8)';
            setTimeout(() => {
                chip.remove();
                updateSkillCounts();
                syncSkillsToState();
            }, 300);
        });
        return chip;
    }

    function updateSkillCounts() {
        const teachCount = document.querySelectorAll('#teach-skills .skill-chip').length;
        const learnCount = document.querySelectorAll('#learn-skills .skill-chip').length;
        const teachEl = document.getElementById('teach-count');
        const learnEl = document.getElementById('learn-count');
        if (teachEl) teachEl.textContent = `${teachCount}/10`;
        if (learnEl) learnEl.textContent = `${learnCount}/10`;
    }

    function syncSkillsToState() {
        state.user.skillsTeach = Array.from(document.querySelectorAll('#teach-skills .skill-chip span:first-child')).map(s => s.textContent);
        state.user.skillsLearn = Array.from(document.querySelectorAll('#learn-skills .skill-chip span:first-child')).map(s => s.textContent);
        saveState();
    }

    const sampleTeachSkills = ['Graphic Design', 'Illustration', 'UI Design', 'Photography', 'Cooking', 'Spanish', 'Guitar', 'Yoga'];
    const sampleLearnSkills = ['Photography', 'Guitar', 'Cooking', 'Web Dev', 'Piano', 'French', 'Fitness', 'Drawing'];
    const levels = ['Beginner', 'Intermediate', 'Expert'];

    document.getElementById('btn-add-teach-skill')?.addEventListener('click', () => {
        const existing = state.user.skillsTeach.length;
        if (existing >= 10) { showToast('Max 10 skills allowed', 'error'); return; }
        const skill = sampleTeachSkills[existing % sampleTeachSkills.length];
        const level = levels[Math.floor(Math.random() * 3)];
        const chip = createSkillChip(skill, 'teach', level);
        const container = document.getElementById('teach-skills');
        container.insertBefore(chip, container.lastElementChild);
        state.user.skillsTeach.push(skill);
        saveState();
        updateSkillCounts();
    });

    document.getElementById('btn-add-learn-skill')?.addEventListener('click', () => {
        const existing = state.user.skillsLearn.length;
        if (existing >= 10) { showToast('Max 10 skills allowed', 'error'); return; }
        const skill = sampleLearnSkills[existing % sampleLearnSkills.length];
        const chip = createSkillChip(skill, 'learn');
        const container = document.getElementById('learn-skills');
        container.insertBefore(chip, container.lastElementChild);
        state.user.skillsLearn.push(skill);
        saveState();
        updateSkillCounts();
    });

    // Remove existing chip buttons
    document.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const chip = btn.closest('.skill-chip');
            chip.style.transition = 'all 0.3s ease';
            chip.style.opacity = '0';
            chip.style.transform = 'scale(0.8)';
            setTimeout(() => { chip.remove(); updateSkillCounts(); syncSkillsToState(); }, 300);
        });
    });

    // ═══════════════════════════════════════════
    // UPDATE PROFILE DISPLAY
    // ═══════════════════════════════════════════
    function updateProfileDisplay() {
        const name = state.user.name || 'Guest User';
        const nameEl = document.getElementById('profile-display-name');
        const sidebarName = document.getElementById('sidebar-user-name');
        const bioEl = document.getElementById('profile-display-bio');
        const locEl = document.getElementById('profile-display-location');
        const swapsEl = document.getElementById('stat-swaps');
        const taughtEl = document.getElementById('stat-taught');
        const learnedEl = document.getElementById('stat-learned');

        if (nameEl) nameEl.textContent = name;
        if (sidebarName) sidebarName.textContent = name;
        if (bioEl) bioEl.textContent = state.user.bio || 'Complete your profile to start swapping skills!';
        if (locEl) locEl.textContent = state.user.location || 'Brooklyn, NY';
        if (swapsEl) swapsEl.textContent = state.user.swapsDone;
        if (taughtEl) taughtEl.textContent = state.user.skillsTaught;
        if (learnedEl) learnedEl.textContent = state.user.skillsLearned;

        // Update teach/learn skills in profile
        updateProfileSkills();
    }

    function buildProfileSkillItem(skill, i, colors, icons, proficiencies, subtexts) {
        const item = document.createElement('div');
        item.className = 'profile-skill-item';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'profile-skill-icon';
        iconWrap.style.background = `linear-gradient(135deg, ${colors[i % colors.length]})`;
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-symbols-outlined';
        iconSpan.style.fontVariationSettings = "'FILL' 1";
        iconSpan.textContent = icons[i % icons.length];
        iconWrap.appendChild(iconSpan);
        item.appendChild(iconWrap);

        const info = document.createElement('div');
        info.className = 'profile-skill-info';
        const h4 = document.createElement('h4');
        h4.textContent = skill;
        const p = document.createElement('p');
        p.textContent = subtexts[i % subtexts.length];
        info.appendChild(h4);
        info.appendChild(p);
        item.appendChild(info);

        const badge = document.createElement('span');
        const prof = proficiencies[i % proficiencies.length];
        badge.className = `proficiency-badge proficiency-${prof.toLowerCase()}`;
        badge.textContent = prof;
        item.appendChild(badge);

        return item;
    }

    function updateProfileSkills() {
        const teachContainer = document.getElementById('profile-teach-skills');
        const learnContainer = document.getElementById('profile-learn-skills');
        const teachEmpty = document.getElementById('teach-empty');
        const learnEmpty = document.getElementById('learn-empty');

        if (state.user.skillsTeach.length > 0 && teachContainer) {
            if (teachEmpty) teachEmpty.classList.remove('active');
            teachContainer.querySelectorAll('.profile-skill-item').forEach(el => el.remove());
            const colors = ['var(--primary), var(--primary-container)', 'var(--secondary), var(--secondary-container)', 'var(--accent-lavender), var(--accent-lavender-light)'];
            const icons = ['brush', 'draw', 'devices', 'photo_camera', 'restaurant', 'translate', 'music_note', 'fitness_center'];
            state.user.skillsTeach.forEach((skill, i) => {
                teachContainer.appendChild(buildProfileSkillItem(skill, i, colors, icons, ['Expert', 'Intermediate', 'Beginner'], ['Skill exchange available']));
            });
        }

        if (state.user.skillsLearn.length > 0 && learnContainer) {
            if (learnEmpty) learnEmpty.classList.remove('active');
            learnContainer.querySelectorAll('.profile-skill-item').forEach(el => el.remove());
            const colors = ['var(--secondary), var(--secondary-container)', 'var(--primary), var(--primary-container)'];
            const icons = ['photo_camera', 'music_note', 'restaurant', 'code', 'piano', 'translate', 'fitness_center', 'draw'];
            state.user.skillsLearn.forEach((skill, i) => {
                learnContainer.appendChild(buildProfileSkillItem(skill, i, colors, icons, ['Beginner'], ['Looking for a teacher']));
            });
        }
    }

    // ═══════════════════════════════════════════
    // BOTTOM & SIDEBAR NAVIGATION
    // ═══════════════════════════════════════════
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => navigateToTab(tab.dataset.tab));
    });

    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.addEventListener('click', () => navigateToTab(item.dataset.tab));
    });

    document.getElementById('header-avatar-btn')?.addEventListener('click', () => navigateToTab('profile'));

    // ═══════════════════════════════════════════
    // FIND MY MATCH
    // ═══════════════════════════════════════════
    const matchModal = document.getElementById('match-modal');
    const closeMatchModal = document.getElementById('close-match-modal');

    document.getElementById('btn-find-match')?.addEventListener('click', () => {
        matchModal.style.display = 'flex';
        setTimeout(() => animateScore(), 500);
    });

    closeMatchModal?.addEventListener('click', () => { matchModal.style.display = 'none'; });

    matchModal?.addEventListener('click', (e) => {
        if (e.target === matchModal) matchModal.style.display = 'none';
    });

    function animateScore() {
        const scoreCircle = document.querySelector('.score-circle circle:last-child');
        if (scoreCircle) {
            const circumference = 2 * Math.PI * 45;
            const percent = 94;
            const offset = circumference - (percent / 100) * circumference;
            scoreCircle.style.strokeDasharray = circumference;
            scoreCircle.style.strokeDashoffset = circumference;
            scoreCircle.style.transition = 'stroke-dashoffset 1s ease';
            requestAnimationFrame(() => { scoreCircle.style.strokeDashoffset = offset; });
        }
    }

    // Send Swap Request
    document.getElementById('btn-send-swap-request')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-send-swap-request');
        btn.innerHTML = `
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">check_circle</span>
            <span>Request Sent!</span>
        `;
        btn.style.background = 'linear-gradient(135deg, #8BC8A4, #A8E6CF)';
        btn.style.boxShadow = '0 4px 16px rgba(139,200,164,0.3)';

        setTimeout(() => {
            matchModal.style.display = 'none';
            btn.innerHTML = `
                <span>Send Swap Request</span>
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">send</span>
            `;
            btn.style.background = '';
            btn.style.boxShadow = '';
            navigateToTab('swaps');
            showToast('Swap request sent to Alex! 🎉', 'success');
        }, 1500);
    });

    // Connect Button (Alex Card)
    document.getElementById('btn-connect-alex')?.addEventListener('click', (e) => {
        e.stopPropagation();
        matchModal.style.display = 'flex';
        setTimeout(() => animateScore(), 500);
    });

    // Map connect
    document.getElementById('btn-map-connect')?.addEventListener('click', () => {
        matchModal.style.display = 'flex';
        setTimeout(() => animateScore(), 500);
    });

    // Match Card Click → Connect
    document.querySelectorAll('.match-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            matchModal.style.display = 'flex';
            setTimeout(() => animateScore(), 500);
        });
    });

    // View Profile buttons → navigate to swaps tab
    document.getElementById('btn-view-maya')?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateToTab('swaps');
    });
    document.getElementById('btn-view-liam')?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateToTab('swaps');
    });

    // ═══════════════════════════════════════════
    // SWAP TAB FILTERS
    // ═══════════════════════════════════════════
    document.querySelectorAll('.swap-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.swap-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const status = tab.dataset.status;
            state.swapFilter = status;
            saveState();

            const swapCards = document.querySelectorAll('.swap-card');
            const activeSwapCard = document.getElementById('active-swap-card');
            const emptyState = document.getElementById('swaps-empty-state');

            if (status === 'pending') {
                swapCards.forEach(card => {
                    if (card.id === 'active-swap-card') card.style.display = 'none';
                    else card.style.display = 'flex';
                });
                if (emptyState) emptyState.classList.remove('active');
            } else if (status === 'active') {
                swapCards.forEach(card => {
                    if (card.id === 'active-swap-card') card.style.display = 'flex';
                    else if (!card.classList.contains('empty-state')) card.style.display = 'none';
                });
                if (emptyState) emptyState.classList.remove('active');
            } else {
                swapCards.forEach(card => card.style.display = 'none');
                if (emptyState) emptyState.classList.add('active');
            }
        });
    });

    // Accept Swap
    document.getElementById('btn-accept-swap')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-accept-swap');
        btn.innerHTML = `
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">check_circle</span>
            <span>Accepted!</span>
        `;
        btn.style.background = 'linear-gradient(135deg, #8BC8A4, #A8E6CF)';

        setTimeout(() => {
            document.querySelectorAll('.swap-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.swap-tab[data-status="active"]').classList.add('active');

            document.querySelectorAll('.swap-card').forEach(card => {
                if (card.id === 'active-swap-card') card.style.display = 'flex';
                else card.style.display = 'none';
            });

            const badge = document.getElementById('pending-badge');
            if (badge) badge.textContent = '1';

            btn.innerHTML = `<span>Accept</span><span class="material-symbols-outlined">check</span>`;
            btn.style.background = '';
            showToast('Swap accepted! Start collaborating 🤝', 'success');
        }, 1200);
    });

    // Accept Swap 2 (Maya)
    document.getElementById('btn-accept-swap-2')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-accept-swap-2');
        btn.innerHTML = `
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">check_circle</span>
            <span>Accepted!</span>
        `;
        btn.style.background = 'linear-gradient(135deg, #8BC8A4, #A8E6CF)';
        setTimeout(() => {
            const card = btn.closest('.swap-card');
            if (card) {
                card.style.transition = 'all 0.4s ease';
                card.style.opacity = '0';
                card.style.transform = 'translateX(100%)';
                setTimeout(() => card.style.display = 'none', 400);
            }
            const badge = document.getElementById('pending-badge');
            if (badge) {
                const current = parseInt(badge.textContent) || 0;
                badge.textContent = Math.max(0, current - 1);
            }
            showToast('Swap with Maya accepted! 🤝', 'success');
        }, 1200);
    });

    // Decline Swap handlers
    function declineSwap(btnId) {
        document.getElementById(btnId)?.addEventListener('click', () => {
            const btn = document.getElementById(btnId);
            const card = btn.closest('.swap-card');
            if (card) {
                card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '0';
                card.style.transform = 'translateX(-100%) rotate(-3deg)';
                setTimeout(() => {
                    card.style.display = 'none';
                    const badge = document.getElementById('pending-badge');
                    if (badge) {
                        const current = parseInt(badge.textContent) || 0;
                        badge.textContent = Math.max(0, current - 1);
                        if (current - 1 <= 0) badge.style.display = 'none';
                    }
                    const navBadge = document.querySelector('.nav-badge');
                    if (navBadge) {
                        const current = parseInt(navBadge.textContent) || 0;
                        navBadge.textContent = Math.max(0, current - 1);
                        if (current - 1 <= 0) navBadge.style.display = 'none';
                    }
                }, 400);
                showToast('Swap request declined', 'info');
            }
        });
    }
    declineSwap('btn-decline-swap-1');
    declineSwap('btn-decline-swap-2');

    // Find swap from empty state
    document.getElementById('btn-find-swap')?.addEventListener('click', () => navigateToTab('home'));

    // ═══════════════════════════════════════════
    // SAFETY BANNER
    // ═══════════════════════════════════════════
    const dismissSafety = document.getElementById('dismiss-safety');
    const safetyBanner = document.getElementById('safety-banner');

    if (state.settings.safetyDismissed && safetyBanner) {
        safetyBanner.style.display = 'none';
    }

    dismissSafety?.addEventListener('click', () => {
        safetyBanner.style.transition = 'all 0.3s ease';
        safetyBanner.style.opacity = '0';
        safetyBanner.style.transform = 'translateX(-100%)';
        state.settings.safetyDismissed = true;
        saveState();
        setTimeout(() => { safetyBanner.style.display = 'none'; }, 300);
    });

    // ═══════════════════════════════════════════
    // WHITEBOARD
    // ═══════════════════════════════════════════
    const btnWhiteboard = document.getElementById('btn-whiteboard-tool');
    const whiteboardOverlay = document.getElementById('whiteboard-overlay');
    const closeWhiteboard = document.getElementById('close-whiteboard');
    const canvas = document.getElementById('whiteboard-canvas');

    btnWhiteboard?.addEventListener('click', () => {
        whiteboardOverlay.style.display = 'flex';
        initWhiteboard();
    });

    closeWhiteboard?.addEventListener('click', () => {
        whiteboardOverlay.style.display = 'none';
    });

    let isDrawing = false, lastX = 0, lastY = 0, currentColor = '#7EC8C8';

    function initWhiteboard() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = currentColor;

        ctx.font = '16px Inter';
        ctx.fillStyle = '#2D3436';
        ctx.fillText('Guitar Chord Chart', 20, 30);

        ctx.strokeStyle = '#B2BEC3';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath(); ctx.moveTo(40, 60 + i * 15); ctx.lineTo(180, 60 + i * 15); ctx.stroke();
        }
        for (let i = 0; i < 5; i++) {
            ctx.beginPath(); ctx.moveTo(40 + i * 35, 60); ctx.lineTo(40 + i * 35, 135); ctx.stroke();
        }

        ctx.fillStyle = '#7EC8C8';
        ctx.beginPath(); ctx.arc(75, 82, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(110, 97, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(145, 97, 6, 0, Math.PI * 2); ctx.fill();

        ctx.font = '14px Inter';
        ctx.fillStyle = '#F5C28A';
        ctx.fillText('C Major - Try this fingering! 🎵', 20, 170);

        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 3;
    }

    if (canvas) {
        function getCanvasCoords(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.offsetWidth / rect.width;
            const scaleY = canvas.offsetHeight / rect.height;
            if (e.touches) {
                return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
            }
            return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
        }

        canvas.addEventListener('mousedown', (e) => { isDrawing = true; const c = getCanvasCoords(e); lastX = c.x; lastY = c.y; });
        canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = currentColor; ctx.lineWidth = 3;
            const c = getCanvasCoords(e);
            ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(c.x, c.y); ctx.stroke();
            lastX = c.x; lastY = c.y;
        });
        canvas.addEventListener('mouseup', () => isDrawing = false);
        canvas.addEventListener('mouseleave', () => isDrawing = false);

        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isDrawing = true; const c = getCanvasCoords(e); lastX = c.x; lastY = c.y; });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); if (!isDrawing) return;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = currentColor; ctx.lineWidth = 3;
            const c = getCanvasCoords(e);
            ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(c.x, c.y); ctx.stroke();
            lastX = c.x; lastY = c.y;
        });
        canvas.addEventListener('touchend', () => isDrawing = false);
    }

    document.querySelectorAll('.wb-color').forEach(color => {
        color.addEventListener('click', () => {
            document.querySelectorAll('.wb-color').forEach(c => c.classList.remove('active'));
            color.classList.add('active');
            currentColor = getComputedStyle(color).backgroundColor;
        });
    });

    document.querySelectorAll('.wb-tool').forEach(tool => {
        tool.addEventListener('click', () => {
            document.querySelectorAll('.wb-tool').forEach(t => t.classList.remove('active'));
            tool.classList.add('active');
        });
    });

    // ═══════════════════════════════════════════
    // PROFILE SKILLS TABS
    // ═══════════════════════════════════════════
    document.querySelectorAll('.profile-skill-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.profile-skill-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabType = tab.dataset.tab;
            document.getElementById('profile-teach-skills').style.display = tabType === 'teach' ? 'flex' : 'none';
            document.getElementById('profile-learn-skills').style.display = tabType === 'learn' ? 'flex' : 'none';
        });
    });

    // ═══════════════════════════════════════════
    // DISCOVER — SEARCH & FILTERS (Enhanced)
    // ═══════════════════════════════════════════
    const skillsDatabase = [
        { name: 'Guitar', category: 'Music', icon: 'music_note', users: 24 },
        { name: 'Piano', category: 'Music', icon: 'piano', users: 18 },
        { name: 'Music Theory', category: 'Music', icon: 'library_music', users: 12 },
        { name: 'Singing', category: 'Music', icon: 'mic', users: 15 },
        { name: 'Web Development', category: 'Tech', icon: 'code', users: 42 },
        { name: 'Python Programming', category: 'Tech', icon: 'terminal', users: 38 },
        { name: 'UI/UX Design', category: 'Tech', icon: 'design_services', users: 29 },
        { name: 'Data Science', category: 'Tech', icon: 'analytics', users: 21 },
        { name: 'Graphic Design', category: 'Art', icon: 'brush', users: 31 },
        { name: 'Illustration', category: 'Art', icon: 'draw', users: 22 },
        { name: 'Photography', category: 'Art', icon: 'photo_camera', users: 27 },
        { name: 'Digital Art', category: 'Art', icon: 'palette', users: 19 },
        { name: 'Spanish', category: 'Languages', icon: 'translate', users: 33 },
        { name: 'French', category: 'Languages', icon: 'translate', users: 26 },
        { name: 'Japanese', category: 'Languages', icon: 'translate', users: 17 },
        { name: 'Mandarin', category: 'Languages', icon: 'translate', users: 14 },
        { name: 'Italian Cooking', category: 'Cooking', icon: 'restaurant', users: 20 },
        { name: 'Baking', category: 'Cooking', icon: 'bakery_dining', users: 16 },
        { name: 'Meal Prep', category: 'Cooking', icon: 'lunch_dining', users: 13 },
        { name: 'Yoga', category: 'Fitness', icon: 'self_improvement', users: 25 },
        { name: 'Weight Training', category: 'Fitness', icon: 'fitness_center', users: 30 },
        { name: 'Running Coach', category: 'Fitness', icon: 'directions_run', users: 11 },
        { name: 'Financial Planning', category: 'Business', icon: 'account_balance', users: 19 },
        { name: 'Marketing', category: 'Business', icon: 'campaign', users: 23 },
        { name: 'Public Speaking', category: 'Business', icon: 'record_voice_over', users: 14 },
        { name: 'Woodworking', category: 'DIY', icon: 'carpenter', users: 10 },
        { name: 'Sewing', category: 'DIY', icon: 'checkroom', users: 12 },
        { name: 'Home Repair', category: 'DIY', icon: 'build', users: 15 },
        { name: 'Math Tutoring', category: 'Academic', icon: 'calculate', users: 28 },
        { name: 'Essay Writing', category: 'Academic', icon: 'edit_note', users: 16 },
        { name: 'SAT Prep', category: 'Academic', icon: 'school', users: 9 },
    ];

    let activeCategory = 'All';
    const searchResultsContainer = document.getElementById('search-results-container');

    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeCategory = pill.textContent.trim();
            const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
            performSearch(query);
        });
    });

    const searchInput = document.getElementById('discover-search-input');
    const searchNoResults = document.getElementById('search-no-results');
    const mapView = document.getElementById('discover-map-view');
    const searchCount = document.getElementById('search-result-count');

    function performSearch(query) {
        let results = skillsDatabase;

        // Category filter
        if (activeCategory !== 'All') {
            results = results.filter(s => s.category === activeCategory);
        }

        // Text filter
        if (query.length > 1) {
            results = results.filter(s =>
                s.name.toLowerCase().includes(query) ||
                s.category.toLowerCase().includes(query)
            );
        }

        // Update count
        if (searchCount) {
            searchCount.textContent = query.length > 1 || activeCategory !== 'All'
                ? `${results.length} skill${results.length !== 1 ? 's' : ''} found`
                : '';
        }

        // Render results
        if (searchResultsContainer) {
            searchResultsContainer.innerHTML = '';
            if (results.length === 0 && (query.length > 1 || activeCategory !== 'All')) {
                searchNoResults.classList.add('active');
                if (mapView) mapView.style.display = 'none';
            } else {
                searchNoResults.classList.remove('active');
                if (query.length > 1 || activeCategory !== 'All') {
                    if (mapView) mapView.style.display = 'none';
                    results.forEach(skill => {
                        const card = document.createElement('div');
                        card.className = 'search-result-card';
                        const iconDiv = document.createElement('div');
                        iconDiv.className = 'search-result-icon';
                        const icon = document.createElement('span');
                        icon.className = 'material-symbols-outlined';
                        icon.style.fontVariationSettings = "'FILL' 1";
                        icon.textContent = skill.icon;
                        iconDiv.appendChild(icon);
                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'search-result-info';
                        const h4 = document.createElement('h4');
                        h4.textContent = skill.name;
                        const p = document.createElement('p');
                        p.textContent = `${skill.category} • ${skill.users} people nearby`;
                        infoDiv.appendChild(h4);
                        infoDiv.appendChild(p);
                        const btn = document.createElement('button');
                        btn.className = 'btn-secondary btn-sm';
                        btn.textContent = 'Explore';
                        btn.addEventListener('click', () => {
                            matchModal.style.display = 'flex';
                            setTimeout(() => animateScore(), 500);
                        });
                        card.appendChild(iconDiv);
                        card.appendChild(infoDiv);
                        card.appendChild(btn);
                        searchResultsContainer.appendChild(card);
                    });
                } else {
                    if (mapView) mapView.style.display = 'block';
                }
            }
        }
    }

    searchInput?.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        performSearch(query);
    });

    document.getElementById('btn-clear-search')?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        activeCategory = 'All';
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        const allPill = document.querySelector('.filter-pill');
        if (allPill) allPill.classList.add('active');
        if (searchNoResults) searchNoResults.classList.remove('active');
        if (mapView) mapView.style.display = 'block';
        if (searchResultsContainer) searchResultsContainer.innerHTML = '';
        if (searchCount) searchCount.textContent = '';
    });

    // ═══════════════════════════════════════════
    // RATING MODAL
    // ═══════════════════════════════════════════
    const ratingModal = document.getElementById('rating-modal');
    const closeRatingModal = document.getElementById('close-rating-modal');

    document.querySelectorAll('.rating-star').forEach((star, index) => {
        star.addEventListener('click', () => {
            document.querySelectorAll('.rating-star').forEach((s, i) => {
                s.style.fontVariationSettings = i <= index ? "'FILL' 1" : "'FILL' 0";
            });
        });
        star.addEventListener('mouseenter', () => {
            document.querySelectorAll('.rating-star').forEach((s, i) => {
                s.style.transform = i <= index ? 'scale(1.15)' : 'scale(1)';
            });
        });
        star.addEventListener('mouseleave', () => {
            document.querySelectorAll('.rating-star').forEach(s => { s.style.transform = 'scale(1)'; });
        });
    });

    document.querySelectorAll('.rating-tag').forEach(tag => {
        tag.addEventListener('click', () => tag.classList.toggle('active'));
    });

    closeRatingModal?.addEventListener('click', () => { ratingModal.style.display = 'none'; });
    ratingModal?.addEventListener('click', (e) => { if (e.target === ratingModal) ratingModal.style.display = 'none'; });

    // Mark Complete → show rating
    document.getElementById('btn-complete-swap')?.addEventListener('click', () => {
        ratingModal.style.display = 'flex';
    });

    document.getElementById('btn-submit-review')?.addEventListener('click', () => {
        ratingModal.style.display = 'none';
        state.user.swapsDone++;
        saveState();
        updateProfileDisplay();
        showToast('Review submitted! Thanks for the feedback ⭐', 'success');
    });

    // ═══════════════════════════════════════════
    // NOTIFICATIONS PANEL
    // ═══════════════════════════════════════════
    document.getElementById('btn-notifications')?.addEventListener('click', () => {
        const panel = document.getElementById('notification-panel');
        if (panel) {
            const isVisible = panel.classList.contains('active');
            if (isVisible) {
                panel.classList.remove('active');
            } else {
                panel.classList.add('active');
                // Clear badge
                const badge = document.getElementById('notif-badge');
                if (badge) badge.style.display = 'none';
                // Mark items as read visually
                panel.querySelectorAll('.notif-item.notif-unread').forEach(item => {
                    item.classList.remove('notif-unread');
                });
            }
        } else {
            navigateToTab('swaps');
        }
    });

    // Close notification panel when clicking outside
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notification-panel');
        const btn = document.getElementById('btn-notifications');
        if (panel && panel.classList.contains('active') && !panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.remove('active');
        }
    });

    // Notification item clicks
    document.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', () => {
            const panel = document.getElementById('notification-panel');
            if (panel) panel.classList.remove('active');
            const action = item.dataset.action;
            if (action === 'swaps') navigateToTab('swaps');
            else if (action === 'profile') navigateToTab('profile');
            else if (action === 'home') navigateToTab('home');
        });
    });

    // ═══════════════════════════════════════════
    // MAP PIN INTERACTIONS
    // ═══════════════════════════════════════════
    document.querySelectorAll('.map-pin').forEach(pin => {
        pin.addEventListener('click', () => {
            document.querySelectorAll('.map-pin').forEach(p => {
                p.style.borderColor = 'var(--glass-border)';
                p.style.transform = '';
            });
            pin.style.borderColor = 'var(--primary)';
            pin.style.transform = 'scale(1.3)';
        });
    });

    // ═══════════════════════════════════════════
    // EDIT PROFILE
    // ═══════════════════════════════════════════
    document.getElementById('btn-edit-profile')?.addEventListener('click', () => {
        // Navigate to profile setup screen for editing
        document.getElementById('setup-bio').value = state.user.bio || '';
        document.getElementById('setup-location').value = state.user.location || '';
        document.querySelector('#screen-profile-setup .screen-title').textContent = 'Edit Profile';
        document.querySelector('#screen-profile-setup .step-indicator').textContent = '';
        showScreen('profile-setup');
    });

    // ═══════════════════════════════════════════
    // NOTIFICATION PREFERENCES MODAL
    // ═══════════════════════════════════════════
    const notifPrefsModal = document.getElementById('notif-prefs-modal');
    document.getElementById('btn-profile-notifications')?.addEventListener('click', () => {
        if (notifPrefsModal) {
            // Sync toggles with state
            const prefs = state.settings.notifications;
            document.querySelectorAll('.notif-toggle').forEach(toggle => {
                const key = toggle.dataset.key;
                if (key && prefs[key] !== undefined) toggle.checked = prefs[key];
            });
            notifPrefsModal.style.display = 'flex';
        }
    });
    document.getElementById('close-notif-prefs')?.addEventListener('click', () => {
        if (notifPrefsModal) notifPrefsModal.style.display = 'none';
    });
    notifPrefsModal?.addEventListener('click', (e) => {
        if (e.target === notifPrefsModal) notifPrefsModal.style.display = 'none';
    });
    document.getElementById('btn-save-notif-prefs')?.addEventListener('click', () => {
        document.querySelectorAll('.notif-toggle').forEach(toggle => {
            const key = toggle.dataset.key;
            if (key) state.settings.notifications[key] = toggle.checked;
        });
        saveState();
        if (notifPrefsModal) notifPrefsModal.style.display = 'none';
        showToast('Notification preferences saved! 🔔', 'success');
    });

    // ═══════════════════════════════════════════
    // COMMUNITY GUIDELINES MODAL
    // ═══════════════════════════════════════════
    const guidelinesModal = document.getElementById('guidelines-modal');
    document.getElementById('btn-community-guidelines')?.addEventListener('click', () => {
        if (guidelinesModal) guidelinesModal.style.display = 'flex';
    });
    document.getElementById('close-guidelines')?.addEventListener('click', () => {
        if (guidelinesModal) guidelinesModal.style.display = 'none';
    });
    guidelinesModal?.addEventListener('click', (e) => {
        if (e.target === guidelinesModal) guidelinesModal.style.display = 'none';
    });

    // ═══════════════════════════════════════════
    // REPORT ISSUE MODAL
    // ═══════════════════════════════════════════
    const reportModal = document.getElementById('report-modal');
    document.getElementById('btn-report-issue')?.addEventListener('click', () => {
        if (reportModal) reportModal.style.display = 'flex';
    });
    document.getElementById('close-report-modal')?.addEventListener('click', () => {
        if (reportModal) reportModal.style.display = 'none';
    });
    reportModal?.addEventListener('click', (e) => {
        if (e.target === reportModal) reportModal.style.display = 'none';
    });
    document.getElementById('btn-submit-report')?.addEventListener('click', () => {
        const issueType = document.getElementById('report-type')?.value;
        const description = document.getElementById('report-description')?.value;
        if (!description || description.trim().length < 10) {
            showToast('Please provide a description (at least 10 characters).', 'error');
            return;
        }
        // Save report to localStorage
        const reports = Storage.get('reports', []);
        reports.push({ type: issueType, description: description.trim(), timestamp: Date.now() });
        Storage.set('reports', reports);
        // Reset form
        if (document.getElementById('report-description')) document.getElementById('report-description').value = '';
        if (document.getElementById('report-type')) document.getElementById('report-type').selectedIndex = 0;
        if (reportModal) reportModal.style.display = 'none';
        showToast('Report submitted! We\'ll review it shortly. 📋', 'success');
    });

    // ═══════════════════════════════════════════
    // MESSAGE SWAP
    // ═══════════════════════════════════════════
    document.getElementById('btn-message-swap')?.addEventListener('click', () => {
        navigateToTab('collaborate');
        showToast('Opening collaboration session...', 'info');
    });

    // ═══════════════════════════════════════════
    // FILTER TOGGLE
    // ═══════════════════════════════════════════
    document.getElementById('btn-filter-toggle')?.addEventListener('click', () => {
        const filterControls = document.querySelector('.filter-controls');
        const filterPills = document.getElementById('filter-pills');
        if (filterControls) {
            const isHidden = filterControls.style.display === 'none';
            filterControls.style.display = isHidden ? 'flex' : 'none';
            if (filterPills) filterPills.style.display = isHidden ? 'flex' : 'none';
        }
    });

    // ═══════════════════════════════════════════
    // 404 PAGE
    // ═══════════════════════════════════════════
    document.getElementById('btn-404-home')?.addEventListener('click', () => {
        window.location.hash = '';
        if (isAuthenticated()) {
            showScreen('app');
            navigateToTab('home');
        } else {
            showScreen('onboarding');
            startAutoSlide();
        }
    });

    // ═══════════════════════════════════════════
    // OFFLINE RETRY
    // ═══════════════════════════════════════════
    document.getElementById('btn-retry-connection')?.addEventListener('click', () => NetworkDetector.retry());

    // ═══════════════════════════════════════════
    // SIGN OUT
    // ═══════════════════════════════════════════
    document.getElementById('btn-sign-out')?.addEventListener('click', async () => {
        if (supabaseClient) await supabaseClient.auth.signOut();
        authSession = null;
        state.settings.loggedIn = false;
        state.signupStep = 0;
        saveState();
        showScreen('onboarding');
        startAutoSlide();
        showToast('Signed out successfully', 'info');
    });

    // ═══════════════════════════════════════════
    // MICRO-INTERACTIONS — Ripple Effect
    // ═══════════════════════════════════════════
    document.querySelectorAll('.btn-primary, .btn-secondary, .btn-outline, .btn-social, .btn-match-finder').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            btn.style.transform = 'scale(0.96)';
            // Ripple effect
            const ripple = document.createElement('span');
            ripple.className = 'btn-ripple';
            const rect = btn.getBoundingClientRect();
            ripple.style.left = (e.clientX - rect.left) + 'px';
            ripple.style.top = (e.clientY - rect.top) + 'px';
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
        btn.addEventListener('mouseup', () => { btn.style.transform = ''; });
        btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });

    // ═══════════════════════════════════════════
    // ANIMATED STAT COUNTERS
    // ═══════════════════════════════════════════
    function animateCounter(el, target) {
        if (!el || el.dataset.animated === 'true') return;
        el.dataset.animated = 'true';
        const duration = 800;
        const start = performance.now();
        const from = 0;
        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(from + (target - from) * ease);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // Observe profile tab for stat counter animation
    const profileTab = document.getElementById('tab-profile');
    if (profileTab && 'MutationObserver' in window) {
        const profileObserver = new MutationObserver(() => {
            if (profileTab.classList.contains('active')) {
                animateCounter(document.getElementById('stat-swaps'), state.user.swapsDone);
                animateCounter(document.getElementById('stat-taught'), state.user.skillsTaught);
                animateCounter(document.getElementById('stat-learned'), state.user.skillsLearned);
            } else {
                // Reset for next animation
                ['stat-swaps', 'stat-taught', 'stat-learned'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.dataset.animated = 'false';
                });
            }
        });
        profileObserver.observe(profileTab, { attributes: true, attributeFilter: ['class'] });
    }

    // ═══════════════════════════════════════════
    // PAGE VISIBILITY — pause animations
    // ═══════════════════════════════════════════
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopAutoSlide();
        else if (state.currentScreen === 'onboarding') startAutoSlide();
    });

    // ═══════════════════════════════════════════
    // KEYBOARD SHORTCUTS (desktop testing)
    // ═══════════════════════════════════════════
    document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === '1') navigateToTab('home');
        if (e.key === '2') navigateToTab('discover');
        if (e.key === '3') navigateToTab('swaps');
        if (e.key === '4') navigateToTab('collaborate');
        if (e.key === '5') navigateToTab('profile');
        if (e.key === 'Escape') {
            matchModal.style.display = 'none';
            if (ratingModal) ratingModal.style.display = 'none';
            if (whiteboardOverlay) whiteboardOverlay.style.display = 'none';
        }
    });

    // ═══════════════════════════════════════════
    // SCROLL EFFECTS
    // ═══════════════════════════════════════════
    const appContent = document.getElementById('app-content');
    if (appContent) {
        appContent.addEventListener('scroll', () => {
            const appHeader = document.getElementById('app-header');
            if (appHeader) {
                if (appContent.scrollTop > 10) {
                    appHeader.style.boxShadow = '0 8px 32px rgba(126,200,200,0.12)';
                } else {
                    appHeader.style.boxShadow = 'var(--shadow-glass)';
                }
            }
        });
    }

    // ═══════════════════════════════════════════
    // INTERSECTION OBSERVER — Staggered card animations
    // ═══════════════════════════════════════════
    if ('IntersectionObserver' in window) {
        let cardIndex = 0;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = (cardIndex % 6) * 100;
                    cardIndex++;
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, delay);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        document.querySelectorAll('.match-card, .swap-card, .profile-skill-item, .review-card').forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(24px)';
            card.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            observer.observe(card);
        });
    }

    // ═══════════════════════════════════════════
    // SESSION TIMER (Collaborate tab)
    // ═══════════════════════════════════════════
    let sessionSeconds = 754; // 12:34
    function startSessionTimer() {
        if (sessionTimerId) return;
        sessionTimerId = setInterval(() => {
            sessionSeconds++;
            const mins = Math.floor(sessionSeconds / 60);
            const secs = sessionSeconds % 60;
            const timerEl = document.getElementById('session-time');
            if (timerEl) timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }, 1000);
    }
    function stopSessionTimer() {
        if (sessionTimerId) { clearInterval(sessionTimerId); sessionTimerId = null; }
    }

    // ═══════════════════════════════════════════
    // EASTER EGG
    // ═══════════════════════════════════════════
    let logoTapCount = 0, logoTapTimer;
    const appLogo = document.querySelector('.app-logo');
    appLogo?.addEventListener('click', () => {
        logoTapCount++;
        clearTimeout(logoTapTimer);
        logoTapTimer = setTimeout(() => logoTapCount = 0, 500);
        if (logoTapCount === 3) {
            showToast('🎨 Dev Mode — Pastel Liquid Glass v1.0', 'info');
            logoTapCount = 0;
        }
    });

    // ═══════════════════════════════════════════
    // INIT — Start the app
    // ═══════════════════════════════════════════
    if (supabaseClient) {
        supabaseClient.auth.getSession().then(({ data }) => {
            authSession = data.session;
            if (authSession) syncUserFromSession(authSession);
            else {
                state.settings.loggedIn = false;
                saveState();
            }
        }).finally(() => initApp());
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            authSession = session;
            if (session) syncUserFromSession(session);
            else {
                state.settings.loggedIn = false;
                saveState();
            }
        });
    } else {
        initApp();
    }
    NetworkDetector.init();
});
