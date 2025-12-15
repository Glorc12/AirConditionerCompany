-- ============================================================================
-- SQL скрипт для PostgreSQL - Система учета заявок на ремонт оборудования
-- ИСПРАВЛЕННАЯ ВЕРСИЯ (EXTRACT исправлена)
-- ============================================================================

-- ============================================================================
-- 1. СОЗДАНИЕ ТАБЛИЦ
-- ============================================================================

CREATE TABLE users (
    user_id INT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    login VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('Менеджер', 'Специалист', 'Оператор', 'Заказчик'))
);

CREATE TABLE repair_requests (
    request_id INT PRIMARY KEY,
    start_date DATE NOT NULL,
    climate_tech_type VARCHAR(100) NOT NULL,
    climate_tech_model VARCHAR(100) NOT NULL,
    problem_description TEXT NOT NULL,
    request_status VARCHAR(50) NOT NULL CHECK (request_status IN ('Новая заявка', 'В процессе ремонта', 'Готова к выдаче', 'Ожидание комплектующих')),
    completion_date DATE,
    repair_parts VARCHAR(255),
    master_id INT,
    client_id INT NOT NULL,
    FOREIGN KEY (master_id) REFERENCES users(user_id),
    FOREIGN KEY (client_id) REFERENCES users(user_id),
    CONSTRAINT check_completion_date CHECK (completion_date IS NULL OR completion_date >= start_date)
);

CREATE TABLE comments (
    comment_id INT PRIMARY KEY,
    message TEXT NOT NULL,
    master_id INT NOT NULL,
    request_id INT NOT NULL,
    FOREIGN KEY (master_id) REFERENCES users(user_id),
    FOREIGN KEY (request_id) REFERENCES repair_requests(request_id)
);

-- ============================================================================
-- 2. СОЗДАНИЕ ИНДЕКСОВ
-- ============================================================================

CREATE INDEX idx_requests_status ON repair_requests(request_status);
CREATE INDEX idx_requests_master ON repair_requests(master_id);
CREATE INDEX idx_requests_client ON repair_requests(client_id);
CREATE INDEX idx_comments_request ON comments(request_id);
CREATE INDEX idx_users_type ON users(user_type);

-- ============================================================================
-- 3. ВСТАВКА ДАННЫХ
-- ============================================================================

INSERT INTO users (user_id, full_name, phone, login, password, user_type)
VALUES
    (1, 'Широков Василий Матвеевич', '89210563128', 'login1', 'pass1', 'Менеджер'),
    (2, 'Кудрявцева Ева Ивановна', '89535078985', 'login2', 'pass2', 'Специалист'),
    (3, 'Гончарова Ульяна Ярославовна', '89210673849', 'login3', 'pass3', 'Специалист'),
    (4, 'Гусева Виктория Данииловна', '89990563748', 'login4', 'pass4', 'Оператор'),
    (5, 'Баранов Артём Юрьевич', '89994563847', 'login5', 'pass5', 'Оператор'),
    (6, 'Овчинников Фёдор Никитич', '89219567849', 'login6', 'pass6', 'Заказчик'),
    (7, 'Петров Никита Артёмович', '89219567841', 'login7', 'pass7', 'Заказчик'),
    (8, 'Ковалева Софья Владимировна', '89219567842', 'login8', 'pass8', 'Заказчик'),
    (9, 'Кузнецов Сергей Матвеевич', '89219567843', 'login9', 'pass9', 'Заказчик'),
    (10, 'Беспалова Екатерина Даниэльевна', '89219567844', 'login10', 'pass10', 'Специалист');

INSERT INTO repair_requests (request_id, start_date, climate_tech_type, climate_tech_model, problem_description, request_status, completion_date, repair_parts, master_id, client_id)
VALUES
    (1, '2023-06-06', 'Кондиционер', 'TCL TAC-12CHSA/TPG-W белый', 'Не охлаждает воздух', 'В процессе ремонта', NULL, NULL, 2, 7),
    (2, '2023-05-05', 'Кондиционер', 'Electrolux EACS/I-09HAT/N3_21Y белый', 'Выключается сам по себе', 'В процессе ремонта', NULL, NULL, 3, 8),
    (3, '2022-07-07', 'Увлажнитель воздуха', 'Xiaomi Smart Humidifier 2', 'Пар имеет неприятный запах', 'Готова к выдаче', '2023-01-01', NULL, 3, 9),
    (4, '2023-08-02', 'Увлажнитель воздуха', 'Polaris PUH 2300 WIFI IQ Home', 'Увлажнитель воздуха продолжает работать при предельном снижении уровня воды', 'Новая заявка', NULL, NULL, NULL, 8),
    (5, '2023-08-02', 'Сушилка для рук', 'Ballu BAHD-1250', 'Не работает', 'Новая заявка', NULL, NULL, NULL, 9);

INSERT INTO comments (comment_id, message, master_id, request_id)
VALUES
    (1, 'Всё сделаем!', 2, 1),
    (2, 'Всё сделаем!', 3, 2),
    (3, 'Починим в момент.', 3, 3);

