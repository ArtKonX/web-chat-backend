const findUserById = require('../../utils/utility-userid/findUserById')

const { broadcastMessage } = require('../../websocket/websocket');

// Для формирования id сообщения у бота
const { v4: uuidv4 } = require('uuid');

// Цитаты из фильма Гарри Поттера
const quotes = require('../../data/harry.json');

// JSON с погодой
const weather = require('../../data/weather.json');

// Слова по мотивам фильма Star Wars
const words = require('../../data/words.json');

// Навзвания песен Майкла Джексона
const songs = require('../../data/songs.json');

module.exports = QueryBotSendMessages = async (ctx, connection) => {
    try {

        const { userId, currentUserId } = ctx.request.query;

        const message = JSON.parse(ctx.request.body.message);

        let fields = Object.entries({ currentUserId, userId, message });
        let notFields = [];

        // Перебор всех полей и добавление в notFields
        // полей которые не переданы
        fields.forEach(([key, value]) => {
            if (!value) {
                notFields.push(key);
            }
        })

        // Если какое-то поле или поля не переданы
        // выбрасываем 400 статус
        if (notFields.length > 0) {
            console.error(`Не заполненно: ${notFields.join(', ')}!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не заполненно: ${notFields.join(', ')}!`,
                status: 'error'
            };
        }

        // Находим информацию о юзере в безопасных данных
        // для взаимодействия с ботом
        const userSafeFind = await findUserById(currentUserId, 'id', 'users_safe', connection)

        // Если такого нет возвращаем статус 400
        if (userSafeFind.message === 'error') {
            console.error(`Пользователь с таким id - ${id} не найден!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Пользователь с таким id - ${id} не найден!`,
                status: 'error'
            };
        }

        const messages = await new Promise((res, rej) => {
            connection.query(
                'SELECT * FROM messages WHERE ((sender_id = ?) AND (recipient_id = ?)) OR ((sender_id = ?) AND (recipient_id = ?)) ORDER BY created_at',
                [currentUserId, userId, userId, currentUserId],
                (err, results) => {
                    if (err) return rej(err);

                    res(results);
                }
            );
        });

        // Сообщение юзера
        const messageDataFromUser = {
            id: message.id,
            created_at: new Date(),
            message: message.message,
            sender_id: currentUserId,
            recipient_id: "0f000000-000c-00d0-00d0-0d0000e00000"
        }

        const idMessageFromBot = uuidv4()

        // Если нам присылают пустую строку или Привет, Hello, Hi привествуем пользователя
        // и рассказываем про свою основные функции)
        if (!message.message.trim() || ['привет', 'hello', 'hi'].includes(message.message.toLowerCase())) {
            const messageTextWelcomeBot = `Привет - ${userSafeFind.name}! Тебя приветствует БОТ! Вот мои основные функции, написав одну из них в чате ты получишь ответ: 1)Цитата Волшебника 2)Рандомный курс Доллара 3)Рандомная погода 4)Звездные слова 5)Лунные песни
            `;

            // Формируем сообщения...
            // От бота и от юзера
            const messageDataFromBot = {
                id: idMessageFromBot,
                created_at: new Date(),
                message: messageTextWelcomeBot,
                sender_id: "0f000000-000c-00d0-00d0-0d0000e00000",
                recipient_id: currentUserId
            }

            Promise.all([
                new Promise((resolve, reject) => {
                    connection.query(
                        'INSERT INTO messages (id, sender_id, recipient_id, created_at, message) ' +
                        'VALUES (?, ?, ?, ?, ?)',
                        [
                            messageDataFromUser.id,
                            messageDataFromUser.sender_id,
                            messageDataFromUser.recipient_id,
                            messageDataFromUser.created_at,
                            messageDataFromUser.message
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                }),
                new Promise((resolve, reject) => {
                    connection.query(
                        'INSERT INTO messages (id, sender_id, recipient_id, created_at, message) ' +
                        'VALUES (?, ?, ?, ?, ?)',
                        [
                            messageDataFromBot.id,
                            messageDataFromBot.sender_id,
                            messageDataFromBot.recipient_id,
                            messageDataFromBot.created_at,
                            messageDataFromBot.message
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                })
            ])

            broadcastMessage({
                type: 'message', message: messageDataFromUser.message,
                senderId: currentUserId, recipientId: "0f000000-000c-00d0-00d0-0d0000e00000",
                idMessage: message.id
            })
            broadcastMessage({
                type: 'message', message: messageTextWelcomeBot,
                senderId: "0f000000-000c-00d0-00d0-0d0000e00000", recipientId: currentUserId,
                idMessage: idMessageFromBot
            })

            broadcastMessage({
                type: 'info-about-chat', lastMessage: messageTextWelcomeBot,
                senderId: "0f000000-000c-00d0-00d0-0d0000e00000",
                recipientId: currentUserId, idMessage: idMessageFromBot,
                lengthMessages: messages.length + 2, nameSender: 'БОТ',
                userId: "0f000000-000c-00d0-00d0-0d0000e00000"
            })

            // Отправляем статус 201 и отправляем массив с сообщениями БОТА и Юзера
            console.log('Сообщения успешно доставлены)')
            ctx.response.status = 201;
            ctx.response.body = {
                messages: [messageDataFromUser, messageDataFromBot],
                message: 'Сообщения успешно доставлены)',
                status: 'ok'
            }
        } else if (['цитата волшебника', 'рандомный курс доллара', 'рандомная погода', 'звездные слова', 'лунные песни'].includes(message.message.toLowerCase())) {
            // Если сработала какая-то функция бота то мы должны ее выполнить!

            // Функция для выдачи цитаты бота
            const getQuote = (message) => {
                switch (message) {
                    case 'цитата волшебника':
                        return 'Цитата из Волшебного фильма: ' + quotes.Quotes[Math.floor(Math.random() * quotes.Quotes.length)]
                    case 'рандомный курс доллара':
                        return "Наверное курс доллара - " + (Math.floor(Math.random() * (50 - 10 + 1)) + 10) + "руб."
                    case 'рандомная погода':
                        return "Наверное прогноз погоды - " + "Температура " + Math.floor(Math.random() * (40 - (-20) + 1)) + (-20) + ", Погода - " + weather.weather[Math.floor(Math.random() * weather.weather.length)]
                    case 'звездные слова':
                        return `Давным-давно...
                        ${words.words[Math.floor(Math.random() * words.words.length)]}`
                    case 'лунные песни':
                        return 'Michael Jackson - ' + songs.Songs[Math.floor(Math.random() * words.words.length)]
                    default:
                        return 'Не входит в функции Бота('
                }
            }

            const messageFromBot = getQuote(message.message.toLowerCase());

            const messageDataFromBot = {
                id: idMessageFromBot,
                created_at: new Date(),
                message: messageFromBot,
                sender_id: "0f000000-000c-00d0-00d0-0d0000e00000",
                recipient_id: currentUserId
            }

            broadcastMessage({
                type: 'message', message: messageDataFromUser.message,
                senderId: currentUserId, recipientId: "0f000000-000c-00d0-00d0-0d0000e00000",
                idMessage: message.id
            });

            broadcastMessage({
                type: 'message', message: messageFromBot,
                senderId: "0f000000-000c-00d0-00d0-0d0000e00000", recipientId: currentUserId,
                idMessage: idMessageFromBot
            });

            broadcastMessage({
                type: 'info-about-chat', lastMessage: messageFromBot,
                senderId: "0f000000-000c-00d0-00d0-0d0000e00000",
                recipientId: currentUserId, idMessage: idMessageFromBot,
                lengthMessages: messages.length + 2, nameSender: 'БОТ',
                userId: "0f000000-000c-00d0-00d0-0d0000e00000"
            });

            Promise.all([
                new Promise((resolve, reject) => {
                    connection.query(
                        'INSERT INTO messages (id, sender_id, recipient_id, created_at, message) ' +
                        'VALUES (?, ?, ?, ?, ?)',
                        [
                            messageDataFromUser.id,
                            messageDataFromUser.sender_id,
                            messageDataFromUser.recipient_id,
                            messageDataFromUser.created_at,
                            messageDataFromUser.message
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                }),
                new Promise((resolve, reject) => {
                    connection.query(
                        'INSERT INTO messages (id, sender_id, recipient_id, created_at, message) ' +
                        'VALUES (?, ?, ?, ?, ?)',
                        [
                            messageDataFromBot.id,
                            messageDataFromBot.sender_id,
                            messageDataFromBot.recipient_id,
                            messageDataFromBot.created_at,
                            messageDataFromBot.message
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                })
            ])
            // Отправляем статус 201 и отправляем массив с сообщениями БОТА и Юзера
            console.log('Сообщения успешно доставлены)')
            ctx.response.status = 201;
            ctx.response.body = {
                messages: [messageDataFromUser, messageDataFromBot],
                message: 'Сообщения успешно доставлены)',
                status: 'ok'
            }
        } else {
            const messageDataFromBot = {
                id: idMessageFromBot,
                created_at: new Date(),
                message: 'Не понял Вас, но, возможно, скоро пойму)',
                sender_id: "0f000000-000c-00d0-00d0-0d0000e00000",
                recipient_id: currentUserId
            }

            broadcastMessage({
                type: 'message', message: messageDataFromUser.message,
                senderId: currentUserId, recipientId: "0f000000-000c-00d0-00d0-0d0000e00000",
                idMessage: message.id
            });

            broadcastMessage({
                type: 'message', message: 'Не понял Вас, но, возможно, скоро пойму)',
                senderId: "0f000000-000c-00d0-00d0-0d0000e00000", recipientId: currentUserId,
                idMessage: idMessageFromBot
            });

            broadcastMessage({
                type: 'info-about-chat', lastMessage: 'Не понял Вас, но, возможно, скоро пойму)',
                senderId: "0f000000-000c-00d0-00d0-0d0000e00000",
                recipientId: currentUserId, idMessage: idMessageFromBot,
                lengthMessages: messages.length + 2, nameSender: 'БОТ',
                userId: "0f000000-000c-00d0-00d0-0d0000e00000"
            });

            Promise.all([
                new Promise((resolve, reject) => {
                    connection.query(
                        'INSERT INTO messages (id, sender_id, recipient_id, created_at, message) ' +
                        'VALUES (?, ?, ?, ?, ?)',
                        [
                            messageDataFromUser.id,
                            messageDataFromUser.sender_id,
                            messageDataFromUser.recipient_id,
                            messageDataFromUser.created_at,
                            messageDataFromUser.message
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                }),
                new Promise((resolve, reject) => {
                    connection.query(
                        'INSERT INTO messages (id, sender_id, recipient_id, created_at, message) ' +
                        'VALUES (?, ?, ?, ?, ?)',
                        [
                            messageDataFromBot.id,
                            messageDataFromBot.sender_id,
                            messageDataFromBot.recipient_id,
                            messageDataFromBot.created_at,
                            messageDataFromBot.message
                        ],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                })
            ])

            // Отправляем статус 201 и отправляем массив с сообщениями БОТА и Юзера
            console.log('Сообщения успешно доставлены)')
            ctx.response.status = 201;
            ctx.response.body = {
                messages: [messageDataFromUser, messageDataFromBot],
                message: 'Сообщения успешно доставлены)',
                status: 'ok'
            }
        }
    } catch (err) {
        console.error('Ошибка отправки сообщений ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка отправки сообщений ' + err.message,
            status: 'error'
        }
    }
}