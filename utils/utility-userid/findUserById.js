module.exports = async function findUserById(userData, typeData, typeUsers, connection) {
    try {

        // Если тип юзеров не users_safe или users_warning
        // то выбрасываем ошибку в объекте
        if (!['users_safe', 'users_warning'].includes(typeUsers)) {
            return {
                message: 'error'
            };
        }

        const findUserList = await new Promise((res, rej) => {
            connection.query(
                `SELECT * FROM ${typeUsers} WHERE ${typeData} = ?`,
                [userData],
                (err, users) => {
                    if (err) {
                        return rej(err);
                    }

                    return res(users);
                }
            );
        });

        if (!findUserList) {

            return {
                message: 'error'
            };
        }

        return { ...findUserList[0] };

    } catch (error) {
        console.error('Ошибка при поиске пользователя:', error);
        throw error;
    }
}