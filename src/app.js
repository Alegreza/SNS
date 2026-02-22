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

  const spaces = [
    { id: "grade-9", type: "class", name: "Grade 9", grade: "9", sections: ["Announcements & Assignments", "Questions", "Anonymous / Vent"] },
    { id: "grade-10", type: "class", name: "Grade 10", grade: "10", sections: ["Announcements & Assignments", "Questions", "Anonymous / Vent"] },
    { id: "grade-11", type: "class", name: "Grade 11", grade: "11", sections: ["Announcements & Assignments", "Questions", "Anonymous / Vent"] },
    { id: "grade-12", type: "class", name: "Grade 12", grade: "12", sections: ["Announcements & Assignments", "Questions", "Anonymous / Vent"] },
    { id: "subject-9-math1", type: "subject", name: "Math I (Grade 9)", grade: "9", sections: ["Announcements & Assignments", "Questions", "Anonymous / Vent"] },
    { id: "club-band", type: "club", name: "Band Club", grade: null, sections: ["Announcements & Assignments", "Questions", "Anonymous / Vent"] }
  ];

  let postIdSeq = 4;
  const posts = [
    { id: 1, spaceId: "grade-9", section: "Announcements & Assignments", title: "Midterm exam scope", content: "Scope for Korean, Math, English will be announced next Monday.", authorName: "Homeroom Teacher", authorRole: "teacher", isAnonymous: false, createdAt: new Date().toISOString() },
    { id: 2, spaceId: "subject-9-math1", section: "Questions", title: "Hint for problem 3 in differential applications?", content: "Stuck on problem 3, p.132. Any tips to get started?", authorName: "Grade 9 Student", authorRole: "student", isAnonymous: false, createdAt: new Date().toISOString() },
    { id: 3, spaceId: "club-band", section: "Anonymous / Vent", title: "So nervous before the concert", content: "My hands shake on stage. How do you deal with stage fright?", authorName: "Anonymous", authorRole: "student", isAnonymous: true, createdAt: new Date().toISOString() }
  ];

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
    if (!canUserPostInSection(payload.section)) return null;
    const timestamp = new Date().toISOString();
    const visibleName = payload.isAnonymous ? "Anonymous" : (userState.name || "Student");
    const post = {
      id: postIdSeq++,
      spaceId: payload.spaceId,
      section: payload.section,
      title: payload.title,
      content: payload.content,
      authorName: visibleName,
      authorRole: userState.role || "student",
      isAnonymous: payload.isAnonymous,
      createdAt: timestamp
    };
    posts.unshift(post);
    return post;
  }

  function getSpacesForUser() {
    if (!userState.isAuthenticated) return [];
    if (userState.role === "admin") return spaces;
    return spaces.filter(function (space) {
      if (space.type === "class" || space.type === "subject")
        return space.grade === userState.grade;
      if (space.type === "club") return true;
      return false;
    });
  }

  function getPostsForSpace(spaceId, section) {
    return posts.filter(function (p) {
      if (p.spaceId !== spaceId) return false;
      if (section && p.section !== section) return false;
      return true;
    });
  }

  function getHomeFeed() {
    const ids = {};
    getSpacesForUser().forEach(function (s) { ids[s.id] = true; });
    return posts.filter(function (p) { return ids[p.spaceId]; }).slice(0, 10);
  }

  function getQuestionAndConcernFeed() {
    const ids = {};
    getSpacesForUser().forEach(function (s) { ids[s.id] = true; });
    return posts.filter(function (p) {
      if ((p.section !== "Questions" && p.section !== "Anonymous / Vent") || !userState.isAuthenticated) return false;
      return ids[p.spaceId];
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
    pendingMsAccount: null,
    msalInstance: null,
    useDevForm: false,
    authScreen: "choose",
    authProvider: null
  };

  function pushNotification(msg) {
    const t = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    appViewState.notifications.unshift({ message: msg, timestamp: t });
    if (appViewState.notifications.length > 20) appViewState.notifications.pop();
  }

  function setActiveTab(tab) {
    appViewState.activeTab = tab;
    render();
  }

  function setActiveSpace(spaceId) {
    appViewState.activeSpaceId = spaceId;
    appViewState.activeSection = "Announcements & Assignments";
    appViewState.activeTab = "spaces";
    render();
  }

  function setActiveSection(section) {
    appViewState.activeSection = section;
    render();
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
        var ds = getSpacesForUser()[0];
        appViewState.activeSpaceId = ds ? ds.id : null;
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
          var ds = getSpacesForUser()[0];
          appViewState.activeSpaceId = ds ? ds.id : null;
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
        var ds = getSpacesForUser()[0];
        appViewState.activeSpaceId = ds ? ds.id : null;
        render();
      })
      .catch(function (e) {
        alert(e.message || "Signup failed");
      });
  }

  function handleLogoutClick() {
    logout();
    appViewState.pendingMsAccount = null;
    appViewState.activeTab = "home";
    appViewState.activeSpaceId = null;
    appViewState.notifications = [];
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

    var post = createPost({
      spaceId: appViewState.activeSpaceId,
      section: appViewState.activeSection,
      title: title,
      content: content,
      isAnonymous: isAnonymous
    });

    if (post) {
      pushNotification("New post: [" + post.section + "] " + post.title);
      f.reset();
    }
    render();
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
    tabs.forEach(function (tab) {
      var btn = el("button", "tab-button" + (appViewState.activeTab === tab.id ? " active" : ""));
      btn.textContent = tab.label;
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
        var pc = el("article", "post-card");
        var sn = spaces.filter(function (s) { return s.id === post.spaceId; })[0];
        var meta = el("div", "post-meta");
        meta.textContent = (sn ? sn.name : "Space") + " · " + post.section;
        var pt = el("h3");
        pt.textContent = post.title;
        var ex = el("p", "post-excerpt");
        ex.textContent = post.content.length > 80 ? post.content.slice(0, 80) + "..." : post.content;
        var au = el("div", "post-author");
        au.textContent = post.authorName + " · " + new Date(post.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        pc.appendChild(meta);
        pc.appendChild(pt);
        pc.appendChild(ex);
        pc.appendChild(au);
        fl.appendChild(pc);
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
          var pc = el("article", "post-card");
          var m = el("div", "post-meta");
          m.textContent = post.section;
          var t = el("h3");
          t.textContent = post.title;
          var e = el("p", "post-excerpt");
          e.textContent = post.content.length > 100 ? post.content.slice(0, 100) + "..." : post.content;
          var a = el("div", "post-author");
          a.textContent = post.authorName + " · " + new Date(post.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          pc.appendChild(m);
          pc.appendChild(t);
          pc.appendChild(e);
          pc.appendChild(a);
          pl.appendChild(pc);
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
        var item = el("article", "post-card");
        var sn = spaces.filter(function (s) { return s.id === post.spaceId; })[0];
        var meta = el("div", "post-meta");
        meta.textContent = (sn ? sn.name : "Space") + " · " + post.section;
        var h3 = el("h3");
        h3.textContent = post.title;
        var ex = el("p", "post-excerpt");
        ex.textContent = post.content.length > 120 ? post.content.slice(0, 120) + "..." : post.content;
        var au = el("div", "post-author");
        au.textContent = post.authorName + " · " + new Date(post.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        item.appendChild(meta);
        item.appendChild(h3);
        item.appendChild(ex);
        item.appendChild(au);
        list.appendChild(item);
      });
      card.appendChild(list);
    }
    container.appendChild(card);
  }

  function renderNotifications(container) {
    var card = el("section", "card");
    var t = el("h2");
    t.textContent = "Notifications";
    card.appendChild(t);
    if (appViewState.notifications.length === 0) {
      var p = el("p", "muted");
      p.textContent = "No notifications yet.";
      card.appendChild(p);
    } else {
      var ul = el("ul", "notification-list");
      appViewState.notifications.forEach(function (n) {
        var li = document.createElement("li");
        li.textContent = "[" + n.timestamp + "] " + n.message;
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
      var lb = el("button", "ghost-button");
      lb.textContent = "Sign out";
      lb.addEventListener("click", handleLogoutClick);
      card.appendChild(lb);
    }
    container.appendChild(card);
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
