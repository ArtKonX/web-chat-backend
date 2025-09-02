CREATE TABLE users_warning (
    id CHAR(36) PRIMARY KEY,
    date_register TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    city VARCHAR(255),
    color_profile VARCHAR(255),
    fa2_enabled BOOLEAN DEFAULT FALSE,
    fa2_pin VARCHAR(255),
    fa2_attempts INT DEFAULT 5,
    public_key JSON NOT NULL
);

CREATE TABLE users_safe (
    id CHAR(36) PRIMARY KEY,
    date_register TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(255),
    color_profile VARCHAR(255),
    fa2_enabled BOOLEAN DEFAULT FALSE
);

CREATE TABLE users_statuses (
    id CHAR(36) PRIMARY KEY,
    status BOOLEAN DEFAULT FALSE
);

CREATE TABLE messages (
    id CHAR(36) PRIMARY KEY,
    sender_id CHAR(36),
    recipient_id CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT,
    file_name TEXT,
    file_size INT,
    iv VARCHAR(32)
);

INSERT INTO users_statuses (
    id,
    status
) VALUES (
    '0f000000-000c-00d0-00d0-0d0000e00000',
    1
);

INSERT INTO users_safe (
    id,
    date_register,
    email,
    name,
    city,
    color_profile
) VALUES (
    '0f000000-000c-00d0-00d0-0d0000e00000',
    '1999-12-31 23:59:59.581',
    'bot@ya.ru',
    'БОТ',
    'Т-Чат',
    "#2a86c7"
);

INSERT INTO users_warning (
    id,
    date_register,
    email,
    name,
    password,
    city,
    color_profile,
    fa2_enabled,
    fa2_pin,
    fa2_attempts,
    public_key
) VALUES (
    '0f000000-000c-00d0-00d0-0d0000e00000',
    '1999-12-31 23:59:59.581',
    'bot@ya.ru',
    'БОТ',
    'nullnullnullnull1234',
    'Т-Чат',
    "bg-purple-400/50",
    FALSE,
    NULL,
    5,
    1
);