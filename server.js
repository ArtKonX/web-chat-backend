const koaBody = require('koa-body').default;
const http = require('http');
const fs = require('fs');
require('dotenv').config();

const getConnection = require('./actions-with-bd/getConnection');

const { getWebSocketServer } = require('./websocket/websocket');
const pool = require('./db/db');
// MiddleWare связанный с проверкой токена JWT
const authCheckTokenMiddleware = require('./middleware/authCheckTokenMiddleware');

// Все запросы связанные с auth
const QueryRegistration = require('./requests/auth/QueryRegistaration');
const QueryLogin = require('./requests/auth/QueryLogin');
const QueryLogOut = require('./requests/auth/QueryLogOut');
const QueryGetUser = require('./requests/auth/QueryGetUser');
const QueryUpdateDataUser = require('./requests/auth/QueryUpdateDataUser');
const QueryGetPublicKeys = require('./requests/auth/QueryGetPublicKey');
const QueryRestoringAccess = require('./requests/auth/QueryRestoringAccess');

// Получение статуса юзера
const GetUserStatus = require('./requests/auth/GetUserStatus');

// Запросы связанные с 2FA
// Отключает 2FA
const Query2FADisable = require('./requests/security-auth/Query2FADisable');
// Подключает 2FA
const Query2FATurnOn = require('./requests/security-auth/Query2FATurnOn');

// Запросы связанные с отправкой, изменением, удалением и получением сообщений
const QuerySendMessage = require('./requests/messages/QuerySendMessage');
const QuerySendFileOnMessages = require('./requests/messages/QuerySendFileOnMessages');
const QueryGetMessages = require('./requests/messages/QueryGetMessages');
const QueryChangeMessage = require('./requests/messages/QueryChangeMessage');
const QueryDeleteMessage = require('./requests/messages/QueryDeleteMessage');
const QueryGetLengthNextMessages = require('./requests/messages/QueryGetLengthNextMessages');

// Для получения диалогов, их демо информации
const QueryInfoAboutDialogues = require('./requests/info-about-dialogues/QueryInfoAboutDialogues');

// Запросы, которые работают с городами
const QueryGetCities = require('./requests/cities/QueryGetCities');
const QueryUpdateCity = require('./requests/cities/QueryUpdateCity');

// Запрос, который работает с users
const QueryFindUsers = require('./requests/users/QueryFindUsers');

// Запрос, который работает с сообщениями БОТ'а
const QueryBotSendMessages = require('./requests/bot-logic/QueryBotSendMessages');

// Запрос, на проверку работы сервера
const QueryWorkServer = require('./requests/test-work-server/QueryWorkServer');

const Koa = require('koa');
const koaStatic = require('koa-static');
const Router = require('koa-router');
const path = require('path');
require('dotenv').config();

const app = new Koa();
app.proxy = true;
const publicPath = path.join(__dirname, '/public');
app.use(koaStatic(publicPath));
const port = process.env.PORT || 7070;

app.use(koaBody({
  text: true,
  urlencoded: true,
  multipart: true,
  json: true
}));

const frontendUrl = process.env.FRONTEND_URL_HTTP || process.env.FRONTEND_URL_HTTPS;

// CORS middleware
app.use(async (ctx, next) => {
  const origin = ctx.request.headers.origin || frontendUrl;

  console.log('origin', origin)

  ctx.set('Access-Control-Allow-Origin', origin);
  ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  ctx.set('Access-Control-Allow-Credentials', true);
  ctx.set('Vary', 'Origin');

  if (ctx.method === 'OPTIONS') {
    ctx.status = 204;
    return;
  }

  await next();
});

const router = new Router();

const sql = fs.readFileSync('./migrations/create_users_tables.sql', 'utf8');

const queries = sql.split(';').map(q => q.trim());

async function runMigrations(connection) {
  try {
    // перебираем все запросы
    for (const query of queries) {
      try {
        await new Promise((resolve, reject) => {
          connection.query(query, (err, _) => {
            if (err) return reject(err);
            console.log('Выполнен запрос: ', query);
            resolve();
          });
        });
      } catch (err) {
        if (err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.warn('Таблица уже существует: ', query);
        }
        console.error(err)
      }
    }
    console.log('Миграции успешно применены');
  } catch (err) {
    console.error('Ошибка при применении миграций: ', err);
  }
}

