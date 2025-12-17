// app.js — состояние приложения и обработчики
// Использует функции из ui.js и api.js

const state = {
  user: loadAuthFromStorage() || null,
  requests: [],
  activeTab: "requests",
  selectedRequestId: null,
  specialists: [],
};

// ======= фильтры =======

function resetFilters() {
  const search = document.querySelector("#searchInput");
  const status = document.querySelector("#statusFilter");
  const assignee = document.querySelector("#assigneeFilter");
  if (search) search.value = "";
  if (status) status.value = "";
  if (assignee) assignee.value = "";
}

function setUser(user) {
  state.user = user;
  saveAuthToStorage(user);
  resetFilters();

  // Обновляем имя и должность в шапке
  const nameEl = document.querySelector(".userbar__name");
  const roleEl = document.querySelector(".userbar__role");
  if (nameEl) nameEl.textContent = user.full_name || user.name || user.login || "";
  if (roleEl) roleEl.textContent = user.role_name || user.role || "";

  renderAll(state);
}

function clearUserbarUI() {
  // Очищаем имя и должность пользователя в шапке
  const nameEl = document.querySelector(".userbar__name");
  const roleEl = document.querySelector(".userbar__role");
  if (nameEl) nameEl.textContent = "";
  if (roleEl) roleEl.textContent = "";
}

function clearDomForLogout() {
  // Закрываем модали
  const requestModal = document.querySelector("#requestModal");
  if (requestModal?.open) requestModal.close();
  const commentsModal = document.querySelector("#commentsModal");
  if (commentsModal?.open) commentsModal.close();

  // Таблица заявок
  const requestsTbody = document.querySelector("#requestsTbody");
  if (requestsTbody) requestsTbody.innerHTML = "";

  // Комментарии
  const commentsList = document.querySelector("#commentsList");
  if (commentsList) commentsList.innerHTML = "";
  const commentText = document.querySelector("#commentText");
  if (commentText) commentText.value = "";

  // Селекты
  const assigneeFilter = document.querySelector("#assigneeFilter");
  if (assigneeFilter) assigneeFilter.innerHTML = '<option value="">Все</option>';
  const reqAssignee = document.querySelector("#reqAssignee");
  if (reqAssignee) reqAssignee.innerHTML = '<option value="">Не назначен</option>';

  // KPI блоки
  document.querySelectorAll(".kpi__value").forEach((el) => {
    el.textContent = "0";
  });

  // Таблица неисправностей
  const faultTable = document.querySelector("#faultTypesTable tbody");
  if (faultTable) faultTable.innerHTML = "";

  // Очищаем шапку пользователя
  clearUserbarUI();
}

function logout() {
  // Сначала чистим DOM
  clearDomForLogout();
  resetFilters();
  resetRequestForm();

  // Потом чистим состояние и хранилище
  state.user = null;
  state.requests = [];
  state.specialists = [];
  state.activeTab = "requests";
  state.selectedRequestId = null;
  clearAuthStorage();

  renderAll(state);
  showToast("Вы вышли из системы");
}

// ======= работа с backend через api.js =======

async function loginAndInit(login, password) {
  const user = await apiLogin(login, password); // /api/auth/login
  setUser(user);
  await loadSpecialists();
  await refreshRequests();
}

async function apiFetchRequestsWrapped() {
  const resp = await apiFetch("/api/requests/"); // защищённая ручка
  return resp.data || [];
}

