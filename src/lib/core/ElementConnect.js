'use strict';

var MARKER_OK = 'connect-ok',
    MARKER_NOT_OK = 'connect-not-ok';

/**
 * A Custom Connect for connection/transition
 * @param {EventBus} eventBus 
 * @param {Dragging} dragging 
 * @param {Connect} connect 
 * @param {Canvas} canvas 
 * @param {ToolManager} toolManager 
 */
function ElementConnect(eventBus, dragging, connect, canvas, toolManager) {
    var self = this;
    this._eventBus = eventBus;
    this._dragging = dragging;

    toolManager.registerTool('element-connect', {
        tool: 'element-connect',
        dragging: 'element-connect.drag'
    });

    eventBus.on('element-connect.hover', function (event) {
        var context = event.context,
            startTarget = event.hover,
            canStartConnect;
        //Added to restrict auto transition from atomic-state
        if (context.isAuto) {
            if (startTarget.type !== 'compound-state' && startTarget.type !== 'parallel-state') {
                return;
            }
        }
        canStartConnect = (context.canStartConnect = self.canStartConnect(startTarget));

        // simply ignore hover
        if (canStartConnect === null) {
            return;
        }

        context.startTarget = startTarget;

        canvas.addMarker(startTarget, canStartConnect ? MARKER_OK : MARKER_NOT_OK);
    });

    eventBus.on(['element-connect.out', 'element-connect.cleanup'], function (event) {
        var startTarget = event.context.startTarget,
            canStartConnect = event.context.canStartConnect;

        if (startTarget) {
            canvas.removeMarker(startTarget, canStartConnect ? MARKER_OK : MARKER_NOT_OK);
        }
    });

    eventBus.on('connect.end', 2000, function (event) {
        if (!event.context.canExecute) {
            return;
        }
        event.context.canExecute = event.context.source.transitionData;
    });

    eventBus.on(['element-connect.ended'], function (event) {
        var context = event.context,
            startTarget = context.startTarget,
            startPosition = {
                x: event.x,
                y: event.y
            },
            canStartConnect;
        if (startTarget) {
            startTarget.transitionData = {
                isAuto: context.isAuto,
                type: context.type,
                x: event.x,
                y: event.y
            };

            canStartConnect = self.canStartConnect(startTarget);

            if (!canStartConnect) {
                return;
            }

            eventBus.once('element.out', function () {
                eventBus.once(['connect.ended', 'connect.canceled'], function () {
                    eventBus.fire('element-connect.drag.ended');
                });

                connect.start(null, startTarget, startPosition);
            });
        }
        return;
    });
}

ElementConnect.$inject = ['eventBus', 'dragging', 'connect', 'canvas', 'toolManager'];

module.exports = ElementConnect;

ElementConnect.prototype.start = function (event, context) {
    this._dragging.init(event, 'element-connect', {
        trapClick: false,
        data: {
            context: context
        }
    });
};

ElementConnect.prototype.toggle = function (event, context) {
    if (this.isActive()) {
        this._dragging.cancel();
    } else {
        this.start(event, context);
    }
};

ElementConnect.prototype.isActive = function () {
    var context = this._dragging.context();

    return context && /^element-connect/.test(context.prefix);
};

ElementConnect.prototype.registerProvider = function (provider) {
    this._provider = provider;
};

/**
 * Check if source shape can initiate connection.
 *
 * @param  {Shape} startTarget
 * @return {Boolean}
 */
ElementConnect.prototype.canStartConnect = function (source) {
    var businessObject;
    if (nonExistantOrLabel(source)) {
        return null;
    }
    businessObject = source.businessObject;
    //Transition cannot start or end from or to root.
    if (businessObject.type === 'root') {
        return false;
    }
    if (businessObject) {
        return businessObject.type !== 'transition';
    }
    //Auto Transition cannot start from an atomic-state
    if (source.transitionData.isAuto) {
        if (businessObject.type === 'atomic-state') {
            return false;
        }
    }
    return true;
};

function nonExistantOrLabel(element) {
    return !element || isLabel(element);
}

function isLabel(element) {
    return element.type === 'label';
}
