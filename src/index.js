const http = require('http');
const fs = require('fs');
const express = require('express');
const WebSocketServer = require('ws').Server;

const art = require('./art.js');
const floodFill = require('./floodfill.js').floodFill;

const cfg = require('./serverConfig.json');
const brushes = require('./brushes.json');

const app = express();

const port = process.env.PORT || 5000

const fetch = require('isomorphic-fetch');
global.fetch = fetch;
const Dropbox = require('dropbox').Dropbox;

global.dbx = new Dropbox({
    accessToken: 'UOrUvdLvTWAAAAAAAAAAE7orJamPXDKRf6LrHAGCMwCjVZvKOVxO2b52xoknXSH9',
    fetch: fetch
});

const STATES = {
        'idle': 0,
        'mousedown': 1
    },
    incodes = {
        'pdown': 1,
        'pmove': 2,
        'pup': 3,
        'line': 4,
        'fill': 5,
        'chat': 6,
        'layerOpac': 7,
        'layerAdd': 8,
        'layerReplace': 9,
        'layerDelete': 10,
        'rect': 11,
        'circle': 12,
        'paste': 13,
        'cancel': 14
    },
    outcodes = {
        'pixels': 1,
        'line': 2,
        'fill': 3,
        'chatmsg': 4,
        'rect': 5,
        'circle': 6,
        'paste': 7,
        'cancelPixels': 8
    },
    actions = {
        'PIXELS': 1,
        'FILL': 2
    };

global.SHITMODE = true;

let busy = false;

let lastChatMessages = [];

function pushMessage(msg) {
    if (lastChatMessages.length > 10) lastChatMessages.shift()
    lastChatMessages.push(msg);
}

app.get('/', function(req, res) {
    fs.readFile(__dirname + '/client/index.html', (err, html) => {
        if (err) throw new Error(err)
        res.writeHead(200, {
            'Content-Type': 'text/html'
        });
        res.write(html);
        res.end();
    });
})
app.use(express.static(__dirname + '/client/src'))


const server = http.Server(app);


server.listen(port)

const wss = new WebSocketServer({
    server: server
});

console.log('Сервер стартовал!')

let tosend = {};

var openArts = {},
    connections = {}

setInterval(() => {
    for (key in openArts) {
        let name = openArts[key].name,
            data = JSON.stringify(openArts[key]);
        art.setArt(name, data, () => console.log('Бэкап'));
    }
}, cfg.backupDelay * 1000);

