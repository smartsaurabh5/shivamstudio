/* ==========================================================================
   BHUMI STUDIO - REST API HANDLER & SESSION CLIENT
   ========================================================================== */

const API = {
    // API endpoint helper
    baseUrl: (typeof window !== "undefined" && window.API_BASE_URL) ? window.API_BASE_URL : "", // Configurable via window.API_BASE_URL for cross-domain deployment

    getToken() {
        return localStorage.getItem("bhumi_auth_token");
    },

    setToken(token) {
        localStorage.setItem("bhumi_auth_token", token);
    },

    clearToken() {
        localStorage.removeItem("bhumi_auth_token");
    },

    // HTTP Helper Methods
    async request(path, method = "GET", body = null) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            "Content-Type": "application/json"
        };
        
        const token = this.getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const config = {
            method,
            headers
        };

        if (body && (method === "POST" || method === "PUT")) {
            config.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || "An API communication error occurred.");
            }
            
            return data;
        } catch (error) {
            console.error(`API Error on ${method} ${path}:`, error);
            throw error;
        }
    },

    async get(path) {
        return this.request(path, "GET");
    },

    async post(path, body) {
        return this.request(path, "POST", body);
    },

    async put(path, body) {
        return this.request(path, "PUT", body);
    },

    async delete(path) {
        return this.request(path, "DELETE");
    },

    // Authentication Actions
    async login(email, password) {
        try {
            const res = await this.post("/api/auth/login", { email, password });
            if (res.token) {
                this.setToken(res.token);
                return res.user;
            }
            throw new Error("Invalid response format from authentication server.");
        } catch (error) {
            throw error;
        }
    },

    async register(name, email, password, phone = "") {
        try {
            const res = await this.post("/api/auth/register", { name, email, password, phone });
            if (res.token) {
                this.setToken(res.token);
                return res.user;
            }
            throw new Error("Invalid response format from registration server.");
        } catch (error) {
            throw error;
        }
    },

    logout() {
        this.clearToken();
    },

    async checkAuth() {
        const token = this.getToken();
        if (!token) return null;
        try {
            return await this.get("/api/auth/me");
        } catch (e) {
            this.clearToken();
            return null;
        }
    },

    // File Upload Handler (Base64 file converter)
    async uploadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const result = await this.post("/api/upload", {
                        filename: file.name,
                        content: reader.result // Send Base64 data url
                    });
                    resolve(result.url); // Return uploaded URL path e.g. "/uploads/..."
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
        });
    }
};
