'use strict';

var forEach = require('lodash/collection/forEach'),
    inherits = require('inherits'),
    CommandInterceptor = require('diagram-js/lib/command/CommandInterceptor');

/**
 * @param {EventBus} eventBus
 * @param {Modeling} modeling
 */
function UnclaimIdBehavior(eventBus, modeling) {

    CommandInterceptor.call(this, eventBus);

    this.preExecute('elements.delete', function(event) {
        var context = event.context,
            elements = context.elements;

        forEach(elements, function(element) {
            modeling.unclaimId(element.businessObject.id, element.businessObject);
        });

    });
}

inherits(UnclaimIdBehavior, CommandInterceptor);

UnclaimIdBehavior.$inject = [ 'eventBus', 'modeling' ];

module.exports = UnclaimIdBehavior;