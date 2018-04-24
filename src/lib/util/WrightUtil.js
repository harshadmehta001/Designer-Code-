'use strict';
var forEach = require('lodash/collection/forEach');

function WrightUtil(model) {
    var _model = model;

    function isDefined(obj) {
        var defined;
        try {
            defined = typeof obj !== 'undefined';
        } catch (e) {
            defined = false;
        }
        return defined;
    }

    function isUndefined(obj) {
        return !isDefined(obj);
    }

    function getBO(obj, skipBOCheck) {
        var bo;
        //optimization
        if (skipBOCheck) {
            bo = obj;
        } else {
            // *** importent *** obj can be shape or businessObject of shape, but we have to figure out and get BO.
            // this is a crucial piece of code. Don't change until you are 100% sure.
            // this  is optimized version and it takes care of all combinations
            if (
                isUndefined(obj) || // when obj is undefined', it is element and is root, because BO cant be undefined
                obj === null || // when obj is null, assume it is element and root.
                isUndefined(obj.type) || // when obj.type is undefined,  it is element and is root, because BO always has type
                (isDefined(obj.type) && obj.type === 'root')
            ) {
                // when obj.type is defined and is of type root, regardless of element or BO
                bo = _model; //when root assign model, regardless of obj is element or BO
            } else if (isDefined(obj.businessObject)) {
                // when obj is element and has business object
                bo = obj.businessObject; // assign BO, we have it.
            } else {
                // when object itself is BO
                bo = obj; // assign obj itself
            }
        }
        return bo; // return BO. we have resolved.
    }

    function ofType(obj, arr, skipBOCheck) {
        obj = getBO(obj, skipBOCheck);
        return arr.indexOf(obj.type) > -1;
    }

    function isLabel(obj, skipBOCheck) {
        return ofType(obj, ['label'], skipBOCheck);
    }

    function isAtomicState(obj, skipBOCheck) {
        return ofType(obj, ['atomic-state'], skipBOCheck);
    }

    function isCompoundState(obj, skipBOCheck) {
        return ofType(obj, ['compound-state'], skipBOCheck);
    }

    function isParallelState(obj, skipBOCheck) {
        return ofType(obj, ['parallel-state'], skipBOCheck);
    }

    function isRegion(obj, skipBOCheck) {
        return ofType(obj, ['region'], skipBOCheck);
    }

    function isTransition(obj, skipBOCheck) {
        return ofType(obj, ['transition', 'connection'], skipBOCheck);
    }

    function isRoot(obj, skipBOCheck) {
        return ofType(obj, ['root'], skipBOCheck);
    }

    function isState(obj, skipBOCheck) {
        return ofType(obj, ['atomic-state', 'compound-state', 'parallel-state', 'root'], skipBOCheck);
    }

    function isContainer(obj, skipBOCheck) {
        return ofType(obj, ['compound-state', 'region', 'root'], skipBOCheck);
    }

    function isParent(child, parent, skipBOCheck) {
        var isParentRoot, childBO, parentBO;
        if (!child) {
            // child is required.
            return false;
        }
        childBO = getBO(child, skipBOCheck);
        parentBO = getBO(parent, skipBOCheck);
        isParentRoot = isRoot(parentBO, true);
        if (childBO.parentId === null) {
            return isParentRoot;
        } else {
            // child.parentId is not null
            if (isParentRoot) {
                // parent is root
                // when parent is root then child.parentId must be null. (parent child mismatch)
                // model does not have id for root.
                return false;
            } else {
                // when parent is not root
                // if parent is either compound-state or region then compare child.parentId with parent.id.
                return childBO.parentId === parentBO.id;
            }
        }
    }

    function isValidDropTarget(targetObj, skipBOCheck) {
        return ofType(targetObj, ['compound-state', 'region', 'root'], skipBOCheck);
    }

    function isValidDragObject(Obj, skipBOCheck) {
        return ofType(Obj, ['compound-state', 'parallel-state', 'atomic-state', 'label'], skipBOCheck);
    }

    function isValidTransitionTarget(targetObj, skipBOCheck) {
        return ofType(targetObj, ['atomic-state', 'compound-state', 'parallel-state'], skipBOCheck);
    }

    function isValidTransitionSource(sourceObj, skipBOCheck) {
        return ofType(sourceObj, ['atomic-state', 'compound-state', 'parallel-state'], skipBOCheck);
    }

    function nonExistantOrLabel(obj, skipBOCheck) {
        return !obj || isLabel(obj, skipBOCheck);
    }

    function hasAutoOutTransition(obj, skipBOCheck) {
        var startExists = false;
        var bo = getBO(obj, skipBOCheck);
        if (isDefined(bo.outTransitionIds)) {
            forEach(bo.outTransitionIds, function (item) {
                if (_model.children[item].isInitial) {
                    startExists = true;
                    return;
                }
            });
        }
        return startExists;
    }

    function hasParentInitialStateId(parent, skipBOCheck) {
        var parentBO = getBO(parent, skipBOCheck);
        return isDefined(parentBO.initialStateId);
    }

    function getParent(obj, skipBOCheck) {
        var bo = getBO(obj, skipBOCheck);
        return bo.parentId === null ? _model : _model.children[bo.parentId];
    }

    function getParentInitialStateId(obj, skipBOCheck) {
        var parentBO, parentInitialStateId;
        parentBO = getParent(obj, skipBOCheck);
        if (isDefined(parentBO.initialStateId)) {
            parentInitialStateId = parentBO.initialStateId;
        }
        return parentInitialStateId;
    }

    function getLabel(obj, skipBOCheck) {
        var bo = getBO(obj, skipBOCheck);
        return bo.name || bo.action;
    }

    function getType(obj, skipBOCheck) {
        var bo = getBO(obj, skipBOCheck);
        return bo.type;
    }

    function setParentInitialStateId(child, parent, skipBOCheck) {
        var childBO, parentBO;
        childBO = getBO(child, skipBOCheck);
        parentBO = getBO(parent, skipBOCheck);
        if (isDefined(parentBO.initialStateId) && isDefined(parentBO.initialStateId)) {
            parentBO.initialStateId = childBO.id;
        }
    }

    return {
        getBO: getBO,
        isDefined: isDefined,
        isUndefined: isUndefined,
        isLabel: isLabel,
        isAtomicState: isAtomicState,
        isCompoundState: isCompoundState,
        isParallelState: isParallelState,
        isRegion: isRegion,
        isTransition: isTransition,
        isRoot: isRoot,
        isState: isState,
        isContainer: isContainer,
        isParent: isParent,
        isValidDropTarget: isValidDropTarget,
        isValidDragObject: isValidDragObject,
        isValidTransitionTarget: isValidTransitionTarget,
        isValidTransitionSource: isValidTransitionSource,
        nonExistantOrLabel: nonExistantOrLabel,
        hasAutoOutTransition: hasAutoOutTransition,
        hasParentInitialStateId: hasParentInitialStateId,
        getParent: getParent,
        getParentInitialStateId: getParentInitialStateId,
        getLabel: getLabel,
        getType: getType,
        setParentInitialStateId: setParentInitialStateId
    };
}
WrightUtil.$inject['model'];
module.exports.ShapeType = WrightUtil;