const r = require('rethinkdb');  
const config = require('./dbconfig.json');  
let conn;

r.connect(config.rethinkdb)  
    .then(connection => {
        console.log('Connecting RethinkDB...');
        conn = connection;
			return r.dbCreate('coopDraw').run(conn);
    })
    .then(() => {
        console.log('Все таблицы успешно очищены.');
		r.db('coopDraw').tableCreate('chat').run(conn);
        return r.db('coopDraw').tableCreate('boards').run(conn)
    })
    .then(() => console.log('Создана главная таблица.'))
    .error(err => console.log(err))
    .finally(() => process.exit(0));