/**
 * Main app bootstrap, routing, and event handling.
 * School-private SNS for high school. All UI strings in English.
 */

import {
  userState,
  login,
  logout,
  getSpacesForUser,
  getPostsForSpace,
  getHomeFeed,
  getQuestionAndConcernFeed,
  getScheduleForUser,
  createPost,
  canUserPostInSection,
  isStudentOnlySection,
  spaces
} from "./state.js";

const appRoot = document.getElementById("app-root");

const appViewState = {
  activeTab: "home",
  activeSpaceId: null,
  activeSection: "Announcements & Assignments",
  notifications: []
};

function pushNotification(message) {
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
  appViewState.notifications.unshift({ message, timestamp });
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

function handleLoginSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const name = formData.get("name")?.toString().trim();
  const role = formData.get("role")?.toString();
  const grade = formData.get("grade")?.toString();
  const classNumber = formData.get("classNumber")?.toString();
  const schoolCode = formData.get("schoolCode")?.toString().trim() || "KOBE-HS";
  const email = formData.get("email")?.toString().trim() || "";

  if (!name || !role || !grade || !classNumber) {
    alert("Please fill in name, role, grade, and class.");
    return;
  }

  login({ name, role, grade, classNumber, schoolCode, email });
  appViewState.activeTab = "home";
  const defaultSpace = getSpacesForUser()[0];
  appViewState.activeSpaceId = defaultSpace ? defaultSpace.id : null;
  render();
}

function handleLogoutClick() {
  logout();
  appViewState.activeTab = "home";
  appViewState.activeSpaceId = null;
  appViewState.notifications = [];
  render();
}

function handleCreatePost(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const title = formData.get("title")?.toString().trim();
  const content = formData.get("content")?.toString().trim();
  const isAnonymous = formData.get("isAnonymous") === "on";

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

  const post = createPost({
    spaceId: appViewState.activeSpaceId,
    section: appViewState.activeSection,
    title,
    content,
    isAnonymous
  });

  if (post) {
    pushNotification(`New post: [${post.section}] ${post.title}`);
    event.target.reset();
  }
  render();
}

function clearRoot() {
  while (appRoot.firstChild) appRoot.removeChild(appRoot.firstChild);
}

function renderHeader(container) {
  const header = document.createElement("header");
  header.className = "app-header";

  const title = document.createElement("div");
  title.className = "app-title";
  title.textContent = "School-Only SNS";

  const subtitle = document.createElement("div");
  subtitle.className = "app-subtitle";
  subtitle.textContent = "A quiet space for your class, subjects & clubs";

  const right = document.createElement("div");
  right.className = "app-header-right";

  if (userState.isAuthenticated) {
    const userInfo = document.createElement("div");
    userInfo.className = "app-user-info";
    const roleLabel = userState.role === "teacher" ? "Teacher" : "Student";
    userInfo.textContent = `${userState.name} (${roleLabel}, ${userState.grade}-${userState.classNumber})`;

    const logoutBtn = document.createElement("button");
    logoutBtn.className = "ghost-button";
    logoutBtn.textContent = "Sign out";
    logoutBtn.addEventListener("click", handleLogoutClick);

    right.appendChild(userInfo);
    right.appendChild(logoutBtn);
  } else {
    const hint = document.createElement("div");
    hint.className = "app-header-hint";
    hint.textContent = "Sign in with your school account (M365)";
    right.appendChild(hint);
  }

  header.appendChild(title);
  header.appendChild(subtitle);
  header.appendChild(right);
  container.appendChild(header);
}

function renderTabs(container) {
  const nav = document.createElement("nav");
  nav.className = "tab-nav";

  const tabs = [
    { id: "home", label: "Home" },
    { id: "spaces", label: "Spaces" },
    { id: "questions", label: "Questions & Concerns" },
    { id: "notifications", label: "Notifications" },
    { id: "profile", label: "Profile" }
  ];

  tabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.className = "tab-button";
    if (appViewState.activeTab === tab.id) btn.classList.add("active");
    btn.textContent = tab.label;
    btn.addEventListener("click", () => setActiveTab(tab.id));
    nav.appendChild(btn);
  });

  container.appendChild(nav);
}