wss.on('connection', (socket, req) => {
    const ip = req.connection.remoteAddress;
    console.log('Входящее подключение: ' + ip);
    const myid = getRandomInt(10e5, 99e5);
    var lastpoint = [0, 0],
        currentColor = [0, 0, 0],
        currentBrush = 0,
        currentLayer = 'Main',
        currentFillstyle = 1;
    var currentAction = [];
    state = STATES.idle,
        artGet = false;
    connections[myid] = {
        'ws': socket,
        'art': null,
        'actions': []
    };

    function cancelAction() {
        let action = connections[myid].actions.pop();
        if (!action) return;
        switch (action.type) {
            case actions.PIXELS:
                {
                    let pxls = action.pixels;
                    for (i in pxls) {
                        let pxl = pxls[i].split(' ');
                        action.art.layers[action.layer].pixels[pxl[0]][pxl[1]] = +pxl[2];
                    }
                    let code = outcodes.cancelPixels;
                    let packed = packMessage([code, action.type, action.pixels, currentLayer]);
                    for (connection in connections) {
                        if (connections[connection].art !== connections[myid].art) continue;
                        connections[connection].ws.send(packed);
                    }
                    break;
                }
            case actions.FILL:
                {
                    let pxls = action.pixels;
                    let color = action.color;
                    for (i in pxls) {
                        let pxl = pxls[i].split(' ');
                        action.art.layers[action.layer].pixels[pxl[0]][pxl[1]] = color;
                    }
                    let code = outcodes.cancelPixels;
                    let packed = packMessage([code, action.type, action.pixels, color, currentLayer]);
                    for (connection in connections) {
                        if (connections[connection].art !== connections[myid].art) continue;
                        connections[connection].ws.send(packed);

                    }
                    break;
                }
        }
    }

    let busy = false

    socket.on('close', () => {
        delete connections[myid];
    })

    fs.readdir(__dirname + '/arts/', 'utf-8', (err, files) => {
        if (err) throw new Error('Ошибка при чтении списка артов: ' + err);
        console.log('Отдаю список файлов: ' + files);
        var msg = {
            'type': 'artList',
            'data': []
        }
        files.forEach(file => {
            msg.data.push(file)
        });
        socket.send(JSON.stringify(msg));
    });

    socket.on('message', message => {
        stringMessage(message)
    })

    for (message in lastChatMessages) {
        message = lastChatMessages[message];
        let messg = {
            'type': 'chatMsg',
            'nick': message.nick,
            'msg': message.message
        }
        msg = JSON.stringify(messg);
        socket.send(msg);
    }

    function getCurrentArt() {
        return openArts[connections[myid].art];
    }

    function drawPixels(coords) {
        let pixels = {},
            notalpha = "0",
            brush = brushes[currentBrush],
            middle = [(brush.length - 1) / 2 | 0, (brush[0].length - 1) / 2 | 0]
        let art = getCurrentArt();
        for (coord in coords) {
            x = coords[coord][0];
            y = coords[coord][1];
            for (let row = 0; row < brush.length; row++) {
                for (let col = 0; col < brush[row].length; col++) {
                    if (brush[row][col] == notalpha) {
                        pixels[(x + (row - middle[0])) + "," + (y + (col - middle[1]))] = 1
                    }
                }
            }
        }
        let decColor = rgb2decimal(currentColor[0], currentColor[1], currentColor[2]);
        let pixarr = [];
        for (key in pixels) {
            switch (currentFillstyle) {
                case 1:
                    {
                        let s = key.split(',');
                        let x = s[0],
                            y = s[1];
                        let art = getCurrentArt();
                        if (x < 0 || x > art.width - 1 || y < 0 || y > art.height - 1) continue
                        if (art.layers[currentLayer].pixels[x][y] == decColor &&
                            typeof art.layers[currentLayer].pixels[x][y] !== 'object') continue;
                        pixarr.push(key);
                        let color = 0;
                        if (art.layers[currentLayer].pixels[x][y] != 0) {
                            color = art.layers[currentLayer].pixels[x][y] || 16777215
                        }
                        currentAction.push([
                            x, y, color
                        ].join(' '))
                        break;
                    }
                case 2:
                    {
                        let s = key.split(',');
                        let x = s[0],
                            y = s[1];
                        let art = getCurrentArt();
                        if (x < 0 || x > art.width - 1 || y < 0 || y > art.height - 1) {
                            continue
                        } else {

                        }
                        if (x % 2 == 0 && y % 2 == 1 || x % 2 == 1 && y % 2 == 0) {
                            if (art.layers[currentLayer].pixels[x][y] == decColor &&
                                typeof art.layers[currentLayer].pixels[x][y] !== 'object') continue;
                            pixarr.push(key);
                            let color = 0;
                            if (art.layers[currentLayer].pixels[x][y] != 0) {
                                color = art.layers[currentLayer].pixels[x][y] || 16777215
                            }
                            currentAction.push([
                                x, y, color
                            ].join(' '))
                        }
                        break;
                    }
            }
        }

        for (n in pixarr) {
            let key = pixarr[n];
            let s = key.split(',');
            let x = s[0],
                y = s[1];
            art.layers[currentLayer].pixels[x][y] = decColor;
        }
        let code = outcodes.pixels;
        let packed = packMessage([code, pixarr, currentColor, currentLayer]);
        for (connection in connections) {
            //console.log(connection.art, connections[myid].art)
            if (connections[connection].art !== connections[myid].art) continue;
            connections[connection].ws.send(packed);
        }
    }

    function fillFlood(x, y) {
        let color = rgb2decimal(currentColor[0], currentColor[1], currentColor[2])
        let fill = floodFill(getCurrentArt().layers[currentLayer].pixels.slice(), x, y, color),
            pxls = fill[0],
            oldColor = fill[1];
        let art = getCurrentArt();
        let changed = [];
        let checked = [];
        for (n in pxls) {
            let key = pxls[n];
            let x = key[0],
                y = key[1];
            if (currentFillstyle == 1) {
                let c = art.layers[currentLayer].pixels[x][y];
                checked.push(x, y);
                changed.push([x, y].join(' '));
                art.layers[currentLayer].pixels[x][y] = color;
            } else if (x % 2 == 0 && y % 2 == 1 || x % 2 == 1 && y % 2 == 0) {
                checked.push(x, y);
                changed.push([x, y].join(' '));
                art.layers[currentLayer].pixels[x][y] = color;
            }
        }
        if (!changed.length) return;
        connections[myid].actions.push({
            'type': actions.FILL,
            'pixels': changed,
            'color': oldColor,
            'art': getCurrentArt(),
            'layer': currentLayer
        })
        let code = outcodes.fill;
        let packed = packMessage([code, currentColor, currentLayer, checked]);
        for (connection in connections) {
            if (connections[connection].art !== connections[myid].art) continue;
            connections[connection].ws.send(packed);
        }
    }

    function sendRect(x, y, x1, y1) {
        let code = outcodes.rect;
        let packed = packMessage([code, x, y, x1, y1, currentColor, currentLayer]);
        for (connection in connections) {
            if (connections[connection].art !== connections[myid].art) continue;
            connections[connection].ws.send(packed);
        }
    }

    function sendCircle(x, y, radius) {
        let code = outcodes.circle;
        let packed = packMessage([code, x, y, radius, currentColor, currentLayer]);
        for (connection in connections) {
            if (connections[connection].art !== connections[myid].art) continue;
            connections[connection].ws.send(packed);
        }
    }

    function sendPaste(x, y, width, pixels, layer) {
        let code = outcodes.paste;
        let packed = packMessage([code, x, y, width, pixels, layer]);
        for (connection in connections) {
            if (connections[connection].art !== connections[myid].art) continue;
            connections[connection].ws.send(packed);
        }
    }

    function packMessage(args) {
        return args.join(":");
    }

    function resetAction() {
        connections[myid].actions.push({
            'type': actions.PIXELS,
            'pixels': currentAction,
            'art': getCurrentArt(),
            'layer': currentLayer
        })
        currentAction = [];
    }

    function stringMessage(msg) {
        try {
            msg.startsWith('s'); // при отправке одного лишь байта в качестве пинга, эта функция вызовет ошибку
        } catch (e) {
            return
        }
        try {
            if (msg.startsWith('{')) {
                msg = JSON.parse(msg)
                switch (msg.type) {
                    case 'artCreate':
                        {
                            //return alert('Пока что я тебе арты не дам создать.')
                            new art.Art(msg.name, msg.width, msg.height, (res) => {
                                msg = {
                                    'type': 'artCreateResponse',
                                    'result': res
                                }
                                socket.send(JSON.stringify(msg));
                            })
                            break
                        }
                    case 'artGet':
                        {
                            if (artGet) {
                                alert("Вы уже получили список артов.")
                                return;
                            }
                            if (openArts[msg.name]) {
                                console.log('Уже есть')
                                res = {
                                    'type': 'artGet',
                                    'result': openArts[msg.name]
                                }
                                socket.send(JSON.stringify(res))
                                artGet = true;
                            }
                            art.getArt(msg.name, (result) => {
                                res = {
                                    'type': 'artGet',
                                    'result': result
                                }
                                socket.send(JSON.stringify(res))
                                artGet = true;
                                connections[myid].art = msg.name
                                if (!openArts[msg.name]) {
                                    openArts[msg.name] = result;
                                }
                            })
                            break
                        }
                    case 'chatMsg':
                        {
                            let nick = msg.nick;
                            if (!nick.length) return alert('Неверный ник.')
                            let message = msg.msg;
                            pushMessage({
                                nick: nick,
                                message: message
                            })
                            let messg = {
                                'type': 'chatMsg',
                                'nick': nick,
                                'msg': message
                            }
                            msg = JSON.stringify(messg);
                            for (connection in connections) {
                                connections[connection].ws.send(msg);
                            }
                            break
                        }
                    case 'layerAdd':
                        {
                            return
                            if (busy) return
                            busy = true
                            console.log('Adding layer: ' + ip)
                            let name = msg.name,
                                myart = getCurrentArt(),
                                layer = art.getOpts('qwe', myart.width, myart.height).layers.Main;
                            name = name.replace(' ', '_');
                            console.log(Object.keys(myart.layers), Object.keys(myart.layers).indexOf(name))
                            if (Object.keys(myart.layers).indexOf(name) >= 0) {
                                busy = false
                                return
                            }
                            myart.layers[name] = layer;
                            layer.name = name
                            layer.id = Object.keys(myart.layers).length
                            msg = {
                                'type': 'layerAdd',
                                'layer': layer
                            }
                            let packed = JSON.stringify(msg)
                            for (connection in connections) {
                                if (connections[connection].art !== connections[myid].art) continue;
                                connections[connection].ws.send(packed);
                            }
                            busy = false
                            break
                        }
                    case 'cancelAction':
                        {
                            cancelAction();
                        }
                }
            } else {
                let args = unpack(msg);

                let code = args[0];
                let offset = 1; // 0-й - это код
                switch (+code) {
                    case incodes.pdown:
                        { //pointerdown
                            console.log('pointerdown')
                            let x = +args[offset++],
                                y = +args[offset++],
                                layer = args[offset++],
                                color = args[offset++],
                                brush = +args[offset++],
                                fillstyle = +args[offset++];
                            currentLayer = layer;
                            currentColor = decimal2rgb(+color);
                            currentBrush = brush;
                            currentFillstyle = fillstyle;
                            state = STATES.mousedown;
                            if (x < -300 || y < -300 || x > art.width + 300 || y > art.height + 300) return;
                            lastpoint = [x, y];
                            drawPixels([
                                [x, y]
                            ])
                            break
                        }
                    case incodes.pmove:
                        { //pointermove
                            let x = +args[offset++],
                                y = +args[offset++];
                            let points = line(lastpoint[0], lastpoint[1], x, y);
                            if (x < -300 || y < -300 || x > art.width + 300 || y > art.height + 300) return;
                            lastpoint = [x, y]
                            drawPixels(points);
                            break
                        }
                    case incodes.pup:
                        {
                            if (!currentAction.length) return
                            resetAction();
                            break
                        }
                    case incodes.fill:
                        {
                            let x = +args[offset++],
                                y = +args[offset++],
                                layer = args[offset++],
                                color = args[offset++],
                                fillstyle = +args[offset++];
                            currentLayer = layer;
                            currentColor = decimal2rgb(+color);
                            currentFillstyle = fillstyle;
                            fillFlood(x, y);
                            break
                        }
                    case incodes.line:
                        {

                            let x = +args[offset++],
                                y = +args[offset++],
                                x1 = +args[offset++],
                                y1 = +args[offset++],
                                layer = args[offset++],
                                color = +args[offset++],
                                brush = args[offset++],
                                fillstyle = +args[offset++];
                            currentLayer = layer;
                            currentColor = decimal2rgb(color);
                            currentBrush = brush;
                            currentFillstyle = fillstyle;
                            let art = getCurrentArt();
                            if (x < -300 || y < -300 || x > art.width + 300 || y > art.height + 300) return;
                            let pixels = line(x, y, x1, y1);
                            drawPixels(pixels)
                            resetAction();
                            break
                        }
                    case incodes.rect:
                        {
                            console.log('Rect')
                            let x = +args[offset++],
                                y = +args[offset++],
                                x1 = +args[offset++],
                                y1 = +args[offset++],
                                layer = args[offset++],
                                color = +args[offset++];

                            let art = getCurrentArt();
                            if (x < 0) {
                                x = 0
                            } else if (x > art.width - 1) {
                                x = art.width - 1;
                            }
                            if (x1 < 0) {
                                x1 = 0
                            } else if (x1 > art.width - 1) {
                                x1 = art.width - 1;
                            }

                            if (y < 0) {
                                y = 0
                            } else if (y > art.height - 1) {
                                y = art.height - 1;
                            }
                            if (y1 < 0) {
                                y1 = 0
                            } else if (y1 > art.height - 1) {
                                y1 = art.height - 1;
                            }

                            currentLayer = layer;
                            currentColor = decimal2rgb(color);
                            let pixels = rect(x, y, x1, y1);

                            for (pxl in pixels) {
                                pxl = pixels[pxl]
                                if (pxl[0] < 0 || pxl[0] > art.width - 1 || pxl[1] < 0 || pxl[1] > art.height - 1) continue;
                                let color = 0;
                                if (art.layers[currentLayer].pixels[pxl[0]][pxl[1]] != 0) {
                                    color = art.layers[currentLayer].pixels[pxl[0]][pxl[1]] || 16777215
                                }
                                currentAction.push([
                                    pxl[0], pxl[1], color
                                ].join(' '))
                                art.layers[currentLayer].pixels[pxl[0]][pxl[1]] = color;
                            }
                            resetAction();
                            sendRect(x, y, x1, y1);
                            break
                        }
                    case incodes.circle:
                        {
                            console.log('Circle')
                            let x = +args[offset++],
                                y = +args[offset++],
                                radius = +args[offset++],
                                layer = args[offset++],
                                color = +args[offset++];
                            currentLayer = layer;
                            currentColor = decimal2rgb(color);
                            let art = getCurrentArt();
                            let pixels = circle(x, y, radius);
                            for (pxl in pixels) {
                                pxl = pixels[pxl]
                                if (pxl[0] < 0 || pxl[0] > art.width || pxl[1] < 0 || pxl[1] > art.height) continue;
                                let col = 0;
                                if (art.layers[currentLayer].pixels[pxl[0]][pxl[1]] != 0) {
                                    col = art.layers[currentLayer].pixels[pxl[0]][pxl[1]] || 16777215
                                }
                                currentAction.push([
                                    pxl[0], pxl[1], col
                                ].join(' '))
                                art.layers[currentLayer].pixels[pxl[0]][pxl[1]] = color;
                            }
                            resetAction();
                            sendCircle(x, y, radius);
                            break
                        }
                    case incodes.paste:
                        {
                            //return
                            let x = +args[offset++],
                                y = +args[offset++],
                                width = +args[offset++],
                                pixels = args[offset++].split(','),
                                layer = args[offset++];
                            if (pixels.length / 4 > getCurrentArt().width * getCurrentArt().height) return alert('Ты что, охуел?');
                            let art = getCurrentArt();
                            currentLayer = layer;
                            for (let i = 0; i < pixels.length; i += 4) {
                                let color = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
                                if (color[3] < 127) continue;
                                let _x = i / 4 % width,
                                    _y = i / 4 / width | 0;
                                let colz = 0;
                                if (art.layers[currentLayer].pixels[x + _x][y + _y] != 0) {
                                    colz = art.layers[currentLayer].pixels[x + _x][y + _y] || 16777215
                                }
                                currentAction.push([
                                    x + _x, y + _y, colz
                                ].join(' '))
                                let col = rgb2decimal(+color[0], +color[1], +color[2]);
                                art.layers[currentLayer].pixels[x + _x][y + _y] = col;
                            }
                            resetAction();
                            sendPaste(x, y, width, pixels.join(','), layer);
                        }
                }
            }
        } catch (e) {
            console.warn(e);
        }


    }

    function alert(msg) {
        socket.send(JSON.stringify({
            'type': 'alert',
            'data': msg
        }))
    }
});

