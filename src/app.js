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
    var token = localStorage.getItem("kobe_token");
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
    var token = localStorage.getItem("kobe_token");
    if (!token) return Promise.resolve(false);
    return apiCall("/auth/me").then(function (user) {
      loginFromApiUser(user);
      return Promise.all([loadSpaces(), loadFeed()]);
    }).then(function () {
      startNotifPolling();
      return true;
    }).catch(function () {
      localStorage.removeItem("kobe_token");
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
        return Object.assign({ sections: ALL_SECTIONS }, s);
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
    localStorage.removeItem("kobe_token");
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
    msalInstance: null,
    useDevForm: false,
    authScreen: "choose",
    authProvider: null,
    adminFilter: "all",
    adminUsers: [],
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
    appViewState.activeSpaceId = spaceId;
    appViewState.activeSection = "Announcements & Assignments";
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

  function handleLoginSubmit(ev) {
    ev.preventDefault();
    var f = ev.target;
    var login = (f.login && f.login.value || f.email && f.email.value || "").trim();
    var password = f.password && f.password.value;

    if (!login || !password) {
      alert("Email or username and password required.");
      return;
    }

    apiCall("/auth/login", { method: "POST", body: { login: login, password: password } })
      .then(function (res) {
        localStorage.setItem("kobe_token", res.token);
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
        alert(e.message || "Login failed");
      });
  }

  function handleSignupSubmit(ev) {
    ev.preventDefault();
    var f = ev.target;
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
      alert("Please fill in all required fields.");
      return;
    }

    if (verification_method === "student_id" && !student_id) {
      alert("Please upload your student ID photo.");
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
      headers: { "Authorization": localStorage.getItem("kobe_token") ? "Bearer " + localStorage.getItem("kobe_token") : "" },
      body: body
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || "Signup failed"); });
        return r.json();
      })
      .then(function (res) {
        localStorage.setItem("kobe_token", res.token);
        loginFromApiUser(res.user);
        appViewState.authScreen = "choose";
        appViewState.activeTab = "home";
        if (res.message) pushNotification(res.message);
        return Promise.all([loadSpaces(), loadFeed()]);
      }).then(function () {
        var ds = getSpacesForUser()[0];
        appViewState.activeSpaceId = ds ? ds.id : null;
        render();
      })
      .catch(function (e) {
        alert(e.message || "Signup failed");
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
          localStorage.setItem("kobe_token", res.token);
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

    var role = f.role && f.role.value;
    var grade = f.grade && f.grade.value;
    var username = (f.username && f.username.value || "").trim();
    var school_email = (f.school_email && f.school_email.value || "").trim();
    var verification_method = f.verification_method && f.verification_method.value;
    var student_id = f.student_id && f.student_id.files && f.student_id.files[0];

    if (!role || !grade || !verification_method) {
      alert("Please fill in role, grade, and verification method.");
      return;
    }
    if (verification_method === "student_id" && !student_id) {
      alert("Please upload your student ID photo.");
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
        localStorage.setItem("kobe_token", res.token);
        loginFromApiUser(res.user);
        appViewState.pendingMsAccount = null;
        appViewState.authScreen = "choose";
        appViewState.activeTab = "home";
        if (res.message) pushNotification(res.message);
        return Promise.all([loadSpaces(), loadFeed()]);
      }).then(function () {
        var ds = getSpacesForUser()[0];
        appViewState.activeSpaceId = ds ? ds.id : null;
        startNotifPolling();
        render();
      })
      .catch(function (e) {
        alert(e.message || "Signup failed");
      });
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

  function renderPostCard(post, opts) {
    // opts: { showSpace: bool, spaceLabel: string }
    opts = opts || {};
    var pc = el("article", "post-card");
    if (opts.showSpace) {
      var meta = el("div", "post-meta");
      meta.textContent = (opts.spaceLabel || "Space") + " \xB7 " + post.section;
      pc.appendChild(meta);
    } else {
      var meta2 = el("div", "post-meta");
      meta2.textContent = post.section;
      pc.appendChild(meta2);
    }
    var pt = el("h3");
    pt.textContent = post.title;
    var ex = el("p", "post-excerpt");
    ex.textContent = post.content.length > 100 ? post.content.slice(0, 100) + "..." : post.content;
    var au = el("div", "post-author");
    au.textContent = post.authorName + " \xB7 " + new Date(post.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    pc.appendChild(pt);
    pc.appendChild(ex);
    pc.appendChild(au);

    // Comment toggle button
    var commentComments = appViewState.commentsByPost[post.id] || [];
    var expanded = !!appViewState.expandedComments[post.id];
    var toggleBtn = el("button", "comment-toggle-btn");
    toggleBtn.textContent = "\uD83D\uDCAC " + commentComments.length + " comment" + (commentComments.length !== 1 ? "s" : "");
    toggleBtn.addEventListener("click", function () {
      appViewState.expandedComments[post.id] = !appViewState.expandedComments[post.id];
      if (appViewState.expandedComments[post.id] && !appViewState.commentsByPost[post.id]) {
        loadComments(post.id).then(function () { render(); });
        return;
      }
      render();
    });
    pc.appendChild(toggleBtn);

    if (expanded) {
      var commentSection = el("div", "comment-section");

      if (commentComments.length > 0) {
        commentComments.forEach(function (c) {
          var ci = el("div", "comment-item");
          var ca = el("span", "comment-author");
          ca.textContent = c.author_name + " \xB7 ";
          var ct = el("span", "comment-text");
          ct.textContent = c.content;
          var cd = el("span", "comment-date");
          cd.textContent = " \xB7 " + new Date(c.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          ci.appendChild(ca);
          ci.appendChild(ct);
          ci.appendChild(cd);
          commentSection.appendChild(ci);
        });
      } else {
        var noC = el("p", "muted");
        noC.style.fontSize = "0.85rem";
        noC.textContent = "No comments yet.";
        commentSection.appendChild(noC);
      }

      // Comment form
      if (userState.isAuthenticated) {
        var cForm = el("form", "comment-form");
        var isAnonSection = post.section === "Anonymous / Vent";
        cForm.innerHTML =
          '<textarea name="content" rows="2" placeholder="Write a comment\u2026" required></textarea>' +
          (isAnonSection ? '<label class="checkbox-inline"><input type="checkbox" name="isAnonymous" checked /> Anonymous</label>' : '') +
          '<button type="submit" class="primary-button small">Reply</button>';
        cForm.addEventListener("submit", function (ev) {
          ev.preventDefault();
          var content = (cForm.content && cForm.content.value || "").trim();
          var isAnon = cForm.isAnonymous ? cForm.isAnonymous.checked : false;
          if (!content) return;
          var btn = cForm.querySelector("button[type=submit]");
          btn.disabled = true;
          submitComment(post.id, content, isAnon, function () {
            cForm.reset();
            btn.disabled = false;
            render();
          });
        });
        commentSection.appendChild(cForm);
      }

      pc.appendChild(commentSection);
    }

    return pc;
  }

  function clearRoot() {
    while (appRoot.firstChild) appRoot.removeChild(appRoot.firstChild);
  }

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function renderHeader(container) {
    var header = el("header", "app-header");
    var title = el("div", "app-title");
    title.textContent = "School-Only SNS";
    var subtitle = el("div", "app-subtitle");
    subtitle.textContent = "A quiet space for your class, subjects & clubs";
    var right = el("div", "app-header-right");

    if (userState.isAuthenticated) {
      var userInfo = el("div", "app-user-info");
      var roleLabel = userState.role === "admin" ? "Admin" : (userState.role === "teacher" ? "Teacher" : "Student");
      userInfo.textContent = userState.name + " (" + roleLabel + (userState.grade ? ", Grade " + userState.grade : "") + ")";
      var logoutBtn = el("button", "ghost-button");
      logoutBtn.textContent = "Sign out";
      logoutBtn.addEventListener("click", handleLogoutClick);
      right.appendChild(userInfo);
      right.appendChild(logoutBtn);
    } else {
      var hint = el("div", "app-header-hint");
      hint.textContent = "Sign in with your school account (M365)";
      right.appendChild(hint);
    }

    header.appendChild(title);
    header.appendChild(subtitle);
    header.appendChild(right);
    container.appendChild(header);

    if (userState.isAuthenticated && userState.verification_status === "pending") {
      var banner = el("div", "verification-pending-banner");
      banner.textContent = "School verification pending. Contact mkim28@cranbrook.edu to get approved.";
      container.appendChild(banner);
    }
  }

  function renderTabs(container) {
    var nav = el("nav", "tab-nav");
    var tabs = [{ id: "home", label: "Home" }, { id: "spaces", label: "Spaces" }, { id: "questions", label: "Questions & Concerns" }, { id: "notifications", label: "Notifications" }, { id: "profile", label: "Profile" }];
    if (userState.role === "admin") tabs.push({ id: "admin", label: "Admin" });
    tabs.forEach(function (tab) {
      var btn = el("button", "tab-button" + (appViewState.activeTab === tab.id ? " active" : ""));
      btn.textContent = tab.label;
      if (tab.id === "notifications" && appViewState.unreadCount > 0) {
        var badge = el("span", "notif-badge");
        badge.textContent = String(appViewState.unreadCount);
        btn.appendChild(badge);
      }
      btn.addEventListener("click", function () { setActiveTab(tab.id); });
      nav.appendChild(btn);
    });
    container.appendChild(nav);
  }

  function esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function renderLogin(container) {
    var pending = appViewState.pendingMsAccount;
    var screen = appViewState.authScreen;
    var ac = window.AUTH_CONFIG || {};
    var adminEmail = ac.adminEmail || "mkim28@cranbrook.edu";
    var msCfg = window.MSAL_CONFIG;
    var msalReady = msCfg && msCfg.clientId && msCfg.clientId !== "YOUR_CLIENT_ID" && (typeof window.msal !== "undefined" || typeof msal !== "undefined");

    var card = el("section", "card login-card");

    if (pending && pending.token) {
      var title = el("h2");
      title.textContent = "Complete your profile";
      var desc = el("p", "muted");
      desc.textContent = "Signed in with Microsoft. Fill in below and choose school verification.";
      var form = el("form", "form-grid");
      form.innerHTML = '<div class="form-field"><label>Name</label><input type="text" value="' + esc(pending.name) + '" readonly disabled /></div>' +
        '<div class="form-field"><label>Email</label><input type="text" value="' + esc(pending.email) + '" readonly disabled /></div>' +
        '<div class="form-field"><label for="username">Username (optional)</label><input id="username" name="username" type="text" placeholder="Login with email or username" /></div>' +
        '<div class="form-field"><label for="school_email">School email (optional)</label><input id="school_email" name="school_email" type="email" /></div>' +
        '<div class="form-field"><label for="role">Role</label><select id="role" name="role" required><option value="">Select</option><option value="student">Student</option><option value="teacher">Teacher</option></select></div>' +
        '<div class="form-field"><label for="grade">Grade</label><select id="grade" name="grade" required><option value="">Select</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select></div>' +
        '<div class="form-field"><label>School verification</label><label class="radio-option"><input type="radio" name="verification_method" value="manual" checked /> Manual: Contact ' + esc(adminEmail) + '</label><label class="radio-option"><input type="radio" name="verification_method" value="student_id" /> Upload student ID</label><input type="file" name="student_id" accept="image/*" /></div>' +
        '<div class="form-actions"><button type="submit" class="primary-button">Continue</button><button type="button" class="ghost-button" id="ms-back-btn">Use different account</button></div>';
      form.addEventListener("submit", handleCompleteProfileSubmit);
      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(form);
      container.appendChild(card);
      setTimeout(function () {
        var backBtn = document.getElementById("ms-back-btn");
        if (backBtn) backBtn.addEventListener("click", function () { appViewState.pendingMsAccount = null; render(); });
      }, 0);
      return;
    }

    if (screen === "choose") {
      var t = el("h2");
      t.textContent = "School-Only SNS";
      var d = el("p", "muted");
      d.textContent = "Log in or sign up to join your class spaces.";
      var logBtn = el("button", "primary-button");
      logBtn.textContent = "Log in";
      logBtn.style.marginRight = "0.5rem";
      logBtn.addEventListener("click", function () { appViewState.authScreen = "login"; render(); });
      var signBtn = el("button", "ghost-button");
      signBtn.textContent = "Sign up";
      signBtn.addEventListener("click", function () { appViewState.authScreen = "signup"; render(); });
      card.appendChild(t);
      card.appendChild(d);
      var btnWrap = el("div");
      btnWrap.appendChild(logBtn);
      btnWrap.appendChild(signBtn);
      card.appendChild(btnWrap);
      container.appendChild(card);
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
      var form = el("form", "form-grid");
      form.innerHTML = '<div class="form-field"><label>Email or username</label><input name="login" type="text" placeholder="Email or username" required /></div>' +
        '<div class="form-field"><label>Password</label><input name="password" type="password" required /></div>' +
        '<div class="form-actions"><button type="submit" class="primary-button">Sign in</button></div>';
      form.addEventListener("submit", handleLoginSubmit);
      card.appendChild(back);
      card.appendChild(t2);
      card.appendChild(form);
      if (msalReady) {
        var msBtn = el("button", "primary-button ms-signin-btn");
        msBtn.type = "button";
        msBtn.innerHTML = '<span class="ms-icon"></span> Sign in with Microsoft';
        msBtn.addEventListener("click", handleMicrosoftLogin);
        card.appendChild(msBtn);
      }
      container.appendChild(card);
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
      if (msalReady) {
        var msSignup = el("button", "primary-button ms-signin-btn");
        msSignup.type = "button";
        msSignup.textContent = "Sign up with Microsoft";
        msSignup.addEventListener("click", handleMicrosoftLogin);
        card.appendChild(msSignup);
        var orP = el("p", "muted");
        orP.textContent = "Or with email:";
        card.appendChild(orP);
      }
      var signupForm = el("form", "form-grid");
      signupForm.innerHTML = '<div class="form-field"><label>Email</label><input name="email" type="email" required /></div>' +
        '<div class="form-field"><label>Username (optional)</label><input name="username" type="text" placeholder="Login with email or username" /></div>' +
        '<div class="form-field"><label>Password</label><input name="password" type="password" required /></div>' +
        '<div class="form-field"><label>Name</label><input name="name" required /></div>' +
        '<div class="form-field"><label>School email (optional)</label><input name="school_email" type="email" /></div>' +
        '<div class="form-field"><label>Role</label><select name="role" required><option value="">Select</option><option value="student">Student</option><option value="teacher">Teacher</option></select></div>' +
        '<div class="form-field"><label>Grade</label><select name="grade" required><option value="">Select</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select></div>' +
        '<div class="form-field"><label>School verification</label><label class="radio-option"><input type="radio" name="verification_method" value="manual" checked /> Manual: Contact ' + esc(adminEmail) + '</label><label class="radio-option"><input type="radio" name="verification_method" value="student_id" /> Upload student ID</label><input type="file" name="student_id" accept="image/*" /></div>' +
        '<div class="form-actions"><button type="submit" class="primary-button">Sign up</button></div>';
      signupForm.addEventListener("submit", handleSignupSubmit);
      card.appendChild(signupForm);
      container.appendChild(card);
    }
  }

  function renderHome(container) {
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
      var fp = el("p", "muted");
      fp.textContent = "No posts yet. Be the first to post.";
      feedCard.appendChild(fp);
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
    container.appendChild(layout);
  }

  function renderSpaces(container) {
    var layout = el("div", "spaces-layout");
    var sidebar = el("aside", "spaces-sidebar");
    var content = el("div", "spaces-content");

    var userSpaces = getSpacesForUser();
    var h2 = el("h2");
    h2.textContent = "Spaces";
    sidebar.appendChild(h2);
    var list = el("div", "space-list-vertical");
    var spacesToUse = userSpaces.length ? userSpaces : spaces;
    if (!appViewState.activeSpaceId && spacesToUse.length) appViewState.activeSpaceId = spacesToUse[0].id;

    spacesToUse.forEach(function (space) {
      var it = el("button", "space-item" + (space.id === appViewState.activeSpaceId ? " active" : ""));
      it.textContent = space.name;
      it.addEventListener("click", function () { setActiveSpace(space.id); });
      list.appendChild(it);
    });
    sidebar.appendChild(list);

    var activeSpace = spacesToUse.filter(function (s) { return s.id === appViewState.activeSpaceId; })[0];

    if (!activeSpace) {
      var mp = el("p", "muted");
      mp.textContent = "Select a space on the left.";
      content.appendChild(mp);
    } else {
      var header = el("div", "space-header");
      var at = el("h2");
      at.textContent = activeSpace.name;
      var st = el("div", "section-tabs");
      activeSpace.sections.forEach(function (section) {
        var btn = el("button", "chip" + (section === appViewState.activeSection ? " active" : ""));
        var lbl = document.createElement("span");
        lbl.textContent = section;
        btn.appendChild(lbl);
        if (isStudentOnlySection(section)) {
          var badge = el("span", "student-only-badge");
          badge.textContent = "Student only";
          badge.title = "Teachers can read but not post here.";
          btn.appendChild(badge);
        }
        btn.addEventListener("click", function () { setActiveSection(section); });
        st.appendChild(btn);
      });
      header.appendChild(at);
      header.appendChild(st);
      content.appendChild(header);

      if (userState.isAuthenticated && canUserPostInSection(appViewState.activeSection)) {
        var composer = el("section", "card post-composer");
        var form = el("form");
        var defAnon = appViewState.activeSection === "Anonymous / Vent";
        form.innerHTML = '<div class="composer-header"><span class="composer-title">New post · ' + appViewState.activeSection + '</span><label class="checkbox-inline"><input type="checkbox" name="isAnonymous" ' + (defAnon ? 'checked' : '') + ' /> Post anonymously</label></div>' +
          '<div class="form-field"><input name="title" placeholder="Title" required /></div>' +
          '<div class="form-field"><textarea name="content" rows="3" placeholder="Content" required></textarea></div>' +
          '<div class="form-actions right"><button type="submit" class="primary-button small">Post</button></div>';
        form.addEventListener("submit", handleCreatePost);
        composer.appendChild(form);
        content.appendChild(composer);
      } else if (userState.isAuthenticated && !canUserPostInSection(appViewState.activeSection)) {
        var notice = el("div", "student-only-notice");
        notice.textContent = "This is a student-only section. Teachers can read but cannot post here.";
        content.appendChild(notice);
      }

      var postCard = el("section", "card");
      var plTitle = el("h3");
      plTitle.textContent = appViewState.activeSection + " posts";
      postCard.appendChild(plTitle);
      var postsInSpace = getPostsForSpace(appViewState.activeSpaceId, appViewState.activeSection);
      if (postsInSpace.length === 0) {
        var np = el("p", "muted");
        np.textContent = "No posts yet.";
        postCard.appendChild(np);
      } else {
        var pl = el("div", "post-list");
        postsInSpace.forEach(function (post) {
          pl.appendChild(renderPostCard(post, { showSpace: false }));
        });
        postCard.appendChild(pl);
      }
      content.appendChild(postCard);
    }

    layout.appendChild(sidebar);
    layout.appendChild(content);
    container.appendChild(layout);
  }

  function renderQuestions(container) {
    var card = el("section", "card");
    var t = el("h2");
    t.textContent = "Questions & concerns";
    card.appendChild(t);
    var d = el("p", "muted");
    d.textContent = "All Q&A and anonymous/vent posts from your spaces.";
    card.appendChild(d);
    var feed = getQuestionAndConcernFeed();
    if (feed.length === 0) {
      var p = el("p", "muted");
      p.textContent = "No questions or concerns yet.";
      card.appendChild(p);
    } else {
      var list = el("div", "post-list");
      feed.forEach(function (post) {
        var sn = spaces.filter(function (s) { return s.id === post.spaceId; })[0];
        list.appendChild(renderPostCard(post, { showSpace: true, spaceLabel: sn ? sn.name : "Space" }));
      });
      card.appendChild(list);
    }
    container.appendChild(card);
  }

  function renderNotifications(container) {
    var card = el("section", "card");
    var header = el("div", "notif-header");
    var t = el("h2");
    t.textContent = "Notifications";
    header.appendChild(t);
    if (appViewState.notifications.some(function (n) { return !n.is_read; })) {
      var markAllBtn = el("button", "ghost-button small");
      markAllBtn.textContent = "Mark all read";
      markAllBtn.addEventListener("click", function () {
        markAllNotificationsRead().then(render);
      });
      header.appendChild(markAllBtn);
    }
    card.appendChild(header);

    var notifs = appViewState.notifications;
    if (notifs.length === 0) {
      var p = el("p", "muted");
      p.textContent = "No notifications yet.";
      card.appendChild(p);
    } else {
      var ul = el("ul", "notification-list");
      notifs.forEach(function (n) {
        var li = el("li", "notif-item" + (n.is_read ? "" : " notif-unread"));
        var msg = el("span", "notif-message");
        msg.textContent = n.message;
        var ts = el("span", "notif-time");
        ts.textContent = new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        li.appendChild(msg);
        li.appendChild(ts);
        if (!n.is_read) {
          var readBtn = el("button", "ghost-button tiny");
          readBtn.textContent = "Mark read";
          readBtn.addEventListener("click", function () {
            markNotificationRead(n.id).then(render);
          });
          li.appendChild(readBtn);
        }
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }
    container.appendChild(card);
  }

  function renderProfile(container) {
    var card = el("section", "card");
    var t = el("h2");
    t.textContent = "Profile";
    card.appendChild(t);
    if (!userState.isAuthenticated) {
      var p = el("p", "muted");
      p.textContent = "Sign in to view your profile.";
      card.appendChild(p);
    } else {
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
      card.appendChild(info);

      // Verification status badge
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
        card.appendChild(badge);
      }

      var lb = el("button", "ghost-button");
      lb.textContent = "Sign out";
      lb.style.marginTop = "1rem";
      lb.addEventListener("click", handleLogoutClick);
      card.appendChild(lb);
    }
    container.appendChild(card);
  }

  function renderAdmin(container) {
    var card = el("section", "card");
    var t = el("h2");
    t.textContent = "Admin — User Verification";
    card.appendChild(t);

    var filterWrap = el("div", "admin-filter");
    ["all", "pending", "approved", "rejected"].forEach(function (status) {
      var btn = el("button", "tab-button" + (appViewState.adminFilter === status ? " active" : ""));
      btn.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      btn.addEventListener("click", function () {
        appViewState.adminFilter = status;
        loadAdminUsers().then(render);
      });
      filterWrap.appendChild(btn);
    });
    card.appendChild(filterWrap);

    var tableWrap = el("div", "admin-table-wrap");
    var loading = el("p", "muted");
    loading.textContent = "Loading…";
    tableWrap.appendChild(loading);
    card.appendChild(tableWrap);
    container.appendChild(card);

    // Load users and populate table
    loadAdminUsers().then(function () {
      while (tableWrap.firstChild) tableWrap.removeChild(tableWrap.firstChild);
      if (appViewState.adminUsers.length === 0) {
        var emp = el("p", "muted");
        emp.textContent = "No users found.";
        tableWrap.appendChild(emp);
        return;
      }
      var table = el("table", "admin-table");
      var thead = document.createElement("thead");
      thead.innerHTML = "<tr><th>Name</th><th>Email</th><th>Role</th><th>Grade</th><th>Method</th><th>Status</th><th>Actions</th></tr>";
      table.appendChild(thead);
      var tbody = document.createElement("tbody");
      appViewState.adminUsers.forEach(function (u) {
        var tr = document.createElement("tr");
        tr.id = "admin-user-row-" + u.id;
        var statusCls = u.verification_status === "approved" ? "badge-approved" : (u.verification_status === "rejected" ? "badge-rejected" : "badge-pending");
        tr.innerHTML =
          "<td>" + esc(u.name) + "</td>" +
          "<td>" + esc(u.email) + "</td>" +
          "<td>" + esc(u.role) + "</td>" +
          "<td>" + esc(u.grade || "—") + "</td>" +
          "<td>" + esc(u.verification_method) + "</td>" +
          '<td><span class="verification-badge ' + statusCls + '">' + esc(u.verification_status) + "</span></td>" +
          "<td></td>";
        var actionCell = tr.cells[6];
        if (u.verification_status !== "approved") {
          var approveBtn = el("button", "primary-button admin-action-btn");
          approveBtn.textContent = "Approve";
          approveBtn.addEventListener("click", function () { handleAdminVerify(u.id, "approved", tr); });
          actionCell.appendChild(approveBtn);
        }
        if (u.verification_status !== "rejected") {
          var rejectBtn = el("button", "ghost-button admin-action-btn");
          rejectBtn.textContent = "Reject";
          rejectBtn.addEventListener("click", function () { handleAdminVerify(u.id, "rejected", tr); });
          actionCell.appendChild(rejectBtn);
        }
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
    });
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

  function render() {
    clearRoot();
    var wrapper = el("div", "app-wrapper");
    renderHeader(wrapper);

    if (!userState.isAuthenticated) {
      renderLogin(wrapper);
    } else {
      renderTabs(wrapper);
      var content = el("main", "app-main");
      switch (appViewState.activeTab) {
        case "home": renderHome(content); break;
        case "spaces": renderSpaces(content); break;
        case "questions": renderQuestions(content); break;
        case "notifications": renderNotifications(content); break;
        case "profile": renderProfile(content); break;
        case "admin": renderAdmin(content); break;
        default: renderHome(content);
      }
      wrapper.appendChild(content);
    }
    appRoot.appendChild(wrapper);
  }

  restoreSession().then(function (restored) {
    render();
  }).catch(function () {
    render();
  });
})();
