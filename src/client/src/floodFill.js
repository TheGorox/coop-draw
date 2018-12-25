window.floodfill = function(ctx, x, y, fillcolor, width, height, cb) {
    fillcolor[3] = fillcolor[3] || 255;
    let data = ctx.getImageData(0, 0, width, height).data;
    var length = data.length;
    var Q = [];
    var i = (x + y * width) * 4;
    var e = i,
        w = i,
        me, mw, w2 = width * 4;
    var output = [];
    var targetcolor = [data[i], data[i + 1], data[i + 2], data[i + 3]];

    if (targetcolor[0] == fillcolor[0] && targetcolor[1] == fillcolor[1] && targetcolor[2] == fillcolor[2]) {
        return false;
    }
    
    Q.push(i);
    while (Q.length) {
        i = Q.pop();
        if (pixelCompareAndSet(i, targetcolor, fillcolor, data, length)) {
            e = i;
            w = i;
            mw = parseInt(i / w2) * w2 - 4;
            me = mw + w2 + 4;
            while (mw < w && mw < (w -= 4) && pixelCompareAndSet(w, targetcolor, fillcolor, data, length));
            while (me > e && me > (e += 4) && pixelCompareAndSet(e, targetcolor, fillcolor, data, length));
            for (var j = w + 4; j < e; j += 4) {
                if (j - w2 >= 0 && pixelCompare(j - w2, targetcolor, fillcolor, data, length)) Q.push(j - w2);
                if (j + w2 < length && pixelCompare(j + w2, targetcolor, fillcolor, data, length)) Q.push(j + w2);
            }
        }
    }
    return cb.call(null, unique(output));

    function addOutput(i) {
        let x = i / 4 % width;
        let y = i / 4 / width | 0;
        output.push(x + ',' + y);
    }

    function unique(arr) {
        var obj = {};

        for (let i = 0; i < arr.length; i++) {
            let str = arr[i];
            obj[str] = true;
        }

        return Object.keys(obj);
    }

    function pixelCompare(i, targetcolor, fillcolor, data, length) {
        if (i < 0 || i >= length) return false;
        if (data[i + 3] === 0 && fillcolor.a > 0) return true;

        if ((targetcolor[3] === data[i + 3]) &&
            (targetcolor[0] === data[i]) &&
            (targetcolor[1] === data[i + 1]) &&
            (targetcolor[2] === data[i + 2])) {
            addOutput(i);
            return true;
        }

        return false;
    };

    function pixelCompareAndSet(i, targetcolor, fillcolor, data, length) {
        if (pixelCompare(i, targetcolor, fillcolor, data, length)) {
            data[i] = fillcolor[0];
            data[i + 1] = fillcolor[1];
            data[i + 2] = fillcolor[2];
            data[i + 3] = fillcolor[3];
            return true;
        }
        return false;
    };
};