function renderLogin(container) {
  const card = document.createElement("section");
  card.className = "card login-card";

  const title = document.createElement("h2");
  title.textContent = "Sign in to school-only space";

  const desc = document.createElement("p");
  desc.className = "muted";
  desc.textContent =
    "Use your school email (Microsoft 365). This MVP uses a mock form — real M365 SSO will be integrated later.";

  const form = document.createElement("form");
  form.className = "form-grid";
  form.addEventListener("submit", handleLoginSubmit);

  form.innerHTML = `
    <div class="form-field">
      <label for="schoolCode">School code</label>
      <input id="schoolCode" name="schoolCode" placeholder="e.g. KOBE-HS" />
    </div>
    <div class="form-field">
      <label for="email">School email (M365)</label>
      <input id="email" name="email" type="email" placeholder="student@school.edu" />
    </div>
    <div class="form-field">
      <label for="name">Name</label>
      <input id="name" name="name" placeholder="Your name" required />
    </div>
    <div class="form-field">
      <label for="role">Role</label>
      <select id="role" name="role" required>
        <option value="">Select</option>
        <option value="student">Student</option>
        <option value="teacher">Teacher</option>
      </select>
    </div>
    <div class="form-field">
      <label for="grade">Grade</label>
      <select id="grade" name="grade" required>
        <option value="">Select</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
      </select>
    </div>
    <div class="form-field">
      <label for="classNumber">Class</label>
      <select id="classNumber" name="classNumber" required>
        <option value="">Select</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
      </select>
    </div>
    <div class="form-actions">
      <button type="submit" class="primary-button">Sign in</button>
    </div>
  `;

  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(form);
  container.appendChild(card);
}

function renderHome(container) {
  const layout = document.createElement("div");
  layout.className = "home-layout";

  const leftCol = document.createElement("div");
  leftCol.className = "home-left";
  const rightCol = document.createElement("div");
  rightCol.className = "home-right";

  const scheduleCard = document.createElement("section");
  scheduleCard.className = "card";
  const scheduleTitle = document.createElement("h2");
  scheduleTitle.textContent = "Today's schedule";
  scheduleCard.appendChild(scheduleTitle);

  const schedule = getScheduleForUser();
  if (schedule) {
    const table = document.createElement("table");
    table.className = "schedule-table";
    schedule.todaySubjects.forEach((row) => {
      const tr = document.createElement("tr");
      const tdPeriod = document.createElement("td");
      tdPeriod.textContent = `${row.period}`;
      const tdSubject = document.createElement("td");
      tdSubject.textContent = row.subject;
      tr.appendChild(tdPeriod);
      tr.appendChild(tdSubject);
      table.appendChild(tr);
    });
    scheduleCard.appendChild(table);
    const upcoming = document.createElement("div");
    upcoming.className = "upcoming-events";
    schedule.upcomingEvents.forEach((e) => {
      const item = document.createElement("div");
      item.className = "upcoming-item";
      item.textContent = `${e.dateLabel} · ${e.title}`;
      upcoming.appendChild(item);
    });
    scheduleCard.appendChild(upcoming);
  } else {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Sign in to see your schedule.";
    scheduleCard.appendChild(empty);
  }
  leftCol.appendChild(scheduleCard);

  const spacesCard = document.createElement("section");
  spacesCard.className = "card";
  const spacesTitle = document.createElement("h2");
  spacesTitle.textContent = "My spaces";
  spacesCard.appendChild(spacesTitle);
  const userSpaces = getSpacesForUser();
  if (userSpaces.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Sign in to see your class, subjects & clubs.";
    spacesCard.appendChild(p);
  } else {
    const list = document.createElement("div");
    list.className = "space-list";
    userSpaces.forEach((space) => {
      const item = document.createElement("button");
      item.className = "space-pill";
      item.textContent = space.name;
      item.addEventListener("click", () => setActiveSpace(space.id));
      list.appendChild(item);
    });
    spacesCard.appendChild(list);
  }
  leftCol.appendChild(spacesCard);

  const feedCard = document.createElement("section");
  feedCard.className = "card";
  const feedTitle = document.createElement("h2");
  feedTitle.textContent = "Recent from your spaces";
  feedCard.appendChild(feedTitle);
  const feed = getHomeFeed();
  if (feed.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No posts yet. Be the first to post.";
    feedCard.appendChild(p);
  } else {
    const list = document.createElement("div");
    list.className = "post-list";
    feed.forEach((post) => {
      const card = document.createElement("article");
      card.className = "post-card";
      const spaceName = spaces.find((s) => s.id === post.spaceId)?.name || "Space";
      const meta = document.createElement("div");
      meta.className = "post-meta";
      meta.textContent = `${spaceName} · ${post.section}`;
      const title = document.createElement("h3");
      title.textContent = post.title;
      const excerpt = document.createElement("p");
      excerpt.className = "post-excerpt";
      excerpt.textContent =
        post.content.length > 80 ? `${post.content.slice(0, 80)}...` : post.content;
      const author = document.createElement("div");
      author.className = "post-author";
      author.textContent = `${post.authorName} · ${new Date(post.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })}`;
      card.appendChild(meta);
      card.appendChild(title);
      card.appendChild(excerpt);
      card.appendChild(author);
      list.appendChild(card);
    });
    feedCard.appendChild(list);
  }
  rightCol.appendChild(feedCard);

  layout.appendChild(leftCol);
  layout.appendChild(rightCol);
  container.appendChild(layout);
}

