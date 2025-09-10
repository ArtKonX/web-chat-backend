# Сервер веб-системы обмена сообщениями с публикацией геопривязки

[Ссылка на сервер onRender](https://web-chat-backend-s29s.onrender.com)

## Описание
Серверная часть веб-системы обмена сообщениями с публикацией геопривязки.

## Технологический стек
1. Node.js
2. Koa
3. WebSocket

## Настройка и запуск сервера

1. Клонирование репозитория
```
git clone https://github.com/ArtKonX/web-chat-backend.git
```

2. Установка зависимостей
```
yarn install
```

3. Создайте файл .env в корне проекта
```
JWT_SECRET=
O_Auth=

host_db=
port_db=
user_db=
password_db=
database_db=

FRONTEND_URL_HTTP=http://localhost:3000
FRONTEND_URL_HTTPS=https://localhost:3000

```

4. Запуск севрера
```
yarn start
```

## API документация

### Роуты не требующие авторизации пользователя

#### GET

Получение информации о доступных городах для поиска:
```
GET /get-cities?q=<Название города>
```

#### POST

Авторизация пользователя:
```
POST /sing-in
```
В body должны быть: email, password и pin если подключена 2FA

Регистрация пользователя:
```
POST /registration
```
В body должны быть: email, name, password, id и publicKey для шифрования

Выход пользователя:
```
POST /logout
```

### Роуты требующие авторизации пользователя

#### GET

Получение статуса пользователя:
```
GET /get-user-status?userId=<id пользователя>
```

Получение публичного ключа пользователя:
```
GET /get-public-keys?recipientId=<id получателя>&senderId=<id отправителя>
```

Получение информации о диалогах пользователя:
```
GET /get-info-dialogues?userId=<id пользователя>
```

Получение информации о пользователе, который авторизовался:
```
GET /get-user
```

Получение информации о сообщениях пользователя и собеседника:
```
GET /get-messages?currentUserId=<Id отправителя или получателя>&userId=<Id отправителя или получателя>&offSet=<пропуск сообщений для пагинации, если не указано, то будет 0>
```

Получение информации о следующем количестве сообщений:
```
GET /get-length-next-messages?recipientId=<id получателя>&senderId=<id отправителя>&nextOffset=<следущее число пропуска сообщений>
```

Получение информации о пользователях для поиска:
```
GET /get-users?currentId=<Id пользователя>&q=<Ключевая фраза поиска>
```

#### POST

Проверка токена:
```
POST /check-token
```

```
POST /create-message?userId=<id получателя>&currentUserId=<id отправителя>&nextOffset=<следущее число пропуска сообщений>
```
В body должно быть: message : {
    message: 'Сообщение'
}

Отправка сообщения с файлом:
```
POST /upload-file?userId=<id получателя>&currentUserId=<id отправителя>
```
В body должно быть: message : {
    id: 'id сообщения'
    message: 'Сообщение'
}
И нужен сам файл file, загрузка нескольких файлов в разработке...


Отключение FA2:
```
POST /2FA-disable
```
В body должно быть: id пользователя и pin

Подключение FA2:
```
POST /2FA-on
```
В body должно быть id пользователя

Отправка сообщения боту и получение мгновенного ответа от него:
```
POST /send-message-bot?userId=<id бота>&currentUserId=< отправителя>
```
id бота - "0f000000-000c-00d0-00d0-0d0000e00000"

В body должно быть: message : {
    id: 'id сообщения'
    message: 'Сообщение'
}

#### PATCH

Обновление пользовательских данных:
```
PATCH /update-user
```
В body должны быть: id, name, password и pin если подключена 2FA

Обновление сообщения:
```
PATCH /update-message?messageId=<id сообщения>&userId=<id пользователя>
```
В body должно быть message

#### DELETE

Удаление сообщения:
```
DELETE /delete-message?messageId=<id сообщения>&userId=<id пользователя>
```

### Команда разработчиков
<a href="https://github.com/ArtKonX" >ArtKonX</a> — ведущий разработчик проекта