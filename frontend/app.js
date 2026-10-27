"use strict";

const API_BASE = "http://127.0.0.1:8000";

const $ = (id) => document.getElementById(id);

let allParcels = [];
let allLockers = [];
let allUsers = [];

// Demo users mapped to roles for seamless live testing & RBAC demonstration
const DEMO_USERS = {
  admin: {
    user_id: 1,
    full_name: "Aarav Sharma",
    email: "aarav.admin@example.com",
    role: "admin"
  },
  security: {
    user_id: 2,
    full_name: "Meera Nair",
    email: "meera.security@example.com",
    role: "security"
  },
  courier: {
    user_id: 3,
    full_name: "Kiran Rao",
    email: "kiran.courier@example.com",
    role: "courier"
  },
  employee: {
    user_id: 4,
    full_name: "Ananya Iyer",
    email: "ananya.employee@example.com",
    role: "employee"
  }
};

function getCurrentUser() {
  try {
    const saved = localStorage.getItem("parcelhub_user");
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return DEMO_USERS.admin;
}

function setCurrentUser(role) {
  const user = DEMO_USERS[role] || DEMO_USERS.admin;
  localStorage.setItem("parcelhub_user", JSON.stringify(user));
  return user;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function statusBadge(status) {
  const value = String(status || "unknown").toLowerCase();
  const safeClass = value.replace(/[^a-z0-9_-]/g, "");
  return `<span class="badge ${safeClass}">${escapeHtml(value.replaceAll("_", " "))}</span>`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function apiGet(path) {
  const user = getCurrentUser();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "X-User-Role": user.role,
      "X-User-Email": user.email
    }
  });

  if (!response.ok) {
    let detail = `${path} returned HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch (_) {}
    const err = new Error(detail);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

async function apiPost(path, payload) {
  const user = getCurrentUser();
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Role": user.role,
      "X-User-Email": user.email
    },
    body: payload !== undefined ? JSON.stringify(payload) : null
  });

  if (!response.ok) {
    let message = `${path} returned HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch (_) {}
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

function setMessage(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function setupScrollReveals() {
  const elements = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: "0px 0px -25px 0px"
  });

  elements.forEach((element) => observer.observe(element));
}

function setupRoleSwitcher() {
  const user = getCurrentUser();
  const nav = document.querySelector(".nav");
  if (!nav) return;

  let switcher = $("roleSwitcher");
  if (!switcher) {
    switcher = document.createElement("div");
    switcher.id = "roleSwitcher";
    switcher.className = "role-switcher";
    switcher.innerHTML = `
      <span class="role-switcher-title">ROLE:</span>
      <select id="roleSwitcherSelect" class="role-select" title="Switch active role for RBAC demonstration">
        <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin (Aarav)</option>
        <option value="security" ${user.role === "security" ? "selected" : ""}>Security (Meera)</option>
        <option value="courier" ${user.role === "courier" ? "selected" : ""}>Courier (Kiran)</option>
        <option value="employee" ${user.role === "employee" ? "selected" : ""}>Employee (Ananya)</option>
      </select>
    `;

    const navTag = nav.querySelector(".nav-tag") || nav.querySelector(".nav-cta");
    if (navTag) {
      nav.insertBefore(switcher, navTag);
    } else {
      nav.appendChild(switcher);
    }
  }

  const select = $("roleSwitcherSelect");
  if (select) {
    select.value = user.role;
    select.onchange = async () => {
      const selectedRole = select.value;
      setCurrentUser(selectedRole);

      const page = document.body.dataset.page;
      if (page === "dashboard") await loadDashboard();
      if (page === "parcels") await loadParcelPage();
      if (page === "lockers") await loadLockerPage();
      if (page === "incidents") await loadIncidents();
      if (page === "users") await loadUsersPage();
    };
  }
}

function renderDashboardParcels(parcels) {
  const rows = $("parcelRows");
  if (!rows) return;

  const recent = [...parcels].sort((a, b) => {
    const first = new Date(a.received_at || 0).getTime();
    const second = new Date(b.received_at || 0).getTime();
    return second - first;
  }).slice(0, 5);

  rows.innerHTML = recent.length
    ? recent.map((parcel) => `
      <tr>
        <td><strong>${escapeHtml(parcel.tracking_code)}</strong></td>
        <td>${escapeHtml(parcel.description || "—")}</td>
        <td>
          ${escapeHtml(parcel.recipient_name || "—")}
          ${parcel.recipient_email
            ? `<br><small class="muted-email">${escapeHtml(parcel.recipient_email)}</small>`
            : ""}
        </td>
        <td>${statusBadge(parcel.parcel_status)}</td>
        <td>${formatDate(parcel.received_at)}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="5" class="table-message">No parcel records found.</td></tr>';
}

async function loadDashboard() {
  try {
    const [health, parcels, lockers] = await Promise.all([
      apiGet("/health"),
      apiGet("/api/parcels"),
      apiGet("/api/lockers")
    ]);

    if (health.mysql !== "connected") {
      throw new Error("MySQL is not connected.");
    }

    allParcels = parcels;
    allLockers = lockers;

    $("totalParcels").textContent = parcels.length;
    $("readyParcels").textContent = parcels.filter(
      (parcel) => parcel.parcel_status === "ready_for_pickup"
    ).length;
    $("totalLockers").textContent = lockers.length;
    $("availableLockers").textContent = lockers.filter(
      (locker) => locker.locker_status === "available"
    ).length;

    renderDashboardParcels(parcels);
  } catch (error) {
    console.error("Dashboard loading failed:", error);
    setMessage(
      "dashboardMessage",
      `Unable to load live data. Make sure the ParcelHub backend is running at ${API_BASE}.`
    );

    const rows = $("parcelRows");
    if (rows) {
      rows.innerHTML = '<tr><td colspan="5" class="table-message">Unable to load parcels. Check the backend and refresh.</td></tr>';
    }
  }
}

function renderParcelDirectory() {
  const rows = $("parcelRows");
  if (!rows) return;

  const search = ($("parcelSearch")?.value || "").trim().toLowerCase();
  const status = $("parcelFilter")?.value || "all";
  const user = getCurrentUser();

  const filtered = allParcels.filter((parcel) => {
    const searchable = [
      parcel.tracking_code,
      parcel.description,
      parcel.recipient_name,
      parcel.recipient_email,
      parcel.locker_code
    ].join(" ").toLowerCase();

    return searchable.includes(search) &&
      (status === "all" || parcel.parcel_status === status);
  });

  $("parcelCount").textContent =
    `${filtered.length} of ${allParcels.length} records`;

  const canPickupRole = ["admin", "security", "employee"].includes(user.role);

  rows.innerHTML = filtered.length
    ? filtered.map((parcel) => {
        const isPickedUp = parcel.parcel_status === "picked_up";
        const canPickupThisParcel = canPickupRole && !isPickedUp && parcel.parcel_status !== "returned" &&
          (user.role !== "employee" || parcel.recipient_user_id === user.user_id || (parcel.recipient_email && parcel.recipient_email.toLowerCase() === user.email.toLowerCase()));

        return `
      <tr>
        <td><strong>${escapeHtml(parcel.tracking_code)}</strong></td>
        <td>${escapeHtml(parcel.description || "—")}</td>
        <td>
          ${escapeHtml(parcel.recipient_name || "—")}
          ${parcel.recipient_email
            ? `<br><small class="muted-email">${escapeHtml(parcel.recipient_email)}</small>`
            : ""}
        </td>
        <td>${statusBadge(parcel.parcel_status)}</td>
        <td>
          ${parcel.locker_code
            ? `<span class="locker-tag">▤ ${escapeHtml(parcel.locker_code)}</span>`
            : `<span class="muted-dash">—</span>`}
        </td>
        <td>${formatDate(parcel.received_at)}</td>
        <td class="action-cell">
          <button class="row-button" data-parcel-id="${escapeHtml(parcel.parcel_id)}">Inspect ↗</button>
          ${canPickupThisParcel
            ? `<button class="row-button pickup-btn" data-pickup-id="${escapeHtml(parcel.parcel_id)}" data-tracking="${escapeHtml(parcel.tracking_code)}" title="Complete pickup workflow">Pick Up 📦</button>`
            : ""}
        </td>
      </tr>
    `;
    }).join("")
    : '<tr><td colspan="7" class="table-message">No parcels match your search.</td></tr>';
}

function showParcelDetails(id) {
  const parcel = allParcels.find(
    (item) => String(item.parcel_id) === String(id)
  );

  if (!parcel) return;

  $("detailTracking").textContent = parcel.tracking_code || "Parcel details";

  const fields = [
    ["Tracking code", parcel.tracking_code],
    ["Description", parcel.description],
    ["Recipient", parcel.recipient_name],
    ["Email", parcel.recipient_email],
    ["Parcel status", String(parcel.parcel_status || "").replaceAll("_", " ")],
    ["Assigned locker", parcel.locker_code ? `${parcel.locker_code} (${parcel.locker_location || "Smart Locker"})` : "None / Released"],
    ["Received", formatDate(parcel.received_at)],
    ["Picked up at", parcel.picked_up_at ? formatDate(parcel.picked_up_at) : "Not yet picked up"]
  ];

  const user = getCurrentUser();
  const isPickedUp = parcel.parcel_status === "picked_up";
  const canPickupThisParcel = ["admin", "security", "employee"].includes(user.role) && !isPickedUp && parcel.parcel_status !== "returned" &&
    (user.role !== "employee" || parcel.recipient_user_id === user.user_id || (parcel.recipient_email && parcel.recipient_email.toLowerCase() === user.email.toLowerCase()));

  $("detailContent").innerHTML = fields.map(([label, value]) => `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "—")}</strong>
    </div>
  `).join("") + (canPickupThisParcel ? `
    <div class="detail-actions" style="grid-column: 1 / -1; margin-top: 16px;">
      <button type="button" class="pickup-btn-large" data-pickup-id="${escapeHtml(parcel.parcel_id)}" data-tracking="${escapeHtml(parcel.tracking_code)}">
        Confirm Parcel Pickup 📦
      </button>
    </div>
  ` : "");

  $("parcelDetail").hidden = false;
  $("parcelDetail").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function handleParcelPickup(parcelId, trackingCode) {
  const user = getCurrentUser();
  if (user.role === "courier") {
    alert("Couriers are not authorized to pick up customer parcels.");
    return;
  }

  const confirmPickup = confirm(
    `Confirm pickup for parcel ${trackingCode}?\n\nThis will execute the pickup workflow:\n1. Update parcel status to 'picked_up'\n2. Set pickup timestamp\n3. Release the assigned locker and make it 'available'`
  );
  if (!confirmPickup) return;

  try {
    const result = await apiPost(`/api/parcels/${parcelId}/pickup`, {});
    let msg = `Parcel ${trackingCode} picked up successfully!`;
    if (result.locker_released) {
      msg += `\nLocker ${result.locker_released.locker_code} has been RELEASED and is now AVAILABLE.`;
    }
    alert(msg);
    await loadParcelPage();
    if ($("parcelDetail") && !$("parcelDetail").hidden) {
      showParcelDetails(parcelId);
    }
  } catch (error) {
    console.error("Pickup failed:", error);
    alert(`Pickup failed: ${error.message}`);
  }
}

async function loadParcelPage() {
  const rows = $("parcelRows");
  const user = getCurrentUser();

  try {
    allParcels = await apiGet("/api/parcels");
    renderParcelDirectory();
    if (user.role === "employee") {
      setMessage("parcelMessage", `Showing recipient parcels for ${user.full_name} (${user.role.toUpperCase()}).`);
    } else {
      setMessage("parcelMessage", `Showing live records from ParcelHub (Role: ${user.role.toUpperCase()}).`);
    }
  } catch (error) {
    console.error("Parcel loading failed:", error);

    if (rows) {
      rows.innerHTML = '<tr><td colspan="7" class="table-message">Could not load parcels. Check that the backend is running.</td></tr>';
    }

    setMessage("parcelMessage", error.message || "Unable to connect to the ParcelHub API.");
  }
}

function renderLockerDirectory() {
  const grid = $("lockerGrid");
  if (!grid) return;

  const search = ($("lockerSearch")?.value || "").trim().toLowerCase();
  const status = $("lockerFilter")?.value || "all";

  const filtered = allLockers.filter((locker) => {
    const searchable = [
      locker.locker_code,
      locker.location,
      locker.locker_size
    ].join(" ").toLowerCase();

    return searchable.includes(search) &&
      (status === "all" || locker.locker_status === status);
  });

  $("lockerCount").textContent =
    `${filtered.length} of ${allLockers.length} lockers`;

  grid.innerHTML = filtered.length
    ? filtered.map((locker) => `
      <article
        class="locker-card locker-card-clickable"
        role="button"
        tabindex="0"
        data-locker-id="${escapeHtml(locker.locker_id)}"
        aria-label="View details for ${escapeHtml(locker.locker_code)}"
      >
        <div class="locker-top">
          <div>
            <div class="locker-symbol">▤</div>
            <div class="locker-code">${escapeHtml(locker.locker_code)}</div>
          </div>
          ${statusBadge(locker.locker_status)}
        </div>
        <p class="locker-location">⌖ &nbsp;${escapeHtml(locker.location || "Location unavailable")}</p>
        <div class="locker-meta">
          <span>Locker size</span>
          <strong>${escapeHtml(locker.locker_size || "—")}</strong>
        </div>
        <div class="locker-card-hint">VIEW LOCKER DETAILS ↗</div>
      </article>
    `).join("")
    : '<div class="empty-state">No lockers match these filters.</div>';

  grid.querySelectorAll("[data-locker-id]").forEach((card) => {
    const openDetails = () => {
      const locker = allLockers.find(
        (item) => String(item.locker_id) === card.dataset.lockerId
      );

      if (locker) showLockerDetails(locker);
    };

    card.addEventListener("click", openDetails);

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });
  });
}

function showLockerDetails(locker) {
  let panel = $("lockerDetails");

  if (!panel) {
    panel = document.createElement("section");
    panel.id = "lockerDetails";
    panel.className = "locker-details-panel";
    panel.setAttribute("aria-live", "polite");
    $("lockerGrid").insertAdjacentElement("afterend", panel);
  }

  const status = String(locker.locker_status || "unknown")
    .replaceAll("_", " ");

  panel.innerHTML = `
    <div class="locker-details-heading">
      <div>
        <span class="eyebrow">LOCKER RECORD</span>
        <h2>${escapeHtml(locker.locker_code)}</h2>
      </div>
      <button type="button" class="locker-details-close"
        aria-label="Close locker details">×</button>
    </div>

    <div class="locker-details-grid">
      <div>
        <span>Locker code</span>
        <strong>${escapeHtml(locker.locker_code)}</strong>
      </div>
      <div>
        <span>Current status</span>
        <strong>${escapeHtml(status)}</strong>
      </div>
      <div>
        <span>Location</span>
        <strong>${escapeHtml(locker.location || "Not specified")}</strong>
      </div>
      <div>
        <span>Locker size</span>
        <strong>${escapeHtml(locker.locker_size || "Not specified")}</strong>
      </div>
    </div>

    <p class="locker-details-note">
      ${locker.locker_status === "available"
        ? "This locker is available for assignment."
        : locker.locker_status === "occupied"
          ? "This locker is currently occupied by an active parcel assignment."
          : locker.locker_status === "maintenance"
            ? "This locker is unavailable while under maintenance."
            : "Check the locker status before assigning it."}
    </p>
  `;

  panel.querySelector(".locker-details-close").addEventListener("click", () => {
    panel.remove();
  });

  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadLockerPage() {
  try {
    allLockers = await apiGet("/api/lockers");

    $("totalLockers").textContent = allLockers.length;
    $("availableLockers").textContent = allLockers.filter(
      (locker) => locker.locker_status === "available"
    ).length;
    $("occupiedLockers").textContent = allLockers.filter(
      (locker) => locker.locker_status === "occupied"
    ).length;
    $("maintenanceLockers").textContent = allLockers.filter(
      (locker) => locker.locker_status === "maintenance"
    ).length;

    renderLockerDirectory();
    setMessage("lockerMessage", "Showing live locker inventory.");
  } catch (error) {
    console.error("Locker loading failed:", error);
    $("lockerGrid").innerHTML =
      '<div class="empty-state">Unable to load lockers. Check the backend and refresh.</div>';
    setMessage("lockerMessage", error.message || "Unable to connect to the ParcelHub API.");
  }
}

function renderUsers(users) {
  const rows = $("userRows");
  if (!rows) return;

  const search = ($("userSearch")?.value || "").trim().toLowerCase();
  const role = $("userRoleFilter")?.value || "all";

  const filtered = users.filter((user) => {
    const searchable = [
      user.full_name,
      user.email,
      user.role,
      user.account_status
    ].join(" ").toLowerCase();

    return searchable.includes(search) &&
      (role === "all" || user.role === role);
  });

  $("userCount").textContent = `${filtered.length} users`;

  rows.innerHTML = filtered.length
    ? filtered.map((user) => `
      <tr>
        <td>${escapeHtml(user.full_name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.role)}</td>
        <td>${statusBadge(user.account_status)}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="4" class="table-message">No matching users found.</td></tr>';
}

