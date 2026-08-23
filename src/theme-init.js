/**
 * Applies a stored dark/light theme override before first paint, to avoid a
 * flash of the wrong theme. Must run synchronously, before styles.css renders
 * — kept as its own tiny external file (rather than inline in index.html) so
 * it isn't blocked by a strict script-src CSP that omits 'unsafe-inline'.
 */
(function () {
  try {
    var stored = localStorage.getItem("nextfound_theme");
    if (stored === "dark" || stored === "light") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
