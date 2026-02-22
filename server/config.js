/**
 * Server configuration.
 * Copy to .env or set env vars for production.
 */

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || "kobe-dev-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  microsoftClientId: process.env.MICROSOFT_CLIENT_ID || "",
  uploadDir: process.env.UPLOAD_DIR || "./data/uploads",
  adminEmail: process.env.ADMIN_EMAIL || "mkim28@cranbrook.edu"
};
