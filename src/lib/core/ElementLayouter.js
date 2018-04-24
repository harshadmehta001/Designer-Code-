'use strict';

var inherits = require('inherits');

var assign = require('lodash/object/assign');

var BaseLayouter = require('diagram-js/lib/layout/BaseLayouter'),
    ManhattanLayout = require('diagram-js/lib/layout/ManhattanLayout');

var LayoutUtil = require('diagram-js/lib/layout/LayoutUtil');


var getMid = LayoutUtil.getMid;

function ElementLayouter() {}

inherits(ElementLayouter, BaseLayouter);

module.exports = ElementLayouter;

ElementLayouter.prototype.layoutConnection = function(connection, hints) {
    var source = connection.source,
        target = connection.target,
        waypoints = connection.waypoints,
        start,
        end,
        index,
        manhattanOptions,
        updatedWaypoints;
    hints = hints || {};
    start = hints.connectionStart;
    end = hints.connectionEnd;

    if (source.id === target.id) {
        // Reuse space of deleted self connections.
        // set 1 into sourceBO.gfx.slot[] for added connection. Connection has connectioBO.gfx.slotIndex property
        // ref: ElementUpdater.js-this.executed(['connection.delete']
        index=getIndex(source);
        connection.businessObject.gfx.slotIndex=index;
        updatedWaypoints = layoutSteps(source,index);
    } else {
        if (!start) {
            start = getConnectionDocking(waypoints && waypoints[0], source);
        }

        if (!end) {
            end = getConnectionDocking(waypoints && waypoints[waypoints.length - 1], target);
        }

        manhattanOptions = {
            preferredLayouts: ['h:h']
        };

        if (manhattanOptions) {
            manhattanOptions = assign(manhattanOptions, hints);
            updatedWaypoints = ManhattanLayout.repairConnection(
                source,
                target,
                start,
                end,
                waypoints,
                manhattanOptions
            );
        }
    }

    return updatedWaypoints || [start, end];
};

function getIndex(shape) {
    var i,
        slot = [],
        index = -1,
        retval = null;

    var gfx = (shape && shape.businessObject && shape.businessObject.gfx) || null;
    if (gfx !== null) {
        slot = (gfx && gfx.slot) || null;
    }
    if (slot === null) {
        slot = [];
    }
    for (i = 0; i < slot.length; i = i + 1) {
        if(slot[i]===0) {
            index=i;  
            break;              
        }
    }        
    if(index===-1) {
        slot.push(1);
        retval=slot.length-1;
    } else {
        slot[index]=1;
        retval=index;
    }            
    shape.businessObject.gfx.slot=slot;
    return retval;
}

function layoutSteps(shape, index) {    
    var offset = ((index+1)*20)-20;
    var sx = shape.x + shape.width;
    var sy = shape.y + shape.height / 2;
    var ex = shape.x + shape.width / 2;
    var ey = shape.y + shape.height;
    var mx = ex;
    var my = sy;
    var x = sx;
    var y = sy;
    var waypoints = [];
    var shapeWidth = shape.width,
        shapeHeight = shape.height;

    waypoints[0] = { original: { x: mx, y: my }, x: x, y: y };
    x = x + shapeWidth + offset;
    waypoints[1] = { x: x, y: y };
    y = y + shapeHeight * 1.5 + offset;
    waypoints[2] = { x: x, y: y };
    x = x - shapeWidth * 1.5 - offset;
    waypoints[3] = { x: x, y: y };
    waypoints[4] = { original: { x: mx, y: my }, x: ex, y: ey };

    return waypoints;
}
function getConnectionDocking(point, shape) {
    return point ? point.original || point : getMid(shape);
}
