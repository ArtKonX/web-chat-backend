const axios = require('axios');
const { urlYDApi } = require('../urls');

module.exports = getLinkFileFromYD = async (fileName) => {
    try {

        const fileResponseFromYD = await axios.get(
            `${urlYDApi}/download?path=/messages/${fileName}`, {
            headers: {
                Authorization: `OAuth ${process.env.O_Auth}`
            }
        });

        if (fileResponseFromYD.data.href) {
            return {
                href: fileResponseFromYD.data.href,
                message: 'success'
            }
        }

        return {
            message: 'error'
        }

    } catch (err) {
        console.log("Ошибка получения ссылки файла с Яндекс Диска ", err)
    }
}