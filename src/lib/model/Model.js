'use strict';

var Ids = require('ids'),
    BaseModel = require('diagram-js/lib/Model'),
    assign = require('lodash/object/assign'),
    reduce = require('lodash/collection/reduce'),
    map = require('lodash/collection/map'),
    forEach = require('lodash/collection/forEach'),
    flatten = require('lodash/array/flatten'),
    inherits = require('inherits');

var Collections = require('diagram-js/lib/util/Collections');

function Model() {
    this.ids = new Ids([32, 36, 1]);
    this.type = 'root';
    this.isViewer = false;
    this.children = {};
    this.transitions = {};
    this.initialStateId = null;
    this.finalStateIds = [];
}

module.exports = Model;

Model.prototype.create = function (type, attr) {
    var self = this;
    function createType(Type, attr) {
        var item = assign(new Type(), attr);
        item.id = self.ids.nextPrefixed(item.type, item);

        if (item.type === 'transition') {
            self.transitions[item.id] = item;
            if (item.isAuto === true) {
                item.action = 'Auto';
            }
        } else if (item.type === 'atomic-state') {
            if (item.state === 'start') {
                item.isInitial = true;
            } else if (item.state === 'final') {
                item.isFinal = true;
            }
        }

        return item;
    }

    switch (type) {
        case 'atomic-state':
            return createType(AtomicState, attr);

        case 'compound-state':
            return createType(CompoundState, attr);

        case 'transition':
            return createType(Transition, attr);

        case 'parallel-state':
            return createType(ParallelState, attr);

        case 'region':
            return createType(Region, attr);
        default:
            return BaseModel.create(type, attr);
    }
};

Model.prototype.setState = function (state) {
    this.children[state.id] = state;
};

Model.prototype.removeState = function (state) {
    var parent;
    if (state.type === 'transition') {
        return;
    }

    // remove from parent
    if (state.parentId) {
        parent = this.children[state.parentId];

        if (parent && (parent.type === 'region' || parent.type === 'compound-state')) {
            Collections.remove(parent.childIds, state.id);
        } else if (state.type === 'region') {
            Collections.remove(parent.regionIds, state.id);
        }

        if (state.isFinal === true) {
            Collections.remove(parent.finalStateIds, state.id);
        }
    }
    else if (state.isFinal === true) {
        Collections.remove(this.finalStateIds, state.id);
    }
    delete this.children[state.id];
};

Model.prototype.setTransition = function (transition) {
    this.transitions[transition.id] = transition;
};

Model.prototype.setInitialStateId = function (id) {
    this.initialStateId = id;
};

Model.prototype.addFinalStateId = function (id) {
    Collections.add(this.finalStateIds, id);
};

Model.prototype.updateParent = function (state, newParent, oldParent) {
    var oldElements, newElements;
    if (oldParent === newParent) {
        return;
    }

    oldElements = oldParent && oldParent.childIds;
    newElements = newParent && newParent.childIds;

    if (oldElements) {
        Collections.remove(oldElements, state.id);
    }

    if (newElements) {
        Collections.add(newElements, state.id);
    }

    if (state.isFinal) {
        if (newParent && newParent.finalStateIds) {
            Collections.add(newParent.finalStateIds, state.id);
        }

        if (oldParent && oldParent.finalStateIds) {
            Collections.remove(oldParent.finalStateIds, state.id);
        }
    }

    if (state.type === 'region' && newParent) {
        Collections.add(newParent.regionIds, state.id);
    }
    if (newParent.type === 'root') {
        state.parentId = null;
    } else {
        state.parentId = newParent && newParent.id;
    }
};

