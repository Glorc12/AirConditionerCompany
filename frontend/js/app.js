/* Minimal single-file app: in-memory + localStorage.
   Optional API integration: set API_BASE to your backend if needed. */

const API_BASE = ""; // пример: "http://127.0.0.1:5000/api"

const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdhZcExx6LSIXxk0ub55mSu-WIh23WYdGG9HY5EZhLDo7P8eA/viewform?usp=sf_link";

const LS_KEYS = {
  requests: "rr_requests_v1",
  auth: "rr_auth_v1"
};

const ROLES = {
  admin: "Администратор",
  operator: "Оператор",
  specialist: "Специалист",
  manager: "Менеджер по качеству"
};

const STATUS = {
  open: "Открыта",
  in_progress: "В ремонте",
  waiting_parts: "Ожидание комплектующих",
  done: "Завершена"
};

const STATUS_BADGE = {
  open: "badge--info",
  in_progress: "badge--warn",
  waiting_parts: "badge--warn",
  done: "badge--ok"
};

const demoUsers = [
  { username: "admin", password: "admin", name: "Администратор", role: "admin" },
  { username: "operator", password: "operator", name: "Оператор", role: "operator" },
  { username: "specialist", password: "specialist", name: "Специалист", role: "specialist" },
  { username: "manager", password: "manager", name: "Менеджер", role: "manager" }
];

const state = {
  user: null,
  requests: [],
  activeTab: "requests",
  selectedRequestId: null
};

function uuidv4() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  // fallback UUIDv4 через getRandomValues
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0];
    return (Number(c) ^ (r & (15 >> (Number(c) / 4)))).toString(16);
  });
}


const $ = (sel) => document.querySelector(sel);

function nowLocalInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toISOFromLocalInput(v) {
  if (!v) return null;
  const dt = new Date(v);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

function toLocalInputFromISO(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

function showToast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => (t.hidden = true), 2600);
}

function saveRequests() {
  localStorage.setItem(LS_KEYS.requests, JSON.stringify(state.requests));
}

function loadRequests() {
  const raw = localStorage.getItem(LS_KEYS.requests);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveAuth() {
  localStorage.setItem(LS_KEYS.auth, JSON.stringify({ user: state.user }));
}

function loadAuth() {
  const raw = localStorage.getItem(LS_KEYS.auth);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj?.user ?? null;
  } catch {
    return null;
  }
}

async function apiFetch(path, options = {}) {
  if (!API_BASE) throw new Error("API disabled");
  const url = API_BASE.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

function seedIfEmpty() {
  if (state.requests.length > 0) return;
  const base = [
    {
      id: 1001,
      created_at: new Date().toISOString(),
      equipment_type: "Кондиционер",
      model: "Daikin FTXF",
      problem: "Не охлаждает, слышен шум",
      customer_name: "Иванов Иван",
      phone: "+7 900 000-00-00",
      status: "open",
      assignee: "",
      deadline: "",
      completed_at: null,
      fault_type: "Плохое охлаждение",
      comments: []
    },
    {
      id: 1002,
      created_at: new Date(Date.now() - 36 * 3600_000).toISOString(),
      equipment_type: "Вентиляция",
      model: "Systemair VTR",
      problem: "Ошибка датчика, периодически отключается",
      customer_name: "Петров Петр",
      phone: "+7 901 111-11-11",
      status: "in_progress",
      assignee: "Сидоров С.С.",
      deadline: "",
      completed_at: null,
      fault_type: "Электрика",
      comments: [
        {
          id: uuidv4(),
          author: "Сидоров С.С.",
          created_at: new Date().toISOString(),
          text: "Начата диагностика, требуется уточнить номер платы."
        }
      ]
    }
  ];
  state.requests = base;
  saveRequests();
}

function setUser(user) {
  state.user = user;
  saveAuth();
  renderAuth();
  renderAll();
}

function logout() {
  state.user = null;
  localStorage.removeItem(LS_KEYS.auth);
  renderAuth();
  showToast("Вы вышли из системы");
}

function roleTitle(role) {
  return ROLES[role] || role || "—";
}

function renderAuth() {
  const loggedIn = !!state.user;
  $("#loginView").hidden = loggedIn;
  $("#appView").hidden = !loggedIn;
  $("#userbar").hidden = !loggedIn;

  if (loggedIn) {
    $("#userName").textContent = state.user.name;
    $("#userRole").textContent = roleTitle(state.user.role);
    $("#managerTools").hidden = state.user.role !== "manager" && state.user.role !== "admin";
  }
}

function setActiveTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.tab === tab);
  });
  $("#tab-requests").hidden = tab !== "requests";
  $("#tab-stats").hidden = tab !== "stats";
  $("#tab-quality").hidden = tab !== "quality";
}

