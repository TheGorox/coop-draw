const http = require('http');
const fs = require('fs');
const express = require('express');
const socketIO = require('socket.io');
const r = require('rethinkdb');
const config = require('./dbconfig.json');
const art = require('./art.js');
const chat = require('./chat.js');

const db = Object.assign(config.rethinkdb, {
    db: 'coopDraw'
});
const app = express();
const server = http.Server(app);
const io = socketIO(server);

let busy = false;

app.get('/', function(req, res) {
    fs.readFile('D:/srcС/open server/client/index.html', (err, html) => {
        res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        res.write(html);
        res.end();
    });
})
app.use(express.static('../../client/src'))
r.connect(db).then(conn => {
        let tosend = {};
        r.dbList().run(conn).then(arr => {
            if (arr.indexOf('coopDraw') == -1) {
                console.log('ДБ не найдена, иди на х*й!');
                process.exit(0);
            }
        });

        setInterval(() => {
            for (_art in tosend) {
                for (layer in tosend[_art]) {
                    art.updatePixels(_art, tosend[_art][layer], layer)
                }
            }
            tosend = {};
        }, 10000);

        io.on('connect', socket => {
            r.table('boards').orderBy('name').run(conn).then((cursors) => {
                let nameArr = [];
                cursors.forEach((item) => {
                    nameArr.push(item.name);
                })
                socket.emit('dbList', {
                    data: nameArr
                })
            })
            socket.on('dbCreate', (data) => {
                new art.Art(data.name, data.width, data.height, (res) => {
                    socket.emit('dbCreateResponse', {
                        result: res
                    })
                })
            })
            socket.once('getArt', (req) => {
                let name = req.name;
                r.db('coopDraw').table('boards').filter({
                    name: name
                }).run(conn, (err, cursor) => {
                    cursor.toArray((err, res) => {
                        socket.emit('getArt', {
                            data: res[0],
                            success: err ? false : true
                        });
                    })

                })
            }).on('putPixels', (data) => {
                let name = "";
                for (pxl in data) {
                    if (pxl == 'name') {
                        name = data[pxl];
                        continue;
                    }
                    let layer = data[pxl].l;
                    if (!tosend[name]) tosend[name] = {};
                    if (!tosend[name][layer]) tosend[name][layer] = {};
                    tosend[name][layer][pxl] = data[pxl].c;
                }
                io.emit('putPixels', data);
            }).on('addLayer', (d) => {
                if(busy) return;
                busy = true;
                let name = d.name,
                    artname = d.art;
                    art.addLayer(artname, name, (name, id) => {
                        busy = false;
                        console.log(name, id);
                        io.emit('addLayer', {
                            art: artname,
                            name: name,
                            id: id
                        })
                    });
            })
        })

        server.listen(2002, () => console.log('Сервер стартовал!'));
    })
    .error(err => {
        console.log('Не могу соедениться с бордой..');
        throw err;
    });

chat.init();