Model.prototype.updateTransition = function (transition, newSourceId, newTargetId) {
    var oldSource, oldTarget, newSource, newTarget;

    if (newSourceId) {
        if (transition.sourceStateId !== newSourceId) {
            oldSource = this.children[transition.sourceStateId];
            if (oldSource) {
                Collections.remove(oldSource.outTransitionIds, transition.id);
            }
            newSource = this.children[newSourceId];
            Collections.add(newSource.outTransitionIds, transition.id);
        }
        transition.sourceStateId = newSourceId;
    }

    if (newTargetId) {
        if (transition.targetStateId !== newTargetId) {
            oldTarget = this.children[transition.targetStateId];
            if (oldTarget) {
                Collections.remove(oldTarget.inTransitionIds, transition.id);
            }
            newTarget = this.children[newTargetId];
            Collections.add(newTarget.inTransitionIds, transition.id);
        }
        transition.targetStateId = newTargetId;
    }
    if (transition.isAuto) {
        if (newSource && newTarget) { // new transition
            newSource.finalTransitionsToId = newTarget.id;
        } else if (oldSource && newSource) { // source changing
            newSource.finalTransitionsToId = oldSource.finalTransitionsToId;
            oldSource.finalTransitionsToId = null;
        } else if (oldTarget && newTarget) { // target changing
            newTarget.finalTransitionsToId = oldTarget.finalTransitionsToId;
            oldTarget.finalTransitionsToId = null;
        } else {
            // do nothing
        }
    }

    this.transitions[transition.id] = transition;
};

Model.prototype.removeTransition = function (transition) {
    var oldSource, oldTarget;

    oldSource = this.children[transition.sourceStateId];
    if (oldSource) {
        Collections.remove(oldSource.outTransitionIds, transition.id);
        // In case transition=auto its source which stores finalTransitionsToId. (source.finalTransitionsToId-target.id)
        // so we only remove from source
        if (transition.isAuto) {
            oldSource.finalTransitionsToId = null;
        }
    }
    oldTarget = this.children[transition.targetStateId];
    if (oldTarget) {
        Collections.remove(oldTarget.inTransitionIds, transition.id);
    }

    delete this.transitions[transition.id];
};

Model.prototype.ancestors = function (state) {
    var item = state,
        parent,
        result = [];
    while (item.parentId) {
        parent = this.children[item.parentId];
        result.push(parent);
        item = parent;
    }

    return result;
};

Model.prototype.descendants = function (state) {
    var result = [];

    result = reduce(
        state.children,
        function (acc, state) {
            var children = map(state, function (s) {
                return this.children[s.id];
            });
            acc.push(children);

            forEach(children, function (c) {
                acc.push(this.descendants(c));
            });
        },
        []
    );

    return flatten(result, true);
};

Model.prototype.getFromStateAncestors = function (fromState) {
    var fromAncestors = [],
        tempFromState;
    while (fromState.parentId !== null) {
        if (this.children[fromState.parentId] !== 'undefined') {
            tempFromState = this.children[fromState.parentId];
            if (tempFromState.type === 'parallel-state' || tempFromState.type === 'region') {
                fromAncestors.push(fromState.parentId);
            }
            fromState = tempFromState;
        }
    }
    return fromAncestors;
};

Model.prototype.getToStateAncestors = function (toState) {
    var toAncestors = [], tempToState;
    while (toState.parentId !== null) {
        if (this.children[toState.parentId] !== 'undefined') {
            tempToState = this.children[toState.parentId];
            if (tempToState.type === 'parallel-state' || tempToState.type === 'region') {
                toAncestors.push(toState.parentId);
            }
            toState = tempToState;
        }
    }
    return toAncestors;
};

Model.prototype.checkCrossRegion = function (sourceBO, targetBO) {
    var fromAncestors = this.getFromStateAncestors(sourceBO);
    var toAncestors = this.getToStateAncestors(targetBO);
    var i, j;
    for (i = 0; i < fromAncestors.length; i++) {
        for (j = 0; j < toAncestors.length; j++) {
            if (fromAncestors[i] === toAncestors[j]) {
                if (fromAncestors[i - 1] !== toAncestors[j - 1]) {
                    return false;
                } else {
                    return true;
                }
            }
        }
    }
    return true;
};

