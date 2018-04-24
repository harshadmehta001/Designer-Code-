'use strict';

var inherits = require('inherits');

var forEach = require('lodash/collection/forEach'),
    assign = require('lodash/object/assign');

var is = require('../../util/ModelUtil').is;

var BaseSnapping = require('diagram-js/lib/features/snapping/Snapping'),
    BaseSnapUtil = require('diagram-js/lib/features/snapping/SnapUtil');

var asTRBL = require('diagram-js/lib/layout/LayoutUtil').asTRBL;

var round = Math.round;

var mid = BaseSnapUtil.mid,
    topLeft = BaseSnapUtil.topLeft,
    bottomRight = BaseSnapUtil.bottomRight,
    isSnapped = BaseSnapUtil.isSnapped,
    setSnapped = BaseSnapUtil.setSnapped;

var getBoundaryAttachment = require('./SnappingUtil').getBoundaryAttachment;
var HIGH_PRIORITY = 1500;

/**
 * Snapping functionality to align element while dragging it on the canvas
 * @param {EventBus} eventBus
 * @param {Canvas} canvas
 * @param {Rules} rules
 */
function Snapping(eventBus, canvas, rules) {
    // instantiate super
    BaseSnapping.call(this, eventBus, canvas);

    eventBus.on(['create.move', 'create.end'], HIGH_PRIORITY, function (event) {
        var context = event.context, shape = context.shape, participantSnapBox = context.participantSnapBox;

        if (!isSnapped(event) && participantSnapBox) {
            snapParticipant(participantSnapBox, shape, event);
        }
    });

    function canAttach(shape, target, position) {
        return rules.canAttach([shape], target, null, position) === 'attach';
    }

    function canConnect(source, target) {
        return rules.canConnect(source, target);
    }

    /**
     * Snap boundary events to elements border
     */
    eventBus.on(['create.move', 'create.end', 'shape.move.move', 'shape.move.end'], HIGH_PRIORITY, function (event) {
        var context = event.context, target = context.target, shape = context.shape;

        if (target && !isSnapped(event) && canAttach(shape, target, event)) {
            snapBoundaryEvent(event, shape, target);
        }
    });

    /**
     * Snap sequence flows.
     */
    eventBus.on(['connect.move', 'connect.hover', 'connect.end'], HIGH_PRIORITY, function (event) {
        var context = event.context, source = context.source, target = context.target;

        var connection = canConnect(source, target) || {};

        if (!context.initialSourcePosition) {
            context.initialSourcePosition = context.sourcePosition;
        }

        if (target && connection.type === 'transition') {
            // snap source
            context.sourcePosition = mid(source);

            // snap target
            assign(event, mid(target));
        } else {
            // otherwise reset source snap
            context.sourcePosition = context.initialSourcePosition;
        }
    });
}

inherits(Snapping, BaseSnapping);

Snapping.$inject = ['eventBus', 'canvas', 'elementRules', 'elementRegistry'];

module.exports = Snapping;

Snapping.prototype.initSnap = function (event) {
    var context = event.context,
        shape = event.shape,
        shapeMid,
        shapeBounds,
        shapeTopLeft,
        shapeBottomRight,
        snapContext,
        source;

    snapContext = BaseSnapping.prototype.initSnap.call(this, event);

    if (shape) {
        shapeMid = mid(shape, event);

        shapeBounds = {
            width: shape.width,
            height: shape.height,
            x: isNaN(shape.x) ? round(shapeMid.x - shape.width / 2) : shape.x,
            y: isNaN(shape.y) ? round(shapeMid.y - shape.height / 2) : shape.y
        };

        shapeTopLeft = topLeft(shapeBounds);
        shapeBottomRight = bottomRight(shapeBounds);

        snapContext.setSnapOrigin('top-left', {
            x: shapeTopLeft.x - event.x,
            y: shapeTopLeft.y - event.y
        });

        snapContext.setSnapOrigin('bottom-right', {
            x: shapeBottomRight.x - event.x,
            y: shapeBottomRight.y - event.y
        });

        forEach(shape.outgoing, function (c) {
            var docking = c.waypoints[0];

            docking = docking.original || docking;

            snapContext.setSnapOrigin(c.id + '-docking', {
                x: docking.x - event.x,
                y: docking.y - event.y
            });
        });

        forEach(shape.incoming, function (c) {
            var docking = c.waypoints[c.waypoints.length - 1];

            docking = docking.original || docking;

            snapContext.setSnapOrigin(c.id + '-docking', {
                x: docking.x - event.x,
                y: docking.y - event.y
            });
        });
    }

    source = context.source;

    if (source) {
        snapContext.addDefaultSnap('mid', mid(source));
    }
};

Snapping.prototype.addTargetSnaps = function (snapPoints, shape, target) {
    var siblings, docking;
    if (is(target, 'AtomicState')) {
        this.addTargetSnaps(snapPoints, shape, target.parent);
    }

    siblings = this.getSiblings(shape, target) || [];

    forEach(siblings, function (s) {
        // do not snap to lanes
        if (is(s, 'Region')) {
            return;
        }

        snapPoints.add('mid', mid(s));
    });

    forEach(shape.incoming, function (c) {
        if (siblings.indexOf(c.source) === -1) {
            snapPoints.add('mid', mid(c.source));
        }

        docking = c.waypoints[0];
        snapPoints.add(c.id + '-docking', docking.original || docking);
    });

    forEach(shape.outgoing, function (c) {
        if (siblings.indexOf(c.target) === -1) {
            snapPoints.add('mid', mid(c.target));
        }

        docking = c.waypoints[c.waypoints.length - 1];
        snapPoints.add(c.id + '-docking', docking.original || docking);
    });
};

function snapParticipant(snapBox, shape, event, offset) {
    var shapeHalfWidth, currentTopLeft, currentBottomRight, snapTopLeft, shapeHalfHeight, snapBottomRight;
    offset = offset || 0;

    shapeHalfWidth = shape.width / 2 - offset, shapeHalfHeight = shape.height / 2;

    currentTopLeft = {
        x: event.x - shapeHalfWidth - offset,
        y: event.y - shapeHalfHeight
    };

    currentBottomRight = {
        x: event.x + shapeHalfWidth + offset,
        y: event.y + shapeHalfHeight
    };

    snapTopLeft = snapBox, snapBottomRight = bottomRight(snapBox);

    if (currentTopLeft.x >= snapTopLeft.x) {
        setSnapped(event, 'x', snapTopLeft.x + offset + shapeHalfWidth);
    } else if (currentBottomRight.x <= snapBottomRight.x) {
        setSnapped(event, 'x', snapBottomRight.x - offset - shapeHalfWidth);
    }

    if (currentTopLeft.y >= snapTopLeft.y) {
        setSnapped(event, 'y', snapTopLeft.y + shapeHalfHeight);
    } else if (currentBottomRight.y <= snapBottomRight.y) {
        setSnapped(event, 'y', snapBottomRight.y - shapeHalfHeight);
    }
}

function snapBoundaryEvent(event, shape, target) {
    var targetTRBL = asTRBL(target);

    var direction = getBoundaryAttachment(event, target);

    if (/top/.test(direction)) {
        setSnapped(event, 'y', targetTRBL.top);
    } else if (/bottom/.test(direction)) {
        setSnapped(event, 'y', targetTRBL.bottom);
    }

    if (/left/.test(direction)) {
        setSnapped(event, 'x', targetTRBL.left);
    } else if (/right/.test(direction)) {
        setSnapped(event, 'x', targetTRBL.right);
    }
}
