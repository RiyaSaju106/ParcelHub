
"use strict";

const API_BASE = "http://127.0.0.1:8000";

const $ = (id) => document.getElementById(id);

let allParcels = [];
let allLockers = [];
let allUsers = [];

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
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
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
        <td>${escapeHtml(parcel.tracking_code)}</td>
        <td>${escapeHtml(parcel.description || "—")}</td>
        <td>
          ${escapeHtml(parcel.recipient_name || "—")}
          ${parcel.recipient_email
            ? `<br><small>${escapeHtml(parcel.recipient_email)}</small>`
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

  const filtered = allParcels.filter((parcel) => {
    const searchable = [
      parcel.tracking_code,
      parcel.description,
      parcel.recipient_name,
      parcel.recipient_email
    ].join(" ").toLowerCase();

    return searchable.includes(search) &&
      (status === "all" || parcel.parcel_status === status);
  });

  $("parcelCount").textContent =
    `${filtered.length} of ${allParcels.length} records`;

  rows.innerHTML = filtered.length
    ? filtered.map((parcel) => `
      <tr>
        <td>${escapeHtml(parcel.tracking_code)}</td>
        <td>${escapeHtml(parcel.description || "—")}</td>
        <td>
          ${escapeHtml(parcel.recipient_name || "—")}
          ${parcel.recipient_email
            ? `<br><small>${escapeHtml(parcel.recipient_email)}</small>`
            : ""}
        </td>
        <td>${statusBadge(parcel.parcel_status)}</td>
        <td>${formatDate(parcel.received_at)}</td>
        <td><button class="row-button" data-parcel-id="${escapeHtml(parcel.parcel_id)}">Inspect ↗</button></td>
      </tr>
    `).join("")
    : '<tr><td colspan="6" class="table-message">No parcels match your search.</td></tr>';
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
    ["Received", formatDate(parcel.received_at)]
  ];

  $("detailContent").innerHTML = fields.map(([label, value]) => `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "—")}</strong>
    </div>
  `).join("");

  $("parcelDetail").hidden = false;
  $("parcelDetail").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function loadParcelPage() {
  const rows = $("parcelRows");

  try {
    allParcels = await apiGet("/api/parcels");
    renderParcelDirectory();
    setMessage("parcelMessage", "Showing live records from ParcelHub.");
  } catch (error) {
    console.error("Parcel loading failed:", error);

    if (rows) {
      rows.innerHTML = '<tr><td colspan="6" class="table-message">Could not load parcels. Check that the backend is running.</td></tr>';
    }

    setMessage("parcelMessage", "Unable to connect to the ParcelHub API.");
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

  // Open details when a locker card is clicked or keyboard-activated.
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
          ? "This locker is currently in use."
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
    setMessage("lockerMessage", "Unable to connect to the ParcelHub API.");
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
      rows.innerHTML = '<tr><td colspan="4" class="table-message">Unable to load users. Check the backend.</td></tr>';
    }
    setMessage("usersMessage", "Unable to connect to the ParcelHub API.");
  }
}

function setupInteractions() {
  $("parcelSearch")?.addEventListener("input", renderParcelDirectory);
  $("parcelFilter")?.addEventListener("change", renderParcelDirectory);
  $("lockerSearch")?.addEventListener("input", renderLockerDirectory);
  $("lockerFilter")?.addEventListener("change", renderLockerDirectory);
  $("userSearch")?.addEventListener("input", () => renderUsers(allUsers));
  $("userRoleFilter")?.addEventListener("change", () => renderUsers(allUsers));

  $("parcelRows")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-parcel-id]");
    if (button) showParcelDetails(button.dataset.parcelId);
  });

  $("closeDetail")?.addEventListener("click", () => {
    $("parcelDetail").hidden = true;
  });
}

async function startApp() {
  setupScrollReveals();
  setupInteractions();

  const page = document.body.dataset.page;

  if (page === "dashboard") await loadDashboard();
  if (page === "parcels") await loadParcelPage();
  if (page === "lockers") await loadLockerPage();
  if (page === "users") await loadUsersPage();
}

document.addEventListener("DOMContentLoaded", startApp);

async function apiPost(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = `${path} returned HTTP ${response.status}`;

    try {
      const body = await response.json();
      message = body.detail || message;
    } catch (_) {
      // Keep the HTTP error message if the response isn't JSON.
    }

    throw new Error(message);
  }

  return response.json();
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

  list.innerHTML = '<p class="empty-state">Loading incidents…</p>';

  try {
    const incidents = await apiGet("/api/incidents");
    renderIncidents(incidents);
    setMessage("incidentListMessage", `${incidents.length} incident record(s) loaded from MongoDB.`);
  } catch (error) {
    console.error("Incident loading failed:", error);
    list.innerHTML =
      '<p class="empty-state">Unable to load incidents. Check that the ParcelHub API and MongoDB are running.</p>';
    setMessage("incidentListMessage", error.message);
  }
}

function setupIncidentForm() {
  const form = $("incidentForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('[type="submit"]');
    const message = $("incidentFormMessage");
    const formData = new FormData(form);

    const payload = {
      parcel_tracking_code: String(formData.get("parcel_tracking_code") || "").trim(),
      incident_type: String(formData.get("incident_type") || ""),
      severity: String(formData.get("severity") || "medium"),
      reported_by: String(formData.get("reported_by") || "").trim(),
      description: String(formData.get("description") || "").trim()
    };

    submitButton.disabled = true;
    submitButton.textContent = "Submitting…";
    message.textContent = "Saving incident to MongoDB…";

    try {
      await apiPost("/api/incidents", payload);
      message.textContent = "Incident saved successfully.";
      form.reset();
      form.elements.reported_by.value = "security.desk";
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

document.addEventListener("DOMContentLoaded", initIncidentPage);
