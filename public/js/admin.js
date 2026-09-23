/* ==========================================================================
   BHUMI STUDIO - ADMIN PANEL CONTROLLER & DATA VISUALIZATION
   ========================================================================== */

const Admin = {
    analytics: null,
    bookings: [],
    enquiries: [],
    isInitialized: false,

    async init() {
        if (!this.isInitialized) {
            this.bindEvents();
            this.isInitialized = true;
        }
        await this.loadAllAdminData();
    },

    async loadAllAdminData() {
        if (!app.currentUser || app.currentUser.role !== 'admin') return;
        
        try {
            app.showLoader();
            await Promise.all([
                this.loadAnalytics(),
                this.loadBookings(),
                this.loadEnquiries(),
                this.loadOffers()
            ]);
            await this.loadSettingsFormValues(app.settings);
            this.loadMarqueePhotosFormValues(app.settings);
            this.initPackagesEditor();
        } catch (error) {
            console.error("Failed to load admin panels data:", error);
            app.showToast("Failed to compile administrator panel data.", "error");
        } finally {
            app.hideLoader();
        }
    },

    bindEvents() {
        // Tab switching in admin panel
        document.querySelectorAll(".admin-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.getAttribute("data-tab");
                
                document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".admin-tab-panel").forEach(p => p.classList.remove("active"));
                
                btn.classList.add("active");
                document.getElementById(targetTab).classList.add("active");
            });
        });

        // Search Filters
        const bookingSearch = document.getElementById("admin-booking-search");
        if (bookingSearch) {
            bookingSearch.addEventListener("input", (e) => this.filterBookingsTable(e.target.value));
        }

        // CSV Exporters
        const btnExpBook = document.getElementById("btn-export-bookings");
        if (btnExpBook) btnExpBook.addEventListener("click", () => this.exportBookingsCSV());

        const btnExpEnq = document.getElementById("btn-export-enquiries");
        if (btnExpEnq) btnExpEnq.addEventListener("click", () => this.exportEnquiriesCSV());

        // Portfolio Add Source toggler
        const sourceSelect = document.getElementById("port-input-source");
        if (sourceSelect) {
            sourceSelect.addEventListener("change", (e) => {
                const isUrl = e.target.value === "url";
                document.getElementById("port-source-url-group").classList.toggle("hidden", !isUrl);
                document.getElementById("port-source-file-group").classList.toggle("hidden", isUrl);
            });
        }

        // Portfolio upload submit listener
        const portfolioForm = document.getElementById("admin-portfolio-form");
        if (portfolioForm) {
            portfolioForm.addEventListener("submit", (e) => this.handlePortfolioUpload(e));
        }

        // Offers submit listener
        const offersForm = document.getElementById("admin-offers-form");
        if (offersForm) {
            offersForm.addEventListener("submit", (e) => this.handleSaveOffer(e));
        }
        
        const cancelEditOfferBtn = document.getElementById("btn-cancel-edit-offer");
        if (cancelEditOfferBtn) {
            cancelEditOfferBtn.addEventListener("click", () => this.resetOfferForm());
        }

        // Settings save form listener
        const settingsForm = document.getElementById("admin-settings-form");
        if (settingsForm) {
            settingsForm.addEventListener("submit", (e) => this.handleSaveSettings(e));
        }

        // Marquee photos save button listener
        const saveMarqueeBtn = document.getElementById("btn-save-marquee-photos");
        if (saveMarqueeBtn) {
            saveMarqueeBtn.addEventListener("click", () => this.handleSaveMarqueePhotos());
        }

        // Packages category selector change listener
        const serviceSelect = document.getElementById("pkg-edit-service-select");
        if (serviceSelect) {
            serviceSelect.addEventListener("change", (e) => this.renderPackagesEditorForm(e.target.value));
        }

        // Save packages button listener
        const savePackagesBtn = document.getElementById("btn-save-packages");
        if (savePackagesBtn) {
            savePackagesBtn.addEventListener("click", () => this.handleSavePackages());
        }
    },

    /* --------------------------------------------------------------------------
       ANALYTICS & SVG CHARTS
       -------------------------------------------------------------------------- */
    async loadAnalytics() {
        this.analytics = await API.get("/api/analytics");
        
        // Populate stats cards
        document.getElementById("stat-total-bookings").textContent = this.analytics.totals.bookings;
        document.getElementById("stat-total-revenue").textContent = `₹${this.analytics.totals.revenue.toLocaleString()}`;
        document.getElementById("stat-total-enquiries").textContent = this.analytics.totals.enquiries;

        this.renderRevenueTrendChart();
        this.renderPopularityChart();
    },

    // Render pure SVG Monthly Line Chart
    renderRevenueTrendChart() {
        const wrapper = document.getElementById("revenue-chart-wrapper");
        if (!wrapper) return;

        const data = this.analytics.monthly_trends || [];
        if (data.length === 0) {
            wrapper.innerHTML = `<p class="paragraph">Not enough data to map trends.</p>`;
            return;
        }

        const width = 450;
        const height = 200;
        const padding = 30;
        
        // Find min/max values
        const maxRev = Math.max(...data.map(d => d.revenue || 0), 100000);
        
        // Generate SVG Points
        const points = data.map((d, index) => {
            const x = padding + (index * (width - 2 * padding) / (data.length - 1 || 1));
            const y = height - padding - ((d.revenue || 0) * (height - 2 * padding) / maxRev);
            return { x, y, val: d.revenue, lbl: d.month };
        });

        const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ");
        const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

        let gridLines = "";
        // Draw horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding + (i * (height - 2 * padding) / 4);
            const val = maxRev - (i * maxRev / 4);
            gridLines += `
                <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="var(--border-color)" stroke-width="1" />
                <text x="${padding - 5}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">₹${Math.round(val/1000)}k</text>
            `;
        }

        // Draw points and labels
        const dots = points.map(p => `
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--gold)" />
            <text x="${p.x}" y="${height - 8}" fill="var(--text-muted)" font-size="9" text-anchor="middle">${p.lbl.split("-")[1]}/${p.lbl.split("-")[0].substring(2)}</text>
        `).join("");

        wrapper.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%">
                ${gridLines}
                <path d="${areaPath}" fill="rgba(212,175,55,0.06)" />
                <path d="${linePath}" fill="none" stroke="var(--gold)" stroke-width="2" />
                ${dots}
            </svg>
        `;
    },

    // Render pure SVG Popularity Bar/Pie Chart
    renderPopularityChart() {
        const wrapper = document.getElementById("popularity-chart-wrapper");
        if (!wrapper) return;

        const data = this.analytics.popular_services || [];
        if (data.length === 0) {
            wrapper.innerHTML = `<p class="paragraph">No booking categories logged yet.</p>`;
            return;
        }

        // For simplicity and high polish, render as responsive visual list of bars
        const maxCount = Math.max(...data.map(d => d.count), 1);
        
        wrapper.innerHTML = `
            <div class="w-100" style="padding: 10px 0; display:flex; flex-direction:column; gap: 14px;">
                ${data.slice(0, 4).map(d => {
                    const percent = Math.round((d.count / maxCount) * 100);
                    return `
                        <div>
                            <div class="flex-row-between" style="font-size: 11px; margin-bottom: 4px;">
                                <span class="bold">${d.service_name}</span>
                                <span class="text-gold">${d.count} booked (₹${(d.revenue || 0).toLocaleString()})</span>
                            </div>
                            <div style="background-color: var(--border-color); height: 8px; border-radius: 4px; overflow:hidden;">
                                <div style="background-color: var(--gold); width: ${percent}%; height: 100%; border-radius: 4px; box-shadow: 0 0 8px var(--gold-glow)"></div>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    },

    /* --------------------------------------------------------------------------
       MANAGE BOOKINGS PANEL
       -------------------------------------------------------------------------- */
    async loadBookings() {
        this.bookings = await API.get("/api/bookings");
        this.renderBookingsTable(this.bookings);
    },

    renderBookingsTable(items) {
        const tbody = document.querySelector("#admin-bookings-table tbody");
        if (!tbody) return;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center paragraph">No bookings found in database.</td></tr>`;
            return;
        }

        tbody.innerHTML = items.map(b => {
            let badgeClass = "badge-pending";
            if (b.status === "confirmed") badgeClass = "badge-gold";
            else if (b.status === "completed") badgeClass = "badge-success";
            else if (b.status === "cancelled") badgeClass = "badge-danger";

            const refLink = b.reference_image 
                ? `<a href="${b.reference_image}" target="_blank" class="text-gold bold"><i class="fa-solid fa-image"></i> View Concept</a>` 
                : '<span class="text-muted">None</span>';

            return `
                <tr>
                    <td>
                        <span class="bold">${b.id.substring(0, 8)}</span><br>
                        <small class="text-muted">${b.event_date} at ${b.event_time}</small>
                    </td>
                    <td>
                        <strong>${b.client_name}</strong><br>
                        <small>${b.client_phone} | ${b.client_email}</small>
                    </td>
                    <td>
                        <strong>${b.service_name}</strong><br>
                        <small>Package: ${b.package_name}</small><br>
                        ${refLink}
                    </td>
                    <td class="bold text-gold">₹${b.price.toLocaleString()}</td>
                    <td>
                        <span class="badge ${badgeClass}">${b.status.toUpperCase()}</span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <select class="form-control-sm" onchange="Admin.updateBookingStatus('${b.id}', this.value)">
                                <option value="pending" ${b.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confirm</option>
                                <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Complete</option>
                                <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Cancel</option>
                            </select>
                            <button class="btn btn-outline-sm text-danger" title="Delete Booking" onclick="Admin.deleteBooking('${b.id}')" style="padding: 6px 10px; border-radius: 6px;">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    },

    async deleteBooking(id) {
        if (!confirm("Are you sure you want to delete this booking record? This action is irreversible.")) return;

        try {
            app.showLoader();
            await API.delete(`/api/bookings/${id}`);
            app.showToast("Booking deleted successfully!", "success");
            await this.loadAllAdminData();
        } catch (error) {
            console.error("Failed to delete booking:", error);
            app.showToast(error.message, "error");
        } finally {
            app.hideLoader();
        }
    },

    async updateBookingStatus(id, newStatus) {
        try {
            app.showLoader();
            await API.put(`/api/bookings/${id}`, { status: newStatus });
            app.showToast("Booking status updated successfully!", "success");
            await this.loadAllAdminData();
        } catch (error) {
            app.showToast(error.message, "error");
        } finally {
            app.hideLoader();
        }
    },

    filterBookingsTable(query) {
        if (!query) {
            this.renderBookingsTable(this.bookings);
            return;
        }
        const q = query.toLowerCase();
        const filtered = this.bookings.filter(b => 
            b.client_name.toLowerCase().includes(q) || 
            b.service_name.toLowerCase().includes(q) || 
            b.id.toLowerCase().includes(q) ||
            b.client_email.toLowerCase().includes(q)
        );
        this.renderBookingsTable(filtered);
    },

    // CSV file exports
    exportBookingsCSV() {
        if (this.bookings.length === 0) return;
        
        const headers = ["Booking ID", "Date", "Time", "Customer Name", "Customer Email", "Customer Phone", "Service Booked", "Package Selected", "Price Charged", "Status"];
        const rows = this.bookings.map(b => [
            b.id, b.event_date, b.event_time, b.client_name, b.client_email, b.client_phone, b.service_name, b.package_name, b.price, b.status
        ]);

        this.triggerCSVDownload("ShivamStudio_Bookings.csv", headers, rows);
    },

    /* --------------------------------------------------------------------------
       MANAGE ENQUIRIES PANEL
       -------------------------------------------------------------------------- */
    async loadEnquiries() {
        this.enquiries = await API.get("/api/enquiries");
        this.renderEnquiriesTable();
    },

    renderEnquiriesTable() {
        const tbody = document.querySelector("#admin-enquiries-table tbody");
        if (!tbody) return;

        if (this.enquiries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center paragraph">No messages in inbox.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.enquiries.map(e => {
            let badgeClass = "badge-pending";
            if (e.status === "responding") badgeClass = "badge-gold";
            else if (e.status === "resolved") badgeClass = "badge-success";

            const notesText = e.notes ? e.notes : "";

            return `
                <tr>
                    <td><small>${e.created_at}</small></td>
                    <td>
                        <strong>${e.client_name}</strong><br>
                        <small>${e.client_phone} | ${e.client_email}</small>
                    </td>
                    <td>
                        <strong>${e.subject}</strong><br>
                        <p style="font-size:12px; margin-top:4px; max-width:320px; white-space:pre-wrap;">${e.message}</p>
                    </td>
                    <td>
                        <span class="badge ${badgeClass}">${e.status.toUpperCase()}</span>
                    </td>
                    <td>
                        <textarea class="form-control-sm" rows="2" style="width:100%; min-width:180px; font-size:11px;" placeholder="Add private admin action notes..." id="notes-${e.id}" onblur="Admin.saveEnquiryNotes('${e.id}')">${notesText}</textarea>
                    </td>
                    <td>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <select class="form-control-sm" onchange="Admin.updateEnquiryStatus('${e.id}', this.value)">
                                <option value="unread" ${e.status === 'unread' ? 'selected' : ''}>Unread</option>
                                <option value="responding" ${e.status === 'responding' ? 'selected' : ''}>Responding</option>
                                <option value="resolved" ${e.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                            </select>
                            <button class="btn btn-outline-sm text-danger" title="Delete Enquiry" onclick="Admin.deleteEnquiry('${e.id}')" style="padding: 6px 10px; border-radius: 6px;">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    },

    async deleteEnquiry(id) {
        if (!confirm("Are you sure you want to delete this enquiry message? This action is irreversible.")) return;

        try {
            app.showLoader();
            await API.delete(`/api/enquiries/${id}`);
            app.showToast("Enquiry message deleted successfully!", "success");
            await this.loadAllAdminData();
        } catch (error) {
            console.error("Failed to delete enquiry:", error);
            app.showToast(error.message, "error");
        } finally {
            app.hideLoader();
        }
    },

    async updateEnquiryStatus(id, newStatus) {
        try {
            await API.put(`/api/enquiries/${id}`, { status: newStatus });
            app.showToast("Enquiry status updated.", "success");
            await this.loadEnquiries();
        } catch (error) {
            app.showToast(error.message, "error");
        }
    },

    async saveEnquiryNotes(id) {
        const textVal = document.getElementById(`notes-${id}`).value;
        try {
            await API.put(`/api/enquiries/${id}`, { notes: textVal });
            app.showToast("Admin action notes saved.", "success");
        } catch (error) {
            app.showToast(error.message, "error");
        }
    },

    exportEnquiriesCSV() {
        if (this.enquiries.length === 0) return;
        
        const headers = ["Submit Date", "Customer Name", "Customer Email", "Customer Phone", "Subject", "Message Message", "Status", "Notes Log"];
        const rows = this.enquiries.map(e => [
            e.created_at, e.client_name, e.client_email, e.client_phone, e.subject, e.message, e.status, e.notes || ""
        ]);

        this.triggerCSVDownload("ShivamStudio_Enquiries.csv", headers, rows);
    },

    /* --------------------------------------------------------------------------
       PORTFOLIO MANAGEMENT & MEDIA PROCESS
       -------------------------------------------------------------------------- */
    async handlePortfolioUpload(e) {
        e.preventDefault();
        
        const title = document.getElementById("port-input-title").value;
        const category = document.getElementById("port-input-category").value;
        const media_type = document.getElementById("port-input-type").value;
        const sourceOption = document.getElementById("port-input-source").value;
        const is_featured = document.getElementById("port-input-featured").checked ? 1 : 0;
        const thumbnail = document.getElementById("port-input-thumb").value;

        let url = "";

        try {
            app.showLoader();
            
            if (sourceOption === "url") {
                url = document.getElementById("port-input-url").value;
                if (!url) {
                    app.showToast("Please enter an image or video URL.", "error");
                    return;
                }
            } else {
                const fileInput = document.getElementById("port-input-file");
                const file = fileInput.files[0];
                if (!file) {
                    app.showToast("Please choose a file to upload.", "error");
                    return;
                }
                
                url = await API.uploadFile(file);
            }

            await API.post("/api/portfolio", {
                title, category, media_type, url, thumbnail, is_featured
            });

            app.showToast("Visual uploaded successfully to gallery!", "success");
            document.getElementById("admin-portfolio-form").reset();
            document.getElementById("port-source-url-group").classList.remove("hidden");
            document.getElementById("port-source-file-group").classList.add("hidden");
            
            await Portfolio.loadGallery(); // Refresh active lists
        } catch (error) {
            app.showToast(error.message, "error");
        } finally {
            app.hideLoader();
        }
    },

    /* --------------------------------------------------------------------------
       OFFERS & PROMOTIONS PANEL
       -------------------------------------------------------------------------- */
    async loadOffers() {
        const offersList = await API.get("/api/offers");
        this.renderAdminOffersList(offersList);
    },

    renderAdminOffersList(offers) {
        const container = document.getElementById("admin-offers-list-container");
        if (!container) return;

        if (offers.length === 0) {
            container.innerHTML = `<p class="paragraph text-center">No coupons configured.</p>`;
            return;
        }

        container.innerHTML = offers.map(o => `
            <div class="admin-offer-item mb-2">
                <span class="offer-badge" style="top:12px; right:12px;">${o.discount_percent}% OFF</span>
                <h5 class="bold">${o.title}</h5>
                <p style="font-size:12px;" class="text-muted">${o.description}</p>
                <p style="font-size:12px; margin-top:8px;">
                    Coupon: <strong class="text-gold font-monospace">${o.code}</strong> | Status: ${o.is_active === 1 ? '<span class="text-gold bold">Active</span>' : '<span class="text-danger">Disabled</span>'}
                </p>
                <p style="font-size:10px; color:var(--text-muted);">Validity: ${o.start_date} to ${o.expiry_date}</p>
                <div class="mt-2" style="display:flex; gap:8px;">
                    <button class="btn btn-outline-sm" onclick="Admin.editOffer('${o.id}')"><i class="fa-solid fa-pencil"></i> Edit</button>
                    <button class="btn btn-outline-sm text-danger" onclick="Admin.deleteOffer('${o.id}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
                </div>
            </div>
        `).join("");
    },

    async handleSaveOffer(e) {
        e.preventDefault();
        
        const offerId = document.getElementById("offer-input-id").value;
        const title = document.getElementById("offer-input-title").value;
        const description = document.getElementById("offer-input-desc").value;
        const code = document.getElementById("offer-input-code").value.trim().toUpperCase();
        const discount_percent = document.getElementById("offer-input-discount").value;
        const start_date = document.getElementById("offer-input-start").value;
        const expiry_date = document.getElementById("offer-input-expiry").value;
        const is_active = document.getElementById("offer-input-active").checked ? 1 : 0;

        const payload = { title, description, code, discount_percent, start_date, expiry_date, is_active };

        try {
            app.showLoader();
            if (offerId) {
                // Update
                await API.put(`/api/offers/${offerId}`, payload);
                app.showToast("Coupon updated successfully!", "success");
            } else {
                // Create
                await API.post("/api/offers", payload);
                app.showToast("New discount coupon created!", "success");
            }
            this.resetOfferForm();
            await this.loadOffers();
            await app.loadOffersSlider(); // Update home slideshow
        } catch (error) {
            app.showToast(error.message, "error");
        } finally {
            app.hideLoader();
        }
    },

    async editOffer(id) {
        try {
            app.showLoader();
            const offers = await API.get("/api/offers");
            const offer = offers.find(o => o.id === id);
            
            if (offer) {
                document.getElementById("offer-input-id").value = offer.id;
                document.getElementById("offer-input-title").value = offer.title;
                document.getElementById("offer-input-desc").value = offer.description;
                document.getElementById("offer-input-code").value = offer.code;
                document.getElementById("offer-input-discount").value = offer.discount_percent;
                document.getElementById("offer-input-start").value = offer.start_date;
                document.getElementById("offer-input-expiry").value = offer.expiry_date;
                document.getElementById("offer-input-active").checked = offer.is_active === 1;

                document.getElementById("btn-save-offer").textContent = "Update Offer";
                document.getElementById("btn-cancel-edit-offer").classList.remove("hidden");
            }
        } catch (error) {
            app.showToast(error.message, "error");
        } finally {
            app.hideLoader();
        }
    },

    resetOfferForm() {
        document.getElementById("admin-offers-form").reset();
        document.getElementById("offer-input-id").value = "";
        document.getElementById("btn-save-offer").textContent = "Create Offer";
        document.getElementById("btn-cancel-edit-offer").classList.add("hidden");
    },

    async deleteOffer(id) {
        if (!confirm("Delete this promotional offer?")) return;
        try {
            app.showLoader();
            await API.delete(`/api/offers/${id}`);
            app.showToast("Offer removed.", "success");
            await this.loadOffers();
            await app.loadOffersSlider();
        } catch (error) {
            app.showToast(error.message, "error");
        } finally {
            app.hideLoader();
        }
    },

    /* --------------------------------------------------------------------------
       SETTINGS AND CONFIG
       -------------------------------------------------------------------------- */
    async loadSettingsFormValues(settings) {
        const studioName = document.getElementById("settings-studio-name");
        if (!studioName) return;

        const s = settings || {};
        studioName.value = s.studio_name || "";
        document.getElementById("settings-contact-email").value = s.contact_email || "";
        document.getElementById("settings-contact-phone").value = s.contact_phone || "";
        document.getElementById("settings-whatsapp").value = s.whatsapp || "";
        document.getElementById("settings-address").value = s.address || "";
    },

    async handleSaveSettings(e) {
        e.preventDefault();
        
        const payload = {
            studio_name: document.getElementById("settings-studio-name").value,
            contact_email: document.getElementById("settings-contact-email").value,
            contact_phone: document.getElementById("settings-contact-phone").value,
            whatsapp: document.getElementById("settings-whatsapp").value,
            address: document.getElementById("settings-address").value
        };

        try {
            app.showLoader();
            await API.post("/api/settings", payload);
            app.showToast("Site configuration saved successfully!", "success");
            await app.loadSettings(); // Reload global settings
        } catch (error) {
            app.showToast(error.message, "error");
        } finally {
            app.hideLoader();
        }
    },

    loadMarqueePhotosFormValues(settings) {
        const marqueeListContainer = document.getElementById("marquee-photos-list");
        if (!marqueeListContainer) return;

        const s = settings || {};
        let imgs = [];
        try {
            if (s.hero_marquee_images) {
                if (Array.isArray(s.hero_marquee_images)) {
                    imgs = s.hero_marquee_images;
                } else {
                    imgs = JSON.parse(s.hero_marquee_images);
                }
            }
        } catch(e) {
            console.error("Failed to parse marquee images", e);
        }

        // Fallback default list if empty
        if (!imgs || imgs.length === 0) {
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

        while (imgs.length < 12) {
            imgs.push("");
        }

        marqueeListContainer.innerHTML = imgs.map((src, index) => `
            <div class="marquee-photo-item" data-index="${index}">
                <label>Photo ${index + 1}</label>
                <img class="marquee-photo-preview" src="${src || 'https://placehold.co/200x280?text=No+Photo'}" alt="Preview" id="marquee-preview-${index}">
                <div class="form-group mb-2">
                    <input type="text" class="form-control marquee-url-input" id="marquee-url-${index}" placeholder="Paste URL or Drive link" value="${src || ''}">
                </div>
                <div class="form-group mb-0">
                    <label class="btn btn-outline btn-sm w-100 text-center cursor-pointer mb-0">
                        Upload Local File
                        <input type="file" class="hidden marquee-file-input" data-index="${index}" accept="image/*">
                    </label>
                </div>
            </div>
        `).join("");

        // Bind text input change events to update previews immediately
        for (let i = 0; i < 12; i++) {
            const urlInput = document.getElementById(`marquee-url-${i}`);
            const previewImg = document.getElementById(`marquee-preview-${i}`);
            if (urlInput && previewImg) {
                urlInput.addEventListener("input", (e) => {
                    previewImg.src = e.target.value || 'https://placehold.co/200x280?text=No+Photo';
                });
            }
        }

        // Bind file change events
        const fileInputs = marqueeListContainer.querySelectorAll(".marquee-file-input");
        fileInputs.forEach(input => {
            input.addEventListener("change", (e) => this.handleMarqueeFileUpload(e));
        });
    },

    async handleMarqueeFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const index = e.target.getAttribute("data-index");
        const reader = new FileReader();

        reader.onload = async () => {
            try {
                app.showLoader();
                const response = await API.post("/api/upload", {
                    filename: file.name,
                    content: reader.result
                });
                
                const urlInput = document.getElementById(`marquee-url-${index}`);
                const previewImg = document.getElementById(`marquee-preview-${index}`);
                if (urlInput && previewImg) {
                    urlInput.value = response.url;
                    previewImg.src = response.url;
                    app.showToast(`Photo ${parseInt(index) + 1} uploaded successfully!`, "success");
                }
            } catch (error) {
                app.showToast(`Upload failed: ${error.message}`, "error");
            } finally {
                app.hideLoader();
            }
        };

        reader.onerror = () => {
            app.showToast("Failed to read file", "error");
        };

        reader.readAsDataURL(file);
    },

    async handleSaveMarqueePhotos() {
        const urls = [];
        for (let i = 0; i < 12; i++) {
            const val = document.getElementById(`marquee-url-${i}`).value.trim();
            urls.push(val || "https://placehold.co/200x280?text=Empty+Photo");
        }

        const payload = {
            hero_marquee_images: urls
        };

        try {
            app.showLoader();
            await API.post("/api/settings", payload);
            app.showToast("Front page photos updated successfully!", "success");
            await app.loadSettings(); // Reload global settings and update marquee UI
        } catch (error) {
            app.showToast(error.message, "error");
        } finally {
            app.hideLoader();
        }
    },

    /* --------------------------------------------------------------------------
       CSV UTILS EXPORT DOWNLOAD
       -------------------------------------------------------------------------- */
    triggerCSVDownload(filename, headers, rows) {
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Headers row
        csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
        
        // Data rows
        rows.forEach(r => {
            csvContent += r.map(cell => {
                const cellStr = cell !== null && cell !== undefined ? String(cell) : "";
                return `"${cellStr.replace(/"/g, '""')}"`;
            }).join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link); // Required for FF
        
        link.click();
        document.body.removeChild(link);
    },

    initPackagesEditor() {
        const serviceSelect = document.getElementById("pkg-edit-service-select");
        if (!serviceSelect) return;

        // Populate dropdown with all service categories from Booking.packages
        const categories = Object.keys(Booking.packages);
        serviceSelect.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join("");

        // Render initial category selection (first one)
        if (categories.length > 0) {
            this.renderPackagesEditorForm(categories[0]);
        }
    },

    renderPackagesEditorForm(category) {
        const container = document.getElementById("packages-editor-container");
        if (!container) return;

        const packagesList = Booking.packages[category] || [];
        
        container.innerHTML = packagesList.map((pkg, idx) => {
            const featuresText = pkg.features.join("\n");
            return `
                <div class="package-edit-card" style="background-color: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px;" data-index="${idx}">
                    <h3 style="color: var(--gold); font-size: 18px; margin-bottom: 16px;">${pkg.name} Package</h3>
                    
                    <div class="form-group mb-3">
                        <label style="display:block; margin-bottom:6px; font-weight:600; font-size:13px; color:var(--text-muted);">Price (₹)</label>
                        <input type="number" class="form-control pkg-edit-price" value="${pkg.price}" style="background-color: var(--bg-body); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; width: 100%;">
                    </div>
                    
                    <div class="form-group">
                        <label style="display:block; margin-bottom:6px; font-weight:600; font-size:13px; color:var(--text-muted);">Package Features (one feature per line)</label>
                        <textarea class="form-control pkg-edit-features" rows="5" style="background-color: var(--bg-body); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; width: 100%; font-family: inherit; font-size: 14px; line-height: 1.5; resize: vertical;" placeholder="Enter features (one per line)">${featuresText}</textarea>
                    </div>
                </div>
            `;
        }).join("");
    },

    async handleSavePackages() {
        const serviceSelect = document.getElementById("pkg-edit-service-select");
        if (!serviceSelect) return;

        const category = serviceSelect.value;
        const container = document.getElementById("packages-editor-container");
        if (!container) return;

        const packageCards = container.querySelectorAll(".package-edit-card");
        const updatedPackages = [];

        packageCards.forEach(card => {
            const idx = parseInt(card.getAttribute("data-index"));
            const priceInput = card.querySelector(".pkg-edit-price");
            const featuresTextarea = card.querySelector(".pkg-edit-features");

            const originalPkg = Booking.packages[category][idx];
            if (originalPkg) {
                const updatedPrice = parseFloat(priceInput.value) || 0;
                const updatedFeatures = featuresTextarea.value
                    .split("\n")
                    .map(f => f.trim())
                    .filter(f => f !== "");

                updatedPackages.push({
                    name: originalPkg.name,
                    price: updatedPrice,
                    features: updatedFeatures
                });
            }
        });

        // Update local object
        Booking.packages[category] = updatedPackages;

        try {
            app.showLoader();
            
            // Save the entire Booking.packages mapping dictionary to database settings!
            await API.post("/api/settings", {
                booking_packages: Booking.packages
            });

            // Reload local app settings cache
            if (!app.settings) app.settings = {};
            app.settings.booking_packages = Booking.packages;

            // Re-render user views dynamically!
            app.loadServicesList();

            app.showToast(`Packages for "${category}" updated successfully!`, "success");
        } catch (error) {
            console.error("Failed to save packages settings:", error);
            app.showToast("Failed to save packages settings.", "error");
        } finally {
            app.hideLoader();
        }
    }
};
