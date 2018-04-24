'use strict';
module.exports = {
    __init__: [ 'modeling', 'elementRenderer', 'elementUpdater', 'elementConnect', 'elementRules'],  
    __depends__: [    
        require('diagram-js/lib/command'),
        require('diagram-js/lib/features/attach-support'),
        require('diagram-js/lib/features/change-support'),
        require('diagram-js/lib/features/create'),
        require('diagram-js/lib/features/label-support'),
        require('diagram-js/lib/features/tooltips'),
        require('diagram-js/lib/i18n/translate'),
        require('diagram-js/lib/features/space-tool'),
        require('diagram-js/lib/features/connect'),
        require('../import'),
        require('./behavior')
    ],
    elementFactory: [ 'type', require('./ElementFactory') ],
    pathMap: [ 'type', require('./PathMap') ],
    elementRenderer: [ 'type', require('./ElementRenderer') ],
    elementUpdater: ['type', require('./ElementUpdater')],
    layouter: ['type', require('./ElementLayouter')],  
    elementRules: [ 'type', require('./ElementRules') ] ,
    elementConnect: [ 'type', require('./ElementConnect') ],
    modeling: ['type', require('./Modeling')],
    connectionDocking: [ 'type', require('diagram-js/lib/layout/CroppingConnectionDocking') ]
};
