'use strict';

var inherits = require('inherits');

var BaseModeling = require('diagram-js/lib/features/modeling/Modeling'),
    AddRegionHandler = require('./cmd/AddRegionHandler'),
    IdClaimHandler = require('./cmd/IdClaimHandler'),
    UpdateLabelHandler = require('./cmd/UpdateLabelHandler');

/**
 * Extends diagram-js model for handling workflow specific element manipulation
 * @param {EventBus} eventBus
 * @param {ElementFactory} elementFactory
 * @param {CommandStack} commandStack
 * @param {ElementRules} elementRules
 */

function Modeling(eventBus, elementFactory, commandStack, elementRules) {
    BaseModeling.call(this, eventBus, elementFactory, commandStack);
    this._elementRules = elementRules;
    this._elementFactory = elementFactory;
    this._model = elementFactory._model;
}

Modeling.$inject = ['eventBus', 'elementFactory', 'commandStack', 'elementRules'];

inherits(Modeling, BaseModeling);

module.exports = Modeling;

Modeling.prototype.getHandlers = function () {
    var handlers = BaseModeling.prototype.getHandlers.call(this);
    handlers['region.add'] = AddRegionHandler;
    handlers['id.updateClaim'] = IdClaimHandler;
    handlers['element.updateLabel'] = UpdateLabelHandler;
    return handlers;
};

Modeling.prototype.updateLabel = function (element, newLabel) {
    this._commandStack.execute('element.updateLabel', {
        element: element,
        newLabel: newLabel
    });
};

Modeling.prototype.redraw = function (shape) {
    this._commandStack.execute('shape.move', {
        shape: shape,
        delta: { x: 0, y: 0 },
        parent: shape.parent,
        hints: { layout: false }
    });
};

Modeling.prototype.removeElements = function (elements) {
    var target = {
        elements: elements
    };
    this._commandStack.execute('elements.delete', target);
};

Modeling.prototype.openPropertyWindow = function (element) {
    this._eventBus.fire('propertywindow.changed', element);
};

Modeling.prototype.connect = function (source, target, attrs, hints) {
    var elementRules = this._elementRules;

    if (!attrs) {
        attrs = elementRules.canConnect(source, target) || {
            type: 'transition'
        };
    }

    return this.createConnection(source, target, attrs, source.parent, hints);
};

Modeling.prototype.resizeShape = function (shape, newBounds, minBounds) {
    var context = {
        shape: shape,
        newBounds: newBounds,
        minBounds: minBounds
    };

    this._commandStack.execute('shape.resize', context);
};

Modeling.prototype.addRegion = function (targetRegionShape, location) {
    var dx, dy;
    var context = {
        shape: targetRegionShape,
        location: location
    };

    this._commandStack.execute('region.add', context);
    dx = targetRegionShape.x < 0 ? Math.abs(targetRegionShape.x) + 10 : 0;
    dy = targetRegionShape.y < 0 ? Math.abs(targetRegionShape.y) + 10 : 0;
    if (dx + dy > 0) {
        this.moveShape(targetRegionShape, { x: dx, y: dy });
    }

    return context.newRegion;
};

Modeling.prototype.removeBends = function (shape) {
    var newWaypoints, context;
    // only if more than 2 bends and not self transition
    if (shape.waypoints.length > 2 && shape.source !== shape.target) {
        newWaypoints = shape.waypoints;
        // remove all bends and restore original position
        newWaypoints.splice(1, newWaypoints.length - 2);
        //this._commandStack.execute('connection.updateWaypoints', context);
        context = { connection: shape };
        this._commandStack.execute('connection.layout', context);
    }
};

Modeling.prototype.claimId = function (id, modelElement) {
    this._commandStack.execute('id.updateClaim', {
        id: id,
        element: modelElement,
        claiming: true
    });
};

Modeling.prototype.unclaimId = function (id, modelElement) {
    this._commandStack.execute('id.updateClaim', {
        id: id,
        element: modelElement
    });
};

Modeling.prototype.getDefaultSize = function (shape) {
    return (shape && shape.type ? this._elementFactory._getDefaultSize(shape.type) : this.elementFactory._getDefaultSize('root'));
};

Modeling.prototype.updateConnection = function (connection) {
    var businessObject = connection.businessObject,
        newSource = connection.source.businessObject,
        newTarget = connection.target.businessObject;

    this._model.updateTransition(businessObject, newSource.id, newTarget.id);

    businessObject.gfx.waypoints = this._elementFactory.createWaypoints(connection.waypoints);
};
