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

    function setAuthMode(mode) {
        authMode = mode;
        const isSignup = mode === 'signup';
        document.getElementById('auth-title').textContent = isSignup ? 'Create Account' : 'Welcome Back';
        document.getElementById('signup-name-group').style.display = isSignup ? '' : 'none';
        document.querySelector('#btn-signup-next span:first-child').textContent = isSignup ? 'Create Account' : 'Sign In';
        document.getElementById('auth-switch-copy').innerHTML = isSignup
            ? 'Already have an account? <a href="#" id="btn-auth-switch">Sign In</a>'
            : 'New to SkillSwap? <a href="#" id="btn-auth-switch">Create an account</a>';
        document.getElementById('btn-auth-switch').addEventListener('click', (event) => {
            event.preventDefault();
            setAuthMode(isSignup ? 'signin' : 'signup');
        });
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
    // TOAST NOTIFICATIONS
    // ═══════════════════════════════════════════
    const toastEl = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    let toastTimer;

    function showToast(message, type = 'info') {
        clearTimeout(toastTimer);
        toastMsg.textContent = message;
        toastEl.className = 'toast';
        toastEl.classList.add(`toast-${type}`);
        requestAnimationFrame(() => {
            toastEl.classList.add('visible');
        });
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('visible');
        }, 3000);
    }

    // ═══════════════════════════════════════════
    // SCREEN NAVIGATION
    // ═══════════════════════════════════════════
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`screen-${screenId}`);
        if (target) {
            target.classList.add('active');
            state.currentScreen = screenId;
            saveState();
        }
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
        } else {
            if (appHeader) appHeader.style.display = 'flex';
            if (bottomNav) bottomNav.style.opacity = '1';
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

    // Profile Setup Back → Sign Up
    document.getElementById('profile-setup-back')?.addEventListener('click', () => {
        showScreen('signup');
    });

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
        chip.className = `skill-chip skill-chip-${type}`;
        chip.innerHTML = `
            <span>${name}</span>
            ${level ? `<span class="skill-level">${level}</span>` : ''}
            <button class="chip-remove" aria-label="Remove ${name}">×</button>
        `;
        chip.querySelector('.chip-remove').addEventListener('click', (e) => {
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

    function updateProfileSkills() {
        const teachContainer = document.getElementById('profile-teach-skills');
        const learnContainer = document.getElementById('profile-learn-skills');
        const teachEmpty = document.getElementById('teach-empty');
        const learnEmpty = document.getElementById('learn-empty');

        if (state.user.skillsTeach.length > 0 && teachContainer) {
            if (teachEmpty) teachEmpty.classList.remove('active');
            // Remove old items (except empty state)
            teachContainer.querySelectorAll('.profile-skill-item').forEach(el => el.remove());
            const colors = ['var(--primary), var(--primary-container)', 'var(--secondary), var(--secondary-container)', 'var(--accent-lavender), var(--accent-lavender-light)'];
            const icons = ['brush', 'draw', 'devices', 'photo_camera', 'restaurant', 'translate', 'music_note', 'fitness_center'];
            state.user.skillsTeach.forEach((skill, i) => {
                const item = document.createElement('div');
                item.className = 'profile-skill-item';
                item.innerHTML = `
                    <div class="profile-skill-icon" style="background: linear-gradient(135deg, ${colors[i % colors.length]});">
                        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">${icons[i % icons.length]}</span>
                    </div>
                    <div class="profile-skill-info">
                        <h4>${skill}</h4>
                        <p>Skill exchange available</p>
                    </div>
                    <span class="proficiency-badge proficiency-${['expert', 'intermediate', 'beginner'][i % 3]}">${['Expert', 'Intermediate', 'Beginner'][i % 3]}</span>
                `;
                teachContainer.appendChild(item);
            });
        }

        if (state.user.skillsLearn.length > 0 && learnContainer) {
            if (learnEmpty) learnEmpty.classList.remove('active');
            learnContainer.querySelectorAll('.profile-skill-item').forEach(el => el.remove());
            const colors = ['var(--secondary), var(--secondary-container)', 'var(--primary), var(--primary-container)'];
            const icons = ['photo_camera', 'music_note', 'restaurant', 'code', 'piano', 'translate', 'fitness_center', 'draw'];
            state.user.skillsLearn.forEach((skill, i) => {
                const item = document.createElement('div');
                item.className = 'profile-skill-item';
                item.innerHTML = `
                    <div class="profile-skill-icon" style="background: linear-gradient(135deg, ${colors[i % colors.length]});">
                        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">${icons[i % icons.length]}</span>
                    </div>
                    <div class="profile-skill-info">
                        <h4>${skill}</h4>
                        <p>Looking for a teacher</p>
                    </div>
                    <span class="proficiency-badge proficiency-beginner">Beginner</span>
                `;
                learnContainer.appendChild(item);
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
    // DISCOVER — SEARCH & FILTERS
    // ═══════════════════════════════════════════
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });

    const searchInput = document.getElementById('discover-search-input');
    const searchNoResults = document.getElementById('search-no-results');
    const mapView = document.getElementById('discover-map-view');

    searchInput?.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length > 2) {
            const skills = ['guitar', 'cooking', 'design', 'photography', 'spanish', 'coding', 'fitness', 'illustration', 'music', 'web', 'art', 'yoga'];
            const found = skills.some(s => s.includes(query));
            if (!found) {
                searchNoResults.classList.add('active');
                if (mapView) mapView.style.display = 'none';
            } else {
                searchNoResults.classList.remove('active');
                if (mapView) mapView.style.display = 'block';
            }
        } else {
            searchNoResults.classList.remove('active');
            if (mapView) mapView.style.display = 'block';
        }
    });

    document.getElementById('btn-clear-search')?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (searchNoResults) searchNoResults.classList.remove('active');
        if (mapView) mapView.style.display = 'block';
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
    // NOTIFICATIONS
    // ═══════════════════════════════════════════
    document.getElementById('btn-notifications')?.addEventListener('click', () => navigateToTab('swaps'));

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
    // MICRO-INTERACTIONS
    // ═══════════════════════════════════════════
    document.querySelectorAll('.btn-primary, .btn-secondary, .btn-outline, .btn-social').forEach(btn => {
        btn.addEventListener('mousedown', () => { btn.style.transform = 'scale(0.96)'; });
        btn.addEventListener('mouseup', () => { btn.style.transform = ''; });
        btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });

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
    // INTERSECTION OBSERVER — Card animations
    // ═══════════════════════════════════════════
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.match-card, .swap-card, .profile-skill-item, .review-card').forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            observer.observe(card);
        });
    }

    // ═══════════════════════════════════════════
    // SESSION TIMER (Collaborate tab)
    // ═══════════════════════════════════════════
    let sessionSeconds = 754; // 12:34
    setInterval(() => {
        sessionSeconds++;
        const mins = Math.floor(sessionSeconds / 60);
        const secs = sessionSeconds % 60;
        const timerEl = document.getElementById('session-time');
        if (timerEl) timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);

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
