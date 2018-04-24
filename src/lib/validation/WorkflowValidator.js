'use strict';
var workflowModel;
var validate = require('./Validator');
var flatten = require('lodash/array/flatten');

var getConstraints = function (workflowModel) {
    return {
        'initialStateId': {
            optional: false,
            propertyName: 'Initial State',
            validators:
            [
                isNotNull,
                isString,
                isKnown(workflowModel),
                isInitial(true, workflowModel),
                hasParent(false, workflowModel),
                outTransitions({ 'minimum': 1 }, workflowModel)
            ]
        },
        'finalStateIds': {
            optional: false,
            propertyName: 'Final State',
            validators:
            [
                isNotNull,
                isArrayType('string'),
                finalStateCount({ 'minimum': 1 }),
                eachIsKnown(workflowModel),
                eachOfTypeState('atomic-state', workflowModel),
                eachIsFinal(true, workflowModel),
                eachHasParent(false, workflowModel)

            ]
        },
        'children': {
            optional: false,
            propertyName: 'Children',
            validators:
            [
                isNotNull,
                isType('object', workflowModel)
            ]
        },
        'transitions': {
            optional: false,
            propertyName: 'Transition',
            validators:
            [
                isNotNull
            ]
        }
    };
};

var getTransitionConstraints = function (workflowModel) {
    return {
        'isAuto': {
            optional: false,
            propertyName: 'Auto Transition',
            validators:
            [
                validIsAutoState('compound-state,parallel-state', workflowModel),
                shouldNotMaintainHistory
            ]
        },
        'type': {
            optional: false,
            propertyName: 'Transition Type'
        },
        'action': {
            optional: false,
            propertyName: 'Action',
            validators:
            [
                uniqueActionAndSourceStateIdIfNotRegion(workflowModel)
            ]
        },
        'withHistory': {
            optional: false,
            propertyName: 'Transition with History',
            validators:
            [
                isNotNull,
                isType('boolean', workflowModel),
                validTransitionHistoryAttribute(workflowModel),
            ]
        },
        'sourceStateId': {
            optional: false,
            propertyName: 'Source State',
            validators:
            [
                isNotNull,
                isString,
                isKnown(workflowModel),
                shouldNotBeCrossRegion(workflowModel),
                shouldNotBeOfType('region', workflowModel),
                shouldNotTransitToAncestor(workflowModel),
                shouldNotTransitFromAncestor(workflowModel)
            ]
        },
        'targetStateId': {
            optional: false,
            propertyName: 'Target State',
            validators:
            [
                isNotNull,
                isString,
                isKnown(workflowModel),
                shouldNotBeOfType('region', workflowModel),
            ]
        },

        'gfx': {
            optional: false,
            propertyName: 'Coordinates'
        }
    };
};

var getAtomicConstraints = function (workflowModel) {
    return {
        'type': {
            optional: false,
            propertyName: 'State Type'
        },
        'id': {
            optional: false,
            propertyName: 'State ID'
        },
        'key': {
            optional: false,
            propertyName: 'Key',
            validators: [
                isNotNull,
                isString,
                isEmpty,
                isUnique(workflowModel)
            ]
        },
        'name': {
            optional: false,
            propertyName: 'Name'
        },
        'parentId': {
            optional: false,
            propertyName: 'Parent'
        },
        'guard': {
            optional: false,
            propertyName: 'Guard'
        },
        'guardMessage': {
            optional: false,
            propertyName: 'Guard Message',
            validators: [

                ShouldNotBeEmptyIfGuardIsPresent,
            ]
        },
        'inTransitionIds': {
            optional: false,
            propertyName: 'Incoming Transition',
            validators:
            [
                isNotNull,
                isArrayType('string'),
                isKnownTransition(workflowModel),
                inTransitionCount({ 'minimum': 1 }, workflowModel),
                hasValidTarget(workflowModel)
            ]
        },
        'outTransitionIds': {
            optional: false,
            propertyName: 'Outgoing Transition',
            validators:
            [
                isNotNull,
                isArrayType('string'),
                isKnownTransition(workflowModel),
                hasValidSource(workflowModel)

            ]
        },
        'resetHistory': {
            optional: false,
            propertyName: 'Reset History'
        },
        'isInitial': {
            optional: false,
            propertyName: 'Is Initial'
        },
        'isFinal': {
            optional: false,
            propertyName: 'Is Final'
        },
        'gfx': {
            optional: false,
            propertyName: 'Coordinates'
        }
    };
};

