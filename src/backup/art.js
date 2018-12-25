'use strict'

const r = require('rethinkdb'),
    cfg = require('./dbconfig.json');

var connect;

r.connect({
    db: 'coopDraw'
}).then((con) => {
    connect = con;
})
class Art {
    constructor(name, width, height, done) {
        this.name = name;
        this.width = width;
        this.height = height;
        this.done = done;
        let it = this;
        it.createData()

    }

    getDefaultOptions() {
        return {
            name: this.name,
            width: this.width,
            height: this.width,
            palettes: null,
            layers: {
                'Main': {
                    id: 0,
                    name: 'Main',
                    opacity: 1,
                    pixels: {}
                }
            }
        }
    }

    createData() {
        let it = this;
        r.table('boards').run(connect, (er, result) => {
            let exists;
            result.each(function(err, e) {
                if (err) throw err;
                if (e.name === it.name) {
                    exists = true;
                }
            }).then(() => {
                if (!exists) {
                    r.table('boards').insert(this.getDefaultOptions()).run(connect, () => {
                        it.done.call(null, true);
                    })
                } else {
                    it.done.call(null, false);
                }
            }).error(err => {
                console.log('Ошибка, рассчитываю на то что датабаз нет.');
                r.table('boards').insert(this.getDefaultOptions()).run(connect, () => {
                    it.done.call(null, true);
                })
            })

        });
    }
}

function updatePixels(name, pixels, layer) {
    if (!connect) {
        r.connect({
            db: 'coopDraw'
        }).then((con) => {
            connect = con;
            updatePixels(name, pixels, layer)
        })
        return;
    }
    let obj = {
        layers: {}
    };
    obj.layers[layer] = {
        pixels: pixels
    }
    r.db('coopDraw').table('boards').filter({
        name: name
    }).update(obj).run(connect);
}

function addLayer(art, name, cb) {
    r.db('coopDraw').table('boards').filter({
        name: art
    })('layers').count().run(connect).then((res) => {
        let id = ++res,
            obj = {
                layers: {}
            };
        obj.layers[name] = {
            id: id,
            name: name,
            opacity: 1,
            pixels: {}
        }

        console.log(obj);

        r.db('coopDraw').table('boards').filter({
            name: art
        }).insert({ layers: { WoWs: { id: 1, name: 'WoWs', opacity: 1, pixels: {} } } }).run(connect).then((res) => {
            console.log(res);
        })

        cb.call(null, name, id);
    })
}

module.exports = {
    Art: Art,
    updatePixels: updatePixels,
    addLayer: addLayer
}