async function apiCreateRequest(payload) {
  return apiFetch("/api/requests/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function apiUpdateRequest(id, payload) {
  return apiFetch(`/api/requests/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function apiFetchSpecialistsWrapped() {
  const res = await apiFetch("/api/users/specialists", { method: "GET" });
  return res?.data || res || [];
}

// ======= загрузка специалистов и заявок =======

function normalizeAssigneeForRequest(req) {
  const id = req.assignee_id || "";
  if (!id) {
    req.assignee = "";
    return;
  }
  const u = state.specialists.find(
    (x) => String(x.user_id) === String(id) || String(x.id) === String(id)
  );
  req.assignee = u ? (u.full_name || u.name || u.login || "") : "";
}

function fillAssigneeSelect() {
  const sel = document.querySelector("#reqAssignee");
  if (!sel) return;

  sel.innerHTML = '<option value="">Не назначен</option>';

  for (const u of state.specialists) {
    const id = u.user_id ?? u.id;
    const name = u.full_name ?? u.name ?? u.login ?? String(id);

    const opt = document.createElement("option");
    opt.value = String(id);
    opt.textContent = name;
    sel.appendChild(opt);
  }
}

async function loadSpecialists() {
  if (!state.user) return;
  try {
    state.specialists = await apiFetchSpecialistsWrapped();
    fillAssigneeSelect();
    for (const r of state.requests) normalizeAssigneeForRequest(r);
    renderAll(state);
  } catch (e) {
    console.error(e);
    showToast("Не удалось загрузить список ответственных");
  }
}

async function refreshRequests() {
  if (!state.user) return;
  try {
    const raw = await apiFetchRequestsWrapped();
    state.requests = raw.map((r) => ({
      id: r.request_id,
      created_at: r.start_date,
      equipment_type: r.climate_tech_type,
      model: r.climate_tech_model,
      problem: r.problem_description,
      customer_name: "",
      phone: "",
      status: mapStatusFromBackend(r.request_status),
      assignee_id: r.master_id ? String(r.master_id) : "",
      assignee: "",
      deadline: null,
      completed_at: r.completion_date,
      fault_type: r.repair_parts || "",
      comments: [],
    }));
    for (const r of state.requests) normalizeAssigneeForRequest(r);
    renderAll(state);
  } catch (e) {
    console.error(e);
    showToast("Не удалось загрузить заявки");
  }
}

// ======= маппинг статусов =======

function mapStatusFromBackend(s) {
  if (s === "Новая заявка") return "open";
  if (s === "В работе") return "in_progress";
  if (s === "Ожидание комплектующих") return "waiting_parts";
  if (s === "Завершена") return "done";
  return "open";
}

function mapStatusToBackend(s) {
  if (s === "open") return "Новая заявка";
  if (s === "in_progress") return "В работе";
  if (s === "waiting_parts") return "Ожидание комплектующих";
  if (s === "done") return "Завершена";
  return "Новая заявка";
}

// ======= форма заявки =======

function resetRequestForm() {
  $("#reqId").value = "";
  $("#reqEquipment").value = "";
  $("#reqModel").value = "";
  $("#reqProblem").value = "";
  $("#reqCustomer").value = "";
  $("#reqPhone").value = "";
  $("#reqStatus").value = "open";
  $("#reqAssignee").value = "";
  $("#reqFaultType").value = "";
  $("#reqDeadline").value = "";

  const commentText = document.querySelector("#commentText");
  if (commentText) commentText.value = "";
}

function fillRequestForm(request) {
  fillAssigneeSelect();
  $("#reqId").value = request ? request.id : "";
  $("#reqEquipment").value = request?.equipment_type || "";
  $("#reqModel").value = request?.model || "";
  $("#reqProblem").value = request?.problem || "";
  $("#reqCustomer").value = request?.customer_name || "";
  $("#reqPhone").value = request?.phone || "";
  $("#reqStatus").value = request?.status || "open";
  $("#reqAssignee").value = request?.assignee_id || "";
  $("#reqFaultType").value = request?.fault_type || "";
  $("#reqDeadline").value = toLocalInputFromISO(request?.deadline);
}

async function upsertRequestFromForm() {
  if (!state.user) {
    showToast("Сначала войдите в систему");
    return;
  }

  const idRaw = $("#reqId").value.trim();
  const isNew = !idRaw;
  const id = isNew ? null : Number(idRaw);
  const assignee_id = $("#reqAssignee").value || "";

  const payloadBackend = {
    climate_tech_type: $("#reqEquipment").value.trim(),
    climate_tech_model: $("#reqModel").value.trim(),
    problem_description: $("#reqProblem").value.trim(),
    request_status: mapStatusToBackend($("#reqStatus").value),
    client_id: state.user.id,
    master_id: assignee_id ? Number(assignee_id) : null,
    completion_date: null,
    repair_parts: $("#reqFaultType").value.trim() || null,
  };

  if (!payloadBackend.climate_tech_type || !payloadBackend.climate_tech_model) {
    showToast("Заполни оборудование и модель");
    return;
  }

  try {
    if (isNew) {
      await apiCreateRequest(payloadBackend);
      showToast("Заявка создана");
    } else {
      await apiUpdateRequest(id, {
        request_status: payloadBackend.request_status,
        master_id: payloadBackend.master_id,
        repair_parts: payloadBackend.repair_parts,
        completion_date: payloadBackend.completion_date,
      });
      showToast("Заявка обновлена");
    }
    await refreshRequests();
    $("#requestModal").close();
  } catch (e) {
    console.error(e);
    showToast("Ошибка при сохранении заявки");
  }
}

function openRequestModal(request) {
  fillRequestForm(request || null);
  $("#requestModal").showModal();
}

// ======= таблица и действия =======

function handleRowAction(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;

  const id = Number(tr.dataset.id);
  const req = state.requests.find((r) => r.id === id);
  if (!req) return;

  const action = btn.dataset.action;
  if (action === "open") {
    openRequestModal(req);
  } else if (action === "done") {
    // ВАЖНО: отправляем completion_date, чтобы статистика могла его рассчитать
    apiUpdateRequest(id, {
      request_status: mapStatusToBackend("done"),
      completion_date: new Date().toISOString(),
    })
      .then(() => refreshRequests())
      .then(() => showToast("Заявка завершена"))
      .catch((err) => {
        console.error(err);
        showToast("Не удалось завершить заявку");
      });
  } else if (action === "comment") {
    state.selectedRequestId = id;
    openCommentsModal(req);
  }
}

// ======= комментарии =======

function renderComments(request) {
  const wrap = $("#commentsList");
  if (!request.comments || !request.comments.length) {
    wrap.innerHTML = '<div class="empty">Нет комментариев.</div>';
    return;
  }
  wrap.innerHTML = request.comments
    .slice()
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
    .map(
      (c) => `
      <div class="comment">
        <div class="comment__meta">
          <span>${escapeHtml(c.author || "Без имени")}</span>
          <span>${escapeHtml(formatDateTime(c.created_at))}</span>
        </div>
        <div class="comment__text">${escapeHtml(c.text || "")}</div>
      </div>
    `
    )
    .join("");
}

function openCommentsModal(request) {
  renderComments(request);
  $("#commentsModal").showModal();
}

function addCommentFromForm() {
  const text = $("#commentText").value.trim();
  if (!text) return;

  const req = state.requests.find((r) => r.id === state.selectedRequestId);
  if (!req) return;

  if (!Array.isArray(req.comments)) req.comments = [];
  req.comments.push({
    id: uuidv4(),
    author: state.user?.name || state.user?.login || "Пользователь",
    created_at: new Date().toISOString(),
    text,
  });

  $("#commentText").value = "";
  renderComments(req);
  renderStats(state);
}

// ======= очистка при загрузке страницы =======

function initializeAppState() {
  // Если нет пользователя, очищаем ВСЕ данные и UI
  if (!state.user) {
    state.requests = [];
    state.specialists = [];
    state.activeTab = "requests";
    state.selectedRequestId = null;
    resetFilters();
    resetRequestForm();
    clearDomForLogout();
  }
}

// ======= инициализация приложения =======

function initApp() {
  // Инициализируем состояние при загрузке
  initializeAppState();

  // Обработчики вкладок
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(state, btn.dataset.tab));
  });

  // Обработчик событий таблицы заявок
  $("#requestsTbody").addEventListener("click", handleRowAction);

  // Обработчики фильтров
  $("#searchInput").addEventListener("input", () => renderRequestsTable(state));
  $("#statusFilter").addEventListener("change", () => renderRequestsTable(state));
  $("#assigneeFilter").addEventListener("input", () => renderRequestsTable(state));

  // Обработчик формы входа
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    // Полностью очищаем следы прошлого пользователя перед новым логином
    clearDomForLogout();
    resetFilters();
    resetRequestForm();

    // Чистим состояние
    state.requests = [];
    state.specialists = [];
    state.activeTab = "requests";
    state.selectedRequestId = null;

    const login = $("#loginUser").value.trim();
    const password = $("#loginPass").value.trim();

    try {
      await loginAndInit(login, password);
    } catch (err) {
      console.error(err);
      showToast("Неверный логин или пароль");
    }
  });

  // Обработчик выхода
  $("#logoutBtn").addEventListener("click", logout);

  // Обработчик создания новой заявки
  $("#createRequestBtn").addEventListener("click", () => {
    resetRequestForm();
    $("#reqStatus").value = "open";
    $("#requestModal").showModal();
  });

  // Обработчик формы заявки
  $("#requestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    upsertRequestFromForm();
  });

  // Обработчики закрытия модали заявки
  $("#requestModalCancel").addEventListener("click", () => {
    $("#requestModal").close();
  });
  $("#requestModalCancelBottom").addEventListener("click", () => {
    $("#requestModal").close();
  });

  // Обработчик формы комментариев
  $("#commentsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addCommentFromForm();
  });

  // Обработчик закрытия модали комментариев
  $("#commentsModalClose").addEventListener("click", () => {
    $("#commentsModal").close();
  });

  // Обработчик кнопки обратной связи
  const feedbackBtn = $("#feedbackBtn");
  if (feedbackBtn && typeof FEEDBACK_FORM_URL !== "undefined") {
    feedbackBtn.addEventListener("click", () => {
      window.open(FEEDBACK_FORM_URL, "_blank");
    });
  }

  // Если пользователь уже авторизован, загружаем данные
  if (state.user) {
    loadSpecialists()
      .then(() => refreshRequests())
      .catch(console.error);
  }

  // Установка активной вкладки и первичная отрисовка
  setActiveTab(state, state.activeTab);
  renderAll(state);
}

// Инициализируем приложение после загрузки DOM
document.addEventListener("DOMContentLoaded", initApp);
