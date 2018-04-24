'use strict';

module.exports.propertyWindow  = {
    __init__: [ 'propertiesPanel', 'propertyContextPadProvider' ],
    propertiesPanel: [ 'type', require('./PropertiesPanel')],
    propertyContextPadProvider: ['type', require('./PropertyContextPadProvider')]
};
