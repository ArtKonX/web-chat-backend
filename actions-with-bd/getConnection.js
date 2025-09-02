module.exports = getConnection = async (pool) => {
    try {
        return await new Promise((resolve, reject) => {
            pool.getConnection((err, conn) => {
                if (err) {
                    console.error('Ошибка подключения к БД:', err.message);
                    return reject(err);
                }

                // Возвращаем соединение
                resolve(conn);
            });
        });
    } catch (err) {
        console.error(err)
    }
}