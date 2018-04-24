'use strict';

var filter = require('lodash/collection/filter'),
    forEach = require('lodash/collection/forEach'),
    inherits = require('inherits');

var RuleProvider = require('diagram-js/lib/features/rules/RuleProvider');

var isAny = require('../util/ModelingUtil').isAny;

var getChildRegions = require('../util/RegionUtil').getChildRegions;

var HIGH_PRIORITY = 1500;

/**
 * Design time rules applicable on the custom element's BO
 * 
 * @param {EventBus} eventbus
 * @param {Model} model
 */
function ElementRules(eventBus, model) {
    RuleProvider.call(this, eventBus);
    this._model = model;
    this._eventBus = eventBus;
}

ElementRules.$inject = ['eventBus', 'model'];

inherits(ElementRules, RuleProvider);

module.exports = ElementRules;

ElementRules.prototype.init = function () {
    var self = this;
    var errorMessage = '';

    this._eventBus.on(['create.end', 'shape.move.end'], HIGH_PRIORITY, function (event) {
        var model = self._model;
        var context = event.context;
        var shape = getShapeFromContext(context);
        var target = context.target;
        var shapeBO = shape.businessObject,
            targetBO = (target && target.businessObject) || null;
        if (context.canExecute && targetBO && shapeBO) {
            if (shapeBO.isInitial) {
                if (event.type === 'shape.move.end') {
                    model.resetInitialState(shapeBO);
                }
                model.updateInitialState(targetBO, shapeBO);

            }
        } else if (target && target.type === 'label') {
            context.errorMessage = 'Invalid Target: Label ';
        } else {
            if (targetBO.type === 'atomic-state' || targetBO.type === 'parallel-state') {
                context.errorMessage = 'Invalid Target: ' + targetBO.type;
            }
            if (shapeBO.isInitial && model.hasInitial(targetBO)) {
                context.errorMessage = 'There should be one initial state';
            }
        }
    });

    this.addRule('elements.move', HIGH_PRIORITY, function (context) {
        var model = self._model;
        var allowMove = true;
        var shape = getShapeFromContext(context);
        if (shape.type === 'region') {
            return false;
        }
        if (model.isViewer) {
            allowMove = false;
        } else {
            allowMove = canMove(model, context);
        }
        //  move if it is not view
        return allowMove;
    });

    this.addRule(['shape.create', 'shape.append'], HIGH_PRIORITY, function (context) {
        var target = context.target;

        if (!target.businessObject) {
            target.businessObject = self._model;
        }
        return canCreate(context, self._model);
    });

    this.addRule('shape.resize', HIGH_PRIORITY, function (context) {
        var shape = context.shape;
        var newBounds = context.newBounds;
        return canResize(shape, newBounds);
    });

    this.addRule('connection.create', HIGH_PRIORITY, function (context) {
        var source = context.source,
            target = context.target,
            connection = context.connection,
            model = self._model,
            allowConnect = true,
            retval;
        if (target) {
            retval = canConnect(source, target, connection, model, context);
            if (!retval) {
                errorMessage = context.errorMessage;
                allowConnect = false;
            }
        } else {
            allowConnect = false;
        }
        return allowConnect;
    });

    this._eventBus.on('connect.end', HIGH_PRIORITY, function (event) {
        var context = event.context,
            msg = errorMessage;

        errorMessage = '';

        if (!context.canExecute) {
            self._eventBus.fire('connection.rejected', {
                context: { source: context.source, target: context.target, errorMessage: msg }
            });
        }
    });

    this.addRule('connection.reconnectStart', HIGH_PRIORITY, function (context) {
        var connection = context.connection,
            source = context.hover || context.source,
            target = connection.target,
            model = self._model;
        if (target && target.type !== 'label') {
            return canConnect(source, target, connection, model, context);
        } else {
            return false;
        }
    });

    this.addRule('connection.reconnectEnd', HIGH_PRIORITY, function (context) {
        var connection = context.connection,
            source = connection.source,
            target = context.hover || context.target,
            model = self._model;
        if (target && target.type !== 'label') {
            return canConnect(source, target, connection, model, context);
        } else {
            return false;
        }
    });

    this.addRule('connection.updateWaypoints', function (/*context*/) {
        // OK! but visually ignore
        return null;
    });

    this.addRule('elements.delete', function (context) {
        if (!canDelete(context.elements)) {
            return false;
        }
        // do not allow deletion of labels
        return filter(context.elements, function (e) {
            return !isLabel(e);
        });
    });
};

