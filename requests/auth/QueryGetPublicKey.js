const findUserById = require('../../utils/utility-userid/findUserById');

module.exports = QueryGetPublicKeys = async (ctx, connection) => {
    try {
        const { recipientId, senderId } = ctx.request.query;

        // Если какое-то поле или поля не переданы
        // выбрасываем 400 статус
        if (!recipientId || !senderId) {
            console.error(`Не заполненно: id!`);
            ctx.response.status = 400;
            ctx.response.body = {
                message: `Не заполненно: id! ` + err.message,
                status: 'error'
            };
        }

        const findWarningRecipientUser = await findUserById(recipientId, 'id', 'users_warning', connection);
        const findWarningSenderUser = await findUserById(senderId, 'id', 'users_warning', connection);

        // Если такого нет выкидываем 404
        if (findWarningRecipientUser.message === 'error' || findWarningSenderUser.message === 'error') {
            console.error(`Переданные id получателя и отправителя не найдены`);
            ctx.response.status = 404;
            ctx.response.body = {
                message: `Переданные id получателя и отправителя не найдены`,
                status: 'error'
            };
            return
        }

        // Если существует, то отправляем его данные
        console.log('Успешное публичного ключа')
        ctx.response.status = 200;
        ctx.response.body = {
            publicKeys: [findWarningRecipientUser.public_key, findWarningSenderUser.public_key],
            message: 'Успешное публичного ключа!',
            status: 'ok'
        };

    } catch (err) {
        console.error('Ошибка получения публичного ключа ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка получения публичного ключа ' + err.message,
            status: 'error'
        };
    }
}