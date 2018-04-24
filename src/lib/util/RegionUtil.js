'use strict';

var is = require('./ModelUtil').is;

var REGION_INDENTATION = 10;
var PARALLEL_TOP_MARGIN = 30;
var PARALLEL_BOTTOM_MARGIN = 10;
module.exports.REGION_INDENTATION = REGION_INDENTATION;
module.exports.PARALLEL_TOP_MARGIN = PARALLEL_TOP_MARGIN;
module.exports.PARALLEL_BOTTOM_MARGIN = PARALLEL_BOTTOM_MARGIN;

/**
 * Return the regions in the given element.
 *
 * @param {djs.model.Shape} shape
 *
 * @return {Array<djs.model.Shape>}
 */
function getChildRegions(shape) {
    return shape.children.filter(function(c) {
        return is(c, 'region') && c.parent.id === shape.id;
    });
}

module.exports.getChildRegions = getChildRegions;

/**
 * Return the immidiate children in the given element.
 *
 * @param {djs.model.Shape} shape
 *
 * @return {Array<djs.model.Shape>}
 */
function getImmediateChildren(shape) {
    return shape.children.filter(function(c) {
        return !isLabel(c) && c.parent.id === shape.id;
    });
}

module.exports.getImmediateChildren = getImmediateChildren;

/**
 * Resize balanced, adjusting next / previous region sizes.
 *
 * @param {djs.model.Shape} shape
 * @param {Bounds} newBounds
 */
function resizeRegionsInParallel(modeling, parallel) {    
    //compute regeions before resizing parallel
    var resizeNeeded = computeRegionsResize(parallel);
    // resize regions
    resizeNeeded.forEach(function(r) {        
        adjustChildren(modeling, r.shape, r.newBounds);
        modeling.resizeShape(r.shape, r.newBounds);
    });
}
module.exports.resizeRegionsInParallel = resizeRegionsInParallel;
/**
 * Compute the required resize operations for regions
 * adjacent to the given shape, assuming it will be
 * resized to the given new bounds.
 *
 * @param {djs.model.Shape} shape
 * @param {Bounds} newBounds
 *
 * @return {Array<Object>}
 */
function computeRegionsResize(parallel) {
    var i = 0,
        regionsHeight = 0,
        affected = [],
        deltaPR = 0;
    var newBounds = getBounds(parallel);
    var regions = getChildRegions(parallel),
        rw = newBounds.width - REGION_INDENTATION * 2,
        rx = newBounds.x + REGION_INDENTATION,
        ry = newBounds.y + PARALLEL_TOP_MARGIN;

    //fix: sorting because it is always appending new region  at bottom of array
    regions.sort(function(a, b) {
        var retval = -1;
        if (a.y < b.y) {
            retval = -1;
        } else if (a.y > b.y) {
            retval = 1;
        } else {
            retval = 0;
        }
        return retval;
    });
    // move regions as needed
    regions.forEach(function(r) {
        var rbounds = {
            height: r.height,
            width: rw,
            x: rx,
            y: ry + i
        };
        regionsHeight += r.height;
        affected.push({
            shape: r,
            newBounds: rbounds
        });
        //that.resizeShape(r, rbounds);
        i = i + r.height;
    });
    //resize last region upto parallel if required
    deltaPR = newBounds.height - regionsHeight - PARALLEL_TOP_MARGIN - PARALLEL_BOTTOM_MARGIN;
    if (affected.length > 0 && deltaPR > 0) {
        i = affected.length - 1;
        affected[i].newBounds.height += deltaPR;
    }
    return affected;
}
module.exports.computeRegionsResize = computeRegionsResize;

function adjustChildren(modeling, shape, newBounds) {
    var children, delta;
    if (newBounds.x!==shape.x || newBounds.y!==shape.y) {        
        children = getImmediateChildren(shape);
        if (shape.children.length > 0) {
            delta = {x: newBounds.x - shape.x, y: newBounds.y - shape.y};        
            children.forEach(function(child) {
                modeling.moveShape(child, delta, shape);                
            });            
        }
    }
}
module.exports.adjustChildren = adjustChildren;

function isLabel(element) {
    return element.type === 'label';
}

function getBounds(shape) {
    return {
        height: shape.height,
        width: shape.width, // left right margin
        x: shape.x,
        y: shape.y
    };
}
module.exports.getBounds = getBounds;
