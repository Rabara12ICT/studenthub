const initialRequests = [
  { id: "SR-2024-083", title: "Certificate of Enrollment", category: "Registrar's Office", date: "Oct 18, 2024", status: "In progress", icon: "file", color: "icon-blue" },
  { id: "SR-2024-076", title: "Tuition fee assessment", category: "Finance Office", date: "Oct 15, 2024", status: "Completed", icon: "check", color: "icon-green" },
  { id: "SR-2024-069", title: "Academic advising", category: "Student Affairs", date: "Oct 12, 2024", status: "In progress", icon: "calendar", color: "" }
];

const storageKey = "studenthub-requests";
const accountStorageKey = "studenthub-demo-account";
const requestCooldownStoragePrefix = "studenthub-request-cooldown";
const requestCooldownMs = 30_000;
const $ = selector => document.querySelector(selector);
const dashboardMarkup = $(".page-content").innerHTML;
const allowedEmailDomain = "@paterostechnologicalcollege.edu.ph";
const requestCooldowns = new Map();
let requests;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  requests = Array.isArray(saved) && saved.every(item => item && typeof item.title === "string" && typeof item.status === "string")
    ? [...saved, ...initialRequests].slice(0, 20)
    : initialRequests.map(item => ({ ...item }));
} catch (error) {
  console.warn("Could not load saved requests.", error);
  requests = initialRequests.map(item => ({ ...item }));
}
let activeFilter = "All";
let searchQuery = "";
let toastTimer;
let account = null;
try {
  const savedAccount = JSON.parse(sessionStorage.getItem(accountStorageKey) || "null");
  if (savedAccount && typeof savedAccount.email === "string" && ["Student", "Admin"].includes(savedAccount.role) && isPtcEmail(savedAccount.email)) {
    account = savedAccount;
  }
} catch (error) {
  console.warn("Could not restore the demo sign-in.", error);
}

const modal = $("#request-modal");
const loginModal = $("#login-modal");

function isPtcEmail(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  return normalizedEmail.endsWith(allowedEmailDomain) && normalizedEmail.indexOf("@") === normalizedEmail.length - allowedEmailDomain.length;
}

function updateAccountUI() {
  const signedIn = Boolean(account);
  const welcomeHeading = $("#welcome-heading");
  const accountPopover = $("#account-popover");
  $("#login-trigger").hidden = signedIn;
  $("#topbar-user").hidden = !signedIn;
  if (!signedIn) {
    accountPopover.hidden = true;
    $("#topbar-user").setAttribute("aria-expanded", "false");
  }
  if (signedIn) {
    const name = account.name || account.email.split("@")[0];
    const initials = name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("") || "PT";
    $("#topbar-account-name").textContent = name;
    $("#topbar-avatar").textContent = initials;
    $("#profile-avatar").textContent = initials;
    $("#profile-name").textContent = name;
    $("#profile-email").textContent = account.email;
    $("#profile-role").textContent = `${account.role} account`;
    $("#sidebar-account-name").textContent = name;
    $("#sidebar-account-role").textContent = `${account.role} account · Demo`;
    $("#sidebar-avatar").textContent = initials;
    $("#sidebar-account-action").textContent = "↗";
    if (welcomeHeading) welcomeHeading.innerHTML = `Welcome, ${escapeHTML(name)} <span class="wave">✳</span>`;
  } else {
    $("#sidebar-account-name").textContent = "Guest";
    $("#sidebar-account-role").textContent = "Not signed in";
    $("#sidebar-avatar").textContent = "PT";
    $("#sidebar-account-action").textContent = "↗";
    if (welcomeHeading) welcomeHeading.innerHTML = 'Welcome to StudentHub <span class="wave">✳</span>';
  }
}

function openLoginModal() {
  loginModal.classList.add("open");
  loginModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  $("#login-error").hidden = true;
  window.setTimeout(() => $("#login-role").focus(), 50);
}

function closeLoginModal() {
  loginModal.classList.remove("open");
  loginModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = modal.classList.contains("open") ? "hidden" : "";
}

function signOut() {
  account = null;
  try {
    sessionStorage.removeItem(accountStorageKey);
  } catch (error) {
    console.warn("Could not clear the demo sign-in.", error);
  }
  updateAccountUI();
  showToast("You have been signed out.");
}

