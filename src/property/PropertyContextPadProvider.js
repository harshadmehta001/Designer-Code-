'use strict';

var assign = require('lodash/object/assign');

/**
 * A provider for Property Window option elements context pad
 * 
 * @param {ContextPad} contextPad
 * @param {Modeling} modeling
 * @param {Translate} translate
 */
function PropertyContextPadProvider(contextPad, modeling, translate) {
    contextPad.registerProvider(this);

    this._modeling = modeling;
    this._translate = translate;
}

PropertyContextPadProvider.$inject = [ 'contextPad', 'modeling', 'translate' ];

module.exports = PropertyContextPadProvider;

PropertyContextPadProvider.prototype.getContextPadEntries = function(element) {
    
    var modeling = this._modeling,
        translate = this._translate;

    var actions = {};

    if (element.type === 'label' || (element.type ==='transition' && element.isAuto === true)) {
        return actions;
    }

    assign(actions, {
        openpropertywindow: {
            group: 'custom-property-impact-kendo',
            className: 'wright-icon-property-edit',
            title: translate('Edit Properties'),
            action: {
                click: function(event, element) {
                    modeling.openPropertyWindow({ element: [element] });
                }
            }
        }
    });

    return actions;
};
