// функция для получения ссылки файла с Яндекс Диска
const getLinkFileFromYD = require('../../utils-for-yd/getLinkFileFromYD');

// д еструктуризация нужных методов из библиотек
const { existsSync,
    mkdirSync,
    writeFileSync } = require('fs');
const { join } = require('path');

const axios = require('axios');

module.exports = QueryGetMessages = async (ctx, connection) => {
    try {
        const { currentUserId, userId, offSet } = ctx.request.query;

        // Если нет currentUserId выкидываем 400 статус
        if (!currentUserId) {
            console.error(`Не передан currentUserId`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не передан currentUserId`,
                status: 'error'
            };
            return
        }

        const currentOffset = offSet ? offSet : 0;
        const limit = 10;

        const queryBD = userId && currentUserId ?
            `SELECT * FROM messages WHERE ((sender_id = ?) AND (recipient_id = ?)) OR ((sender_id = ?) AND (recipient_id = ?)) ORDER BY created_at` :
            `SELECT * FROM messages WHERE (sender_id = ?) OR (recipient_id = ?) ORDER BY created_at`

        const paramsBD = userId && currentUserId ?
            [currentUserId, userId, userId, currentUserId] :
            [currentUserId, currentUserId]

        let messages = await new Promise((res, rej) => {
            connection.query(queryBD, paramsBD, (err, messgs) => {
                if (err) {
                    return rej(err);
                }

                return res(messgs);
            })
        })

        // Временное решение пока данные даты не поменялись
        messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        messages = messages.splice(currentOffset, limit).reverse()

        // Если сообщений нет то ставим статус 201
        // и возвращаем пустой массив
        if (!messages.length) {
            console.log('Сообщений нет( ');
            ctx.response.status = 200;
            ctx.response.body = {
                message: 'Сообщений нет!',
                messages: [],
                status: 'ok'
            };
            return
        }

        // Иначе продолжаем...

        // Функция для создания отсутсвующих папкок
        function createTempDirs() {
            const basePath = join(__dirname, '../../public/tempGetMessages/');
            const tempEncrPath = join(basePath, 'encrypted/');

            try {
                // Проверяем и создаем директории
                if (!existsSync(basePath)) {
                    mkdirSync(basePath, { recursive: true });
                }
                if (!existsSync(tempEncrPath)) {
                    mkdirSync(tempEncrPath, { recursive: true });
                }

                return {
                    encrPath: tempEncrPath
                };
            } catch (error) {
                console.error('Ошибка создания директорий:', error);
                throw error;
            }
        }

        const pathDirs = createTempDirs();

        // У нас есть все сообщения и если есть,
        // файлы, то...
        // Если имеются файлы:
        // 1. Скачиваем закодированный файл с Яндекс диска во временную папку
        // 2. Удаляем файл через какое-то время из временной директории,
        // чтобы не хранить его на сервере
        const allMessagesWithEcryptedDataFiles = await Promise.all(messages.map(async msg => {

            // Присваиваем сообщение updatedMessage для
            // дальнейшей модернизации
            const updatedMessage = { ...msg };

            try {
                // Получаем ссылку на файл с Яндекс Диска
                const linkFileFromYD = await getLinkFileFromYD(updatedMessage.file_name);

                if (linkFileFromYD.message === 'error') {
                    throw new Error('Произошла ошибка при получении ссылки на файл с ЯД')
                }

                if (linkFileFromYD.message === 'success') {

                    // Отправляем запрос на скачивание файла
                    const response = await axios.get(linkFileFromYD.href, {
                        responseType: 'arraybuffer',
                        timeout: 5000
                    });

                    // Путь до зашифрованного файла
                    const encryptedFilePath = join(pathDirs.encrPath, updatedMessage.file_name);

                    writeFileSync(encryptedFilePath, Buffer.from(response.data));

                    //Сохраняем url зашифрованного файла с сервера
                    // в сообщения
                    updatedMessage.file_url = `https://web-chat-backend-s29s.onrender.com/tempGetMessages/encrypted/` + updatedMessage.file_name
                    updatedMessage.file = {
                        originalName: updatedMessage.file_name,
                        file_url: 'https://web-chat-backend-s29s.onrender.com/tempGetMessages/encrypted/' + updatedMessage.file_name,
                        type: updatedMessage.file_type,
                        size: updatedMessage.file_size
                    };
                }

            } catch (err) {
                console.error('Ошибка формирования сообщения: ', err.message);
            }

            return updatedMessage;
        }))

        // Если мы прошли этот алгоритм, то возвращаем сообщение
        // со статусом 201

        if (allMessagesWithEcryptedDataFiles.length) {
            console.log('Успешное получение сообщений!');
            ctx.response.status = 200;
            ctx.response.body = {
                message: 'Сообщений получены!',
                messages: allMessagesWithEcryptedDataFiles,
                status: 'ok'
            };
        }

    } catch (err) {
        console.log('Ошибка получения сообщений!' + err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка получения сообщений!' + err.message,
            status: 'error'
        };
    }
}