'use strict';

var is = require('../../util/ModelUtil').is;

var roundBounds = require('diagram-js/lib/layout/LayoutUtil').roundBounds;
var asTRBL = require('diagram-js/lib/layout/LayoutUtil').asTRBL;

var REGION_INDENTATION = require('../../util/RegionUtil').REGION_INDENTATION,
    PARALLEL_BOTTOM_MARGIN = require('../../util/RegionUtil').PARALLEL_BOTTOM_MARGIN,
    PARALLEL_TOP_MARGIN = require('../../util/RegionUtil').PARALLEL_TOP_MARGIN,
    getChildRegions = require('../../util/RegionUtil').getChildRegions,
    getImmediateChildren = require('../../util/RegionUtil').getImmediateChildren,
    getBounds = require('../../util/RegionUtil').getBounds,
    adjustChildren = require('../../util/RegionUtil').adjustChildren,
    resizeRegionsInParallel = require('../../util/RegionUtil').resizeRegionsInParallel;

var SLIGHTLY_HIGHER_PRIORITY = 1001;

/** 
 * A component responsible for resizing of shapes
 * @param {EventBus} eventBus 
 * @param {Modeling} modeling 
 */
function ResizeShapeBehavior(eventBus, modeling) {
    eventBus.on('resize.start', SLIGHTLY_HIGHER_PRIORITY + 500, function (event) {
        var context = event.context,
            shape = context.shape,
            // evaluate minBounds for backwards compatibility
            minBounds = context.minBounds,
            maxBounds = null;
        maxBounds = getParentMaxBounds(shape);
        context.balanced = true;
        //shape is parallel
        if (is(shape, 'parallel-state')) {
            minBounds = getMinParallelBounds(shape);
            minBounds.x = maxBounds.x = shape.x;
            minBounds.y = maxBounds.y = shape.y;
            getResizeConstraints(context, minBounds, maxBounds);
        } else if (is(shape, 'region')) {
            minBounds = getBounds(shape);
            minBounds.height = getMaxChildHeight(shape, PARALLEL_BOTTOM_MARGIN);
            maxBounds.width = minBounds.width = shape.width;
            maxBounds.x = minBounds.x = shape.x;
            maxBounds.y = minBounds.y = shape.y;
            maxBounds.height *= 5;
            getResizeConstraints(context, minBounds, maxBounds);
        } else if (is(shape, 'compound-state')) {
            minBounds = getMinCompoundBounds(shape);
            getResizeConstraints(context, minBounds, maxBounds);
        } else if (is(shape, 'atomic-state')) {
            
            minBounds = getMinDefaultBounds(shape);
            getResizeConstraints(context, minBounds, maxBounds);
        } else {
            //normal flow
        }
    });

    /**
     * Intercept resize end and call resize shape function instead.
     */
    eventBus.on('resize.end', SLIGHTLY_HIGHER_PRIORITY, function (event) {
        var context = event.context,
            shape = context.shape,
            canExecute = context.canExecute,
            newBounds = roundBounds(context.newBounds),
            delta = { x: newBounds.width - shape.width, y: newBounds.height - shape.height },
            parent,
            parentBounds,
            shapeSize;
        if (is(shape, 'parallel-state')) {
            if (canExecute) {
                //ensure we have actual pixel values for new bounds
                //(important when zoom level was > 1 during move)
                if (delta.x !== 0 || delta.y !== 0) {
                    //resize the parallel
                    modeling.resizeShape(shape, newBounds);
                    // resize regions
                    resizeRegionsInParallel(modeling, shape, newBounds);
                }
            }
            delete context.resizeConstraints;
            // stop propagation
            return false;
        } else if (is(shape, 'region')) {
            if (canExecute) {
                // ensure we have actual pixel values for new bounds
                // (important when zoom level was > 1 during move)
                if (delta.x !== 0 || delta.y !== 0) {
                    parent = shape.parent;
                    // resize parallel(parent)
                    parentBounds = getBounds(parent);
                    parentBounds.height += delta.y;
                    modeling.resizeShape(parent, parentBounds);
                    // resize current region
                    modeling.resizeShape(shape, newBounds);
                    delete context.resizeConstraints;
                    resizeRegionsInParallel(modeling, parent, newBounds);
                }
            }
            // stop propagation
            return false;
        } else if (is(shape, 'compound-state')) {
            if (canExecute) {
                // ensure we have actual pixel values for new bounds
                // (important when zoom level was > 1 during move)
                if (delta.x !== 0 || delta.y !== 0) {
                    // resize compound
                    adjustChildren(modeling, shape, newBounds);
                    modeling.resizeShape(shape, newBounds);
                }
            }
            delete context.resizeConstraints;
            // stop propagation
            return false;
        } else if (is(shape, 'atomic-state')) {
           
            if (canExecute) {
                // ensure we have actual pixel values for new bounds
                // (important when zoom level was > 1 during move)
                if (delta.x !== 0 || delta.y !== 0) {
                    // resize compound
                    shapeSize = Math.ceil((newBounds.height + newBounds.width) / 2);
                    newBounds.height = shapeSize;
                    newBounds.width = shapeSize;
                    modeling.resizeShape(shape, newBounds, getMinDefaultBounds(shape));
                    modeling.updateLabel(shape, shape.label.businessObject.name);
                }
            }
            delete context.resizeConstraints;
            // stop propagation
            return false;
        }

        return true;
    });
    function getMaxChildHeight(shape, margin) {
        var children, height,
            optMargin = margin || 0;
        height = 0;
        children = getImmediateChildren(shape);
        if (children.length > 0) {
            height =
                children.reduce(function (maxy, obj) {
                    maxy = obj.y + obj.height > maxy ? obj.y + obj.height : maxy;
                    return maxy;
                }, 0) -
                shape.y + optMargin;
        } else {
            height = modeling.getDefaultSize(shape).height;
        }
        return height;
    }
    function getMaxChildWidth(shape, margin) {
        var children, width = 0,
            optMargin = margin || 0;
        children = getImmediateChildren(shape);
        if (children.length > 0) {
            width =
                children.reduce(function (maxx, obj) {
                    maxx = obj.x + obj.width > maxx ? obj.x + obj.width : maxx;
                    return maxx;
                }, 0) -
                shape.x + optMargin;
        } else {
            width = modeling.getDefaultSize(shape).width;
        }
        return width;
    }
    // Get minimum bounds of all children in region
    function getMaxRegionChildWidth(parallel) {
        var regions;
        if (parallel) {
            regions = getImmediateChildren(parallel);
            return regions.reduce(function (value, region) {
                var max = getMaxChildWidth(region, REGION_INDENTATION * 3);
                return max > value ? max : value;
            }, 0);
        }
        return null;
    }
    // Get minimum bounds of all region in parallel
    function getMinParallelBounds(parallel) {
        var minBounds;
        var regions = getChildRegions(parallel);
        // use  reduce to get max width of regions and total height
        var regionDetails = regions.reduce(
            function (result, obj) {
                result.maxWidth = obj.width > result.maxWidth ? obj.width : result.maxWidth;
                result.sumHeight = result.sumHeight + obj.height;
                return result;
            },
            { maxWidth: 0, sumHeight: 0 }
        );

        minBounds = {
            width: regionDetails.maxWidth + REGION_INDENTATION * 2,
            height: regionDetails.sumHeight + PARALLEL_BOTTOM_MARGIN + PARALLEL_TOP_MARGIN,
            x: parallel.x,
            y: parallel.y
        };
        minBounds.width = getMaxRegionChildWidth(parallel);
        return minBounds;
    }
    // Get minimum bounds of all children in compound
    function getMinCompoundBounds(shape) {
        var minBounds;
        minBounds = getMinDefaultBounds(shape); // default minimum bounds
        minBounds.width = getMaxChildWidth(shape);
        minBounds.height = getMaxChildHeight(shape);
        return minBounds;
    }
    // default minimum bounds shape(x,y) and default(x,y) defined in ElementFactory<-Modeling.getDefaultSize()
    function getMinDefaultBounds(shape) {
        var minBounds = getBounds(shape);
        var defaultSize = modeling.getDefaultSize(shape);
        minBounds.width = defaultSize.width;
        minBounds.height = defaultSize.height;
        return minBounds;
    }

    // get parent's max bounds. restrict resize operation in parent container.
    function getParentMaxBounds(shape) {
        var retval = null,
            diameter,
            parentBO = shape.parent.businessObject;
        var parent = shape.parent;
        if (parentBO.type === 'root') {
            retval = { x: 0, y: 0, height: 5000, width: 5000 };
        } else {
            if (shape.type === 'atomic-state') {
                diameter = parent.width < parent.height ? parent.width : parent.height;
                diameter -= 5;
                retval = { x: parent.x, y: parent.y, width: diameter, height: diameter };
            } else {
                retval = { x: parent.x + 4, y: parent.y + 4, width: parent.width - 8, height: parent.height - 8 };
            }
        }

        return retval;
    }
    // converts relative to absolute position set as constraints in context
    function getResizeConstraints(context, minBounds, maxBounds) {
        if (maxBounds && minBounds) {
            context.resizeConstraints = {
                min: asTRBL(minBounds),
                max: asTRBL(maxBounds)
            };
        } else if (minBounds) {
            context.resizeConstraints = {
                min: asTRBL(minBounds)
            };
        } else if (maxBounds) {
            context.resizeConstraints = {
                max: asTRBL(maxBounds)
            };
        }
        return context.resizeConstraints;
    }
}
ResizeShapeBehavior.$inject = ['eventBus', 'modeling'];

module.exports = ResizeShapeBehavior;
