// Для работы с переменным окружением (.env)
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const sendFileOnYD = require('../../utils-for-yd/sendFileOnYD');

const { broadcastMessage } = require('../../websocket/websocket');

// Для нахождения пользователя по id
const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = QuerySendFileOnMessages = async (ctx, connection) => {

    try {
        const { file } = ctx.request.files;
        const { userId } = ctx.request.query;
        const { currentUserId } = ctx.query;

        const message = JSON.parse(ctx.request.body.message);

        let fields = Object.entries({ file, userId, currentUserId, message });
        let notFields = [];

        // Перебор всех полей и добавление в notFields
        // полей которые не переданы
        fields.forEach(([key, value]) => {
            if (!value) {
                notFields.push(key);
            }
        })

        // Если какое-то поле или поля не переданы
        // выбрасываем 400 статус и ошибку в сообщении
        if (notFields.length) {
            console.error(`Не заполненно: ${notFields.join(', ')}!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не заполненно: ${notFields.join(', ')}!`,
                status: 'error'
            };
        }

        // Функция для создания отсутсвующих папкок
        function createTempDirs() {

            const basePath = path.join(__dirname, '../../public/tempSendMessages/');
            const tempEncrPath = path.join(basePath, 'encrypted/');

            try {
                // Проверяем и создаем директории
                if (!fs.existsSync(basePath)) {
                    fs.mkdirSync(basePath, { recursive: true });
                }
                if (!fs.existsSync(tempEncrPath)) {
                    fs.mkdirSync(tempEncrPath, { recursive: true });
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

        const ecryptedFilePath = path.join(pathDirs.encrPath, file.originalFilename);

        // копируем файл в по только, что созданному
        // пути
        fs.copyFileSync(file.filepath, ecryptedFilePath);

        const encryptedFilePath = path.join(pathDirs.encrPath, file.originalFilename);

        // Мета о файле
        const metaDataFile = {
            originalFilename: file.originalFilename,
            mimetype: file.mimetype,
            size: file.size
        }

        // Теперь есть все, чтобы загрузить файл в облако и получить ссылку на него!
        // Это мы и делаем...
        const { href: hrefForFileOnYD, message: hrefYDMessage } = await sendFileOnYD({ file, dirForTempSaveFile: encryptedFilePath, ctx })

        if (hrefYDMessage !== 'success') {
            throw new Error('Ошибка отправки файла на Яндекс Диск')
        }

        // Если у нас есть href то все OK

        const fileTempPath = `https://web-chat-backend-s29s.onrender.com/tempSendMessages/encrypted/` + file.originalFilename

        const tempDirMessagesFiles = path.join(__dirname, '../../public/tempSendMessages/encrypted/' + file.originalFilename);

        // Формируем данные сообщения
        const messageData = {
            id: message.id,
            date: new Date(),
            message: `Файл: ${file.originalFilename} \n ${message.message}`,
            authorId: currentUserId,
            userRecipient: userId,
            file: {
                url: fileTempPath,
                type: metaDataFile.mimetype,
                name: metaDataFile.originalFilename,
                size: metaDataFile.size
            }
        }

        const messages = await new Promise((resolve, reject) => {
            connection.query(
                'SELECT * FROM messages WHERE ((sender_id = ?) AND (recipient_id = ?)) OR ((sender_id = ?) AND (recipient_id = ?)) ORDER BY created_at',
                [currentUserId, userId, userId, currentUserId],
                (err, results) => {
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });

        // получаем юзера по id
        const user = await findUserById(userId, 'id', 'users_safe', connection);

        if (fs.existsSync(tempDirMessagesFiles)) {
            broadcastMessage({
                type: 'message', message: `Файл: ${file.originalFilename} \n ${message.message}`, senderId: currentUserId, recipientId: userId, idMessage: message.id, file: {
                    url: fileTempPath,
                    type: metaDataFile.mimetype,
                    name: metaDataFile.originalFilename,
                    size: metaDataFile.size
                }
            });
        }

        broadcastMessage({
            type: 'info-about-chat', lastMessage: `Файл: ${file.originalFilename} \n ${message.message}`,
            senderId: currentUserId, recipientId: userId,
            idMessage: message.id, lengthMessages: messages.length,
            nameSender: user.name,
            userId: userId
        })

        new Promise((resolve, reject) => {
            connection.query(
                'INSERT INTO messages (id, sender_id, recipient_id, created_at, message, file_url, file_type, file_name, file_size, iv) ' +
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    messageData.id,
                    messageData.authorId,
                    messageData.userRecipient,
                    messageData.created_at,
                    messageData.message,
                    hrefForFileOnYD,
                    metaDataFile.mimetype,
                    metaDataFile.originalFilename,
                    metaDataFile.size,
                    metaDataFile.iv
                ],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        })

        // Теперь файл на YD и src файла в сообщениях к переписке
        // Выставляем статус 201

        console.log('Файл успешно загружен на YD и сообщение отправлено!')
        ctx.response.status = 201;
        ctx.response.body = {
            messageData: messageData,
            message: 'Файл успешно загружен на YD и сообщение отправлено!',
            status: 'ok'
        }

    } catch (err) {
        console.error('Ошибка отправки файла на сервер и сохранения на ЯндексДиск( ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка отправки файла на сервер и сохранения на ЯндексДиск( ' + err.message,
            status: 'error'
        };
    }
}