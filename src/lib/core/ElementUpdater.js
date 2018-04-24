'use strict';

var inherits = require('inherits');

var assign = require('lodash/object/assign'), getBusinessObject = require('../util/ModelUtil').getBusinessObject;

var CommandInterceptor = require('diagram-js/lib/command/CommandInterceptor');

/**
 * Updates custom element's BO once changes on the diagram happen
 * @param {EventBus} eventBus 
 * @param {ElementFactory} elementFactory 
 * @param {ConnectionDocking} connectionDocking 
 * @param {Model} model 
 */

function ElementUpdater(eventBus, elementFactory, connectionDocking, model) {
    var self = this;

    CommandInterceptor.call(this, eventBus);

    this._elementFactory = elementFactory;
    this._model = model;

    // crop connection ends during create/update
    function cropConnection(e) {
        var context = e.context, connection;

        if (!context.cropped) {
            connection = context.connection;
            connection.waypoints = connectionDocking.getCroppedWaypoints(connection);
            context.cropped = true;
        }
    }

    this.executed(
        ['connection.layout', 'connection.create', 'connection.reconnectEnd', 'connection.reconnectStart'],
        cropConnection
    );


    // update parent
    function updateParent(e) {
        var context = e.context;
        self.updateParent(context.shape || context.connection, context.oldParent);
    }


    this.executed(
        ['shape.move', 'shape.create'],
        updateParent
    );

    // update bounds
    function updateBounds(e) {
        var shape = e.context.shape;

        self.updateBounds(shape);
    }

    this.executed(['shape.move', 'shape.create', 'shape.resize'], function (event) {
        // exclude labels because they're handled separately during shape.changed
        if (event.context.shape.type === 'label') {
            return;
        }

        updateBounds(event);
    });


    // Handle labels separately. This is necessary, because the label bounds have to be updated
    // every time its shape changes, not only on move, create and resize.
    eventBus.on('shape.changed', function (event) {
        if (event.element.type === 'label') {
            updateBounds({
                context: {
                    shape: event.element
                }
            });
        }
    });

    // attach / detach connection
    function updateConnection(e) {
        self.updateConnection(e.context);
    }

    this.executed(
        ['connection.create', 'connection.move', 'connection.reconnectEnd', 'connection.reconnectStart'],
        updateConnection
    );


    // update waypoints
    function updateConnectionWaypoints(e) {
        self.updateConnectionWaypoints(e.context.connection);
    }

    this.executed(
        [
            'connection.layout',
            'connection.move',
            'connection.updateWaypoints',
            'connection.reconnectEnd',
            'connection.reconnectStart'
        ],
        updateConnectionWaypoints
    );

    // update Default & Conditional flows
    this.executed(['connection.reconnectEnd', 'connection.reconnectStart'], function (e) {
        var context = e.context,
            connection = context.connection,
            businessObject = getBusinessObject(connection),
            oldSource = getBusinessObject(context.oldSource),
            oldTarget = getBusinessObject(context.oldTarget),
            newSource = getBusinessObject(connection.source),
            newTarget = getBusinessObject(connection.target);

        if (oldSource === newSource || oldTarget === newTarget) {
            return;
        }

        // on reconnectStart -> default flow
        if (oldSource && newSource.id !== businessObject.sourceStateId) {
            context.default = oldSource.id;
            businessObject.sourceStateId = newSource.id;
        }

        // on reconnectEnd -> default flow
        if (oldTarget && newTarget.id !== businessObject.targetStateId) {
            context.default = oldTarget.id;
            businessObject.targetStateId = newTarget.id;
        }
    });

    this.executed(['shape.create'], function (e) {
        var businessObject = getBusinessObject(e.context.shape);

        if (businessObject && (businessObject.parentId === null)) {
            if (businessObject.isInitial) {
                self._model.setInitialStateId(businessObject.id);
            } else if (businessObject.isFinal) {
                self._model.addFinalStateId(businessObject.id);
            }
        }

        self._model.setState(businessObject);
    });

    this.executed(['shape.delete'], function (e) {
        var businessObject = getBusinessObject(e.context.shape);
        if (businessObject.isInitial === true) {
            self._model.resetInitialState(businessObject);
        }
        self._model.removeState(businessObject);
    });

    this.executed(['connection.create'], function (e) {
        var businessObject = getBusinessObject(e.context.connection);
        self._model.setTransition(businessObject);
    });

    this.executed(['connection.delete'], function (e) {
        var connectionBO = getBusinessObject(e.context.connection);
        var sourceId = connectionBO.sourceStateId,
            targetId = connectionBO.targetStateId,
            slot, sourceBO, slotIndex;
        // Reuse space of deleted self connections.
        // set 0 into sourceBO.gfx.slot[] for deleted connection. Connection has slotIndex
        // ref: ElementLayout.js getIndex(shape) and layoutConnection()
        if (sourceId === targetId) {
            sourceBO = self._model.children[sourceId];
            if (sourceBO) {
                slot = sourceBO.gfx.slot;
                slotIndex = connectionBO.gfx.slotIndex;
                if (sourceBO && connectionBO && Array.isArray(slot) && Number.isInteger(slotIndex)) {
                    sourceBO.gfx.slot[slotIndex] = 0;
                }
            }
        }
        self._model.removeTransition(connectionBO);
    });
}

ElementUpdater.$inject = ['eventBus', 'elementFactory', 'connectionDocking', 'model'];

inherits(ElementUpdater, CommandInterceptor);

module.exports = ElementUpdater;

ElementUpdater.prototype.updateParent = function (element, oldParent) {
    var parentShape, businessObject, parentBusinessObject, oldParentBusinessObject;
    if (element.type === 'label' || element.type === 'transition') {
        return;
    }

    parentShape = element.parent;
    businessObject = element.businessObject;
    parentBusinessObject = parentShape && parentShape.businessObject;
    oldParentBusinessObject = oldParent && oldParent.businessObject;

    this._model.updateParent(businessObject, parentBusinessObject, oldParentBusinessObject);
};

ElementUpdater.prototype.updateBounds = function (shape) {
    var gfx = shape.businessObject.gfx;

    var bounds;
    if (shape.type === 'label') {
        if (!gfx.labelBounds) {
            gfx.labelBounds = {};
        }
        bounds = gfx.labelBounds;
    } else {
        if (!gfx.stateBounds) {
            gfx.stateBounds = {};
        }
        bounds = gfx.stateBounds;
    }

    bounds = shape.type === 'label' ? gfx.labelBounds : gfx.stateBounds;

    assign(bounds, {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height
    });
};

ElementUpdater.prototype.updateConnection = function (context) {
    var connection = context.connection,
        businessObject = getBusinessObject(connection),
        newSource = getBusinessObject(connection.source),
        newTarget = getBusinessObject(connection.target);

    this._model.updateTransition(businessObject, newSource.id, newTarget.id);

    this.updateConnectionWaypoints(connection);
};

ElementUpdater.prototype.updateConnectionWaypoints = function (connection) {
    connection.businessObject.gfx.waypoints = this._elementFactory.createWaypoints(connection.waypoints);
};