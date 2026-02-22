/**
 * Client-side state and domain model for school-private SNS.
 * Target: High school. Auth: Microsoft 365 / school email (placeholder for MVP).
 * Boundary: Student-only sections where teachers have read-only access.
 */

export const userState = {
  isAuthenticated: false,
  name: "",
  role: null, // 'student' | 'teacher'
  grade: "",
  classNumber: "",
  schoolCode: "",
  // Placeholder for M365: email used for school domain validation
  email: ""
};

// Section config: studentOnly = true means teachers cannot post, only read
const SECTION_CONFIG = {
  "Announcements & Assignments": { studentOnly: false },
  "Questions": { studentOnly: false },
  "Anonymous / Vent": { studentOnly: true }
};

// Spaces: class, subject, club. studentOnlySpaces = teachers see but cannot post
export const spaces = [
  {
    id: "class-3-2",
    type: "class",
    name: "Grade 3 Class 2",
    grade: "3",
    classNumber: "2",
    sections: ["Announcements & Assignments", "Questions", "Anonymous / Vent"]
  },
  {
    id: "subject-3-2-math1",
    type: "subject",
    name: "Math I (3-2)",
    grade: "3",
    classNumber: "2",
    sections: ["Announcements & Assignments", "Questions", "Anonymous / Vent"]
  },
  {
    id: "club-band",
    type: "club",
    name: "Band Club",
    grade: null,
    classNumber: null,
    sections: ["Announcements & Assignments", "Questions", "Anonymous / Vent"]
  }
];

let postIdSeq = 1;

export const posts = [
  {
    id: postIdSeq++,
    spaceId: "class-3-2",
    section: "Announcements & Assignments",
    title: "Midterm exam scope",
    content: "Scope for Korean, Math, English will be announced next Monday.",
    authorName: "Homeroom Teacher",
    authorRole: "teacher",
    isAnonymous: false,
    createdAt: new Date().toISOString()
  },
  {
    id: postIdSeq++,
    spaceId: "subject-3-2-math1",
    section: "Questions",
    title: "Hint for problem 3 in differential applications?",
    content: "Stuck on problem 3, p.132. Any tips to get started?",
    authorName: "3-2 Student",
    authorRole: "student",
    isAnonymous: false,
    createdAt: new Date().toISOString()
  },
  {
    id: postIdSeq++,
    spaceId: "club-band",
    section: "Anonymous / Vent",
    title: "So nervous before the concert",
    content: "My hands shake on stage. How do you deal with stage fright?",
    authorName: "Anonymous",
    authorRole: "student",
    isAnonymous: true,
    createdAt: new Date().toISOString()
  }
];

export const schedules = {
  "3-2": {
    todaySubjects: [
      { period: 1, subject: "Korean" },
      { period: 2, subject: "Math I" },
      { period: 3, subject: "English" },
      { period: 4, subject: "History" },
      { period: 5, subject: "Science" },
      { period: 6, subject: "Club" }
    ],
    upcomingEvents: [
      { dateLabel: "Next Mon", title: "Midterm schedule released" },
      { dateLabel: "Oct 12 (Sat)", title: "School festival & Band concert" }
    ]
  }
};

export function login({ name, role, grade, classNumber, schoolCode, email }) {
  userState.isAuthenticated = true;
  userState.name = name;
  userState.role = role;
  userState.grade = grade || "";
  userState.classNumber = classNumber || "";
  userState.schoolCode = schoolCode || "";
  userState.email = email || "";
}

export function logout() {
  userState.isAuthenticated = false;
  userState.name = "";
  userState.role = null;
  userState.grade = "";
  userState.classNumber = "";
  userState.schoolCode = "";
  userState.email = "";
}

/** Student-only sections: teachers can read but not post. */
export function canUserPostInSection(sectionName) {
  const config = SECTION_CONFIG[sectionName];
  if (!config) return true;
  if (!config.studentOnly) return true;
  return userState.role !== "teacher";
}

export function isStudentOnlySection(sectionName) {
  return SECTION_CONFIG[sectionName]?.studentOnly ?? false;
}

export function createPost({ spaceId, section, title, content, isAnonymous }) {
  if (!canUserPostInSection(section)) return null;

  const timestamp = new Date().toISOString();
  const visibleName = isAnonymous ? "Anonymous" : (userState.name || "Student");

  const post = {
    id: postIdSeq++,
    spaceId,
    section,
    title,
    content,
    authorName: visibleName,
    authorRole: userState.role || "student",
    isAnonymous,
    createdAt: timestamp
  };

  posts.unshift(post);
  return post;
}

export function getSpacesForUser() {
  if (!userState.isAuthenticated) return [];

  return spaces.filter((space) => {
    if (space.type === "class" || space.type === "subject") {
      return space.grade === userState.grade && space.classNumber === userState.classNumber;
    }
    if (space.type === "club") return true;
    return false;
  });
}

export function getPostsForSpace(spaceId, section) {
  return posts.filter((p) => {
    if (p.spaceId !== spaceId) return false;
    if (section && p.section !== section) return false;
    return true;
  });
}

export function getHomeFeed() {
  const visibleSpaceIds = new Set(getSpacesForUser().map((s) => s.id));
  return posts.filter((p) => visibleSpaceIds.has(p.spaceId)).slice(0, 10);
}

export function getQuestionAndConcernFeed() {
  const visibleSpaceIds = new Set(getSpacesForUser().map((s) => s.id));
  return posts.filter((p) => {
    if (p.section !== "Questions" && p.section !== "Anonymous / Vent") return false;
    if (!userState.isAuthenticated) return false;
    return visibleSpaceIds.has(p.spaceId);
  });
}

export function getScheduleForUser() {
  if (!userState.grade || !userState.classNumber) return null;
  const key = `${userState.grade}-${userState.classNumber}`;
  return schedules[key] || null;
}