function statusBadge(status) {
  const cls = STATUS_BADGE[status] || "badge--info";
  const label = STATUS[status] || status;
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filteredRequests() {
  const q = ($("#searchInput").value || "").trim().toLowerCase();
  const st = $("#statusFilter").value;
  const ass = ($("#assigneeFilter").value || "").trim().toLowerCase();

  return state.requests.filter((r) => {
    const matchesQ =
      !q ||
      String(r.id).includes(q) ||
      (r.customer_name || "").toLowerCase().includes(q) ||
      (r.phone || "").toLowerCase().includes(q) ||
      (r.model || "").toLowerCase().includes(q);

    const matchesStatus = !st || r.status === st;
    const matchesAssignee = !ass || (r.assignee || "").toLowerCase().includes(ass);

    return matchesQ && matchesStatus && matchesAssignee;
  });
}

function renderRequestsTable() {
  const tbody = $("#requestsTbody");
  const rows = filteredRequests()
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .map((r) => {
      return `
        <tr>
          <td><span class="badge">${escapeHtml(r.id)}</span></td>
          <td>${escapeHtml(formatDateTime(r.created_at))}</td>
          <td>${escapeHtml(r.equipment_type)}</td>
          <td>${escapeHtml(r.model)}</td>
          <td>${escapeHtml(r.customer_name)}</td>
          <td><span class="badge">${escapeHtml(r.phone)}</span></td>
          <td>${statusBadge(r.status)}</td>
          <td>${escapeHtml(r.assignee || "—")}</td>
          <td>
            <div class="rowActions">
              <button class="btn btn--ghost" data-action="open" data-id="${r.id}" type="button">Открыть</button>
              <button class="btn" data-action="status" data-id="${r.id}" type="button">Сменить статус</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.innerHTML = rows || "";
  $("#requestsEmpty").hidden = filteredRequests().length !== 0;
}

function nextStatus(s) {
  const order = ["open", "in_progress", "waiting_parts", "done"];
  const idx = Math.max(0, order.indexOf(s));
  return order[(idx + 1) % order.length];
}

function canEditRequest() {
  const role = state.user?.role;
  return role === "admin" || role === "operator" || role === "manager";
}

function canComment() {
  const role = state.user?.role;
  return role === "admin" || role === "specialist" || role === "manager";
}

function openRequestModal(requestId) {
  const modal = $("#requestModal");
  const form = $("#requestForm");
  const isNew = requestId == null;

  let r;
  if (isNew) {
    const maxId = state.requests.reduce((m, x) => Math.max(m, Number(x.id) || 0), 1000);
    r = {
      id: maxId + 1,
      created_at: new Date().toISOString(),
      equipment_type: "",
      model: "",
      problem: "",
      customer_name: "",
      phone: "",
      status: "open",
      assignee: "",
      deadline: "",
      completed_at: null,
      fault_type: "",
      comments: []
    };
  } else {
    r = state.requests.find((x) => Number(x.id) === Number(requestId));
    if (!r) {
      showToast("Заявка не найдена");
      return;
    }
  }

  state.selectedRequestId = r.id;
  $("#requestModalTitle").textContent = isNew ? "Новая заявка" : `Заявка №${r.id}`;

  form.elements.id.value = r.id;
  form.elements.created_at.value = toLocalInputFromISO(r.created_at) || nowLocalInputValue();
  form.elements.equipment_type.value = r.equipment_type || "";
  form.elements.model.value = r.model || "";
  form.elements.problem.value = r.problem || "";
  form.elements.customer_name.value = r.customer_name || "";
  form.elements.phone.value = r.phone || "";
  form.elements.status.value = r.status || "open";
  form.elements.assignee.value = r.assignee || "";
  form.elements.deadline.value = r.deadline || "";
  form.elements.completed_at.value = toLocalInputFromISO(r.completed_at) || "";
  form.elements.fault_type.value = r.fault_type || "";

  $("#commentText").value = "";
  renderComments(r);

  const editable = canEditRequest();
  [
    "created_at", "equipment_type", "model", "problem", "customer_name", "phone",
    "status", "assignee", "deadline", "completed_at", "fault_type"
  ].forEach((name) => {
    form.elements[name].disabled = !editable;
  });

  $("#btnSaveRequest").disabled = !editable;
  $("#btnDeleteRequest").disabled = isNew || !editable;

  const commentable = canComment();
  $("#commentText").disabled = !commentable;
  $("#btnAddComment").disabled = !commentable;

  modal.showModal();
}

function closeModal() {
  const modal = $("#requestModal");
  if (modal.open) modal.close();
  state.selectedRequestId = null;
}

function renderComments(r) {
  const list = $("#commentsList");
  const items = (r.comments || [])
    .slice()
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .map((c) => {
      return `
        <div class="comment">
          <div class="comment__meta">
            <div>${escapeHtml(c.author || "—")}</div>
            <div>${escapeHtml(formatDateTime(c.created_at))}</div>
          </div>
          <div class="comment__text">${escapeHtml(c.text || "")}</div>
        </div>
      `;
    })
    .join("");

  list.innerHTML = items || `<div class="muted">Комментариев пока нет.</div>`;
}

/* Переопределяем apiFetch так, чтобы работало и с относительным API (/api/...)
   и с API_BASE (если вдруг вынесешь бэкенд отдельно). */
async function apiFetch(path, options = {}) {
  const base = (API_BASE || "").replace(/\/+$/, "");
  const url = (base ? base : "") + "/" + String(path).replace(/^\/+/, "");

  const token = state.user?.token;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

function mapRoleFromApi(user_type) {
  // В БД роли у тебя на русском (например "Менеджер по качеству"). [file:28]
  if (!user_type) return "operator";
  const t = String(user_type).toLowerCase();
  if (t.includes("админ")) return "admin";
  if (t.includes("оператор")) return "operator";
  if (t.includes("специалист") || t.includes("мастер")) return "specialist";
  if (t.includes("менеджер")) return "manager";
  return "operator";
}

function normalizeRequestFromApi(r) {
  // Поля API см. в /api/requests/ (data[].request_id/start_date/...) [file:27]
  return {
    id: r.request_id,
    created_at: r.start_date ? new Date(r.start_date).toISOString() : new Date().toISOString(),
    equipment_type: r.climate_tech_type || "",
    model: r.climate_tech_model || "",
    problem: r.problem_description || "",
    customer_name: r.client_id ? `Клиент #${r.client_id}` : "—",
    phone: "—",
    status: (r.request_status || "Новая заявка").toString(),
    assignee: r.master_id ? `Специалист #${r.master_id}` : "",
    deadline: "",
    completed_at: r.completion_date ? new Date(r.completion_date).toISOString() : null,
    fault_type: "",
    comments: []
  };
}

function renderStats() {
  const total = state.requests.length;
  const done = state.requests.filter((r) => String(r.status).toLowerCase().includes("заверш")).length;

  // Среднее время: completion_date - start_date (если есть)
  const durations = state.requests
    .filter((r) => r.completed_at && r.created_at)
    .map((r) => new Date(r.completed_at).getTime() - new Date(r.created_at).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);

  const avgMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const avgHuman = avgMs == null ? "—" : `${Math.round(avgMs / 3600_000)} ч`;

  $("#kpiTotal").textContent = String(total);
  $("#kpiDone").textContent = String(done);
  $("#kpiAvg").textContent = avgHuman;

  // По типам неисправностей (берём fault_type если есть, иначе "Не указано")
  const counter = new Map();
  for (const r of state.requests) {
    const key = (r.fault_type || "Не указано").trim() || "Не указано";
    counter.set(key, (counter.get(key) || 0) + 1);
  }

  const rows = [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join("");

  $("#breakdownTbody").innerHTML = rows || `<tr><td colspan="2" class="muted">Нет данных</td></tr>`;
}

function renderQR() {
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(FEEDBACK_FORM_URL);

  $("#qrImg").src = qrUrl;
  $("#qrLink").href = FEEDBACK_FORM_URL;
  $("#qrLink").textContent = "Открыть форму";
}

function renderAll() {
  renderRequestsTable();
  renderStats();
  renderQR();
}

async function loadRequestsFromApi() {
  // Твой сервер реально отвечает на GET /api/requests/?page=1&limit=... [file:27]
  const res = await apiFetch(`/api/requests/?page=1&limit=100`, { method: "GET" });
  const arr = Array.isArray(res.data) ? res.data : [];
  state.requests = arr.map(normalizeRequestFromApi);
}

async function handleLogin(login, password) {
  // POST /api/auth/login ожидает JSON {login, password} и возвращает access_token и user_type [file:28]
  const data = await apiFetch(`/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ login, password })
  });

  state.user = {
    name: data.full_name || data.login || login,
    role: mapRoleFromApi(data.user_type),
    token: data.access_token,
    user_id: data.user_id,
    user_type: data.user_type
  };
  saveAuth();
  renderAuth();

  await loadRequestsFromApi();
  renderAll();
  showToast("Вход выполнен");
}

function wireEvents() {
  // Tabs
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => setActiveTab(b.dataset.tab));
  });

  // Filters
  ["#searchInput", "#statusFilter", "#assigneeFilter"].forEach((sel) => {
    $(sel).addEventListener("input", renderRequestsTable);
    $(sel).addEventListener("change", renderRequestsTable);
  });

  // Table actions
  $("#requestsTbody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (action === "open") openRequestModal(id);
    if (action === "status") {
      // В твоём бэке статусы на русском, поэтому здесь просто циклим по 4 вариантам интерфейса
      // (можешь потом привязать к реальным строкам из БД). [file:27]
      const r = state.requests.find((x) => Number(x.id) === id);
      if (!r) return;
      const current = String(r.status || "");
      const variants = ["Новая заявка", "В процессе ремонта", "Ожидание комплектующих", "Завершена"];
      const idx = Math.max(0, variants.indexOf(current));
      r.status = variants[(idx + 1) % variants.length];
      saveRequests();
      renderRequestsTable();
      renderStats();
      showToast("Статус изменён (локально)");
    }
  });

  // New request
  $("#btnNewRequest").addEventListener("click", () => openRequestModal(null));

  // Modal controls
  $("#btnCloseModal").addEventListener("click", closeModal);
  $("#btnCancel").addEventListener("click", closeModal);

  // Add comment
  $("#btnAddComment").addEventListener("click", () => {
    const id = state.selectedRequestId;
    const r = state.requests.find((x) => Number(x.id) === Number(id));
    if (!r) return;

    const text = ($("#commentText").value || "").trim();
    if (!text) {
      showToast("Введите текст комментария");
      return;
    }

    r.comments = r.comments || [];
    r.comments.push({
      id: uuidv4(),
      author: state.user?.name || "Пользователь",
      created_at: new Date().toISOString(),
      text
    });

    $("#commentText").value = "";
    saveRequests();
    renderComments(r);
    showToast("Комментарий добавлен");
  });

  // Save request (локально; к API можно подключить позже, когда поправишь PUT route)
  $("#requestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!canEditRequest()) {
      showToast("Недостаточно прав");
      return;
    }

    const form = $("#requestForm");
    const id = Number(form.elements.id.value);
    const idx = state.requests.findIndex((x) => Number(x.id) === id);

    const createdISO = toISOFromLocalInput(form.elements.created_at.value);
    if (!createdISO) {
      showToast("Некорректная дата");
      return;
    }

    const updated = {
      ...(idx >= 0 ? state.requests[idx] : {}),
      id,
      created_at: createdISO,
      equipment_type: form.elements.equipment_type.value.trim(),
      model: form.elements.model.value.trim(),
      problem: form.elements.problem.value.trim(),
      customer_name: form.elements.customer_name.value.trim(),
      phone: form.elements.phone.value.trim(),
      status: form.elements.status.value,
      assignee: form.elements.assignee.value.trim(),
      deadline: form.elements.deadline.value,
      completed_at: toISOFromLocalInput(form.elements.completed_at.value),
      fault_type: form.elements.fault_type.value.trim(),
      comments: (idx >= 0 ? state.requests[idx].comments : []) || []
    };

    // Простая валидация обязательных полей (в духе требований ТЗ). [file:2]
    if (!updated.equipment_type || !updated.model || !updated.problem || !updated.customer_name || !updated.phone) {
      showToast("Заполните обязательные поля");
      return;
    }

    if (idx >= 0) state.requests[idx] = updated;
    else state.requests.push(updated);

    saveRequests();
    renderAll();
    closeModal();
    showToast("Сохранено (локально)");
  });

  // Delete request (локально)
  $("#btnDeleteRequest").addEventListener("click", () => {
    if (!canEditRequest()) {
      showToast("Недостаточно прав");
      return;
    }
    const id = state.selectedRequestId;
    if (!id) return;

    const ok = confirm(`Удалить заявку №${id}?`);
    if (!ok) return;

    state.requests = state.requests.filter((x) => Number(x.id) !== Number(id));
    saveRequests();
    renderAll();
    closeModal();
    showToast("Удалено (локально)");
  });

  // Stats refresh
  $("#btnRecalcStats").addEventListener("click", () => {
    renderStats();
    showToast("Статистика обновлена");
  });

  // Manager tools
  $("#managerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const role = state.user?.role;
    if (!(role === "manager" || role === "admin")) {
      showToast("Доступно только менеджеру");
      return;
    }

    const f = e.target;
    const requestId = Number(f.requestId.value);
    const assignee = (f.assignee.value || "").trim();
    const deadline = f.deadline.value || "";

    const r = state.requests.find((x) => Number(x.id) === requestId);
    if (!r) {
      showToast("Заявка не найдена");
      return;
    }

    if (assignee) r.assignee = assignee;
    if (deadline) r.deadline = deadline;

    r.comments = r.comments || [];
    r.comments.push({
      id: uuidv4(),
      author: state.user?.name || "Менеджер",
      created_at: new Date().toISOString(),
      text: `Действие менеджера: ${assignee ? `назначен ответственный: ${assignee}. ` : ""}${deadline ? `срок продлён до: ${deadline}.` : ""}`
    });

    saveRequests();
    renderAll();
    showToast("Применено (локально)");
  });

  // Auth
  $("#btnLogout").addEventListener("click", logout);

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const username = String(fd.get("username") || "").trim();
    const password = String(fd.get("password") || "").trim();

    try {
      await handleLogin(username, password);
    } catch (err) {
      $("#loginHint").hidden = false;
      $("#loginHint").textContent = `Ошибка входа: ${err.message || err}`;
      showToast("Не удалось войти");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  // Сервер у тебя раздаёт фронт из папки frontend как статику, так что /js/app.js грузится напрямую. [file:29]
  state.user = loadAuth();
  state.requests = loadRequests();

  renderAuth();
  setActiveTab("requests");
  wireEvents();
  renderQR();

  // Если уже есть токен — пробуем подтянуть заявки с API, иначе остаёмся на localStorage.
  if (state.user?.token) {
    try {
      await loadRequestsFromApi();
    } catch {
      // молча оставляем локальные данные
    }
  }

  seedIfEmpty();
  renderAll();
});
