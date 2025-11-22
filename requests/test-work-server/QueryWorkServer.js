module.exports = QueryWorkServer = (ctx) => {
    console.log('Успешное соединение с сервером');
    ctx.response.status = 200;
    ctx.response.body = {
        message: 'Успешное соединение с сервером',
        status: 'ok'
    }

    return
}