async function loadUsersPage() {
  try {
    allUsers = await apiGet("/api/users");
    renderUsers(allUsers);
    setMessage("usersMessage", "Showing live user records.");
  } catch (error) {
    console.error("User loading failed:", error);
    const rows = $("userRows");
    if (rows) {
      rows.innerHTML = `<tr><td colspan="4" class="table-message">${escapeHtml(error.message || "Unable to load users.")}</td></tr>`;
    }
    setMessage("usersMessage", error.message || "Unable to connect to the ParcelHub API.");
  }
}

function setupInteractions() {
  $("parcelSearch")?.addEventListener("input", renderParcelDirectory);
  $("parcelFilter")?.addEventListener("change", renderParcelDirectory);
  $("lockerSearch")?.addEventListener("input", renderLockerDirectory);
  $("lockerFilter")?.addEventListener("change", renderLockerDirectory);
  $("userSearch")?.addEventListener("input", () => renderUsers(allUsers));
  $("userRoleFilter")?.addEventListener("change", () => renderUsers(allUsers));

  // Delegate inspect and pickup clicks
  $("parcelRows")?.addEventListener("click", (event) => {
    const pickupButton = event.target.closest("[data-pickup-id]");
    if (pickupButton) {
      handleParcelPickup(pickupButton.dataset.pickupId, pickupButton.dataset.tracking);
      return;
    }

    const button = event.target.closest("[data-parcel-id]");
    if (button) showParcelDetails(button.dataset.parcelId);
  });

  $("detailContent")?.addEventListener("click", (event) => {
    const pickupButton = event.target.closest("[data-pickup-id]");
    if (pickupButton) {
      handleParcelPickup(pickupButton.dataset.pickupId, pickupButton.dataset.tracking);
    }
  });

  $("closeDetail")?.addEventListener("click", () => {
    $("parcelDetail").hidden = true;
  });
}