-- ============================================================================
-- 4. ПРОВЕРКА ДАННЫХ
-- ============================================================================

SELECT * FROM users;
SELECT * FROM repair_requests;
SELECT * FROM comments;

-- ============================================================================
-- 5. ЗАПРОСЫ СТАТИСТИКИ
-- ============================================================================

-- Количество выполненных заявок
SELECT 
    COUNT(*) AS completed_requests_count
FROM repair_requests
WHERE request_status = 'Готова к выдаче';

-- Среднее время выполнения заявки (в днях) - ИСПРАВЛЕНО
SELECT 
    ROUND(AVG((completion_date - start_date))) AS avg_completion_days
FROM repair_requests
WHERE completion_date IS NOT NULL;

-- Статистика по типам неисправностей
SELECT 
    climate_tech_type,
    COUNT(*) AS total_requests,
    SUM(CASE WHEN request_status = 'Готова к выдаче' THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN request_status = 'В процессе ремонта' THEN 1 ELSE 0 END) AS in_progress,
    SUM(CASE WHEN request_status = 'Новая заявка' THEN 1 ELSE 0 END) AS new_requests
FROM repair_requests
GROUP BY climate_tech_type
ORDER BY total_requests DESC;

-- Загруженность специалистов
SELECT 
    u.full_name,
    COUNT(rr.request_id) AS total_assigned_requests,
    SUM(CASE WHEN rr.request_status = 'Готова к выдаче' THEN 1 ELSE 0 END) AS completed_requests,
    SUM(CASE WHEN rr.request_status = 'В процессе ремонта' THEN 1 ELSE 0 END) AS in_progress_requests
FROM users u
LEFT JOIN repair_requests rr ON u.user_id = rr.master_id
WHERE u.user_type = 'Специалист'
GROUP BY u.user_id, u.full_name;

-- Отчет по заявкам с информацией о клиентах и специалистах
SELECT 
    rr.request_id,
    rr.start_date,
    rr.climate_tech_type,
    rr.problem_description,
    rr.request_status,
    c.full_name AS client_name,
    c.phone AS client_phone,
    m.full_name AS master_name,
    rr.completion_date
FROM repair_requests rr
JOIN users c ON rr.client_id = c.user_id
LEFT JOIN users m ON rr.master_id = m.user_id
ORDER BY rr.start_date DESC;

-- Активные заявки (не завершенные) - ИСПРАВЛЕНО
SELECT 
    rr.request_id,
    rr.climate_tech_type,
    rr.climate_tech_model,
    rr.problem_description,
    rr.request_status,
    c.full_name AS client_name,
    c.phone AS client_phone,
    m.full_name AS master_name,
    (CURRENT_DATE - rr.start_date) AS days_in_work
FROM repair_requests rr
JOIN users c ON rr.client_id = c.user_id
LEFT JOIN users m ON rr.master_id = m.user_id
WHERE rr.request_status IN ('Новая заявка', 'В процессе ремонта', 'Ожидание комплектующих')
ORDER BY rr.start_date ASC;

-- ============================================================================
-- 6. ДОБАВЛЕНИЕ НОВЫХ ДАННЫХ
-- ============================================================================

-- Добавление новой заявки
INSERT INTO repair_requests (
    request_id, 
    start_date, 
    climate_tech_type, 
    climate_tech_model, 
    problem_description, 
    request_status, 
    client_id
)
VALUES (
    6, 
    CURRENT_DATE, 
    'Кондиционер', 
    'Samsung AR09TXHZAWKNUA', 
    'Утечка хладагента', 
    'Новая заявка', 
    7
);

-- ============================================================================
-- 7. ОБНОВЛЕНИЕ ДАННЫХ
-- ============================================================================

-- Обновление статуса заявки
UPDATE repair_requests
SET request_status = 'В процессе ремонта',
    master_id = 2
WHERE request_id = 1;

-- Завершение заявки
UPDATE repair_requests
SET request_status = 'Готова к выдаче',
    completion_date = CURRENT_DATE,
    repair_parts = 'Фильтр, подшипник'
WHERE request_id = 2;

-- ============================================================================
-- 8. ДОБАВЛЕНИЕ КОММЕНТАРИЕВ
-- ============================================================================

-- Добавление комментария от специалиста
INSERT INTO comments (comment_id, message, master_id, request_id)
VALUES (4, 'Заменены вентиляционные трубки.', 2, 1);

-- ============================================================================
-- 9. РЕЗЕРВНОЕ КОПИРОВАНИЕ И ВОССТАНОВЛЕНИЕ
-- ============================================================================

-- В терминале (не в psql):
-- Полный дамп БД в SQL
-- pg_dump -U postgres repair_equipment_db > repair_equipment_db_backup.sql

-- Дамп БД в формате tar
-- pg_dump -U postgres -F t repair_equipment_db > repair_equipment_db_backup.tar

-- Восстановление из SQL дампа
-- psql -U postgres repair_equipment_db < repair_equipment_db_backup.sql

-- Восстановление из tar архива
-- pg_restore -U postgres -d repair_equipment_db repair_equipment_db_backup.tar