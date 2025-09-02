const axios = require('axios');
const { urlYDApi } = require('../urls');

module.exports = getUrlForDownloadingYD = async (filePath) => {
    try {

        const response = await axios.get(
            `${urlYDApi}/upload?path=/messages/${filePath}&overwrite=true`,
            {
                headers: {
                    Authorization: `OAuth ${process.env.O_Auth}`
                },
                templated: true
            });

        if (response.data.href) {

            console.log('Ссылка на загрузку файла получена успешно');

            return {
                href: response.data.href,
                message: 'success'
            }
        }

        return {
            message: 'error'
        }
    } catch (err) {
        throw new Error('Ошибка получения ссылки для загрузки файла на Яндекс диск')
    }
}