function toggleAccountPopover(forceOpen) {
  const popover = $("#account-popover");
  const isOpen = forceOpen ?? popover.hidden;
  popover.hidden = !isOpen;
  $("#topbar-user").setAttribute("aria-expanded", String(isOpen));
}

function renderRequests() {
  const filtered = requests.filter(request => {
    const matchesStatus = activeFilter === "All" || request.status === activeFilter;
    const searchable = `${request.title} ${request.category} ${request.id}`.toLowerCase();
    return matchesStatus && searchable.includes(searchQuery.toLowerCase());
  });
  $("#request-list").innerHTML = filtered.length ? filtered.slice(0, 3).map(request => {
    const statusClass = request.status === "Completed" ? "status-completed" : request.status === "In review" ? "status-review" : "status-progress";
    const icon = request.icon || "file";
    const color = request.color || "";
    return `<article class="request-row"><div class="request-main"><span class="request-type-icon ${color}"><svg class="icon"><use href="#i-${icon}"/></svg></span><div class="request-copy"><div class="request-title">${escapeHTML(request.title)}</div><div class="request-meta"><span>${escapeHTML(request.id)}</span><i class="meta-dot"></i><span>${escapeHTML(request.date)}</span></div></div></div><span class="status-pill ${statusClass}">${escapeHTML(request.status)}</span></article>`;
  }).join("") : `<div class="empty-requests">${searchQuery ? "No requests match your search." : "No requests in this category yet."}</div>`;
  const allCount = requests.length;
  document.querySelector('[data-filter="All"] span').textContent = allCount;
  $("#nav-count").textContent = allCount;
  $("#total-stat").textContent = String(12 + Math.max(0, allCount - initialRequests.length));
  $("#progress-stat").textContent = String(requests.filter(item => item.status === "In progress" || item.status === "In review").length);
  $("#completed-stat").textContent = String(8 + Math.max(0, requests.length - initialRequests.length));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function openModal() {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  window.setTimeout(() => $("#request-type").focus(), 50);
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function showToast(message) {
  $("#toast-message").textContent = message;
  $("#toast").classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => $("#toast").classList.remove("show"), 3200);
}

function getRequestCooldownKey() {
  const user = account ? account.email.toLowerCase() : "guest";
  return `${requestCooldownStoragePrefix}:${user}`;
}

function showPage(name) {
  const content = $(".page-content");
  $("#breadcrumb-current").textContent = name;
  document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.page === name));
  $("#sidebar").classList.remove("open");
  if (name === "Overview") {
    if (content.classList.contains("alternate-page")) renderDashboardContent();
    return;
  }
  if (name === "My requests") {
    if (content.classList.contains("alternate-page")) renderDashboardContent();
    $("#requests-section").scrollIntoView({ behavior: "smooth", block: "start" });
    activeFilter = "All";
    document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.filter === "All"));
    renderRequests();
    return;
  }
  content.classList.add("alternate-page");
  const pageInfo = {
    "Schedule": ["Your schedule", "Keep track of your upcoming campus appointments and important dates.", "schedule"],
    "Announcements": ["Campus announcements", "The latest news, events, and updates from Pateros Technological College.", "news"],
    "Student handbook": ["Student handbook", "Quick access to helpful information for your student journey.", "handbook"],
    "Help center": ["How can we help?", "Find answers or send a request to the PTC student services team.", "help"]
  }[name] || ["Coming soon", "More student resources are on the way.", "news"];
  let detail = `<div class="alternate-empty"><span class="stat-icon stat-green"><svg class="icon"><use href="#i-${pageInfo[2] === "schedule" ? "calendar" : pageInfo[2] === "help" ? "help" : pageInfo[2] === "handbook" ? "book" : "megaphone"}"/></svg></span><strong>${name === "Schedule" ? "You’re all set for today" : "Everything in one place"}</strong><p>${name === "Schedule" ? "Your academic advising appointment is today at 2:30 PM in the Guidance Office, Room 204." : pageInfo[1]}</p>${name === "Help center" ? '<button class="button button-primary" id="help-request-button">Submit a request</button>' : ""}</div>`;
  if (name === "Schedule") {
    detail = `<div class="schedule-list"><div class="schedule-list-row"><span class="schedule-list-date">Today<br>2:30 PM</span><span class="schedule-icon"><svg class="icon"><use href="#i-calendar"/></svg></span><span class="schedule-copy"><strong>Academic advising appointment</strong><small><svg class="icon"><use href="#i-pin"/></svg> Guidance Office, Room 204</small></span><span class="status-pill status-progress">Upcoming</span></div><div class="schedule-list-row"><span class="schedule-list-date">Oct 28<br>9:00 AM</span><span class="schedule-icon"><svg class="icon"><use href="#i-calendar"/></svg></span><span class="schedule-copy"><strong>Midterm examinations begin</strong><small><svg class="icon"><use href="#i-pin"/></svg> PTC Campus</small></span></div><div class="schedule-list-row"><span class="schedule-list-date">Nov 8<br>All day</span><span class="schedule-icon"><svg class="icon"><use href="#i-calendar"/></svg></span><span class="schedule-copy"><strong>2nd semester enrollment deadline</strong><small><svg class="icon"><use href="#i-pin"/></svg> Registrar's Office</small></span></div></div>`;
  }
  if (name === "Announcements") {
    detail = `<div class="schedule-list"><div class="announcement-item"><div class="announcement-meta"><span class="announcement-badge badge-academic">ACADEMIC</span><span>2 hours ago</span></div><h3>Enrollment for 2nd semester is now open</h3><p>Plan your next semester. Enrollment runs until November 8.</p></div><div class="announcement-item"><div class="announcement-meta"><span class="announcement-badge badge-campus">CAMPUS LIFE</span><span>Yesterday</span></div><h3>PTC Foundation Week — save the date!</h3><p>A week of activities, competitions, and campus festivities awaits.</p></div><div class="announcement-item"><div class="announcement-meta"><span class="announcement-badge badge-services">STUDENT SERVICES</span><span>Oct 18</span></div><h3>Updated library hours for midterms</h3><p>The library will stay open until 8:00 PM through midterm week.</p></div></div>`;
  }
  content.innerHTML = `<section class="welcome-row"><div><div class="date-line"><span class="date-dot"></span>${name.toUpperCase()}</div><h1>${pageInfo[0]}</h1><p class="welcome-subtitle">${pageInfo[1]}</p></div>${name === "Help center" ? "" : '<button class="button button-primary" id="new-request-button"><svg class="icon"><use href="#i-plus"/></svg> New request</button>'}</section><section class="alternate-card"><h2>${name === "Schedule" ? "Coming up" : name === "Announcements" ? "Latest updates" : name === "Help center" ? "Student support" : "Your guide to campus"}</h2><p>${name === "Schedule" ? "Important dates and appointments." : "Made for your PTC student experience."}</p>${detail}</section>`;
  $("#new-request-button")?.addEventListener("click", openModal);
  $("#help-request-button")?.addEventListener("click", openModal);
}

