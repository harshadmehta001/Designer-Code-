'use strict';

var assign = require('lodash/object/assign'),
    isArray = require('lodash/lang/isArray'),
    getChildRegions = require('../../util/RegionUtil').getChildRegions,
    hasPrimaryModifier = require('diagram-js/lib/util/Mouse').hasPrimaryModifier;

/**
 * A provider for WrightJS elements context pad
 * @param {EventBus} eventBus
 * @param {ContextPad} contextPad
 * @param {Modeling} modeling
 * @param {Rules} rules
 * @param {Translate} translate
 */
function ContextPadProvider(eventBus, contextPad, modeling, rules, translate) {
    contextPad.registerProvider(this);

    this._contextPad = contextPad;

    this._modeling = modeling;
    this._rules = rules;
    this._translate = translate;

    eventBus.on('create.end', 250, function (event) {
        var shape, entries;
        if (!hasPrimaryModifier(event)) {
            return;
        }

        shape = event.context.shape;
        entries = contextPad.getEntries(shape);

        if (entries.replace) {
            entries.replace.action.click(event, shape);
        }
    });
}

ContextPadProvider.$inject = ['eventBus', 'contextPad', 'modeling', 'rules', 'translate'];

module.exports = ContextPadProvider;

ContextPadProvider.prototype.getContextPadEntries = function (element) {
    var actions = {}, modeling, businessObject, rules, translate, childRegions, deleteAllowed;

    if (element.type === 'label') {
        return actions;
    }

    modeling = this._modeling;
    rules = this._rules;
    translate = this._translate;

    businessObject = element.businessObject;

    function removeElement() {
        modeling.removeElements([element]);
    }
    if (businessObject.type === 'transition' && businessObject.sourceStateId !== businessObject.targetStateId) {
        assign(actions, {
            'remove-bends': {
                group: 'remove-bends',
                className: 'wright-icon-remove-bends',
                title: translate('Remove Bends'),
                action: {
                    click: function (event, element) {
                        modeling.removeBends(element);
                    }
                }
            }
        });
    }
    if (businessObject.type === 'parallel-state') {
        childRegions = getChildRegions(element);
        if (childRegions.length === 0) {
            modeling.addRegion(element, 'bottom');
        }
        assign(actions, {
            'region-insert-above': {
                group: 'region-insert-above',
                className: 'wright-icon-region-insert-above',
                title: translate('Add Region Above'),
                action: {
                    click: function (event, element) {
                        modeling.addRegion(element, 'top');
                    }
                }
            }
        });

        assign(actions, {
            'region-insert-below': {
                group: 'region-insert-below',
                className: 'wright-icon-region-insert-below',
                title: translate('Add Region Below'),
                action: {
                    click: function (event, element) {
                        modeling.addRegion(element, 'bottom');
                    }
                }
            }
        });
    }

    // delete element entry, only show if allowed by rules
    deleteAllowed = rules.allowed('elements.delete', {
        elements: [element]
    });

    if (isArray(deleteAllowed)) {
        // was the element returned as a deletion candidate?
        deleteAllowed = deleteAllowed[0] === element;
    }

    if (deleteAllowed) {
        assign(actions, {
            delete: {
                group: 'edit',
                className: 'wright-icon-trash',
                title: translate('Remove'),
                action: {
                    click: removeElement,
                    dragstart: removeElement
                }
            }
        });
    }
    if (element.type === 'atomic-state') {
        assign(actions, {
            selfconnect: {
                group: 'connect',
                className: 'wright-icon-atomic-self',
                title: translate('Self'),
                action: {
                    click: function (event, element) {
                        var shape = Array.isArray(element) ? element[0] : element;
                        modeling.connect(shape, shape, {
                            type: 'transition',
                            isAuto: false
                        });
                    }
                }
            }
        });
    }
    return actions;
};
