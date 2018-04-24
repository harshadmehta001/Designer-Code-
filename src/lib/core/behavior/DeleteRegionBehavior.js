'use strict';

var inherits = require('inherits');
var CommandInterceptor = require('diagram-js/lib/command/CommandInterceptor');
var is = require('../../util/ModelUtil').is;
var getChildRegions = require('../../util/RegionUtil').getChildRegions;
var eachElement = require('diagram-js/lib/util/Elements').eachElement;

var LOW_PRIORITY = 500;

/**
 * Delete region behavior
 * 
 * @param {EventBus} eventBus
 * @param {SpaceTool} spaceTool
 */
function DeleteRegionBehavior(eventBus, spaceTool) {

    CommandInterceptor.call(this, eventBus);

    function shiftRegionUp(element, offset) {
        var movingShapes = [], resizingShapes=[];
        movingShapes.push(element);
        spaceTool.makeSpace(
            movingShapes,
            resizingShapes, {
                x: 0,
                y: -offset
            }, 'n');
        return element;
    }

    function shrinkParallel(element, offset) {
        var movingShapes = [], resizingShapes=[];        
        if (element.type !== 'parallel-state') {
            throw 'root not parallel-state';
        }
        resizingShapes.push(element);
        spaceTool.makeSpace(
            movingShapes,
            resizingShapes, {
                x: 0,
                y: -offset
            }, 's');
        return element;
    }

    function fixRegionDelete(shape, oldParent) {
        var parallel = oldParent;
        var siblings = getChildRegions(parallel);
        //adust regions (shift up)
        eachElement(siblings, function (element) {
            if (element.type === 'region') {
                if (element.y > shape.y) {
                    element = shiftRegionUp(element, shape.height);
                }
            }
        });
        // adust parallel height
        shrinkParallel(parallel, shape.height);
    }

    /**
     * Adjust sizes of other regions after region deletion
     */
    this.postExecuted('shape.delete', LOW_PRIORITY, function (event) {

        var context = event.context,
            hints = context.hints,
            shape = context.shape,
            oldParent = context.oldParent;

        // only compensate region deletes
        if (!is(shape, 'region')) {
            return;
        }

        // compensate root deletes only
        if (hints && hints.nested) {
            return;
        }
        fixRegionDelete(shape, oldParent);

    });
}

DeleteRegionBehavior.$inject = ['eventBus', 'spaceTool'];

inherits(DeleteRegionBehavior, CommandInterceptor);

module.exports = DeleteRegionBehavior;