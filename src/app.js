/**
 * School-private SNS – Single-file app for file:// compatibility.
 * No ES modules: works when opening index.html directly.
 */

(function () {
  "use strict";

  // --- State ---
  const userState = {
    isAuthenticated: false,
    name: "",
    role: null,
    grade: "",
    email: "",
    username: "",
    verification_status: ""
  };

  const API = (window.API_BASE || "") + "/api";

  function apiCall(path, options) {
    var token = localStorage.getItem("nextfound_token");
    var headers = options && options.headers || {};
    if (token) headers["Authorization"] = "Bearer " + token;
    if (options && options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    var init = { headers: Object.assign({}, headers) };
    if (options) {
      if (options.method) init.method = options.method;
      if (options.body) init.body = options.body instanceof FormData ? options.body : JSON.stringify(options.body);
    }
    return fetch(API + path, init).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "Request failed"); });
      return r.json();
    });
  }

  function loginFromApiUser(u) {
    userState.isAuthenticated = true;
    userState.name = u.name || "";
    userState.role = u.role || null;
    userState.grade = u.grade || "";
    userState.email = u.email || "";
    userState.username = u.username || "";
    userState.verification_status = u.verification_status || "";
  }

  function restoreSession() {
    var token = localStorage.getItem("nextfound_token");
    if (!token) return Promise.resolve(false);
    return apiCall("/auth/me").then(function (user) {
      loginFromApiUser(user);
      return Promise.all([loadSpaces(), loadFeed()]);
    }).then(function () {
      startNotifPolling();
      return true;
    }).catch(function () {
      localStorage.removeItem("nextfound_token");
      return false;
    });
  }

  const SECTION_CONFIG = {
    "Announcements & Assignments": { studentOnly: false },
    "Questions": { studentOnly: false },
    "Anonymous / Vent": { studentOnly: true }
  };

  const ALL_SECTIONS = ["Announcements & Assignments", "Questions", "Anonymous / Vent"];

  // Cache loaded from API
  let spaces = [];
  let posts = [];   // posts for current space/section
  let homeFeed = []; // posts for home tab

  function loadSpaces() {
    return apiCall("/spaces").then(function (data) {
      spaces = data.map(function (s) {
        var sections = (s.sections && s.sections.length) ? s.sections : ALL_SECTIONS;
        return Object.assign({}, s, { sections: sections });
      });
    }).catch(function () {});
  }

  function loadPosts(spaceId, section) {
    var path = "/posts?spaceId=" + encodeURIComponent(spaceId);
    if (section) path += "&section=" + encodeURIComponent(section);
    return apiCall(path).then(function (data) {
      posts = data.map(normalizePost);
    }).catch(function () { posts = []; });
  }

  function loadFeed() {
    return apiCall("/posts/feed").then(function (data) {
      homeFeed = data.map(normalizePost);
    }).catch(function () { homeFeed = []; });
  }

  // Normalize server snake_case to camelCase for rendering
  function normalizePost(p) {
    return {
      id: p.id,
      spaceId: p.space_id,
      section: p.section,
      title: p.title,
      content: p.content,
      authorName: p.author_name,
      authorRole: p.author_role,
      isAnonymous: !!p.is_anonymous,
      createdAt: p.created_at
    };
  }

  const schedules = {
    "9": { todaySubjects: [{ period: 1, subject: "Korean" }, { period: 2, subject: "Math I" }, { period: 3, subject: "English" }, { period: 4, subject: "History" }, { period: 5, subject: "Science" }, { period: 6, subject: "Club" }], upcomingEvents: [{ dateLabel: "Next Mon", title: "Midterm schedule released" }, { dateLabel: "Oct 12 (Sat)", title: "School festival & Band concert" }] },
    "10": { todaySubjects: [{ period: 1, subject: "Korean" }, { period: 2, subject: "Math II" }, { period: 3, subject: "English" }, { period: 4, subject: "History" }, { period: 5, subject: "Science" }, { period: 6, subject: "Club" }], upcomingEvents: [{ dateLabel: "Next Mon", title: "Midterm schedule released" }] },
    "11": { todaySubjects: [{ period: 1, subject: "Korean" }, { period: 2, subject: "Calculus" }, { period: 3, subject: "English" }, { period: 4, subject: "History" }, { period: 5, subject: "Science" }, { period: 6, subject: "Club" }], upcomingEvents: [{ dateLabel: "Next Mon", title: "Midterm schedule released" }] },
    "12": { todaySubjects: [{ period: 1, subject: "Korean" }, { period: 2, subject: "Calculus" }, { period: 3, subject: "English" }, { period: 4, subject: "History" }, { period: 5, subject: "Science" }, { period: 6, subject: "Club" }], upcomingEvents: [{ dateLabel: "Oct 12 (Sat)", title: "School festival & Band concert" }] }
  };

  function login(payload) {
    userState.isAuthenticated = true;
    userState.name = payload.name || "";
    userState.role = payload.role || null;
    userState.grade = payload.grade || "";
    userState.email = payload.email || "";
    userState.username = payload.username || "";
    userState.verification_status = payload.verification_status || "";
  }

  function logout() {
    localStorage.removeItem("nextfound_token");
    userState.isAuthenticated = false;
    userState.name = "";
    userState.role = null;
    userState.grade = "";
    userState.email = "";
    userState.username = "";
    userState.verification_status = "";
  }

  function canUserPostInSection(sectionName) {
    const config = SECTION_CONFIG[sectionName];
    if (!config || !config.studentOnly) return true;
    return userState.role !== "teacher";
  }

  function isStudentOnlySection(sectionName) {
    return (SECTION_CONFIG[sectionName] && SECTION_CONFIG[sectionName].studentOnly) || false;
  }

  function createPost(payload) {
    return apiCall("/posts", {
      method: "POST",
      body: {
        spaceId: payload.spaceId,
        section: payload.section,
        title: payload.title,
        content: payload.content,
        isAnonymous: payload.isAnonymous
      }
    }).then(function (post) {
      var normalized = normalizePost(post);
      posts.unshift(normalized);
      homeFeed.unshift(normalized);
      return normalized;
    });
  }

  function getSpacesForUser() {
    return spaces;
  }

  function defaultSectionForSpace(space) {
    return (space && space.sections && space.sections.length) ? space.sections[0] : "Announcements & Assignments";
  }

  function getPostsForSpace() {
    return posts;
  }

  function getHomeFeed() {
    return homeFeed;
  }

  function getQuestionAndConcernFeed() {
    return homeFeed.filter(function (p) {
      return p.section === "Questions" || p.section === "Anonymous / Vent";
    });
  }

  function getScheduleForUser() {
    if (!userState.grade) return null;
    return schedules[userState.grade] || null;
  }

  // --- App (from main.js) ---
  const appRoot = document.getElementById("app-root");
  const appViewState = {
    activeTab: "home",
    activeSpaceId: null,
    activeSection: "Announcements & Assignments",
    notifications: [],
    unreadCount: 0,
    pendingMsAccount: null,
    pendingGoogleAccount: null,
    msalInstance: null,
    useDevForm: false,
    authScreen: "choose",
    authProvider: null,
    adminFilter: "all",
    adminTab: "users",
    adminUsers: [],
    adminUserSearch: "",
    adminPostSearch: "",
    showCreateBoardForm: false,
    expandedComments: {},   // postId -> true/false
    commentsByPost: {}      // postId -> comment[]
  };

  let notifPollTimer = null;

  function pushNotification(msg) {
    const t = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    appViewState.notifications.unshift({ message: msg, timestamp: t });
    if (appViewState.notifications.length > 20) appViewState.notifications.pop();
  }

  function loadNotifications() {
    return apiCall("/notifications").then(function (data) {
      appViewState.notifications = data;
      appViewState.unreadCount = data.filter(function (n) { return !n.is_read; }).length;
    }).catch(function () {});
  }

  function markNotificationRead(id) {
    return apiCall("/notifications/" + id + "/read", { method: "PATCH" }).then(function () {
      appViewState.notifications.forEach(function (n) {
        if (n.id === id) n.is_read = 1;
      });
      appViewState.unreadCount = appViewState.notifications.filter(function (n) { return !n.is_read; }).length;
    }).catch(function () {});
  }

  function markAllNotificationsRead() {
    return apiCall("/notifications/read-all", { method: "PATCH" }).then(function () {
      appViewState.notifications.forEach(function (n) { n.is_read = 1; });
      appViewState.unreadCount = 0;
    }).catch(function () {});
  }

  function startNotifPolling() {
    if (notifPollTimer) return;
    loadNotifications().then(render);
    notifPollTimer = setInterval(function () {
      if (!userState.isAuthenticated) return stopNotifPolling();
      loadNotifications().then(function () {
        // Re-render the tab badge without full re-render
        var badge = document.querySelector(".notif-badge");
        if (badge) {
          badge.textContent = appViewState.unreadCount > 0 ? String(appViewState.unreadCount) : "";
          badge.style.display = appViewState.unreadCount > 0 ? "inline-block" : "none";
        }
      });
    }, 15000);
  }

  function stopNotifPolling() {
    if (notifPollTimer) { clearInterval(notifPollTimer); notifPollTimer = null; }
  }

  function loadComments(postId) {
    return apiCall("/posts/" + postId + "/comments").then(function (data) {
      appViewState.commentsByPost[postId] = data;
    }).catch(function () { appViewState.commentsByPost[postId] = []; });
  }

  function submitComment(postId, content, isAnonymous, onDone) {
    return apiCall("/posts/" + postId + "/comments", {
      method: "POST",
      body: { content: content, isAnonymous: isAnonymous }
    }).then(function (comment) {
      if (!appViewState.commentsByPost[postId]) appViewState.commentsByPost[postId] = [];
      appViewState.commentsByPost[postId].push(comment);
      if (onDone) onDone();
    }).catch(function (e) {
      alert(e.message || "Failed to post comment");
    });
  }

  function setActiveTab(tab) {
    appViewState.activeTab = tab;
    if (tab === "notifications") {
      loadNotifications().then(render);
    } else {
      render();
    }
  }

  function setActiveSpace(spaceId) {
    var space = spaces.filter(function (s) { return s.id === spaceId; })[0];
    appViewState.activeSpaceId = spaceId;
    appViewState.activeSection = defaultSectionForSpace(space);
    appViewState.activeTab = "spaces";
    posts = [];
    render();
    loadPosts(spaceId, appViewState.activeSection).then(render);
  }

  function setActiveSection(section) {
    appViewState.activeSection = section;
    posts = [];
    render();
    if (appViewState.activeSpaceId) {
      loadPosts(appViewState.activeSpaceId, section).then(render);
    }
  }

  var THEME_STORAGE_KEY = "nextfound_theme";

  function getStoredTheme() {
    try { return localStorage.getItem(THEME_STORAGE_KEY); } catch (e) { return null; }
  }

  function systemPrefersDark() {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function isDarkActive() {
    var stored = getStoredTheme();
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return systemPrefersDark();
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) {}
    applyAccent(getStoredAccent());
  }

  function clearThemeOverride() {
    document.documentElement.removeAttribute("data-theme");
    try { localStorage.removeItem(THEME_STORAGE_KEY); } catch (e) {}
    applyAccent(getStoredAccent());
  }

  function handleThemeToggleClick() {
    setTheme(isDarkActive() ? "light" : "dark");
    render();
  }

  var ACCENT_STORAGE_KEY = "nextfound_accent";
  var ACCENT_PRESETS = {
    red:    { label: "Red",    light: { primary: "#e53935", hover: "#c62828", light: "#fdecea" },              dark: { primary: "#ef5350", hover: "#e57373", light: "rgba(239,83,80,0.16)" } },
    blue:   { label: "Blue",   light: { primary: "#1565c0", hover: "#0d47a1", light: "#e3f2fd" },              dark: { primary: "#64b5f6", hover: "#90caf9", light: "rgba(100,181,246,0.18)" } },
    green:  { label: "Green",  light: { primary: "#2e7d32", hover: "#1b5e20", light: "#e8f5e9" },              dark: { primary: "#66bb6a", hover: "#81c784", light: "rgba(102,187,106,0.18)" } },
    purple: { label: "Purple", light: { primary: "#7c3aed", hover: "#6d28d9", light: "#f5f3ff" },              dark: { primary: "#b39ddb", hover: "#c9b6f0", light: "rgba(179,157,219,0.18)" } },
    orange: { label: "Orange", light: { primary: "#ef6c00", hover: "#e65100", light: "#fff3e0" },              dark: { primary: "#ffb74d", hover: "#ffcc80", light: "rgba(255,183,77,0.18)" } },
    teal:   { label: "Teal",   light: { primary: "#00897b", hover: "#00695c", light: "#e0f2f1" },              dark: { primary: "#4db6ac", hover: "#80cbc4", light: "rgba(77,182,172,0.18)" } }
  };

  function getStoredAccent() {
    try { return localStorage.getItem(ACCENT_STORAGE_KEY) || "red"; } catch (e) { return "red"; }
  }

  function applyAccent(id) {
    var preset = ACCENT_PRESETS[id] || ACCENT_PRESETS.red;
    var vals = preset[isDarkActive() ? "dark" : "light"];
    var root = document.documentElement.style;
    root.setProperty("--color-primary", vals.primary);
    root.setProperty("--color-primary-hover", vals.hover);
    root.setProperty("--color-primary-light", vals.light);
  }

  function setAccent(id) {
    try { localStorage.setItem(ACCENT_STORAGE_KEY, id); } catch (e) {}
    applyAccent(id);
  }

  function showFormError(form, message) {
    var banner = form.querySelector(".form-error-banner");
    if (!banner) {
      banner = el("div", "form-error-banner");
      form.insertBefore(banner, form.firstChild);
    }
    banner.textContent = message;
  }

  function clearFormError(form) {
    var banner = form.querySelector(".form-error-banner");
    if (banner) banner.parentNode.removeChild(banner);
  }

  function markFieldError(field) {
    if (!field) return;
    var wrap = field.closest && field.closest(".form-field");
    if (wrap) wrap.classList.add("has-error");
  }

  function attachFieldErrorClearing(form) {
    form.addEventListener("input", function (e) {
      var wrap = e.target.closest && e.target.closest(".form-field");
      if (wrap) wrap.classList.remove("has-error");
      clearFormError(form);
    });
  }

  function handleLoginSubmit(ev) {
    ev.preventDefault();
    var f = ev.target;
    clearFormError(f);
    var login = (f.login && f.login.value || f.email && f.email.value || "").trim();
    var password = f.password && f.password.value;

    if (!login || !password) {
      if (!login) markFieldError(f.login);
      if (!password) markFieldError(f.password);
      showFormError(f, "Email or username and password required.");
      return;
    }

    apiCall("/auth/login", { method: "POST", body: { login: login, password: password } })
      .then(function (res) {
        localStorage.setItem("nextfound_token", res.token);
        loginFromApiUser(res.user);
        appViewState.authScreen = "choose";
        appViewState.activeTab = "home";
        return Promise.all([loadSpaces(), loadFeed()]);
      }).then(function () {
        var ds = getSpacesForUser()[0];
        appViewState.activeSpaceId = ds ? ds.id : null;
        appViewState.activeSection = defaultSectionForSpace(ds);
        startNotifPolling();
        render();
      })
      .catch(function (e) {
        showFormError(f, e.message || "Login failed");
      });
  }

  function handleSignupSubmit(ev) {
    ev.preventDefault();
    var f = ev.target;
    clearFormError(f);
    var email = (f.email && f.email.value || "").trim();
    var password = f.password && f.password.value;
    var name = (f.name && f.name.value || "").trim();
    var school_email = (f.school_email && f.school_email.value || "").trim();
    var role = f.role && f.role.value;
    var grade = f.grade && f.grade.value;
    var username = (f.username && f.username.value || "").trim();
    var verification_method = f.verification_method && f.verification_method.value;
    var student_id = f.student_id && f.student_id.files && f.student_id.files[0];

    if (!email || !password || !name || !role || !grade || !verification_method) {
      if (!email) markFieldError(f.email);
      if (!password) markFieldError(f.password);
      if (!name) markFieldError(f.name);
      if (!role) markFieldError(f.role);
      if (!grade) markFieldError(f.grade);
      showFormError(f, "Please fill in all required fields.");
      return;
    }

    if (verification_method === "student_id" && !student_id) {
      markFieldError(f.student_id);
      showFormError(f, "Please upload your student ID photo.");
      return;
    }

    var body = new FormData();
    body.append("email", email);
    body.append("password", password);
    body.append("name", name);
    body.append("role", role);
    body.append("grade", grade);
    if (username) body.append("username", username);
    body.append("verification_method", verification_method);
    if (school_email) body.append("school_email", school_email);
    if (student_id) body.append("student_id", student_id);

    fetch(API + "/auth/signup", {
      method: "POST",
      headers: { "Authorization": localStorage.getItem("nextfound_token") ? "Bearer " + localStorage.getItem("nextfound_token") : "" },
      body: body
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "Signup failed"); });
        return r.json();
      })
      .then(function (res) {
        localStorage.setItem("nextfound_token", res.token);
        loginFromApiUser(res.user);
        appViewState.authScreen = "choose";
        appViewState.activeTab = "home";
        if (res.message) pushNotification(res.message);
        return Promise.all([loadSpaces(), loadFeed()]);
      }).then(function () {
        var ds = getSpacesForUser()[0];
        appViewState.activeSpaceId = ds ? ds.id : null;
        appViewState.activeSection = defaultSectionForSpace(ds);
        render();
      })
      .catch(function (e) {
        showFormError(f, e.message || "Signup failed");
      });
  }

  function handleMicrosoftLogin() {
    var config = typeof window !== "undefined" && window.MSAL_CONFIG;
    if (!config || !config.clientId || config.clientId === "YOUR_CLIENT_ID") {
      alert("Microsoft sign-in is not configured. Set YOUR_CLIENT_ID in src/msal-config.js, or use dev sign-in below.");
      return;
    }
    if (typeof msal === "undefined" && typeof window.msal === "undefined") {
      alert("Microsoft sign-in requires loading the app from a web server (e.g. npx serve). Also add the redirect URI to your Azure app.");
      return;
    }
    var Msal = window.msal || msal;
    if (!Msal || !Msal.PublicClientApplication) {
      alert("Microsoft sign-in library not loaded. Run from http://localhost (not file://).");
      return;
    }

    var btn = document.querySelector(".ms-signin-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Signing in..."; }

    var authConfig = {
      auth: {
        clientId: config.clientId,
        authority: config.authority || "https://login.microsoftonline.com/common",
        redirectUri: config.redirectUri || (location.origin + "/")
      }
    };

    if (!appViewState.msalInstance) {
      appViewState.msalInstance = new Msal.PublicClientApplication(authConfig);
    }

    appViewState.msalInstance.initialize().then(function () {
      return appViewState.msalInstance.loginPopup({ scopes: config.scopes || ["User.Read", "openid", "profile"] });
    }).then(function (result) {
      var account = result.account;
      var name = account && (account.name || account.idTokenClaims && (account.idTokenClaims.name || account.idTokenClaims.preferred_username));
      var email = account && (account.username || account.idTokenClaims && account.idTokenClaims.preferred_username);
      var token = result.accessToken || result.idToken;
      var isSignup = appViewState.authScreen === "signup";
      if (isSignup) {
        appViewState.pendingMsAccount = { name: name || "User", email: email || "", token: token };
        render();
        return;
      }
      apiCall("/auth/microsoft", { method: "POST", body: { access_token: token } })
        .then(function (res) {
          localStorage.setItem("nextfound_token", res.token);
          loginFromApiUser(res.user);
          appViewState.authScreen = "choose";
          appViewState.activeTab = "home";
          return Promise.all([loadSpaces(), loadFeed()]);
        }).then(function () {
          var ds = getSpacesForUser()[0];
          appViewState.activeSpaceId = ds ? ds.id : null;
          startNotifPolling();
          render();
        })
        .catch(function (e) {
          if (e.message && e.message.indexOf("New user") !== -1) {
            appViewState.pendingMsAccount = { name: name || "User", email: email || "", token: token };
            render();
          } else {
            alert(e.message || "Login failed");
          }
        });
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = "Sign in with Microsoft"; }
      console.error(err);
      if (err.message && err.message.indexOf("interaction_required") === -1 && err.message.indexOf("user_cancelled") === -1) {
        alert("Sign-in failed: " + (err.errorMessage || err.message || "Unknown error"));
      }
      render();
    });
  }

  function handleCompleteProfileSubmit(ev) {
    ev.preventDefault();
    var f = ev.target;
    var pending = appViewState.pendingMsAccount;
    if (!pending || !pending.token) { alert("Session expired. Please try again."); render(); return; }
    clearFormError(f);

    var role = f.role && f.role.value;
    var grade = f.grade && f.grade.value;
    var username = (f.username && f.username.value || "").trim();
    var school_email = (f.school_email && f.school_email.value || "").trim();
    var verification_method = f.verification_method && f.verification_method.value;
    var student_id = f.student_id && f.student_id.files && f.student_id.files[0];

    if (!role || !grade || !verification_method) {
      if (!role) markFieldError(f.role);
      if (!grade) markFieldError(f.grade);
      showFormError(f, "Please fill in role, grade, and verification method.");
      return;
    }
    if (verification_method === "student_id" && !student_id) {
      markFieldError(f.student_id);
      showFormError(f, "Please upload your student ID photo.");
      return;
    }

    var body = new FormData();
    body.append("access_token", pending.token);
    body.append("name", pending.name || "");
    if (username) body.append("username", username);
    body.append("school_email", school_email);
    body.append("role", role);
    body.append("grade", grade);
    body.append("verification_method", verification_method);
    if (student_id) body.append("student_id", student_id);

    fetch(API + "/auth/microsoft", {
      method: "POST",
      body: body
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "Signup failed"); });
        return r.json();
      })
      .then(function (res) {
        localStorage.setItem("nextfound_token", res.token);
        loginFromApiUser(res.user);
        appViewState.pendingMsAccount = null;
        appViewState.authScreen = "choose";
        appViewState.activeTab = "home";
        if (res.message) pushNotification(res.message);
        return Promise.all([loadSpaces(), loadFeed()]);
      }).then(function () {
        var ds = getSpacesForUser()[0];
        appViewState.activeSpaceId = ds ? ds.id : null;
        appViewState.activeSection = defaultSectionForSpace(ds);
        startNotifPolling();
        render();
      })
      .catch(function (e) {
        showFormError(f, e.message || "Signup failed");
      });
  }

  function decodeJwtPayload(token) {
    try {
      var base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      var json = decodeURIComponent(atob(base64).split("").map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(""));
      return JSON.parse(json);
    } catch (e) {
      return {};
    }
  }

  function handleGoogleCredentialResponse(response) {
    var idToken = response && response.credential;
    if (!idToken) return;
    var claims = decodeJwtPayload(idToken);
    apiCall("/auth/google", { method: "POST", body: { id_token: idToken } })
      .then(function (res) {
        localStorage.setItem("nextfound_token", res.token);
        loginFromApiUser(res.user);
        appViewState.authScreen = "choose";
        appViewState.activeTab = "home";
        return Promise.all([loadSpaces(), loadFeed()]);
      }).then(function () {
        var ds = getSpacesForUser()[0];
        appViewState.activeSpaceId = ds ? ds.id : null;
        appViewState.activeSection = defaultSectionForSpace(ds);
        startNotifPolling();
        render();
      })
      .catch(function (e) {
        if (e.message && e.message.indexOf("New user") !== -1) {
          appViewState.pendingGoogleAccount = { name: claims.name || "User", email: claims.email || "", token: idToken };
          render();
        } else {
          alert(e.message || "Google sign-in failed");
        }
      });
  }

  function handleCompleteGoogleProfileSubmit(ev) {
    ev.preventDefault();
    var f = ev.target;
    var pending = appViewState.pendingGoogleAccount;
    if (!pending || !pending.token) { alert("Session expired. Please try again."); render(); return; }
    clearFormError(f);

    var role = f.role && f.role.value;
    var grade = f.grade && f.grade.value;
    var username = (f.username && f.username.value || "").trim();
    var school_email = (f.school_email && f.school_email.value || "").trim();
    var verification_method = f.verification_method && f.verification_method.value;
    var student_id = f.student_id && f.student_id.files && f.student_id.files[0];

    if (!role || !grade || !verification_method) {
      if (!role) markFieldError(f.role);
      if (!grade) markFieldError(f.grade);
      showFormError(f, "Please fill in role, grade, and verification method.");
      return;
    }
    if (verification_method === "student_id" && !student_id) {
      markFieldError(f.student_id);
      showFormError(f, "Please upload your student ID photo.");
      return;
    }

    var body = new FormData();
    body.append("id_token", pending.token);
    body.append("name", pending.name || "");
    if (username) body.append("username", username);
    body.append("school_email", school_email);
    body.append("role", role);
    body.append("grade", grade);
    body.append("verification_method", verification_method);
    if (student_id) body.append("student_id", student_id);

    fetch(API + "/auth/google", {
      method: "POST",
      body: body
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "Signup failed"); });
        return r.json();
      })
      .then(function (res) {
        localStorage.setItem("nextfound_token", res.token);
        loginFromApiUser(res.user);
        appViewState.pendingGoogleAccount = null;
        appViewState.authScreen = "choose";
        appViewState.activeTab = "home";
        if (res.message) pushNotification(res.message);
        return Promise.all([loadSpaces(), loadFeed()]);
      }).then(function () {
        var ds = getSpacesForUser()[0];
        appViewState.activeSpaceId = ds ? ds.id : null;
        appViewState.activeSection = defaultSectionForSpace(ds);
        startNotifPolling();
        render();
      })
      .catch(function (e) {
        showFormError(f, e.message || "Signup failed");
      });
  }

  function initGoogleButton(containerId, attempt) {
    attempt = attempt || 0;
    var ac = window.AUTH_CONFIG || {};
    if (!ac.googleClientId) return;
    var G = window.google;
    if (!G || !G.accounts || !G.accounts.id) {
      if (attempt < 10) setTimeout(function () { initGoogleButton(containerId, attempt + 1); }, 300);
      return;
    }
    var container = document.getElementById(containerId);
    if (!container) return;
    G.accounts.id.initialize({ client_id: ac.googleClientId, callback: handleGoogleCredentialResponse });
    G.accounts.id.renderButton(container, { theme: "outline", size: "large", width: 280 });
  }

  function handleLogoutClick() {
    stopNotifPolling();
    logout();
    appViewState.pendingMsAccount = null;
    appViewState.activeTab = "home";
    appViewState.activeSpaceId = null;
    appViewState.notifications = [];
    appViewState.unreadCount = 0;
    appViewState.expandedComments = {};
    appViewState.commentsByPost = {};
    render();
  }

  function handleCreatePost(ev) {
    ev.preventDefault();
    const f = ev.target;
    const title = (f.title && f.title.value || "").trim();
    const content = (f.content && f.content.value || "").trim();
    const isAnonymous = f.isAnonymous && f.isAnonymous.checked;

    if (!title || !content) {
      alert("Please enter title and content.");
      return;
    }
    if (!appViewState.activeSpaceId) {
      alert("Please select a space first.");
      return;
    }
    if (!canUserPostInSection(appViewState.activeSection)) {
      alert("Teachers cannot post in student-only sections.");
      return;
    }

    createPost({
      spaceId: appViewState.activeSpaceId,
      section: appViewState.activeSection,
      title: title,
      content: content,
      isAnonymous: isAnonymous
    }).then(function (post) {
      pushNotification("New post: [" + post.section + "] " + post.title);
      f.reset();
      render();
    }).catch(function (e) {
      alert(e.message || "Failed to create post");
    });
  }

  function fmtDate(d) {
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // Relative "3m ago" style timestamp for recent items, falling back to an
  // absolute date once something is more than a week old (Everytime-style
  // feed readability — exact time is still available via a title tooltip).
  function timeAgo(d) {
    var diffSec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (diffSec < 5) return "just now";
    if (diffSec < 60) return diffSec + "s ago";
    var diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin + "m ago";
    var diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + "h ago";
    var diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return diffDay + "d ago";
    return fmtDate(d);
  }

  var VERIFICATION_METHOD_LABELS = { manual: "Manual", student_id: "Student ID", school_sso: "School SSO" };
  function prettyVerificationMethod(m) {
    return VERIFICATION_METHOD_LABELS[m] || m;
  }

  function renderPostCard(post, opts) {
    opts = opts || {};
    var isAdmin = userState.role === "admin";
    var commentList = appViewState.commentsByPost[post.id] || [];
    var expanded = !!appViewState.expandedComments[post.id];

    var article = el("article", "post-card" + (post.isAnonymous ? " is-anonymous" : ""));

    // Top row: badge + title + comment count
    var row = el("div", "post-card-row");
    var badgeClass = "post-section-badge";
    if (post.section === "Questions") badgeClass += " post-section-badge--questions";
    else if (post.section === "Anonymous / Vent") badgeClass += " post-section-badge--anonymous";
    var badge = el("span", badgeClass);
    badge.textContent = opts.showSpace
      ? (opts.spaceLabel || "Space") + " · " + post.section.split(" ")[0]
      : post.section.split(" ")[0];
    row.appendChild(badge);

    var title = el("span", "post-title");
    title.textContent = post.title;
    row.appendChild(title);

    var cc = el("span", "post-comment-count");
    cc.textContent = "[" + commentList.length + "]";
    row.appendChild(cc);
    article.appendChild(row);

    // Excerpt
    var ex = el("p", "post-excerpt");
    ex.textContent = post.content.length > 80 ? post.content.slice(0, 80) + "…" : post.content;
    article.appendChild(ex);

    // Meta row: author · date
    var meta = el("div", "post-meta-row");
    var authorSpan = document.createElement("span");
    authorSpan.textContent = post.authorName;
    var dateSpan = document.createElement("span");
    dateSpan.textContent = timeAgo(post.createdAt);
    dateSpan.title = fmtDate(post.createdAt);
    meta.appendChild(authorSpan);
    meta.appendChild(dateSpan);
    article.appendChild(meta);

    // Admin reveal: real author + IP for anonymous posts
    if (isAdmin && post.isAnonymous) {
      var reveal = el("span", "admin-reveal");
      reveal.textContent = "\uD83D\uDD0D " + (post.author_name || post.authorName) + " · IP: " + (post.author_ip || "unknown");
      article.appendChild(reveal);
    }

    // Comment area
    var commentArea = el("div", "comment-area");

    var toggleBtn = el("button", "comment-toggle-btn");
    toggleBtn.textContent = commentList.length + " comment" + (commentList.length !== 1 ? "s" : "") + (expanded ? " ▲" : " ▼");
    toggleBtn.addEventListener("click", function () {
      appViewState.expandedComments[post.id] = !appViewState.expandedComments[post.id];
      if (appViewState.expandedComments[post.id] && !appViewState.commentsByPost[post.id]) {
        loadComments(post.id).then(render);
        return;
      }
      render();
    });
    commentArea.appendChild(toggleBtn);

    if (expanded) {
      var commentSection = el("div", "comment-section");

      if (commentList.length > 0) {
        commentList.forEach(function (c) {
          var ci = el("div", "comment-item");
          var ca = el("span", "comment-author");
          ca.textContent = c.author_name;
          var ct = el("p", "comment-text");
          ct.textContent = c.content;
          var cd = el("span", "comment-date");
          cd.textContent = timeAgo(c.created_at);
          cd.title = fmtDate(c.created_at);
          // Admin reveal for anonymous comments
          if (isAdmin && c.is_anonymous) {
            var cr = el("span", "admin-reveal");
            cr.textContent = "\uD83D\uDD0D " + (c.author_name || "?") + " · IP: " + (c.author_ip || "unknown");
            ci.appendChild(ca);
            ci.appendChild(ct);
            ci.appendChild(cd);
            ci.appendChild(cr);
          } else {
            ci.appendChild(ca);
            ci.appendChild(ct);
            ci.appendChild(cd);
          }
          commentSection.appendChild(ci);
        });
      } else {
        var noC = el("p", "muted");
        noC.textContent = "No comments yet.";
        commentSection.appendChild(noC);
      }

      if (userState.isAuthenticated) {
        var cForm = el("form", "comment-form");
        var isAnonSection = post.section === "Anonymous / Vent";
        cForm.innerHTML =
          '<textarea name="content" rows="2" placeholder="Write a comment…" required></textarea>' +
          (isAnonSection ? '<label class="checkbox-inline"><input type="checkbox" name="isAnonymous" checked /> Anonymous</label>' : '') +
          '<button type="submit" class="primary-button small">Reply</button>';
        cForm.addEventListener("submit", function (ev) {
          ev.preventDefault();
          var content = (cForm.content && cForm.content.value || "").trim();
          var isAnon = cForm.isAnonymous ? cForm.isAnonymous.checked : false;
          if (!content) return;
          var submitBtn = cForm.querySelector("button[type=submit]");
          submitBtn.disabled = true;
          submitComment(post.id, content, isAnon, function () {
            cForm.reset();
            submitBtn.disabled = false;
            render();
          });
        });
        commentSection.appendChild(cForm);
      }

      commentArea.appendChild(commentSection);
    }

    article.appendChild(commentArea);
    return article;
  }

  function clearRoot() {
    while (appRoot.firstChild) appRoot.removeChild(appRoot.firstChild);
  }

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function renderLoadingIndicator() {
    var wrap = el("div", "loading-row");
    wrap.appendChild(el("span", "spinner"));
    var label = el("span", "muted");
    label.textContent = "Loading…";
    wrap.appendChild(label);
    return wrap;
  }

  function renderEmptyState(icon, text) {
    var wrap = el("div", "empty-state");
    var iconEl = el("div", "empty-state-icon");
    iconEl.textContent = icon;
    var textEl = el("p", "empty-state-text");
    textEl.textContent = text;
    wrap.appendChild(iconEl);
    wrap.appendChild(textEl);
    return wrap;
  }

  function renderNavbar(container) {
    var nav = el("nav", "top-navbar");

    var logo = el("div", "navbar-logo");
    logo.innerHTML = "NEXTFOUND<span>Cranbrook School</span>";
    logo.addEventListener("click", function () { setActiveTab("home"); });
    nav.appendChild(logo);

    if (userState.isAuthenticated) {
      var tabsEl = el("div", "navbar-tabs");
      var tabs = [
        { id: "home", label: "Home" },
        { id: "spaces", label: "Boards" },
        { id: "questions", label: "Q&A / Vent" },
        { id: "notifications", label: "Notifications" },
        { id: "settings", label: "Settings" }
      ];
      if (userState.role === "admin") tabs.push({ id: "admin", label: "Admin" });
      tabs.forEach(function (tab) {
        var btn = el("button", "navbar-tab" + (appViewState.activeTab === tab.id ? " active" : ""));
        btn.textContent = tab.label;
        if (tab.id === "notifications" && appViewState.unreadCount > 0) {
          var badge = el("span", "notif-badge");
          badge.textContent = String(appViewState.unreadCount);
          btn.appendChild(badge);
        }
        btn.addEventListener("click", function () { setActiveTab(tab.id); });
        tabsEl.appendChild(btn);
      });
      nav.appendChild(tabsEl);
    }

    var right = el("div", "navbar-right");
    var dark = isDarkActive();
    var themeBtn = el("button", "theme-toggle-btn");
    themeBtn.type = "button";
    themeBtn.textContent = dark ? "☀️" : "🌙";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    themeBtn.title = themeBtn.getAttribute("aria-label");
    themeBtn.addEventListener("click", handleThemeToggleClick);
    right.appendChild(themeBtn);

    if (userState.isAuthenticated) {
      var roleLabel = userState.role === "admin" ? "Admin" : (userState.role === "teacher" ? "Teacher" : "Grade " + (userState.grade || "?"));
      var userInfo = el("span", "navbar-user");
      userInfo.textContent = userState.name + " · " + roleLabel;
      var logoutBtn = el("button", "ghost-button small");
      logoutBtn.style.cssText = "color:#fff;border-color:rgba(255,255,255,0.4);";
      logoutBtn.textContent = "Sign out";
      logoutBtn.addEventListener("click", handleLogoutClick);
      right.appendChild(userInfo);
      right.appendChild(logoutBtn);
    }
    nav.appendChild(right);

    container.appendChild(nav);

    if (userState.isAuthenticated && userState.verification_status === "pending") {
      var wrap = el("div", "app-wrapper");
      var banner = el("div", "verification-pending-banner");
      banner.textContent = "School verification pending. Contact mkim28@cranbrook.edu to get approved.";
      wrap.appendChild(banner);
      container.appendChild(wrap);
    }
  }

  function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function renderCompleteProfileCard(pending, providerLabel, submitHandler, onBack) {
    var ac = window.AUTH_CONFIG || {};
    var adminEmail = ac.adminEmail || "mkim28@cranbrook.edu";
    var card = el("section", "login-card");
    var steps = el("span", "auth-steps");
    steps.textContent = "Step 2 of 2";
    var title = el("h2");
    title.textContent = "Complete your profile";
    var desc = el("p", "muted");
    desc.textContent = "Signed in with " + providerLabel + ". Fill in below and choose school verification.";
    var form = el("form", "form-grid");
    form.noValidate = true;
    form.innerHTML = '<div class="form-field"><label>Name</label><input type="text" value="' + esc(pending.name) + '" readonly disabled /></div>' +
      '<div class="form-field"><label>Email</label><input type="text" value="' + esc(pending.email) + '" readonly disabled /></div>' +
      '<div class="form-field"><label for="username">Username (optional)</label><input id="username" name="username" type="text" placeholder="Login with email or username" /></div>' +
      '<div class="form-field"><label for="school_email">School email (optional)</label><input id="school_email" name="school_email" type="email" /></div>' +
      '<div class="form-field"><label for="role">Role</label><select id="role" name="role" required><option value="">Select</option><option value="student">Student</option><option value="teacher">Teacher</option></select></div>' +
      '<div class="form-field"><label for="grade">Grade</label><select id="grade" name="grade" required><option value="">Select</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select></div>' +
      '<div class="form-field"><label>School verification</label><label class="radio-option"><input type="radio" name="verification_method" value="manual" checked /> Manual: Contact ' + esc(adminEmail) + '</label><label class="radio-option"><input type="radio" name="verification_method" value="student_id" /> Upload student ID</label><input type="file" name="student_id" accept="image/*" /></div>' +
      '<div class="form-actions"><button type="submit" class="primary-button">Continue</button><button type="button" class="ghost-button" id="complete-back-btn">Use different account</button></div>';
    form.addEventListener("submit", submitHandler);
    attachFieldErrorClearing(form);
    var backBtn = form.querySelector("#complete-back-btn");
    if (backBtn) backBtn.addEventListener("click", onBack);
    card.appendChild(steps);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(form);
    return card;
  }

  function renderLogin(container) {
    var page = el("div", "auth-page");
    var brand = el("div", "auth-brand");
    brand.innerHTML =
      '<div class="auth-brand-logo">NEXTFOUND</div>' +
      '<p class="auth-brand-tagline">A quiet space for Cranbrook students only — class boards, subject boards, clubs, and a place to vent anonymously.</p>' +
      '<div class="auth-brand-features">' +
        '<div class="auth-brand-feature"><span class="auth-brand-feature-dot"></span>Class &amp; subject spaces by grade</div>' +
        '<div class="auth-brand-feature"><span class="auth-brand-feature-dot"></span>Announcements, questions, anonymous vent</div>' +
        '<div class="auth-brand-feature"><span class="auth-brand-feature-dot"></span>Verified students and teachers only</div>' +
      '</div>';
    page.appendChild(brand);

    var formPanel = el("div", "auth-form-panel");
    page.appendChild(formPanel);
    container.appendChild(page);

    var pending = appViewState.pendingMsAccount;
    if (pending && pending.token) {
      formPanel.appendChild(renderCompleteProfileCard(pending, "Microsoft", handleCompleteProfileSubmit, function () { appViewState.pendingMsAccount = null; render(); }));
      return;
    }

    var pendingG = appViewState.pendingGoogleAccount;
    if (pendingG && pendingG.token) {
      formPanel.appendChild(renderCompleteProfileCard(pendingG, "Google", handleCompleteGoogleProfileSubmit, function () { appViewState.pendingGoogleAccount = null; render(); }));
      return;
    }

    var screen = appViewState.authScreen;
    var ac = window.AUTH_CONFIG || {};
    var adminEmail = ac.adminEmail || "mkim28@cranbrook.edu";
    var msCfg = window.MSAL_CONFIG;
    var msalReady = msCfg && msCfg.clientId && msCfg.clientId !== "YOUR_CLIENT_ID" && (typeof window.msal !== "undefined" || typeof msal !== "undefined");
    var googleReady = !!(ac && ac.googleClientId);

    var card = el("section", "login-card");

    if (screen === "choose") {
      var t = el("h2");
      t.textContent = "Welcome";
      t.style.color = "var(--color-primary)";
      var d = el("p", "login-sub");
      d.textContent = "Cranbrook School exclusive community";
      var logBtn = el("button", "primary-button");
      logBtn.textContent = "Log in";
      logBtn.addEventListener("click", function () { appViewState.authScreen = "login"; render(); });
      var signBtn = el("button", "ghost-button");
      signBtn.textContent = "Sign up";
      signBtn.addEventListener("click", function () { appViewState.authScreen = "signup"; render(); });
      var btnWrap = el("div", "form-actions");
      btnWrap.appendChild(logBtn);
      btnWrap.appendChild(signBtn);
      card.appendChild(t);
      card.appendChild(d);
      card.appendChild(btnWrap);
      formPanel.appendChild(card);
      return;
    }

    if (screen === "login") {
      var back = el("a");
      back.href = "#";
      back.className = "muted";
      back.textContent = "← Back";
      back.style.display = "block";
      back.style.marginBottom = "0.5rem";
      back.addEventListener("click", function (e) { e.preventDefault(); appViewState.authScreen = "choose"; render(); });
      var t2 = el("h2");
      t2.textContent = "Log in";
      card.appendChild(back);
      card.appendChild(t2);

      var oauthGroup = el("div", "auth-oauth-group");
      if (msalReady) {
        var msBtn = el("button", "primary-button ms-signin-btn");
        msBtn.type = "button";
        msBtn.innerHTML = '<span class="ms-icon"></span> Sign in with Microsoft';
        msBtn.addEventListener("click", handleMicrosoftLogin);
        oauthGroup.appendChild(msBtn);
      }
      if (googleReady) {
        var gWrap = el("div", "google-signin-wrap");
        gWrap.id = "google-signin-btn-login";
        oauthGroup.appendChild(gWrap);
      }
      if (oauthGroup.children.length) {
        card.appendChild(oauthGroup);
        var divider = el("div", "auth-divider");
        divider.textContent = "or continue with email";
        card.appendChild(divider);
      }

      var form = el("form", "form-grid");
      form.noValidate = true;
      form.innerHTML = '<div class="form-field"><label>Email or username</label><input name="login" type="text" placeholder="Email or username" required /></div>' +
        '<div class="form-field"><label>Password</label><input name="password" type="password" required /></div>' +
        '<div class="form-actions"><button type="submit" class="primary-button">Log in</button></div>';
      form.addEventListener("submit", handleLoginSubmit);
      attachFieldErrorClearing(form);
      card.appendChild(form);

      formPanel.appendChild(card);
      if (googleReady) setTimeout(function () { initGoogleButton("google-signin-btn-login"); }, 0);
      return;
    }

    if (screen === "signup") {
      var back2 = el("a");
      back2.href = "#";
      back2.className = "muted";
      back2.textContent = "← Back";
      back2.style.display = "block";
      back2.style.marginBottom = "0.5rem";
      back2.addEventListener("click", function (e) { e.preventDefault(); appViewState.authScreen = "choose"; render(); });
      var t3 = el("h2");
      t3.textContent = "Sign up";
      card.appendChild(back2);
      card.appendChild(t3);

      var oauthGroupS = el("div", "auth-oauth-group");
      if (msalReady) {
        var msSignup = el("button", "primary-button ms-signin-btn");
        msSignup.type = "button";
        msSignup.textContent = "Sign up with Microsoft";
        msSignup.addEventListener("click", handleMicrosoftLogin);
        oauthGroupS.appendChild(msSignup);
      }
      if (googleReady) {
        var gWrapSignup = el("div", "google-signin-wrap");
        gWrapSignup.id = "google-signin-btn-signup";
        oauthGroupS.appendChild(gWrapSignup);
      }
      if (oauthGroupS.children.length) {
        card.appendChild(oauthGroupS);
        var dividerS = el("div", "auth-divider");
        dividerS.textContent = "or continue with email";
        card.appendChild(dividerS);
      }

      var signupForm = el("form", "form-grid");
      signupForm.noValidate = true;
      signupForm.innerHTML = '<div class="form-field"><label>Email</label><input name="email" type="email" required /></div>' +
        '<div class="form-field"><label>Username (optional)</label><input name="username" type="text" placeholder="Login with email or username" /></div>' +
        '<div class="form-field"><label>Password</label><input name="password" type="password" required /></div>' +
        '<div class="form-field"><label>Name</label><input name="name" required /></div>' +
        '<div class="form-field"><label>School email (optional)</label><input name="school_email" type="email" /></div>' +
        '<div class="form-field"><label>Role</label><select name="role" required><option value="">Select</option><option value="student">Student</option><option value="teacher">Teacher</option></select></div>' +
        '<div class="form-field"><label>Grade</label><select name="grade" required><option value="">Select</option><option value="9">Grade 9</option><option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option></select></div>' +
        '<div class="form-field"><label>School verification</label><label class="radio-option"><input type="radio" name="verification_method" value="manual" checked /> Manual: ' + esc(adminEmail) + '</label><label class="radio-option"><input type="radio" name="verification_method" value="student_id" /> Upload student ID photo</label><input type="file" name="student_id" accept="image/*" /></div>' +
        '<div class="form-actions"><button type="submit" class="primary-button">Sign up</button></div>';
      signupForm.addEventListener("submit", handleSignupSubmit);
      attachFieldErrorClearing(signupForm);
      card.appendChild(signupForm);

      formPanel.appendChild(card);
      if (googleReady) setTimeout(function () { initGoogleButton("google-signin-btn-signup"); }, 0);
    }
  }

  function renderHome(container) {
    var wrap = el("div", "app-wrapper");
    var layout = el("div", "home-layout");
    var left = el("div", "home-left");
    var right = el("div", "home-right");

    var sc = el("section", "card");
    var schTitle = el("h2");
    schTitle.textContent = "Today's schedule";
    sc.appendChild(schTitle);
    var schedule = getScheduleForUser();
    if (schedule) {
      var table = el("table", "schedule-table");
      schedule.todaySubjects.forEach(function (row) {
        var tr = document.createElement("tr");
        var td1 = document.createElement("td");
        td1.textContent = row.period;
        var td2 = document.createElement("td");
        td2.textContent = row.subject;
        tr.appendChild(td1);
        tr.appendChild(td2);
        table.appendChild(tr);
      });
      sc.appendChild(table);
      var up = el("div", "upcoming-events");
      schedule.upcomingEvents.forEach(function (e) {
        var it = el("div", "upcoming-item");
        it.textContent = e.dateLabel + " · " + e.title;
        up.appendChild(it);
      });
      sc.appendChild(up);
    } else {
      var emp = el("p", "muted");
      emp.textContent = "Sign in to see your schedule.";
      sc.appendChild(emp);
    }
    left.appendChild(sc);

    var spCard = el("section", "card");
    var spH2 = el("h2");
    spH2.textContent = "My spaces";
    spCard.appendChild(spH2);
    var userSpaces = getSpacesForUser();
    if (userSpaces.length === 0) {
      var p = el("p", "muted");
      p.textContent = "Sign in to see your class, subjects & clubs.";
      spCard.appendChild(p);
    } else {
      var list = el("div", "space-list");
      userSpaces.forEach(function (space) {
        var item = el("button", "space-pill");
        item.textContent = space.name;
        item.addEventListener("click", function () { setActiveSpace(space.id); });
        list.appendChild(item);
      });
      spCard.appendChild(list);
    }
    left.appendChild(spCard);

    var feedCard = el("section", "card");
    var feedTitle = el("h2");
    feedTitle.textContent = "Recent from your spaces";
    feedCard.appendChild(feedTitle);
    var feed = getHomeFeed();
    if (feed.length === 0) {
      feedCard.appendChild(renderEmptyState("📭", "No posts yet. Be the first to post."));
    } else {
      var fl = el("div", "post-list");
      feed.forEach(function (post) {
        var sn = spaces.filter(function (s) { return s.id === post.spaceId; })[0];
        fl.appendChild(renderPostCard(post, { showSpace: true, spaceLabel: sn ? sn.name : "Space" }));
      });
      feedCard.appendChild(fl);
    }
    right.appendChild(feedCard);

    layout.appendChild(left);
    layout.appendChild(right);
    wrap.appendChild(layout);
    container.appendChild(wrap);
  }

  function renderSpaces(container) {
    var wrap = el("div", "app-wrapper");
    var layout = el("div", "layout");
    var sidebarEl = el("aside", "layout-sidebar");
    var mainEl = el("div", "layout-main");

    var userSpaces = getSpacesForUser();
    var spacesToUse = userSpaces.length ? userSpaces : spaces;
    if (!appViewState.activeSpaceId && spacesToUse.length) appViewState.activeSpaceId = spacesToUse[0].id;

    // Group spaces by type
    var groups = { class: [], subject: [], club: [] };
    spacesToUse.forEach(function (s) { if (groups[s.type]) groups[s.type].push(s); });
    var groupLabels = { class: "Class boards", subject: "Subject boards", club: "Clubs" };

    Object.keys(groups).forEach(function (type) {
      if (!groups[type].length) return;
      var sec = el("div", "sidebar-section");
      var title = el("div", "sidebar-title");
      title.textContent = groupLabels[type];
      sec.appendChild(title);
      groups[type].forEach(function (space) {
        var btn = el("button", "sidebar-item" + (space.id === appViewState.activeSpaceId ? " active" : ""));
        btn.textContent = space.name;
        btn.addEventListener("click", function () { setActiveSpace(space.id); });
        sec.appendChild(btn);
      });
      sidebarEl.appendChild(sec);
    });

    var activeSpace = spacesToUse.filter(function (s) { return s.id === appViewState.activeSpaceId; })[0];

    if (!activeSpace) {
      var mp = el("p", "muted");
      mp.textContent = "Select a board from the sidebar.";
      mainEl.appendChild(mp);
    } else {
      // Section tabs
      var st = el("div", "section-tabs");
      activeSpace.sections.forEach(function (section) {
        var btn = el("button", "section-tab" + (section === appViewState.activeSection ? " active" : ""));
        btn.textContent = section + (isStudentOnlySection(section) ? " 🔒" : "");
        btn.title = isStudentOnlySection(section) ? "Student-only section" : "";
        btn.addEventListener("click", function () { setActiveSection(section); });
        st.appendChild(btn);
      });
      mainEl.appendChild(st);

      if (userState.isAuthenticated && canUserPostInSection(appViewState.activeSection)) {
        var composer = el("div", "composer");
        var defAnon = appViewState.activeSection === "Anonymous / Vent";
        var composerTitle = el("p", "composer-title");
        composerTitle.textContent = activeSpace.name + " · " + appViewState.activeSection;
        composer.appendChild(composerTitle);
        var form = el("form");
        form.innerHTML =
          '<div class="form-field" style="margin-bottom:0.5rem"><input name="title" placeholder="Title" required /></div>' +
          '<div class="form-field"><textarea name="content" rows="3" placeholder="Write your post…" required></textarea></div>' +
          '<div class="composer-row"><label class="checkbox-inline"><input type="checkbox" name="isAnonymous" ' + (defAnon ? "checked" : "") + ' /> Anonymous</label>' +
          '<button type="submit" class="primary-button small">Reply</button></div>';
        form.addEventListener("submit", handleCreatePost);
        composer.appendChild(form);
        mainEl.appendChild(composer);
      } else if (userState.isAuthenticated && !canUserPostInSection(appViewState.activeSection)) {
        var notice = el("div", "student-only-notice");
        notice.textContent = "This is a student-only section. Teachers can read but not post here.";
        mainEl.appendChild(notice);
      }

      var postsInSpace = getPostsForSpace(appViewState.activeSpaceId, appViewState.activeSection);
      var postListEl = el("div", "post-list");
      var listHeader = el("div", "post-list-header");
      var listTitle = el("span", "post-list-title");
      listTitle.textContent = appViewState.activeSection;
      listHeader.appendChild(listTitle);
      postListEl.appendChild(listHeader);

      if (postsInSpace.length === 0) {
        postListEl.appendChild(renderEmptyState("📭", "No posts yet."));
      } else {
        postsInSpace.forEach(function (post) {
          postListEl.appendChild(renderPostCard(post, { showSpace: false }));
        });
      }
      mainEl.appendChild(postListEl);
    }

    layout.appendChild(sidebarEl);
    layout.appendChild(mainEl);
    wrap.appendChild(layout);
    container.appendChild(wrap);
  }

  function renderQuestions(container) {
    var wrap = el("div", "app-wrapper");
    var feed = getQuestionAndConcernFeed();
    var listEl = el("div", "post-list");
    var lh = el("div", "post-list-header");
    var lt = el("span", "post-list-title"); lt.textContent = "Q&A / Anonymous Vent";
    lh.appendChild(lt); listEl.appendChild(lh);
    if (feed.length === 0) {
      listEl.appendChild(renderEmptyState("💬", "No posts yet."));
    } else {
      feed.forEach(function (post) {
        var sn = spaces.filter(function (s) { return s.id === post.spaceId; })[0];
        listEl.appendChild(renderPostCard(post, { showSpace: true, spaceLabel: sn ? sn.name : "Space" }));
      });
    }
    wrap.appendChild(listEl);
    container.appendChild(wrap);
  }

  function renderNotifications(container) {
    var wrap = el("div", "app-wrapper");
    var card = el("section", "card");
    var header = el("div", "notif-header");
    var t = el("h2"); t.textContent = "Notifications";
    header.appendChild(t);
    if (appViewState.notifications.some(function (n) { return !n.is_read; })) {
      var markAllBtn = el("button", "ghost-button small");
      markAllBtn.textContent = "Mark all read";
      markAllBtn.addEventListener("click", function () { markAllNotificationsRead().then(render); });
      header.appendChild(markAllBtn);
    }
    card.appendChild(header);

    var notifs = appViewState.notifications;
    if (notifs.length === 0) {
      card.appendChild(renderEmptyState("🔔", "No notifications yet."));
    } else {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var todayStart = today.getTime();
      var groups = [
        { label: "Today", items: [] },
        { label: "Earlier", items: [] }
      ];
      notifs.forEach(function (n) {
        var isToday = new Date(n.created_at).getTime() >= todayStart;
        groups[isToday ? 0 : 1].items.push(n);
      });

      groups.forEach(function (group) {
        if (!group.items.length) return;
        var groupLabel = el("div", "notif-group-label");
        groupLabel.textContent = group.label;
        card.appendChild(groupLabel);

        var ul = el("ul", "notification-list");
        group.items.forEach(function (n) {
          var li = el("li", "notif-item" + (n.is_read ? "" : " notif-unread"));
          var msg = el("span", "notif-message"); msg.textContent = n.message;
          var ts = el("span", "notif-time");
          ts.textContent = timeAgo(n.created_at);
          ts.title = fmtDate(n.created_at);
          li.appendChild(msg); li.appendChild(ts);
          if (!n.is_read) {
            var readBtn = el("button", "ghost-button tiny");
            readBtn.textContent = "Mark read";
            readBtn.addEventListener("click", function () { markNotificationRead(n.id).then(render); });
            li.appendChild(readBtn);
          }
          ul.appendChild(li);
        });
        card.appendChild(ul);
      });
    }
    wrap.appendChild(card);
    container.appendChild(wrap);
  }

  function renderSettings(container) {
    var wrap = el("div", "app-wrapper");
    var card = el("section", "card");
    var t = el("h2");
    t.textContent = "Settings";
    card.appendChild(t);

    if (!userState.isAuthenticated) {
      var p = el("p", "muted");
      p.textContent = "Sign in to view your settings.";
      card.appendChild(p);
      wrap.appendChild(card);
      container.appendChild(wrap);
      return;
    }

    // --- Account ---
    var accountSection = el("div", "settings-section");
    var accountTitle = el("div", "settings-section-title");
    accountTitle.textContent = "Account";
    accountSection.appendChild(accountTitle);

    var info = el("dl", "profile-dl");
    var roleLabel = userState.role === "admin" ? "Admin" : (userState.role === "teacher" ? "Teacher" : "Student");
    var rows = [["Name", userState.name], ["Email", userState.email], ["Role", roleLabel], ["Grade", userState.grade || "—"]];
    if (userState.username) rows.splice(3, 0, ["Username", userState.username]);
    rows.forEach(function (kv) {
      var dt = document.createElement("dt");
      dt.textContent = kv[0];
      var dd = document.createElement("dd");
      dd.textContent = kv[1] || "—";
      info.appendChild(dt);
      info.appendChild(dd);
    });
    accountSection.appendChild(info);

    if (userState.role !== "admin") {
      var statusMap = {
        pending:  { label: "Pending verification", cls: "badge-pending" },
        approved: { label: "Verified",             cls: "badge-approved" },
        rejected: { label: "Rejected",             cls: "badge-rejected" }
      };
      var vs = userState.verification_status || "pending";
      var sm = statusMap[vs] || statusMap["pending"];
      var badge = el("span", "verification-badge " + sm.cls);
      badge.textContent = sm.label;
      accountSection.appendChild(badge);
    }
    card.appendChild(accountSection);

    // --- Appearance ---
    var appearanceSection = el("div", "settings-section");
    var appearanceTitle = el("div", "settings-section-title");
    appearanceTitle.textContent = "Appearance";
    appearanceSection.appendChild(appearanceTitle);

    var dark = isDarkActive();
    var switchRow = el("label", "switch-row");
    var switchLabelText = el("span");
    switchLabelText.textContent = "Dark mode";
    var switchWrap = el("span", "switch");
    var switchInput = document.createElement("input");
    switchInput.type = "checkbox";
    switchInput.checked = dark;
    switchInput.addEventListener("change", function () {
      setTheme(switchInput.checked ? "dark" : "light");
      render();
    });
    var switchTrack = el("span", "switch-track");
    var switchThumb = el("span", "switch-thumb");
    switchTrack.appendChild(switchThumb);
    switchWrap.appendChild(switchInput);
    switchWrap.appendChild(switchTrack);
    switchRow.appendChild(switchLabelText);
    switchRow.appendChild(switchWrap);
    appearanceSection.appendChild(switchRow);

    if (getStoredTheme()) {
      var resetBtn = el("button", "ghost-button tiny");
      resetBtn.type = "button";
      resetBtn.textContent = "Match device setting";
      resetBtn.style.marginTop = "0.5rem";
      resetBtn.addEventListener("click", function () {
        clearThemeOverride();
        render();
      });
      appearanceSection.appendChild(resetBtn);
    }

    var accentLabel = el("p", "muted");
    accentLabel.style.margin = "1rem 0 0.5rem";
    accentLabel.textContent = "Accent color";
    appearanceSection.appendChild(accentLabel);

    var currentAccent = getStoredAccent();
    var swatchRow = el("div", "accent-swatch-row");
    Object.keys(ACCENT_PRESETS).forEach(function (id) {
      var preset = ACCENT_PRESETS[id];
      var swatch = el("button", "accent-swatch" + (id === currentAccent ? " active" : ""));
      swatch.type = "button";
      swatch.style.background = preset.light.primary;
      swatch.setAttribute("aria-label", preset.label);
      swatch.title = preset.label;
      swatch.addEventListener("click", function () {
        setAccent(id);
        render();
      });
      swatchRow.appendChild(swatch);
    });
    appearanceSection.appendChild(swatchRow);

    card.appendChild(appearanceSection);

    // --- Sign out ---
    var lb = el("button", "ghost-button");
    lb.textContent = "Sign out";
    lb.style.marginTop = "0.5rem";
    lb.addEventListener("click", handleLogoutClick);
    card.appendChild(lb);

    wrap.appendChild(card);
    container.appendChild(wrap);
  }

  function renderCreateBoardForm() {
    var wrap = el("div", "composer");
    var title = el("p", "composer-title");
    title.textContent = "Create a new board";
    wrap.appendChild(title);

    var form = el("form", "form-grid");
    form.noValidate = true;

    var nameField = el("div", "form-field");
    nameField.innerHTML = '<label for="board-name">Board name</label><input id="board-name" name="name" type="text" placeholder="e.g. Grade 10 or Chess Club" />';
    form.appendChild(nameField);

    var typeField = el("div", "form-field");
    typeField.innerHTML = '<label for="board-type">Type</label><select id="board-type" name="type"><option value="class">Class</option><option value="subject">Subject</option><option value="club">Club</option></select>';
    form.appendChild(typeField);

    var gradeField = el("div", "form-field");
    gradeField.innerHTML = '<label for="board-grade">Grade</label><select id="board-grade" name="grade"><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select>';
    form.appendChild(gradeField);

    var typeSelect = typeField.querySelector("select");
    var gradeSelect = gradeField.querySelector("select");
    function syncGradeVisibility() {
      gradeField.style.display = typeSelect.value === "club" ? "none" : "";
    }
    typeSelect.addEventListener("change", syncGradeVisibility);
    syncGradeVisibility();

    var catField = el("div", "form-field");
    var catLabel = document.createElement("label");
    catLabel.textContent = "Categories";
    catField.appendChild(catLabel);
    var catList = el("div", "category-list");
    catField.appendChild(catList);

    function addCategoryRow(value) {
      var row = el("div", "category-row");
      var input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.placeholder = "Category name";
      var removeBtn = el("button", "ghost-button tiny");
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", function () { catList.removeChild(row); });
      row.appendChild(input);
      row.appendChild(removeBtn);
      catList.appendChild(row);
    }
    ["Announcements & Assignments", "Questions", "Anonymous / Vent"].forEach(function (s) { addCategoryRow(s); });

    var addCatBtn = el("button", "ghost-button tiny");
    addCatBtn.type = "button";
    addCatBtn.textContent = "+ Add category";
    addCatBtn.style.marginTop = "0.4rem";
    addCatBtn.addEventListener("click", function () { addCategoryRow(""); });
    catField.appendChild(addCatBtn);
    form.appendChild(catField);

    var actions = el("div", "form-actions");
    var submitBtn = el("button", "primary-button");
    submitBtn.type = "submit";
    submitBtn.textContent = "Create board";
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      clearFormError(form);
      var name = form.elements["name"].value.trim();
      var type = typeSelect.value;
      var grade = gradeSelect.value;
      var sections = [];
      catList.querySelectorAll("input").forEach(function (inp) {
        var v = inp.value.trim();
        if (v) sections.push(v);
      });

      if (!name) {
        markFieldError(form.elements["name"]);
        showFormError(form, "Board name is required.");
        return;
      }
      if (!sections.length) {
        showFormError(form, "Add at least one category.");
        return;
      }

      submitBtn.disabled = true;
      apiCall("/admin/spaces", {
        method: "POST",
        body: { name: name, type: type, grade: type === "club" ? null : grade, sections: sections }
      }).then(function () {
        appViewState.showCreateBoardForm = false;
        render();
      }).catch(function (e) {
        submitBtn.disabled = false;
        showFormError(form, e.message || "Failed to create board");
      });
    });
    attachFieldErrorClearing(form);

    wrap.appendChild(form);
    return wrap;
  }

  function renderAdmin(container) {
    var wrap = el("div", "app-wrapper");
    var card = el("section", "card");

    // Admin sub-tabs
    if (!appViewState.adminTab) appViewState.adminTab = "users";
    var tabBar = el("div", "admin-tabs");
    [{ id: "users", label: "Users" }, { id: "posts", label: "Posts" }, { id: "spaces", label: "Space Assignment" }].forEach(function (t) {
      var btn = el("button", "admin-tab-btn" + (appViewState.adminTab === t.id ? " active" : ""));
      btn.textContent = t.label;
      btn.addEventListener("click", function () { appViewState.adminTab = t.id; render(); });
      tabBar.appendChild(btn);
    });
    card.appendChild(tabBar);

    if (appViewState.adminTab === "users") {
      var filterWrap = el("div", "admin-filter");
      ["all", "pending", "approved", "rejected"].forEach(function (status) {
        var btn = el("button", (appViewState.adminFilter === status ? "primary-button" : "ghost-button") + " small");
        btn.textContent = { all: "All", pending: "Pending", approved: "Approved", rejected: "Rejected" }[status];
        btn.addEventListener("click", function () {
          appViewState.adminFilter = status;
          loadAdminUsers().then(render);
        });
        filterWrap.appendChild(btn);
      });
      card.appendChild(filterWrap);

      var userTbody = null;
      var userEmptyMsg = null;
      function applyUserSearchFilter() {
        var q = (appViewState.adminUserSearch || "").trim().toLowerCase();
        var visibleCount = 0;
        if (userTbody) {
          Array.prototype.forEach.call(userTbody.rows, function (row) {
            var match = !q || (row.getAttribute("data-search") || "").indexOf(q) !== -1;
            row.style.display = match ? "" : "none";
            if (match) visibleCount++;
          });
        }
        if (userEmptyMsg) userEmptyMsg.style.display = (q && visibleCount === 0) ? "" : "none";
      }

      var userSearchInput = document.createElement("input");
      userSearchInput.type = "text";
      userSearchInput.className = "admin-search-input";
      userSearchInput.placeholder = "Search by name, email, role…";
      userSearchInput.value = appViewState.adminUserSearch || "";
      userSearchInput.addEventListener("input", function () {
        appViewState.adminUserSearch = userSearchInput.value;
        applyUserSearchFilter();
      });
      card.appendChild(userSearchInput);

      var tableWrap = el("div", "admin-table-wrap");
      var loading = renderLoadingIndicator();
      tableWrap.appendChild(loading);
      card.appendChild(tableWrap);

      loadAdminUsers().then(function () {
        while (tableWrap.firstChild) tableWrap.removeChild(tableWrap.firstChild);
        if (!appViewState.adminUsers.length) {
          var emp = el("p", "muted"); emp.textContent = "No users found."; tableWrap.appendChild(emp); return;
        }
        var table = el("table", "admin-table");
        table.innerHTML = "<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Grade</th><th>Method</th><th>Status</th><th>Actions</th></tr></thead>";
        var tbody = document.createElement("tbody");
        appViewState.adminUsers.forEach(function (u) {
          var tr = document.createElement("tr");
          tr.id = "admin-user-row-" + u.id;
          tr.setAttribute("data-search", [u.name, u.email, u.role, u.grade, u.verification_method, u.verification_status].join(" ").toLowerCase());
          var statusCls = u.verification_status === "approved" ? "badge-approved" : (u.verification_status === "rejected" ? "badge-rejected" : "badge-pending");
          tr.innerHTML = "<td>" + esc(u.name) + "</td><td>" + esc(u.email) + "</td><td></td><td></td><td>" + esc(prettyVerificationMethod(u.verification_method)) + "</td><td><span class='verification-badge " + statusCls + "'>" + esc(u.verification_status) + "</span></td><td></td>";

          var roleSelect = document.createElement("select");
          roleSelect.className = "admin-inline-select";
          ["student", "teacher", "admin"].forEach(function (r) {
            var opt = document.createElement("option");
            opt.value = r;
            opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
            if (r === u.role) opt.selected = true;
            roleSelect.appendChild(opt);
          });
          tr.cells[2].appendChild(roleSelect);

          var gradeSelect = document.createElement("select");
          gradeSelect.className = "admin-inline-select";
          ["", "9", "10", "11", "12"].forEach(function (g) {
            var opt = document.createElement("option");
            opt.value = g;
            opt.textContent = g || "—";
            if ((u.grade || "") === g) opt.selected = true;
            gradeSelect.appendChild(opt);
          });
          tr.cells[3].appendChild(gradeSelect);

          var ac = tr.cells[6];
          var saveBtn = el("button", "ghost-button admin-action-btn");
          saveBtn.textContent = "Save";
          saveBtn.addEventListener("click", function () {
            handleAdminEditUser(u.id, roleSelect.value, gradeSelect.value, tr);
          });
          ac.appendChild(saveBtn);

          if (u.verification_status !== "approved") {
            var ab = el("button", "primary-button admin-action-btn"); ab.textContent = "Approve";
            ab.addEventListener("click", function () { handleAdminVerify(u.id, "approved", tr); }); ac.appendChild(ab);
          }
          if (u.verification_status !== "rejected") {
            var rb = el("button", "ghost-button admin-action-btn"); rb.textContent = "Reject";
            rb.addEventListener("click", function () { handleAdminVerify(u.id, "rejected", tr); }); ac.appendChild(rb);
          }
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableWrap.appendChild(table);
        userEmptyMsg = el("p", "muted");
        userEmptyMsg.style.padding = "0.75rem 0 0";
        userEmptyMsg.style.display = "none";
        userEmptyMsg.textContent = "No users match your search.";
        tableWrap.appendChild(userEmptyMsg);
        userTbody = tbody;
        applyUserSearchFilter();
      });
    }

    if (appViewState.adminTab === "posts") {
      var postTbody = null;
      var postEmptyMsg = null;
      function applyPostSearchFilter() {
        var q = (appViewState.adminPostSearch || "").trim().toLowerCase();
        var visibleCount = 0;
        if (postTbody) {
          Array.prototype.forEach.call(postTbody.rows, function (row) {
            var match = !q || (row.getAttribute("data-search") || "").indexOf(q) !== -1;
            row.style.display = match ? "" : "none";
            if (match) visibleCount++;
          });
        }
        if (postEmptyMsg) postEmptyMsg.style.display = (q && visibleCount === 0) ? "" : "none";
      }

      var postSearchInput = document.createElement("input");
      postSearchInput.type = "text";
      postSearchInput.className = "admin-search-input";
      postSearchInput.placeholder = "Search by title, author, space, section…";
      postSearchInput.value = appViewState.adminPostSearch || "";
      postSearchInput.addEventListener("input", function () {
        appViewState.adminPostSearch = postSearchInput.value;
        applyPostSearchFilter();
      });
      card.appendChild(postSearchInput);

      var postsWrap = el("div", "admin-table-wrap");
      var postsLoading = renderLoadingIndicator();
      postsWrap.appendChild(postsLoading);
      card.appendChild(postsWrap);

      apiCall("/admin/posts?limit=100").then(function (data) {
        while (postsWrap.firstChild) postsWrap.removeChild(postsWrap.firstChild);
        if (!data.length) { var ep = el("p", "muted"); ep.textContent = "No posts found."; postsWrap.appendChild(ep); return; }
        var tbl = el("table", "admin-table");
        tbl.innerHTML = "<thead><tr><th>#</th><th>Space</th><th>Section</th><th>Title</th><th>Author (real)</th><th>IP</th><th>Anon</th><th>Date</th><th>Actions</th></tr></thead>";
        var tb = document.createElement("tbody");
        data.forEach(function (p) {
          var tr = document.createElement("tr");
          tr.setAttribute("data-search", [p.id, p.space_id, p.section, p.title, p.author_name, p.author_ip].join(" ").toLowerCase());
          tr.innerHTML = "<td>" + p.id + "</td><td>" + esc(p.space_id) + "</td><td>" + esc(p.section.split(" ")[0]) + "</td><td>" + esc(p.title.slice(0, 30)) + "</td><td>" + esc(p.author_name) + "</td><td>" + esc(p.author_ip || "—") + "</td><td>" + (p.is_anonymous ? "✓" : "") + "</td><td>" + fmtDate(p.created_at) + "</td><td></td>";
          var dc = tr.cells[8];
          var delBtn = el("button", "ghost-button admin-action-btn"); delBtn.textContent = "Delete";
          delBtn.addEventListener("click", function () {
            if (!confirm("Delete this post?")) return;
            apiCall("/admin/posts/" + p.id, { method: "DELETE" }).then(function () {
              tr.remove();
            }).catch(function (e) { alert(e.message || "Delete failed"); });
          });
          dc.appendChild(delBtn);
          tb.appendChild(tr);
        });
        tbl.appendChild(tb);
        postsWrap.appendChild(tbl);
        postEmptyMsg = el("p", "muted");
        postEmptyMsg.style.padding = "0.75rem 0 0";
        postEmptyMsg.style.display = "none";
        postEmptyMsg.textContent = "No posts match your search.";
        postsWrap.appendChild(postEmptyMsg);
        postTbody = tb;
        applyPostSearchFilter();
      }).catch(function () {
        while (postsWrap.firstChild) postsWrap.removeChild(postsWrap.firstChild);
        var ep2 = el("p", "muted"); ep2.textContent = "Failed to load"; postsWrap.appendChild(ep2);
      });
    }

    if (appViewState.adminTab === "spaces") {
      var createBtnRow = el("div");
      createBtnRow.style.marginBottom = "0.75rem";
      var createBoardBtn = el("button", "primary-button small");
      createBoardBtn.type = "button";
      createBoardBtn.textContent = appViewState.showCreateBoardForm ? "Cancel" : "+ Create board";
      createBoardBtn.addEventListener("click", function () {
        appViewState.showCreateBoardForm = !appViewState.showCreateBoardForm;
        render();
      });
      createBtnRow.appendChild(createBoardBtn);
      card.appendChild(createBtnRow);

      if (appViewState.showCreateBoardForm) {
        card.appendChild(renderCreateBoardForm());
      }

      var spacesWrap = el("div", "admin-table-wrap");
      var spacesLoading = renderLoadingIndicator();
      spacesWrap.appendChild(spacesLoading);
      card.appendChild(spacesWrap);

      Promise.all([
        apiCall("/admin/spaces"),
        apiCall("/admin/users?status=all")
      ]).then(function (results) {
        var spaceData = results[0];
        var allUsers = results[1].filter(function (u) { return u.role === "teacher"; });
        while (spacesWrap.firstChild) spacesWrap.removeChild(spacesWrap.firstChild);

        spaceData.forEach(function (sp) {
          var row = el("div", "card space-assign-card");

          var header = el("div", "space-assign-header");
          var rowTitle = el("strong");
          rowTitle.textContent = sp.name;
          var typeBadge = el("span", "space-type-badge");
          typeBadge.textContent = sp.type;
          header.appendChild(rowTitle);
          header.appendChild(typeBadge);
          row.appendChild(header);

          var chipRow = el("div", "teacher-chip-row");
          if (sp.teachers && sp.teachers.length) {
            sp.teachers.forEach(function (t) {
              var chip = el("span", "teacher-chip");
              var chipLabel = document.createElement("span");
              chipLabel.textContent = t.name;
              var removeBtn = el("button", "teacher-chip-remove");
              removeBtn.type = "button";
              removeBtn.textContent = "✕";
              removeBtn.setAttribute("aria-label", "Remove " + t.name);
              removeBtn.addEventListener("click", function () {
                apiCall("/admin/spaces/" + sp.id + "/teachers/" + t.id, { method: "DELETE" }).then(function () {
                  appViewState.adminTab = "spaces"; render();
                }).catch(function (e) { alert(e.message || "Remove failed"); });
              });
              chip.appendChild(chipLabel);
              chip.appendChild(removeBtn);
              chipRow.appendChild(chip);
            });
          } else {
            var noTeachers = el("span", "muted");
            noTeachers.textContent = "No teachers assigned";
            chipRow.appendChild(noTeachers);
          }
          row.appendChild(chipRow);

          var assignRow = el("div", "teacher-assign-row");
          var sel = document.createElement("select");
          sel.className = "admin-inline-select";
          var opt0 = document.createElement("option"); opt0.value = ""; opt0.textContent = "Select a teacher…"; sel.appendChild(opt0);
          allUsers.forEach(function (u) {
            var opt = document.createElement("option"); opt.value = u.id; opt.textContent = u.name + " (" + u.email + ")"; sel.appendChild(opt);
          });
          var assignBtn = el("button", "primary-button small"); assignBtn.textContent = "Assign";
          assignBtn.addEventListener("click", function () {
            if (!sel.value) return;
            apiCall("/admin/spaces/" + sp.id + "/teachers/" + sel.value, { method: "PUT" }).then(function () {
              appViewState.adminTab = "spaces"; render();
            }).catch(function (e) { alert(e.message || "Assignment failed"); });
          });
          assignRow.appendChild(sel);
          assignRow.appendChild(assignBtn);
          row.appendChild(assignRow);

          spacesWrap.appendChild(row);
        });
      }).catch(function () {
        while (spacesWrap.firstChild) spacesWrap.removeChild(spacesWrap.firstChild);
        var ep3 = el("p", "muted"); ep3.textContent = "Failed to load"; spacesWrap.appendChild(ep3);
      });
    }

    wrap.appendChild(card);
    container.appendChild(wrap);
  }

  function loadAdminUsers() {
    var filter = appViewState.adminFilter || "all";
    return apiCall("/admin/users?status=" + encodeURIComponent(filter)).then(function (users) {
      appViewState.adminUsers = users;
    }).catch(function () { appViewState.adminUsers = []; });
  }

  function handleAdminVerify(userId, status, tr) {
    // Disable all action buttons in this row while request is in flight
    var btns = tr.cells[6].querySelectorAll("button");
    btns.forEach(function (b) { b.disabled = true; });

    apiCall("/admin/users/" + userId + "/verify", { method: "PATCH", body: { status: status } })
      .then(function () {
        // Update just this row's status cell and action cell
        var statusCls = status === "approved" ? "badge-approved" : "badge-rejected";
        tr.cells[5].innerHTML = '<span class="verification-badge ' + statusCls + '">' + esc(status) + "</span>";
        var actionCell = tr.cells[6];
        while (actionCell.firstChild) actionCell.removeChild(actionCell.firstChild);
        var roleSel = tr.cells[2].querySelector("select");
        var gradeSel = tr.cells[3].querySelector("select");
        var saveBtn = el("button", "ghost-button admin-action-btn");
        saveBtn.textContent = "Save";
        saveBtn.addEventListener("click", function () {
          handleAdminEditUser(userId, roleSel.value, gradeSel.value, tr);
        });
        actionCell.appendChild(saveBtn);
        if (status !== "approved") {
          var approveBtn = el("button", "primary-button admin-action-btn");
          approveBtn.textContent = "Approve";
          approveBtn.addEventListener("click", function () { handleAdminVerify(userId, "approved", tr); });
          actionCell.appendChild(approveBtn);
        }
        if (status !== "rejected") {
          var rejectBtn = el("button", "ghost-button admin-action-btn");
          rejectBtn.textContent = "Reject";
          rejectBtn.addEventListener("click", function () { handleAdminVerify(userId, "rejected", tr); });
          actionCell.appendChild(rejectBtn);
        }
        // Update cached list too
        if (appViewState.adminUsers) {
          var u = appViewState.adminUsers.filter(function (u) { return u.id === userId; })[0];
          if (u) u.verification_status = status;
        }
      })
      .catch(function (e) {
        btns.forEach(function (b) { b.disabled = false; });
        alert(e.message || "Failed to update status");
      });
  }

  function handleAdminEditUser(userId, role, grade, tr) {
    var btns = tr.cells[6].querySelectorAll("button");
    btns.forEach(function (b) { b.disabled = true; });

    apiCall("/admin/users/" + userId, { method: "PATCH", body: { role: role, grade: grade || null } })
      .then(function () {
        btns.forEach(function (b) { b.disabled = false; });
        if (appViewState.adminUsers) {
          var u = appViewState.adminUsers.filter(function (u) { return u.id === userId; })[0];
          if (u) { u.role = role; u.grade = grade || null; }
        }
      })
      .catch(function (e) {
        btns.forEach(function (b) { b.disabled = false; });
        alert(e.message || "Failed to update user");
      });
  }

  function render() {
    clearRoot();
    var page = el("div");

    if (!userState.isAuthenticated) {
      renderNavbar(page);
      renderLogin(page);
    } else {
      renderNavbar(page);
      var content = el("main");
      switch (appViewState.activeTab) {
        case "home":          renderHome(content); break;
        case "spaces":        renderSpaces(content); break;
        case "questions":     renderQuestions(content); break;
        case "notifications": renderNotifications(content); break;
        case "settings":      renderSettings(content); break;
        case "admin":         renderAdmin(content); break;
        default:              renderHome(content);
      }
      page.appendChild(content);
    }
    appRoot.appendChild(page);
  }

  applyAccent(getStoredAccent());

  restoreSession().then(function (restored) {
    render();
  }).catch(function () {
    render();
  });
})();