function renderSpaces(container) {
  const layout = document.createElement("div");
  layout.className = "spaces-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "spaces-sidebar";
  const content = document.createElement("div");
  content.className = "spaces-content";

  const userSpaces = getSpacesForUser();
  const allSpacesHeader = document.createElement("h2");
  allSpacesHeader.textContent = "Spaces";
  sidebar.appendChild(allSpacesHeader);

  const list = document.createElement("div");
  list.className = "space-list-vertical";
  const spacesToUse = userSpaces.length ? userSpaces : spaces;

  if (!appViewState.activeSpaceId && spacesToUse.length)
    appViewState.activeSpaceId = spacesToUse[0].id;

  spacesToUse.forEach((space) => {
    const item = document.createElement("button");
    item.className = "space-item";
    if (space.id === appViewState.activeSpaceId) item.classList.add("active");
    item.textContent = space.name;
    item.addEventListener("click", () => setActiveSpace(space.id));
    list.appendChild(item);
  });
  sidebar.appendChild(list);

  const activeSpace = spacesToUse.find((s) => s.id === appViewState.activeSpaceId);

  if (!activeSpace) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Select a space on the left.";
    content.appendChild(p);
  } else {
    const header = document.createElement("div");
    header.className = "space-header";

    const title = document.createElement("h2");
    title.textContent = activeSpace.name;

    const sectionTabs = document.createElement("div");
    sectionTabs.className = "section-tabs";
    activeSpace.sections.forEach((section) => {
      const btn = document.createElement("button");
      btn.className = "chip";
      if (section === appViewState.activeSection) btn.classList.add("active");
      const label = document.createElement("span");
      label.textContent = section;
      btn.appendChild(label);
      if (isStudentOnlySection(section)) {
        const badge = document.createElement("span");
        badge.className = "student-only-badge";
        badge.textContent = "Student only";
        badge.title = "Teachers can read but not post here.";
        btn.appendChild(badge);
      }
      btn.addEventListener("click", () => setActiveSection(section));
      sectionTabs.appendChild(btn);
    });

    header.appendChild(title);
    header.appendChild(sectionTabs);
    content.appendChild(header);

    if (userState.isAuthenticated && canUserPostInSection(appViewState.activeSection)) {
      const composer = document.createElement("section");
      composer.className = "card post-composer";
      const form = document.createElement("form");
      form.addEventListener("submit", handleCreatePost);
      const isAnonymousDefault = appViewState.activeSection === "Anonymous / Vent";
      form.innerHTML = `
        <div class="composer-header">
          <span class="composer-title">New post · ${appViewState.activeSection}</span>
          <label class="checkbox-inline">
            <input type="checkbox" name="isAnonymous" ${isAnonymousDefault ? "checked" : ""} />
            Post anonymously
          </label>
        </div>
        <div class="form-field">
          <input name="title" placeholder="Title" required />
        </div>
        <div class="form-field">
          <textarea name="content" rows="3" placeholder="Content" required></textarea>
        </div>
        <div class="form-actions right">
          <button type="submit" class="primary-button small">Post</button>
        </div>
      `;
      composer.appendChild(form);
      content.appendChild(composer);
    } else if (userState.isAuthenticated && !canUserPostInSection(appViewState.activeSection)) {
      const notice = document.createElement("div");
      notice.className = "student-only-notice";
      notice.textContent =
        "This is a student-only section. Teachers can read but cannot post here.";
      content.appendChild(notice);
    }

    const postListCard = document.createElement("section");
    postListCard.className = "card";
    const listTitle = document.createElement("h3");
    listTitle.textContent = `${appViewState.activeSection} posts`;
    postListCard.appendChild(listTitle);

    const postsInSpace = getPostsForSpace(
      appViewState.activeSpaceId,
      appViewState.activeSection
    );
    if (postsInSpace.length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No posts yet.";
      postListCard.appendChild(p);
    } else {
      const postList = document.createElement("div");
      postList.className = "post-list";
      postsInSpace.forEach((post) => {
        const card = document.createElement("article");
        card.className = "post-card";
        const meta = document.createElement("div");
        meta.className = "post-meta";
        meta.textContent = post.section;
        const title = document.createElement("h3");
        title.textContent = post.title;
        const excerpt = document.createElement("p");
        excerpt.className = "post-excerpt";
        excerpt.textContent =
          post.content.length > 100 ? `${post.content.slice(0, 100)}...` : post.content;
        const author = document.createElement("div");
        author.className = "post-author";
        author.textContent = `${post.authorName} · ${new Date(post.createdAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })}`;
        card.appendChild(meta);
        card.appendChild(title);
        card.appendChild(excerpt);
        card.appendChild(author);
        postList.appendChild(card);
      });
      postListCard.appendChild(postList);
    }
    content.appendChild(postListCard);
  }

  layout.appendChild(sidebar);
  layout.appendChild(content);
  container.appendChild(layout);
}

