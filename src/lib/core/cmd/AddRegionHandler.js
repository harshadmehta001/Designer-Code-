'use strict';

var filter = require('lodash/collection/filter');
var Elements = require('diagram-js/lib/util/Elements');

var REGION_INDENTATION = require('../../util/RegionUtil').REGION_INDENTATION,
    PARALLEL_BOTTOM_MARGIN = require('../../util/RegionUtil').PARALLEL_BOTTOM_MARGIN,
    PARALLEL_TOP_MARGIN = require('../../util/RegionUtil').PARALLEL_TOP_MARGIN;

/**
 * A handler that allows us to add a new Region
 * above or below an existing one.
 *
 * @param {Modeling} modeling
 * @param {SpaceTool} spaceTool
 */
function AddRegionHandler(modeling, spaceTool) {
    this._modeling = modeling;
    this._spaceTool = spaceTool;
}

AddRegionHandler.$inject = ['modeling', 'spaceTool'];

module.exports = AddRegionHandler;

AddRegionHandler.prototype.preExecute = function(context) {
    var allAffected,
        regionHeight,
        offset,
        adjustments,
        regionPosition,
        spacePos,
        direction,
        spaceTool = this._spaceTool,
        modeling = this._modeling,
        shape = context.shape,
        location = context.location,
        parallel = shape,
        regionCount = shape.businessObject.regionIds.length;

    // (0) add a Region if we currently got none and are adding to root
    if (regionCount === 0) {
        context.newRegion = modeling.createShape(
            { type: 'region' },
            {
                x: shape.x + REGION_INDENTATION,
                y: shape.y + PARALLEL_TOP_MARGIN,
                width: shape.width - REGION_INDENTATION * 2,
                height: shape.height - PARALLEL_TOP_MARGIN - PARALLEL_BOTTOM_MARGIN
            },
            parallel
        );
    }

    // (1) collect affected elements to create necessary space
    allAffected = [];

    Elements.eachElement(parallel, function(element) {
        allAffected.push(element);

        if (element === shape) {
            return [];
        }

        return filter(element.children, function(c) {
            return c !== shape;
        });
    });
    regionHeight = shape.children[0].height;
    offset = location === 'top' ? -regionHeight : regionHeight;
    regionPosition = location === 'top'
        ? shape.y + PARALLEL_TOP_MARGIN
        : shape.y + shape.height - PARALLEL_BOTTOM_MARGIN;
    spacePos = regionPosition + (location === 'top' ? 10 : -10);
    direction = location === 'top' ? 'n' : 's';

    adjustments = spaceTool.calculateAdjustments(
        allAffected,
        'y',
        offset + PARALLEL_TOP_MARGIN,
        spacePos
    );

    spaceTool.makeSpace(
        adjustments.movingShapes,
        adjustments.resizingShapes,
        { x: 0, y: offset },
        direction
    );

    // (2) create new region at open space
    context.newRegion = modeling.createShape(
        { type: 'region' },
        {
            x: shape.x + REGION_INDENTATION,
            y: regionPosition - (location === 'top' ? regionHeight : 0),
            width: shape.width - REGION_INDENTATION * 2,
            height: regionHeight
        },
        parallel
    );
};