var getCompoundConstraints = function (workflowModel) {
    return {
        'type': {
            optional: false,
            propertyName: 'State Type'
        },
        'id': {
            optional: false,
            propertyName: 'State ID'
        },
        'key': {
            optional: false,
            propertyName: 'Key',
            validators: [
                isNotNull,
                isString,
                isUnique(workflowModel)
            ]
        },
        'name': {
            optional: false,
            propertyName: 'Name'
        },

        'parentId': {
            optional: false,
            propertyName: 'Parent'
        },
        'guard': {
            optional: false,
            propertyName: 'Guard'
        },
        'guardMessage': {
            optional: false,
            propertyName: 'Guard Message',
            validators: [
                ShouldNotBeEmptyIfGuardIsPresent
            ]
        },
        'inTransitionIds': {
            optional: false,
            propertyName: 'Incoming Transition',
            validators:
            [
                isKnownTransition(workflowModel),
                hasValidTarget(workflowModel),
                shouldNotBeSelfLoop(workflowModel)

            ]
        },
        'outTransitionIds': {
            optional: false,
            propertyName: 'Outgoing Transition',
            validators:
            [
                isNotNull,
                isArrayType('string'),
                arrayLength({ 'minimum': 0 }),
                isKnownTransition(workflowModel),
                hasValidSource(workflowModel),
                and(hasFinalStates, hasAutoTransition, workflowModel)
            ]
        },
        'finalTransitionsToId': {
            optional: false,
            propertyName: 'Target State'
        },
        'tracksHistory': {
            optional: false,
            propertyName: 'History Tracking'
        },
        'initialStateId': {
            optional: false,
            propertyName: 'Initial State',
            validators:
            [
                isNotNull,
                isString,
                isKnown(workflowModel),
                isInitial(true, workflowModel),
                ofTypeState('atomic-state', workflowModel),
                hasParent(true, workflowModel),
                hasValidParent(workflowModel),
                outTransitions({ 'minimum': 1 }, workflowModel)

            ]
        },
        'finalStateIds': {
            optional: false,
            propertyName: 'Final State',
            validators:
            [
                isNotNull,
                isArrayType('string'),
                finalStateCount({ 'minimum': 0 }),
                eachIsKnown(workflowModel),
                eachIsFinal(true, workflowModel),
                eachOfTypeState('atomic-state', workflowModel),
                eachHasParent(true, workflowModel),
                eachHasValidParent(workflowModel)

            ]
        },
        'childIds': {
            optional: false,
            propertyName: 'Child',
            validators:
            [
                isNotNull,
                eachIsKnown(workflowModel),
                isArrayType('string'),
                arrayLength({ 'minimum': 1 }),
                eachHasParent(true, workflowModel),
                eachHasValidParent(workflowModel)
            ]
        },
        'isInitial': {
            optional: false,
            propertyName: 'Is Initial'
        },
        'gfx': {
            optional: false,
            propertyName: 'Coordinates'
        }
    };
};

