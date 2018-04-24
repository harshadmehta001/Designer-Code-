'use strict';

var assign = require('lodash/object/assign');

var is = require('./ModelUtil').is;

var DEFAULT_LABEL_SIZE = (module.exports.DEFAULT_LABEL_SIZE = {
    width: 90,
    height: 20
});

var FLOW_LABEL_INDENT = (module.exports.FLOW_LABEL_INDENT = 15);

/**
 * Returns true if the given semantic has an external label
 *
 * @param {Element} semantic
 * @return {Boolean} true if has label
 */
module.exports.hasExternalLabel = function (semantic) {
    return (
        is(semantic, 'atomic-state') ||
        is(semantic, 'compound-state') ||
        is(semantic, 'region') ||
        is(semantic, 'parallel-state') ||
        is(semantic, 'transition')
    );
};

/**
 * Get the position for sequence flow labels
 *
 * @param  {Array<Point>} waypoints
 * @return {Point} the label position
 */
function getFlowLabelPosition(waypoints) {
    // get the waypoints mid
    var mid = waypoints.length / 2 - 1;

    var first = waypoints[Math.floor(mid)];
    var second = waypoints[Math.ceil(mid + 0.01)];

    // get position
    var position = getWaypointsMid(waypoints);

    // calculate angle
    var angle = Math.atan((second.y - first.y) / (second.x - first.x));

    var x = position.x, y = position.y;

    if (Math.abs(angle) < Math.PI / 2) {
        y -= FLOW_LABEL_INDENT;
    } else {
        x += FLOW_LABEL_INDENT;
    }

    return { x: x, y: y };
}

module.exports.getFlowLabelPosition = getFlowLabelPosition;

/**
 * Get the middle of a number of waypoints
 *
 * @param  {Array<Point>} waypoints
 * @return {Point} the mid point
 */
function getWaypointsMid(waypoints) {
    var mid = waypoints.length / 2 - 1;

    var first = waypoints[Math.floor(mid)];
    var second = waypoints[Math.ceil(mid + 0.01)];

    return {
        x: first.x + (second.x - first.x) / 2,
        y: first.y + (second.y - first.y) / 2
    };
}

module.exports.getWaypointsMid = getWaypointsMid;

function getExternalLabelMid(element) {
    if (element.waypoints) {
        return getFlowLabelPosition(element.waypoints);
    } else {
        return {
            x: element.x + element.width / 2,
            y: element.y + element.height + DEFAULT_LABEL_SIZE.height / 2
        };
    }
}

module.exports.getExternalLabelMid = getExternalLabelMid;

/**
 * Returns the bounds of an elements label, parsed from the elements DI or
 * generated from its bounds.
 *
 * @param {Element} semantic
 * @param {djs.model.Base} element
 */
module.exports.getExternalLabelBounds = function (semantic, element) {
    var mid, size, bounds, di = semantic.di, label = di.label;

    if (label && label.bounds) {
        bounds = label.bounds;

        size = {
            width: Math.max(DEFAULT_LABEL_SIZE.width, bounds.width),
            height: bounds.height
        };

        mid = {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2
        };
    } else {
        mid = getExternalLabelMid(element);

        size = DEFAULT_LABEL_SIZE;
    }

    return assign(
        {
            x: mid.x - size.width / 2,
            y: mid.y - size.height / 2
        },
        size
    );
};

function getLabelAttr(semantic) {
    if (is(semantic, 'atomic-state') ||
        is(semantic, 'parallel-state') ||
        is(semantic, 'compound-state') ||
        is(semantic, 'region')) {
        return 'name';
    }
    if (is(semantic, 'transition')) {
        return 'action';
    }

    return null;
}

module.exports.getLabel = function (element) {
    var bo = element.businessObject, attr = getLabelAttr(bo);

    if (attr) {
        return bo[attr] || '';
    } else {
        return '';
    }
};

module.exports.setLabel = function (element, text, isExternal) {
    var bo = element.businessObject, attr = getLabelAttr(bo);
    var visible = true;
    if (attr) {
        bo[attr] = text;
    }

    // show external label if not empty
    if (isExternal) {
        if (bo.type === 'transition') {
            visible = visible && !bo.isAuto;
            visible = visible && (typeof bo.gfx.labelVisible === 'undefined' ? true : bo.gfx.labelVisible);
        }
        visible = visible && text;
        element.hidden = !visible;
    } else {
        //do nothing  
    }

    return element;
};