function renderDashboardContent() {
  const content = $(".page-content");
  content.classList.remove("alternate-page");
  content.innerHTML = dashboardMarkup;
  bindDashboardActions();
  renderRequests();
}

function bindDashboardActions() {
  $("#new-request-button").addEventListener("click", openModal);
  $("#hero-request-button").addEventListener("click", openModal);
  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.filter;
      document.querySelectorAll(".filter-tab").forEach(item => item.classList.toggle("active", item === tab));
      renderRequests();
    });
  });
  $("#view-requests").addEventListener("click", () => showPage("My requests"));
  $("#view-requests-mobile").addEventListener("click", () => showPage("My requests"));
  $("#view-announcements").addEventListener("click", () => showPage("Announcements"));
  $("#all-announcements").addEventListener("click", () => showPage("Announcements"));
  $("#schedule-action").addEventListener("click", () => showPage("Schedule"));
  $("#filter-button").addEventListener("click", () => {
    activeFilter = activeFilter === "All" ? "In review" : "All";
    document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.filter === activeFilter));
    renderRequests();
  });
  document.querySelectorAll(".announcement-link").forEach(button => {
    button.addEventListener("click", () => showToast(button.dataset.announcement));
  });
  document.querySelectorAll("[data-footer]").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    showToast(`${link.dataset.footer} information is available from the PTC student services office.`);
  }));
}

