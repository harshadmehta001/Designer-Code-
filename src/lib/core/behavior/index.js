'use strict';
module.exports = {   
    __init__: [
        'deleteRegionBehavior',
        'resizeShapeBehavior',
        'unclaimIdBehavior',
        'modelingFeedback',
        'labelBehavior',
        'restrictShapeToBoundaryBehavior'
    ],
    restrictShapeToBoundaryBehavior: [ 'type', require('./RestrictShapeToBoundaryBehavior') ],
    deleteRegionBehavior: [ 'type', require('./DeleteRegionBehavior') ],
    resizeShapeBehavior: [ 'type', require('./ResizeShapeBehavior') ],
    unclaimIdBehavior: [ 'type', require('./UnclaimIdBehavior') ],
    labelBehavior: [ 'type', require('./LabelBehavior') ],
    modelingFeedback: [ 'type', require('./ModelingFeedback') ]
};
