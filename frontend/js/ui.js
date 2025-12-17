// ui.js — функции рендера и утилиты для интерфейса

function uuidv4() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0];
    return (Number(c) ^ (r & (15 >> (Number(c) / 4)))).toString(16);
  });
}


const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdhZcExx6LSIXxk0ub55mSu-WIh23WYdGG9HY5EZhLDo7P8eA/viewform?usp=sf_link";

const ROLES = {
  admin: "Администратор",
  operator: "Оператор",
  specialist: "Специалист",
  manager: "Менеджер по качеству",
};

const STATUS = {
  open: "Открыта",
  in_progress: "В ремонте",
  waiting_parts: "Ожидание комплектующих",
  done: "Завершена",
};

const STATUS_BADGE = {
  open: "badge--info",
  in_progress: "badge--warn",
  waiting_parts: "badge--warn",
  done: "badge--ok",
};

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

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roleTitle(role) {
  return ROLES[role] || role || "—";
}

function statusBadge(status) {
  const cls = STATUS_BADGE[status] || "badge--info";
  const label = STATUS[status] || status;
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

// ======= рендер авторизации и вкладок =======

function renderAuth(state) {
  const loggedIn = !!state.user;
  $("#loginView").hidden = loggedIn;
  $("#appView").hidden = !loggedIn;
  $("#userbar").hidden = !loggedIn;

  if (loggedIn) {
    $("#userName").textContent = state.user.name || state.user.login || "";
    $("#userRole").textContent = roleTitle(state.user.role);
    $("#managerTools").hidden =
      state.user.role !== "manager" && state.user.role !== "admin";
  }
}

function setActiveTab(state, tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.tab === tab);
  });
  $("#tab-requests").hidden = tab !== "requests";
  $("#tab-stats").hidden = tab !== "stats";
  $("#tab-quality").hidden = tab !== "quality";
}

// ======= таблица заявок =======

function filteredRequests(state) {
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
    const matchesAssignee =
      !ass || (r.assignee || "").toLowerCase().includes(ass);
    return matchesQ && matchesStatus && matchesAssignee;
  });
}

function renderRequestsTable(state) {
  const tbody = $("#requestsTbody");
  const rows = filteredRequests(state)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .map((r) => {
      const commentsCount = (r.comments || []).length;
      return `
      <tr data-id="${r.id}">
        <td>${escapeHtml(String(r.id))}</td>
        <td>${escapeHtml(r.equipment_type || "")}</td>
        <td>${escapeHtml(r.model || "")}</td>
        <td>${escapeHtml(r.customer_name || "")}</td>
        <td>${escapeHtml(r.phone || "")}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${escapeHtml(r.assignee || "")}</td>
        <td>${formatDateTime(r.created_at)}</td>
        <td>
          <button data-action="open">Открыть</button>
          <button data-action="comment">Комментарии (${commentsCount})</button>
        </td>
      </tr>`;
    })
    .join("");

  tbody.innerHTML = rows || `<tr><td colspan="9">Заявок нет</td></tr>`;
}

// ======= статистика / прочее (оставь как было, если не связано с ответственными) =======

function renderStats(state) {
  // твоя реализация статистики
}

function renderAll(state) {
  renderAuth(state);
  setActiveTab(state, state.activeTab);
  renderRequestsTable(state);
  renderStats(state);
}
