'use strict';
module.exports = {
    __init__: ['orderingProvider'],
    __depends__: [require('diagram-js/lib/i18n/translate')],
    orderingProvider: ['type', require('./OrderingProvider')]
};
