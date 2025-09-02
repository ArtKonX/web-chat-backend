// Для констант .env
require('dotenv').config();

const fs = require('fs');
const axios = require('axios');

// Функция для получения уже с загруженного файла src с Я.Диска
const getLinkFileFromYD = require('../utils-for-yd/getLinkFileFromYD');

// Функция для получения url для последующей
// загрузки файла
const getUrlForDownloadingYD = require('../utils-for-yd/getUrlForDownloadingYD');

module.exports = sendFileOnYD = async ({ file, dirForTempSaveFile, ctx }) => {
    try {

        // Проверяем есть ли файл
        // Если нет выкидываем статус 400
        if (!file) {
            console.error(`Нет файла для запроса загрузки!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: 'Нет файла для запроса загрузки!',
                status: 'error'
            };
            return
        }

        // Так же нам нужен путь до файла на нашем сервере
        // Если его нет выкидываем статус 400
        if (!dirForTempSaveFile) {
            console.error(`Нет временного пути файла для загрузки файла на YD!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: 'Нет временного пути файла для загрузки файла на YD!',
                status: 'error'
            };

            return
        }

        // Вот он url!
        const { href: hrefForSend, message } = await getUrlForDownloadingYD(file.originalFilename);

        if (message === 'error') {
            return message
        }

        // Теперь по документации Яндекса нам нужно загрузить файл на диск
        // Для этого делаем еще запрос по url полученным только что
        //  и передаем файл по частям через поток(stream)
        await axios.put(
            hrefForSend,
            fs.createReadStream(dirForTempSaveFile)
        );

        // Теперь мы просто так не можем получить src файла
        // Чтобы его получить нам нужно запросить url для
        // скачивания это и будет нужная ссылка расположения файла
        const linkFileFromYD = await getLinkFileFromYD(file.originalFilename);

        // Отправляем ответ
        return linkFileFromYD;
    } catch (err) {
        console.error('Ошибка при загрузке файла на Яндекс Диск ', err);
        ctx.status = 500;
        ctx.body = {
            message: `Ошибка при загрузке файла на Яндекс Диск ${err}`
        };
    }
}