function unpack(arg) {
    return arg.split(':');
}

function swap(n, n2) {
    let n0 = n;
    n = n2;
    n2 = n0;
    return [n, n2];
}

function line(x, y, x2, y2) {
    let pointArr = [];
    let steep = Math.abs(y2 - y) > Math.abs(x2 - x);
    if (steep) {
        let swp = swap(x, y),
            swp2 = swap(x2, y2);
        x = swp[0];
        y = swp[1];
        x2 = swp2[0];
        y2 = swp2[1];
    }
    let reverseFlag = false;
    if (x > x2) {
        let swp0 = swap(y, y2);
        y = swp0[0];
        y2 = swp0[1];
        let swp = swap(x, x2);
        x = swp[0];
        x2 = swp[1];
        reverseFlag = true;
    }
    let dist = {
        x: x2 - x,
        y: Math.abs(y2 - y)
    }
    let err = dist.x / 2;
    let stepY = (y < y2) ? 1 : -1;
    for (x; x <= x2; x++) {
        pointArr.push([steep ? y : x, steep ? x : y]);
        err -= dist.y;
        if (err < 0) {
            y += stepY;
            err += dist.x;
        }
    }
    if (reverseFlag) pointArr.reverse();
    return pointArr;
}

function rect(x, y, x1, y1) {
    let output = []
    if (x > x1) {
        let swp = swap(x, x1);
        x = swp[0],
            x1 = swp[1];
    }
    if (y > y1) {
        let swp = swap(y, y1);
        y = swp[0],
            y1 = swp[1];
    }

    for (let c = 0; c < x1 - x + 1; c++) {
        for (let r = 0; r < y1 - y + 1; r++) {
            output.push([c + x, r + y]);
        }
    }
    return output;

}

function circle(x1, y1, R) {
    let output = [];
    let x = 0;
    let y = R;
    let delta = 1 - 2 * R;
    let error = 0;
    let i = 0
    while (y >= 0) {
        output.push([(+x1 + +x) | 0, (+y1 + +y) | 0]);
        output.push([(+x1 + +x) | 0, (y1 - y) | 0]);
        output.push([(x1 - x) | 0, (+y1 + +y) | 0]);
        output.push([(x1 - x) | 0, (y1 - y) | 0]);
        error = 2 * (delta + y) - 1
        if ((delta < 0) && (error <= 0)) {
            delta += 2 * ++x + 1
            continue
        }
        if ((delta > 0) && (error > 0)) {
            delta -= 2 * --y + 1
            continue
        }
        delta += 2 * (++x - y--);

    }
    return output;
}

function decimal2rgb(dec) {
    if (typeof dec === 'object') return [255, 255, 255];
    let rgb = [
        (dec & 0xff0000) >> 16,
        (dec & 0x00ff00) >> 8,
        (dec & 0x0000ff)
    ];
    return [rgb[0], rgb[1], rgb[2]]
}

function rgb2decimal(r, g, b) {
    return (r << 16) + (g << 8) + (b)
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

//chat.init();