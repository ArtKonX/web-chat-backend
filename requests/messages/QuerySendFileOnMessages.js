// Для работы с переменным окружением (.env)
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const sendFileOnYD = require('../../utils-for-yd/sendFileOnYD');

const { broadcastMessage } = require('../../websocket/websocket');

// Для нахождения пользователя по id
const findUserById = require('../../utils/utility-userid/findUserById');

const getStatuses = require('../../actions-with-bd/getStatuses');

module.exports = QuerySendFileOnMessages = async (ctx, connection) => {

    try {
        const { file } = ctx.request.files;
        const { userId, currentUserId } = ctx.request.query;

        const message = JSON.parse(ctx.request.body.message);

        let fields = Object.entries({ file, userId, currentUserId });
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

        const dataStatuses = await getStatuses(userId, currentUserId, connection);

        // Для отправки сообщения через WS для правильного отображения
        // отправителя в диалогах
        const userIdData = await findUserById(userId, 'id', 'users_safe', connection);
        const currentUserIdData = await findUserById(currentUserId, 'id', 'users_safe', connection);

        const tempDirMessagesFiles = path.join(__dirname, '../../public/tempSendMessages/encrypted/' + file.originalFilename);
// https://web-chat-backend-s29s.onrender.com
        const fileTempPath = `http://localhost:7070/tempSendMessages/encrypted/` + file.originalFilename

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

        const listDates = messages.map(item => item.created_at)
        listDates.push(new Date())

        broadcastMessage({
            type: 'info-about-chat', lastMessage: `Файл: ${file.originalFilename} \n ${message.message}`,
            senderId: currentUserId, recipientId: userId,
            idMessage: message.id, lengthMessages: messages.length + 1,
            nameSender: {
                [userIdData.id]:
                    { name: userIdData.name },
                [currentUserIdData.id]:
                    { name: currentUserIdData.name }
            },
            listDates: listDates,
            userId: {
                [userIdData.id]:
                    { id: userIdData.id },
                [currentUserIdData.id]:
                    { id: currentUserIdData.id }
            },
            colorProfile: {
                [userIdData.id]:
                    { color_profile: userIdData.color_profile },
                [currentUserIdData.id]:
                    { color_profile: currentUserIdData.color_profile }
            },
            status: {
                [dataStatuses[0].id]:
                    { status: dataStatuses[0].status },
                [dataStatuses[1].id]:
                    { status: dataStatuses[1].status }
            }
        })

        // Теперь есть все, чтобы загрузить файл в облако и получить ссылку на него!
        // Это мы и делаем...
        const { href: hrefForFileOnYD, message: hrefYDMessage } = await sendFileOnYD({ file, dirForTempSaveFile: encryptedFilePath, ctx })

        if (hrefYDMessage !== 'success') {
            throw new Error('Ошибка отправки файла на Яндекс Диск')
        }

        // Если у нас есть href то все OK

        // Формируем данные сообщения
        const messageData = {
            id: message.id,
            date: new Date(),
            message: `Файл: ${file.originalFilename} \n ${message.message}`,
            authorId: currentUserId,
            userRecipient: userId,
            created_at: new Date(),
            file: {
                url: fileTempPath,
                type: metaDataFile.mimetype,
                name: metaDataFile.originalFilename,
                size: metaDataFile.size
            }
        }

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
        // Выставляем статус 200

        console.log('Файл успешно загружен на YD и сообщение отправлено!')
        ctx.response.status = 200;
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