const io = require('socket.io')(666),
    r = require('rethinkdb'),
    cfg = require('./dbconfig.json');

function init() {
    let conn;
    r.connect(cfg.rethinkdb).then(conne => {
        console.log('Chat init.');
        io.on('connection', function(socket) {
            conn = conne;
            sendLastMessages(socket);
            socket.on('message', function(data) {
                let nick = data.nick || 'null',
                    msg = data.msg || 'null';
                doMessage(nick, msg, socket);
            })
        });

        function doMessage(nick, msg) {
            r.table('chat').insert({
                name: nick,
                msg: msg,
                date: Date.now()
            }).run(conn, () => {
                io.emit('message', {
                    name: nick,
                    msg: msg
                })
            })
        }

        function sendLastMessages(socket) {
            let n = 0,
                arr = 0;
            r.table('chat').orderBy('date').run(conn, (err, data) => {
                data = data.sort((a, b) => {
                    return a.date - b.date;
                }).slice(-10);
                data.forEach((el) => {
                    socket.emit('message', {
                        name: el.name,
                        msg: el.msg,
                    })
                })
            }).error(() => {
                console.log('Error sendLast');
            })
        }
    })
}

module.exports = {
    init: init
}