ElementRules.prototype.canConnect = canConnect;
ElementRules.prototype.canCreate = canCreate;
ElementRules.prototype.canAttach = canAttach;
ElementRules.prototype.canResize = canResize;
ElementRules.prototype.canInsert = canInsert;
ElementRules.prototype.canDelete = canDelete;
ElementRules.prototype.canMove = canMove;
/**
 * Can source and target be connected?
 */
function canConnect(source, target, connection, model, context) {

    var allowConnect = true, sourceBO, targetBO, transitionData;
    //Rule : Transition to or from root, region, label and transition is not allowed.
    if (invalidSource(source) || invalidTarget(target)) {
        if (context) {
            context.errorMessage = '';
        }
        allowConnect = false;
    }
    else {
        if (context) {
            context.errorMessage = '';
        }
        sourceBO = source.businessObject;
        targetBO = target.businessObject;

        transitionData = connection
            ? {
                isAuto: connection.isAuto
            }
            : source.transitionData;

        if (model && allowConnect) {
            //Rule : Transition across region is not allowed within same parallel ancestor.
            if (!model.checkCrossRegion(sourceBO, targetBO)) {
                context.errorMessage = 'Cross region transition is not valid within the same parallel ancestors.';
                allowConnect = false;
            }
            //Rule: Transition from ancestor to its sub-states is not allowed.
            if (!model.checkTransitionFromAncestor(sourceBO, targetBO)) {
                context.errorMessage = 'Transition from ancestor is not allowed.';
                allowConnect = false;
            }
            //Rule: Transition from sub-states to its ancestor is not allowed.
            if (!model.checkTransitionToAncestor(sourceBO, targetBO)) {
                context.errorMessage = 'Transition to ancestor is not allowed.';
                allowConnect = false;
            }
        }
        if (allowConnect && transitionData.isAuto && !connection) {
            //Rule : Auto Transition allowed only from compound and parallel state.
            if (
                (sourceBO.type === 'compound-state' || sourceBO.type === 'parallel-state') &&
                !hasAutoOutTransition(source)
            ) {
                allowConnect = true;
            } else {
                allowConnect = false;
            }
        }
        //Rule : Self-transition is allowed only on Atomic State.
        if (allowConnect && sourceBO === targetBO && sourceBO.type !== 'atomic-state') {
            allowConnect = false;
        }
    }

    return allowConnect;
}

function canCreate(context, model) {
    var target = context.target,
        shape = context.shape;
    var allowCreate = true;

    if (allowCreate && typeof target !== 'undefined' && target !== null) {
        //Rule: Shape cannot be created on atomic-state, parallel-state and transition.
        if (
            target.businessObject.type === 'atomic-state' ||
            target.businessObject.type === 'parallel-state' ||
            target.businessObject.type === 'transition'
        ) {
            allowCreate = false;
        }
    }
    //Rule: There should be only one initial state.
    if (allowCreate && shape.type === 'atomic-state' && shape.businessObject.isInitial) {
        allowCreate = model.hasInitial(target.businessObject) ? false : true;
    }
    return allowCreate;
}

function canDelete(elements, model) {
    var shape, parent, children;
    if (elements.length === 1) {
        shape = elements[0];
        if (shape.type === 'region') {
            // dont delete region if <= 2
            parent = shape.parent;
            children = getChildRegions(parent);
            if (children.length <= 2) {
                return false;
            }
        }
        if (shape.isInitial === true) {
            model.resetInitialState(shape);
        }
    }
    return true;
}

function canAttach(elements, target, source/*, position*/) {
    var element;

    if (!Array.isArray(elements)) {
        elements = [elements];
    }

    // disallow appending as boundary event
    if (source) {
        return false;
    }

    // only (re-)attach one element at a time
    if (elements.length !== 1) {
        return false;
    }

    element = elements[0];

    // do not attach labels
    if (isLabel(element)) {
        return false;
    }

    // allow default move operation
    if (!target) {
        return true;
    }

    return true;
}

