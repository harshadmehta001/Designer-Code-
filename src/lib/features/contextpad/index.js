'use strict';
module.exports = {
    __init__: ['contextPadProvider'],
    __depends__: [
        require('diagram-js/lib/features/context-pad'),
        require('diagram-js/lib/features/selection'),
        require('diagram-js/lib/features/connect'),
        require('diagram-js/lib/features/create')
    ],
    contextPadProvider: ['type', require('./ContextPadProvider')]
};
