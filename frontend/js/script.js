(() => {
  "use strict";

  const USER_KEY = "datapass-user";
  const TOKEN_KEY = "datapass-token";
  const API_BASE = window.location.protocol === "file:" ? "http://localhost:5000/api" : "/api";
  const toastRegion = document.querySelector(".toast-region");

  async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error("The server returned an unreadable response.");
    }
    if (!response.ok) throw new Error(result.message || `Request failed (${response.status}).`);
    return result;
  }

  function apiErrorMessage(error) {
    return error instanceof TypeError
      ? "Could not connect to DataPass. Start the backend with npm start and try again."
      : error.message;
  }

  function showToast(message, kind = "success") {
    if (!toastRegion) return;
    const toast = document.createElement("div");
    toast.className = `toast ${kind}`;
    toast.setAttribute("role", kind === "error" ? "alert" : "status");
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function readUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (error) {
      console.error("Unable to read the saved demo profile.", error);
      return null;
    }
  }

  function writeUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error("Unable to save the demo profile.", error);
      showToast("Your profile could not be saved in this browser.", "error");
    }
  }

  function applyProfile() {
    const user = readUser();
    if (!user) return;
    const name = user.name || "Alex Morgan";
    const first = name.trim().split(/\s+/)[0] || "Alex";
    document.querySelectorAll("[data-user-name], [data-profile-name]").forEach((node) => {
      node.textContent = name;
    });
    document.querySelectorAll("[data-user-first]").forEach((node) => {
      node.textContent = first;
    });
    document.querySelectorAll("[data-user-email], [data-profile-email]").forEach((node) => {
      node.textContent = user.email || "alex.morgan@example.edu";
    });
    document.querySelectorAll("[data-avatar]").forEach((node) => {
      node.textContent = first.charAt(0).toUpperCase();
    });
  }

  function setupNavigation() {
    document.querySelectorAll(".sidebar-toggle").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const sidebar = document.querySelector(".sidebar");
        const backdrop = document.querySelector(".sidebar-backdrop");
        const isOpen = sidebar?.classList.toggle("open") || false;
        backdrop?.classList.toggle("show", isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));
      });
    });
    document.querySelector(".sidebar-backdrop")?.addEventListener("click", () => {
      document.querySelector(".sidebar")?.classList.remove("open");
      document.querySelector(".sidebar-backdrop")?.classList.remove("show");
      document.querySelector(".sidebar-toggle")?.setAttribute("aria-expanded", "false");
    });

    const landingToggle = document.querySelector(".landing-nav .menu-toggle");
    const publicLinks = document.querySelector(".public-links");
    landingToggle?.addEventListener("click", () => {
      const isOpen = publicLinks?.classList.toggle("open") || false;
      landingToggle.setAttribute("aria-expanded", String(isOpen));
    });
    publicLinks?.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        publicLinks.classList.remove("open");
        landingToggle?.setAttribute("aria-expanded", "false");
      });
    });

    document.querySelectorAll("[data-logout]").forEach((control) => {
      control.addEventListener("click", (event) => {
        event.preventDefault();
        try {
          localStorage.removeItem("datapass-session");
          localStorage.removeItem(TOKEN_KEY);
        } catch (error) {
          console.error("Unable to clear the demo session.", error);
        }
        window.location.href = "index.html";
      });
    });
  }

  function showFieldError(form, fieldName, message) {
    const input = form.elements.namedItem(fieldName);
    const error = form.querySelector(`[data-error-for="${fieldName}"]`);
    if (input instanceof HTMLElement) input.classList.toggle("invalid", Boolean(message));
    if (error) error.textContent = message;
  }

  function setupForms() {
    document.querySelectorAll("[data-validate]").forEach((form) => {
      form.addEventListener("input", (event) => {
        if (event.target instanceof HTMLInputElement) {
          const name = event.target.name;
          const error = form.querySelector(`[data-error-for="${name}"]`);
          if (error && event.target.classList.contains("invalid")) {
            showFieldError(form, name, "");
          }
        }
      });

      form.querySelector(".password-toggle")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        const input = form.elements.namedItem("password");
        if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) return;
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.textContent = reveal ? "Hide" : "Show";
        button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const type = form.getAttribute("data-validate");
        const values = new FormData(form);
        const email = String(values.get("email") || "").trim();
        const password = String(values.get("password") || "");
        const name = String(values.get("name") || "").trim();
        const confirm = String(values.get("confirm") || "");
        const errors = {};
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
        if (password.length < 6) errors.password = "Use at least 6 characters.";
        if (type === "register" && name.length < 2) errors.name = "Please enter your full name.";
        if (type === "register" && confirm !== password) errors.confirm = "Passwords do not match.";

        const fields = type === "register" ? ["name", "email", "password", "confirm"] : ["email", "password"];
        fields.forEach((field) => showFieldError(form, field, errors[field] || ""));
        const invalidField = fields.find((field) => errors[field]);
        if (invalidField) {
          form.elements.namedItem(invalidField)?.focus();
          return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        try {
          if (type === "register") {
            const result = await apiRequest("/auth/register", {
              method: "POST",
              body: JSON.stringify({ name, email, password })
            });
            writeUser({
              name: result.user.name,
              email: result.user.email,
              joined: result.user.createdAt
            });
            const card = form.closest(".auth-card");
            if (!card) return;
            form.hidden = true;
            const success = document.createElement("div");
            success.className = "register-success";
            success.innerHTML = '<span class="success-mark">✓</span><h3>You’re all set.</h3><p>Your account is ready. Log in to explore your DataPass workspace.</p><a class="button button-primary button-full" href="login.html">Continue to log in <span>↗</span></a>';
            card.append(success);
            return;
          }

          const result = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
          });
          localStorage.setItem(TOKEN_KEY, result.token);
          localStorage.setItem("datapass-session", "active");
          writeUser({ name: result.user.name, email: result.user.email });
          showToast("Welcome to your DataPass workspace!");
          window.setTimeout(() => { window.location.href = "dashboard.html"; }, 500);
        } catch (error) {
          showToast(apiErrorMessage(error), "error");
          submitButton.disabled = false;
        }
      });
    });
  }

  function formatBytes(size) {
    if (size < 1024) return `${size} bytes`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  function parseCsvPreview(text) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
    if (lines.length < 2) return null;
    const parseRow = (line) => {
      const values = [];
      let value = "";
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"' && line[index + 1] === '"' && quoted) {
          value += '"';
          index += 1;
        } else if (char === '"') {
          quoted = !quoted;
        } else if (char === "," && !quoted) {
          values.push(value);
          value = "";
        } else {
          value += char;
        }
      }
      values.push(value);
      return values;
    };
    const rows = lines.map(parseRow);
    const width = rows[0].length;
    const missing = rows.slice(1).reduce((total, row) => {
      return total + Array.from({ length: width }, (_, index) => row[index] ?? "").filter((value) => !value.trim()).length;
    }, 0);
    const uniqueRows = new Set(rows.slice(1).map((row) => JSON.stringify(row)));
    return { rows: rows.length - 1, columns: width, missing, duplicates: rows.length - 1 - uniqueRows.size };
  }

  function setPreview(data) {
    if (!data) return;
    const output = {
      "[data-preview-rows]": Number(data.rows).toLocaleString(),
      "[data-preview-columns]": Number(data.columns).toLocaleString(),
      "[data-preview-missing]": Number(data.missing).toLocaleString(),
      "[data-preview-duplicates]": Number(data.duplicates).toLocaleString()
    };
    Object.entries(output).forEach(([selector, value]) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = value;
    });
  }

  function setupUpload() {
    const input = document.querySelector("#dataset-file");
    const zone = document.querySelector("[data-drop-zone]");
    const info = document.querySelector("[data-file-info]");
    if (!(input instanceof HTMLInputElement) || !zone || !info) return;

    let selectedFile = null;
    let preview = null;
    input.accept = ".csv,.xlsx";
    zone.querySelector("small").textContent = "CSV, XLSX · MAX 25 MB";
    const secureNote = document.querySelector(".secure-note");
    if (secureNote?.lastChild) {
      secureNote.lastChild.textContent = " Your file is stored privately on this server; it is not exposed as a public file link.";
    }
    const browse = () => input.click();
    zone.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("[data-browse]")) {
        event.preventDefault();
      }
      browse();
    });
    zone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        browse();
      }
    });
    ["dragenter", "dragover"].forEach((type) => zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach((type) => zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.remove("dragover");
    }));
    zone.addEventListener("drop", (event) => {
      const file = event.dataTransfer?.files[0];
      if (file) acceptFile(file);
    });
    input.addEventListener("change", () => {
      if (input.files?.[0]) acceptFile(input.files[0]);
    });
    document.querySelector(".remove-file")?.addEventListener("click", () => {
      selectedFile = null;
      preview = null;
      input.value = "";
      info.hidden = true;
      zone.hidden = false;
      document.querySelector(".upload-progress-wrap").hidden = true;
      document.querySelector("[data-passport-link]")?.remove();
    });

    function acceptFile(file) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!["csv", "xlsx"].includes(extension || "")) {
        showToast("Choose a CSV or XLSX file.", "error");
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        showToast("This file is larger than the 25 MB demo limit.", "error");
        return;
      }
      selectedFile = file;
      zone.hidden = true;
      info.hidden = false;
      document.querySelector("[data-file-name]").textContent = file.name;
      document.querySelector("[data-file-size]").textContent = `${formatBytes(file.size)} · Ready to upload`;
      if (extension === "xlsx") {
        preview = { rows: 0, columns: 0, missing: 0, duplicates: 0 };
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const text = String(reader.result || "");
        preview = parseCsvPreview(text);
        if (preview) setPreview(preview);
        else showToast("The CSV needs a header row and at least one data row.", "error");
      });
      reader.addEventListener("error", () => showToast("The selected file could not be read.", "error"));
      reader.readAsText(file);
    }

    document.querySelector("[data-upload]")?.addEventListener("click", () => {
      const nameInput = document.querySelector("#dataset-name");
      const datasetName = nameInput.value.trim();
      const datasetId = new URLSearchParams(window.location.search).get("id");
      if (!datasetId && !datasetName) {
        nameInput.focus();
        showToast("Give this dataset a name before uploading.", "error");
        return;
      }
      if (!selectedFile) {
        showToast("Choose a dataset file to continue.", "error");
        return;
      }
      if (!preview) {
        showToast("Add a valid CSV, TSV, or JSON file to continue.", "error");
        return;
      }

      const progressWrap = document.querySelector(".upload-progress-wrap");
      const progress = document.querySelector("[data-progress]");
      const progressLabel = document.querySelector("[data-progress-label]");
      const uploadButton = document.querySelector("[data-upload]");
      progressWrap.hidden = false;
      uploadButton.disabled = true;
      uploadButton.setAttribute("aria-busy", "true");
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (datasetId) formData.append("datasetId", datasetId);
      else formData.append("datasetName", datasetName);
      formData.append("versionNote", document.querySelector("#upload-note").value.trim());
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/datasets/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}`);
      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const value = Math.round(event.loaded / event.total * 100);
        progress.style.width = `${value}%`;
        progressLabel.textContent = `${value}%`;
      });
      xhr.addEventListener("load", () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300) {
            throw new Error(result.message || `Upload failed (${xhr.status}).`);
          }
          progress.style.width = "100%";
          progressLabel.textContent = "100%";
          setPreview({
            rows: result.version.rowsCount,
            columns: result.version.columnsCount,
            missing: result.version.missingValuesCount,
            duplicates: result.version.duplicateRowsCount
          });
          showToast(`“${result.dataset.datasetName}” uploaded as ${result.version.versionNumber}.`);
          const passportLink = document.createElement("a");
          passportLink.className = "button button-outline button-full";
          passportLink.href = `passport.html?id=${encodeURIComponent(result.dataset.id)}`;
          passportLink.dataset.passportLink = "";
          passportLink.textContent = "View dataset passport";
          document.querySelector("[data-passport-link]")?.remove();
          uploadButton.after(passportLink);
          window.history.replaceState({}, "", `upload.html?id=${encodeURIComponent(result.dataset.id)}`);
          uploadButton.innerHTML = 'Upload next version <span>↗</span>';
          uploadButton.disabled = false;
          uploadButton.removeAttribute("aria-busy");
        } catch (error) {
          showToast(error instanceof SyntaxError ? "The server returned an unreadable response." : error.message, "error");
          uploadButton.disabled = false;
          uploadButton.removeAttribute("aria-busy");
        }
      });
      xhr.addEventListener("error", () => {
        showToast("Could not connect to DataPass. Start the backend with npm start and try again.", "error");
        uploadButton.disabled = false;
        uploadButton.removeAttribute("aria-busy");
      });
      xhr.send(formData);
    });
  }

  function setupHistory() {
    const search = document.querySelector("[data-history-search]");
    const filter = document.querySelector("[data-history-filter]");
    const tbody = document.querySelector("[data-history-rows]");
    if (!search || !filter || !tbody) return;
    let rows = Array.from(tbody.querySelectorAll("tr"));
    const update = () => {
      const term = search.value.trim().toLowerCase();
      let visible = 0;
      rows.forEach((row) => {
        const matchesText = row.textContent.toLowerCase().includes(term);
        const group = row.dataset.dateGroup || "older";
        const matchesFilter = filter.value === "all" || group === filter.value;
        row.hidden = !(matchesText && matchesFilter);
        if (!row.hidden) visible += 1;
      });
      const empty = document.querySelector("[data-empty-state]");
      empty.hidden = visible > 0;
      document.querySelector("[data-results-count]").textContent = `Showing ${visible} ${visible === 1 ? "version" : "versions"}`;
    };
    const addCell = (row, content, className) => {
      const cell = document.createElement("td");
      if (content instanceof Node) cell.append(content);
      else cell.textContent = content;
      if (className) cell.className = className;
      row.append(cell);
    };
    const makeRow = (version) => {
      const row = document.createElement("tr");
      const ageDays = (Date.now() - new Date(version.uploadDate).getTime()) / 86400000;
      row.dataset.dateGroup = ageDays <= 30 ? "recent" : "older";
      const datasetLink = document.createElement("a");
      datasetLink.className = "dataset-cell";
      datasetLink.href = `passport.html?id=${encodeURIComponent(version.datasetId)}`;
      const symbol = document.createElement("span");
      symbol.className = "dataset-symbol sym-violet";
      symbol.textContent = "◈";
      const description = document.createElement("span");
      const title = document.createElement("b");
      title.textContent = version.datasetName;
      const filename = document.createElement("small");
      filename.textContent = version.originalFileName || "Dataset version";
      description.append(title, filename);
      datasetLink.append(symbol, description);
      addCell(row, datasetLink);

      const versionValue = document.createElement("span");
      versionValue.className = "version-pill";
      versionValue.textContent = version.versionNumber;
      addCell(row, versionValue);
      addCell(row, new Date(version.uploadDate).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }));
      addCell(row, Number(version.rowsCount).toLocaleString());
      addCell(row, Number(version.columnsCount).toLocaleString());
      addCell(row, readUser()?.name || "You");
      const action = document.createElement("a");
      action.className = "row-link";
      action.href = `passport.html?id=${encodeURIComponent(version.datasetId)}`;
      action.setAttribute("aria-label", `View ${version.datasetName} passport`);
      action.textContent = "↗";
      addCell(row, action);
      return row;
    };
    search.addEventListener("input", update);
    filter.addEventListener("change", update);
    document.querySelector("[data-load-more]")?.addEventListener("click", () => {
      showToast("All available versions are shown.");
    });

    if (localStorage.getItem(TOKEN_KEY)) {
      apiRequest("/datasets/history")
        .then((result) => {
          rows = result.history.map(makeRow);
          tbody.replaceChildren(...rows);
          update();
        })
        .catch((error) => showToast(apiErrorMessage(error), "error"));
    } else {
      update();
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function setupComparison() {
    const compare = document.querySelector("[data-compare]");
    const older = document.querySelector("[data-version-one]");
    const newer = document.querySelector("[data-version-two]");
    if (!compare || !older || !newer) return;
    const populateVersions = async () => {
      if (!localStorage.getItem(TOKEN_KEY)) return;
      try {
        const result = await apiRequest("/datasets/history");
        const versions = result.history || [];
        const counts = new Map();
        versions.forEach((version) => counts.set(version.datasetId, (counts.get(version.datasetId) || 0) + 1));
        const datasetId = versions.find((version) => counts.get(version.datasetId) > 1)?.datasetId;
        const datasetVersions = versions.filter((version) => version.datasetId === datasetId);
        if (datasetVersions.length < 2) {
          compare.disabled = true;
          showToast("Upload at least two versions of one dataset to compare them.", "error");
          return;
        }
        [older, newer].forEach((select) => {
          select.replaceChildren(...datasetVersions.map((version) => {
            const option = document.createElement("option");
            option.value = String(version.id);
            option.textContent = `${version.versionNumber} · ${new Date(version.uploadDate).toLocaleDateString("en-US")}`;
            return option;
          }));
        });
        older.selectedIndex = 1;
        newer.selectedIndex = 0;
        const title = document.querySelector(".compare-dataset h2");
        if (title) title.textContent = datasetVersions[0].datasetName;
      } catch (error) {
        showToast(apiErrorMessage(error), "error");
      }
    };
    populateVersions();

    compare.addEventListener("click", async () => {
      if (older.value === newer.value) {
        showToast("Choose two different versions to compare.", "error");
        return;
      }
      if (localStorage.getItem(TOKEN_KEY)) {
        compare.disabled = true;
        try {
          const result = await apiRequest(`/datasets/compare/${encodeURIComponent(older.value)}/${encodeURIComponent(newer.value)}`);
          document.querySelector("[data-change-rows-added]").textContent = result.comparison.rowsAdded.toLocaleString();
          document.querySelector("[data-change-rows-removed]").textContent = result.comparison.rowsRemoved.toLocaleString();
          document.querySelector("[data-change-cols-added]").textContent = result.comparison.columnsAdded.toLocaleString();
          document.querySelector("[data-change-cols-removed]").textContent = result.comparison.columnsRemoved.toLocaleString();
          document.querySelector(".compared-label").textContent = `${result.version1.versionNumber} → ${result.version2.versionNumber}`;
          showToast(result.note || "Version comparison complete.");
        } catch (error) {
          showToast(apiErrorMessage(error), "error");
        } finally {
          compare.disabled = false;
        }
        return;
      }
      const positions = { "v1.0": 0, "v2.0": 1, "v2.3": 2, "v2.4": 3 };
      const counts = [10480, 11920, 12610, 12840];
      const left = positions[older.value];
      const right = positions[newer.value];
      const delta = counts[right] - counts[left];
      document.querySelector("[data-change-rows-added]").textContent = Math.max(delta, 0).toLocaleString();
      document.querySelector("[data-change-rows-removed]").textContent = Math.max(-delta, 0).toLocaleString();
      document.querySelector("[data-change-cols-added]").textContent = right > left ? "1" : "0";
      document.querySelector("[data-change-cols-removed]").textContent = right < left ? "1" : "0";
      document.querySelector(".compared-label").innerHTML = `${escapeHtml(older.value)} <span>→</span> ${escapeHtml(newer.value)}`;
      showToast(`Showing changes from ${older.value} to ${newer.value}.`);
      drawCharts();
    });
  }

  async function setupDashboardData() {
    if (!document.querySelector(".stats-grid") || !localStorage.getItem(TOKEN_KEY)) return;
    try {
      const result = await apiRequest("/datasets/dashboard");
      const cards = document.querySelectorAll(".stats-grid .stat-card > strong");
      if (cards[0]) cards[0].textContent = String(result.totalDatasets).padStart(2, "0");
      if (cards[1]) cards[1].textContent = String(result.totalVersions);
      if (cards[2]) cards[2].textContent = String(result.totalUploads);
      const activities = document.querySelectorAll(".activity-row");
      result.recentUploads.slice(0, activities.length).forEach((upload, index) => {
        const row = activities[index];
        row.querySelector("b").textContent = upload.datasetName;
        row.querySelector("p").textContent = `Uploaded a new version · ${upload.versionNumber}`;
        row.querySelector("time").textContent = new Date(upload.uploadDate).toLocaleDateString();
      });
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    }
  }

  async function setupProfileData() {
    if (!document.querySelector(".profile-layout") || !localStorage.getItem(TOKEN_KEY)) return;
    try {
      const profile = await apiRequest("/profile");
      writeUser({ name: profile.name, email: profile.email, joined: profile.createdAt });
      applyProfile();
      const joined = document.querySelector("[data-joined-date]");
      if (joined && profile.createdAt) {
        joined.textContent = new Date(profile.createdAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric"
        });
      }
      const stats = document.querySelectorAll(".profile-stat-row b");
      if (stats[0]) stats[0].textContent = String(profile.totalUploads || 0);
      if (stats[1]) stats[1].textContent = String(profile.totalDatasets).padStart(2, "0");
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    }
  }

  async function setupPassportData() {
    if (!document.querySelector(".passport-card") || !localStorage.getItem(TOKEN_KEY)) return;
    const datasetId = new URLSearchParams(window.location.search).get("id");
    if (!datasetId) return;
    try {
      const passport = await apiRequest(`/datasets/passport/${encodeURIComponent(datasetId)}`);
      const newVersionLink = document.querySelector(".passport-card ~ .timeline-panel .panel-heading .button");
      if (newVersionLink) newVersionLink.href = `upload.html?id=${encodeURIComponent(passport.datasetId)}`;
      const cardTitle = document.querySelector(".passport-card-top h2");
      if (cardTitle) cardTitle.firstChild.textContent = passport.datasetName;
      const fields = document.querySelectorAll(".passport-info-grid > div > b");
      if (fields[0]) fields[0].textContent = passport.passportId;
      if (fields[1]) fields[1].textContent = passport.owner;
      if (fields[2]) fields[2].textContent = new Date(passport.uploadDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
      if (fields[3]?.querySelector(".version-pill")) {
        fields[3].querySelector(".version-pill").textContent = passport.currentVersion || "—";
      }
      if (fields[4]) fields[4].innerHTML = `${Number(passport.rowsCount).toLocaleString()} <small>rows</small>`;
      if (fields[5]) fields[5].innerHTML = `${Number(passport.columnsCount).toLocaleString()} <small>columns</small>`;
      const timeline = document.querySelector(".timeline");
      if (!timeline) return;
      timeline.replaceChildren(...passport.uploadHistory.map((version, index) => {
        const item = document.createElement("article");
        item.className = `timeline-item${index === 0 ? " current" : ""}`;
        const date = new Date(version.uploadDate);
        item.innerHTML = `<span class="timeline-node">${index === 0 ? "✳" : "↗"}</span><div class="timeline-date">${escapeHtml(date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase())}${index === 0 ? ' <span class="current-pill">CURRENT</span>' : ""}</div><div class="timeline-content"><div><h3>${escapeHtml(version.versionNumber)}</h3><p>${escapeHtml(version.versionNote || version.originalFileName)}</p></div><span class="timeline-rows">${Number(version.rowsCount).toLocaleString()} rows <span>·</span> ${version.columnsCount} cols</span></div><div class="timeline-by">Uploaded by <b>${escapeHtml(passport.owner)}</b> <span>·</span> ${formatBytes(version.fileSize)}</div>`;
        return item;
      }));
    } catch (error) {
      showToast(apiErrorMessage(error), "error");
    }
  }

  function setupProfileEditor() {
    document.querySelector("[data-edit-profile]")?.addEventListener("click", async () => {
      const current = readUser() || { name: "Alex Morgan", email: "alex.morgan@example.edu" };
      const name = window.prompt("What name should appear on your profile?", current.name);
      if (name === null) return;
      if (name.trim().length < 2) {
        showToast("Please enter a name with at least 2 characters.", "error");
        return;
      }
      const email = window.prompt("What email should appear on your profile?", current.email);
      if (email === null) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        showToast("Please enter a valid email address.", "error");
        return;
      }
      if (localStorage.getItem(TOKEN_KEY)) {
        try {
          const result = await apiRequest("/profile", {
            method: "PATCH",
            body: JSON.stringify({ name: name.trim(), email: email.trim() })
          });
          writeUser({ ...current, name: result.user.name, email: result.user.email });
          applyProfile();
          showToast(result.message);
        } catch (error) {
          showToast(apiErrorMessage(error), "error");
        }
        return;
      }
      writeUser({ ...current, name: name.trim(), email: email.trim() });
      applyProfile();
      showToast("Your profile has been updated locally.");
    });
  }

  function setupCopyButtons() {
    document.querySelectorAll("[data-copy-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = document.querySelector("[data-passport-id]")?.textContent?.trim();
        if (!id) return;
        try {
          await navigator.clipboard.writeText(id);
          showToast("Passport ID copied to clipboard.");
        } catch (error) {
          console.error("Clipboard access was not available.", error);
          showToast(`Passport ID: ${id}`, "error");
        }
      });
    });
  }

  function drawCharts() {
    document.querySelectorAll("canvas[data-chart]").forEach((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      const width = rect.width;
      const height = rect.height;
      const type = canvas.dataset.chart;
      const styles = getComputedStyle(document.documentElement);
      const purple = styles.getPropertyValue("--purple").trim() || "#7359e8";
      const cyan = styles.getPropertyValue("--cyan").trim() || "#37c8d8";
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "#f0eff6";
      ctx.lineWidth = 1;

      if (type === "uploads") {
        const values = [5, 8, 6, 11, 8, 13, 10];
        const gap = 12;
        const barWidth = Math.max(8, (width - gap * (values.length - 1) - 16) / values.length);
        const usable = height - 17;
        values.forEach((value, index) => {
          const barHeight = usable * value / 15;
          const x = 8 + index * (barWidth + gap);
          const y = height - barHeight - 5;
          ctx.fillStyle = index === 5 ? cyan : index === 6 ? "#c6bff3" : "#e4e1fb";
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
          ctx.fill();
        });
        return;
      }

      const values = type === "compare" ? [36, 58, 75, 84] : [22, 29, 34, 31, 43, 39, 55, 52, 67, 65, 76, 87];
      const secondary = type === "growth" ? [15, 19, 26, 25, 34, 32, 38, 44, 48, 46, 59, 67] : [];
      const padding = { top: 10, right: 7, bottom: 10, left: 7 };
      const plotWidth = width - padding.left - padding.right;
      const plotHeight = height - padding.top - padding.bottom;
      for (let line = 0; line < 4; line += 1) {
        const y = padding.top + (plotHeight / 3) * line;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }
      if (type === "compare") {
        const barWidth = Math.min(29, plotWidth / 8);
        values.forEach((value, index) => {
          const barHeight = plotHeight * value / 100;
          const x = padding.left + plotWidth * (index + .5) / values.length - barWidth / 2;
          const y = padding.top + plotHeight - barHeight;
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          grad.addColorStop(0, "#8472ed");
          grad.addColorStop(1, "#c9c1f7");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [5, 5, 0, 0]);
          ctx.fill();
        });
        return;
      }
      const drawLine = (data, color, fillColor) => {
        const points = data.map((value, index) => ({
          x: padding.left + plotWidth * index / (data.length - 1),
          y: padding.top + plotHeight - plotHeight * value / 100
        }));
        ctx.beginPath();
        points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        if (fillColor) {
          ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
          ctx.lineTo(points[0].x, height - padding.bottom);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, padding.top, 0, height);
          grad.addColorStop(0, fillColor);
          grad.addColorStop(1, "rgba(115, 89, 232, 0)");
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.beginPath();
          points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
        points.forEach((point, index) => {
          if (index !== points.length - 1 && index % 2 !== 0) return;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      };
      if (secondary.length) drawLine(secondary, cyan, null);
      drawLine(values, purple, "#7359e81c");
    });
  }

  let chartResizeTimer;
  window.addEventListener("resize", () => {
    window.clearTimeout(chartResizeTimer);
    chartResizeTimer = window.setTimeout(drawCharts, 100);
  });

  applyProfile();
  setupNavigation();
  setupForms();
  setupUpload();
  setupHistory();
  setupComparison();
  setupProfileEditor();
  setupCopyButtons();
  setupDashboardData();
  setupProfileData();
  setupPassportData();
  drawCharts();
})();