function renderQuestions(container) {
  const card = document.createElement("section");
  card.className = "card";
  const title = document.createElement("h2");
  title.textContent = "Questions & concerns";
  card.appendChild(title);
  const desc = document.createElement("p");
  desc.className = "muted";
  desc.textContent = "All Q&A and anonymous/vent posts from your spaces.";
  card.appendChild(desc);

  const feed = getQuestionAndConcernFeed();
  if (feed.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No questions or concerns yet.";
    card.appendChild(p);
  } else {
    const list = document.createElement("div");
    list.className = "post-list";
    feed.forEach((post) => {
      const item = document.createElement("article");
      item.className = "post-card";
      const spaceName = spaces.find((s) => s.id === post.spaceId)?.name || "Space";
      const meta = document.createElement("div");
      meta.className = "post-meta";
      meta.textContent = `${spaceName} · ${post.section}`;
      const h3 = document.createElement("h3");
      h3.textContent = post.title;
      const excerpt = document.createElement("p");
      excerpt.className = "post-excerpt";
      excerpt.textContent =
        post.content.length > 120 ? `${post.content.slice(0, 120)}...` : post.content;
      const author = document.createElement("div");
      author.className = "post-author";
      author.textContent = `${post.authorName} · ${new Date(post.createdAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })}`;
      item.appendChild(meta);
      item.appendChild(h3);
      item.appendChild(excerpt);
      item.appendChild(author);
      list.appendChild(item);
    });
    card.appendChild(list);
  }
  container.appendChild(card);
}

function renderNotifications(container) {
  const card = document.createElement("section");
  card.className = "card";
  const title = document.createElement("h2");
  title.textContent = "Notifications";
  card.appendChild(title);
  if (appViewState.notifications.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "No notifications yet.";
    card.appendChild(p);
  } else {
    const list = document.createElement("ul");
    list.className = "notification-list";
    appViewState.notifications.forEach((n) => {
      const li = document.createElement("li");
      li.textContent = `[${n.timestamp}] ${n.message}`;
      list.appendChild(li);
    });
    card.appendChild(list);
  }
  container.appendChild(card);
}

function renderProfile(container) {
  const card = document.createElement("section");
  card.className = "card";
  const title = document.createElement("h2");
  title.textContent = "Profile";
  card.appendChild(title);

  if (!userState.isAuthenticated) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Sign in to view your profile.";
    card.appendChild(p);
  } else {
    const info = document.createElement("dl");
    info.className = "profile-dl";
    const roleLabel = userState.role === "teacher" ? "Teacher" : "Student";
    [
      ["Name", userState.name],
      ["Role", roleLabel],
      ["Grade", userState.grade],
      ["Class", userState.classNumber],
      ["School code", userState.schoolCode]
    ].forEach(([k, v]) => {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v || "—";
      info.appendChild(dt);
      info.appendChild(dd);
    });
    card.appendChild(info);

    const logoutBtn = document.createElement("button");
    logoutBtn.className = "ghost-button";
    logoutBtn.textContent = "Sign out";
    logoutBtn.addEventListener("click", handleLogoutClick);
    card.appendChild(logoutBtn);
  }
  container.appendChild(card);
}

function render() {
  clearRoot();

  const wrapper = document.createElement("div");
  wrapper.className = "app-wrapper";

  renderHeader(wrapper);

  if (!userState.isAuthenticated) {
    renderLogin(wrapper);
  } else {
    renderTabs(wrapper);
    const content = document.createElement("main");
    content.className = "app-main";

    switch (appViewState.activeTab) {
      case "home":
        renderHome(content);
        break;
      case "spaces":
        renderSpaces(content);
        break;
      case "questions":
        renderQuestions(content);
        break;
      case "notifications":
        renderNotifications(content);
        break;
      case "profile":
        renderProfile(content);
        break;
      default:
        renderHome(content);
    }

    wrapper.appendChild(content);
  }

  appRoot.appendChild(wrapper);
}

render();
