'use strict';

var inherits = require('inherits');

var baseOrderingProvider = require('diagram-js/lib/features/ordering/OrderingProvider');

var isAny = require('../../util/ModelingUtil').isAny;

var findIndex = require('lodash/array/findIndex');

var find = require('lodash/collection/find');

/**
 * a simple ordering provider that makes sure:
 *
 * elements are ordered by a {level} property
 * 
 */
function OrderingProvider(eventBus, translate) {
    var orders, entry;
    baseOrderingProvider.call(this, eventBus);

    orders = [
        { type: 'root', order: { level: -1 } },
        { type: 'transition', order: { level: 1, containers: ['root'] } }

    ];

    function computeOrder(element) {
        if (element.labelTarget) {
            return { level: 10 };
        }

        entry = find(orders, function (o) {
            return isAny(element, [o.type]);
        });

        return (entry && entry.order) || { level: 1 };
    }

    function getOrder(element) {
        var order = element.order;

        if (!order) {
            element.order = order = computeOrder(element);
        }

        return order;
    }

    function findActualParent(element, newParent, containers) {
        var actualParent = newParent;

        while (actualParent) {
            if (isAny(actualParent, containers)) {
                break;
            }

            actualParent = actualParent.parent;
        }

        if (!actualParent) {
            throw new Error(
                translate('no parent for {element} in {parent}', {
                    element: element.id,
                    parent: newParent.id
                })
            );
        }

        return actualParent;
    }

    this.getOrdering = function (element, newParent) {

        var elementOrder, currentIndex, insertIndex;
        if (newParent.type !== 'transition') {
            elementOrder = getOrder(element), currentIndex, insertIndex;

            if (elementOrder.containers) {
                newParent = findActualParent(element, newParent, elementOrder.containers);
            }

            currentIndex = newParent.children.indexOf(element);

            insertIndex = findIndex(newParent.children, function (child) {
                // do not compare with labels, they are created
                // in the wrong order (right after elements) during import and
                // mess up the positioning.
                if (!element.labelTarget && child.labelTarget) {
                    return false;
                }

                return elementOrder.level < getOrder(child).level;
            });

            // if the element is already in the child list at
            // a smaller index, we need to adjust the insert index.
            // this takes into account that the element is being removed
            // before being re-inserted
            if (insertIndex !== -1) {
                if (currentIndex !== -1 && currentIndex < insertIndex) {
                    insertIndex -= 1;
                }
            }
        }
        return {
            index: insertIndex,
            parent: newParent
        };
    };

}
OrderingProvider.$inject = ['eventBus', 'translate'];

inherits(OrderingProvider, baseOrderingProvider);

module.exports = OrderingProvider;
