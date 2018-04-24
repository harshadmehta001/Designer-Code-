'use strict';
module.exports = {
    __init__: ['paletteProvider'],
    __depends__: [
        require('diagram-js/lib/features/palette'),
        require('diagram-js/lib/features/create'),
        require('diagram-js/lib/features/connect'),
        require('diagram-js/lib/features/global-connect')
    ],
    paletteProvider: ['type', require('./PaletteProvider')]
};
