/**
 * Microsoft 365 / Azure AD app config for MSAL.
 *
 * Setup:
 * 1. Azure Portal → App registrations → New registration
 * 2. Name: e.g. "School SNS Kobe"
 * 3. Supported account types: Accounts in this organizational directory only
 * 4. Redirect URI: Single-page application → http://localhost:3000/ (or your URL)
 * 5. Copy Application (client) ID → clientId below
 * 6. Directory (tenant) ID → use in authority if you want tenant-specific
 *
 * Run with: npx serve .  (Microsoft login requires http/https, not file://)
 */
window.MSAL_CONFIG = {
  clientId: "bbc844ef-e3c3-4a76-8067-b3f0a9753017",
  authority: "https://login.microsoftonline.com/common",
  redirectUri: (typeof location !== "undefined" && (location.protocol === "http:" || location.protocol === "https:"))
    ? (location.origin + "/")
    : "http://localhost:3000/",
  scopes: ["User.Read", "openid", "profile"]
};
