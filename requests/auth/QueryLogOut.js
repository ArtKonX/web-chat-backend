module.exports = async function QueryLogout(ctx) {
    try {

        const isSecure = ctx.request.headers['x-forwarded-proto'] === 'https' || ctx.request.secure;
        // Для того чтобы выйти мы должны удалить куки
        // Для этого надо прописать в expires - 01 Jan 1970 00:00:01 GMT
        ctx.cookies.set('jwtToken', '', {
            expires: 0,
            httpOnly: true,
            secure: isSecure,
            sameSite: 'None',
            domain: 'web-chat-backend-s29s.onrender.com'
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