var getParallelConstraints = function (workflowModel) {
    return {
        'type': {
            optional: false,
            propertyName: 'State Type'
        },
        'id': {
            optional: false,
            propertyName: 'State ID'
        },
        'key': {
            optional: false,
            propertyName: 'Key',
            validators: [
                isNotNull,
                isString,
                isUnique(workflowModel)
            ]
        },
        'name': {
            optional: false,
            propertyName: 'Name'
        },

        'parentId': {
            optional: false,
            propertyName: 'Parent'
        },
        'guard': {
            optional: false,
            propertyName: 'Guard'
        },
        'guardMessage': {
            optional: false,
            propertyName: 'Guard Message',
            validators: [
                ShouldNotBeEmptyIfGuardIsPresent
            ]
        },
        'inTransitionIds': {
            optional: false,
            propertyName: 'Incoming Transition',
            validators: [
                isKnownTransition(workflowModel),
                hasValidTarget(workflowModel),
                shouldNotBeSelfLoop(workflowModel)

            ]
        },
        'outTransitionIds': {
            optional: false,
            propertyName: 'Outgoing Transition',
            validators:
            [
                isNotNull,
                isArrayType('string'),
                isKnownTransition(workflowModel),
                isAutoCount(1, workflowModel),
                hasValidSource(workflowModel)
            ]
        },
        'finalTransitionsToId': {
            optional: false,
            propertyName: 'Target State',
            validators:
            [
                isNotNull,
                isString,
                isKnown(workflowModel)
            ]
        },
        'regionIds': {
            optional: false,
            propertyName: 'Region ID',
            validators:
            [
                isNotNull,
                isArrayType('string'),
                regionIdCount({ 'minimum': 2 }, workflowModel),
                eachIsKnown(workflowModel),
                eachHasParent(true, workflowModel),
                eachHasValidParent(workflowModel)
            ]
        },
        'isInitial': {
            optional: false,
            propertyName: 'Is Initial'
        },
        'gfx': {
            optional: false,
            propertyName: 'Coordinates'
        }
    };
};

var getRegionConstraints = function (workflowModel) {
    return {
        'type': {
            optional: false,
            propertyName: 'Type'
        },
        'id': {
            optional: false,
            propertyName: 'Region ID'
        },
        'key': {
            optional: false,
            propertyName: 'Key',
            validators: [
                isNotNull,
                isString,
                isUnique(workflowModel)
            ]
        },
        'name': {
            optional: false,
            propertyName: 'Name'
        },

        'parentId': {
            optional: false,
            propertyName: 'Parent'
        },
        'tracksHistory': {
            optional: false,
            propertyName: 'History Tracking'
        },
        'initialStateId': {
            optional: false,
            propertyName: 'Initial State',
            validators:
            [
                isNotNull,
                isString,
                isKnown(workflowModel),
                isInitial(true, workflowModel),
                ofTypeState('atomic-state', workflowModel),
                hasParent(true, workflowModel),
                hasValidParent(workflowModel),
                outTransitions({ 'minimum': 1 }, workflowModel)

            ]
        },
        'finalStateIds': {
            optional: false,
            propertyName: 'Final State',
            validators:
            [
                isNotNull,
                isArrayType('string'),
                finalStateCount({ 'minimum': 1 }),
                eachIsKnown(workflowModel),
                eachIsFinal(true, workflowModel),
                eachOfTypeState('atomic-state', workflowModel),
                eachHasParent(true, workflowModel),
                eachHasValidParent(workflowModel)

            ]
        },
        'childIds': {
            optional: false,
            propertyName: 'Children',
            validators:
            [
                isNotNull,
                eachIsKnown(workflowModel),
                isArrayType('string'),
                arrayLength({ 'minimum': 2 }),
                eachHasParent(true, workflowModel),
                eachHasValidParent(workflowModel)
            ]
        },
        'gfx': {
            optional: false,
            propertyName: 'Coordinates'
        }
    };
};

function getAllKeyAction(workflowModel) {
    var keyAction = [], sourceStateKey, action, transition;
    for (transition in workflowModel.transitions) {
        sourceStateKey = workflowModel.children[workflowModel.transitions[transition].sourceStateId].key;
        action = workflowModel.transitions[transition].action;
        keyAction.push(sourceStateKey + action);
    }
    return keyAction;
}