Model.prototype.checkTransitionToAncestor = function (sourceBO, targetBO) {
    var sourceStateAcestors = [];
    while (sourceBO.parentId !== null) {
        sourceStateAcestors.push(sourceBO.parentId);
        sourceBO = this.children[sourceBO.parentId];
    }
    if (sourceStateAcestors.indexOf(targetBO.id) !== -1) {
        return false;
    } else {
        return true;
    }
};

Model.prototype.checkTransitionFromAncestor = function (sourceBO, targetBO) {
    var targetStateAcestors = [];
    while (targetBO.parentId !== null) {
        targetStateAcestors.push(targetBO.parentId);
        targetBO = this.children[targetBO.parentId];
    }
    if (targetStateAcestors.indexOf(sourceBO.id) !== -1) {
        return false;
    } else {
        return true;
    }
};

Model.prototype.getAncestors = function (stateBO) {
    var ancestors = [];
    while (stateBO.parentId !== null) {
        ancestors.push(stateBO.parentId);
        stateBO = this.children[stateBO.parentId];
    }
    return ancestors;
};


Model.prototype.unsetWorkflowInitialState = function () {
    this.initialStateId = null;
};

Model.prototype.getStateById = function (id) {
    return this.children[id];
};

Model.prototype.getTransitionById = function (id) {
    return this.transitions[id];
};

Model.prototype.getModelData = function () {
    return {
        initialStateId: this.initialStateId,
        finalStateIds: this.finalStateIds,
        children: this.children,
        transitions: this.transitions
    };
};

Model.prototype.hasInitial = function (targetBO) {
    var bo = targetBO || this;
    return bo.initialStateId ? true : false;
};

Model.prototype.updateInitialState = function (state, newInitialState) {
    if (state.type === 'root' && !this.initialStateId) {
        this.initialStateId = newInitialState.id;
        newInitialState.parentId = null;
    } else {
        state.initialStateId = newInitialState.id;
    }
};

Model.prototype.resetInitialState = function (state) {
    if (typeof state.parentId === 'undefined' || state.parentId === null) {
        this.initialStateId = null;
    } else {
        this.children[state.parentId].initialStateId = null;
    }
};

Model.prototype.withinSameParentIfFinal = function (sourceBO, targetBO) {
    var targetAncestors = this.getAncestors(targetBO);
    if (targetAncestors.indexOf(sourceBO.parentId) !== -1) {
        return true;
    }
    else {
        return false;
    }
};

function BaseState() {
    this.key = null;
    this.name = null;
    this.parentId = null;
    this.guard = null;
    this.guardMessage = null;
    this.inTransitionIds = [];
    this.outTransitionIds = [];
    this.gfx = {};
    this.isInitial = false;
}

function AtomicState() {
    BaseState.call(this);
    this.type = 'atomic-state';
    this.resetHistory = false;
    this.isFinal = false;
}

inherits(AtomicState, BaseState);

function CompoundState() {
    BaseState.call(this);
    this.type = 'compound-state';
    this.finalTransitionsToId = null;
    this.tracksHistory = false;
    this.initialStateId = null;
    this.finalStateIds = [];
    this.childIds = [];
}
inherits(CompoundState, BaseState);

function ParallelState() {
    BaseState.call(this);
    this.type = 'parallel-state';
    this.finalTransitionsToId = null;
    this.regionIds = [];
}
inherits(ParallelState, BaseState);

function Region() {
    this.type = 'region';
    this.key = null;
    this.name = null;
    this.parentId = null;
    this.tracksHistory = false;
    this.initialStateId = null;
    this.finalStateIds = [];
    this.childIds = [];
    this.gfx = {};
}

function Transition() {
    this.type = 'transition';
    this.action = null;
    this.sourceStateId = null;
    this.targetStateId = null;
    this.withHistory = false;
    this.isAuto = false;
    this.gfx = { labelVisible: true };
}