function renderIncidents(incidents) {
  const list = $("incidentList");
  if (!list) return;

  if (!incidents.length) {
    list.innerHTML = '<div class="empty-state">No incidents reported yet.</div>';
    return;
  }

  list.innerHTML = incidents.map((incident) => {
    const incidentType = String(incident.incident_type || "other")
      .replaceAll("_", " ");

    const severity = String(incident.severity || "medium").toLowerCase();
    const status = String(incident.status || "open").toLowerCase();

    return `
      <article class="incident-card">
        <div class="incident-card-top">
          <div>
            <h3>${escapeHtml(incident.parcel_tracking_code)}</h3>
            <div class="incident-meta">
              Reported ${escapeHtml(formatDate(incident.created_at))}
              · By ${escapeHtml(incident.reported_by || "Unknown")}
            </div>
          </div>
          <div class="incident-tags">
            <span class="incident-tag ${escapeHtml(severity)}">
              ${escapeHtml(severity)} severity
            </span>
            <span class="incident-tag">
              ${escapeHtml(status)}
            </span>
          </div>
        </div>
        <p class="incident-description-text">
          ${escapeHtml(incident.description)}
        </p>
        <div class="incident-meta">
          Type: ${escapeHtml(incidentType)}
          · Incident ID: ${escapeHtml(incident._id)}
        </div>
      </article>
    `;
  }).join("");
}

