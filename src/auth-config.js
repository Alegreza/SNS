/**
 * Auth config: Google Client ID, admin email for manual verification.
 *
 * HOW TO ENABLE GOOGLE SIGN-IN:
 * 1. Go to https://console.cloud.google.com/ → APIs & Services → Credentials
 * 2. Create an OAuth 2.0 Client ID (Web application type)
 * 3. Add Authorised JavaScript origins: http://localhost:3000 (dev) and your Render URL (prod)
 * 4. Add Authorised redirect URIs: same origins + "/"
 * 5. Copy the Client ID (format: xxxxxxxx.apps.googleusercontent.com)
 * 6. Paste it below AND set GOOGLE_CLIENT_ID= in your server .env file (must match)
 */
window.AUTH_CONFIG = {
  adminEmail: "mkim28@cranbrook.edu",
  googleClientId: "" // ← Paste your Google OAuth Client ID here (step 5 above)
};
