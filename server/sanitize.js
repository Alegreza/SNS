const DOMPurify = require("isomorphic-dompurify");

// This app only ever renders post/comment content as plain text (no rich text
// or markdown support), so the correct policy is to strip all markup rather
// than allow a safe subset — anything surviving here would just show up as
// literal tag text to the user anyway.
function sanitizeText(value) {
  return DOMPurify.sanitize(String(value == null ? "" : value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

module.exports = { sanitizeText };
