function floodFill(array, x, y, color) {
    let width = array.length - 1,
        height = array[0].length;
    let oldColor = pxl(x, y);
    let stack = [
        [x, y]
    ];
    let changes = [];

    if (x < 0 || y < 0 || x > width || y > height ||
        typeof color !== 'number' ||
        color < 0 || color > 16777215) return []; // во избежание ошибок, которые всё же были
    
    if(pxl(x, y) == color) return [];

    let tries = 0
    while (stack.length) {
        tries++
        if(tries > width*height) break;
        let el = stack.shift();
        let x = el[0],
            y = el[1];
        while (y > 0 && pxl(x, y) == oldColor) y--;
        y > 0 && y++

        let left = false,
            right = false;
        while (y < height && pxl(x, y) == oldColor) {
            array[x][y] = color;
            changes.push([x, y]);
            if (!left && x > 0 && pxl(x - 1, y) == oldColor) {
                push(x - 1, y);
            } else if (left && x > 0 && pxl(x - 1, y) != oldColor) {
                left = false;
            }
            if (!right && x < width && pxl(x + 1, y) == oldColor){
                push(x + 1, y);
            }else if(right && x < width && pxl(x + 1, y) != oldColor){
                right = false;
            }
            y++
        }

    }

    function pxl(x, y) {
        let col = array[x][y];
        if(typeof col != 'number') col = 16777215;
        return col
    };

    function push(x, y) {
        stack.push([x, y])
    }
        return [changes, oldColor];
}

module.exports = {
    floodFill: floodFill
}