// Запускаем миграции через промис
async function connectWithRetries(maxRetries = 5, delay = 2000) {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      // Пытаемся получить соединение
      const connection = await new Promise((resolve, reject) => {
        pool.getConnection((err, conn) => {
          if (err) {
            return reject(err);
          }
          resolve(conn);
        });
      });

      // Если подключение успешное, запускаем миграции
      await runMigrations(connection);
      console.log('Подключено к MySQL!');
      console.log('Все готово!');
      connection.release();
      return;

    } catch (err) {
      attempts++;
      console.error(`Попытка ${attempts} подключения к БД не удалась:`, err.message);

      // Если достигли максимального числа попыток
      if (attempts >= maxRetries) {
        console.error('Превышено максимальное число попыток подключения');
        throw err;
      }

      // Ждем перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Обработчик ошибок пула
pool.on('error', async (err) => {
  console.error('Ошибка пула соединений:', err);

  try {
    // Попытка переподключения
    console.log('Попытка переподключения к БД...');
    await connectWithRetries();
  } catch (error) {
    console.error('Не удалось переподключиться:', error);
  }
});

// Запуск приложения
(async () => {
  try {
    await connectWithRetries();
  } catch (err) {
    console.error('Произошла критическая ошибка:', err);
    process.exit(1); // Завершаем процесс, если все попытки подключения неудачны
  }
})();

router.get('/test-work-server', QueryWorkServer);

router.post('/check-token', async (ctx, next) => {

  let connection;
  try {
    // Получаем соединение из пула
    connection = await getConnection(pool);

    // if (connection)
    await authCheckTokenMiddleware(ctx, next);
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/sing-in', async (ctx, next) => {
  let connection;
  try {

    connection = await getConnection(pool);

    if (connection) await QueryLogin(ctx, next, connection);
  } catch (error) {
    console.error(error);
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
});

// Без authMiddleware, потому что еще мы не зарегистрированы, не вошли или уже вышли
// а значит нет печенек
router.post('/registration', async (ctx) => {

  let connection;
  try {
    // Получаем соединение из пула
    connection = await getConnection(pool);

    if (connection) await QueryRegistration(ctx, connection);
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Выходим из аккаунта
router.post('/logout', QueryLogOut);

// На этом этапе уже нужно проверять токен
router.patch('/update-user', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
},
  async (ctx) => {
    let connection;
    try {
      connection = await getConnection(pool);

      if (connection) {
        await QueryUpdateDataUser(ctx, connection);
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

router.patch('/update-public-key', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
},
  async (ctx) => {
    let connection;
    try {
      connection = await getConnection(pool);

      if (connection) {
        await QueryRestoringAccess(ctx, connection);
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

router.get('/get-user-status', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
},
  async (ctx) => {
    let connection;
    try {
      connection = await getConnection(pool);

      if (connection) {
        await GetUserStatus(ctx, connection);
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

router.get('/get-public-keys', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
},
  async (ctx) => {
    let connection;
    try {
      connection = await getConnection(pool);

      if (connection) {
        await QueryGetPublicKeys(ctx, connection);
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

router.get('/get-info-dialogues', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
},
  async (ctx) => {
    let connection;
    try {
      connection = await getConnection(pool);
      if (connection) {
        await QueryInfoAboutDialogues(ctx, connection);
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

router.get('/get-user', async (ctx, next) => {
  let connection;
  try {
    // connection = await getConnection(pool);
    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
}, async (ctx, next) => {
  let connection;
  try {

        console.log('1 connection', connection)

    connection = await getConnection(pool);

    console.log('2 connection', connection)

    // if (connection) {

      await QueryGetUser(ctx, connection, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// роуты для городов
// запрос на получения городов сделаем без проверки JWT токена)
router.get('/get-cities', QueryGetCities);

// Когда изменяем данные, то нужна проверка
router.patch('/update-city', async (ctx, next) => {
  let connection;
  try {
    // Получаем соединение из пула
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
},
  async (ctx) => {
    let connection;
    try {
      connection = await getConnection(pool);

      if (connection) {
        await QueryUpdateCity(ctx, connection);
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (connection) {
        connection.release();
      } // Возвращаем соединение в пул
    }
  }
);

// роуты для работы с сообщениями
// нужна обязательная проверка JWT
router.get('/get-messages', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {

    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
}, async (ctx) => {
  let connection;
  try {
    connection = await getConnection(pool);

    if (connection) {

      await QueryGetMessages(ctx, connection);
    }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
});

router.get('/get-length-next-messages', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {

    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
}, async (ctx) => {
  let connection;
  try {
    connection = await getConnection(pool);

    if (connection) {

      await QueryGetLengthNextMessages(ctx, connection);
    }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
});

router.post('/create-message', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
}, async (ctx) => {
  let connection;
  try {
    connection = await getConnection(pool);

    if (connection) {

      await QuerySendMessage(ctx, connection);
    }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
});

router.patch('/update-message', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
}, async (ctx) => {
  let connection;
  try {
    connection = await getConnection(pool);

    if (connection) {

      await QueryChangeMessage(ctx, connection);
    }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
});

router.delete('/delete-message', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
}, async (ctx) => {
  let connection;
  try {
    connection = await getConnection(pool);

    if (connection) {

      await QueryDeleteMessage(ctx, connection);
    }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
});

router.post('/upload-file', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {

    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
}, async (ctx) => {
  let connection;
  try {
    connection = await getConnection(pool);

    if (connection) {

      await QuerySendFileOnMessages(ctx, connection);
    }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
});

// роут для получения пользователей
router.get('/get-users', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {

    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
}, async (ctx) => {
  let connection;
  try {
    // Получаем соединение из пула
    connection = await getConnection(pool);

    if (connection) {

      await QueryFindUsers(ctx, connection);
    }
  } catch (error) {
    console.error(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Пожалуй, самые опасные роуты, связанные с 2FA

router.post('/2FA-disable', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    // Освобождаем соединение
    if (connection) {
      connection.release();
    }
  }
},
  async (ctx) => {
    let connection;
    try {
      connection = await getConnection(pool);

      if (connection) {
        await Query2FADisable(ctx, connection);
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

router.post('/2FA-on', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {
    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
},
  async (ctx) => {
    let connection;
    try {
      connection = await getConnection(pool);

      if (connection) {
        await Query2FATurnOn(ctx, connection);
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
);

// Роут с логикой обмена сообщениями с ботом
router.post('/send-message-bot', async (ctx, next) => {
  let connection;
  try {
    connection = await getConnection(pool);

    // if (connection) {

    await authCheckTokenMiddleware(ctx, next);
    // }
  } catch (error) {
    console.error(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}, async (ctx) => {
  let connection;
  try {
    connection = await getConnection(pool);

    if (connection) {
      await QueryBotSendMessages(ctx, connection);
    }
  } catch (error) {
    console.error(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// каталог с временными файлами для показа в
// сообщениях
const tempDirMessagesFiles = path.join(__dirname, './public/tempGetMessages/encrypted');
// каталог с файлами отправленными, которые нам нужны
// временно для показа в websocket
const tempDirSendFiles = path.join(__dirname, './public/tempSendMessages/encrypted');

const cleanupFiles = () => {
  // читаем каталог
  [tempDirMessagesFiles, tempDirSendFiles].map(dir => {
    fs.readdir(dir, (err, files) => {

      if (err) return console.error(err);

      // перебираем все файлы
      if (files.length) {
        files.forEach(file => {
          const filePath = path.join(dir, file);

          // Получаем инфо о файле
          const fileStat = fs.statSync(filePath);

          // сколько секунд прошло с момента создания файла
          const fileAge = (Date.now() - fileStat.birthtimeMs) / 1000;

          // если больше 15, то удаляем
          if (fileAge > 15) {
            fs.unlinkSync(filePath);
          }
        });
      }
    });
  })
};

setInterval(() => {
  cleanupFiles()
}, 5000)

const server = http.createServer(app.callback());

app.use(router.routes()).use(router.allowedMethods());


const getWSServer = async () => {
  let connection;
  try {
    connection = await getConnection(pool);

    if (connection) {
      await getWebSocketServer(server, connection);
    }
  } catch (error) {
    console.error(error)
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

getWSServer()

server.listen(port, (err) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log('HTTPS сервер запущен на порту ' + port);
});