async function loadIncidents() {
  const list = $("incidentList");
  if (!list) return;

  const user = getCurrentUser();
  const form = $("incidentForm");
  const formMsg = $("incidentFormMessage");

  // RBAC Client check: Courier and Employee cannot access incidents
  if (user.role === "courier" || user.role === "employee") {
    if (form) {
      form.querySelectorAll("input, select, textarea, button").forEach((el) => {
        el.disabled = true;
      });
      if (formMsg) {
        formMsg.innerHTML = `<span class="rbac-warning">🔒 Access Restricted: ${user.role.toUpperCase()} role cannot create incidents. Admin or Security required.</span>`;
      }
    }

    list.innerHTML = `
      <div class="rbac-restricted-box">
        <div class="rbac-lock-icon">🔒</div>
        <h3>Incident Access Restricted by RBAC</h3>
        <p>The Incident Management module is restricted to <strong>Admin</strong> and <strong>Security</strong> personnel.</p>
        <p>Your current active role is <strong class="badge ${escapeHtml(user.role)}">${escapeHtml(user.role.toUpperCase())}</strong>.</p>
        <p class="data-note">To access incidents, switch your role to <strong>Admin</strong> or <strong>Security</strong> in the top navigation bar.</p>
      </div>
    `;
    setMessage("incidentListMessage", `Access restricted for role '${user.role}'.`);
    return;
  }

  // Role is Admin or Security: enable form
  if (form) {
    form.querySelectorAll("input, select, textarea, button").forEach((el) => {
      el.disabled = false;
    });
    if (form.elements.reported_by) {
      form.elements.reported_by.value = user.role === "security" ? "security.desk" : user.email;
    }
    if (formMsg) formMsg.textContent = "";
  }

  list.innerHTML = '<p class="empty-state">Loading incidents…</p>';

  try {
    const incidents = await apiGet("/api/incidents");
    renderIncidents(incidents);
    setMessage("incidentListMessage", `${incidents.length} incident record(s) loaded from MongoDB.`);
  } catch (error) {
    console.error("Incident loading failed:", error);
    if (error.status === 403 || error.message.includes("Access denied")) {
      list.innerHTML = `
        <div class="rbac-restricted-box">
          <h3>🔒 403 Forbidden: Access Denied</h3>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    } else {
      list.innerHTML =
        '<p class="empty-state">Unable to load incidents. Check that the ParcelHub API and MongoDB are running.</p>';
    }
    setMessage("incidentListMessage", error.message);
  }
}

function setupIncidentForm() {
  const form = $("incidentForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const user = getCurrentUser();
    if (user.role === "courier" || user.role === "employee") {
      alert("Access Denied: Only Admin and Security roles can submit incident reports.");
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    const message = $("incidentFormMessage");
    const formData = new FormData(form);

    const payload = {
      parcel_tracking_code: String(formData.get("parcel_tracking_code") || "").trim(),
      incident_type: String(formData.get("incident_type") || ""),
      severity: String(formData.get("severity") || "medium"),
      reported_by: String(formData.get("reported_by") || user.email).trim(),
      description: String(formData.get("description") || "").trim()
    };

    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    message.textContent = "Saving incident to MongoDB…";

    try {
      await apiPost("/api/incidents", payload);
      message.textContent = "Incident saved successfully.";
      form.reset();
      form.elements.reported_by.value = user.role === "security" ? "security.desk" : user.email;
      form.elements.severity.value = "medium";
      await loadIncidents();
    } catch (error) {
      console.error("Incident submission failed:", error);
      message.textContent = `Could not save incident: ${error.message}`;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit incident ↗";
    }
  });
}

function initIncidentPage() {
  if (document.body.dataset.page !== "incidents") return;

  setupIncidentForm();
  $("refreshIncidents")?.addEventListener("click", loadIncidents);
  loadIncidents();
}

async function startApp() {
  setupRoleSwitcher();
  setupScrollReveals();
  setupInteractions();

  const page = document.body.dataset.page;

  if (page === "dashboard") await loadDashboard();
  if (page === "parcels") await loadParcelPage();
  if (page === "lockers") await loadLockerPage();
  if (page === "users") await loadUsersPage();
}

document.addEventListener("DOMContentLoaded", () => {
  startApp();
  initIncidentPage();
});
