'use strict'

const fs = require('fs');
const FileReader = require('filereader')

String.prototype.hashCode = function() {
    var hash = 0;
    for (var i = 0; i < this.length; i++) {
        var character = this.charCodeAt(i);
        hash = ((hash << 5) - hash) + character;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

function getDefaultOptions(name, width, height) {
    let pixels = [];
    for (let x = 0; x < width; x++) {
        pixels.push([])
        for (let y = 0; y < height; y++) {
            pixels[x].push([])
        }
    }
    return {
        name: name,
        width: width,
        height: height,
        palettes: null,
        layers: {
            'Main': {
                id: 0,
                name: 'Main',
                opacity: 1,
                pixels: pixels
            }
        }
    }
}

function blobToText(blob, callback) {
    let reader = new FileReader();

    reader.addEventListener('loadend', (e) => {
        let text = e.srcElement.result;
        callback.call(null, text);
    });

    reader.readAsText(blob);
}

function textToBlob(string) {
    let blob = new Blob([string], {
        type: 'text/plain'
    });

    return blob
}

class Art {
    constructor(name, width, height, done) {
        this.success = true
        this.name = name;
        this.width = width;
        this.height = height;
        this.done = done;
        let it = this;
        console.warn(!!name.match(/[^A-zА-я0-9"'!@#$%^&*()_+=-]/));
        if (width > 5000 || height > 5000 || !!name.match(/[^A-zА-я0-9"'!@#$%^&*()_+=-]/))
            return it.done.call(null, false)
        it.createData()

    }

    getDefaultOptions() {
        return getDefaultOptions(this.name, this.width, this.height)
    }

    createData() {
        let it = this
        fs.stat(__dirname + '/arts/' + this.name, function(er, stat) {
            if (er == null || er.code !== 'ENOENT') return console.warn(er);
            console.log('Попробовали создать новый арт, успешно: ' + !!er);
            let data = it.getDefaultOptions()

            fs.appendFile(__dirname + '/arts/' + it.name, JSON.stringify(data), 'utf-8', (err) => {
                if (err) {
                    console.log(err)
                    return it.done.call(null, false)
                }
                console.log('Арт развёрнут без ошибок и готов к работе!')
                it.done.call(null, true)
            });
        });
    }
}

function getArt(name, callback) {
    if (name == 'Main' && global.SHITMODE) {
        global.dbx.filesDownload({
            path: '/Main',
            fetch: global.fetch
        }).then((res) => {
            fs.writeFileSync('Main.txt', res.fileBinary, 'utf-8');
            fs.readFile('Main.txt', 'utf-8', (err, data) => {
                try {
                    if (err) return;
                    data = JSON.parse(data);
                    callback.call(null, data)
                } catch (e) {}
            });
            /*blobToText(res.fileBinary, (text) => {
                let data = JSON.parse(text);
                callback.call(null, data);
            })*/
        })
    } else {
        fs.readFile(__dirname + '/arts/' + name, 'utf-8', (err, data) => {
            try {
                if (err) return;
                data = JSON.parse(data);
                callback.call(null, data)
            } catch (e) {}
        });
    }
}

function setArt(name, data, callback) {
    if (name == 'Main' && global.SHITMODE) {
        global.dbx.filesUpload({
            contents: (data),
            path: '/Main',
            mode: {
                '.tag': 'overwrite'
            },
            autorename: false,
            mute: true,
            fetch: global.fetch
        }).then(callback);
    } else {
        fs.writeFile(__dirname + '/arts/' + name, data, 'utf-8', callback);
    }
}

module.exports = {
    Art: Art,
    getArt: getArt,
    setArt: setArt,
    getOpts: getDefaultOptions
}