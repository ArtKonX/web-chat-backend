module.exports = async function QueryLogout(ctx) {
    try {

        // Для того чтобы выйти мы должны удалить куки
        // Для этого надо прописать в expires - 01 Jan 1970 00:00:01 GMT
        ctx.cookies.set('jwtToken', '', {
            expires: new Date(0),
            httpOnly: true,
            secure: false,
            sameSite: 'None'
        });

        // Темерь мы вышли из системы!
        ctx.status = 200;
        ctx.body = {
            message: 'Успешный выход!',
            status: 'ok'
        };
    } catch (err) {
        console.error('Ошибка выхода из системы( ', err.message);
        ctx.response.status = 500;
        ctx.response.body = {
            message: 'Ошибка выхода из системы( ' + err.message,
            status: 'error'
        };
    }
};