function uniqueActionAndSourceStateIdIfNotRegion(workflowModel) {
    return function checkUniqueActionAndSourceStateIdIfNotRegion(value, transitionBO, property, displayName, ownerObjectName) {
        var errors = [], sourceStateKey, error, keyAction = [], targetState, targetStateParent;
        keyAction = getAllKeyAction(workflowModel);
        targetState = getState(transitionBO.targetStateId, workflowModel);
        targetStateParent = getState(targetState.parentId, workflowModel);
        sourceStateKey = workflowModel.children[transitionBO.sourceStateId].key;
        if (targetStateParent) {
            if (keyAction.indexOf(sourceStateKey + value) !== -1 && targetStateParent.type !== 'region' ) {
                error = {
                    'target': transitionBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': 'Source State Key ' + sourceStateKey + ' and Action pair ' + value + ' should be unique in the WorkFlow.'
                };
                errors.push(error);
            }
        }
        else {
            error = {
                'target': transitionBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'Source State Key ' + sourceStateKey + ' and Action pair ' + value + ' should be unique in the WorkFlow.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function getKeys(workflowModel) {
    var childStateKeys = [], childState;
    for (childState in workflowModel.children) {
        if (workflowModel.children[childState].key !== null) {
            childStateKeys.push(workflowModel.children[childState].key);
        }
    }
    return childStateKeys;
}

function isUnique(workflowModel) {
    return function checkIsUnique(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error, count = 0, i;
        var allKeys = getKeys(workflowModel);
        for (i = 0; i < allKeys.length; i++) {
            if (allKeys[i] === value) {
                count++;
            }
        }
        if (count > 1) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': displayName + ' ' + ownerObjectName + ' should be unique.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function isNotNull(value, stateBO, property, displayName, ownerObjectName) {

    var errors = [], error;
    if (value === null) {
        error = {
            'target': stateBO,
            'key': property,
            'tag': ownerObjectName,
            'message': displayName + ' is mandatory in ' + ownerObjectName + '.'
        };
        errors.push(error);
    }
    return errors;
}

function isKnown(workflowModel) {
    return function checkIsknown(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error;
        var checkState = isKnownState(value, workflowModel);
        if (!checkState) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': displayName + ' does not exist in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function isKnownTransition(workflowModel) {
    return function checkIsKnownTransition(value, transitionBO, property, displayName, ownerObjectName) {
        var transition, errors = [], error, i;
        for (i = 0; i < value.length; i++) {
            transition = checkTransition(value[i], workflowModel);
            if (!transition) {
                error = {
                    'target': transitionBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': displayName + ' [' + value[i] + '] does not exist in ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function isString(value, stateBO, property, displayName, ownerObjectName) {

    var errors = [], error;
    if (typeof value !== 'string') {
        error = {
            'target': stateBO,
            'key': property,
            'tag': ownerObjectName,
            'message': displayName + 's value is not of type string in ' + ownerObjectName + '.'
        };
        errors.push(error);
    }
    return errors;
}

function isEmpty(value, stateBO, property, displayName, ownerObjectName) {

    var errors = [], error;

    if (/\S/.test(value) === false) {
        error = {
            'target': stateBO,
            'key': property,
            'tag': stateBO.key,
            'message': displayName + ' is mandatory ' + ownerObjectName + '.'
        };
        errors.push(error);
    }
    return errors;

}

function eachIsKnown(workflowModel) {
    return function checkEachIsKnown(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], checkState, i, error;
        for (i = 0; i < value.length; i++) {
            checkState = isKnownState(value[i], workflowModel);
            if (!checkState) {
                error = {
                    'target': stateBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': 'Not all ' + displayName + ' can be resolved in ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function isInitial(options, workflowModel) {
    return function checkIsInitial(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error, state;
        state = getState(value, workflowModel);
        if (state.isInitial !== options) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': state.key + ' is not marked as ' + displayName + ' in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function eachIsFinal(options, workflowModel) {
    return function checkEachIsFinal(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error;
        var i, state;
        for (i = 0; i < value.length; i++) {
            state = getState(value[i], workflowModel);
            if (state.isFinal !== true) {
                error = {
                    'target': stateBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': displayName + ' ' + state.key + ' is not marked as Final State in ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function hasParent(options, workflowModel) {

    return function checkHasParent(value, stateBO, property, displayName, ownerObjectName) {
        var flag = false, errors = [], error, state;
        state = getState(value, workflowModel);
        if (state.parentId === null || state.parentId === '') {
            flag = false;
        }
        else {
            flag = true;
        }
        if (flag !== options) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': state.key,
                'message': displayName + state.key + 'has invalid parent in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function ofTypeState(type, workflowModel) {

    return function checkOfTypeState(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error, state;
        state = getState(value, workflowModel);
        if (state.type !== type) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': displayName + 'is not of type ' + type + 'in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function outTransitions(options, workflowModel) {

    return function checkOutTransitions(value, stateBO, property, displayName, ownerObjectName) {

        var errors = [], error, state, count = 0, i;
        if (options.hasOwnProperty('minimum')) {
            state = getState(value, workflowModel);
            for (i = 0; i < state.outTransitionIds.length; i++) {
                if (workflowModel.transitions[state.outTransitionIds[i]].sourceStateId !== workflowModel.transitions[state.outTransitionIds[i]].targetStateId) {
                    count++;
                }
            }
            if (count < options.minimum) {
                error = {
                    'target': stateBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': 'Atleast ' + options.minimum + ' out transition is expected in ' + displayName + ' of ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        if (options.hasOwnProperty('maximum')) {
            if (state.outTransitionIds.length > options.maximum) {
                error = {
                    'target': stateBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': 'Atmost ' + options.maximum + ' out transition expected in ' + displayName + ' of ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function isArrayType(options) {

    return function checkIsArrayType(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error, i;
        if (Array.isArray(value) === true) {
            for (i = 0; i < value.length; i++) {
                if (typeof value[i] !== options) {
                    error = {
                        'target': stateBO,
                        'key': property,
                        'tag': workflowModel.children[value].key,
                        'message': displayName + 's value is not of type string in ' + ownerObjectName + '.'
                    };
                    errors.push(error);
                }
            }
        } else {
            error = {
                'target': stateBO,
                'key': property,
                'tag': workflowModel.children[value].key,
                'message': 'At least 1 ' + displayName + ' is expected in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function eachOfTypeState(options, workflowModel) {
    return function checkEachOfTypeState(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error, state, i;
        for (i = 0; i < value.length; i++) {
            state = getState(value[i], workflowModel);
            if (state.type !== options) {
                error = {
                    'target': stateBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': displayName + ' ' + state.key + ' is not of type ' + options + ' in ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function finalStateCount(options) {

    return function checkFinalStateCount(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error;
        if (value.length < options.minimum) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'At least ' + options.minimum + ' value of ' + displayName + ' is expected in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function eachHasParent(options, workflowModel) {

    return function checkEachHasParent(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], state, error, i, flag;
        for (i = 0; i < value.length; i++) {
            state = getState(value[i], workflowModel);
            if (state.parentId === null || state.parentId === '') {
                flag = false;
            }
            else {
                flag = true;
            }
            if (flag !== options) {

                error = {
                    'target': stateBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': displayName + ' ' + state.key + ' has invalid parent in ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function hasValidParent(workflowModel) {
    return function checkHasValidParent(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], state, error;
        state = getState(value, workflowModel);
        if (state.parentId !== stateBO.id) {

            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': displayName + ' has invalid parent in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };

}

function eachHasValidParent(workflowModel) {
    return function checkEachHasValidParent(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error, state, i;
        for (i = 0; i < value.length; i++) {
            state = getState(value[i], workflowModel);
            if (state.parentId !== stateBO.id) {
                error = {
                    'target': stateBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': displayName + ' ' + state.key + ' has invalid parent in ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function isType(options) {
    return function checkIsType(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error;
        if (typeof value !== options) {

            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': displayName + 's value is of unexpected type in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function inTransitionCount(options, workflowModel) {

    return function checkInTransitionCount(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error, i, transition, fromState, toState;
        if (value.length < options.minimum && stateBO.isInitial === false) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'At least ' + options.minimum + ' ' + displayName + ' excluding self transition is expected in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        if (value.length >= options.minimum && stateBO.isInitial === false) {
            for (i = 0; i < value.length; i++) {
                transition = workflowModel.transitions[value[i]];
                fromState = workflowModel.children[transition.sourceStateId];
                toState = workflowModel.children[transition.targetStateId];
                if (fromState === toState) {
                    error = {
                        'target': stateBO,
                        'key': property,
                        'tag': ownerObjectName,
                        'message': 'At least ' + options.minimum + ' ' + displayName + ' excluding self transition is expected in ' + ownerObjectName + '.'
                    };
                    errors.push(error);
                }
            }
        }
        return errors;
    };
}

function regionIdCount(options) {
    return function checkRegionIdCount(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error;
        if (value.length < options.minimum) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'At least ' + options.minimum + 'regions are expected in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function and(hasFinalStates, hasAutoTransition, workflowModel) {
    return function checkAnd(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error;
        if (hasFinalStates(stateBO) > 0 && hasAutoTransition(stateBO, workflowModel) !== 1) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'One Auto Transition is expected in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        if (hasFinalStates(stateBO) < 1 && hasAutoTransition(stateBO, workflowModel) === 1) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'Auto Transition is present without any Final State in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function isAutoCount(options, workflowModel) {

    return function checkIsAutoCount(value, stateBO, property, displayName, ownerObjectName) {
        var count = 0, errors = [], transition, i, error;
        for (i = 0; i < value.length; i++) {
            transition = workflowModel.transitions[value[i]];
            if (transition.isAuto === true) {
                count++;
            }
        }
        if (count !== options) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'One Auto Transition is expected in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function arrayLength(options) {
    return function checkArrayLength(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error;
        if (value.length < options.minimum) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'At least ' + options.minimum + ' ' + displayName + ' is expected in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function shouldNotBeCrossRegion(workflowModel) {

    return function checkShouldNotBeCrossRegion(value, transitionBO, property, displayName, ownerObjectName) {
        var errors = [];
        var fromId = transitionBO.sourceStateId;
        var toId = transitionBO.targetStateId;
        var fromState = workflowModel.children[fromId];
        var toState = workflowModel.children[toId];
        var error;
        var isCrossRegion = workflowModel.checkCrossRegion(fromState, toState);
        if (!isCrossRegion) {
            error = {
                'target': transitionBO,
                'key': property,
                'tag': ownerObjectName,
                'message': transitionBO.action + ' is  invalid as cross region transition is not valid within the same parallel ancestors.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function validTransitionHistoryAttribute(workflowModel) {

    return function checkValidTransitionHistoryAttribute(value, transitionBO, property, displayName, ownerObjectName) {
        var errors = [], error, state, validState;
        var regionId = [], count, i;
        if (value) {
            validState = isKnownState(transitionBO.targetStateId, workflowModel);
            if (validState) {
                state = getState(transitionBO.targetStateId, workflowModel);
                if (state.type === 'compound-state') {
                    if (state.tracksHistory !== true) {
                        error = {
                            'message': displayName + ' ' + ownerObjectName + ' is not allowed as ' + state.type + ' ' + state.key + ' does not track history.',
                            'target': transitionBO,
                            'key': property,
                            'tag': ownerObjectName
                        };
                        errors.push(error);
                    }
                }
                else if (state.type === 'parallel-state') {
                    regionId = state.regionIds;
                    count = 0;
                    for (i = 0; i < regionId.length; i++) {
                        if (workflowModel.children[regionId[i]].tracksHistory === true) {
                            count++;
                        }
                    }
                    if (count <= 0) {
                        error = {
                            'message': displayName + ' ' + ownerObjectName + ' is not allowed as ' + state.type + ' ' + state.key + ' does not track history.',
                            'target': transitionBO,
                            'key': property,
                            'tag': ownerObjectName
                        };
                        errors.push(error);
                    }
                }
                else {
                    error = {
                        'message': displayName + ' ' + ownerObjectName + ' is not allowed as ' + state.type + ' ' + state.key + ' does not track history.',
                        'target': transitionBO,
                        'key': property,
                        'tag': ownerObjectName
                    };
                    errors.push(error);
                }
            }
        }
        return errors;
    };
}

function shouldNotBeOfType(options, workflowModel) {
    return function checkShouldNotBeOfType(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], error;
        if (workflowModel.children[value].type === options) {
            error = {
                'target': stateBO,
                'key': property,
                'tag': ownerObjectName,
                'message': options + ' type is not allowed in ' + displayName + stateBO.key + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function hasValidSource(workflowModel) {
    return function checkHasValidSource(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], sourceStateId, error, i;

        for (i = 0; i < value.length; i++) {
            sourceStateId = workflowModel.transitions[value[i]].sourceStateId;
            if (sourceStateId !== stateBO.id) {
                error = {
                    'target': stateBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': ' Source State of the ' + workflowModel.transitions[value[i]].name + ' is not ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function hasValidTarget(workflowModel) {
    return function checkHasValidTarget(value, stateBO, property, displayName, ownerObjectName) {
        var errors = [], targetStateId, error, i;
        for (i = 0; i < value.length; i++) {
            targetStateId = workflowModel.transitions[value[i]].targetStateId;
            if (targetStateId !== stateBO.id) {
                error = {
                    'target': stateBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': 'Target State of the ' + workflowModel.transitions[value[i]].name + ' is not ' + ownerObjectName + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function hasFinalStates(stateBO) {

    return stateBO.finalStateIds.length;
}

function validIsAutoState(options, workflowModel) {
    return function checkValidIsAutoState(value, transitionBO, property, displayName, ownerObjectName) {
        var errors = [], state, error, stateTypes = [];

        if (value) {
            state = getState(transitionBO.sourceStateId, workflowModel);
            stateTypes = options.split(',');
            if (stateTypes.indexOf(state.type) < 0) {
                error = {
                    'target': transitionBO,
                    'key': property,
                    'tag': ownerObjectName,
                    'message': 'Auto transition is not allowed from ' + state.key + ' of type ' + state.type + '.'
                };
                errors.push(error);
            }
        }
        return errors;
    };
}

function shouldNotMaintainHistory(value, transitionBO, property, displayName, ownerObjectName) {

    var errors = [], state, error;

    if (value) {
        if (transitionBO.isAuto && transitionBO.withHistory) {
            error = {
                'target': transitionBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'Auto transition is not allowed when ' + state.key + ' tracks history.'
            };
            errors.push(error);
        }
    }
    return errors;
}

function hasAutoTransition(stateBO, workflowModel) {
    var count = 0, i;
    for (i = 0; i < stateBO.outTransitionIds.length; i++) {
        if (workflowModel.transitions[stateBO.outTransitionIds[i]].isAuto === true) {
            count++;
        }
    }
    return count;
}

function shouldNotBeSelfLoop(workflowModel) {
    return function checkShouldNotBeSelfLoop(value, stateBO, property, displayName, ownerObjectName) {
        var error, errors = [], validTransition, i;
        for (i = 0; i < value.length; i++) {
            validTransition = checkTransition(value[i], workflowModel);
            if (validTransition) {
                if (workflowModel.transitions[value[i]].sourceStateId === workflowModel.transitions[value[i]].targetStateId) {
                    error = {
                        'target': stateBO,
                        'key': property,
                        'tag': ownerObjectName,
                        'message': 'Self loop is not allowed on state of type ' + stateBO.type + ' in ' + ownerObjectName + '.'
                    };
                    errors.push(error);
                }
            }
        }
        return errors;
    };
}

function shouldNotTransitToAncestor(workflowModel) {
    return function checkShouldNotTransitToAncestor(value, transitionBO, property, displayName, ownerObjectName) {

        var sourceState = getState(value, workflowModel);
        var targetState = getState(transitionBO.targetStateId, workflowModel);
        var isTransitionToAncestor = workflowModel.checkTransitionToAncestor(sourceState, targetState);
        var error, errors = [];
        if (!isTransitionToAncestor) {
            error = {
                'target': transitionBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'Transition to ancestor is not allowed in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function shouldNotTransitFromAncestor(workflowModel) {
    return function checkShouldNotTransitFromAncestor(value, transitionBO, property, displayName, ownerObjectName) {

        var sourceState = getState(value, workflowModel);
        var targetState = getState(transitionBO.targetStateId, workflowModel);
        var isTransitionToAncestor = workflowModel.checkTransitionFromAncestor(sourceState, targetState);
        var error, errors = [];
        if (!isTransitionToAncestor) {
            error = {
                'target': transitionBO,
                'key': property,
                'tag': ownerObjectName,
                'message': 'Transition from ancestor is not allowed in ' + ownerObjectName + '.'
            };
            errors.push(error);
        }
        return errors;
    };
}

function isKnownState(stateId, workflowModel) {
    if (typeof (workflowModel.children[stateId]) !== 'undefined') {
        return true;
    }
    else {
        return false;
    }
}

function checkTransition(transitionId, workflowModel) {
    if (typeof (workflowModel.transitions[transitionId]) !== 'undefined') {
        return true;
    }
    else {
        return false;
    }
}

function getState(stateId, workflowModel) {
    return workflowModel.children[stateId];
}

function ShouldNotBeEmptyIfGuardIsPresent(value, stateBO, property, displayName, ownerObjectName) {
    var error, errors = [], guard, guardMessage;

    guard = stateBO['guard'];
    guardMessage = stateBO['guardMessage'];
    if ((/\S/.test(guard)) && (/\S/.test(guardMessage)) === false || (guard !== null && guardMessage === null)) {

        error = {
            'target': stateBO,
            'key': property,
            'tag': stateBO.key,
            'message': displayName + 'is mandatory as guard is defined in ' + ownerObjectName + '.'
        };
        errors.push(error);

    }

    return errors;
}

module.exports = function (workflowModel) {
    var errors = [], childStateKey, transition, myError = [];
    var workflowConstraints, transitionConstraints;
    var constraints, stateKey, key, action, transitionAction;

    workflowConstraints = getConstraints(workflowModel);
    myError = validate(workflowModel, workflowConstraints, 'workflow');
    if (myError.length > 0) {
        errors.push(myError);
    }

    for (childStateKey in workflowModel.children) {
        constraints = getStateConstraints(workflowModel.children[childStateKey].type, workflowModel);
        key = workflowModel.children[childStateKey].key;
        if (key) {
            stateKey = key;
        }
        else {
            stateKey = workflowModel.children[childStateKey].type;
        }
        myError = validate(workflowModel.children[childStateKey], constraints, stateKey);
        if (myError.length > 0) {
            errors.push(myError);
        }
    }

    transitionConstraints = getTransitionConstraints(workflowModel);
    for (transition in workflowModel.transitions) {
        action = workflowModel.transitions[transition].action;
        if (action) {
            transitionAction = action;
        }
        else {
            transitionAction = 'Transition';
        }
        myError = validate(workflowModel.transitions[transition], transitionConstraints, transitionAction);
        if (myError.length > 0) {
            errors.push(myError);
        }
    }

    return flatten(errors, true);
};

function getStateConstraints(modelType, workflowModel) {
    if (modelType === 'atomic-state') {
        return getAtomicConstraints(workflowModel);
    }
    if (modelType === 'compound-state') {
        return getCompoundConstraints(workflowModel);
    }
    if (modelType === 'parallel-state') {
        return getParallelConstraints(workflowModel);
    }
    if (modelType === 'region') {
        return getRegionConstraints(workflowModel);
    }

    return null;
}