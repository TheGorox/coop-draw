document.addEventListener('DOMContentLoaded', ready)

function ready() {
    const outcodes = {
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
        incodes = {
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

    function swap(n, n2) {
        let n0 = n;
        n = n2;
        n2 = n0;
        return [n, n2];
    }

    let shapes = {
        'line': (x, y, x2, y2) => {
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
        },
        'circle': (x1, y1, R) => {
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
    }
    window.shapes = shapes;

    function packMessage(args) {
        return args.join(":");
    }

    // chatSocket = new WebSocket("ws://" + window.location.host.replace(/:\d+/, '') + ':666'),
    console.log('Ready!')
    boardSocket = new WebSocket(location.origin.replace(/^http/, 'ws'));
    boardSocket.onopen = function() {
        console.log('Board socket open.');
        setInterval(function pinger() {
            let dv = new DataView(new ArrayBuffer(1))
            dv.setUint8(0, 1);
            boardSocket.send(dv.buffer);
        }, 30000)
    }

    function chatMessage(nick, text) {
        let all = '<div><a class="nick">' + nick + ': </a><span class="msg"> ' + text + '</span></div>';
        $('#logbd').append(all);
        $('#log')[0].scrollTop = $('#log')[0].scrollHeight;
    }

    function stringMessage(data) {
        if (data.startsWith('{')) {
            data = JSON.parse(data);
            console.warn(data.type);
            switch (data.type) {
                case 'artList':
                    if (!data.data.length) {
                        $('#exist').hide();
                    }
                    $('#waitPos').hide();
                    if (data.data.length) {
                        data.data.forEach(el => {
                            $('#selectBase').append(`<option value='${el}'> ${el} </option>`)
                        })
                    }
                    break
                case 'alert':
                    alert(data.data);
                    break
                case 'chatMsg':
                    let msg = data.msg,
                        nick = data.nick;
                    chatMessage(nick, msg);

            }
        } else {
            let args = data.split(':');
            let type = args[0];
            switch (+type) {}
        }
    }

    function listener(data) {
        data = data.data;
        if (typeof data === 'string') return stringMessage(data);
    }
    boardSocket.addEventListener('message', listener)

    var nick = 'anon';
    if (!!localStorage.savedNickname) {
        $('#nickQuery')[0].style.visibility = 'hidden';
        nick = localStorage.savedNickname;
    } else {
        $('#nickSumbit').on('keydown', function(e) {
            if (e.keyCode !== 13) return;
            nick = $('#nickSumbit')[0].value;
            $('#nickQuery')[0].style.visibility = 'hidden';
            localStorage.savedNickname = nick;
        })
    }

    function chatSend(e) {
        if (e.keyCode && e.keyCode !== 13) return;
        let val = $('#sendVal')[0].value;
        if (val.length < 1) return;
        $('#sendVal')[0].value = '';
        msg = {
            'type': 'chatMsg',
            'nick': nick,
            'msg': val
        }
        boardSocket.send(JSON.stringify(msg));
    }

    $('#sendVal').on('keydown', chatSend);
    //$('#waitPos').hide();
    $('#workspace').hide();

    $('#sendButton').on('click', chatSend)

    $('#createNew').on('click', function() {
        let name = $('#chooseName')[0].value,
            wid = $('#chooseWid')[0].value,
            hei = $('#chooseHei')[0].value;
        if (!name || !hei || !wid) return alert('Не все поля заполнены.');
        if (hei > 5000 || wid > 5000) return alert('Ты чё, пёс? Зачем такой большой?')
        $('#waitPos').show();
        boardSocket.send(JSON.stringify({
            type: 'artCreate',
            name: name,
            width: +wid,
            height: +hei
        }))

        function response(data) {
            data = data.data;
            if (typeof data !== 'string') return;
            data = JSON.parse(data);
            if (data.type != 'artCreateResponse') return;
            if (data.result == true) {
                openArt(name);
            } else {
                alert('Арт с таким именем уже существует, либо ты намудил в названии, увы.')
            }
            boardSocket.removeEventListener('message', response)
        }
        boardSocket.addEventListener('message', response)
    })

    $('#agaButton').on('click', function() {
        $('#waitPos').show();
        openArt($('#selectBase')[0].value);
    })

    function openArt(name) {
        boardSocket.send(JSON.stringify({
            type: 'artGet',
            name: name
        }))

        function once(data) {
            console.warn('test');
            data = data.data;
            if (typeof data !== 'string') return;
            data = JSON.parse(data);
            if (data.type != 'artGet') return;
            $('#waitPos').hide();
            $('#chooseBoardPos').hide();
            initWorkspace(data.result);
            boardSocket.removeEventListener('message', once)
        }
        boardSocket.addEventListener('message', once)
    }


    function initWorkspace(data) {
        $('.listbut').on('click', function list(e) {
            let elem = e.target;
            $(elem).off('click');
            let arr = elem.previousElementSibling.children;
            let container = elem.previousElementSibling;
            for (let i = 0; i < arr.length; i++) {
                arr[i].className = 'visible';
            }

            for (let i = 0; i < arr.length; i++) {
                arr[i].addEventListener('click', click);
            }

            function click(ev) {
                container.insertBefore(ev.target.className == 'visible' ? ev.target : ev.target.parentElement, container.firstElementChild);
                elem.blur();
            }
            $(elem).on('blur', () => {
                setTimeout(() => {
                    $(elem).on('click', list);
                    $(elem).off('blur');
                    for (let i = 0; i < arr.length; i++) {
                        arr[i].className = 'hidden';
                        arr[i].removeEventListener('click', click);
                    }
                }, 300);
            })
        });
        $('#workspace').show();
        let game = new Game(data);
    }

    function Game(props) {
        boardSocket.removeEventListener('message', message);
        boardSocket.removeEventListener('message', listener);

        function stringMessage(msg) {
            if (!msg.startsWith('{')) {
                let args = msg.split(':');
                let type = args[0];
                switch (+type) {
                    case incodes.pixels:
                        {
                            let color = args[2].split(','),
                                layer = args[3],
                                pixels = args[1].split(',');
                            for (let i = 0; i < pixels.length; i += 2) {
                                let x = pixels[i],
                                    y = pixels[i + 1];
                                updatePixel({
                                    layer: layer,
                                    col: color,
                                    x: x,
                                    y: y
                                })
                            }
                            break
                        }
                    case incodes.fill:
                        {
                            let color = args[1].split(','),
                                layer = args[2],
                                pixels = args[3].split(',');
                            for (let i = 0; i < pixels.length; i += 2) {
                                let x = pixels[i],
                                    y = pixels[i + 1];
                                updatePixel({
                                    layer: layer,
                                    col: color,
                                    x: x,
                                    y: y
                                })
                            }
                            break
                        }
                    case incodes.rect:
                        {
                            let x = args[1],
                                y = args[2],
                                x1 = args[3],
                                y1 = args[4],
                                color = args[5].split(','),
                                layer = args[6]
                            let ctx = $('#layer' + layer)[0].getContext('2d');
                            ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
                            ctx.fillRect(x, y, x1 - x + 1, y1 - y + 1);
                            console.log(args)
                            break
                        }
                    case incodes.circle:
                        {
                            console.log(args);
                            let x = args[1],
                                y = args[2],
                                r = args[3],
                                color = args[4].split(','),
                                layer = args[5];
                            let ctx = $('#layer' + layer)[0].getContext('2d');
                            ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;

                            let pixels = shapes.circle(x, y, r);
                            for (pixel in pixels) {
                                pixel = pixels[pixel];
                                let x = pixel[0],
                                    y = pixel[1];
                                ctx.fillRect(+x, +y, 1, 1);
                            }
                            break
                        }
                    case incodes.paste:
                        {
                            let x = +args[1],
                                y = +args[2],
                                wid = +args[3],
                                pxls = args[4].split(','),
                                layer = args[5];
                            let ctx = $('#layer' + layer)[0].getContext('2d');
                            console.log(ctx)
                            for (let i = 0; i < pxls.length; i += 4) {
                                let color = [pxls[i], pxls[i + 1], pxls[i + 2], pxls[i + 3]];
                                if (color[3] < 127) continue;
                                let _x = i / 4 % wid,
                                    _y = i / 4 / wid | 0;
                                ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
                                ctx.fillRect(x + _x, y + _y, 1, 1);
                            }
                            break
                        }
                    case incodes.cancelPixels:
                        {
                            console.log(args);
                            switch (+args[1]) {
                                case actions.PIXELS:
                                    {

                                        let pxls = args[2].split(','),
                                            layer = args[3];
                                        if (!layer) layer = args[4];
                                        let ctx = $('#layer' + layer)[0].getContext('2d');
                                        for (let i = 0; i < pxls.length; i++) {

                                            let pxl = pxls[i].split(' ')
                                            let x = +pxl[0],
                                                y = +pxl[1],
                                                c = pxl[2];
                                            let color = decimal2rgb(+c);
                                            ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
                                            ctx.fillRect(x, y, 1, 1);
                                        }

                                        break
                                    }
                                case actions.FILL:
                                    {
                                        let pxls = args[2].split(','),
                                            col = +args[3],
                                            layer = args[4];
                                        let color = decimal2rgb(col);
                                        let ctx = $('#layer' + layer)[0].getContext('2d');
                                        ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
                                        for (pixel in pxls) {
                                            let pxl = pxls[pixel].split(' ');
                                            let x = pxl[0],
                                                y = pxl[1];
                                            ctx.fillRect(x, y, 1, 1);
                                        }
                                        break
                                    }
                            }
                        }
                }
            } else {
                try {
                    msge = JSON.parse(msg);
                    switch (msge.type) {
                        case 'chatMsg':
                            let msg = msge.msg,
                                nick = msge.nick;
                            chatMessage(nick, msg);
                            break
                        case 'alert':
                            alert(msge.data);
                            break
                        case 'layerAdd':
                            console.log('layer');
                            it.layers[msge.layer.name] = msge.layer;
                            createLayer(msge.layer);
                            break

                    }
                } catch (e) {
                    console.log(e)
                }
            }
        }

        function binaryMessage(msg) {}

        function message(message) {
            data = message.data;
            if (typeof data === 'string') return stringMessage(data);
            binaryMessage(data);
        }

        boardSocket.addEventListener('message', message)

        this.layers = {};
        this.keys = {
            'grid': 71,
            'swap': 88,
            'move': 77,
            'fastmove': 32,
            'pipette': 80,
            'floodfill': 70
        }

        this.tools = {
            'pen': 0,
            'fill': 1,
            'move': 2,
            'pipette': 3,
            'line': 4,
            'rect': 5,
            'circle': 6
        }

        toggleGrid();

        this.drawStyles = {};
        this.width = +props.width;
        this.height = +props.height;
        this.zoom = 1;
        this.offX = this.offY = 0;
        this.activeLayer = 'Main';
        this.activeArt = props.name;
        this.currentColor = [0, 0, 0];
        this.tempColor = [255, 255, 255];
        this.activeTool = this.tools.pen;
        this.scrollWid = testScrollWidth();
        this.chatHidden = false;
        this.coords = [0, 0];
        this.stack = {
            name: this.activeArt
        };

        crateZoomPattern('zoom_unreachable.png');

        $('#hideChat').on('click', toggleChat);

        let it = this;

        let keywork = false;

        updateColor();

        for (layer in props.layers) {
            it.layers[props.layers[layer].name] = props.layers[layer];
            createLayer(props.layers[layer]);
        }

        createPrevCanvas(this.width, this.height)

        setInterval(function() {
            for (layer in it.layers) {
                layer = it.layers[layer]
                let canvas = $('#minimap' + layer.name)[0],
                    ctx = canvas.getContext('2d'),
                    ctxL = $('#layer' + layer.name)[0].getContext('2d');
                for (let x = 0; x < 28; x++) {
                    for (let y = 0; y < 28; y++) {
                        let col = ctxL.getImageData((it.width / 28) * x, (it.height / 28) * y, 1, 1).data;
                        ctx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }, 3000);

        initToolEvents();
        initBoardEvents();
        initScrollEvents();
        RGBListener();
        initDrawStyles();

        center(this.width / 2, this.height / 2);

        function isTyping() {
            return !!$('input:focus').length
        }

        function getBrush() {
            return $('#patternStyle1')[0].children[0].children[0].getAttribute('brushid')
        }

        function getFillstyle() {
            return $('#patternStyle2')[0].firstElementChild.firstElementChild.dataset.id
        }

        function initToolEvents() {
            $('.tool').on('click', (e) => {
                if (!e.target.className.startsWith('tool')) return
                let elem = e.target,
                    toolName = elem.id.slice(4).toLowerCase();
                it.activeTool = it.tools[toolName];
                $('.tool.chosen')[0].className = 'tool';
                elem.className = 'tool chosen';
            });

            $('.button').on('click', (e) => {
                let elem = e.target,
                    toolName = elem.id.slice(4).toLowerCase();
                console.log(toolName)
                switch (toolName) {
                    case 'grid':
                        toggleGrid();
                        break
                    case 'layeradd':
                        showLayerCreator();
                        break
                    case 'paste':
                        pasteTool();
                        break
                }
            })
        }

        function createPrevCanvas(width, height) {
            let canvas = document.createElement('canvas');
            canvas.id = 'highlight';
            canvas.width = width;
            canvas.height = height;
            canvas.style.imageRendering = 'pixelated';
            canvas.style.opacity = '.7';
            canvas.style.position = 'absolute';
            canvas.zIndex = '3'
            $('#artMove')[0].appendChild(canvas);
            it.highlightCTX = $('#highlight')[0].getContext('2d');
        }

        function toggleChat() {
            if (this.chatHidden) {
                $('#chatPos').css('height', '');
                $('#log').css('height', '').css('font-size', '')
            } else {
                $('#chatPos').css('height', '43px');
                $('#log').css('height', '16px').css('font-size', '12px')
            }
            $('#log')[0].scrollTop = $('#log')[0].scrollHeight;
            this.chatHidden = !this.chatHidden;
        }

        function renderZoom(centerX, centerY, layer = it.activeLayer) {
            let podsudimy = $('#zoomedView')[0].getContext('2d');
            podsudimy.fillStyle = it.zoomPattern;
            podsudimy.fillRect(0, 0, 16 * 10, 16 * 7);
            let startX = centerX - 4,
                startY = centerY - 3,
                endX = centerX + 6,
                endY = centerY + 4;
            for (let x = 0; x < endX - startX; x++) {
                for (let y = 0; y < endY - startY; y++) {
                    if (startX + x < 0 || startY + y < 0 || startX + x > it.width - 1 || startY + y > it.height - 1) continue;
                    let pxl = getPixel(startX + x, startY + y, layer);
                    podsudimy.fillStyle = `rgb(${pxl[0]},${pxl[1]},${pxl[2]})`;
                    podsudimy.fillRect(x * 16, y * 16, 16, 16);
                }
            }
        }

        function highlightPixel(x, y, dontclear, right) {
            let ctx = it.highlightCTX;
            !dontclear && ctx.clearRect(0, 0, it.width, it.height);
            let pixels = comparePixel(x, y);
            let col = right ? it.tempColor : it.currentColor;
            ctx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
            for (pixel in pixels) {
                pixel = pixel.split(',');
                let x = pixel[0],
                    y = pixel[1];
                ctx.fillRect(x, y, 1, 1);
            }
        }

        function hightlightPixelD(x, y, dontclear, right) {
            let ctx = it.highlightCTX;
            !dontclear && ctx.clearRect(0, 0, it.width, it.height);
            let col = right ? it.tempColor : it.currentColor;
            ctx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
            ctx.fillRect(x, y, 1, 1);
        }

        function highlightRect(x, y, w, h, right) {
            let ctx = it.highlightCTX;
            ctx.clearRect(0, 0, it.width, it.height);
            let col = right ? it.tempColor : it.currentColor;
            ctx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
            ctx.fillRect(x, y, w, h);
        }

        function comparePixel(x, y) {
            let output = {};
            let center = [16, 16],
                startX = x - center[0],
                startY = y - center[1];
            let canvas = document.createElement('canvas');
            canvas.width = canvas.height = 32;
            let ctx = canvas.getContext('2d');

            ctx.drawImage($('#patternStyle1 img')[0], 0, 0, 32, 32, 0, 0, 32, 32);
            let data = ctx.getImageData(0, 0, 32, 32).data

            for (let g = 0; g < 32; g++) {
                for (let h = 0; h < 32; h++) {
                    let index = (h * 32 + g) * 4;
                    if (data[index] === 255 && data[index + 1] === 255 && data[index + 2] === 255) {
                        let x = startX + g,
                            y = startY + h;
                        if (getFillstyle() == '1') {
                            output[x + ',' + y] = true;
                        } else {
                            switch (getFillstyle()) {
                                case '2':
                                    if (x % 2 == 0 && y % 2 == 1 || x % 2 == 1 && y % 2 == 0) {
                                        output[x + ',' + y] = true;
                                    }
                                    break
                            }
                        }
                    }

                }
            }
            return output;
        }

        function eq(a, b) {
            return a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
        }

        function getPixel(x, y, layer) {
            return $('#layer' + it.activeLayer)[0].getContext('2d').getImageData(x, y, 1, 1).data.slice(0, -1)
        }

        function updatePixel(data) {
            let ctx = $('#layer' + data.layer)[0].getContext('2d');
            ctx.fillStyle = 'rgb(' + data.col[0] + ',' + data.col[1] + ',' + data.col[2] + ')';
            ctx.fillRect(data.x, data.y, 1, 1);
            //renderZoom(data.x, data.y);
        }

        function initDrawStyles() {
            let styles = [
                [0, 0],
                [1, 0],
                [2, 0],
                [0, 1],
                [1, 1],
                [2, 1]
            ];
            let img = new Image();
            img.src = 'drawstyles.png';
            img.onload = function() {
                let i = 0
                styles.forEach((el) => {
                    let x = el[0] * 32,
                        y = el[1] * 32;

                    let canvas = document.createElement('canvas');
                    canvas.width = canvas.height = 32;
                    let ctx = canvas.getContext('2d');

                    ctx.drawImage(img, x, y, 32, 32, 0, 0, 32, 32)

                    let option = document.createElement('div');
                    option.className = 'hidden';
                    option.setAttribute('brushId', i);

                    let image = document.createElement('img');
                    image.src = canvas.toDataURL();

                    option.appendChild(image)


                    $('#patternStyle1')[0].firstElementChild.appendChild(option);
                    i++
                })
            }
        }

        $(document).on('keydown', (e) => {
            if (isTyping()) return;
            switch (e.keyCode) {
                case it.keys.grid:
                    toggleGrid()
                    break
                case it.keys.fastmove:
                    if (keywork) return;
                    keywork = it.keys.fastmove;
                    break
                case it.keys.swap:
                    swapColors();
                    break
                case 'Z'.charCodeAt():
                    console.log('Cancel');
                    if (!e.ctrlKey) return;
                    boardSocket.send(JSON.stringify({
                        'type': 'cancelAction'
                    }))
                    break
            }
        }).on('keyup', (e) => {
            if (isTyping()) return;
            switch (e.keyCode) {
                case it.keys.fastmove:
                    keywork = false;
                    break
            }
        }).on('contextmenu', (e) => {
            e.preventDefault();
        })

        function updateTransform() {
            it.offX = Math.min(it.width, Math.max(-it.width, it.offX));
            it.offY = Math.min(it.height, Math.max(-it.height, it.offY));
            $('#artMove')
                .css('transform', 'translate(' + it.offX + 'px, ' + it.offY + 'px)');
            $('#artZoom').css('transform', 'scale(' + it.zoom + ')');

            var xx = screenToBoardSpace(0, 0);
            $('#grid')[0]
                .style.backgroundSize = it.zoom + 'px ' + it.zoom + 'px';
            $('#grid')[0]
                .style.transform = 'translate(' + Math.floor((-xx.x % 1) * it.zoom) + 'px, ' + Math.floor((-xx.y % 1) * it.zoom) + 'px';
        }

        function screenToBoardSpace(screenX, screenY) {
            var boardBox = $('.layer')[0].getBoundingClientRect();
            var boardX = (((screenX - boardBox.left) / it.zoom)),
                boardY = (((screenY - boardBox.top) / it.zoom));
            return {
                x: boardX,
                y: boardY
            };
        };

        function crateZoomPattern(url) {
            let a = new Image();
            a.src = url;
            let ctx = document.createElement('canvas').getContext('2d');
            a.onload = function() {
                it.zoomPattern = ctx.createPattern(a, 'repeat');
            };
        }

        function toggleGrid() {
            $('#grid')[0].style.display == 'none' ? $('#grid')[0].style.display = '' : $('#grid')[0].style.display = 'none';
        }

        function testScrollWidth() {
            var div = document.createElement('div');
            div.style.overflowY = 'scroll';
            div.style.width = '50px';
            div.style.height = '50px';
            div.style.visibility = 'hidden';
            document.body.appendChild(div);
            let scrollWidth = div.offsetWidth - div.clientWidth;
            document.body.removeChild(div);
            return scrollWidth
        }

        function decimal2rgb(dec) {
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

        function pointerdown(x, y, secondColor) {
            let code = outcodes.pdown;
            let dec = secondColor ? rgb2decimal(it.tempColor[0], it.tempColor[1], it.tempColor[2]) : rgb2decimal(it.currentColor[0], it.currentColor[1], it.currentColor[2]);
            let brush = getBrush();
            let fillstyle = getFillstyle();
            let packed = packMessage([code, x, y, it.activeLayer, dec, brush, fillstyle]);
            boardSocket.send(packed)
        }

        function pointermove(x, y) {
            let code = outcodes.pmove;
            let packed = packMessage([code, x, y]);
            boardSocket.send(packed)
        }

        function pointerup() {
            let code = outcodes.pup;
            let packed = packMessage([code]);
            boardSocket.send(packed)
        }

        function floodfill(x, y, secondColor) {
            let code = outcodes.fill;
            let dec = secondColor ? rgb2decimal(it.tempColor[0], it.tempColor[1], it.tempColor[2]) : rgb2decimal(it.currentColor[0], it.currentColor[1], it.currentColor[2]);
            let fillstyle = getFillstyle();
            console.log('Floodfill at ', x, y);
            let packed = packMessage([code, x, y, it.activeLayer, dec, fillstyle]);
            boardSocket.send(packed)
        }

        function sendLine(x, y, x1, y1, secondColor) {
            let code = outcodes.line;
            let dec = secondColor ? rgb2decimal(it.tempColor[0], it.tempColor[1], it.tempColor[2]) : rgb2decimal(it.currentColor[0], it.currentColor[1], it.currentColor[2]);
            let brush = getBrush();
            let fillstyle = getFillstyle();
            let packed = packMessage([code, x, y, x1, y1, it.activeLayer, dec, brush, fillstyle]);
            boardSocket.send(packed)
        }

        function sendSquare(x, y, x1, y1, secondColor) {
            let code = outcodes.rect;
            let dec = secondColor ? rgb2decimal(it.tempColor[0], it.tempColor[1], it.tempColor[2]) : rgb2decimal(it.currentColor[0], it.currentColor[1], it.currentColor[2]);
            let packed = packMessage([code, x, y, x1, y1, it.activeLayer, dec]);
            boardSocket.send(packed)
        }

        function sendCircle(x, y, R, secondColor) {
            let code = outcodes.circle;
            let dec = secondColor ? rgb2decimal(it.tempColor[0], it.tempColor[1], it.tempColor[2]) : rgb2decimal(it.currentColor[0], it.currentColor[1], it.currentColor[2]);
            let packed = packMessage([code, x, y, R, it.activeLayer, dec]);
            boardSocket.send(packed)
        }

        function initBoardEvents() {
            let isDown = false,
                lastX, lastY, lastDown = [0, 0];
            let button = 0;

            $('#art').on('mousedown', mousedown);
            $('#art').on('mousemove', mousemove);
            $('#art').on('mouseup', mouseup);
            $('#art').on('mouseleave', mouseleave);

            function mousedown(e) {
                lastX = e.clientX;
                lastY = e.clientY;
                isDown = true;
                let cords = screenToBoardSpace(e.clientX, e.clientY),
                    x = cords.x | 0,
                    y = cords.y | 0;
                lastDown = [x, y]
                renderZoom(x, y);
                button = e.button;
                if (e.buttons == 4 || keywork == it.keys.fastmove) return;
                switch (it.activeTool) {
                    case it.tools.pen:
                        let right = false;
                        if (e.button > 1) right = true
                        pointerdown(x, y, right);
                        break
                    case it.tools.pipette:
                        let c = getPixel(x, y);
                        if (e.button < 1) { // правая или левая
                            setColor(c[0], c[1], c[2]);
                        } else {
                            setTempColor(c[0], c[1], c[2]);
                        }
                }
            }

            function mousemove(e) {
                let cords = screenToBoardSpace(e.clientX, e.clientY),
                    x = cords.x | 0,
                    y = cords.y | 0;
                let old = screenToBoardSpace(lastX, lastY)
                $('#cords').text(`X: ${x} Y: ${y} Zoom: ${it.zoom}`);
                it.coords = [x, y]
                renderZoom(x, y);
                if (isDown) {
                    if (keywork == it.keys.fastmove) {
                        it.offX += e.originalEvent.movementX / it.zoom;
                        it.offY += e.originalEvent.movementY / it.zoom;
                        updateTransform();
                        return
                    }
                    switch ((e.buttons == 4) ? it.tools.move : it.activeTool) {
                        case it.tools.pen:
                            {
                                if (((cords.x | 0) != (old.x | 0)) || ((cords.y | 0) != (old.y | 0))) {
                                    if (x < 0 || x > it.width - 1 || y < 0 || y > it.height - 1) return;
                                    pointermove(x, y);
                                    highlightPixel(x, y);
                                }
                                break
                            }
                        case it.tools.move:
                            {
                                it.offX += e.originalEvent.movementX / it.zoom;
                                it.offY += e.originalEvent.movementY / it.zoom;
                                updateTransform();
                                break
                            }
                        case it.tools.line:
                            {
                                if (((cords.x | 0) != (old.x | 0)) || ((cords.y | 0) != (old.y | 0))) {
                                    let data = shapes.line(lastDown[0], lastDown[1], x, y),
                                        data2 = [];

                                    let first = data.shift();
                                    x = first[0];
                                    y = first[1];
                                    let right = false;
                                    if (button > 1) right = true;
                                    highlightPixel(x, y, false, right);
                                    for (pixel in data) {
                                        let x = data[pixel][0];
                                        let y = data[pixel][1];
                                        highlightPixel(x, y, true, right);
                                    }
                                }
                                break
                            }
                        case it.tools.rect:
                            {
                                if (((cords.x | 0) != (old.x | 0)) || ((cords.y | 0) != (old.y | 0))) {
                                    let right = false;
                                    if (button > 1) right = true;
                                    highlightRect(lastDown[0], lastDown[1], x - lastDown[0] + 1, y - lastDown[1] + 1, right);
                                }
                                break
                            }
                        case it.tools.circle:
                            {
                                if (((cords.x | 0) != (old.x | 0)) || ((cords.y | 0) != (old.y | 0))) {
                                    let right = false;
                                    if (button > 1) right = true;
                                    let x1 = Math.min(x, lastDown[0]),
                                        x2 = Math.max(x, lastDown[0]);
                                    let y1 = Math.min(y, lastDown[1]),
                                        y2 = Math.max(y, lastDown[1]);
                                    let diffX = x2 - x1,
                                        diffY = y2 - y1;
                                    let pixels = shapes.circle(lastDown[0], lastDown[1], Math.max(diffX, diffY))

                                    let first = pixels.pop();
                                    hightlightPixelD(first[0], first[1])

                                    for (pixel in pixels) {
                                        pixel = pixels[pixel];
                                        let x = pixel[0],
                                            y = pixel[1];
                                        hightlightPixelD(x, y, true);
                                    }
                                }
                                break
                            }
                    }

                } else {
                    switch (it.activeTool) {
                        case it.tools.pen:
                            if (((cords.x | 0) != (old.x | 0)) || ((cords.y | 0) != (old.y | 0)))
                                highlightPixel(x, y);
                            break
                    }
                }

                lastX = e.clientX;
                lastY = e.clientY;
            }

            function mouseup(e) {
                isDown = false;
                let cords = screenToBoardSpace(e.clientX, e.clientY),
                    x = cords.x | 0,
                    y = cords.y | 0;
                if (keywork === it.keys.fastmove) return
                renderZoom(x, y);
                switch (it.activeTool) {
                    case it.tools.pen:
                        {
                            pointerup();
                            break
                        }
                    case it.tools.fill:
                        {
                            let right = false;
                            if (e.button > 1) right = true
                            floodfill(x, y, right);
                            break
                        }
                    case it.tools.line:
                        {
                            let right = false;
                            if (e.button > 1) right = true
                            it.highlightCTX.clearRect(0, 0, it.width, it.height);
                            sendLine(lastDown[0], lastDown[1], x, y, right);
                            break
                        }
                    case it.tools.rect:
                        {
                            let right = false;
                            if (e.button > 1) right = true
                            it.highlightCTX.clearRect(0, 0, it.width, it.height);
                            sendSquare(lastDown[0], lastDown[1], x, y, right);
                            break
                        }
                    case it.tools.circle:
                        {
                            let right = false;
                            if (e.button > 1) right = true
                            it.highlightCTX.clearRect(0, 0, it.width, it.height);

                            let x1 = Math.min(x, lastDown[0]),
                                x2 = Math.max(x, lastDown[0]);
                            let y1 = Math.min(y, lastDown[1]),
                                y2 = Math.max(y, lastDown[1]);
                            let diffX = x2 - x1,
                                diffY = y2 - y1;

                            sendCircle(lastDown[0], lastDown[1], Math.max(diffX, diffY), right);
                            break
                        }
                }
            }

            function mouseleave(e) {
                isDown = false;
            }

            window.center = function(x, y) {
                it.offX = (it.width / 2 - x) - 0.5;
                it.offY = (it.height / 2 - y) - 0.5;
                updateTransform();
            }
        }

        function initScrollEvents() {
            $(document.body).on('wheel', e => {
                if (e.originalEvent.path.indexOf($('#art')[0]) === -1) return
                zoomTo(e);
            })

            function zoomTo(evt) {
                var oldzoom = it.zoom;
                if (evt.originalEvent.deltaY > 0) {
                    fixedZoom(-1)
                } else {
                    fixedZoom(1)
                }
                var dx = evt.clientX - $('#art').width() / 2;
                var dy = evt.clientY - $('#art').height() / 2;
                it.offX -= dx / oldzoom;
                it.offX += dx / it.zoom;
                it.offY -= dy / oldzoom;
                it.offY += dy / it.zoom;
                updateTransform();

                function fixedZoom(s) {
                    let mn = 0.1,
                        mx = 64;
                    ol = it.zoom;
                    if (ol > 1) {
                        if (s > 0) {
                            var nw = Math.round(it.zoom * 2);
                            nw = Math.min(mx, nw);
                        } else {
                            var nw = Math.round(it.zoom / 2);
                            nw = Math.max(mn, nw);
                        }
                    } else {
                        if (s > 0) {
                            var nw = (it.zoom * 2).toFixed(1);
                            nw = Math.min(mx, nw);
                        } else {
                            var nw = (it.zoom / 2).toFixed(1);
                            nw = Math.max(mn, nw);
                        }
                    }
                    if (nw > 1) {
                        nw = Math.floor(nw)
                    }
                    it.zoom = nw;
                }
                $('#cords').text(`X: ${it.coords[0]} Y: ${it.coords[1]} Zoom: ${it.zoom}`);
            }

        }

        function createLayer(layer) {
            console.log('layer');
            let canvas = document.createElement('canvas');
            canvas.className = 'layer';
            canvas.dataset.id = layer.id;
            canvas.id = 'layer' + layer.name;
            canvas.style.opacity = layer.opacity;
            canvas.style.imageRendering = 'pixelated';
            canvas.style.position = 'absolute';
            canvas.width = it.width;
            canvas.height = it.height;

            let html = createWorkLayer(layer);

            $('#layers').append(html);

            $('#artMove').css('width', it.width)
                .css('height', it.height);
            let ctx = canvas.getContext('2d');

            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, it.width, it.height);

            console.log(layer)

            for (let x = 0; x < it.width; x++) {
                for (let y = 0; y < it.height; y++) {
                    let col = layer.pixels[x][y]
                    if (typeof col == 'number') {
                        col = decimal2rgb(col);
                        ctx.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }

            $('#artMove')[0].appendChild(canvas);

            updateLayers();

            function createWorkLayer(layer) {
                return '<div data-id=' + layer.id + ' id=mlayer' + layer.name + ' style=" width: ' +
                    (164 - 6 - it.scrollWid) + 'px; position: relative; margin-left: 3px; margin-top: 3px; ' +
                    ' height: 30px; background-color: #C0C0C0; border: 1px solid #A0A0A0"><button class="layer' +
                    'button hide" onclick="toggleLayer(\'' + layer.name + '\')"></button><button ' +
                    ' class="layerbutton properties" onclick="showLayerSettings(\'' + layer.name + '\')">' +
                    '</button><div class="layername">' + layer.name + '</div><div class="layerMinimap"><canvas' +
                    ' width=28 height=28 id="minimap' + layer.name + '"></canvas></div></div>'
            }
        }

        function updateLayers() {
            let l = $('#layers')[0];
            for (var i = l.childElementCount - 1; i >= 0; i--) {
                let id = l.children[i].dataset.id
                if (l.children[i] !== l.firstElementChild) {
                    if (l.children[i - 1].dataset.id < id) {
                        $('#layers')[0].insertBefore(l.children[i], l.children[i - 1]);
                    }
                };
            }
        }

        window.addLayer = function(name) {
            boardSocket.emit('addLayer', {
                name: name,
                art: it.activeArt
            });
        }

        function swapColors() {
            let temp = it.currentColor;
            it.currentColor = it.tempColor;
            it.tempColor = temp;
            updateColor();
        }

        function setColor(r, g, b) {
            it.currentColor[0] = r;
            it.currentColor[1] = g;
            it.currentColor[2] = b;
            updateColor();
        }

        function setTempColor(r, g, b) {
            it.tempColor[0] = r;
            it.tempColor[1] = g;
            it.tempColor[2] = b;
            updateColor();
        }

        function RGBListener() {
            $('#red, #green, #blue').on('mousedown', (e) => {
                if (e.target.className == 'slider') return;
                let el = e.target,
                    pos = el.getBoundingClientRect();

                let offsetX = Math.min(pos.right, Math.max(pos.x, e.clientX)) - pos.x;
                let wid = el.clientWidth;
                let maxPercent = 255.5; //костыль
                if (!e.ctrlKey) {
                    el.firstElementChild.style.left = offsetX - 4 + 'px';
                    el.nextElementSibling.nextElementSibling.value = (maxPercent / 100) * (100 / (wid / offsetX)) | 0;
                    it.currentColor = [+$('#rinput')[0].value, +$('#ginput')[0].value, +$('#binput')[0].value];
                }
                updateColor();
                $(document).on('mousemove', (e) => {
                    if (!e.ctrlKey) {
                        offsetX = Math.min(pos.right, Math.max(pos.x, e.clientX)) - pos.x;
                        el.firstElementChild.style.left = offsetX - 4 + 'px';

                        el.nextElementSibling.nextElementSibling.value = (maxPercent / 100) * (100 / (wid / offsetX)) | 0;
                    } else {
                        $('#rinput')[0].value = +$('#rinput')[0].value + (e.originalEvent.movementX * (maxPercent / wid) | 0);
                        $('#ginput')[0].value = +$('#ginput')[0].value + (e.originalEvent.movementX * (maxPercent / wid) | 0);
                        $('#binput')[0].value = +$('#binput')[0].value + (e.originalEvent.movementX * (maxPercent / wid) | 0);
                        checkInputBounds();
                    }
                    it.currentColor = [+$('#rinput')[0].value, +$('#ginput')[0].value, +$('#binput')[0].value];
                    updateColor();
                }).on('mouseup deselect', (e) => {
                    $(document).off('mousemove');
                })
            })
        }
        $('#X').on('click', swapColors)

        $('.leftarrow').on('click', (e) => {
            let inc = 1
            if (e.ctrlKey) inc = 10;
            let el = e.target,
                input = el.nextElementSibling.nextElementSibling.nextElementSibling;
            input.value -= inc;
            checkInputBounds();
            it.currentColor = [+$('#rinput')[0].value, +$('#ginput')[0].value, +$('#binput')[0].value];
            updateColor();
        })

        $('.rightarrow').on('click', (e) => {
            let inc = 1
            if (e.ctrlKey) inc = 10;
            let el = e.target,
                input = el.nextElementSibling;
            input.value = +input.value + inc;
            checkInputBounds();
            it.currentColor = [+$('#rinput')[0].value, +$('#ginput')[0].value, +$('#binput')[0].value];
            updateColor();
        })

        function checkInputBounds() {
            if (+$('#rinput')[0].value < 0)
                $('#rinput')[0].value = 0;
            else if (+$('#rinput')[0].value > 255)
                $('#rinput')[0].value = 255;

            console.log($('#rinput')[0].value)

            if (+$('#ginput')[0].value < 0)
                $('#ginput')[0].value = 0;
            else if (+$('#ginput')[0].value > 255)
                $('#ginput')[0].value = 255;

            if (+$('#binput')[0].value < 0)
                $('#binput')[0].value = 0;
            else if (+$('#binput')[0].value > 255)
                $('#binput')[0].value = 255;
        }
        $('#rinput, #ginput, #binput').on('change', () => {
            it.currentColor = [+$('#rinput')[0].value, +$('#ginput')[0].value, +$('#binput')[0].value];
            checkInputBounds()
            updateColor();
        });


        function updateColor() {
            $('#rinput')[0].value = it.currentColor[0];
            $('#ginput')[0].value = it.currentColor[1];
            $('#binput')[0].value = it.currentColor[2];

            // полосы с цветом
            $('#red')[0].style.background = `linear-gradient(90deg,   rgb(0,${it.currentColor[1]},${it.currentColor[2]}), rgb(255,${it.currentColor[1]},${it.currentColor[2]}))`;
            $('#green')[0].style.background = `linear-gradient(90deg, rgb(${it.currentColor[0]},0,${it.currentColor[2]}), rgb(${it.currentColor[0]},255,${it.currentColor[2]}))`;
            $('#blue')[0].style.background = `linear-gradient(90deg,  rgb(${it.currentColor[0]},${it.currentColor[1]},0), rgb(${it.currentColor[0]},${it.currentColor[1]},255))`;

            // квадраты с текущим цветом
            $('#mainColor').css('background-color', 'rgb(' + it.currentColor[0] + ',' + it.currentColor[1] + ',' + it.currentColor[2] + ')');
            $('#addColor').css('background-color', 'rgb(' + it.tempColor[0] + ',' + it.tempColor[1] + ',' + it.tempColor[2] + ')');

            // слайдеры
            $('#red')[0].firstElementChild.style.left = $('#red')[0].clientWidth / (255 / it.currentColor[0]) - 4 + 'px';
            $('#green')[0].firstElementChild.style.left = $('#green')[0].clientWidth / (255 / it.currentColor[1]) - 4 + 'px';
            $('#blue')[0].firstElementChild.style.left = $('#blue')[0].clientWidth / (255 / it.currentColor[2]) - 4 + 'px';

        };


        /*  function rgb2hsl(r, g, b) {
              r /= 255;
              g /= 255;
              b /= 255;
              let max = Math.max(r, g, b);
              let min = Math.min(r, g, b);
              let d = max - min;
              let h;
              if (d === 0) h = 0;
              else if (max === r) h = (g - b) / d % 6;
              else if (max === g) h = (b - r) / d + 2;
              else if (max === b) h = (r - g) / d + 4;
              let l = (min + max) / 2;
              let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
              return [h * 60, s, l];
          }

          function hsl2rgb(h, s, l) {
              let c = (1 - Math.abs(2 * l - 1)) * s;
              let hp = h / 60.0;
              let x = c * (1 - Math.abs((hp % 2) - 1));
              let rgb1;
              if (isNaN(h)) rgb1 = [0, 0, 0];
              else if (hp <= 1) rgb1 = [c, x, 0];
              else if (hp <= 2) rgb1 = [x, c, 0];
              else if (hp <= 3) rgb1 = [0, c, x];
              else if (hp <= 4) rgb1 = [0, x, c];
              else if (hp <= 5) rgb1 = [x, 0, c];
              else if (hp <= 6) rgb1 = [c, 0, x];
              let m = l - c * 0.5;
              return [
                  Math.round(255 * (rgb1[0] + m)),
                  Math.round(255 * (rgb1[1] + m)),
                  Math.round(255 * (rgb1[2] + m))
              ];
          } */

        function showLayerCreator() {
            let pref = '#createLayerBanner';
            let layerId = Object.keys(it.layers).length
            $(pref + 'Name')[0].value = 'layer ' + (layerId + 1);

            $('#createLayerBanner')[0].classList.remove('hidden')
            $('#createLayerBanner')[0].classList.add('visible')

            $(pref + 'ConfirmButton')[0].onclick = () => {
                let msg = {
                    'type': 'layerAdd',
                    'name': $(pref + 'Name')[0].value
                }
                boardSocket.send(JSON.stringify(msg));
                hide()
            }

            function hide(e) {
                if (e)
                    if (e.originalEvent.path.indexOf($('#createLayerBanner')[0]) !== -1) return
                $('#createLayerBanner').hide(100, () => {
                    $('#createLayerBanner')[0].style.display = 'block';
                    $('#createLayerBanner')[0].classList.remove('visible')
                    $('#createLayerBanner')[0].classList.add('hidden')
                });
                $(document).off('mousedown', hide);
            }
            setTimeout(() => {
                $(document).on('mousedown', hide);
            }, 50);
        }

        function showLayerSettings(name) {
            if (!it.layers[name]) return;
            let l = it.layers[name];
            let opac = l.opacity;
            let visible = $('#layer' + name)[0].style.display === 'none';

            let pref = '#layerSetting';
            $(pref + 'Name').text(name);
            $(pref + 'Opac')[0].value = opac;
            $(pref + 'Toggle')[0].checked = visible;

            $('#layerSettings')[0].classList.remove('hidden')
            $('#layerSettings')[0].classList.add('visible')

            $(pref + 'Opac')[0].oninput = () => {
                setLayerOpacity(name, $(pref + 'Opac')[0].value);
            }
            $(pref + 'Opac')[0].onchange = () => {
                sendLayerOpacity(name)
            }

            $(pref + 'Toggle')[0].onclick = () => {
                toggleLayer(name)
            }

            function hide(e) {
                if (e.originalEvent.path.indexOf($('#layerSettings')[0]) !== -1) return
                $('#layerSettings').hide(100, () => {
                    $('#layerSettings')[0].style.display = 'block';
                    $('#layerSettings')[0].classList.remove('visible')
                    $('#layerSettings')[0].classList.add('hidden')
                });
                $(document).off('mousedown', hide);
            }
            setTimeout(() => {
                $(document).on('mousedown', hide);
            }, 50);
        }
        window.showLayerSettings = showLayerSettings;

        function setLayerOpacity(name, int) {
            it.layers[name].opacity = int;
            $('#layer' + name).css('opacity', int);
        }

        function sendLayerOpacity(name) {
            let code = outcodes.layerOpac;
            let opc = it.layers[name].opacity;
            let packed = packMessage([code, name, opc]);
        }

        function toggleLayer(name) {
            console.warn(name);
            let img = $('#layer' + name)[0].style.display === 'none' ? ['hide', 'show'] : ['show', 'hide'];
            console.log(img);
            $('#mlayer' + name)[0].firstElementChild.classList.remove(img[1]);
            $('#mlayer' + name)[0].firstElementChild.classList.add(img[0]);
            $('#layer' + name).toggle()
        }
        window.toggleLayer = toggleLayer;

        function pasteTool() {
            console.log(window.pasteActive);
            if (window.pasteActive) return;
            window.pasteActive = true;
            let input = document.createElement('input');
            input.type = "file"
            input.accept = "image/png";
            input.click()
            input.oninput = function() {
                if (window.pasteActive) return;
                window.pasteActive = true;
                if (input.files.length) {
                    let file = input.files[0]
                    if (file.size > 50000) {
                        //    window.pasteActive = false;
                        //    return alert('Размер файла слишком большой.');  
                    }
                    if (file.type !== 'image/png') {
                        window.pasteActive = false;
                        return alert('Формат файла не png.');
                    }

                    let image = new Image();
                    image.onload = () => {

                        let canvas = document.createElement('canvas');
                        canvas.width = image.width;
                        canvas.height = image.height;
                        let ctx = canvas.getContext('2d');
                        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                        let container = document.createElement('div');
                        container.style.cssText = 'position:absolute;z-index:999;right:0;height:' +
                            $('#topPanel')[0].clientHeight + 'px;background-color:orange;' +
                            'width:' + $('#rightPanel')[0].clientWidth + 'px;' +
                            'line-height:' + $('#topPanel')[0].clientHeight + 'px;';
                        let buttonOk = document.createElement('button');
                        buttonOk.innerText = 'OK';
                        let buttonCancel = document.createElement('button');
                        buttonCancel.innerText = 'ОТМЕНА';
                        buttonOk.style.cssText = buttonCancel.style.cssText =
                            'width: 90%;height: 50%;';

                        let half = document.createElement('div');
                        half.style.cssText = 'width: 50%;height: 100%;display: inline-block;text-align: center;';
                        half2 = half.cloneNode(half);
                        half.appendChild(buttonOk);
                        half2.appendChild(buttonCancel);

                        container.appendChild(half);
                        container.appendChild(half2);

                        document.body.appendChild(container);

                        image.id = 'pastingImage';

                        $('#artMove')[0].appendChild(image);

                        let mousedown = false,
                            offset = [0, 0];

                        image.onmousedown = (e) => {
                            e.stopPropagation();
                            mousedown = true
                        };
                        document.onmouseup = (e) => {
                            e.stopPropagation();
                            mousedown = false
                        };

                        image.ondragstart = (e) => {
                            e.preventDefault()
                        };

                        image.onmousemove = (e) => {
                            if (mousedown) {
                                offset[0] += e.movementX / it.zoom;
                                offset[1] += e.movementY / it.zoom;
                                image.style.transform =
                                    `translate(${offset[0] | 0}px, ${offset[1] | 0}px)`;
                            }
                        }

                        buttonOk.onclick = function() {
                            try {
                                offset[0] |= 0;
                                offset[1] |= 0;

                                let x = offset[0] < 0 ? 0 + -offset[0] : 0,
                                    y = offset[1] < 0 ? 0 + -offset[1] : 0,
                                    wid = image.width + offset[0] > it.width ?
                                    image.width + offset[0] - (image.width + offset[0] - it.width) :
                                    image.width + offset[0],
                                    hei = image.height + offset[1] > it.height ?
                                    image.height + offset[1] - (image.height + offset[1] - it.height) :
                                    image.height + offset[1];
                                if (wid <= 0 || hei <= 0 || offset[0] > it.width || offset[1] > it.height) {
                                    throw new Error("Изображение слишком далеко за пределами поля.");
                                }
                                let pixels = ctx.getImageData(x, y, wid, hei).data;

                                let posX = Math.max(offset[0], 0),
                                    posY = Math.max(offset[1], 0);

                                let msg = packMessage([outcodes.paste, posX, posY, wid, pixels.join(','), it.activeLayer]);
                                boardSocket.send(msg);
                            } finally {
                                buttonCancel.click();
                            }
                        }

                        buttonCancel.onclick = function() {
                            document.onmouseup = null;
                            $('#pastingImage').remove();
                            $(container).remove();
                            window.pasteActive = false;
                        }
                    }
                    image.src = URL.createObjectURL(file);
                } else {
                    window.pasteActive = false;
                }
            }
            window.pasteActive = false;
            $(input).remove();
        }
    }
}