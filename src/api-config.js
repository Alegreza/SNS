/**
 * API base URL for frontend.
 * Use relative path when frontend is served by same server.
 */
window.API_BASE = typeof location !== "undefined" && (location.protocol === "http:" || location.protocol === "https:")
  ? ""
  : "http://localhost:3000";