document.querySelectorAll(".nav-link, .help-button, [data-page]").forEach(button => {
  button.addEventListener("click", event => {
    const name = event.currentTarget.dataset.page;
    if (name) showPage(name);
  });
});
document.querySelectorAll(".filter-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    activeFilter = tab.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach(item => item.classList.toggle("active", item === tab));
    renderRequests();
  });
});
bindDashboardActions();
$("#close-modal").addEventListener("click", closeModal);
$("#cancel-modal").addEventListener("click", closeModal);
modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && modal.classList.contains("open")) closeModal();
  if (event.key === "Escape" && loginModal.classList.contains("open")) closeLoginModal();
  if (event.key === "Escape" && !$("#account-popover").hidden) {
    toggleAccountPopover(false);
    $("#topbar-user").focus();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $(".search-box input").focus();
  }
});
$("#login-trigger").addEventListener("click", openLoginModal);
$("#close-login-modal").addEventListener("click", closeLoginModal);
$("#cancel-login").addEventListener("click", closeLoginModal);
loginModal.addEventListener("click", event => { if (event.target === loginModal) closeLoginModal(); });
$("#login-email").addEventListener("input", event => {
  event.currentTarget.setCustomValidity("");
  $("#login-error").hidden = true;
});
$("#login-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  const emailInput = $("#login-email");
  emailInput.value = emailInput.value.trim();
  if (!isPtcEmail(emailInput.value)) {
    emailInput.setCustomValidity("Use an email address ending exactly with @paterostechnologicalcollege.edu.ph.");
    $("#login-error").textContent = "Please use your official @paterostechnologicalcollege.edu.ph email address.";
    $("#login-error").hidden = false;
    emailInput.reportValidity();
    return;
  }
  emailInput.setCustomValidity("");
  if (!form.reportValidity()) return;

  const email = emailInput.value.toLowerCase();
  const localName = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const name = localName.replace(/\b\w/g, character => character.toUpperCase()) || "PTC user";
  account = { email, role: $("#login-role").value, name };
  try {
    sessionStorage.setItem(accountStorageKey, JSON.stringify(account));
  } catch (error) {
    console.warn("Could not persist the demo sign-in for this tab.", error);
  }
  updateAccountUI();
  form.reset();
  closeLoginModal();
  showToast(`Demo sign-in complete for ${account.role.toLowerCase()} account.`);
});
$("#request-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const cooldownKey = getRequestCooldownKey();
  let lastSubmittedAt = requestCooldowns.get(cooldownKey) || 0;
  try {
    lastSubmittedAt = Math.max(lastSubmittedAt, Number(localStorage.getItem(cooldownKey)) || 0);
  } catch (error) {
    console.warn("Could not check the saved request cooldown.", error);
  }
  const remainingMs = requestCooldownMs - (Date.now() - lastSubmittedAt);
  if (remainingMs > 0) {
    showToast(`Please wait ${Math.ceil(remainingMs / 1000)} seconds before submitting another request.`);
    return;
  }

  const formData = new FormData(event.currentTarget);
  const title = String(formData.get("subject")).trim();
  if (!title) return;
  const newRequest = {
    id: `SR-2024-${String(Math.floor(100 + Math.random() * 899))}`,
    title,
    category: String(formData.get("type")),
    date: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date()),
    status: "In review",
    icon: "file",
    color: "icon-green"
  };
  const submittedAt = Date.now();
  requestCooldowns.set(cooldownKey, submittedAt);
  try {
    localStorage.setItem(cooldownKey, String(submittedAt));
  } catch (error) {
    console.warn("Could not save the request cooldown.", error);
  }
  requests.unshift(newRequest);
  let savedSuccessfully = true;
  try {
    localStorage.setItem(storageKey, JSON.stringify(requests.slice(0, 20)));
  } catch (error) {
    console.error("Could not save your request.", error);
    savedSuccessfully = false;
  }
  activeFilter = "All";
  document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.filter === "All"));
  renderRequests();
  event.currentTarget.reset();
  closeModal();
  showToast(savedSuccessfully ? `“${title}” has been submitted.` : "Request submitted, but couldn't save it on this device.");
});
$("#global-search").addEventListener("input", event => {
  searchQuery = event.target.value.trim();
  renderRequests();
});
$("#notification-button").addEventListener("click", () => $("#notification-popover").classList.toggle("open"));
document.addEventListener("click", event => {
  if (!event.target.closest(".notification-wrap")) $("#notification-popover").classList.remove("open");
});
$("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#profile-button").addEventListener("click", () => account ? signOut() : openLoginModal());
$("#topbar-user").addEventListener("click", () => toggleAccountPopover());
$("#account-signout").addEventListener("click", signOut);
document.addEventListener("click", event => {
  if (!event.target.closest(".account-menu-wrap")) toggleAccountPopover(false);
});

const now = new Date();
$("#today-date").textContent = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now).toUpperCase();
updateAccountUI();
renderRequests();
