const API_URL = 'http://192.168.0.21:5000/api';
let token = localStorage.getItem('token');
let currentUser = null;

// КОНФИГУРАЦИЯ РОЛЕЙ И РАЗРЕШЕНИЙ
const ROLE_PERMISSIONS = {
    'Менеджер': {
        canViewUsers: true,
        canAddUsers: true,
        canDeleteUsers: true,
        canViewRequests: true,
        canEditRequests: true,
        canDeleteRequests: true,
        canViewStatistics: true,
        canCreateRequest: true
    },
    'Специалист': {
        canViewUsers: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewRequests: true,
        canEditRequests: true,
        canDeleteRequests: false,
        canViewStatistics: false,
        canCreateRequest: true
    },
    'Оператор': {
        canViewUsers: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewRequests: true,
        canEditRequests: false,
        canDeleteRequests: false,
        canViewStatistics: false,
        canCreateRequest: true
    },
    'Заказчик': {
        canViewUsers: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewRequests: true,
        canEditRequests: false,
        canDeleteRequests: false,
        canViewStatistics: true,
        canCreateRequest: true
    },
    'Менеджер по качеству': {
        canViewUsers: false,
        canAddUsers: false,
        canDeleteUsers: false,
        canViewRequests: true,
        canEditRequests: true,
        canDeleteRequests: false,
        canViewStatistics: true,
        canCreateRequest: true,
        canExtendRequests: true,
        canAssignSpecialists: true
    }
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', function() {
    if (token) {
        showAppPage();
        loadUserInfo();
        loadDashboard();
        setupUIByRole();
    } else {
        showLoginPage();
    }
    setupEventListeners();
});

// ===== СЛУШАТЕЛИ СОБЫТИЙ =====
function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const newRequestForm = document.getElementById('newRequestForm');
    if (newRequestForm) {
        newRequestForm.addEventListener('submit', handleNewRequest);
    }

    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUser);
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', loadRequests);
    }
}

// ===== АУТЕНТИФИКАЦИЯ =====
async function handleLogin(e) {
    e.preventDefault();
    const login = document.getElementById('loginInput').value;
    const password = document.getElementById('passwordInput').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });

        const data = await response.json();

        if (response.ok) {
            token = data.access_token;
            localStorage.setItem('token', token);
            currentUser = {
                user_id: data.user_id,
                login: data.login,
                full_name: data.full_name,
                user_type: data.user_type
            };
            showAlert('loginAlert', '✅ Успешный вход!', 'success');
            setTimeout(() => {
                showAppPage();
                loadUserInfo();
                loadDashboard();
                setupUIByRole();
                document.getElementById('loginForm').reset();
            }, 500);
        } else {
            showAlert('loginAlert', '❌ Неверный логин или пароль', 'error');
        }
    } catch (error) {
        showAlert('loginAlert', '❌ Ошибка подключения к серверу', 'error');
        console.error('Login error:', error);
    }
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('token');
        token = null;
        currentUser = null;
        showLoginPage();
        document.getElementById('loginForm').reset();
    }
}

// ===== УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ ПО РОЛЯМ =====
function setupUIByRole() {
    if (!currentUser) return;

    const permissions = ROLE_PERMISSIONS[currentUser.user_type];

    const statisticsTab = document.getElementById('statisticsTab');
    const usersTab = document.getElementById('usersTab');
    const newRequestSection = document.getElementById('newRequestSection');
    const addUserSection = document.getElementById('addUserSection');

    if (statisticsTab) {
        statisticsTab.style.display = permissions.canViewStatistics ? 'block' : 'none';
    }

    if (usersTab) {
        usersTab.style.display = permissions.canViewUsers ? 'block' : 'none';
    }

    if (newRequestSection) {
        newRequestSection.style.display = permissions.canCreateRequest ? 'block' : 'none';
    }

    if (addUserSection) {
        addUserSection.style.display = permissions.canAddUsers ? 'block' : 'none';
    }

    updateActionButtons();
}

function updateActionButtons() {
    if (!currentUser) return;

    const permissions = ROLE_PERMISSIONS[currentUser.user_type];

    document.querySelectorAll('.delete-request-btn').forEach(btn => {
        btn.style.display = permissions.canDeleteRequests ? 'inline-block' : 'none';
    });

    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.style.display = permissions.canDeleteUsers ? 'inline-block' : 'none';
    });

    document.querySelectorAll('.edit-request-btn').forEach(btn => {
        btn.style.display = permissions.canEditRequests ? 'inline-block' : 'none';
    });
}