function canResize(shape) {
    var bo = shape.businessObject,
        type = bo.type;
    var retval = true;
    if (type === 'transition' || shape.type === 'label') {
        retval = false;
    }
    return retval;
}

function canInsert(shape, flow, position) {
    if (Array.isArray(shape)) {
        if (shape.length !== 1) {
            return false;
        }

        shape = shape[0];
    }

    // return true if we can drop on the
    // underlying flow parent
    //
    // at this point we are not really able to talk
    // about connection rules (yet)

    return isAny(flow, ['root', 'compound-state', 'parallel-state', 'region']) && canDrop(shape, flow.parent, position);
}

function canMove(model, context) {
    var shape = getShapeFromContext(context);
    var shapeBO = getBO(shape);
    var target = context.target;
    var targetBO = target ? getBO(target) : null,
        allowMove = true,
        hasInitial;


    //Rule : Movement of shape on root and within same parent is allowed. Movement of label is allowed.
    if (!target || shape.type === 'label' || checkWithinSameParent(shapeBO, targetBO)) {

        return true;
    }

    if (allowMove && targetBO.type === 'root' && shape.businessObject.parentId === null) {
        allowMove = true;
    }
    //   if (allowMove && shape.businessObject.type === 'atomic-state' && shape.businessObject.isInitial === true) {
    //Rule : There should be only one initial state.
    if (allowMove && shape.businessObject.isInitial === true) {
        hasInitial = model.hasInitial(targetBO);
        if (hasInitial) {
            context.errorMessage = 'There should be one initial state';
            allowMove = false;
        }
    }
    //Rule: Movement of region is not allowed.
    if (allowMove && shape.businessObject.type === 'region') {
        context.errorMessage = 'Region cannot be moved.';
        allowMove = false;
    }
    //Rule: Shape cannot be moved on transition, atomic-state or parallel-state.
    if (allowMove && targetBO.type === 'transition' || targetBO.type === 'atomic-state' || targetBO.type === 'parallel-state') {
        context.errorMessage = 'Invalid Target: ' + targetBO.type;
        allowMove = false;
    }
    //Rule: Shape can be moved on within the root.
    if (allowMove && targetBO.type === 'root' && shape.businessObject.parentId === null) {
        allowMove = true;
    }
    //Added to restrict region movement - extra check
    if (allowMove && shape.businessObject.type === targetBO.type && targetBO.type !== 'compound-state') {
        context.errorMessage = 'Invalid Target: ' + targetBO.type;
        allowMove = false;
    }

    return allowMove;
}
/**
 * Can an element be dropped into the target element
 *
 * @return {Boolean}
 */
function canDrop() {
    return true;
}

function hasAutoOutTransition(shape) {
    var isExists = false;

    forEach(shape.outgoing, function (item) {
        if (item.businessObject.isAuto) {
            isExists = true;
            return;
        }
    });
    return isExists;
}

function isLabel(element) {
    return element.type === 'label';
}

function getBO(target) {
    return target.businessObject;
}

function getShapeFromContext(context) {
    var shape = null;
    shape = typeof context.shapes === 'undefined' ? context.shape : context.shapes[0];
    return shape;
}

function checkWithinSameParent(shapeBO, targetBO) {
    var sameParent = false;
    if (targetBO.type === 'root' && shapeBO.parentId === null) {
        sameParent = true;
    }
    if (shapeBO.parentId === targetBO.id) {
        sameParent = true;
    }
    return sameParent;
}

function invalidSource(source) {

    if (!source || source.businessObject.type === 'root' || source.businessObject.type === 'transition' || source.businessObject.type === 'label' || source.businessObject.type === 'region' || source.type === 'label') {
        return true;
    }
    else {
        return false;
    }

}

function invalidTarget(target) {
    if (!target || target.businessObject.type === 'root' || target.businessObject.type === 'transition' || target.businessObject.type === 'label' || target.businessObject.type === 'region' || target.type === 'label') {
        return true;
    }
    else {
        return false;
    }
}
