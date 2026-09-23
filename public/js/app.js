/* ==========================================================================
   BHUMI STUDIO - CORE SINGLE PAGE APP COORDINATOR
   ========================================================================== */

const app = {
    currentUser: null,
    currentView: "home",
    settings: {},

    async init() {
        this.bindGlobalEvents();
        await this.loadSettings();
        await this.loadAuthSession();
        
        // Initialize other modules
        await Portfolio.init();
        Booking.init();
        
        await this.loadOffersSlider();
        await this.loadTestimonials();
        
        // Run router on first load
        this.handleRouting();
    },

    /* --------------------------------------------------------------------------
       GLOBAL UI & CORE EVENTS
       -------------------------------------------------------------------------- */
    bindGlobalEvents() {
        // SPA Hash Route Listener
        window.addEventListener("hashchange", () => this.handleRouting());

        // Navbar navigation clicks
        document.querySelectorAll(".nav-link, .dropdown-item").forEach(link => {
            link.addEventListener("click", (e) => {
                const target = link.getAttribute("data-target");
                if (target) {
                    e.preventDefault();
                    this.navigateTo(target);
                    // Close hamburger menu on mobile click
                    document.getElementById("nav-menu").classList.remove("active");
                    const icon = document.getElementById("hamburger-btn").querySelector("i");
                    if (icon) icon.className = "fa-solid fa-bars";
                }
            });
        });

        // Logo click home redirect
        const logo = document.getElementById("nav-logo-btn");
        if (logo) {
            logo.addEventListener("click", (e) => {
                e.preventDefault();
                this.navigateTo("home");
            });
        }

        // Hamburger mobile menu toggle
        const hamburger = document.getElementById("hamburger-btn");
        if (hamburger) {
            hamburger.addEventListener("click", () => {
                const navMenu = document.getElementById("nav-menu");
                navMenu.classList.toggle("active");
                const icon = hamburger.querySelector("i");
                if (icon) {
                    if (navMenu.classList.contains("active")) {
                        icon.className = "fa-solid fa-xmark";
                    } else {
                        icon.className = "fa-solid fa-bars";
                    }
                }
            });
        }

        // Navbar scroll effect
        window.addEventListener("scroll", () => {
            const navbar = document.querySelector(".navbar");
            if (window.scrollY > 50) {
                navbar.style.padding = "8px 0";
                navbar.style.backgroundColor = "var(--bg-main)";
            } else {
                navbar.style.padding = "16px 0";
                navbar.style.backgroundColor = "var(--bg-navbar)";
            }
        });

        // Theme Switcher Toggler
        const themeBtn = document.getElementById("theme-toggle-btn");
        if (themeBtn) {
            themeBtn.addEventListener("click", () => this.toggleTheme());
            // Load saved theme
            const savedTheme = localStorage.getItem("bhumi_theme") || "dark";
            document.documentElement.setAttribute("data-theme", savedTheme);
            this.updateThemeIcon(savedTheme);
        }

        // Client Portal Dropdown Button
        const portalBtn = document.getElementById("user-portal-btn");
        const dropdown = document.getElementById("user-dropdown-menu");
        if (portalBtn) {
            portalBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!this.currentUser) {
                    // Open Login Modal if guest
                    this.openModal("auth-modal");
                } else {
                    // Toggle profile dropdown if authenticated
                    dropdown.classList.toggle("active");
                }
            });

            // Close dropdown clicking outside
            document.addEventListener("click", () => dropdown.classList.remove("active"));
        }

        // Modal Triggers
        document.querySelectorAll(".modal-trigger").forEach(trigger => {
            trigger.addEventListener("click", () => {
                const targetModal = trigger.getAttribute("data-modal");
                this.openModal(targetModal);
            });
        });

        // Modal Close Buttons
        document.querySelectorAll(".modal-close-btn, .modal-overlay").forEach(close => {
            close.addEventListener("click", (e) => {
                if (e.target.classList.contains("modal-overlay") || e.currentTarget.classList.contains("modal-close-btn")) {
                    const modal = e.currentTarget.closest(".modal-overlay");
                    if (modal) modal.classList.remove("active");
                }
            });
        });

        // Auth Tabs Login/Register Toggler
        const tabLogin = document.getElementById("auth-tab-login");
        const tabRegister = document.getElementById("auth-tab-register");
        if (tabLogin && tabRegister) {
            tabLogin.addEventListener("click", () => {
                tabLogin.classList.add("active");
                tabRegister.classList.remove("active");
                document.getElementById("panel-login").classList.add("active");
                document.getElementById("panel-register").classList.remove("active");
            });

            tabRegister.addEventListener("click", () => {
                tabRegister.classList.add("active");
                tabLogin.classList.remove("active");
                document.getElementById("panel-register").classList.add("active");
                document.getElementById("panel-login").classList.remove("active");
            });
        }

        // Client Dashboard Tab switcher
        document.querySelectorAll(".dash-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.getAttribute("data-tab");
                
                document.querySelectorAll(".dash-tab-btn").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".dash-tab-panel").forEach(p => p.classList.remove("active"));
                
                btn.classList.add("active");
                document.getElementById(targetTab).classList.add("active");
            });
        });

        // Forms Listeners
        const loginForm = document.getElementById("auth-login-form");
        if (loginForm) loginForm.addEventListener("submit", (e) => this.handleLogin(e));

        const regForm = document.getElementById("auth-register-form");
        if (regForm) regForm.addEventListener("submit", (e) => this.handleRegister(e));

        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) logoutBtn.addEventListener("click", () => this.handleLogout());

        const enquiryForm = document.getElementById("contact-enquiry-form");
        if (enquiryForm) enquiryForm.addEventListener("submit", (e) => this.handleEnquirySubmit(e, "contact"));

        const modalQuoteForm = document.getElementById("modal-quote-form");
        if (modalQuoteForm) modalQuoteForm.addEventListener("submit", (e) => this.handleEnquirySubmit(e, "modal"));

        const profileForm = document.getElementById("dash-profile-form");
        if (profileForm) profileForm.addEventListener("submit", (e) => this.handleSaveProfileChanges(e));
    },

    /* --------------------------------------------------------------------------
       ROUTER & NAV
       -------------------------------------------------------------------------- */
    handleRouting() {
        const hash = window.location.hash.replace("#", "") || "home";
        this.renderView(hash);
    },

    navigateTo(viewName) {
        window.location.hash = `#${viewName}`;
    },

    async renderView(viewName) {
        // Protect Dashboard and Admin view
        if (viewName === "dashboard" && !this.currentUser) {
            this.navigateTo("home");
            this.openModal("auth-modal");
            this.showToast("Please login to access client portal dashboard.", "error");
            return;
        }

        if (viewName === "admin" && (!this.currentUser || this.currentUser.role !== 'admin')) {
            this.navigateTo("home");
            this.showToast("Access Denied: Admin authorization required.", "error");
            return;
        }

        // Update nav links active class
        document.querySelectorAll(".nav-link").forEach(link => {
            if (link.getAttribute("data-target") === viewName) {
                link.classList.add("active");
            } else {
                link.classList.remove("active");
            }
        });

        // Hide all views, display target
        document.querySelectorAll(".app-view").forEach(v => v.classList.remove("active"));
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add("active");
            this.currentView = viewName;
            window.scrollTo(0, 0);
            
            // Trigger panels loading on focus
            if (viewName === "dashboard") {
                this.loadClientBookings();
            }
            else if (viewName === "admin") {
                Admin.init();
            }
            else if (viewName === "services") {
                this.loadServicesList();
            }
            else if (viewName === "portfolio") {
                Portfolio.renderGalleryGrid();
            }
        }
    },

    /* --------------------------------------------------------------------------
       SETTINGS AND DATA SEEDS INTERACTION
       -------------------------------------------------------------------------- */
    async loadSettings() {
        try {
            this.settings = await API.get("/api/settings");
            if (this.settings && this.settings.booking_packages) {
                try {
                    if (typeof this.settings.booking_packages === "string") {
                        Booking.packages = JSON.parse(this.settings.booking_packages);
                    } else {
                        Booking.packages = this.settings.booking_packages;
                    }
                } catch(e) {
                    console.error("Failed to parse dynamic booking packages", e);
                }
            }
            this.applyGlobalSettings();
        } catch (error) {
            console.error("Failed to load settings from server:", error);
            this.settings = {};
            this.applyGlobalSettings();
        }
    },

    applyGlobalSettings() {
        if (!this.settings) this.settings = {};
        
        // Change footer and contact labels
        const address = this.settings.address || "Near TD COLLEGE SOUTH, beside CYBER CRIME THANA POLICE LINE, Wazidpur, Jaunpur, Uttar Pradesh 222001";
        const email = this.settings.contact_email || "admin@shivamstudio.com";
        const phone = this.settings.contact_phone || "7307245252";
        const studioName = this.settings.studio_name || "Shivam Studio and Photostate";
        const ownerName = this.settings.name || this.settings.owner_name || "Akhilesh Kumar Pal";

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        try {
            setVal("contact-lbl-owner", ownerName);
            setVal("contact-lbl-address", address);
            setVal("contact-lbl-phone", phone);
            setVal("contact-lbl-email", email);
            setVal("footer-lbl-address", address);
            setVal("footer-lbl-phone", phone);
            setVal("footer-lbl-email", email);
        } catch (e) {
            console.error("Failed to set contact labels", e);
        }
        
        try {
            // Update WhatsApp sticky button href link
            const whatsappBtn = document.getElementById("whatsapp-sticky-btn");
            const whatsappNum = this.settings.whatsapp || "917307245252";
            if (whatsappBtn) {
                whatsappBtn.href = `https://wa.me/${whatsappNum}?text=Hi%20${encodeURIComponent(studioName)},%20I%20would%20like%20to%20inquire%20about%20your%20photography%20and%20photostate%20services.`;
            }
        } catch (e) {
            console.error("Failed to set whatsapp button", e);
        }

        try {
            // Load dynamic marquee images
            const marqueeTrack = document.querySelector(".marquee-track-horizontal");
            if (marqueeTrack) {
                let imgs = [];
                try {
                    if (this.settings.hero_marquee_images) {
                        if (Array.isArray(this.settings.hero_marquee_images)) {
                            imgs = this.settings.hero_marquee_images;
                        } else {
                            imgs = JSON.parse(this.settings.hero_marquee_images);
                        }
                    }
                } catch(e) {
                    console.error("Failed to parse hero marquee images", e);
                }
                
                // Fallback default list if empty or invalid
                if (!imgs || !Array.isArray(imgs) || imgs.length === 0) {
                    imgs = [
                        "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1519225495810-7517c24a2ed7?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1507504038482-762143725f82?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
                        "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=600&q=80"
                    ];
                }
                
                // Build the horizontal marquee track containing original + duplicate lists
                const allImgs = [...imgs, ...imgs];
                marqueeTrack.innerHTML = allImgs.map((src, index) => 
                    `<img src="${src || 'https://placehold.co/200x280?text=No+Photo'}" alt="Wedding Photo ${index + 1}">`
                ).join("");
            }
        } catch (e) {
            console.error("Failed to load marquee images track", e);
        }

        try {
            // Load FAQs list into contact hours or home details
            const hoursList = document.getElementById("contact-hours-list");
            if (hoursList && this.settings.business_hours) {
                hoursList.innerHTML = Object.entries(this.settings.business_hours).map(([day, hrs]) => `
                    <li><span>${day}</span> <span>${hrs}</span></li>
                `).join("");
            }
        } catch (e) {
            console.error("Failed to set business hours", e);
        }
    },

    async loadOffersSlider() {
        const carousel = document.getElementById("offers-carousel-container");
        const section = document.getElementById("home-offers-section");
        if (!carousel) return;

        try {
            const offers = await API.get("/api/offers");
            const activeOffers = offers.filter(o => o.is_active === 1);

            if (activeOffers.length === 0) {
                section.style.display = "none";
                return;
            }

            section.style.display = "block";
            carousel.innerHTML = activeOffers.map(o => `
                <div class="offer-slide">
                    <span class="offer-badge">${o.discount_percent}% OFF</span>
                    <h3>${o.title}</h3>
                    <p>${o.description}</p>
                    <div class="coupon-box">
                        <span class="coupon-code">${o.code}</span>
                        <small class="text-muted">Expiry: ${o.expiry_date}</small>
                    </div>
                </div>
            `).join("");
        } catch (e) {
            console.error("Failed to load active promotions:", e);
        }
    },

    async loadTestimonials() {
        const container = document.getElementById("testimonials-container");
        if (!container) return;

        try {
            const list = await API.get("/api/testimonials");
            
            if (list.length === 0) {
                container.innerHTML = `<p class="paragraph text-center w-100">No client reviews logged yet.</p>`;
                return;
            }

            container.innerHTML = list.map(t => {
                let stars = "";
                for (let i = 1; i <= 5; i++) {
                    stars += i <= t.rating ? `<i class="fa-solid fa-star"></i>` : `<i class="fa-regular fa-star"></i>`;
                }
                return `
                    <div class="testimonial-card">
                        <div class="stars-rating">${stars}</div>
                        <p class="test-comment">"${t.comment}"</p>
                        <div class="test-client-profile">
                            <div class="client-avatar"><i class="fa-solid fa-user"></i></div>
                            <div class="client-info">
                                <h4>${t.client_name}</h4>
                                <p>Service: ${t.service}</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        } catch (error) {
            console.error("Failed to load testimonials:", error);
        }
    },

    // Render list of services
    loadServicesList() {
        const container = document.getElementById("services-list-container");
        if (!container) return;

        // Render card lists for all 13 services defined in booking.js package pricing dict
        const servicesNames = Object.keys(Booking.packages);
        
        // Map category thumbnails
        const images = {
            "Wedding Photography": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80",
            "Wedding Videography": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80",
            "Pre-Wedding Shoot": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
            "Maternity Shoot": "https://images.unsplash.com/photo-1551244072-5d12893278ab?auto=format&fit=crop&w=800&q=80",
            "Baby Shoot": "https://images.unsplash.com/photo-1519689680058-324335c77ebe?auto=format&fit=crop&w=800&q=80",
            "Birthday Events": "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=800&q=80",
            "Corporate Events": "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80",
            "Product Photography": "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=800&q=80",
            "Drone Shoots": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
            "Cinematic Video Production": "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80",
            "Video Editing & Mixing": "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80",
            "Album Designing": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80",
            "Live Streaming Services": "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80"
        };

        const descs = {
            "Wedding Photography": "Stunning visuals documenting your emotional ceremonies, candids, portraits, and traditional functions.",
            "Wedding Videography": "Cinematic visual trailers and feature-length documents capturing vows, rituals, and speeches.",
            "Pre-Wedding Shoot": "Bespoke narrative outdoor photography capturing the romance prior to your big event.",
            "Maternity Shoot": "Artistic visual session framing the magic and expectation of your pregnancy chapter.",
            "Baby Shoot": "Precious prop setups and family candids capturing the innocence of newborn infants.",
            "Birthday Events": "Visual documentations of child or adult birthdays, photo-booths, and celebratory snaps.",
            "Corporate Events": "High-fidelity coverage for annual meetings, corporate profiles, and promotional media.",
            "Product Photography": "Precision studio captures, Prop layouts, and advertising catalogs that boost sales.",
            "Drone Shoots": "Spectacular FAA-licensed high-altitude visual documentations for architecture, fields, and events.",
            "Cinematic Video Production": "Production of commercial clips, short films, advertisements, and music videos in ultra 4K/8K.",
            "Video Editing & Mixing": "High-end post-production color grading, audio synchronization, trimming, and effects.",
            "Album Designing": "Premium physical design mockups and leather-bound luxury photo catalogs.",
            "Live Streaming Services": "High-quality multi-camera cellular bonded broadcast streams on YouTube/Facebook."
        };

        container.innerHTML = servicesNames.map(s => {
            const pkgs = Booking.packages[s] || [];
            const startingPrice = pkgs.length > 0 ? pkgs[0].price : 0;
            
            return `
                <div class="service-item-card">
                    <div class="service-img-wrap">
                        <img src="${images[s]}" alt="${s}">
                        <div class="service-price-tag">Starts at ₹${startingPrice.toLocaleString()}</div>
                    </div>
                    <div class="service-body">
                        <h3>${s}</h3>
                        <p>${descs[s]}</p>
                        
                        <div class="package-tabs" id="pkg-tabs-${s.replace(/\s+/g, '')}">
                            ${pkgs.map((p, i) => `
                                <button class="pkg-tab ${i === 0 ? 'active' : ''}" onclick="app.toggleServiceTab(this, '${s}', ${i})">${p.name}</button>
                            `).join("")}
                        </div>
                        
                        <div class="pkg-desc-box" id="pkg-desc-${s.replace(/\s+/g, '')}">
                            <strong>₹${pkgs[0].price.toLocaleString()}</strong>
                            <ul style="margin-top:8px; list-style:none; display:flex; flex-direction:column; gap:4px;">
                                ${pkgs[0].features.map(f => `<li><i class="fa-solid fa-check text-gold"></i> ${f}</li>`).join("")}
                            </ul>
                        </div>
                        
                        <button class="btn btn-outline" style="margin-top:auto;" onclick="app.bookServiceDirect('${s}')">Book Service</button>
                    </div>
                </div>
            `;
        }).join("");
    },

    toggleServiceTab(btnElement, serviceName, pkgIdx) {
        const cardBody = btnElement.closest(".service-body");
        
        // Set active tab class
        cardBody.querySelectorAll(".pkg-tab").forEach(t => t.classList.remove("active"));
        btnElement.classList.add("active");

        const pkgs = Booking.packages[serviceName] || [];
        const selected = pkgs[pkgIdx];
        
        const descBox = cardBody.querySelector(".pkg-desc-box");
        descBox.innerHTML = `
            <strong>₹${selected.price.toLocaleString()}</strong>
            <ul style="margin-top:8px; list-style:none; display:flex; flex-direction:column; gap:4px;">
                ${selected.features.map(f => `<li><i class="fa-solid fa-check text-gold"></i> ${f}</li>`).join("")}
            </ul>
        `;
    },

    bookServiceDirect(serviceName) {
        this.navigateTo("booking");
        
        // Pre-select service in wizard
        const select = document.getElementById("booking-service");
        if (select) {
            select.value = serviceName;
            // Trigger change state update
            Booking.goToStep(1); // Go to step 1
        }
    },

    /* --------------------------------------------------------------------------
       AUTHENTICATION ACTIONS
       -------------------------------------------------------------------------- */
    async loadAuthSession() {
        const user = await API.checkAuth();
        if (user) {
            this.currentUser = user;
            this.updateAuthUI(true);
        } else {
            this.currentUser = null;
            this.updateAuthUI(false);
        }
    },

    updateAuthUI(isLoggedIn) {
        const portalText = document.getElementById("portal-btn-text");
        const dropdownName = document.getElementById("dropdown-user-name");
        const dropdownEmail = document.getElementById("dropdown-user-email");
        const adminLinks = document.querySelectorAll(".admin-only");

        if (isLoggedIn && this.currentUser) {
            portalText.textContent = this.currentUser.name.split(" ")[0];
            dropdownName.textContent = this.currentUser.name;
            dropdownEmail.textContent = this.currentUser.email;

            // Show admin links if user is administrator
            adminLinks.forEach(el => {
                el.style.display = this.currentUser.role === "admin" ? "block" : "none";
            });
        } else {
            portalText.textContent = "Client Portal";
            dropdownName.textContent = "Guest";
            dropdownEmail.textContent = "Sign in to book shoots";
            adminLinks.forEach(el => el.style.display = "none");
        }
    },

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const pass = document.getElementById("login-password").value;

        try {
            this.showLoader();
            const user = await API.login(email, pass);
            this.currentUser = user;
            this.updateAuthUI(true);
            this.closeModal("auth-modal");
            document.getElementById("auth-login-form").reset();
            this.showToast(`Welcome back, ${user.name}!`, "success");

            if (user.role === 'admin') {
                this.navigateTo("admin");
            } else {
                this.navigateTo("dashboard");
            }
        } catch (error) {
            this.showToast(error.message, "error");
        } finally {
            this.hideLoader();
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const name = document.getElementById("register-name").value;
        const email = document.getElementById("register-email").value;
        const phone = document.getElementById("register-phone").value;
        const pass = document.getElementById("register-password").value;

        try {
            this.showLoader();
            const user = await API.register(name, email, pass, phone);
            this.currentUser = user;
            this.updateAuthUI(true);
            this.closeModal("auth-modal");
            document.getElementById("auth-register-form").reset();
            this.showToast(`Account registered successfully. Welcome, ${user.name}!`, "success");
            this.navigateTo("dashboard");
        } catch (error) {
            this.showToast(error.message, "error");
        } finally {
            this.hideLoader();
        }
    },

    handleLogout() {
        API.logout();
        this.currentUser = null;
        this.updateAuthUI(false);
        this.navigateTo("home");
        this.showToast("Logged out successfully.", "success");
    },

    /* --------------------------------------------------------------------------
       ENQUIRIES SUBMISSION
       -------------------------------------------------------------------------- */
    async handleEnquirySubmit(e, formSource) {
        e.preventDefault();
        
        let client_name, client_email, client_phone, subject, message;

        if (formSource === "contact") {
            client_name = document.getElementById("contact-name").value;
            client_email = document.getElementById("contact-email").value;
            client_phone = document.getElementById("contact-phone").value;
            subject = document.getElementById("contact-subject").value;
            message = document.getElementById("contact-message").value;
        } else {
            client_name = document.getElementById("quote-name").value;
            client_email = document.getElementById("quote-email").value;
            client_phone = document.getElementById("quote-phone").value;
            subject = document.getElementById("quote-service").value + " - Custom Quote Request";
            message = document.getElementById("quote-details").value;
        }

        try {
            this.showLoader();
            await API.post("/api/enquiries", {
                client_name, client_email, client_phone, subject, message
            });

            this.showToast("Inquiry submitted successfully! We will email you shortly.", "success");
            
            if (formSource === "contact") {
                document.getElementById("contact-enquiry-form").reset();
            } else {
                document.getElementById("modal-quote-form").reset();
                this.closeModal("quote-modal");
            }
        } catch (error) {
            this.showToast(error.message, "error");
        } finally {
            this.hideLoader();
        }
    },

    /* --------------------------------------------------------------------------
       CLIENT DASHBOARD LOADERS
       -------------------------------------------------------------------------- */
    async loadClientBookings() {
        const container = document.getElementById("dash-bookings-list-container");
        if (!container) return;

        // Load profile values inside form inputs
        document.getElementById("dash-input-name").value = this.currentUser.name;
        document.getElementById("dash-input-phone").value = this.currentUser.phone || "";
        document.getElementById("dash-input-email").value = this.currentUser.email;
        
        document.getElementById("dash-profile-name").textContent = this.currentUser.name;
        document.getElementById("dash-profile-email").textContent = this.currentUser.email;

        try {
            const list = await API.get("/api/bookings");
            
            if (list.length === 0) {
                container.innerHTML = `
                    <div class="card text-center">
                        <p class="paragraph">You have no booking requests registered. Start your session booking today!</p>
                        <button class="btn btn-primary mt-2" onclick="app.navigateTo('booking')">Book a Shoot Session</button>
                    </div>
                `;
                return;
            }

            container.innerHTML = list.map(b => {
                let badgeClass = "badge-pending";
                if (b.status === "confirmed") badgeClass = "badge-gold";
                else if (b.status === "completed") badgeClass = "badge-success";
                else if (b.status === "cancelled") badgeClass = "badge-danger";

                return `
                    <div class="card mb-3 border-gold-soft">
                        <div class="flex-row-between">
                            <div>
                                <span class="badge ${badgeClass}">${b.status.toUpperCase()}</span>
                                <h3 class="mt-2" style="font-size:18px;">${b.service_name}</h3>
                                <p style="font-size:13px; color:var(--text-muted);">Event date: <strong>${b.event_date}</strong> at <strong>${b.event_time}</strong> | Package: ${b.package_name}</p>
                                <p style="font-size:11px; color:var(--text-muted);">Tracking ID: ${b.id}</p>
                            </div>
                            <div class="text-right">
                                <span class="bold text-gold" style="font-size: 20px;">₹${b.price.toLocaleString()}</span><br>
                                <button class="btn btn-outline-sm mt-2" onclick="app.generateReceiptDownload('${b.id}')"><i class="fa-solid fa-file-pdf"></i> Receipt</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        } catch (error) {
            container.innerHTML = `<p class="text-danger text-center">Failed to load booking history.</p>`;
        }
    },

    async handleSaveProfileChanges(e) {
        e.preventDefault();
        const name = document.getElementById("dash-input-name").value;
        const phone = document.getElementById("dash-input-phone").value;

        try {
            this.showLoader();
            await API.post("/api/settings", { name, phone }); // Reuse setting API for profile save
            // Update auth state details
            this.currentUser.name = name;
            this.currentUser.phone = phone;
            this.updateAuthUI(true);
            this.loadClientBookings();
            this.showToast("Profile details updated successfully!", "success");
        } catch (error) {
            this.showToast(error.message, "error");
        } finally {
            this.hideLoader();
        }
    },

    // Simulates generating PDF receipts by compiling CSV text format directly into downloads
    async generateReceiptDownload(id) {
        try {
            app.showLoader();
            // Look up booking details
            const list = await API.get("/api/bookings");
            const b = list.find(item => item.id === id);
            
            if (!b) {
                this.showToast("Record not found.", "error");
                return;
            }

            const invoiceContent = `
========================================
      SHIVAM STUDIO AND PHOTOSTATE
     Timeless Stories, Cinematic Art
========================================
Receipt Date: ${new Date().toLocaleDateString()}
Invoice ID: INV-${b.id.substring(0,8).toUpperCase()}
Booking ID: ${b.id}
Client: ${b.client_name}
Email: ${b.client_email}
Phone: ${b.client_phone}

----------------------------------------
Item Description:
${b.service_name} (${b.package_name} Package)
Event Date: ${b.event_date} at ${b.event_time}
Special Instructions: ${b.special_requirements || "None"}
Status: ${b.status.toUpperCase()}
----------------------------------------

TOTAL AMOUNT CHARGED: INR ${b.price.toLocaleString()}

Thank you for choosing Shivam Studio and Photostate!
Owner: Akhilesh Kumar Pal | Phone: 7307245252
Address: Near TD COLLEGE SOUTH, beside CYBER CRIME THANA POLICE LINE, Jaunpur
========================================
            `;

            const blob = new Blob([invoiceContent], { type: "text/plain;charset=utf-8" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `ShivamStudio_Receipt_${b.id.substring(0,8)}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showToast("Receipt downloaded successfully!", "success");
        } catch (error) {
            this.showToast("Failed to generate receipt invoice.", "error");
        } finally {
            app.hideLoader();
        }
    },

    /* --------------------------------------------------------------------------
       MODALS UTILS
       -------------------------------------------------------------------------- */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add("active");
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove("active");
    },

    /* --------------------------------------------------------------------------
       THEME CONTROLS & STICKY
       -------------------------------------------------------------------------- */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("bhumi_theme", newTheme);
        this.updateThemeIcon(newTheme);
        this.showToast(`Switched to ${newTheme} theme.`, "success");
    },

    updateThemeIcon(theme) {
        const icon = document.querySelector("#theme-toggle-btn i");
        if (!icon) return;
        if (theme === "light") {
            icon.className = "fa-solid fa-sun";
        } else {
            icon.className = "fa-solid fa-moon";
        }
    },

    /* --------------------------------------------------------------------------
       LOADERS AND TOASTS
       -------------------------------------------------------------------------- */
    showLoader() {
        // Create full page loader overlay dynamically
        let loader = document.getElementById("app-loader-spinner");
        if (!loader) {
            loader = document.createElement("div");
            loader.id = "app-loader-spinner";
            loader.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(12,12,14,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 9999; backdrop-filter: blur(4px);
            `;
            loader.innerHTML = `
                <div style="border: 4px solid var(--border-color); border-top: 4px solid var(--gold);
                border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
                <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            `;
            document.body.appendChild(loader);
        }
        loader.style.display = "flex";
    },

    hideLoader() {
        const loader = document.getElementById("app-loader-spinner");
        if (loader) loader.style.display = "none";
    },

    showToast(message, type = "success") {
        const wrapper = document.getElementById("toast-wrapper");
        if (!wrapper) return;

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        
        const icon = type === "success" 
            ? `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i>` 
            : `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i>`;

        toast.innerHTML = `${icon} <span>${message}</span>`;
        wrapper.appendChild(toast);

        // Slide out after 3.5s
        setTimeout(() => {
            toast.classList.add("fade-out");
            setTimeout(() => {
                if (toast.parentNode === wrapper) {
                    wrapper.removeChild(toast);
                }
            }, 300);
        }, 3500);
    }
};

// Initialize app when DOM content loaded
document.addEventListener("DOMContentLoaded", () => app.init());