// ===== НАВИГАЦИЯ =====
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    document.querySelectorAll('.content .page').forEach(page => {
        page.classList.remove('active');
    });

    const page = document.getElementById(tabName);
    if (page) {
        page.classList.add('active');
    }

    if (tabName === 'requests') loadRequests();
    if (tabName === 'statistics') loadStatistics();
    if (tabName === 'users') loadUsers();
}

function showLoginPage() {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('appPage').classList.remove('active');
}

function showAppPage() {
    document.getElementById('appPage').classList.add('active');
    document.getElementById('loginPage').classList.remove('active');
}

// ===== ЗАГРУЗКА ИНФОРМАЦИИ ПОЛЬЗОВАТЕЛЯ =====
function loadUserInfo() {
    try {
        if (currentUser) {
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');

            if (userNameEl) userNameEl.textContent = currentUser.full_name;
            if (userRoleEl) userRoleEl.textContent = currentUser.user_type;
        }
    } catch (error) {
        console.error('Ошибка загрузки информации:', error);
    }
}

// ===== ПАНЕЛЬ УПРАВЛЕНИЯ =====
async function loadDashboard() {
    try {
        if (!currentUser) return;

        const permissions = ROLE_PERMISSIONS[currentUser.user_type];
        const dashboardStats = document.getElementById('dashboardStats');

        if (!dashboardStats) return;

        if (!permissions.canViewStatistics) {
            dashboardStats.innerHTML = '<p>Нет доступа к статистике</p>';
            return;
        }

        const requestsResp = await fetch(`${API_URL}/requests/?page=1&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!requestsResp.ok) {
            dashboardStats.innerHTML = '<p>Ошибка загрузки данных</p>';
            return;
        }

        const requests = await requestsResp.json();

        if (!requests.data || requests.data.length === 0) {
            dashboardStats.innerHTML = '<p>Нет данных для отображения</p>';
            return;
        }

        let filteredRequests = requests.data;

        if (currentUser.user_type === 'Заказчик') {
            filteredRequests = requests.data.filter(r => r.client_id === currentUser.user_id);
        }

        const completed = filteredRequests.filter(r => r.request_status === 'Готова к выдаче').length || 0;
        const inProgress = filteredRequests.filter(r => r.request_status === 'В процессе ремонта').length || 0;
        const newRequests = filteredRequests.filter(r => r.request_status === 'Новая заявка').length || 0;
        const total = filteredRequests.length || 0;

        dashboardStats.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${total}</div>
                    <div class="stat-label">Всего заявок</div>
                </div>
                <div class="stat-card variant-2">
                    <div class="stat-value">${newRequests}</div>
                    <div class="stat-label">Новых</div>
                </div>
                <div class="stat-card variant-3">
                    <div class="stat-value">${inProgress}</div>
                    <div class="stat-label">В процессе</div>
                </div>
                <div class="stat-card variant-4">
                    <div class="stat-value">${completed}</div>
                    <div class="stat-label">Завершено</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

// ===== ЗАГРУЗКА ЗАЯВОК =====
async function loadRequests() {
    try {
        if (!currentUser) return;

        const requestsContainer = document.getElementById('requestsContainer');
        if (!requestsContainer) return;

        const statusFilter = document.getElementById('statusFilter')?.value || '';

        const response = await fetch(`${API_URL}/requests/?page=1&limit=20`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            requestsContainer.innerHTML = '<p>Ошибка загрузки заявок</p>';
            return;
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            requestsContainer.innerHTML = '<p>Заявок не найдено</p>';
            return;
        }

        let requests = data.data;

        if (statusFilter) {
            requests = requests.filter(r => r.request_status === statusFilter);
        }

        if (currentUser.user_type === 'Заказчик') {
            requests = requests.filter(r => r.client_id === currentUser.user_id);
        }

        const permissions = ROLE_PERMISSIONS[currentUser.user_type];

        let html = '<table><thead><tr><th>Дата</th><th>Клиент</th><th>Тип</th><th>Модель</th><th>Статус</th><th>Мастер</th><th>Действия</th></tr></thead><tbody>';

        requests.forEach(request => {
            const date = new Date(request.start_date).toLocaleDateString('ru-RU');
            let actions = '';

            if (permissions.canEditRequests) {
                actions += `<button class="btn btn--sm edit-request-btn" onclick="editRequest(${request.request_id})">✏️</button> `;
            }

            if (permissions.canDeleteRequests) {
                actions += `<button class="btn btn--sm delete-request-btn" onclick="deleteRequest(${request.request_id})">🗑️</button>`;
            }

            html += `<tr>
                <td>${date}</td>
                <td>${request.client_id || 'Неизвестно'}</td>
                <td>${request.climate_tech_type || '-'}</td>
                <td>${request.climate_tech_model || '-'}</td>
                <td><span class="status-badge status-${request.request_status === 'Готова к выдаче' ? 'completed' : request.request_status === 'В процессе ремонта' ? 'in-progress' : 'new'}">${request.request_status || 'Новая заявка'}</span></td>
                <td>${request.master_id || 'Не назначен'}</td>
                <td>${actions}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        requestsContainer.innerHTML = html;

    } catch (error) {
        console.error('Error loading requests:', error);
    }
}

// ===== ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ =====
async function loadUsers() {
    try {
        if (!currentUser) return;

        const permissions = ROLE_PERMISSIONS[currentUser.user_type];
        const usersContainer = document.getElementById('usersContainer');

        if (!usersContainer) return;

        if (!permissions.canViewUsers) {
            usersContainer.innerHTML = '<p>❌ Нет доступа к этой информации</p>';
            return;
        }

        const response = await fetch(`${API_URL}/users/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            usersContainer.innerHTML = '<p>Ошибка загрузки пользователей</p>';
            return;
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            usersContainer.innerHTML = '<p>Пользователей не найдено</p>';
            return;
        }

        let html = '<table><thead><tr><th>ФИО</th><th>Логин</th><th>Телефон</th><th>Роль</th><th>Действия</th></tr></thead><tbody>';

        data.data.forEach(user => {
            let actions = '';

            if (permissions.canDeleteUsers) {
                actions = `<button class="btn btn--sm delete-user-btn" onclick="deleteUser(${user.user_id})">🗑️</button>`;
            }

            html += `<tr>
                <td>${user.full_name}</td>
                <td>${user.login}</td>
                <td>${user.phone}</td>
                <td>${user.user_type}</td>
                <td>${actions}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        usersContainer.innerHTML = html;

    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// ===== ЗАГРУЗКА СТАТИСТИКИ =====
async function loadStatistics() {
    try {
        if (!currentUser) return;

        const permissions = ROLE_PERMISSIONS[currentUser.user_type];
        const statisticsContainer = document.getElementById('statisticsContainer');

        if (!statisticsContainer) return;

        if (!permissions.canViewStatistics) {
            statisticsContainer.innerHTML = '<p>❌ Нет доступа к статистике</p>';
            return;
        }

        const response = await fetch(`${API_URL}/requests/?page=1&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            statisticsContainer.innerHTML = '<p>Ошибка загрузки статистики</p>';
            return;
        }

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            statisticsContainer.innerHTML = '<p>Нет данных для статистики</p>';
            return;
        }

        let requests = data.data;

        if (currentUser.user_type === 'Заказчик') {
            requests = data.data.filter(r => r.client_id === currentUser.user_id);

            if (requests.length === 0) {
                statisticsContainer.innerHTML = '<p>У вас нет заявок</p>';
                return;
            }
        }

        const stats = {};

        requests.forEach(request => {
            const type = request.climate_tech_type || 'Неизвестно';

            if (!stats[type]) {
                stats[type] = { total: 0, completed: 0, inProgress: 0 };
            }

            stats[type].total++;

            if (request.request_status === 'Готова к выдаче') stats[type].completed++;
            if (request.request_status === 'В процессе ремонта') stats[type].inProgress++;
        });

        let html = '<table><thead><tr><th>Тип оборудования</th><th>Всего</th><th>Завершено</th><th>В процессе</th></tr></thead><tbody>';

        for (const [type, stat] of Object.entries(stats)) {
            html += `<tr>
                <td>${type}</td>
                <td>${stat.total}</td>
                <td>${stat.completed}</td>
                <td>${stat.inProgress}</td>
            </tr>`;
        }

        html += '</tbody></table>';
        statisticsContainer.innerHTML = html;

    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// ===== СОЗДАНИЕ ЗАЯВКИ =====
async function handleNewRequest(e) {
    e.preventDefault();

    if (!currentUser) {
        showAlert('requestsAlert', '❌ Ошибка: пользователь не определен', 'error');
        return;
    }

    const type = document.getElementById('requestType')?.value;
    const model = document.getElementById('requestModel')?.value;
    const problem = document.getElementById('requestProblem')?.value;

    if (!type || !model || !problem) {
        showAlert('requestsAlert', '❌ Заполните все поля', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/requests/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                climate_tech_type: type,
                climate_tech_model: model,
                problem_description: problem,
                client_id: currentUser.user_id
            })
        });

        if (response.ok) {
            showAlert('requestsAlert', '✅ Заявка успешно создана', 'success');
            document.getElementById('newRequestForm').reset();
            loadRequests();
        } else {
            const error = await response.json();
            showAlert('requestsAlert', '❌ ' + (error.error || 'Ошибка при создании заявки'), 'error');
        }
    } catch (error) {
        showAlert('requestsAlert', '❌ Ошибка подключения', 'error');
        console.error('Error:', error);
    }
}

// ===== РЕДАКТИРОВАНИЕ ЗАЯВКИ =====
function editRequest(requestId) {
    alert('Функция редактирования заявки ' + requestId + ' (в разработке)');
}

// ===== ДОБАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ =====
async function handleAddUser(e) {
    e.preventDefault();

    const permissions = ROLE_PERMISSIONS[currentUser.user_type];

    if (!permissions.canAddUsers) {
        showAlert('userAlert', '❌ У вас нет прав для добавления пользователей', 'error');
        return;
    }

    const fullName = document.getElementById('newUserName')?.value?.trim();
    const phone = document.getElementById('newUserPhone')?.value?.trim();
    const login = document.getElementById('newUserLogin')?.value?.trim();
    const password = document.getElementById('newUserPassword')?.value?.trim();
    const userType = document.getElementById('newUserType')?.value;

    if (!fullName || !phone || !login || !password || !userType) {
        showAlert('userAlert', '❌ Заполните все поля', 'error');
        return;
    }

    if (!validatePhone(phone)) {
        showAlert('userAlert', '❌ Неверный формат телефона. Используйте: 8-999-999-99-99', 'error');
        return;
    }

    if (login.length < 3) {
        showAlert('userAlert', '❌ Логин должен содержать минимум 3 символа', 'error');
        return;
    }

    if (password.length < 3) {
        showAlert('userAlert', '❌ Пароль должен содержать минимум 3 символа', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                full_name: fullName,
                phone: phone,
                login: login,
                password: password,
                user_type: userType
            })
        });

        if (response.ok) {
            showAlert('userAlert', '✅ Пользователь успешно добавлен', 'success');
            document.getElementById('addUserForm').reset();
            loadUsers();
        } else {
            const error = await response.json();
            showAlert('userAlert', '❌ ' + (error.error || 'Ошибка при добавлении'), 'error');
        }
    } catch (error) {
        showAlert('userAlert', '❌ Ошибка подключения', 'error');
        console.error('Error:', error);
    }
}

// ===== ВАЛИДАЦИЯ ТЕЛЕФОНА =====
function validatePhone(phone) {
    const phoneRegex = /^8-\d{3}-\d{3}-\d{2}-\d{2}$|^\d{11}$|^8\d{10}$/;
    return phoneRegex.test(phone);
}

// ===== УДАЛЕНИЕ =====
async function deleteRequest(requestId) {
    if (!confirm('Удалить заявку?')) return;

    const permissions = ROLE_PERMISSIONS[currentUser.user_type];

    if (!permissions.canDeleteRequests) {
        alert('❌ У вас нет прав для удаления');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/requests/${requestId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showAlert('requestsAlert', '✅ Заявка удалена', 'success');
            loadRequests();
        } else {
            showAlert('requestsAlert', '❌ Ошибка при удалении', 'error');
        }
    } catch (error) {
        showAlert('requestsAlert', '❌ Ошибка подключения', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Удалить пользователя?')) return;

    const permissions = ROLE_PERMISSIONS[currentUser.user_type];

    if (!permissions.canDeleteUsers) {
        alert('❌ У вас нет прав для удаления');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showAlert('userAlert', '✅ Пользователь удален', 'success');
            loadUsers();
        } else {
            showAlert('userAlert', '❌ Ошибка при удалении', 'error');
        }
    } catch (error) {
        showAlert('userAlert', '❌ Ошибка подключения', 'error');
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function showAlert(elementId, message, type) {
    const element = document.getElementById(elementId);

    if (element) {
        element.textContent = message;
        element.className = 'alert alert-' + type;
        element.style.display = 'block';

        setTimeout(() => {
            element.style.display = 'none';
        }, 4000);
    }
}