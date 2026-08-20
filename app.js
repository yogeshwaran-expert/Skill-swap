/* ============================================ */
/* SkillSwap — Interactive App Logic             */
/* ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    // === State ===
    const state = {
        currentScreen: 'onboarding',
        currentTab: 'home',
        onboardingStep: 0,
        signupStep: 0, // 0 = form, 1 = otp
        swapFilter: 'pending',
    };

    // === Screen Navigation ===
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById(`screen-${screenId}`);
        if (target) {
            target.classList.add('active');
            state.currentScreen = screenId;
        }
    }

    // === Tab Navigation ===
    function navigateToTab(tabName) {
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        const tabContent = document.getElementById(`tab-${tabName}`);
        if (tabContent) {
            tabContent.classList.add('active');
        }

        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.remove('active');
            t.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 0";
        });
        const navTab = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
        if (navTab) {
            navTab.classList.add('active');
            navTab.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 1";
        }

        state.currentTab = tabName;

        // Scroll to top
        const content = document.getElementById('app-content');
        if (content) content.scrollTop = 0;

        // Show/hide the header & bottom nav for collaborate tab
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

    // Expose navigateToTab globally for inline onclick handlers
    window.navigateToTab = navigateToTab;

    // === Onboarding ===
    const onboardingCards = document.querySelectorAll('.onboarding-card');
    const dots = document.querySelectorAll('.dot');
    let autoSlideInterval;

    function showOnboardingStep(step) {
        onboardingCards.forEach((card, i) => {
            card.classList.remove('active', 'exit');
            if (i === step) {
                card.classList.add('active');
            } else if (i < step) {
                card.classList.add('exit');
            }
        });
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === step);
        });
        state.onboardingStep = step;
    }

    function startAutoSlide() {
        autoSlideInterval = setInterval(() => {
            const next = (state.onboardingStep + 1) % 3;
            showOnboardingStep(next);
        }, 3500);
    }

    function stopAutoSlide() {
        clearInterval(autoSlideInterval);
    }

    // Start onboarding carousel
    startAutoSlide();

    // Dot click navigation
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            stopAutoSlide();
            showOnboardingStep(i);
            startAutoSlide();
        });
    });

    // Touch/Swipe on onboarding cards
    let touchStartX = 0;
    const onboardingCardsContainer = document.getElementById('onboarding-cards');
    if (onboardingCardsContainer) {
        onboardingCardsContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            stopAutoSlide();
        }, { passive: true });

        onboardingCardsContainer.addEventListener('touchend', (e) => {
            const diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) {
                if (diff > 0 && state.onboardingStep < 2) {
                    showOnboardingStep(state.onboardingStep + 1);
                } else if (diff < 0 && state.onboardingStep > 0) {
                    showOnboardingStep(state.onboardingStep - 1);
                }
            }
            startAutoSlide();
        }, { passive: true });
    }

    // === Button Handlers ===

    // Get Started -> Sign Up
    const btnGetStarted = document.getElementById('btn-get-started');
    if (btnGetStarted) {
        btnGetStarted.addEventListener('click', () => {
            stopAutoSlide();
            showScreen('signup');
        });
    }

    // Sign In link -> also go to signup
    const btnSignin = document.getElementById('btn-signin');
    if (btnSignin) {
        btnSignin.addEventListener('click', (e) => {
            e.preventDefault();
            stopAutoSlide();
            showScreen('signup');
        });
    }

    // Sign Up Back -> Onboarding
    const signupBack = document.getElementById('signup-back');
    if (signupBack) {
        signupBack.addEventListener('click', () => {
            showScreen('onboarding');
            startAutoSlide();
        });
    }

    // Sign Up Next -> OTP or Profile Setup
    const btnSignupNext = document.getElementById('btn-signup-next');
    if (btnSignupNext) {
        btnSignupNext.addEventListener('click', () => {
            const otpSection = document.getElementById('otp-section');
            if (state.signupStep === 0) {
                // Show OTP
                otpSection.style.display = 'block';
                otpSection.style.animation = 'fadeInUp 0.4s ease';
                btnSignupNext.querySelector('span:first-child').textContent = 'Verify & Continue';
                state.signupStep = 1;
            } else {
                // Go to profile setup
                showScreen('profile-setup');
                state.signupStep = 0;
                otpSection.style.display = 'none';
                btnSignupNext.querySelector('span:first-child').textContent = 'Continue';
            }
        });
    }

    // Profile Setup Back -> Sign Up
    const profileSetupBack = document.getElementById('profile-setup-back');
    if (profileSetupBack) {
        profileSetupBack.addEventListener('click', () => {
            showScreen('signup');
        });
    }

    // Complete Profile -> App Main
    const btnProfileComplete = document.getElementById('btn-profile-complete');
    if (btnProfileComplete) {
        btnProfileComplete.addEventListener('click', () => {
            showScreen('app');
            navigateToTab('home');
        });
    }

    // === Bottom Navigation ===
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            navigateToTab(tabName);
        });
    });

    // Header avatar -> profile tab
    const headerAvatarBtn = document.getElementById('header-avatar-btn');
    if (headerAvatarBtn) {
        headerAvatarBtn.addEventListener('click', () => {
            navigateToTab('profile');
        });
    }

    // === Find My Match ===
    const btnFindMatch = document.getElementById('btn-find-match');
    const matchModal = document.getElementById('match-modal');
    const closeMatchModal = document.getElementById('close-match-modal');

    if (btnFindMatch) {
        btnFindMatch.addEventListener('click', () => {
            // Show match modal with animation
            matchModal.style.display = 'flex';
            // Add a slight delay then animate the score
            setTimeout(() => {
                animateScore();
            }, 500);
        });
    }

    if (closeMatchModal) {
        closeMatchModal.addEventListener('click', () => {
            matchModal.style.display = 'none';
        });
    }

    // Close modal on backdrop click
    if (matchModal) {
        matchModal.addEventListener('click', (e) => {
            if (e.target === matchModal) {
                matchModal.style.display = 'none';
            }
        });
    }

    // Score animation
    function animateScore() {
        const scoreCircle = document.querySelector('.score-circle circle:last-child');
        if (scoreCircle) {
            const circumference = 2 * Math.PI * 45;
            const percent = 94;
            const offset = circumference - (percent / 100) * circumference;
            scoreCircle.style.strokeDasharray = circumference;
            scoreCircle.style.strokeDashoffset = circumference;
            scoreCircle.style.transition = 'stroke-dashoffset 1s ease';
            requestAnimationFrame(() => {
                scoreCircle.style.strokeDashoffset = offset;
            });
        }
    }

    // Send Swap Request
    const btnSendSwapRequest = document.getElementById('btn-send-swap-request');
    if (btnSendSwapRequest) {
        btnSendSwapRequest.addEventListener('click', () => {
            // Visual feedback
            btnSendSwapRequest.innerHTML = `
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                <span>Request Sent!</span>
            `;
            btnSendSwapRequest.style.background = 'linear-gradient(135deg, #0f9d58, #34a853)';
            btnSendSwapRequest.style.boxShadow = '0 4px 16px rgba(15, 157, 88, 0.25)';

            setTimeout(() => {
                matchModal.style.display = 'none';
                // Reset button
                btnSendSwapRequest.innerHTML = `
                    <span>Send Swap Request</span>
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">send</span>
                `;
                btnSendSwapRequest.style.background = '';
                btnSendSwapRequest.style.boxShadow = '';
                // Navigate to swaps tab
                navigateToTab('swaps');
            }, 1500);
        });
    }

    // === Connect Button (Alex Card) ===
    const btnConnectAlex = document.getElementById('btn-connect-alex');
    if (btnConnectAlex) {
        btnConnectAlex.addEventListener('click', (e) => {
            e.stopPropagation();
            matchModal.style.display = 'flex';
            setTimeout(() => animateScore(), 500);
        });
    }

    // === Swap Tab Filters ===
    document.querySelectorAll('.swap-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.swap-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const status = tab.dataset.status;
            state.swapFilter = status;

            // Show/hide cards based on filter
            const swapCards = document.querySelectorAll('.swap-card');
            const activeSwapCard = document.getElementById('active-swap-card');

            if (status === 'pending') {
                swapCards.forEach(card => {
                    if (card.id === 'active-swap-card') {
                        card.style.display = 'none';
                    } else {
                        card.style.display = 'flex';
                    }
                });
            } else if (status === 'active') {
                swapCards.forEach(card => {
                    if (card.id === 'active-swap-card') {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });
            } else {
                // completed - show a placeholder
                swapCards.forEach(card => card.style.display = 'none');
            }
        });
    });

    // Accept Swap
    const btnAcceptSwap = document.getElementById('btn-accept-swap');
    if (btnAcceptSwap) {
        btnAcceptSwap.addEventListener('click', () => {
            btnAcceptSwap.innerHTML = `
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                <span>Accepted!</span>
            `;
            btnAcceptSwap.style.background = 'linear-gradient(135deg, #0f9d58, #34a853)';
            btnAcceptSwap.style.boxShadow = '0 4px 16px rgba(15, 157, 88, 0.25)';

            setTimeout(() => {
                // Move to active tab
                document.querySelectorAll('.swap-tab').forEach(t => t.classList.remove('active'));
                document.querySelector('.swap-tab[data-status="active"]').classList.add('active');

                // Show active card, hide pending
                document.querySelectorAll('.swap-card').forEach(card => {
                    if (card.id === 'active-swap-card') {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });

                // Update badge
                const pendingTab = document.querySelector('.swap-tab[data-status="pending"]');
                const badge = pendingTab.querySelector('.swap-tab-badge');
                if (badge) badge.textContent = '1';

                // Reset button
                btnAcceptSwap.innerHTML = `<span>Accept</span><span class="material-symbols-outlined">check</span>`;
                btnAcceptSwap.style.background = '';
                btnAcceptSwap.style.boxShadow = '';
            }, 1200);
        });
    }

    // === Dismiss Safety Banner ===
    const dismissSafety = document.getElementById('dismiss-safety');
    const safetyBanner = document.getElementById('safety-banner');
    if (dismissSafety && safetyBanner) {
        dismissSafety.addEventListener('click', () => {
            safetyBanner.style.transition = 'all 0.3s ease';
            safetyBanner.style.opacity = '0';
            safetyBanner.style.transform = 'translateX(-100%)';
            setTimeout(() => {
                safetyBanner.style.display = 'none';
            }, 300);
        });
    }

    // === Whiteboard ===
    const btnWhiteboard = document.getElementById('btn-whiteboard-tool');
    const whiteboardOverlay = document.getElementById('whiteboard-overlay');
    const closeWhiteboard = document.getElementById('close-whiteboard');
    const canvas = document.getElementById('whiteboard-canvas');

    if (btnWhiteboard) {
        btnWhiteboard.addEventListener('click', () => {
            whiteboardOverlay.style.display = 'flex';
            initWhiteboard();
        });
    }

    if (closeWhiteboard) {
        closeWhiteboard.addEventListener('click', () => {
            whiteboardOverlay.style.display = 'none';
        });
    }

    // Whiteboard drawing logic
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentColor = '#0d7377';

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

        // Draw some demo content
        ctx.font = '16px Inter';
        ctx.fillStyle = '#1a2e2e';
        ctx.fillText('Guitar Chord Chart', 20, 30);

        // Draw chord lines
        ctx.strokeStyle = '#a3bfba';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(40, 60 + i * 15);
            ctx.lineTo(180, 60 + i * 15);
            ctx.stroke();
        }
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(40 + i * 35, 60);
            ctx.lineTo(40 + i * 35, 135);
            ctx.stroke();
        }

        // Chord dots
        ctx.fillStyle = '#0d7377';
        ctx.beginPath(); ctx.arc(75, 82, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(110, 97, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(145, 97, 6, 0, Math.PI * 2); ctx.fill();

        ctx.font = '14px Inter';
        ctx.fillStyle = '#d4860b';
        ctx.fillText('C Major - Try this fingering! 🎵', 20, 170);

        // Reset for user drawing
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 3;
    }

    if (canvas) {
        function getCanvasCoords(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.offsetWidth / rect.width;
            const scaleY = canvas.offsetHeight / rect.height;
            if (e.touches) {
                return {
                    x: (e.touches[0].clientX - rect.left) * scaleX,
                    y: (e.touches[0].clientY - rect.top) * scaleY
                };
            }
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }

        canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            const coords = getCanvasCoords(e);
            lastX = coords.x;
            lastY = coords.y;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 3;
            const coords = getCanvasCoords(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            lastX = coords.x;
            lastY = coords.y;
        });

        canvas.addEventListener('mouseup', () => isDrawing = false);
        canvas.addEventListener('mouseleave', () => isDrawing = false);

        // Touch events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDrawing = true;
            const coords = getCanvasCoords(e);
            lastX = coords.x;
            lastY = coords.y;
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!isDrawing) return;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 3;
            const coords = getCanvasCoords(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();
            lastX = coords.x;
            lastY = coords.y;
        });

        canvas.addEventListener('touchend', () => isDrawing = false);
    }

    // Whiteboard color picker
    document.querySelectorAll('.wb-color').forEach(color => {
        color.addEventListener('click', () => {
            document.querySelectorAll('.wb-color').forEach(c => c.classList.remove('active'));
            color.classList.add('active');
            currentColor = getComputedStyle(color).backgroundColor;
        });
    });

    // Whiteboard tools
    document.querySelectorAll('.wb-tool').forEach(tool => {
        tool.addEventListener('click', () => {
            document.querySelectorAll('.wb-tool').forEach(t => t.classList.remove('active'));
            tool.classList.add('active');
        });
    });

    // === Profile Skills Tabs ===
    document.querySelectorAll('.profile-skill-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.profile-skill-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabType = tab.dataset.tab;
            const teachSkills = document.getElementById('profile-teach-skills');
            const learnSkills = document.getElementById('profile-learn-skills');

            if (tabType === 'teach') {
                teachSkills.style.display = 'flex';
                learnSkills.style.display = 'none';
            } else {
                teachSkills.style.display = 'none';
                learnSkills.style.display = 'flex';
            }
        });
    });

    // === Filter Pills (Discover) ===
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });

    // === Rating Modal ===
    const ratingModal = document.getElementById('rating-modal');
    const closeRatingModal = document.getElementById('close-rating-modal');

    // Rating stars interaction
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
            document.querySelectorAll('.rating-star').forEach(s => {
                s.style.transform = 'scale(1)';
            });
        });
    });

    // Rating tags toggle
    document.querySelectorAll('.rating-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            tag.classList.toggle('active');
        });
    });

    if (closeRatingModal) {
        closeRatingModal.addEventListener('click', () => {
            ratingModal.style.display = 'none';
        });
    }

    if (ratingModal) {
        ratingModal.addEventListener('click', (e) => {
            if (e.target === ratingModal) {
                ratingModal.style.display = 'none';
            }
        });
    }

    // Mark Complete button in active swap -> show rating modal
    document.querySelectorAll('.btn-success').forEach(btn => {
        btn.addEventListener('click', () => {
            ratingModal.style.display = 'flex';
        });
    });

    // === Notifications Button ===
    const btnNotifications = document.getElementById('btn-notifications');
    if (btnNotifications) {
        btnNotifications.addEventListener('click', () => {
            // Switch to swaps tab to show pending items
            navigateToTab('swaps');
        });
    }

    // === Match Card Click -> Connect ===
    document.querySelectorAll('.match-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking a button inside
            if (e.target.closest('button')) return;
            matchModal.style.display = 'flex';
            setTimeout(() => animateScore(), 500);
        });
    });

    // === Map Pin Interactions ===
    document.querySelectorAll('.map-pin').forEach(pin => {
        pin.addEventListener('click', () => {
            // Highlight the clicked pin
            document.querySelectorAll('.map-pin').forEach(p => {
                p.style.borderColor = 'var(--surface-container-lowest)';
                p.style.transform = '';
            });
            pin.style.borderColor = 'var(--primary)';
            pin.style.transform = 'scale(1.3)';
        });
    });

    // === Skill Chip Remove (Profile Setup) ===
    document.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const chip = btn.closest('.skill-chip');
            chip.style.transition = 'all 0.3s ease';
            chip.style.opacity = '0';
            chip.style.transform = 'scale(0.8)';
            setTimeout(() => chip.remove(), 300);
        });
    });

    // === Micro-interactions: Button press effects ===
    document.querySelectorAll('.btn-primary, .btn-secondary, .btn-outline, .btn-social').forEach(btn => {
        btn.addEventListener('mousedown', () => {
            btn.style.transform = 'scale(0.96)';
        });
        btn.addEventListener('mouseup', () => {
            btn.style.transform = '';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });

    // === Page visibility - pause animations ===
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoSlide();
        } else if (state.currentScreen === 'onboarding') {
            startAutoSlide();
        }
    });

    // === Keyboard shortcuts for desktop testing ===
    document.addEventListener('keydown', (e) => {
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

    // === Smooth scroll behavior for content ===
    const appContent = document.getElementById('app-content');
    if (appContent) {
        // Add scroll-based header shadow with smooth animation
        let lastScroll = 0;
        appContent.addEventListener('scroll', () => {
            const currentScroll = appContent.scrollTop;
            const appHeader = document.getElementById('app-header');
            if (appHeader) {
                if (currentScroll > 10) {
                    appHeader.style.boxShadow = '0 8px 32px rgba(26, 46, 46, 0.1)';
                } else {
                    appHeader.style.boxShadow = 'var(--shadow-ambient)';
                }
            }
            lastScroll = currentScroll;
        });
    }

    // === Initialize with intersection observer for card animations ===
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

    // === Easter Egg: Triple-tap logo for dev mode ===
    let logoTapCount = 0;
    let logoTapTimer;
    const appLogo = document.querySelector('.app-logo');
    if (appLogo) {
        appLogo.addEventListener('click', () => {
            logoTapCount++;
            clearTimeout(logoTapTimer);
            logoTapTimer = setTimeout(() => logoTapCount = 0, 500);
            if (logoTapCount === 3) {
                console.log('🎨 SkillSwap Dev Mode - Design System: Kinetic Exchange');
                logoTapCount = 0;
            }
        });
    }
});
