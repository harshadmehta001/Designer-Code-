(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.wrightjs = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports.Modeler = require('./lib/Modeler');
module.exports.Viewer = require('./lib/Viewer');

},{"./lib/Modeler":4,"./lib/Viewer":5}],2:[function(require,module,exports){
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

},{"diagram-js/lib/Model":55,"diagram-js/lib/util/Collections":167,"ids":190,"inherits":191,"lodash/array/flatten":193,"lodash/collection/forEach":204,"lodash/collection/map":206,"lodash/collection/reduce":207,"lodash/object/assign":328}],3:[function(require,module,exports){
'use strict';
module.exports = require('./Model');

},{"./Model":2}],4:[function(require,module,exports){
'use strict';

var inherits = require('inherits');

var Viewer = require('./Viewer');

var Validate = require('./validation/WorkflowValidator');

/**
 * A modeler for WrightJS diagrams.
 *
 *
 * ## Extending the Modeler
 *
 * In order to extend the viewer pass extension modules to bootstrap via the
 * `additionalModules` option. An extension module is an object that exposes
 * named services.
 *
 * The following example depicts the integration of a simple
 * logging component that integrates with interaction events:
 *
 *
 * ```javascript
 *
 * // logging component
 * function InteractionLogger(eventBus) {
 *   eventBus.on('element.hover', function(event) {
 *     console.log()
 *   })
 * }
 *
 * InteractionLogger.$inject = [ 'eventBus' ]; // minification save
 *
 * // extension module
 * var extensionModule = {
 *   __init__: [ 'interactionLogger' ],
 *   interactionLogger: [ 'type', InteractionLogger ]
 * };
 *
 * // extend the viewer
 * var wrightModeler = new Modeler({ additionalModules: [ extensionModule ] });
 * wrightModeler.importXML(...);
 * ```
 *
 *
 * ## Customizing / Replacing Components
 *
 * You can replace individual diagram components by redefining them in override modules.
 * This works for all components, including those defined in the core.
 *
 * Pass in override modules via the `options.additionalModules` flag like this:
 *
 * ```javascript
 * function CustomContextPadProvider(contextPad) {
 *
 *   contextPad.registerProvider(this);
 *
 *   this.getContextPadEntries = function(element) {
 *     // no entries, effectively disable the context pad
 *     return {};
 *   };
 * }
 *
 * CustomContextPadProvider.$inject = [ 'contextPad' ];
 *
 * var overrideModule = {
 *   contextPadProvider: [ 'type', CustomContextPadProvider ]
 * };
 *
 * var wrightModeler = new Modeler({ additionalModules: [ overrideModule ]});
 * ```
 *
 * @param {Object} [options] configuration options to pass to the viewer
 * @param {DOMElement} [options.container] the container to render the viewer in, defaults to body.
 * @param {String|Number} [options.width] the width of the viewer
 * @param {String|Number} [options.height] the height of the viewer
 * @param {Object} [options.modelExtensions] extension packages to provide
 * @param {Array<didi.Module>} [options.modules] a list of modules to override the default modules
 * @param {Array<didi.Module>} [options.additionalModules] a list of modules to use with the default modules
 */
function Modeler(options) {

    Viewer.call(this, options, false);

    // hook ID collection into the modeler
    this.on(
        'import.parse.complete',
        function(event) {
            if (!event.error) {
                this._collectIds(event.definitions, event.context);
            }
        },
        this
    );

    this.on(
        'diagram.destroy',
        function() {
            this.model.ids.clear();
        },
        this
    );
}

inherits(Modeler, Viewer);

module.exports = Modeler;

module.exports.Viewer = Viewer;

Modeler.prototype.import = function(model) {
    Viewer.prototype.import.call(this, model, null, null);
};

Modeler.prototype.validate = function(){
    var model = Viewer.prototype.getModel.call(this);
    var result = Validate(model);

    return result;
};

Modeler.prototype._interactionModules = [
    // non-modeling components
    //require('diagram-js/lib/navigation/movecanvas'),
    require('diagram-js/lib/navigation/touch'),
    //require('diagram-js/lib/navigation/zoomscroll'),
    //require('./property')
];

Modeler.prototype._modelingModules = [
    // modeling components
    //require('diagram-js/lib/features/auto-scroll'),
    require('diagram-js/lib/features/bendpoints'),
    require('diagram-js/lib/features/move'),
    require('diagram-js/lib/features/resize'),
    require('diagram-js/lib/features/ordering/OrderingProvider'),
    require('./features/contextpad'),
    require('./features/palette'),
    require('./features/snapping'),
    require('./features/ordering'),
    //require('./property')
];

// modules the modeler is composed of
//
// - viewer modules
// - interaction modules
// - modeling modules

Modeler.prototype._modules = [].concat(
    Modeler.prototype._modules,
    Modeler.prototype._interactionModules,
    Modeler.prototype._modelingModules
);

},{"./Viewer":5,"./features/contextpad":29,"./features/ordering":31,"./features/palette":33,"./features/snapping":36,"./validation/WorkflowValidator":45,"diagram-js/lib/features/bendpoints":76,"diagram-js/lib/features/move":121,"diagram-js/lib/features/ordering/OrderingProvider":122,"diagram-js/lib/features/resize":135,"diagram-js/lib/navigation/touch":164,"inherits":191}],5:[function(require,module,exports){
/**
 * The code in the <project-logo></project-logo> area
 * must not be changed.
 */
'use strict';

var assign = require('lodash/object/assign'),
    omit = require('lodash/object/omit'),
    isNumber = require('lodash/lang/isNumber');

var domify = require('min-dom/lib/domify'),
    domQuery = require('min-dom/lib/query'),
    domRemove = require('min-dom/lib/remove');

var Diagram = require('diagram-js'), Model = require('./Model');

var inherits = require('inherits');

var Importer = require('./import/wrightImporter');

var filter = require('lodash/collection/filter');

var DEFAULT_OPTIONS = {
    zoomScroll: { enabled: false },
    width: '5000px',
    height: '5000px'
};

/**
 * Ensure the passed argument is a proper unit (defaulting to px)
 */
function ensureUnit(val) {
    return val + (isNumber(val) ? 'px' : '');
}

function Viewer(options, isView) {

    var isViewer = true;
    if (typeof isView !== 'undefined') {
        isViewer = isView;
    }

    options = assign({}, DEFAULT_OPTIONS, options);

    this.model = this.createModel(isViewer);
    this.container = this._createContainer(options);

    this._init(this.container, this.model, options);
}

inherits(Viewer, Diagram);

module.exports = Viewer;

Viewer.prototype.getModules = function () {
    return this._modules;
};

/**
 * Destroy the viewer instance and remove all its
 * remainders from the document tree.
 */
Viewer.prototype.destroy = function () {
    // diagram destroy
    Diagram.prototype.destroy.call(this);

    // dom detach
    domRemove(this.container);
};

/**
 * Register an event listener
 *
 * Remove a previously added listener via {@link #off(event, callback)}.
 *
 * @param {String} event
 * @param {Number} [priority]
 * @param {Function} callback
 * @param {Object} [that]
 */
Viewer.prototype.on = function (event, priority, callback, target) {
    return this.get('eventBus').on(event, priority, callback, target);
};

/**
 * De-register an event listener
 *
 * @param {String} event
 * @param {Function} callback
 */
Viewer.prototype.off = function (event, callback) {
    this.get('eventBus').off(event, callback);
};

Viewer.prototype.attachTo = function (parentNode) {
    var container;
    if (!parentNode) {
        throw new Error('parentNode required');
    }

    // ensure we detach from the previous, old parent
    this.detach();

    // unwrap jQuery if provided
    if (parentNode.get && parentNode.constructor.prototype.jquery) {
        parentNode = parentNode.get(0);
    }

    if (typeof parentNode === 'string') {
        parentNode = domQuery(parentNode);
    }

    container = this._container;

    parentNode.appendChild(container);

    this._emit('attach', {});
};

Viewer.prototype.detach = function () {
    var container = this._container, parentNode = container.parentNode;

    if (!parentNode) {
        return;
    }

    this._emit('detach', {});

    parentNode.removeChild(container);
};

Viewer.prototype._init = function (container, model, options) {
    var baseModules, additionalModules, staticModules, diagramModules, diagramOptions;
    this._container = container;
    baseModules = options.modules || this.getModules();
    additionalModules = options.additionalModules || [];
    staticModules = [
        {
            model: ['value', model]
        }
    ];

    diagramModules = [].concat(staticModules, baseModules, additionalModules);

    diagramOptions = assign(omit(options, 'additionalModules'), {
        canvas: assign({}, options.canvas, { container: container }),
        modules: diagramModules
    });

    // invoke diagram constructor
    Diagram.call(this, diagramOptions);

    if (options && options.container) {
        this.attachTo(options.container);
    }
};

/**
 * Emit an event on the underlying {@link EventBus}
 *
 * @param  {String} type
 * @param  {Object} event
 *
 * @return {Object} event processing result (if any)
 */
Viewer.prototype._emit = function (type, event) {
    return this.get('eventBus').fire(type, event);
};

Viewer.prototype._createContainer = function (options) {

    var container = domify('<div class="bjs-container"></div>');

    assign(container.style, {
        width: ensureUnit(options.width),
        height: ensureUnit(options.height),
        position: options.position
    });

    return container;
};

Viewer.prototype.createModel = function (isViewer) {
    var model = new Model();
    model.isViewer = isViewer;

    return model;
};

// modules the viewer is composed of
Viewer.prototype._modules = [
    require('./core'),
    require('diagram-js/lib/i18n/translate'),
    //require('diagram-js/lib/features/selection'),
    require('diagram-js/lib/features/overlays')
];

// default model extensions the viewer is composed of
Viewer.prototype._modelExtensions = {};
/*
Viewer.prototype._navigationModules = [
    require('diagram-js/lib/navigation/zoomscroll'),
    require('diagram-js/lib/navigation/movecanvas')
];

Viewer.prototype._modules = [].concat(Viewer.prototype._modules, Viewer.prototype._navigationModules);
*/

function updateDefinitions(definitions, executedStates, options) {
    var esIndex, currentExecuted, fromState, result,toState;
    for (esIndex = 0; esIndex < executedStates.length; esIndex++) {

        currentExecuted = executedStates[esIndex];

        fromState = filter(definitions.children, { key: currentExecuted.FromState });
        toState  = filter(definitions.children, { key: currentExecuted.ToState });
        result = filter(definitions.transitions, { action: currentExecuted.Action, sourceStateId: fromState[0].id });

        if (fromState.length > 0) {
            if (fromState[0].type === 'atomic-state') {
                fromState[0].gfx.color = options.ExecutedStateColor;
            }
            if (currentExecuted.IsActiveState) {
                filter(definitions.children, { key: currentExecuted.ToState })[0].gfx.color = options.ActiveStateColor;
            }
        }
        if (result.length > 0) {
            result[0].gfx.color = options.TransitionColor;
        }
        if (toState.length > 0) {
            if (toState[0].type === 'atomic-state') {
                toState[0].gfx.color = options.ExecutedStateColor;
            }
            if (currentExecuted.IsActiveState) {
                filter(definitions.children, { key: currentExecuted.ToState })[0].gfx.color = options.ActiveStateColor;
            }
        }
    }
}

Viewer.prototype.import = function (modelData, executedStates, options) {

    if (this.definitions) {
        // clear existing rendered diagram
        this.clear();
    }

    // update definitions
    this.definitions = modelData;

    if (executedStates && options) {
        updateDefinitions(this.definitions, executedStates, options);
    }

    Importer = this.get('wrightImporter');
    Importer.import(this.definitions);
};

Viewer.prototype.export = function () {
    return this.model.getModelData();
};

Viewer.prototype.getModel = function () {
    return this.model;
};


},{"./Model":3,"./core":27,"./import/wrightImporter":39,"diagram-js":53,"diagram-js/lib/features/overlays":126,"diagram-js/lib/i18n/translate":157,"inherits":191,"lodash/collection/filter":202,"lodash/lang/isNumber":322,"lodash/object/assign":328,"lodash/object/omit":332,"min-dom/lib/domify":343,"min-dom/lib/query":346,"min-dom/lib/remove":347}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign'),
    map = require('lodash/collection/map'),
    pick = require('lodash/object/pick'),
    inherits = require('inherits');

var BaseElementFactory = require('diagram-js/lib/core/ElementFactory'),
    LabelUtil = require('../util/LabelUtil'),
    PARALLEL_TOP_MARGIN = require('../util/RegionUtil').PARALLEL_TOP_MARGIN,
    PARALLEL_BOTTOM_MARGIN = require('../util/RegionUtil').PARALLEL_BOTTOM_MARGIN,
    REGION_INDENTATION = require('../util/RegionUtil').REGION_INDENTATION;

/**
 * A Custom factory for diagram-js shapes
 * 
 * @param{Model} model
 * @param{Translate} translate
 */
function ElementFactory(model, translate, outline) {

    BaseElementFactory.call(this);

    this._model = model;
    this._translate = translate;
    outline.offset = 1; // offset for selection box on hover and select 
}

ElementFactory.$inject = ['model', 'translate', 'outline'];

inherits(ElementFactory, BaseElementFactory);

ElementFactory.prototype.baseCreate = BaseElementFactory.prototype.create;

module.exports = ElementFactory;

ElementFactory.prototype.create = function(elementType, attrs) {

    if (elementType === 'label') {
        return this.baseCreate(elementType, assign({ type: 'label' }, LabelUtil.DEFAULT_LABEL_SIZE, attrs));
    }

    return this.createElement(elementType, attrs);
};

ElementFactory.prototype.createElement = function(elementType, attrs) {
    var size, businessObject, translate = this._translate;

    attrs = attrs || {};

    businessObject = attrs.businessObject;

    if (!businessObject) {
        if (!attrs.type) {
            throw new Error(translate('no shape type specified'));
        }

        businessObject = this._model.create(attrs.type, attrs);
        this._ensureId(businessObject);
    }

    if (attrs.colors) {
        assign(businessObject.gfx, attrs.colors);

        delete attrs.colors;
    }

    size = this._getDefaultSize(attrs.type);

    attrs = assign(
        {
            businessObject: businessObject,
            id: businessObject.id
        },
        size,
        attrs
    );

    return this.baseCreate(elementType, attrs);
};

ElementFactory.prototype._ensureId = function(element) {
    // generate semantic ids for elements
    var prefix = (element.type || '').replace(/^[^:]*:/g, '') + '_';

    if (!element.id) {
        element.id = this._model.ids.nextPrefixed(prefix, element);
    }
};

ElementFactory.prototype._getDefaultSize = function(elementType) {
    
    var regionWidth = 140, regionHeight = 40;

    switch (elementType) {
        case 'atomic-state':
            return { width: 30, height: 30 };

        case 'compound-state':
            return { width: 120, height: 80 };

        case 'parallel-state':
            return {
                width: regionWidth + REGION_INDENTATION * 2,
                height: regionHeight * 2 + PARALLEL_TOP_MARGIN + PARALLEL_BOTTOM_MARGIN
            };
        case 'region':
            return {
                width: regionWidth,
                height: regionHeight
            };
        case 'root':
            return { width: 5000, height: 5000 };    
        default:
            return { width: 100, height: 80 };
    }
};

ElementFactory.prototype.createWaypoints = function(waypoints) {
    return map(
        waypoints,
        function(pos) {
            return this.createWaypoint(pos);
        },
        this
    );
};

ElementFactory.prototype.createWaypoint = function(point) {
    return pick(point, ['x', 'y']);
};

},{"../util/LabelUtil":40,"../util/RegionUtil":43,"diagram-js/lib/core/ElementFactory":60,"inherits":191,"lodash/collection/map":206,"lodash/object/assign":328,"lodash/object/pick":334}],8:[function(require,module,exports){
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

},{"diagram-js/lib/layout/BaseLayouter":159,"diagram-js/lib/layout/LayoutUtil":161,"diagram-js/lib/layout/ManhattanLayout":162,"inherits":191,"lodash/object/assign":328}],9:[function(require,module,exports){
'use strict';

var inherits = require('inherits'),
    isObject = require('lodash/lang/isObject'),
    assign = require('lodash/object/assign');

var BaseRenderer = require('diagram-js/lib/draw/BaseRenderer'),
    TextUtil = require('diagram-js/lib/util/Text');

var getBusinessObject = require('../util/ModelUtil').getBusinessObject;

var RenderUtil = require('diagram-js/lib/util/RenderUtil');

var componentsToPath = RenderUtil.componentsToPath;

var domQuery = require('min-dom/lib/query');

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgCreate = require('tiny-svg/lib/create'),
    svgClasses = require('tiny-svg/lib/classes');

var TASK_BORDER_RADIUS = 10;

/**
 * Decides the appearance of each element and provides the shape's snap svg 
 * element to be drawn on the canvas
 * @param {EventBus} eventBus 
 * @param {Styles} styles 
 * @param {PathMap} pathMap 
 * @param {Canvas} canvas 
 * @param {Priority} priority 
 */
function ElementRenderer(eventBus, styles, pathMap, canvas, priority) {
    var textUtil,
        computeStyle,
        markers = {};
    BaseRenderer.call(this, eventBus, priority);

    textUtil = new TextUtil({
        size: {
            width: 100
        }
    });

    computeStyle = styles.computeStyle;

    function addMarker(id, options) {
        var attrs = assign(
            {
                fill: 'black',
                strokeWidth: 1,
                strokeLinecap: 'round',
                strokeDasharray: 'none'
            },
            options.attrs
        );

        var ref = options.ref || {
            x: 0,
            y: 0
        };
        var marker, defs;
        var scale = options.scale || 1;

        // resetting stroke dash array
        if (attrs.strokeDasharray === 'none') {
            attrs.strokeDasharray = [10000, 1];
        }

        marker = svgCreate('marker');

        svgAttr(options.element, attrs);

        svgAppend(marker, options.element);

        svgAttr(marker, {
            id: id,
            viewBox: '0 0 20 20',
            refX: ref.x,
            refY: ref.y,
            markerWidth: 20 * scale,
            markerHeight: 20 * scale,
            orient: 'auto'
        });

        defs = domQuery('defs', canvas._svg);

        if (!defs) {
            defs = svgCreate('defs');

            svgAppend(canvas._svg, defs);
        }

        svgAppend(defs, marker);

        markers[id] = marker;
    }

    function marker(type, fill, stroke) {
        var id = type + '-' + fill + '-' + stroke;

        if (!markers[id]) {
            createMarker(type, fill, stroke);
        }

        return 'url(#' + id + ')';
    }

    function createMarker(type, fill, stroke) {
        var transitionMarker,
            transitionHistoryMarkerStart,
            id = type + '-' + fill + '-' + stroke;

        switch (type) {
            case 'transition-marker':
            case 'transition-history-marker-end': {
                transitionMarker = svgCreate('path');
                svgAttr(transitionMarker, {
                    d: 'M 1 5 L 11 10 L 1 15 Z'
                });

                addMarker(id, {
                    element: transitionMarker,
                    ref: {
                        x: 11,
                        y: 10
                    },
                    scale: 0.5,
                    attrs: {
                        fill: fill,
                        stroke: stroke
                    }
                });
                break;
            }
            case 'transition-history-marker-start': {
                transitionHistoryMarkerStart = svgCreate('circle');
                svgAttr(transitionHistoryMarkerStart, { cx: 6, cy: 6, r: 3.0 });

                addMarker(id, {
                    element: transitionHistoryMarkerStart,
                    attrs: {
                        fill: fill,
                        stroke: stroke
                    },
                    ref: { x: 3, y: 6 }
                });
                break;
            }
            default: {
                break;
            }
        }
    }

    function drawCircle(parentGfx, width, height, offset, attrs) {
        var cx, cy, circle;
        if (isObject(offset)) {
            attrs = offset;
            offset = 0;
        }

        offset = offset || 0;

        attrs = computeStyle(attrs, {
            stroke: 'black',
            strokeWidth: 2,
            fill: 'white'
        });
        cx = width / 2;
        cy = height / 2;
        circle = svgCreate('circle');

        svgAttr(circle, {
            cx: cx,
            cy: cy,
            r: Math.round((width + height) / 4 - offset)
        });

        svgAttr(circle, attrs);

        svgAppend(parentGfx, circle);

        return circle;
    }
    function drawCircle2(parentGfx, r, x, y, attrs) {
        var circle;
        attrs = computeStyle(attrs, {
            stroke: 'black',
            strokeWidth: 2,
            fill: 'white'
        });

        circle = svgCreate('circle');

        svgAttr(circle, {
            cx: x,
            cy: y,
            r: r
        });

        svgAttr(circle, attrs);

        svgAppend(parentGfx, circle);

        return circle;
    }

    function drawRect(parentGfx, width, height, r, offset, attrs) {
        var rect;
        if (isObject(offset)) {
            attrs = offset;
            offset = 0;
        }

        offset = offset || 0;

        attrs = computeStyle(attrs, {
            stroke: 'black',
            strokeWidth: 1,
            fill: 'white'
        });

        rect = svgCreate('rect');
        svgAttr(rect, {
            x: offset,
            y: offset,
            width: width - offset * 2,
            height: height - offset * 2,
            rx: r,
            ry: r
        });
        svgAttr(rect, attrs);

        svgAppend(parentGfx, rect);

        return rect;
    }

    function drawPath(parentGfx, d, attrs) {
        var path;
        attrs = computeStyle(attrs, ['no-fill'], {
            strokeWidth: 2,
            stroke: 'black'
        });

        path = svgCreate('path');
        svgAttr(path, {
            d: d
        });
        svgAttr(path, attrs);

        svgAppend(parentGfx, path);

        return path;
    }

    function renderLabel(parentGfx, label, options) {
        var text = textUtil.createText(label || '', options);
        svgClasses(text).add('djs-label');
        svgAppend(parentGfx, text);

        return text;
    }

    function renderEmbeddedLabel(parentGfx, element, align) {
        var businessObject = getBusinessObject(element);

        return renderLabel(parentGfx, businessObject.name, {
            box: element,
            align: align,
            padding: 5,
            style: {
                fill: getStrokeColor(element),
                fontSize: '.7em',
                fontWeight: 'bold'
            }
        });
    }

    function renderExternalLabel(parentGfx, element) {
        var businessObject = getBusinessObject(element);
        var box = {
            width: 90,
            height: 30,
            x: element.width / 2 + element.x ,
            y: element.height / 2 + element.y
        };

        var labelText = '';
        var fontStyle = 'normal';

        if (businessObject.type === 'transition') {
            fontStyle = 'italic';
            labelText = businessObject.isAuto === true ? 'Auto' : businessObject.action;
            if (typeof businessObject.gfx.labelVisible === 'undefined') {
                businessObject.gfx.labelVisible = true;
            }
        } else {
            labelText = businessObject.name;
        }

        return renderLabel(parentGfx, labelText, {
            box: box,
            fitBox: true,
            style: {
                fontSize: '.6em',
                fontWeight: 'normal',
                fontStyle: fontStyle
            }
        });
    }

    function createPathFromConnection(connection) {
        var waypoints = connection.waypoints,
            i;

        var pathData = 'm  ' + waypoints[0].x + ',' + waypoints[0].y;
        for (i = 1; i < waypoints.length; i++) {
            pathData += 'L' + waypoints[i].x + ',' + waypoints[i].y + ' ';
        }
        return pathData;
    }

    function renderHistoryIcon(parentGfx, element) {
        var pathData;
        var bo = getBusinessObject(element);

        if (bo.type === 'region' || bo.type === 'compound-state') {
            if (bo.tracksHistory === true) {
                /* add history icon */
                pathData = pathMap.getScaledPath('MARKER_HISTORY', {
                    abspos: {
                        x: element.width - 24,
                        y: element.height - 24
                    }
                });
                drawCircle2(parentGfx, 9, element.width - 16, element.height - 16, {
                    strokeWidth: 1,
                    fill: '#F5F5F5',
                    stroke: getStrokeColor(element)
                });
                drawPath(parentGfx, pathData, {
                    strokeWidth: 1.5, // 0.25,
                    fill: 'white',
                    stroke: getStrokeColor(element)
                });

                /* end add history */
            }
        }
    }

    this.handlers = {
        'atomic-state': function (parentGfx, element, attrs) {
            // remember assign only add missing attribute and never replaces that
            var circle,
                state,
                cstroke = '#3f3f3f',
                vattrs;
            var bo = getBusinessObject(element);
            state = bo.state;
            attrs = assign(
                {
                    fill: getFillColor(element),
                    stroke: cstroke
                },
                attrs
            );
            switch (state) {
                case 'start': {
                    vattrs = assign(
                        {
                            strokeWidth: 0,
                            strokeOpacity: 0
                        },
                        attrs
                    );
                    // main circle
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    // decorators
                    vattrs = { stroke: cstroke, strokeWidth: 1.5, strokeOpacity: 1, fillOpacity: 0 };
                    drawCircle(parentGfx, element.width, element.height, vattrs);
                    vattrs.strokeWidth = 3;
                    vattrs.stroke = 'white';
                    drawCircle(parentGfx, element.width, element.height, 2, vattrs);
                    vattrs.strokeWidth = 1.5;
                    vattrs.stroke = cstroke;
                    drawCircle(parentGfx, element.width, element.height, 4, vattrs);
                    break;
                }

                case 'intermediate': {

                    vattrs = assign({ strokeWidth: 1.5 }, attrs);
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    vattrs = { stroke: cstroke, strokeWidth: 1.5, strokeOpacity: 1, fillOpacity: 0 };
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    break;
                }

                case 'final': {

                    vattrs = assign({ strokeWidth: 1 }, attrs);
                    drawCircle(parentGfx, element.width, element.height, vattrs);
                    vattrs = { stroke: cstroke, strokeWidth: 4, strokeOpacity: 1, fillOpacity: 0.0 };
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    break;
                }

                default:
                    vattrs = assign({ strokeWidth: 1 }, attrs);
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    break;
            }
            return circle;
        },
        'compound-state': function (parentGfx, element, attrs) {
            var rect, labelAlignment, vattrs;
            var bo = getBusinessObject(element);
            var offset = 3;
            var fillColor = 'white',
                fillOpacity = 0.95;
            vattrs = assign(
                { fillOpacity: fillOpacity, fill: fillColor, stroke: getStrokeColor(element), strokeWidth: 2 },
                attrs
            );

            if (bo.isInitial === true) {
                vattrs.strokeWidth = 1;
                rect = drawRect(parentGfx, element.width, element.height, TASK_BORDER_RADIUS, vattrs);
                vattrs.fillOpacity = fillOpacity;
                drawRect(parentGfx, element.width, element.height, TASK_BORDER_RADIUS, offset, vattrs);
            } else {
                rect = drawRect(parentGfx, element.width, element.height, TASK_BORDER_RADIUS, vattrs);
            }

            labelAlignment = ['center-top', 'center-middle'];

            renderHistoryIcon(parentGfx, element);
            renderEmbeddedLabel(parentGfx, element, labelAlignment[0]);

            return rect;
        },
        'parallel-state': function (parentGfx, element, attrs) {
            var rect, labelAlignment, attr;
            var bo = getBusinessObject(element);
            var fillColor = 'white',
                fillOpacity = 0.95;
            attr = assign(
                {
                    fillOpacity: fillOpacity,
                    fill: fillColor,
                    stroke: 'black',
                    strokeWidth: 1
                },
                attrs
            );
            rect = drawRect(parentGfx, element.width, element.height - 2, TASK_BORDER_RADIUS, 0, attr);

            if (bo.isInitial === true) {
                // additional border for initial=true                
                drawRect(parentGfx, element.width, element.height - 2, TASK_BORDER_RADIUS, 3, attrs);
            }

            labelAlignment = ['center-top', 'center-middle'];

            renderEmbeddedLabel(parentGfx, element, labelAlignment[0]);

            return rect;
        },
        region: function (parentGfx, element, attrs) {
            var rect, labelAlignment;
            var fillColor = 'white',
                fillOpacity = 0.95;
            attrs = assign(
                {
                    fill: fillColor,
                    fillOpacity: fillOpacity,
                    stroke: 'black',
                    strokeDasharray: '2,1',
                    strokeWidth: 1
                },
                attrs
            );

            rect = drawRect(parentGfx, element.width, element.height, 0, attrs);

            labelAlignment = ['center-top', 'center-middle'];
            renderHistoryIcon(parentGfx, element);
            renderEmbeddedLabel(parentGfx, element, labelAlignment[0]);

            return rect;
        },
        transition: function (parentGfx, element, attrs) {
            var pathData = createPathFromConnection(element);
            var strokeStyle = 'none';
            var fillColor = getFillColor(element),
                strokeColor = getStrokeColor(element);
            var path;
            var bo = element && element.businessObject ? element.businessObject : null;

            if (element.isAuto) {
                strokeStyle = '3,2';
            }

            attrs = {
                strokeLinejoin: 'round',
                markerEnd: marker('transition-marker', strokeColor, strokeColor),
                stroke: strokeColor,
                strokeDasharray: strokeStyle,
                strokeWidth: 1.25
            };
            if (bo !== null) {
                // mark with history
                if (bo.withHistory === true) {
                    attrs.stroke = strokeColor;
                    attrs.markerStart = marker('transition-history-marker-start', fillColor, strokeColor);
                    attrs.markerEnd = marker('transition-history-marker-end', fillColor, strokeColor);
                }
            }
            path = drawPath(parentGfx, pathData, attrs);
            return path;
        },
        label: function (parentGfx, element) {
            // Update external label size and bounds during rendering when
            // we have the actual rendered bounds anyway.
            var textElement = renderExternalLabel(parentGfx, element);

            var textBBox;

            try {
                textBBox = textElement.getBBox();
            } catch (e) {
                textBBox = {
                    width: 0,
                    height: 0,
                    x: 0
                };
            }

            // update element.x so that the layouted text is still
            // center alligned (newX = oldMidX - newWidth / 2)
            element.x = Math.ceil(element.x + element.width / 2) - Math.ceil(textBBox.width / 2);

            // take element width, height from actual bounds
            element.width = Math.ceil(textBBox.width);
            element.height = Math.ceil(textBBox.height);

            // compensate bounding box x
            svgAttr(textElement, {
                transform: 'translate(' + -1 * textBBox.x + ',0)'
            });

            return textElement;
        }
    };
}

ElementRenderer.$inject = ['eventBus', 'styles', 'pathMap', 'canvas'];

inherits(ElementRenderer, BaseRenderer);

module.exports = ElementRenderer;

ElementRenderer.prototype.canRender = function (/*element*/) {
    return true;
};

ElementRenderer.prototype.drawShape = function (parentGfx, element) {
    var type = element.type;
    var h = this.handlers[type];
    var bo = getBusinessObject(element);
    /* jshint -W040 */
    return h(parentGfx, element, {
        state: bo.state
    });
};

ElementRenderer.prototype.drawConnection = function (parentGfx, element) {
    var type = element.type;
    var h = this.handlers[type];

    /* jshint -W040 */
    return h(parentGfx, element);
};

ElementRenderer.prototype.getShapePath = function (element) {
    if (element.type === 'atomic-state') {
        return getCirclePath(element);
    }
    if (element.type === 'transition' || element.type === 'connection') {
        return getConnectionPath(element);
    }
    return getRectPath(element);
};

function getConnectionPath(connection) {
    var waypoints = connection.waypoints.map(function (p) {
        return p.original || p;
    });

    var connectionPath = [['M', waypoints[0].x, waypoints[0].y]];

    waypoints.forEach(function (waypoint, index) {
        if (index !== 0) {
            connectionPath.push(['L', waypoint.x, waypoint.y]);
        }
    });

    return componentsToPath(connectionPath);
}

function getCirclePath(shape) {
    var cx = shape.x + shape.width / 2,
        cy = shape.y + shape.height / 2,
        radius = shape.width / 2;

    var circlePath = [
        ['M', cx, cy],
        ['m', 0, -radius],
        ['a', radius, radius, 0, 1, 1, 0, 2 * radius],
        ['a', radius, radius, 0, 1, 1, 0, -2 * radius],
        ['z']
    ];

    return componentsToPath(circlePath);
}

function getRectPath(shape) {
    var x = shape.x,
        y = shape.y,
        width = shape.width,
        height = shape.height;

    var rectPath = [['M', x, y], ['l', width, 0], ['l', 0, height], ['l', -width, 0], ['z']];

    return componentsToPath(rectPath);
}

function getFillColor(element) {
    var bo = getBusinessObject(element);

    if (bo.gfx.color) {
        return bo.gfx.color;
    }

    return '#D3D3D3';
}

function getStrokeColor(element) {
    var bo = getBusinessObject(element);

    if (element.type === 'transition' && bo.gfx.color) {
        return bo.gfx.color;
    }
    return 'black';
}

},{"../util/ModelUtil":41,"diagram-js/lib/draw/BaseRenderer":65,"diagram-js/lib/util/RenderUtil":180,"diagram-js/lib/util/Text":182,"inherits":191,"lodash/lang/isObject":323,"lodash/object/assign":328,"min-dom/lib/query":346,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/create":357}],10:[function(require,module,exports){
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

},{"../util/ModelingUtil":42,"../util/RegionUtil":43,"diagram-js/lib/features/rules/RuleProvider":136,"inherits":191,"lodash/collection/filter":202,"lodash/collection/forEach":204}],11:[function(require,module,exports){
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
},{"../util/ModelUtil":41,"diagram-js/lib/command/CommandInterceptor":56,"inherits":191,"lodash/object/assign":328}],12:[function(require,module,exports){
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

},{"./cmd/AddRegionHandler":24,"./cmd/IdClaimHandler":25,"./cmd/UpdateLabelHandler":26,"diagram-js/lib/features/modeling/Modeling":94,"inherits":191}],13:[function(require,module,exports){
'use strict';

/**
 * Map containing SVG paths needed by Renderer.
 */

// copied from https://github.com/adobe-webplatform/Snap.svg/blob/master/src/svg.js
var tokenRegex = /\{([^\}]+)\}/g, objNotationRegex = /(?:(?:^|\.)(.+?)(?=\[|\.|$|\()|\[('|")(.+?)\2\])(\(\))?/g; // matches .xxxxx or ["xxxxx"] to run over object properties
function PathMap() {
    /**
     * Contains a map of path elements
     *
     * <h1>Path definition</h1>
     * A parameterized path is defined like this:
     * <pre>
     * 'GATEWAY_PARALLEL': {
     *   d: 'm {mx},{my} {e.x0},0 0,{e.x1} {e.x1},0 0,{e.y0} -{e.x1},0 0,{e.y1} ' +
    '-{e.x0},0 0,-{e.y1} -{e.x1},0 0,-{e.y0} {e.x1},0 z',
     *   height: 17.5,
     *   width:  17.5,
     *   heightElements: [2.5, 7.5],
     *   widthElements: [2.5, 7.5]
     * }
     * </pre>
     * <p>It's important to specify a correct <b>height and width</b> for the path as the scaling
     * is based on the ratio between the specified height and width in this object and the
     * height and width that is set as scale target (Note x,y coordinates will be scaled with
     * individual ratios).</p>
     * <p>The '<b>heightElements</b>' and '<b>widthElements</b>' array must contain the values that will be scaled.
     * The scaling is based on the computed ratios.
     * Coordinates on the y axis should be in the <b>heightElement</b>'s array, they will be scaled using
     * the computed ratio coefficient.
     * In the parameterized path the scaled values can be accessed through the 'e' object in {} brackets.
     *   <ul>
     *    <li>The values for the y axis can be accessed in the path string using {e.y0}, {e.y1}, ....</li>
     *    <li>The values for the x axis can be accessed in the path string using {e.x0}, {e.x1}, ....</li>
     *   </ul>
     *   The numbers x0, x1 respectively y0, y1, ... map to the corresponding array index.
     * </p>
     */
    this.pathMap = {
        MARKER_HISTORY: {
            d: 'm{mx},{my} m 5,3 l 0,10 m 0,-5 l 5,0 m 0,-5 l 0,10',
            height: 12,
            width: 12,
            heightElements: [],
            widthElements: []
        }
    };

    this.getRawPath = function getRawPath(pathId) {
        return this.pathMap[pathId].d;
    };

    /**
     * Scales the path to the given height and width.
     * <h1>Use case</h1>
     * <p>Use case is to scale the content of elements (event, gateways) based
     * on the element bounding box's size.
     * </p>
     * <h1>Why not transform</h1>
     * <p>Scaling a path with transform() will also scale the stroke and IE does not support
     * the option 'non-scaling-stroke' to prevent this.
     * Also there are use cases where only some parts of a path should be
     * scaled.</p>
     *
     * @param {String} pathId The ID of the path.
     * @param {Object} param <p>
     *   Example param object scales the path to 60% size of the container (data.width, data.height).
     *   <pre>
     *   {
     *     xScaleFactor: 0.6,
     *     yScaleFactor:0.6,
     *     containerWidth: data.width,
     *     containerHeight: data.height,
     *     position: {
     *       mx: 0.46,
     *       my: 0.2,
     *     }
     *   }
     *   </pre>
     *   <ul>
     *    <li>targetpathwidth = xScaleFactor * containerWidth</li>
     *    <li>targetpathheight = yScaleFactor * containerHeight</li>
     *    <li>Position is used to set the starting coordinate of the path. M is computed:
     *    <ul>
     *      <li>position.x * containerWidth</li>
     *      <li>position.y * containerHeight</li>
     *    </ul>
     *    Center of the container <pre> position: {
     *       mx: 0.5,
     *       my: 0.5,
     *     }</pre>
     *     Upper left corner of the container
     *     <pre> position: {
     *       mx: 0.0,
     *       my: 0.0,
     *     }</pre>
     *    </li>
     *   </ul>
     * </p>
     *
     */
    this.getScaledPath = function getScaledPath(pathId, param) {
        var rawPath = this.pathMap[pathId];

        // positioning
        // compute the start point of the path
        var mx, my, coordinates, path,heightRatio, widthRatio,heightIndex, widthIndex;

        if (param.abspos) {
            mx = param.abspos.x;
            my = param.abspos.y;
        } else {
            mx = param.containerWidth * param.position.mx;
            my = param.containerHeight * param.position.my;
        }

        coordinates = {}; //map for the scaled coordinates
        if (param.position) {
          
            // path
            heightRatio = param.containerHeight / rawPath.height * param.yScaleFactor;
            widthRatio = param.containerWidth / rawPath.width * param.xScaleFactor;

            //Apply height ratio
            for (heightIndex = 0; heightIndex < rawPath.heightElements.length; heightIndex++) {
                coordinates['y' + heightIndex] = rawPath.heightElements[heightIndex] * heightRatio;
            }

            //Apply width ratio
            for (widthIndex = 0; widthIndex < rawPath.widthElements.length; widthIndex++) {
                coordinates['x' + widthIndex] = rawPath.widthElements[widthIndex] * widthRatio;
            }
        }

        //Apply value to raw path
        path = format(rawPath.d, {
            mx: mx,
            my: my,
            e: coordinates
        });
        return path;
    };
}

module.exports = PathMap;

////////// helpers //////////

function replacer(all, key, obj) {
    var res = obj;
    key.replace(objNotationRegex, function (all, name, quote, quotedName, isFunc) {
        name = name || quotedName;
        if (res) {
            if (name in res) {
                res = res[name];
            }
            typeof res == 'function' && isFunc && (res = res());
        }
    });
    res = (res === null || res === obj ? all : res) + '';

    return res;
}

function format(str, obj) {
    return String(str).replace(tokenRegex, function (all, key) {
        return replacer(all, key, obj);
    });
}

},{}],14:[function(require,module,exports){
'use strict';

var inherits = require('inherits');
var CommandInterceptor = require('diagram-js/lib/command/CommandInterceptor');
var is = require('../../util/ModelUtil').is;
var getChildRegions = require('../../util/RegionUtil').getChildRegions;
var eachElement = require('diagram-js/lib/util/Elements').eachElement;

var LOW_PRIORITY = 500;

/**
 * Delete region behavior
 * 
 * @param {EventBus} eventBus
 * @param {SpaceTool} spaceTool
 */
function DeleteRegionBehavior(eventBus, spaceTool) {

    CommandInterceptor.call(this, eventBus);

    function shiftRegionUp(element, offset) {
        var movingShapes = [], resizingShapes=[];
        movingShapes.push(element);
        spaceTool.makeSpace(
            movingShapes,
            resizingShapes, {
                x: 0,
                y: -offset
            }, 'n');
        return element;
    }

    function shrinkParallel(element, offset) {
        var movingShapes = [], resizingShapes=[];        
        if (element.type !== 'parallel-state') {
            throw 'root not parallel-state';
        }
        resizingShapes.push(element);
        spaceTool.makeSpace(
            movingShapes,
            resizingShapes, {
                x: 0,
                y: -offset
            }, 's');
        return element;
    }

    function fixRegionDelete(shape, oldParent) {
        var parallel = oldParent;
        var siblings = getChildRegions(parallel);
        //adust regions (shift up)
        eachElement(siblings, function (element) {
            if (element.type === 'region') {
                if (element.y > shape.y) {
                    element = shiftRegionUp(element, shape.height);
                }
            }
        });
        // adust parallel height
        shrinkParallel(parallel, shape.height);
    }

    /**
     * Adjust sizes of other regions after region deletion
     */
    this.postExecuted('shape.delete', LOW_PRIORITY, function (event) {

        var context = event.context,
            hints = context.hints,
            shape = context.shape,
            oldParent = context.oldParent;

        // only compensate region deletes
        if (!is(shape, 'region')) {
            return;
        }

        // compensate root deletes only
        if (hints && hints.nested) {
            return;
        }
        fixRegionDelete(shape, oldParent);

    });
}

DeleteRegionBehavior.$inject = ['eventBus', 'spaceTool'];

inherits(DeleteRegionBehavior, CommandInterceptor);

module.exports = DeleteRegionBehavior;
},{"../../util/ModelUtil":41,"../../util/RegionUtil":43,"diagram-js/lib/command/CommandInterceptor":56,"diagram-js/lib/util/Elements":169,"inherits":191}],15:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign'),
    inherits = require('inherits'),
    CommandInterceptor = require('diagram-js/lib/command/CommandInterceptor');

var LabelUtil = require('../../util/LabelUtil'),
    LabelLayoutUtil = require('./util/LabelLayoutUtil'),
    ModelUtil = require('../../util/ModelUtil'),
    getBusinessObject = ModelUtil.getBusinessObject;

var hasExternalLabel = LabelUtil.hasExternalLabel,
    getExternalLabelMid = LabelUtil.getExternalLabelMid,
    getLabelAdjustment = LabelLayoutUtil.getLabelAdjustment;

/**
 * A component that makes sure that external labels are added
 * are added along with respective elements and properly updated
 * during move
 * @param {EventBus} eventBus
 * @param {Modeling} modeling
 */
function LabelSupport(eventBus, modeling) {

    CommandInterceptor.call(this, eventBus);

    ///// create external labels on shape creation
    this.postExecute([ 'shape.create', 'connection.create' ], function(e) {
        var context = e.context;

        var element = context.shape || context.connection,
            businessObject = element.businessObject;

        var position;

        if (businessObject.type === 'transition' || businessObject.type === 'atomic-state') {
            position = getExternalLabelMid(element);

            modeling.createLabel(element, position, {
                id: businessObject.id + '_label',
                hidden: !businessObject.name,
                businessObject: businessObject
            });
        }
    });

    ///// update gfx information on label creation
    this.executed([ 'label.create' ], function(event) {

        var element = event.context.shape,
            businessObject;

        businessObject = element.businessObject,
        businessObject.gfx.labelBounds = { x: element.x,
            y: element.y,
            width: element.width,
            height: element.height};
    });

    ///// update label position on connection change
    function getHiddenLabelAdjustment(event) {

        var context = event.context,
            connection = context.connection,
            label = connection.label;

        var labelPosition = getExternalLabelMid(connection);

        return {
            x: labelPosition.x - label.x - label.width / 2,
            y: labelPosition.y - label.y - label.height / 2
        };
    }

    function getVisibleLabelAdjustment(event) {

        var command = event.command,
            context = event.context,
            connection = context.connection,
            label = connection.label,
            hints = assign({}, context.hints),
            newWaypoints = context.newWaypoints || connection.waypoints,
            oldWaypoints = context.oldWaypoints;

        if (typeof hints.startChanged === 'undefined') {
            hints.startChanged = (command === 'connection.reconnectStart');
        }

        if (typeof hints.endChanged === 'undefined') {
            hints.endChanged = (command === 'connection.reconnectEnd');
        }

        return getLabelAdjustment(label, newWaypoints, oldWaypoints, hints);
    }

    this.postExecute([
        'connection.layout',
        'connection.reconnectEnd',
        'connection.reconnectStart',
        'connection.updateWaypoints'
    ], function(event) {

        var label = event.context.connection.label,
            labelAdjustment;

        if (!label) {
            return;
        }

        if (label.hidden) {
            labelAdjustment = getHiddenLabelAdjustment(event);
        } else {
            labelAdjustment = getVisibleLabelAdjustment(event);
        }

        modeling.moveShape(label, labelAdjustment);
    });

    ////// keep label position on shape replace
    this.postExecute([ 'shape.replace' ], function(event) {
        var context = event.context,
            newShape = context.newShape,
            oldShape = context.oldShape;

        var businessObject = getBusinessObject(newShape);

        if (businessObject && hasExternalLabel(businessObject)) {
            newShape.label.x = oldShape.label.x;
            newShape.label.y = oldShape.label.y;
        }
    });

}

inherits(LabelSupport, CommandInterceptor);

LabelSupport.$inject = [ 'eventBus', 'modeling' ];

module.exports = LabelSupport;

},{"../../util/LabelUtil":40,"../../util/ModelUtil":41,"./util/LabelLayoutUtil":22,"diagram-js/lib/command/CommandInterceptor":56,"inherits":191,"lodash/object/assign":328}],16:[function(require,module,exports){
'use strict';

function ModelingFeedback(eventBus, tooltips, translate) {

    function showError(position, message, timeout) {
        tooltips.add({
            position: position,
            type: 'error',
            timeout: timeout || 12000,
            html: '<div>' + message + '</div>'
        });
    }
    
    function handleError(event) {
        var msg = event.context.errorMessage || null;
        var context = event.context;
        var target = context.target;
        var x, y, position;
        if (msg !== null) {
            x = target ? target.x : event.x;
            y = target ? target.y : event.y;
            position = {
                x: x < 0 ? 0 : x,
                y: y < 0 ? 0 : y
            };
            showError(position, translate(msg));
        }
    }
    eventBus.on(
        [
            'shape.move.rejected',
            'create.rejected',
            'connection.rejected',
            'bendpoint.move.end',
            'bendpoint.move.cancel',
            'create.end',
            'shape.move.end'
        ],
        function (event) {
            handleError(event);
        }
    );
}

ModelingFeedback.$inject = ['eventBus', 'tooltips', 'translate'];

module.exports = ModelingFeedback;

},{}],17:[function(require,module,exports){
'use strict';

var is = require('../../util/ModelUtil').is;

var roundBounds = require('diagram-js/lib/layout/LayoutUtil').roundBounds;
var asTRBL = require('diagram-js/lib/layout/LayoutUtil').asTRBL;

var REGION_INDENTATION = require('../../util/RegionUtil').REGION_INDENTATION,
    PARALLEL_BOTTOM_MARGIN = require('../../util/RegionUtil').PARALLEL_BOTTOM_MARGIN,
    PARALLEL_TOP_MARGIN = require('../../util/RegionUtil').PARALLEL_TOP_MARGIN,
    getChildRegions = require('../../util/RegionUtil').getChildRegions,
    getImmediateChildren = require('../../util/RegionUtil').getImmediateChildren,
    getBounds = require('../../util/RegionUtil').getBounds,
    adjustChildren = require('../../util/RegionUtil').adjustChildren,
    resizeRegionsInParallel = require('../../util/RegionUtil').resizeRegionsInParallel;

var SLIGHTLY_HIGHER_PRIORITY = 1001;

/** 
 * A component responsible for resizing of shapes
 * @param {EventBus} eventBus 
 * @param {Modeling} modeling 
 */
function ResizeShapeBehavior(eventBus, modeling) {
    eventBus.on('resize.start', SLIGHTLY_HIGHER_PRIORITY + 500, function (event) {
        var context = event.context,
            shape = context.shape,
            // evaluate minBounds for backwards compatibility
            minBounds = context.minBounds,
            maxBounds = null;
        maxBounds = getParentMaxBounds(shape);
        context.balanced = true;
        //shape is parallel
        if (is(shape, 'parallel-state')) {
            minBounds = getMinParallelBounds(shape);
            minBounds.x = maxBounds.x = shape.x;
            minBounds.y = maxBounds.y = shape.y;
            getResizeConstraints(context, minBounds, maxBounds);
        } else if (is(shape, 'region')) {
            minBounds = getBounds(shape);
            minBounds.height = getMaxChildHeight(shape, PARALLEL_BOTTOM_MARGIN);
            maxBounds.width = minBounds.width = shape.width;
            maxBounds.x = minBounds.x = shape.x;
            maxBounds.y = minBounds.y = shape.y;
            maxBounds.height *= 5;
            getResizeConstraints(context, minBounds, maxBounds);
        } else if (is(shape, 'compound-state')) {
            minBounds = getMinCompoundBounds(shape);
            getResizeConstraints(context, minBounds, maxBounds);
        } else if (is(shape, 'atomic-state')) {
            
            minBounds = getMinDefaultBounds(shape);
            getResizeConstraints(context, minBounds, maxBounds);
        } else {
            //normal flow
        }
    });

    /**
     * Intercept resize end and call resize shape function instead.
     */
    eventBus.on('resize.end', SLIGHTLY_HIGHER_PRIORITY, function (event) {
        var context = event.context,
            shape = context.shape,
            canExecute = context.canExecute,
            newBounds = roundBounds(context.newBounds),
            delta = { x: newBounds.width - shape.width, y: newBounds.height - shape.height },
            parent,
            parentBounds,
            shapeSize;
        if (is(shape, 'parallel-state')) {
            if (canExecute) {
                //ensure we have actual pixel values for new bounds
                //(important when zoom level was > 1 during move)
                if (delta.x !== 0 || delta.y !== 0) {
                    //resize the parallel
                    modeling.resizeShape(shape, newBounds);
                    // resize regions
                    resizeRegionsInParallel(modeling, shape, newBounds);
                }
            }
            delete context.resizeConstraints;
            // stop propagation
            return false;
        } else if (is(shape, 'region')) {
            if (canExecute) {
                // ensure we have actual pixel values for new bounds
                // (important when zoom level was > 1 during move)
                if (delta.x !== 0 || delta.y !== 0) {
                    parent = shape.parent;
                    // resize parallel(parent)
                    parentBounds = getBounds(parent);
                    parentBounds.height += delta.y;
                    modeling.resizeShape(parent, parentBounds);
                    // resize current region
                    modeling.resizeShape(shape, newBounds);
                    delete context.resizeConstraints;
                    resizeRegionsInParallel(modeling, parent, newBounds);
                }
            }
            // stop propagation
            return false;
        } else if (is(shape, 'compound-state')) {
            if (canExecute) {
                // ensure we have actual pixel values for new bounds
                // (important when zoom level was > 1 during move)
                if (delta.x !== 0 || delta.y !== 0) {
                    // resize compound
                    adjustChildren(modeling, shape, newBounds);
                    modeling.resizeShape(shape, newBounds);
                }
            }
            delete context.resizeConstraints;
            // stop propagation
            return false;
        } else if (is(shape, 'atomic-state')) {
           
            if (canExecute) {
                // ensure we have actual pixel values for new bounds
                // (important when zoom level was > 1 during move)
                if (delta.x !== 0 || delta.y !== 0) {
                    // resize compound
                    shapeSize = Math.ceil((newBounds.height + newBounds.width) / 2);
                    newBounds.height = shapeSize;
                    newBounds.width = shapeSize;
                    modeling.resizeShape(shape, newBounds, getMinDefaultBounds(shape));
                    modeling.updateLabel(shape, shape.label.businessObject.name);
                }
            }
            delete context.resizeConstraints;
            // stop propagation
            return false;
        }

        return true;
    });
    function getMaxChildHeight(shape, margin) {
        var children, height,
            optMargin = margin || 0;
        height = 0;
        children = getImmediateChildren(shape);
        if (children.length > 0) {
            height =
                children.reduce(function (maxy, obj) {
                    maxy = obj.y + obj.height > maxy ? obj.y + obj.height : maxy;
                    return maxy;
                }, 0) -
                shape.y + optMargin;
        } else {
            height = modeling.getDefaultSize(shape).height;
        }
        return height;
    }
    function getMaxChildWidth(shape, margin) {
        var children, width = 0,
            optMargin = margin || 0;
        children = getImmediateChildren(shape);
        if (children.length > 0) {
            width =
                children.reduce(function (maxx, obj) {
                    maxx = obj.x + obj.width > maxx ? obj.x + obj.width : maxx;
                    return maxx;
                }, 0) -
                shape.x + optMargin;
        } else {
            width = modeling.getDefaultSize(shape).width;
        }
        return width;
    }
    // Get minimum bounds of all children in region
    function getMaxRegionChildWidth(parallel) {
        var regions;
        if (parallel) {
            regions = getImmediateChildren(parallel);
            return regions.reduce(function (value, region) {
                var max = getMaxChildWidth(region, REGION_INDENTATION * 3);
                return max > value ? max : value;
            }, 0);
        }
        return null;
    }
    // Get minimum bounds of all region in parallel
    function getMinParallelBounds(parallel) {
        var minBounds;
        var regions = getChildRegions(parallel);
        // use  reduce to get max width of regions and total height
        var regionDetails = regions.reduce(
            function (result, obj) {
                result.maxWidth = obj.width > result.maxWidth ? obj.width : result.maxWidth;
                result.sumHeight = result.sumHeight + obj.height;
                return result;
            },
            { maxWidth: 0, sumHeight: 0 }
        );

        minBounds = {
            width: regionDetails.maxWidth + REGION_INDENTATION * 2,
            height: regionDetails.sumHeight + PARALLEL_BOTTOM_MARGIN + PARALLEL_TOP_MARGIN,
            x: parallel.x,
            y: parallel.y
        };
        minBounds.width = getMaxRegionChildWidth(parallel);
        return minBounds;
    }
    // Get minimum bounds of all children in compound
    function getMinCompoundBounds(shape) {
        var minBounds;
        minBounds = getMinDefaultBounds(shape); // default minimum bounds
        minBounds.width = getMaxChildWidth(shape);
        minBounds.height = getMaxChildHeight(shape);
        return minBounds;
    }
    // default minimum bounds shape(x,y) and default(x,y) defined in ElementFactory<-Modeling.getDefaultSize()
    function getMinDefaultBounds(shape) {
        var minBounds = getBounds(shape);
        var defaultSize = modeling.getDefaultSize(shape);
        minBounds.width = defaultSize.width;
        minBounds.height = defaultSize.height;
        return minBounds;
    }

    // get parent's max bounds. restrict resize operation in parent container.
    function getParentMaxBounds(shape) {
        var retval = null,
            diameter,
            parentBO = shape.parent.businessObject;
        var parent = shape.parent;
        if (parentBO.type === 'root') {
            retval = { x: 0, y: 0, height: 5000, width: 5000 };
        } else {
            if (shape.type === 'atomic-state') {
                diameter = parent.width < parent.height ? parent.width : parent.height;
                diameter -= 5;
                retval = { x: parent.x, y: parent.y, width: diameter, height: diameter };
            } else {
                retval = { x: parent.x + 4, y: parent.y + 4, width: parent.width - 8, height: parent.height - 8 };
            }
        }

        return retval;
    }
    // converts relative to absolute position set as constraints in context
    function getResizeConstraints(context, minBounds, maxBounds) {
        if (maxBounds && minBounds) {
            context.resizeConstraints = {
                min: asTRBL(minBounds),
                max: asTRBL(maxBounds)
            };
        } else if (minBounds) {
            context.resizeConstraints = {
                min: asTRBL(minBounds)
            };
        } else if (maxBounds) {
            context.resizeConstraints = {
                max: asTRBL(maxBounds)
            };
        }
        return context.resizeConstraints;
    }
}
ResizeShapeBehavior.$inject = ['eventBus', 'modeling'];

module.exports = ResizeShapeBehavior;

},{"../../util/ModelUtil":41,"../../util/RegionUtil":43,"diagram-js/lib/layout/LayoutUtil":161}],18:[function(require,module,exports){
'use strict';

var inherits = require('inherits');

var CommandInterceptor = require('diagram-js/lib/command/CommandInterceptor');

var HIGH_PRIORITY = 1600;

function RestrictShapeToBoundaryBehavior(eventBus, canvas) {

    CommandInterceptor.call(this, eventBus);

    this._eventBus.on('shape.move.end', HIGH_PRIORITY, function (event) {

        var context = event.context;
        var shape = context.shape;
        var target = context.target;
        var posx = shape.x + event.dx;
        var posy = shape.y + event.dy;
        var result;
        var container = canvas;
        var size = container.getSize();
        if (target === null || posx < 0 || posy < 0 || posx + shape.width > size.width || posy + shape.height > size.height) {
            context.canExecute = false;
            context.errorMessage = 'Cound not move shape. Out of bounds.';
            result = false;
        }
        return result;
    });

    this._eventBus.on(['create.end'], HIGH_PRIORITY, function (event) {
        var context = event.context;
        var shape = context.shape;
        var target = context.target;
        var posx = event.x || 1;
        var posy = event.y || 1;
        var result;
        var container = canvas;
        var size = container.getSize();
        if (
            target === null ||
            posx < shape.width / 2 ||
            posy < shape.height / 2 ||
            posx + shape.width > size.width ||
            posy + shape.height > size.height
        ) {
            context.canExecute = false;
            context.errorMessage = 'Cound not create shape. Out of bounds.';
            result = false;
        }
        return result;
    });
}

RestrictShapeToBoundaryBehavior.$inject = ['eventBus', 'canvas'];

inherits(RestrictShapeToBoundaryBehavior, CommandInterceptor);

module.exports = RestrictShapeToBoundaryBehavior;

},{"diagram-js/lib/command/CommandInterceptor":56,"inherits":191}],19:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    inherits = require('inherits'),
    CommandInterceptor = require('diagram-js/lib/command/CommandInterceptor');

/**
 * @param {EventBus} eventBus
 * @param {Modeling} modeling
 */
function UnclaimIdBehavior(eventBus, modeling) {

    CommandInterceptor.call(this, eventBus);

    this.preExecute('elements.delete', function(event) {
        var context = event.context,
            elements = context.elements;

        forEach(elements, function(element) {
            modeling.unclaimId(element.businessObject.id, element.businessObject);
        });

    });
}

inherits(UnclaimIdBehavior, CommandInterceptor);

UnclaimIdBehavior.$inject = [ 'eventBus', 'modeling' ];

module.exports = UnclaimIdBehavior;
},{"diagram-js/lib/command/CommandInterceptor":56,"inherits":191,"lodash/collection/forEach":204}],20:[function(require,module,exports){
'use strict';
module.exports = {   
    __init__: [
        'deleteRegionBehavior',
        'resizeShapeBehavior',
        'unclaimIdBehavior',
        'modelingFeedback',
        'labelBehavior',
        'restrictShapeToBoundaryBehavior'
    ],
    restrictShapeToBoundaryBehavior: [ 'type', require('./RestrictShapeToBoundaryBehavior') ],
    deleteRegionBehavior: [ 'type', require('./DeleteRegionBehavior') ],
    resizeShapeBehavior: [ 'type', require('./ResizeShapeBehavior') ],
    unclaimIdBehavior: [ 'type', require('./UnclaimIdBehavior') ],
    labelBehavior: [ 'type', require('./LabelBehavior') ],
    modelingFeedback: [ 'type', require('./ModelingFeedback') ]
};

},{"./DeleteRegionBehavior":14,"./LabelBehavior":15,"./ModelingFeedback":16,"./ResizeShapeBehavior":17,"./RestrictShapeToBoundaryBehavior":18,"./UnclaimIdBehavior":19}],21:[function(require,module,exports){
'use strict';

/**
 * Returns the length of a vector
 *
 * @param {Vector}
 * @return {Float}
 */
function vectorLength(v) {
    return Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
}

module.exports.vectorLength = vectorLength;

/**
 * Calculates the angle between a line a the yAxis
 *
 * @param {Array}
 * @return {Float}
 */
function getAngle(line) {
    // return value is between 0, 180 and -180, -0
    // @janstuemmel: maybe replace return a/b with b/a
    return Math.atan((line[1].y - line[0].y) / (line[1].x - line[0].x));
}

module.exports.getAngle = getAngle;

/**
 * Rotates a vector by a given angle
 *
 * @param {Vector}
 * @param {Float} Angle in radians
 * @return {Vector}
 */
function rotateVector(vector, angle) {
    return !angle
        ? vector
        : {
            x: Math.cos(angle) * vector.x - Math.sin(angle) * vector.y,
            y: Math.sin(angle) * vector.x + Math.cos(angle) * vector.y
        };
}

module.exports.rotateVector = rotateVector;

/**
 * Solves a 2D equation system
 * a + r*b = c, where a,b,c are 2D vectors
 *
 * @param {Vector}
 * @param {Vector}
 * @param {Vector}
 * @return {Float}
 */
function solveLambaSystem(a, b, c) {
    // the 2d system
    var system = [
        { n: a[0] - c[0], lambda: b[0] },
        { n: a[1] - c[1], lambda: b[1] }
    ];

    // solve
    var n = system[0].n * b[0] + system[1].n * b[1],
        l = system[0].lambda * b[0] + system[1].lambda * b[1];

    return -n / l;
}

/**
 * Position of perpendicular foot
 *
 * @param {Point}
 * @param [ {Point}, {Point} ] line defined throug two points
 * @return {Point} the perpendicular foot position
 */
function perpendicularFoot(point, line) {
    var a = line[0], b = line[1];

    // relative position of b from a
    var bd = { x: b.x - a.x, y: b.y - a.y };

    // solve equation system to the parametrized vectors param real value
    var r = solveLambaSystem([a.x, a.y], [bd.x, bd.y], [point.x, point.y]);

    return { x: a.x + r * bd.x, y: a.y + r * bd.y };
}

module.exports.perpendicularFoot = perpendicularFoot;

/**
 * Calculates the distance between a point and a line
 *
 * @param {Point}
 * @param [ {Point}, {Point} ] line defined throug two points
 * @return {Float} distance
 */
function getDistancePointLine(point, line) {
    var pfPoint = perpendicularFoot(point, line);

    // distance vector
    var connectionVector = {
        x: pfPoint.x - point.x,
        y: pfPoint.y - point.y
    };

    return vectorLength(connectionVector);
}

module.exports.getDistancePointLine = getDistancePointLine;

/**
 * Calculates the distance between two points
 *
 * @param {Point}
 * @param {Point}
 * @return {Float} distance
 */
function getDistancePointPoint(point1, point2) {
    return vectorLength({
        x: point1.x - point2.x,
        y: point1.y - point2.y
    });
}

module.exports.getDistancePointPoint = getDistancePointPoint;

},{}],22:[function(require,module,exports){
'use strict';

var GeometricUtil = require('./GeometricUtil');

var getDistancePointPoint = require('./GeometricUtil').getDistancePointPoint;

var getAttachment = require('./LineAttachmentUtil').getAttachment;

function findNewLabelLineStartIndex(oldWaypoints, newWaypoints, attachment, hints) {

    var index = attachment.segmentIndex;

    var offset = newWaypoints.length - oldWaypoints.length;

    // segmentMove happend
    if (hints.segmentMove) {

        var oldSegmentStartIndex = hints.segmentMove.segmentStartIndex,
            newSegmentStartIndex = hints.segmentMove.newSegmentStartIndex;

        // if label was on moved segment return new segment index
        if (index === oldSegmentStartIndex) {
            return newSegmentStartIndex;
        }

        // label is after new segment index
        if (index >= newSegmentStartIndex) {
            return (index + offset < newSegmentStartIndex) ? newSegmentStartIndex : index + offset;
        }

        // if label is before new segment index
        return index;
    }

    // bendpointMove happend
    if (hints.bendpointMove) {

        var insert = hints.bendpointMove.insert,
            bendpointIndex = hints.bendpointMove.bendpointIndex,
            newIndex;

        // waypoints length didnt change
        if (offset === 0) {
            return index;
        }

        // label behind new/removed bendpoint
        if (index >= bendpointIndex) {
            newIndex = insert ? index + 1 : index - 1;
        }

        // label before new/removed bendpoint
        if (index < bendpointIndex) {

            newIndex = index;

            // decide label should take right or left segment
            if (insert && attachment.type !== 'bendpoint' && bendpointIndex - 1 === index) {

                var rel = relativePositionMidWaypoint(newWaypoints, bendpointIndex);

                if (rel < attachment.relativeLocation) {
                    newIndex++;
                }
            }
        }

        return newIndex;
    }

    // start/end changed
    if (offset === 0) {
        return index;
    }

    if (hints.connectionStart) {
        return (index === 0) ? 0 : null;
    }

    if (hints.connectionEnd) {
        return (index === oldWaypoints.length - 2) ? newWaypoints.length - 2 : null;
    }

    // if nothing fits, return null
    return null;
}

module.exports.findNewLabelLineStartIndex = findNewLabelLineStartIndex;

/**
 * Calculate the required adjustment (move delta) for the given label
 * after the connection waypoints got updated.
 *
 * @param {djs.model.Label} label
 * @param {Array<Point>} newWaypoints
 * @param {Array<Point>} oldWaypoints
 * @param {Object} hints
 *
 * @return {Point} delta
 */
function getLabelAdjustment(label, newWaypoints, oldWaypoints, hints) {

    var x = 0,
        y = 0;

    var labelPosition = getLabelMid(label);

    // get closest attachment
    var attachment = getAttachment(labelPosition, oldWaypoints),
        oldLabelLineIndex = attachment.segmentIndex,
        newLabelLineIndex = findNewLabelLineStartIndex(oldWaypoints, newWaypoints, attachment, hints);

    if (newLabelLineIndex === null) {
        return { x: x, y: y };
    }

    // should never happen
    // TODO(@janstuemmel): throw an error here when connectionSegmentMove is refactored
    if (newLabelLineIndex < 0 ||
    newLabelLineIndex > newWaypoints.length - 2) {
        return { x: x, y: y };
    }

    var oldLabelLine = getLine(oldWaypoints, oldLabelLineIndex),
        newLabelLine = getLine(newWaypoints, newLabelLineIndex),
        oldFoot = attachment.position;

    var relativeFootPosition = getRelativeFootPosition(oldLabelLine, oldFoot),
        angleDelta = getAngleDelta(oldLabelLine, newLabelLine);

    // special rule if label on bendpoint
    if (attachment.type === 'bendpoint') {

        var offset = newWaypoints.length - oldWaypoints.length,
            oldBendpointIndex = attachment.bendpointIndex,
            oldBendpoint = oldWaypoints[oldBendpointIndex];

        // bendpoint position hasnt changed, return same position
        if (newWaypoints.indexOf(oldBendpoint) !== -1) {
            return { x: x, y: y };
        }

        // new bendpoint and old bendpoint have same index, then just return the offset
        if (offset === 0) {
            var newBendpoint = newWaypoints[oldBendpointIndex];

            return {
                x: newBendpoint.x - attachment.position.x,
                y: newBendpoint.y - attachment.position.y
            };
        }

        // if bendpoints get removed
        if (offset < 0 && oldBendpointIndex !== 0 && oldBendpointIndex < oldWaypoints.length - 1) {
            relativeFootPosition = relativePositionMidWaypoint(oldWaypoints, oldBendpointIndex);
        }
    }

    var newFoot = {
        x: (newLabelLine[1].x - newLabelLine[0].x) * relativeFootPosition + newLabelLine[0].x,
        y: (newLabelLine[1].y - newLabelLine[0].y) * relativeFootPosition + newLabelLine[0].y
    };

    // the rotated vector to label
    var newLabelVector = GeometricUtil.rotateVector({
        x: labelPosition.x - oldFoot.x,
        y: labelPosition.y - oldFoot.y
    }, angleDelta);

    // the new relative position
    x = newFoot.x + newLabelVector.x - labelPosition.x;
    y = newFoot.y + newLabelVector.y - labelPosition.y;

    return { x: x, y: y };
}

module.exports.getLabelAdjustment = getLabelAdjustment;

//// HELPERS ///////

function relativePositionMidWaypoint(waypoints, idx) {

    var distanceSegment1 = getDistancePointPoint(waypoints[idx - 1], waypoints[idx]),
        distanceSegment2 = getDistancePointPoint(waypoints[idx], waypoints[idx + 1]);

    var relativePosition = distanceSegment1 / (distanceSegment1 + distanceSegment2);

    return relativePosition;

}

function getLabelMid(label) {
    return {
        x: label.x + label.width / 2,
        y: label.y + label.height / 2
    };
}

function getAngleDelta(l1, l2) {
    var a1 = GeometricUtil.getAngle(l1),
        a2 = GeometricUtil.getAngle(l2);
    return a2 - a1;
}

function getLine(waypoints, idx) {
    return [waypoints[idx], waypoints[idx + 1]];
}

function getRelativeFootPosition(line, foot) {
    var length = getDistancePointPoint(line[0], line[1]),
        lengthToFoot = getDistancePointPoint(line[0], foot);

    return lengthToFoot / length;
}

},{"./GeometricUtil":21,"./LineAttachmentUtil":23}],23:[function(require,module,exports){
'use strict';

var sqrt = Math.sqrt,
    min = Math.min,
    max = Math.max;

/**
 * Calculate the square (power to two) of a number.
 *
 * @param {Number} n
 *
 * @return {Number}
 */
function sq(n) {
    return Math.pow(n, 2);
}

/**
 * Get distance between two points.
 *
 * @param {Point} p1
 * @param {Point} p2
 *
 * @return {Number}
 */
function getDistance(p1, p2) {
    return sqrt(sq(p1.x - p2.x) + sq(p1.y - p2.y));
}

/**
 * Return the attachment of the given point on the specified line.
 *
 * The attachment is either a bendpoint (attached to the given point)
 * or segment (attached to a location on a line segment) attachment:
 *
 * ```javascript
 * var pointAttachment = {
 *   type: 'bendpoint',
 *   bendpointIndex: 3,
 *   position: { x: 10, y: 10 } // the attach point on the line
 * };
 *
 * var segmentAttachment = {
 *   type: 'segment',
 *   segmentIndex: 2,
 *   relativeLocation: 0.31, // attach point location between 0 (at start) and 1 (at end)
 *   position: { x: 10, y: 10 } // the attach point on the line
 * };
 * ```
 *
 * @param {Point} point
 * @param {Array<Point>} line
 *
 * @return {Object} attachment
 */
function getAttachment(point, line) {

    var idx = 0,
        segmentStart,
        segmentEnd,
        segmentStartDistance,
        segmentEndDistance,
        attachmentPosition,
        minDistance,
        intersections,
        attachment,
        attachmentDistance,
        closestAttachmentDistance,
        closestAttachment;

    for (idx = 0; idx < line.length - 1; idx++) {

        segmentStart = line[idx];
        segmentEnd = line[idx + 1];

        if (pointsEqual(segmentStart, segmentEnd)) {
            continue;
        }

        segmentStartDistance = getDistance(point, segmentStart);
        segmentEndDistance = getDistance(point, segmentEnd);

        minDistance = min(segmentStartDistance, segmentEndDistance);

        intersections = getCircleSegmentIntersections(segmentStart, segmentEnd, point, minDistance);

        if (intersections.length < 1) {
            throw new Error('expected between [1, 2] circle -> line intersections');
        }

        // one intersection -> bendpoint attachment
        if (intersections.length === 1) {
            attachment = {
                type: 'bendpoint',
                position: intersections[0],
                segmentIndex: idx,
                bendpointIndex: pointsEqual(segmentStart, intersections[0]) ? idx : idx + 1
            };
        }

        // two intersections -> segment attachment
        if (intersections.length === 2) {

            attachmentPosition = mid(intersections[0], intersections[1]);

            attachment = {
                type: 'segment',
                position: attachmentPosition,
                segmentIndex: idx,
                relativeLocation: getDistance(segmentStart, attachmentPosition) / getDistance(segmentStart, segmentEnd)
            };
        }

        attachmentDistance = getDistance(attachment.position, point);

        if (!closestAttachment || closestAttachmentDistance > attachmentDistance) {
            closestAttachment = attachment;
            closestAttachmentDistance = attachmentDistance;
        }
    }

    return closestAttachment;
}

module.exports.getAttachment = getAttachment;

/**
 * Gets the intersection between a circle and a line segment.
 *
 * @param {Point} s1 segment start
 * @param {Point} s2 segment end
 * @param {Point} cc circle center
 * @param {Number} cr circle radius
 *
 * @return {Array<Point>} intersections
 */
function getCircleSegmentIntersections(s1, s2, cc, cr) {

    // silently round values
    s1 = roundPoint(s1);
    s2 = roundPoint(s2);
    cc = roundPoint(cc);
    cr = min(getDistance(s1, cc), getDistance(s2, cc));

    var baX = s2.x - s1.x;
    var baY = s2.y - s1.y;
    var caX = cc.x - s1.x;
    var caY = cc.y - s1.y;

    var a = baX * baX + baY * baY;
    var bBy2 = baX * caX + baY * caY;
    var c = caX * caX + caY * caY - cr * cr;

    var pBy2 = bBy2 / a;
    var q = c / a;

    var disc = pBy2 * pBy2 - q;
    if (disc < 0) {
        return [];
    }

    // if disc == 0 ... dealt with later
    var tmpSqrt = sqrt(disc);
    var abScalingFactor1 = -pBy2 + tmpSqrt;
    var abScalingFactor2 = -pBy2 - tmpSqrt;

    var i1 = {
        x: round(s1.x - baX * abScalingFactor1),
        y: round(s1.y - baY * abScalingFactor1)
    };

    if (disc === 0) { // abScalingFactor1 == abScalingFactor2
        return [ i1 ];
    }

    var i2 = {
        x: round(s1.x - baX * abScalingFactor2),
        y: round(s1.y - baY * abScalingFactor2)
    };

    return [ i1, i2 ].filter(function(p) {
        return isPointInSegment(p, s1, s2);
    });
}

function isPointInSegment(p, segmentStart, segmentEnd) {
    return (
        fenced(p.x, segmentStart.x, segmentEnd.x) &&
    fenced(p.y, segmentStart.y, segmentEnd.y)
    );
}

function fenced(n, rangeStart, rangeEnd) {
    return min(rangeStart, rangeEnd) <= n && n <= max(rangeStart, rangeEnd);
}

/**
 * Calculate mid of two points.
 *
 * @param {Point} p1
 * @param {Point} p2
 *
 * @return {Point}
 */
function mid(p1, p2) {

    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
    };
}

function round(n) {
    return Math.round(n * 1000) / 1000;
}

function roundPoint(p) {
    return {
        x: round(p.x),
        y: round(p.y)
    };
}

function pointsEqual(p1, p2) {
    return p1.x === p2.x && p1.y === p2.y;
}

},{}],24:[function(require,module,exports){
'use strict';

var filter = require('lodash/collection/filter');
var Elements = require('diagram-js/lib/util/Elements');

var REGION_INDENTATION = require('../../util/RegionUtil').REGION_INDENTATION,
    PARALLEL_BOTTOM_MARGIN = require('../../util/RegionUtil').PARALLEL_BOTTOM_MARGIN,
    PARALLEL_TOP_MARGIN = require('../../util/RegionUtil').PARALLEL_TOP_MARGIN;

/**
 * A handler that allows us to add a new Region
 * above or below an existing one.
 *
 * @param {Modeling} modeling
 * @param {SpaceTool} spaceTool
 */
function AddRegionHandler(modeling, spaceTool) {
    this._modeling = modeling;
    this._spaceTool = spaceTool;
}

AddRegionHandler.$inject = ['modeling', 'spaceTool'];

module.exports = AddRegionHandler;

AddRegionHandler.prototype.preExecute = function(context) {
    var allAffected,
        regionHeight,
        offset,
        adjustments,
        regionPosition,
        spacePos,
        direction,
        spaceTool = this._spaceTool,
        modeling = this._modeling,
        shape = context.shape,
        location = context.location,
        parallel = shape,
        regionCount = shape.businessObject.regionIds.length;

    // (0) add a Region if we currently got none and are adding to root
    if (regionCount === 0) {
        context.newRegion = modeling.createShape(
            { type: 'region' },
            {
                x: shape.x + REGION_INDENTATION,
                y: shape.y + PARALLEL_TOP_MARGIN,
                width: shape.width - REGION_INDENTATION * 2,
                height: shape.height - PARALLEL_TOP_MARGIN - PARALLEL_BOTTOM_MARGIN
            },
            parallel
        );
    }

    // (1) collect affected elements to create necessary space
    allAffected = [];

    Elements.eachElement(parallel, function(element) {
        allAffected.push(element);

        if (element === shape) {
            return [];
        }

        return filter(element.children, function(c) {
            return c !== shape;
        });
    });
    regionHeight = shape.children[0].height;
    offset = location === 'top' ? -regionHeight : regionHeight;
    regionPosition = location === 'top'
        ? shape.y + PARALLEL_TOP_MARGIN
        : shape.y + shape.height - PARALLEL_BOTTOM_MARGIN;
    spacePos = regionPosition + (location === 'top' ? 10 : -10);
    direction = location === 'top' ? 'n' : 's';

    adjustments = spaceTool.calculateAdjustments(
        allAffected,
        'y',
        offset + PARALLEL_TOP_MARGIN,
        spacePos
    );

    spaceTool.makeSpace(
        adjustments.movingShapes,
        adjustments.resizingShapes,
        { x: 0, y: offset },
        direction
    );

    // (2) create new region at open space
    context.newRegion = modeling.createShape(
        { type: 'region' },
        {
            x: shape.x + REGION_INDENTATION,
            y: regionPosition - (location === 'top' ? regionHeight : 0),
            width: shape.width - REGION_INDENTATION * 2,
            height: regionHeight
        },
        parallel
    );
};

},{"../../util/RegionUtil":43,"diagram-js/lib/util/Elements":169,"lodash/collection/filter":202}],25:[function(require,module,exports){
'use strict';

/**
 * @param {Model} model 
 */
function IdClaimHandler(model) {
    this._model = model;
}

IdClaimHandler.$inject = ['model'];

module.exports = IdClaimHandler;

IdClaimHandler.prototype.execute = function(context) {
    var ids = this._model.ids,
        id = context.id,
        element = context.element,
        claiming = context.claiming;

    if (claiming) {
        ids.claim(id, element);
    } else {
        ids.unclaim(id);
    }
};

/**
 * Command revert implementation.
 */
IdClaimHandler.prototype.revert = function(context) {
    var ids = this._model.ids,
        id = context.id,
        element = context.element,
        claiming = context.claiming;

    if (claiming) {
        ids.unclaim(id);
    } else {
        ids.claim(id, element);
    }
};

},{}],26:[function(require,module,exports){
'use strict';

var LabelUtil = require('../../util/LabelUtil');

/**
 * A handler that updates the text of a WrightJS element.
 */
function UpdateLabelHandler() {

    /**
     * Set the label and return the changed elements.
     *
     * Element parameter can be label itself or connection (i.e. sequence flow).
     *
     * @param {Element} element
     * @param {String} text
     */
    function setText(element, text) {

        // external label if present
        var label = element.label || element,
            labelTarget = element.labelTarget || element;

        if (element.type === 'atomic-state') {
            label.y = labelTarget.y + labelTarget.height + 5;
            label.x = labelTarget.x + Math.ceil(((labelTarget.width - label.width) / 2));
            label.businessObject.gfx.labelBounds.x = label.x;
            label.businessObject.gfx.labelBounds.y = label.y;
        }

        // important: syncronize business object as it has gfx flags
        label.businessObject = labelTarget.businessObject;
        LabelUtil.setLabel(label, text, labelTarget !== label);

        return [label, labelTarget];
    }

    function execute(ctx) {
        ctx.oldLabel = LabelUtil.getLabel(ctx.element);
        return setText(ctx.element, ctx.newLabel);
    }

    function revert(ctx) {
        return setText(ctx.element, ctx.oldLabel);
    }

    this.execute = execute;
    this.revert = revert;
}

module.exports = UpdateLabelHandler;
},{"../../util/LabelUtil":40}],27:[function(require,module,exports){
'use strict';
module.exports = {
    __init__: [ 'modeling', 'elementRenderer', 'elementUpdater', 'elementConnect', 'elementRules'],  
    __depends__: [    
        require('diagram-js/lib/command'),
        require('diagram-js/lib/features/attach-support'),
        require('diagram-js/lib/features/change-support'),
        require('diagram-js/lib/features/create'),
        require('diagram-js/lib/features/label-support'),
        require('diagram-js/lib/features/tooltips'),
        require('diagram-js/lib/i18n/translate'),
        require('diagram-js/lib/features/space-tool'),
        require('diagram-js/lib/features/connect'),
        require('../import'),
        require('./behavior')
    ],
    elementFactory: [ 'type', require('./ElementFactory') ],
    pathMap: [ 'type', require('./PathMap') ],
    elementRenderer: [ 'type', require('./ElementRenderer') ],
    elementUpdater: ['type', require('./ElementUpdater')],
    layouter: ['type', require('./ElementLayouter')],  
    elementRules: [ 'type', require('./ElementRules') ] ,
    elementConnect: [ 'type', require('./ElementConnect') ],
    modeling: ['type', require('./Modeling')],
    connectionDocking: [ 'type', require('diagram-js/lib/layout/CroppingConnectionDocking') ]
};

},{"../import":38,"./ElementConnect":6,"./ElementFactory":7,"./ElementLayouter":8,"./ElementRenderer":9,"./ElementRules":10,"./ElementUpdater":11,"./Modeling":12,"./PathMap":13,"./behavior":20,"diagram-js/lib/command":58,"diagram-js/lib/features/attach-support":70,"diagram-js/lib/features/change-support":78,"diagram-js/lib/features/connect":80,"diagram-js/lib/features/create":84,"diagram-js/lib/features/label-support":93,"diagram-js/lib/features/space-tool":149,"diagram-js/lib/features/tooltips":153,"diagram-js/lib/i18n/translate":157,"diagram-js/lib/layout/CroppingConnectionDocking":160}],28:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign'),
    isArray = require('lodash/lang/isArray'),
    getChildRegions = require('../../util/RegionUtil').getChildRegions,
    hasPrimaryModifier = require('diagram-js/lib/util/Mouse').hasPrimaryModifier;

/**
 * A provider for WrightJS elements context pad
 * @param {EventBus} eventBus
 * @param {ContextPad} contextPad
 * @param {Modeling} modeling
 * @param {Rules} rules
 * @param {Translate} translate
 */
function ContextPadProvider(eventBus, contextPad, modeling, rules, translate) {
    contextPad.registerProvider(this);

    this._contextPad = contextPad;

    this._modeling = modeling;
    this._rules = rules;
    this._translate = translate;

    eventBus.on('create.end', 250, function (event) {
        var shape, entries;
        if (!hasPrimaryModifier(event)) {
            return;
        }

        shape = event.context.shape;
        entries = contextPad.getEntries(shape);

        if (entries.replace) {
            entries.replace.action.click(event, shape);
        }
    });
}

ContextPadProvider.$inject = ['eventBus', 'contextPad', 'modeling', 'rules', 'translate'];

module.exports = ContextPadProvider;

ContextPadProvider.prototype.getContextPadEntries = function (element) {
    var actions = {}, modeling, businessObject, rules, translate, childRegions, deleteAllowed;

    if (element.type === 'label') {
        return actions;
    }

    modeling = this._modeling;
    rules = this._rules;
    translate = this._translate;

    businessObject = element.businessObject;

    function removeElement() {
        modeling.removeElements([element]);
    }
    if (businessObject.type === 'transition' && businessObject.sourceStateId !== businessObject.targetStateId) {
        assign(actions, {
            'remove-bends': {
                group: 'remove-bends',
                className: 'wright-icon-remove-bends',
                title: translate('Remove Bends'),
                action: {
                    click: function (event, element) {
                        modeling.removeBends(element);
                    }
                }
            }
        });
    }
    if (businessObject.type === 'parallel-state') {
        childRegions = getChildRegions(element);
        if (childRegions.length === 0) {
            modeling.addRegion(element, 'bottom');
        }
        assign(actions, {
            'region-insert-above': {
                group: 'region-insert-above',
                className: 'wright-icon-region-insert-above',
                title: translate('Add Region Above'),
                action: {
                    click: function (event, element) {
                        modeling.addRegion(element, 'top');
                    }
                }
            }
        });

        assign(actions, {
            'region-insert-below': {
                group: 'region-insert-below',
                className: 'wright-icon-region-insert-below',
                title: translate('Add Region Below'),
                action: {
                    click: function (event, element) {
                        modeling.addRegion(element, 'bottom');
                    }
                }
            }
        });
    }

    // delete element entry, only show if allowed by rules
    deleteAllowed = rules.allowed('elements.delete', {
        elements: [element]
    });

    if (isArray(deleteAllowed)) {
        // was the element returned as a deletion candidate?
        deleteAllowed = deleteAllowed[0] === element;
    }

    if (deleteAllowed) {
        assign(actions, {
            delete: {
                group: 'edit',
                className: 'wright-icon-trash',
                title: translate('Remove'),
                action: {
                    click: removeElement,
                    dragstart: removeElement
                }
            }
        });
    }
    if (element.type === 'atomic-state') {
        assign(actions, {
            selfconnect: {
                group: 'connect',
                className: 'wright-icon-atomic-self',
                title: translate('Self'),
                action: {
                    click: function (event, element) {
                        var shape = Array.isArray(element) ? element[0] : element;
                        modeling.connect(shape, shape, {
                            type: 'transition',
                            isAuto: false
                        });
                    }
                }
            }
        });
    }
    return actions;
};

},{"../../util/RegionUtil":43,"diagram-js/lib/util/Mouse":176,"lodash/lang/isArray":319,"lodash/object/assign":328}],29:[function(require,module,exports){
'use strict';
module.exports = {
    __init__: ['contextPadProvider'],
    __depends__: [
        require('diagram-js/lib/features/context-pad'),
        require('diagram-js/lib/features/selection'),
        require('diagram-js/lib/features/connect'),
        require('diagram-js/lib/features/create')
    ],
    contextPadProvider: ['type', require('./ContextPadProvider')]
};

},{"./ContextPadProvider":28,"diagram-js/lib/features/connect":80,"diagram-js/lib/features/context-pad":82,"diagram-js/lib/features/create":84,"diagram-js/lib/features/selection":142}],30:[function(require,module,exports){
'use strict';

var inherits = require('inherits');

var baseOrderingProvider = require('diagram-js/lib/features/ordering/OrderingProvider');

var isAny = require('../../util/ModelingUtil').isAny;

var findIndex = require('lodash/array/findIndex');

var find = require('lodash/collection/find');

/**
 * a simple ordering provider that makes sure:
 *
 * elements are ordered by a {level} property
 * 
 */
function OrderingProvider(eventBus, translate) {
    var orders, entry;
    baseOrderingProvider.call(this, eventBus);

    orders = [
        { type: 'root', order: { level: -1 } },
        { type: 'transition', order: { level: 1, containers: ['root'] } }

    ];

    function computeOrder(element) {
        if (element.labelTarget) {
            return { level: 10 };
        }

        entry = find(orders, function (o) {
            return isAny(element, [o.type]);
        });

        return (entry && entry.order) || { level: 1 };
    }

    function getOrder(element) {
        var order = element.order;

        if (!order) {
            element.order = order = computeOrder(element);
        }

        return order;
    }

    function findActualParent(element, newParent, containers) {
        var actualParent = newParent;

        while (actualParent) {
            if (isAny(actualParent, containers)) {
                break;
            }

            actualParent = actualParent.parent;
        }

        if (!actualParent) {
            throw new Error(
                translate('no parent for {element} in {parent}', {
                    element: element.id,
                    parent: newParent.id
                })
            );
        }

        return actualParent;
    }

    this.getOrdering = function (element, newParent) {

        var elementOrder, currentIndex, insertIndex;
        if (newParent.type !== 'transition') {
            elementOrder = getOrder(element), currentIndex, insertIndex;

            if (elementOrder.containers) {
                newParent = findActualParent(element, newParent, elementOrder.containers);
            }

            currentIndex = newParent.children.indexOf(element);

            insertIndex = findIndex(newParent.children, function (child) {
                // do not compare with labels, they are created
                // in the wrong order (right after elements) during import and
                // mess up the positioning.
                if (!element.labelTarget && child.labelTarget) {
                    return false;
                }

                return elementOrder.level < getOrder(child).level;
            });

            // if the element is already in the child list at
            // a smaller index, we need to adjust the insert index.
            // this takes into account that the element is being removed
            // before being re-inserted
            if (insertIndex !== -1) {
                if (currentIndex !== -1 && currentIndex < insertIndex) {
                    insertIndex -= 1;
                }
            }
        }
        return {
            index: insertIndex,
            parent: newParent
        };
    };

}
OrderingProvider.$inject = ['eventBus', 'translate'];

inherits(OrderingProvider, baseOrderingProvider);

module.exports = OrderingProvider;

},{"../../util/ModelingUtil":42,"diagram-js/lib/features/ordering/OrderingProvider":122,"inherits":191,"lodash/array/findIndex":192,"lodash/collection/find":203}],31:[function(require,module,exports){
'use strict';
module.exports = {
    __init__: ['orderingProvider'],
    __depends__: [require('diagram-js/lib/i18n/translate')],
    orderingProvider: ['type', require('./OrderingProvider')]
};

},{"./OrderingProvider":30,"diagram-js/lib/i18n/translate":157}],32:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign');

/**
 * A palette provider for WrightJS elements
 * @param {Palette} palette 
 * @param {Create} create 
 * @param {ElementFactory} elementFactory 
 * @param {SpaceTool} spaceTool 
 * @param {LassoTool} lassoTool 
 * @param {HandTool} handTool 
 * @param {ElementConnect} elementConnect 
 * @param {Translate} translate 
 */
function PaletteProvider(palette, create, elementFactory, elementConnect, translate) {
    this._palette = palette;
    this._create = create;
    this._elementFactory = elementFactory;
    this._elementConnect = elementConnect;
    this._translate = translate;

    palette.registerProvider(this);
}

PaletteProvider.$inject = ['palette', 'create', 'elementFactory', 'elementConnect', 'translate'];

module.exports = PaletteProvider;

PaletteProvider.prototype.getPaletteEntries = function (/*element*/) {
    var actions = {},
        create = this._create,
        elementFactory = this._elementFactory,
        elementConnect = this._elementConnect,
        translate = this._translate;

    function createAction(type, group, className, title, options) {
        function createListener(event) {
            var shape = elementFactory.createShape(
                assign(
                    {
                        type: type
                    },
                    options
                )
            );

            create.start(event, shape);
        }

        return {
            group: group,
            className: className,
            title: title ||
            translate('Create {type}', {
                type: type
            }),
            action: {
                dragstart: createListener,
                click: createListener
            }
        };
    }

    assign(actions, {
        'element-connect-tool': {
            group: 'tools',
            className: 'wright-icon-connection',
            title: translate('Create Transition'),
            action: {
                click: function (event) {
                    elementConnect.toggle(event, {
                        type: 'transition',
                        isAuto: false
                    });
                }
            }
        },
        'element-connect-tool-auto': {
            group: 'tools',
            className: 'wright-icon-connection-auto',
            title: translate('Create Auto Transition'),
            action: {
                click: function (event) {
                    elementConnect.toggle(event, {
                        type: 'transition',
                        isAuto: true
                    });
                }
            }
        },
        'tool-separator': {
            group: 'tools',
            separator: true
        },
        'atomic-state-intermediate': createAction(
            'atomic-state',
            'state',
            'wright-icon-intermediate-state',
            'Create Atomic State',
            {
                state: 'intermediate'
            }
        ),
        'atomic-state-final': createAction('atomic-state', 'state', 'wright-icon-final-state', 'Create Final State', {
            state: 'final'
        }),
        'compound-state': createAction(
            'compound-state',
            'state',
            'wright-icon-compound-state',
            'Create Compound State'
        ),
        'parallel-state': createAction('parallel-state', 'state', 'wright-icon-parallel-state', 'Create Parallel State')
    });

    return actions;
};

},{"lodash/object/assign":328}],33:[function(require,module,exports){
'use strict';
module.exports = {
    __init__: ['paletteProvider'],
    __depends__: [
        require('diagram-js/lib/features/palette'),
        require('diagram-js/lib/features/create'),
        require('diagram-js/lib/features/connect'),
        require('diagram-js/lib/features/global-connect')
    ],
    paletteProvider: ['type', require('./PaletteProvider')]
};

},{"./PaletteProvider":32,"diagram-js/lib/features/connect":80,"diagram-js/lib/features/create":84,"diagram-js/lib/features/global-connect":89,"diagram-js/lib/features/palette":128}],34:[function(require,module,exports){
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

},{"../../util/ModelUtil":41,"./SnappingUtil":35,"diagram-js/lib/features/snapping/SnapUtil":144,"diagram-js/lib/features/snapping/Snapping":145,"diagram-js/lib/layout/LayoutUtil":161,"inherits":191,"lodash/collection/forEach":204,"lodash/object/assign":328}],35:[function(require,module,exports){
'use strict';

var getOrientation = require('diagram-js/lib/layout/LayoutUtil').getOrientation;

function getBoundaryAttachment(position, targetBounds) {
    var orientation = getOrientation(position, targetBounds, -15);

    if (orientation !== 'intersect') {
        return orientation;
    } else {
        return null;
    }
}

module.exports.getBoundaryAttachment = getBoundaryAttachment;

},{"diagram-js/lib/layout/LayoutUtil":161}],36:[function(require,module,exports){
'use strict';
module.exports = {
    __init__: ['snapping'],
    snapping: ['type', require('./Snapping')]
};

},{"./Snapping":34}],37:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign'), map = require('lodash/collection/map');

/**
 * Responsible for generation of JSON in accordance to the workflow created by the user
 *
 * @param {Canvas} canvas
 * @param {ElementFactory} elementFactory
 * @param {ElementRegistry} elementRegistry
 * @param {Model} model
 */
function WrightImporter(canvas, elementFactory, elementRegistry, model) {
    this._canvas = canvas;
    this._elementFactory = elementFactory;
    this._elementRegistry = elementRegistry;
    this._model = model;
}

WrightImporter.$inject = ['canvas', 'elementFactory', 'elementRegistry', 'model'];

module.exports = WrightImporter;

/**
 * Add wright element (semantic) to the canvas onto the
 * specified parent shape.
 */
function add(semantic, parentElement) {
    var element, source, target, bounds, parent, parentSemantic;

    // CONNECTION
    if (semantic.type === 'transition') {
        source = getElement.call(this, semantic.sourceStateId),
        target = getElement.call(this, semantic.targetStateId);

        element = this._elementFactory.createConnection(
            elementData(semantic, {
                source: source,
                target: target,
                waypoints: collectWaypoints(semantic.gfx.waypoints),
                type: semantic.type,
                isAuto: semantic.isAuto
            })
        );

        this._canvas.addConnection(element, this._canvas.getRootElement());

        this._model.setTransition(semantic);

    } else if (
        semantic.type === 'atomic-state' ||
        semantic.type === 'compound-state' ||
        semantic.type === 'parallel-state' ||
        semantic.type === 'region'
    ) {
        bounds = semantic.gfx.stateBounds;

        element = this._elementFactory.createShape(
            elementData(semantic, {
                x: Math.round(bounds.x),
                y: Math.round(bounds.y),
                width: Math.round(bounds.width),
                height: Math.round(bounds.height),
                type: semantic.type,
                state: semantic.state
            })
        );


        if (semantic.parentId === null) {
            parent = this._canvas.getRootElement();
            parent.businessObject = this._model;

            if (semantic.isInitial) {
                this._model.setInitialStateId(semantic.id);
            }
            else if (semantic.isFinal) {
                this._model.addFinalStateId(semantic.id);
            }
        } else {
            parent = getElement.call(this, semantic.parentId);

            if (!parent) {
                parentSemantic = this.definitions.children[semantic.parentId];
                parent = this.add(parentSemantic, parentElement);
            }
        }

        this._canvas.addShape(element, parent);

        this._model.setState(semantic);
    }

    if (semantic.gfx.labelBounds) {
        addLabel.call(this, semantic, element);
    }

    return element;
}

/**
 * add label for an element
 */
function addLabel(semantic, element) {
    var bounds = semantic.gfx.labelBounds;
    var visible = true, label;
    if (semantic.type === 'transition') {
        visible = visible && !semantic.isAuto;
        visible = visible && (typeof semantic.gfx.labelVisible === 'undefined' ? true : semantic.gfx.labelVisible);
        visible = visible && semantic.action;
    } else {
        visible = visible && semantic.name;
    }
    label = this._elementFactory.createLabel(
        elementData(semantic, {
            id: semantic.id + '_label',
            labelTarget: element,
            type: 'label',
            hidden: !visible,
            x: Math.round(bounds.x),
            y: Math.round(bounds.y),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
        })
    );

    return this._canvas.addShape(label, element.parent);
}

function getElement(elementId) {
    return this._elementRegistry.get(elementId);
}

WrightImporter.prototype.import = function (definitions) {

    var current;

    this.definitions = definitions;

    //add states
    for (current in definitions.children) {
        add.call(this, definitions.children[current]);
    }

    //add transitions
    for (current in definitions.transitions) {
        add.call(this, definitions.transitions[current]);
    }
};

function elementData(semantic, attrs) {
    return assign(
        {
            id: semantic.id,
            type: semantic.type,
            businessObject: semantic
        },
        attrs
    );
}

function collectWaypoints(waypoints) {
    return map(waypoints, function (p) {
        return { x: p.x, y: p.y };
    });
}

},{"lodash/collection/map":206,"lodash/object/assign":328}],38:[function(require,module,exports){
'use strict';
module.exports = {
    __depends__: [require('diagram-js/lib/i18n/translate')],
    wrightImporter: ['type', require('./WrightImporter')]
};

},{"./WrightImporter":37,"diagram-js/lib/i18n/translate":157}],39:[function(require,module,exports){
arguments[4][37][0].apply(exports,arguments)
},{"dup":37,"lodash/collection/map":206,"lodash/object/assign":328}],40:[function(require,module,exports){
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

},{"./ModelUtil":41,"lodash/object/assign":328}],41:[function(require,module,exports){
'use strict';

/**
 * Is an element of the given type?
 *
 * @param  {djs.model.Base|ModelElement} element
 * @param  {String} type
 *
 * @return {Boolean}
 */
function is(element, type) {
    var bo = getBusinessObject(element);

    //return bo && (typeof bo.$instanceOf === 'function') && bo.$instanceOf(type);
    return bo && bo.type === type;
}

module.exports.is = is;

/**
 * Return the business object for a given element.
 *
 * @param  {djs.model.Base|ModelElement} element
 *
 * @return {ModelElement}
 */
function getBusinessObject(element) {
    return (element && element.businessObject) || element;
}

function getParent(element) {
    return element && element.getParent || null;
}

module.exports.getBusinessObject = getBusinessObject;

},{}],42:[function(require,module,exports){
'use strict';

var any = require('lodash/collection/any');

var is = require('./ModelUtil').is;

/**
 * Return true if element has any of the given types.
 *
 * @param {djs.model.Base} element
 * @param {Array<String>} types
 *
 * @return {Boolean}
 */
function isAny(element, types) {
    return any(types, function(t) {
        return is(element, t);
    });
}

module.exports.isAny = isAny;

/**
 * Return the parent of the element with any of the given types.
 *
 * @param {djs.model.Base} element
 * @param {String|Array<String>} anyType
 *
 * @return {djs.model.Base}
 */
function getParent(element, anyType) {
    if (typeof anyType === 'string') {
        anyType = [anyType];
    }

    while ((element = element.parent)) {
        if (isAny(element, anyType)) {
            return element;
        }
    }

    return null;
}

module.exports.getParent = getParent;

},{"./ModelUtil":41,"lodash/collection/any":200}],43:[function(require,module,exports){
'use strict';

var is = require('./ModelUtil').is;

var REGION_INDENTATION = 10;
var PARALLEL_TOP_MARGIN = 30;
var PARALLEL_BOTTOM_MARGIN = 10;
module.exports.REGION_INDENTATION = REGION_INDENTATION;
module.exports.PARALLEL_TOP_MARGIN = PARALLEL_TOP_MARGIN;
module.exports.PARALLEL_BOTTOM_MARGIN = PARALLEL_BOTTOM_MARGIN;

/**
 * Return the regions in the given element.
 *
 * @param {djs.model.Shape} shape
 *
 * @return {Array<djs.model.Shape>}
 */
function getChildRegions(shape) {
    return shape.children.filter(function(c) {
        return is(c, 'region') && c.parent.id === shape.id;
    });
}

module.exports.getChildRegions = getChildRegions;

/**
 * Return the immidiate children in the given element.
 *
 * @param {djs.model.Shape} shape
 *
 * @return {Array<djs.model.Shape>}
 */
function getImmediateChildren(shape) {
    return shape.children.filter(function(c) {
        return !isLabel(c) && c.parent.id === shape.id;
    });
}

module.exports.getImmediateChildren = getImmediateChildren;

/**
 * Resize balanced, adjusting next / previous region sizes.
 *
 * @param {djs.model.Shape} shape
 * @param {Bounds} newBounds
 */
function resizeRegionsInParallel(modeling, parallel) {    
    //compute regeions before resizing parallel
    var resizeNeeded = computeRegionsResize(parallel);
    // resize regions
    resizeNeeded.forEach(function(r) {        
        adjustChildren(modeling, r.shape, r.newBounds);
        modeling.resizeShape(r.shape, r.newBounds);
    });
}
module.exports.resizeRegionsInParallel = resizeRegionsInParallel;
/**
 * Compute the required resize operations for regions
 * adjacent to the given shape, assuming it will be
 * resized to the given new bounds.
 *
 * @param {djs.model.Shape} shape
 * @param {Bounds} newBounds
 *
 * @return {Array<Object>}
 */
function computeRegionsResize(parallel) {
    var i = 0,
        regionsHeight = 0,
        affected = [],
        deltaPR = 0;
    var newBounds = getBounds(parallel);
    var regions = getChildRegions(parallel),
        rw = newBounds.width - REGION_INDENTATION * 2,
        rx = newBounds.x + REGION_INDENTATION,
        ry = newBounds.y + PARALLEL_TOP_MARGIN;

    //fix: sorting because it is always appending new region  at bottom of array
    regions.sort(function(a, b) {
        var retval = -1;
        if (a.y < b.y) {
            retval = -1;
        } else if (a.y > b.y) {
            retval = 1;
        } else {
            retval = 0;
        }
        return retval;
    });
    // move regions as needed
    regions.forEach(function(r) {
        var rbounds = {
            height: r.height,
            width: rw,
            x: rx,
            y: ry + i
        };
        regionsHeight += r.height;
        affected.push({
            shape: r,
            newBounds: rbounds
        });
        //that.resizeShape(r, rbounds);
        i = i + r.height;
    });
    //resize last region upto parallel if required
    deltaPR = newBounds.height - regionsHeight - PARALLEL_TOP_MARGIN - PARALLEL_BOTTOM_MARGIN;
    if (affected.length > 0 && deltaPR > 0) {
        i = affected.length - 1;
        affected[i].newBounds.height += deltaPR;
    }
    return affected;
}
module.exports.computeRegionsResize = computeRegionsResize;

function adjustChildren(modeling, shape, newBounds) {
    var children, delta;
    if (newBounds.x!==shape.x || newBounds.y!==shape.y) {        
        children = getImmediateChildren(shape);
        if (shape.children.length > 0) {
            delta = {x: newBounds.x - shape.x, y: newBounds.y - shape.y};        
            children.forEach(function(child) {
                modeling.moveShape(child, delta, shape);                
            });            
        }
    }
}
module.exports.adjustChildren = adjustChildren;

function isLabel(element) {
    return element.type === 'label';
}

function getBounds(shape) {
    return {
        height: shape.height,
        width: shape.width, // left right margin
        x: shape.x,
        y: shape.y
    };
}
module.exports.getBounds = getBounds;

},{"./ModelUtil":41}],44:[function(require,module,exports){
'use strict';
var flatten = require('lodash/array/flatten');

var validate = function (model, constraints, ownerObjectKey) {
    var myError, errors = [], property;

    for (property in constraints) {
        
        if (!constraints[property].optional && !model.hasOwnProperty(property)) {
            myError = {
                'message': constraints[property].propertyName + ' is not specified in ' + ownerObjectKey,
                'target': model,
                'key': property,
                'tag': ownerObjectKey
            };
            errors.push(myError);

            continue;
        }

        myError = callValidators(model, constraints, property, ownerObjectKey);
        if(myError.length > 0)
        {
            errors.push(myError);
        }
    }

    return flatten(errors, true);
};

function callValidators(model, constraints, property, ownerObjectKey) {
    var errors = [], myError, i,  validator;
    if (constraints[property].hasOwnProperty('validators')) {
       
        for ( i = 0; i < constraints[property].validators.length; i++) {
            validator = constraints[property].validators[i];
            myError = validator(model[property], model, property, constraints[property].propertyName, ownerObjectKey);
            if (myError !== null) {
                if (myError.length > 0) {
                    errors.push(myError);
                    break;
                }
            }
        }
    }

    return errors;
}

module.exports = validate;
},{"lodash/array/flatten":193}],45:[function(require,module,exports){
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
},{"./Validator":44,"lodash/array/flatten":193}],46:[function(require,module,exports){
/**
 * Module dependencies.
 */

try {
  var index = require('indexof');
} catch (err) {
  var index = require('component-indexof');
}

/**
 * Whitespace regexp.
 */

var re = /\s+/;

/**
 * toString reference.
 */

var toString = Object.prototype.toString;

/**
 * Wrap `el` in a `ClassList`.
 *
 * @param {Element} el
 * @return {ClassList}
 * @api public
 */

module.exports = function(el){
  return new ClassList(el);
};

/**
 * Initialize a new ClassList for `el`.
 *
 * @param {Element} el
 * @api private
 */

function ClassList(el) {
  if (!el || !el.nodeType) {
    throw new Error('A DOM element reference is required');
  }
  this.el = el;
  this.list = el.classList;
}

/**
 * Add class `name` if not already present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.add = function(name){
  // classList
  if (this.list) {
    this.list.add(name);
    return this;
  }

  // fallback
  var arr = this.array();
  var i = index(arr, name);
  if (!~i) arr.push(name);
  this.el.className = arr.join(' ');
  return this;
};

/**
 * Remove class `name` when present, or
 * pass a regular expression to remove
 * any which match.
 *
 * @param {String|RegExp} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.remove = function(name){
  if ('[object RegExp]' == toString.call(name)) {
    return this.removeMatching(name);
  }

  // classList
  if (this.list) {
    this.list.remove(name);
    return this;
  }

  // fallback
  var arr = this.array();
  var i = index(arr, name);
  if (~i) arr.splice(i, 1);
  this.el.className = arr.join(' ');
  return this;
};

/**
 * Remove all classes matching `re`.
 *
 * @param {RegExp} re
 * @return {ClassList}
 * @api private
 */

ClassList.prototype.removeMatching = function(re){
  var arr = this.array();
  for (var i = 0; i < arr.length; i++) {
    if (re.test(arr[i])) {
      this.remove(arr[i]);
    }
  }
  return this;
};

/**
 * Toggle class `name`, can force state via `force`.
 *
 * For browsers that support classList, but do not support `force` yet,
 * the mistake will be detected and corrected.
 *
 * @param {String} name
 * @param {Boolean} force
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.toggle = function(name, force){
  // classList
  if (this.list) {
    if ("undefined" !== typeof force) {
      if (force !== this.list.toggle(name, force)) {
        this.list.toggle(name); // toggle again to correct
      }
    } else {
      this.list.toggle(name);
    }
    return this;
  }

  // fallback
  if ("undefined" !== typeof force) {
    if (!force) {
      this.remove(name);
    } else {
      this.add(name);
    }
  } else {
    if (this.has(name)) {
      this.remove(name);
    } else {
      this.add(name);
    }
  }

  return this;
};

/**
 * Return an array of classes.
 *
 * @return {Array}
 * @api public
 */

ClassList.prototype.array = function(){
  var className = this.el.getAttribute('class') || '';
  var str = className.replace(/^\s+|\s+$/g, '');
  var arr = str.split(re);
  if ('' === arr[0]) arr.shift();
  return arr;
};

/**
 * Check if class `name` is present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.has =
ClassList.prototype.contains = function(name){
  return this.list
    ? this.list.contains(name)
    : !! ~index(this.array(), name);
};

},{"component-indexof":50,"indexof":50}],47:[function(require,module,exports){
var matches = require('matches-selector')

module.exports = function (element, selector, checkYoSelf, root) {
  element = checkYoSelf ? {parentNode: element} : element

  root = root || document

  // Make sure `element !== document` and `element != null`
  // otherwise we get an illegal invocation
  while ((element = element.parentNode) && element !== document) {
    if (matches(element, selector))
      return element
    // After `matches` on the edge case that
    // the selector matches the root
    // (when the root is not the document)
    if (element === root)
      return
  }
}

},{"matches-selector":51}],48:[function(require,module,exports){
/**
 * Module dependencies.
 */

try {
  var closest = require('closest');
} catch(err) {
  var closest = require('component-closest');
}

try {
  var event = require('event');
} catch(err) {
  var event = require('component-event');
}

/**
 * Delegate event `type` to `selector`
 * and invoke `fn(e)`. A callback function
 * is returned which may be passed to `.unbind()`.
 *
 * @param {Element} el
 * @param {String} selector
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.bind = function(el, selector, type, fn, capture){
  return event.bind(el, type, function(e){
    var target = e.target || e.srcElement;
    e.delegateTarget = closest(target, selector, true, el);
    if (e.delegateTarget) fn.call(el, e);
  }, capture);
};

/**
 * Unbind event `type`'s callback `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @api public
 */

exports.unbind = function(el, type, fn, capture){
  event.unbind(el, type, fn, capture);
};

},{"closest":47,"component-closest":47,"component-event":49,"event":49}],49:[function(require,module,exports){
var bind = window.addEventListener ? 'addEventListener' : 'attachEvent',
    unbind = window.removeEventListener ? 'removeEventListener' : 'detachEvent',
    prefix = bind !== 'addEventListener' ? 'on' : '';

/**
 * Bind `el` event `type` to `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.bind = function(el, type, fn, capture){
  el[bind](prefix + type, fn, capture || false);
  return fn;
};

/**
 * Unbind `el` event `type`'s callback `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.unbind = function(el, type, fn, capture){
  el[unbind](prefix + type, fn, capture || false);
  return fn;
};
},{}],50:[function(require,module,exports){
module.exports = function(arr, obj){
  if (arr.indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}],51:[function(require,module,exports){
/**
 * Module dependencies.
 */

try {
  var query = require('query');
} catch (err) {
  var query = require('component-query');
}

/**
 * Element prototype.
 */

var proto = Element.prototype;

/**
 * Vendor function.
 */

var vendor = proto.matches
  || proto.webkitMatchesSelector
  || proto.mozMatchesSelector
  || proto.msMatchesSelector
  || proto.oMatchesSelector;

/**
 * Expose `match()`.
 */

module.exports = match;

/**
 * Match `el` to `selector`.
 *
 * @param {Element} el
 * @param {String} selector
 * @return {Boolean}
 * @api public
 */

function match(el, selector) {
  if (!el || el.nodeType !== 1) return false;
  if (vendor) return vendor.call(el, selector);
  var nodes = query.all(selector, el.parentNode);
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i] == el) return true;
  }
  return false;
}

},{"component-query":52,"query":52}],52:[function(require,module,exports){
function one(selector, el) {
  return el.querySelector(selector);
}

exports = module.exports = function(selector, el){
  el = el || document;
  return one(selector, el);
};

exports.all = function(selector, el){
  el = el || document;
  return el.querySelectorAll(selector);
};

exports.engine = function(obj){
  if (!obj.one) throw new Error('.one callback required');
  if (!obj.all) throw new Error('.all callback required');
  one = obj.one;
  exports.all = obj.all;
  return exports;
};

},{}],53:[function(require,module,exports){
module.exports = require('./lib/Diagram');
},{"./lib/Diagram":54}],54:[function(require,module,exports){
'use strict';

var di = require('didi');


/**
 * Bootstrap an injector from a list of modules, instantiating a number of default components
 *
 * @ignore
 * @param {Array<didi.Module>} bootstrapModules
 *
 * @return {didi.Injector} a injector to use to access the components
 */
function bootstrap(bootstrapModules) {

  var modules = [],
      components = [];

  function hasModule(m) {
    return modules.indexOf(m) >= 0;
  }

  function addModule(m) {
    modules.push(m);
  }

  function visit(m) {
    if (hasModule(m)) {
      return;
    }

    (m.__depends__ || []).forEach(visit);

    if (hasModule(m)) {
      return;
    }

    addModule(m);

    (m.__init__ || []).forEach(function(c) {
      components.push(c);
    });
  }

  bootstrapModules.forEach(visit);

  var injector = new di.Injector(modules);

  components.forEach(function(c) {

    try {
      // eagerly resolve component (fn or string)
      injector[typeof c === 'string' ? 'get' : 'invoke'](c);
    } catch (e) {
      console.error('Failed to instantiate component');
      console.error(e.stack);

      throw e;
    }
  });

  return injector;
}

/**
 * Creates an injector from passed options.
 *
 * @ignore
 * @param  {Object} options
 * @return {didi.Injector}
 */
function createInjector(options) {

  options = options || {};

  var configModule = {
    'config': ['value', options]
  };

  var coreModule = require('./core');

  var modules = [ configModule, coreModule ].concat(options.modules || []);

  return bootstrap(modules);
}


/**
 * The main diagram-js entry point that bootstraps the diagram with the given
 * configuration.
 *
 * To register extensions with the diagram, pass them as Array<didi.Module> to the constructor.
 *
 * @class djs.Diagram
 * @memberOf djs
 * @constructor
 *
 * @example
 *
 * <caption>Creating a plug-in that logs whenever a shape is added to the canvas.</caption>
 *
 * // plug-in implemenentation
 * function MyLoggingPlugin(eventBus) {
 *   eventBus.on('shape.added', function(event) {
 *     console.log('shape ', event.shape, ' was added to the diagram');
 *   });
 * }
 *
 * // export as module
 * module.exports = {
 *   __init__: [ 'myLoggingPlugin' ],
 *     myLoggingPlugin: [ 'type', MyLoggingPlugin ]
 * };
 *
 *
 * // instantiate the diagram with the new plug-in
 *
 * var diagram = new Diagram({ modules: [ require('path-to-my-logging-plugin') ] });
 *
 * diagram.invoke([ 'canvas', function(canvas) {
 *   // add shape to drawing canvas
 *   canvas.addShape({ x: 10, y: 10 });
 * });
 *
 * // 'shape ... was added to the diagram' logged to console
 *
 * @param {Object} options
 * @param {Array<didi.Module>} [options.modules] external modules to instantiate with the diagram
 * @param {didi.Injector} [injector] an (optional) injector to bootstrap the diagram with
 */
function Diagram(options, injector) {

  // create injector unless explicitly specified
  this.injector = injector = injector || createInjector(options);

  // API

  /**
   * Resolves a diagram service
   *
   * @method Diagram#get
   *
   * @param {String} name the name of the diagram service to be retrieved
   * @param {Boolean} [strict=true] if false, resolve missing services to null
   */
  this.get = injector.get;

  /**
   * Executes a function into which diagram services are injected
   *
   * @method Diagram#invoke
   *
   * @param {Function|Object[]} fn the function to resolve
   * @param {Object} locals a number of locals to use to resolve certain dependencies
   */
  this.invoke = injector.invoke;

  // init

  // indicate via event


  /**
   * An event indicating that all plug-ins are loaded.
   *
   * Use this event to fire other events to interested plug-ins
   *
   * @memberOf Diagram
   *
   * @event diagram.init
   *
   * @example
   *
   * eventBus.on('diagram.init', function() {
   *   eventBus.fire('my-custom-event', { foo: 'BAR' });
   * });
   *
   * @type {Object}
   */
  this.get('eventBus').fire('diagram.init');
}

module.exports = Diagram;


/**
 * Destroys the diagram
 *
 * @method  Diagram#destroy
 */
Diagram.prototype.destroy = function() {
  this.get('eventBus').fire('diagram.destroy');
};

/**
 * Clear the diagram, removing all contents.
 */
Diagram.prototype.clear = function() {
  this.get('eventBus').fire('diagram.clear');
};

},{"./core":64,"didi":184}],55:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign'),
    inherits = require('inherits');

var Refs = require('object-refs');

var parentRefs = new Refs({ name: 'children', enumerable: true, collection: true }, { name: 'parent' }),
    labelRefs = new Refs({ name: 'label', enumerable: true }, { name: 'labelTarget' }),
    attacherRefs = new Refs({ name: 'attachers', collection: true }, { name: 'host' }),
    outgoingRefs = new Refs({ name: 'outgoing', collection: true }, { name: 'source' }),
    incomingRefs = new Refs({ name: 'incoming', collection: true }, { name: 'target' });

/**
 * @namespace djs.model
 */

/**
 * @memberOf djs.model
 */

/**
 * The basic graphical representation
 *
 * @class
 *
 * @abstract
 */
function Base() {

  /**
   * The object that backs up the shape
   *
   * @name Base#businessObject
   * @type Object
   */
  Object.defineProperty(this, 'businessObject', {
    writable: true
  });

  /**
   * The parent shape
   *
   * @name Base#parent
   * @type Shape
   */
  parentRefs.bind(this, 'parent');

  /**
   * @name Base#label
   * @type Label
   */
  labelRefs.bind(this, 'label');

  /**
   * The list of outgoing connections
   *
   * @name Base#outgoing
   * @type Array<Connection>
   */
  outgoingRefs.bind(this, 'outgoing');

  /**
   * The list of incoming connections
   *
   * @name Base#incoming
   * @type Array<Connection>
   */
  incomingRefs.bind(this, 'incoming');
}


/**
 * A graphical object
 *
 * @class
 * @constructor
 *
 * @extends Base
 */
function Shape() {
  Base.call(this);

  /**
   * The list of children
   *
   * @name Shape#children
   * @type Array<Base>
   */
  parentRefs.bind(this, 'children');

  /**
   * @name Shape#host
   * @type Shape
   */
  attacherRefs.bind(this, 'host');

  /**
   * @name Shape#attachers
   * @type Shape
   */
  attacherRefs.bind(this, 'attachers');
}

inherits(Shape, Base);


/**
 * A root graphical object
 *
 * @class
 * @constructor
 *
 * @extends Shape
 */
function Root() {
  Shape.call(this);
}

inherits(Root, Shape);


/**
 * A label for an element
 *
 * @class
 * @constructor
 *
 * @extends Shape
 */
function Label() {
  Shape.call(this);

  /**
   * The labeled element
   *
   * @name Label#labelTarget
   * @type Base
   */
  labelRefs.bind(this, 'labelTarget');
}

inherits(Label, Shape);


/**
 * A connection between two elements
 *
 * @class
 * @constructor
 *
 * @extends Base
 */
function Connection() {
  Base.call(this);

  /**
   * The element this connection originates from
   *
   * @name Connection#source
   * @type Base
   */
  outgoingRefs.bind(this, 'source');

  /**
   * The element this connection points to
   *
   * @name Connection#target
   * @type Base
   */
  incomingRefs.bind(this, 'target');
}

inherits(Connection, Base);


var types = {
  connection: Connection,
  shape: Shape,
  label: Label,
  root: Root
};

/**
 * Creates a new model element of the specified type
 *
 * @method create
 *
 * @example
 *
 * var shape1 = Model.create('shape', { x: 10, y: 10, width: 100, height: 100 });
 * var shape2 = Model.create('shape', { x: 210, y: 210, width: 100, height: 100 });
 *
 * var connection = Model.create('connection', { waypoints: [ { x: 110, y: 55 }, {x: 210, y: 55 } ] });
 *
 * @param  {String} type lower-cased model name
 * @param  {Object} attrs attributes to initialize the new model instance with
 *
 * @return {Base} the new model instance
 */
module.exports.create = function(type, attrs) {
  var Type = types[type];
  if (!Type) {
    throw new Error('unknown type: <' + type + '>');
  }
  return assign(new Type(), attrs);
};


module.exports.Base = Base;
module.exports.Root = Root;
module.exports.Shape = Shape;
module.exports.Connection = Connection;
module.exports.Label = Label;

},{"inherits":191,"lodash/object/assign":328,"object-refs":348}],56:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    isFunction = require('lodash/lang/isFunction'),
    isArray = require('lodash/lang/isArray'),
    isNumber = require('lodash/lang/isNumber');


var DEFAULT_PRIORITY = 1000;


function isObject(element) {
  return typeof element === 'object';
}

/**
 * A utility that can be used to plug-in into the command execution for
 * extension and/or validation.
 *
 * @param {EventBus} eventBus
 *
 * @example
 *
 * var inherits = require('inherits');
 *
 * var CommandInterceptor = require('diagram-js/lib/command/CommandInterceptor');
 *
 * function CommandLogger(eventBus) {
 *   CommandInterceptor.call(this, eventBus);
 *
 *   this.preExecute(function(event) {
 *     console.log('command pre-execute', event);
 *   });
 * }
 *
 * inherits(CommandLogger, CommandInterceptor);
 *
 */
function CommandInterceptor(eventBus) {
  this._eventBus = eventBus;
}

CommandInterceptor.$inject = [ 'eventBus' ];

module.exports = CommandInterceptor;

function unwrapEvent(fn, that) {
  return function(event) {
    return fn.call(that || null, event.context, event.command, event);
  };
}

/**
 * Register an interceptor for a command execution
 *
 * @param {String|Array<String>} [events] list of commands to register on
 * @param {String} [hook] command hook, i.e. preExecute, executed to listen on
 * @param {Number} [priority] the priority on which to hook into the execution
 * @param {Function} handlerFn interceptor to be invoked with (event)
 * @param {Boolean} unwrap if true, unwrap the event and pass (context, command, event) to the
 *                          listener instead
 * @param {Object} [that] Pass context (`this`) to the handler function
 */
CommandInterceptor.prototype.on = function(events, hook, priority, handlerFn, unwrap, that) {

  if (isFunction(hook) || isNumber(hook)) {
    that = unwrap;
    unwrap = handlerFn;
    handlerFn = priority;
    priority = hook;
    hook = null;
  }

  if (isFunction(priority)) {
    that = unwrap;
    unwrap = handlerFn;
    handlerFn = priority;
    priority = DEFAULT_PRIORITY;
  }

  if (isObject(unwrap)) {
    that = unwrap;
    unwrap = false;
  }

  if (!isFunction(handlerFn)) {
    throw new Error('handlerFn must be a function');
  }

  if (!isArray(events)) {
    events = [ events ];
  }

  var eventBus = this._eventBus;

  forEach(events, function(event) {
    // concat commandStack(.event)?(.hook)?
    var fullEvent = [ 'commandStack', event, hook ].filter(function(e) { return e; }).join('.');

    eventBus.on(fullEvent, priority, unwrap ? unwrapEvent(handlerFn, that) : handlerFn, that);
  });
};


var hooks = [
  'canExecute',
  'preExecute',
  'preExecuted',
  'execute',
  'executed',
  'postExecute',
  'postExecuted',
  'revert',
  'reverted'
];

/*
 * Install hook shortcuts
 *
 * This will generate the CommandInterceptor#(preExecute|...|reverted) methods
 * which will in term forward to CommandInterceptor#on.
 */
forEach(hooks, function(hook) {

  /**
   * {canExecute|preExecute|preExecuted|execute|executed|postExecute|postExecuted|revert|reverted}
   *
   * A named hook for plugging into the command execution
   *
   * @param {String|Array<String>} [events] list of commands to register on
   * @param {Number} [priority] the priority on which to hook into the execution
   * @param {Function} handlerFn interceptor to be invoked with (event)
   * @param {Boolean} [unwrap=false] if true, unwrap the event and pass (context, command, event) to the
   *                          listener instead
   * @param {Object} [that] Pass context (`this`) to the handler function
   */
  CommandInterceptor.prototype[hook] = function(events, priority, handlerFn, unwrap, that) {

    if (isFunction(events) || isNumber(events)) {
      that = unwrap;
      unwrap = handlerFn;
      handlerFn = priority;
      priority = events;
      events = null;
    }

    this.on(events, hook, priority, handlerFn, unwrap, that);
  };
});

},{"lodash/collection/forEach":204,"lodash/lang/isArray":319,"lodash/lang/isFunction":320,"lodash/lang/isNumber":322}],57:[function(require,module,exports){
'use strict';

var unique = require('lodash/array/unique'),
    isArray = require('lodash/lang/isArray'),
    assign = require('lodash/object/assign');

var InternalEvent = require('../core/EventBus').Event;


/**
 * A service that offers un- and redoable execution of commands.
 *
 * The command stack is responsible for executing modeling actions
 * in a un- and redoable manner. To do this it delegates the actual
 * command execution to {@link CommandHandler}s.
 *
 * Command handlers provide {@link CommandHandler#execute(ctx)} and
 * {@link CommandHandler#revert(ctx)} methods to un- and redo a command
 * identified by a command context.
 *
 *
 * ## Life-Cycle events
 *
 * In the process the command stack fires a number of life-cycle events
 * that other components to participate in the command execution.
 *
 *    * preExecute
 *    * preExecuted
 *    * execute
 *    * executed
 *    * postExecute
 *    * postExecuted
 *    * revert
 *    * reverted
 *
 * A special event is used for validating, whether a command can be
 * performed prior to its execution.
 *
 *    * canExecute
 *
 * Each of the events is fired as `commandStack.{eventName}` and
 * `commandStack.{commandName}.{eventName}`, respectively. This gives
 * components fine grained control on where to hook into.
 *
 * The event object fired transports `command`, the name of the
 * command and `context`, the command context.
 *
 *
 * ## Creating Command Handlers
 *
 * Command handlers should provide the {@link CommandHandler#execute(ctx)}
 * and {@link CommandHandler#revert(ctx)} methods to implement
 * redoing and undoing of a command.
 *
 * A command handler _must_ ensure undo is performed properly in order
 * not to break the undo chain. It must also return the shapes that
 * got changed during the `execute` and `revert` operations.
 *
 * Command handlers may execute other modeling operations (and thus
 * commands) in their `preExecute` and `postExecute` phases. The command
 * stack will properly group all commands together into a logical unit
 * that may be re- and undone atomically.
 *
 * Command handlers must not execute other commands from within their
 * core implementation (`execute`, `revert`).
 *
 *
 * ## Change Tracking
 *
 * During the execution of the CommandStack it will keep track of all
 * elements that have been touched during the command's execution.
 *
 * At the end of the CommandStack execution it will notify interested
 * components via an 'elements.changed' event with all the dirty
 * elements.
 *
 * The event can be picked up by components that are interested in the fact
 * that elements have been changed. One use case for this is updating
 * their graphical representation after moving / resizing or deletion.
 *
 * @see CommandHandler
 *
 * @param {EventBus} eventBus
 * @param {Injector} injector
 */
function CommandStack(eventBus, injector) {

  /**
   * A map of all registered command handlers.
   *
   * @type {Object}
   */
  this._handlerMap = {};

  /**
   * A stack containing all re/undoable actions on the diagram
   *
   * @type {Array<Object>}
   */
  this._stack = [];

  /**
   * The current index on the stack
   *
   * @type {Number}
   */
  this._stackIdx = -1;

  /**
   * Current active commandStack execution
   *
   * @type {Object}
   */
  this._currentExecution = {
    actions: [],
    dirty: []
  };


  this._injector = injector;
  this._eventBus = eventBus;

  this._uid = 1;

  eventBus.on([ 'diagram.destroy', 'diagram.clear' ], this.clear, this);
}

CommandStack.$inject = [ 'eventBus', 'injector' ];

module.exports = CommandStack;


/**
 * Execute a command
 *
 * @param {String} command the command to execute
 * @param {Object} context the environment to execute the command in
 */
CommandStack.prototype.execute = function(command, context) {
  if (!command) {
    throw new Error('command required');
  }

  var action = { command: command, context: context };

  this._pushAction(action);
  this._internalExecute(action);
  this._popAction(action);
};


/**
 * Ask whether a given command can be executed.
 *
 * Implementors may hook into the mechanism on two ways:
 *
 *   * in event listeners:
 *
 *     Users may prevent the execution via an event listener.
 *     It must prevent the default action for `commandStack.(<command>.)canExecute` events.
 *
 *   * in command handlers:
 *
 *     If the method {@link CommandHandler#canExecute} is implemented in a handler
 *     it will be called to figure out whether the execution is allowed.
 *
 * @param  {String} command the command to execute
 * @param  {Object} context the environment to execute the command in
 *
 * @return {Boolean} true if the command can be executed
 */
CommandStack.prototype.canExecute = function(command, context) {

  var action = { command: command, context: context };

  var handler = this._getHandler(command);

  var result = this._fire(command, 'canExecute', action);

  // handler#canExecute will only be called if no listener
  // decided on a result already
  if (result === undefined) {
    if (!handler) {
      return false;
    }

    if (handler.canExecute) {
      result = handler.canExecute(context);
    }
  }

  return result;
};


/**
 * Clear the command stack, erasing all undo / redo history
 */
CommandStack.prototype.clear = function() {
  this._stack.length = 0;
  this._stackIdx = -1;

  this._fire('changed');
};


/**
 * Undo last command(s)
 */
CommandStack.prototype.undo = function() {
  var action = this._getUndoAction(),
      next;

  if (action) {
    this._pushAction(action);

    while (action) {
      this._internalUndo(action);
      next = this._getUndoAction();

      if (!next || next.id !== action.id) {
        break;
      }

      action = next;
    }

    this._popAction();
  }
};


/**
 * Redo last command(s)
 */
CommandStack.prototype.redo = function() {
  var action = this._getRedoAction(),
      next;

  if (action) {
    this._pushAction(action);

    while (action) {
      this._internalExecute(action, true);
      next = this._getRedoAction();

      if (!next || next.id !== action.id) {
        break;
      }

      action = next;
    }

    this._popAction();
  }
};


/**
 * Register a handler instance with the command stack
 *
 * @param {String} command
 * @param {CommandHandler} handler
 */
CommandStack.prototype.register = function(command, handler) {
  this._setHandler(command, handler);
};


/**
 * Register a handler type with the command stack
 * by instantiating it and injecting its dependencies.
 *
 * @param {String} command
 * @param {Function} a constructor for a {@link CommandHandler}
 */
CommandStack.prototype.registerHandler = function(command, handlerCls) {

  if (!command || !handlerCls) {
    throw new Error('command and handlerCls must be defined');
  }

  var handler = this._injector.instantiate(handlerCls);
  this.register(command, handler);
};

CommandStack.prototype.canUndo = function() {
  return !!this._getUndoAction();
};

CommandStack.prototype.canRedo = function() {
  return !!this._getRedoAction();
};

////// stack access  //////////////////////////////////////

CommandStack.prototype._getRedoAction = function() {
  return this._stack[this._stackIdx + 1];
};


CommandStack.prototype._getUndoAction = function() {
  return this._stack[this._stackIdx];
};


////// internal functionality /////////////////////////////

CommandStack.prototype._internalUndo = function(action) {
  var self = this;

  var command = action.command,
      context = action.context;

  var handler = this._getHandler(command);

  // guard against illegal nested command stack invocations
  this._atomicDo(function() {
    self._fire(command, 'revert', action);

    if (handler.revert) {
      self._markDirty(handler.revert(context));
    }

    self._revertedAction(action);

    self._fire(command, 'reverted', action);
  });
};


CommandStack.prototype._fire = function(command, qualifier, event) {
  if (arguments.length < 3) {
    event = qualifier;
    qualifier = null;
  }

  var names = qualifier ? [ command + '.' + qualifier, qualifier ] : [ command ],
      i, name, result;

  event = assign(new InternalEvent(), event);

  for (i = 0; (name = names[i]); i++) {
    result = this._eventBus.fire('commandStack.' + name, event);

    if (event.cancelBubble) {
      break;
    }
  }

  return result;
};

CommandStack.prototype._createId = function() {
  return this._uid++;
};

CommandStack.prototype._atomicDo = function(fn) {

  var execution = this._currentExecution;

  execution.atomic = true;

  try {
    fn();
  } finally {
    execution.atomic = false;
  }
};

CommandStack.prototype._internalExecute = function(action, redo) {
  var self = this;

  var command = action.command,
      context = action.context;

  var handler = this._getHandler(command);

  if (!handler) {
    throw new Error('no command handler registered for <' + command + '>');
  }

  this._pushAction(action);

  if (!redo) {
    this._fire(command, 'preExecute', action);

    if (handler.preExecute) {
      handler.preExecute(context);
    }

    this._fire(command, 'preExecuted', action);
  }

  // guard against illegal nested command stack invocations
  this._atomicDo(function() {

    self._fire(command, 'execute', action);

    if (handler.execute) {
      // actual execute + mark return results as dirty
      self._markDirty(handler.execute(context));
    }

    // log to stack
    self._executedAction(action, redo);

    self._fire(command, 'executed', action);
  });

  if (!redo) {
    this._fire(command, 'postExecute', action);

    if (handler.postExecute) {
      handler.postExecute(context);
    }

    this._fire(command, 'postExecuted', action);
  }

  this._popAction(action);
};


CommandStack.prototype._pushAction = function(action) {

  var execution = this._currentExecution,
      actions = execution.actions;

  var baseAction = actions[0];

  if (execution.atomic) {
    throw new Error('illegal invocation in <execute> or <revert> phase (action: ' + action.command + ')');
  }

  if (!action.id) {
    action.id = (baseAction && baseAction.id) || this._createId();
  }

  actions.push(action);
};


CommandStack.prototype._popAction = function() {
  var execution = this._currentExecution,
      actions = execution.actions,
      dirty = execution.dirty;

  actions.pop();

  if (!actions.length) {
    this._eventBus.fire('elements.changed', { elements: unique(dirty) });

    dirty.length = 0;

    this._fire('changed');
  }
};


CommandStack.prototype._markDirty = function(elements) {
  var execution = this._currentExecution;

  if (!elements) {
    return;
  }

  elements = isArray(elements) ? elements : [ elements ];

  execution.dirty = execution.dirty.concat(elements);
};


CommandStack.prototype._executedAction = function(action, redo) {
  var stackIdx = ++this._stackIdx;

  if (!redo) {
    this._stack.splice(stackIdx, this._stack.length, action);
  }
};


CommandStack.prototype._revertedAction = function(action) {
  this._stackIdx--;
};


CommandStack.prototype._getHandler = function(command) {
  return this._handlerMap[command];
};

CommandStack.prototype._setHandler = function(command, handler) {
  if (!command || !handler) {
    throw new Error('command and handler required');
  }

  if (this._handlerMap[command]) {
    throw new Error('overriding handler for command <' + command + '>');
  }

  this._handlerMap[command] = handler;
};

},{"../core/EventBus":62,"lodash/array/unique":197,"lodash/lang/isArray":319,"lodash/object/assign":328}],58:[function(require,module,exports){
module.exports = {
  commandStack: [ 'type', require('./CommandStack') ]
};

},{"./CommandStack":57}],59:[function(require,module,exports){
'use strict';

var isNumber = require('lodash/lang/isNumber'),
    assign = require('lodash/object/assign'),
    forEach = require('lodash/collection/forEach'),
    every = require('lodash/collection/every'),
    debounce = require('lodash/function/debounce');

var Collections = require('../util/Collections'),
    Elements = require('../util/Elements');

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClasses = require('tiny-svg/lib/classes'),
    svgCreate = require('tiny-svg/lib/create'),
    svgTransform = require('tiny-svg/lib/transform');

var createMatrix = require('tiny-svg/lib/geometry').createMatrix;


function round(number, resolution) {
  return Math.round(number * resolution) / resolution;
}

function ensurePx(number) {
  return isNumber(number) ? number + 'px' : number;
}

/**
 * Creates a HTML container element for a SVG element with
 * the given configuration
 *
 * @param  {Object} options
 * @return {HTMLElement} the container element
 */
function createContainer(options) {

  options = assign({}, { width: '100%', height: '100%' }, options);

  var container = options.container || document.body;

  // create a <div> around the svg element with the respective size
  // this way we can always get the correct container size
  // (this is impossible for <svg> elements at the moment)
  var parent = document.createElement('div');
  parent.setAttribute('class', 'djs-container');

  assign(parent.style, {
    position: 'relative',
    overflow: 'hidden',
    width: ensurePx(options.width),
    height: ensurePx(options.height)
  });

  container.appendChild(parent);

  return parent;
}

function createGroup(parent, cls) {
  var group = svgCreate('g');
  svgClasses(group).add(cls);

  svgAppend(parent, group);

  return group;
}

var BASE_LAYER = 'base';


var REQUIRED_MODEL_ATTRS = {
  shape: [ 'x', 'y', 'width', 'height' ],
  connection: [ 'waypoints' ]
};

/**
 * The main drawing canvas.
 *
 * @class
 * @constructor
 *
 * @emits Canvas#canvas.init
 *
 * @param {Object} config
 * @param {EventBus} eventBus
 * @param {GraphicsFactory} graphicsFactory
 * @param {ElementRegistry} elementRegistry
 */
function Canvas(config, eventBus, graphicsFactory, elementRegistry) {

  this._eventBus = eventBus;
  this._elementRegistry = elementRegistry;
  this._graphicsFactory = graphicsFactory;

  this._init(config || {});
}

Canvas.$inject = [ 'config.canvas', 'eventBus', 'graphicsFactory', 'elementRegistry' ];

module.exports = Canvas;


Canvas.prototype._init = function(config) {

  var eventBus = this._eventBus;

  // Creates a <svg> element that is wrapped into a <div>.
  // This way we are always able to correctly figure out the size of the svg element
  // by querying the parent node.
  //
  // (It is not possible to get the size of a svg element cross browser @ 2014-04-01)
  //
  // <div class="djs-container" style="width: {desired-width}, height: {desired-height}">
  //   <svg width="100%" height="100%">
  //    ...
  //   </svg>
  // </div>

  // html container
  var container = this._container = createContainer(config);

  var svg = this._svg = svgCreate('svg');
  svgAttr(svg, { width: '100%', height: '100%' });

  svgAppend(container, svg);

  var viewport = this._viewport = createGroup(svg, 'viewport');

  this._layers = {};

  // debounce canvas.viewbox.changed events
  // for smoother diagram interaction
  if (config.deferUpdate !== false) {
    this._viewboxChanged = debounce(this._viewboxChanged, 300);
  }

  eventBus.on('diagram.init', function() {

    /**
     * An event indicating that the canvas is ready to be drawn on.
     *
     * @memberOf Canvas
     *
     * @event canvas.init
     *
     * @type {Object}
     * @property {Snap<SVGSVGElement>} svg the created svg element
     * @property {Snap<SVGGroup>} viewport the direct parent of diagram elements and shapes
     */
    eventBus.fire('canvas.init', {
      svg: svg,
      viewport: viewport
    });

    // fire this in order for certain components to check
    // if they need to be adjusted due the canvas size
    this.resized();

  }, this);

  eventBus.on('diagram.destroy', 500, this._destroy, this);
  eventBus.on('diagram.clear', 500, this._clear, this);
};

Canvas.prototype._destroy = function(emit) {
  this._eventBus.fire('canvas.destroy', {
    svg: this._svg,
    viewport: this._viewport
  });

  var parent = this._container.parentNode;

  if (parent) {
    parent.removeChild(this._container);
  }

  delete this._svg;
  delete this._container;
  delete this._layers;
  delete this._rootElement;
  delete this._viewport;
};

Canvas.prototype._clear = function() {

  var self = this;

  var allElements = this._elementRegistry.getAll();

  // remove all elements
  allElements.forEach(function(element) {
    var type = Elements.getType(element);

    if (type === 'root') {
      self.setRootElement(null, true);
    } else {
      self._removeElement(element, type);
    }
  });

  // force recomputation of view box
  delete this._cachedViewbox;
};

/**
 * Returns the default layer on which
 * all elements are drawn.
 *
 * @returns {Snap<SVGGroup>}
 */
Canvas.prototype.getDefaultLayer = function() {
  return this.getLayer(BASE_LAYER);
};

/**
 * Returns a layer that is used to draw elements
 * or annotations on it.
 *
 * @param  {String} name
 *
 * @returns {Snap<SVGGroup>}
 */
Canvas.prototype.getLayer = function(name) {

  if (!name) {
    throw new Error('must specify a name');
  }

  var layer = this._layers[name];
  if (!layer) {
    layer = this._layers[name] = createGroup(this._viewport, 'layer-' + name);
  }

  return layer;
};


/**
 * Returns the html element that encloses the
 * drawing canvas.
 *
 * @return {DOMNode}
 */
Canvas.prototype.getContainer = function() {
  return this._container;
};


/////////////// markers ///////////////////////////////////

Canvas.prototype._updateMarker = function(element, marker, add) {
  var container;

  if (!element.id) {
    element = this._elementRegistry.get(element);
  }

  // we need to access all
  container = this._elementRegistry._elements[element.id];

  if (!container) {
    return;
  }

  forEach([ container.gfx, container.secondaryGfx ], function(gfx) {
    if (gfx) {
      // invoke either addClass or removeClass based on mode
      if (add) {
        svgClasses(gfx).add(marker);
      } else {
        svgClasses(gfx).remove(marker);
      }
    }
  });

  /**
   * An event indicating that a marker has been updated for an element
   *
   * @event element.marker.update
   * @type {Object}
   * @property {djs.model.Element} element the shape
   * @property {Object} gfx the graphical representation of the shape
   * @property {String} marker
   * @property {Boolean} add true if the marker was added, false if it got removed
   */
  this._eventBus.fire('element.marker.update', { element: element, gfx: container.gfx, marker: marker, add: !!add });
};


/**
 * Adds a marker to an element (basically a css class).
 *
 * Fires the element.marker.update event, making it possible to
 * integrate extension into the marker life-cycle, too.
 *
 * @example
 * canvas.addMarker('foo', 'some-marker');
 *
 * var fooGfx = canvas.getGraphics('foo');
 *
 * fooGfx; // <g class="... some-marker"> ... </g>
 *
 * @param {String|djs.model.Base} element
 * @param {String} marker
 */
Canvas.prototype.addMarker = function(element, marker) {
  this._updateMarker(element, marker, true);
};


/**
 * Remove a marker from an element.
 *
 * Fires the element.marker.update event, making it possible to
 * integrate extension into the marker life-cycle, too.
 *
 * @param  {String|djs.model.Base} element
 * @param  {String} marker
 */
Canvas.prototype.removeMarker = function(element, marker) {
  this._updateMarker(element, marker, false);
};

/**
 * Check the existence of a marker on element.
 *
 * @param  {String|djs.model.Base} element
 * @param  {String} marker
 */
Canvas.prototype.hasMarker = function(element, marker) {
  if (!element.id) {
    element = this._elementRegistry.get(element);
  }

  var gfx = this.getGraphics(element);

  return svgClasses(gfx).has(marker);
};

/**
 * Toggles a marker on an element.
 *
 * Fires the element.marker.update event, making it possible to
 * integrate extension into the marker life-cycle, too.
 *
 * @param  {String|djs.model.Base} element
 * @param  {String} marker
 */
Canvas.prototype.toggleMarker = function(element, marker) {
  if (this.hasMarker(element, marker)) {
    this.removeMarker(element, marker);
  } else {
    this.addMarker(element, marker);
  }
};

Canvas.prototype.getRootElement = function() {
  if (!this._rootElement) {
    this.setRootElement({ id: '__implicitroot', children: [] });
  }

  return this._rootElement;
};



//////////////// root element handling ///////////////////////////

/**
 * Sets a given element as the new root element for the canvas
 * and returns the new root element.
 *
 * @param {Object|djs.model.Root} element
 * @param {Boolean} [override] whether to override the current root element, if any
 *
 * @return {Object|djs.model.Root} new root element
 */
Canvas.prototype.setRootElement = function(element, override) {

  if (element) {
    this._ensureValid('root', element);
  }

  var currentRoot = this._rootElement,
      elementRegistry = this._elementRegistry,
      eventBus = this._eventBus;

  if (currentRoot) {
    if (!override) {
      throw new Error('rootElement already set, need to specify override');
    }

    // simulate element remove event sequence
    eventBus.fire('root.remove', { element: currentRoot });
    eventBus.fire('root.removed', { element: currentRoot });

    elementRegistry.remove(currentRoot);
  }

  if (element) {
    var gfx = this.getDefaultLayer();

    // resemble element add event sequence
    eventBus.fire('root.add', { element: element });

    elementRegistry.add(element, gfx, this._svg);

    eventBus.fire('root.added', { element: element, gfx: gfx });
  }

  this._rootElement = element;

  return element;
};



///////////// add functionality ///////////////////////////////

Canvas.prototype._ensureValid = function(type, element) {
  if (!element.id) {
    throw new Error('element must have an id');
  }

  if (this._elementRegistry.get(element.id)) {
    throw new Error('element with id ' + element.id + ' already exists');
  }

  var requiredAttrs = REQUIRED_MODEL_ATTRS[type];

  var valid = every(requiredAttrs, function(attr) {
    return typeof element[attr] !== 'undefined';
  });

  if (!valid) {
    throw new Error(
      'must supply { ' + requiredAttrs.join(', ') + ' } with ' + type);
  }
};

Canvas.prototype._setParent = function(element, parent, parentIndex) {
  Collections.add(parent.children, element, parentIndex);
  element.parent = parent;
};

/**
 * Adds an element to the canvas.
 *
 * This wires the parent <-> child relationship between the element and
 * a explicitly specified parent or an implicit root element.
 *
 * During add it emits the events
 *
 *  * <{type}.add> (element, parent)
 *  * <{type}.added> (element, gfx)
 *
 * Extensions may hook into these events to perform their magic.
 *
 * @param {String} type
 * @param {Object|djs.model.Base} element
 * @param {Object|djs.model.Base} [parent]
 * @param {Number} [parentIndex]
 *
 * @return {Object|djs.model.Base} the added element
 */
Canvas.prototype._addElement = function(type, element, parent, parentIndex) {

  parent = parent || this.getRootElement();

  var eventBus = this._eventBus,
      graphicsFactory = this._graphicsFactory;

  this._ensureValid(type, element);

  eventBus.fire(type + '.add', { element: element, parent: parent });

  this._setParent(element, parent, parentIndex);

  // create graphics
  var gfx = graphicsFactory.create(type, element);

  this._elementRegistry.add(element, gfx);

  // update its visual
  graphicsFactory.update(type, element, gfx);

  eventBus.fire(type + '.added', { element: element, gfx: gfx });

  return element;
};

/**
 * Adds a shape to the canvas
 *
 * @param {Object|djs.model.Shape} shape to add to the diagram
 * @param {djs.model.Base} [parent]
 * @param {Number} [parentIndex]
 *
 * @return {djs.model.Shape} the added shape
 */
Canvas.prototype.addShape = function(shape, parent, parentIndex) {
  return this._addElement('shape', shape, parent, parentIndex);
};

/**
 * Adds a connection to the canvas
 *
 * @param {Object|djs.model.Connection} connection to add to the diagram
 * @param {djs.model.Base} [parent]
 * @param {Number} [parentIndex]
 *
 * @return {djs.model.Connection} the added connection
 */
Canvas.prototype.addConnection = function(connection, parent, parentIndex) {
  return this._addElement('connection', connection, parent, parentIndex);
};


/**
 * Internal remove element
 */
Canvas.prototype._removeElement = function(element, type) {

  var elementRegistry = this._elementRegistry,
      graphicsFactory = this._graphicsFactory,
      eventBus = this._eventBus;

  element = elementRegistry.get(element.id || element);

  if (!element) {
    // element was removed already
    return;
  }

  eventBus.fire(type + '.remove', { element: element });

  graphicsFactory.remove(element);

  // unset parent <-> child relationship
  Collections.remove(element.parent && element.parent.children, element);
  element.parent = null;

  eventBus.fire(type + '.removed', { element: element });

  elementRegistry.remove(element);

  return element;
};


/**
 * Removes a shape from the canvas
 *
 * @param {String|djs.model.Shape} shape or shape id to be removed
 *
 * @return {djs.model.Shape} the removed shape
 */
Canvas.prototype.removeShape = function(shape) {

  /**
   * An event indicating that a shape is about to be removed from the canvas.
   *
   * @memberOf Canvas
   *
   * @event shape.remove
   * @type {Object}
   * @property {djs.model.Shape} element the shape descriptor
   * @property {Object} gfx the graphical representation of the shape
   */

  /**
   * An event indicating that a shape has been removed from the canvas.
   *
   * @memberOf Canvas
   *
   * @event shape.removed
   * @type {Object}
   * @property {djs.model.Shape} element the shape descriptor
   * @property {Object} gfx the graphical representation of the shape
   */
  return this._removeElement(shape, 'shape');
};


/**
 * Removes a connection from the canvas
 *
 * @param {String|djs.model.Connection} connection or connection id to be removed
 *
 * @return {djs.model.Connection} the removed connection
 */
Canvas.prototype.removeConnection = function(connection) {

  /**
   * An event indicating that a connection is about to be removed from the canvas.
   *
   * @memberOf Canvas
   *
   * @event connection.remove
   * @type {Object}
   * @property {djs.model.Connection} element the connection descriptor
   * @property {Object} gfx the graphical representation of the connection
   */

  /**
   * An event indicating that a connection has been removed from the canvas.
   *
   * @memberOf Canvas
   *
   * @event connection.removed
   * @type {Object}
   * @property {djs.model.Connection} element the connection descriptor
   * @property {Object} gfx the graphical representation of the connection
   */
  return this._removeElement(connection, 'connection');
};


/**
 * Return the graphical object underlaying a certain diagram element
 *
 * @param {String|djs.model.Base} element descriptor of the element
 * @param {Boolean} [secondary=false] whether to return the secondary connected element
 *
 * @return {SVGElement}
 */
Canvas.prototype.getGraphics = function(element, secondary) {
  return this._elementRegistry.getGraphics(element, secondary);
};


/**
 * Perform a viewbox update via a given change function.
 *
 * @param {Function} changeFn
 */
Canvas.prototype._changeViewbox = function(changeFn) {

  // notify others of the upcoming viewbox change
  this._eventBus.fire('canvas.viewbox.changing');

  // perform actual change
  changeFn.apply(this);

  // reset the cached viewbox so that
  // a new get operation on viewbox or zoom
  // triggers a viewbox re-computation
  this._cachedViewbox = null;

  // notify others of the change; this step
  // may or may not be debounced
  this._viewboxChanged();
};

Canvas.prototype._viewboxChanged = function() {
  this._eventBus.fire('canvas.viewbox.changed', { viewbox: this.viewbox() });
};


/**
 * Gets or sets the view box of the canvas, i.e. the
 * area that is currently displayed.
 *
 * The getter may return a cached viewbox (if it is currently
 * changing). To force a recomputation, pass `false` as the first argument.
 *
 * @example
 *
 * canvas.viewbox({ x: 100, y: 100, width: 500, height: 500 })
 *
 * // sets the visible area of the diagram to (100|100) -> (600|100)
 * // and and scales it according to the diagram width
 *
 * var viewbox = canvas.viewbox(); // pass `false` to force recomputing the box.
 *
 * console.log(viewbox);
 * // {
 * //   inner: Dimensions,
 * //   outer: Dimensions,
 * //   scale,
 * //   x, y,
 * //   width, height
 * // }
 *
 * // if the current diagram is zoomed and scrolled, you may reset it to the
 * // default zoom via this method, too:
 *
 * var zoomedAndScrolledViewbox = canvas.viewbox();
 *
 * canvas.viewbox({
 *   x: 0,
 *   y: 0,
 *   width: zoomedAndScrolledViewbox.outer.width,
 *   height: zoomedAndScrolledViewbox.outer.height
 * });
 *
 * @param  {Object} [box] the new view box to set
 * @param  {Number} box.x the top left X coordinate of the canvas visible in view box
 * @param  {Number} box.y the top left Y coordinate of the canvas visible in view box
 * @param  {Number} box.width the visible width
 * @param  {Number} box.height
 *
 * @return {Object} the current view box
 */
Canvas.prototype.viewbox = function(box) {

  if (box === undefined && this._cachedViewbox) {
    return this._cachedViewbox;
  }

  var viewport = this._viewport,
      innerBox,
      outerBox = this.getSize(),
      matrix,
      scale,
      x, y;

  if (!box) {
    // compute the inner box based on the
    // diagrams default layer. This allows us to exclude
    // external components, such as overlays
    innerBox = this.getDefaultLayer().getBBox();

    var transform = svgTransform(viewport);
    matrix = transform ? transform.matrix : createMatrix();
    scale = round(matrix.a, 1000);

    x = round(-matrix.e || 0, 1000);
    y = round(-matrix.f || 0, 1000);

    box = this._cachedViewbox = {
      x: x ? x / scale : 0,
      y: y ? y / scale : 0,
      width: outerBox.width / scale,
      height: outerBox.height / scale,
      scale: scale,
      inner: {
        width: innerBox.width,
        height: innerBox.height,
        x: innerBox.x,
        y: innerBox.y
      },
      outer: outerBox
    };

    return box;
  } else {

    this._changeViewbox(function() {
      scale = Math.min(outerBox.width / box.width, outerBox.height / box.height);

      var matrix = this._svg.createSVGMatrix()
        .scale(scale)
        .translate(-box.x, -box.y);

      svgTransform(viewport, matrix);
    });
  }

  return box;
};


/**
 * Gets or sets the scroll of the canvas.
 *
 * @param {Object} [delta] the new scroll to apply.
 *
 * @param {Number} [delta.dx]
 * @param {Number} [delta.dy]
 */
Canvas.prototype.scroll = function(delta) {

  var node = this._viewport;
  var matrix = node.getCTM();

  if (delta) {
    this._changeViewbox(function() {
      delta = assign({ dx: 0, dy: 0 }, delta || {});

      matrix = this._svg.createSVGMatrix().translate(delta.dx, delta.dy).multiply(matrix);

      setCTM(node, matrix);
    });
  }

  return { x: matrix.e, y: matrix.f };
};


/**
 * Gets or sets the current zoom of the canvas, optionally zooming
 * to the specified position.
 *
 * The getter may return a cached zoom level. Call it with `false` as
 * the first argument to force recomputation of the current level.
 *
 * @param {String|Number} [newScale] the new zoom level, either a number, i.e. 0.9,
 *                                   or `fit-viewport` to adjust the size to fit the current viewport
 * @param {String|Point} [center] the reference point { x: .., y: ..} to zoom to, 'auto' to zoom into mid or null
 *
 * @return {Number} the current scale
 */
Canvas.prototype.zoom = function(newScale, center) {

  if (!newScale) {
    return this.viewbox(newScale).scale;
  }

  if (newScale === 'fit-viewport') {
    return this._fitViewport(center);
  }

  var outer,
      matrix;

  this._changeViewbox(function() {

    if (typeof center !== 'object') {
      outer = this.viewbox().outer;

      center = {
        x: outer.width / 2,
        y: outer.height / 2
      };
    }

    matrix = this._setZoom(newScale, center);
  });

  return round(matrix.a, 1000);
};

function setCTM(node, m) {
  var mstr = 'matrix(' + m.a + ',' + m.b + ',' + m.c + ',' + m.d + ',' + m.e + ',' + m.f + ')';
  node.setAttribute('transform', mstr);
}

Canvas.prototype._fitViewport = function(center) {

  var vbox = this.viewbox(),
      outer = vbox.outer,
      inner = vbox.inner,
      newScale,
      newViewbox;

  // display the complete diagram without zooming in.
  // instead of relying on internal zoom, we perform a
  // hard reset on the canvas viewbox to realize this
  //
  // if diagram does not need to be zoomed in, we focus it around
  // the diagram origin instead

  if (inner.x >= 0 &&
      inner.y >= 0 &&
      inner.x + inner.width <= outer.width &&
      inner.y + inner.height <= outer.height &&
      !center) {

    newViewbox = {
      x: 0,
      y: 0,
      width: Math.max(inner.width + inner.x, outer.width),
      height: Math.max(inner.height + inner.y, outer.height)
    };
  } else {

    newScale = Math.min(1, outer.width / inner.width, outer.height / inner.height);
    newViewbox = {
      x: inner.x + (center ? inner.width / 2 - outer.width / newScale / 2 : 0),
      y: inner.y + (center ? inner.height / 2 - outer.height / newScale / 2 : 0),
      width: outer.width / newScale,
      height: outer.height / newScale
    };
  }

  this.viewbox(newViewbox);

  return this.viewbox(false).scale;
};


Canvas.prototype._setZoom = function(scale, center) {

  var svg = this._svg,
      viewport = this._viewport;

  var matrix = svg.createSVGMatrix();
  var point = svg.createSVGPoint();

  var centerPoint,
      originalPoint,
      currentMatrix,
      scaleMatrix,
      newMatrix;

  currentMatrix = viewport.getCTM();

  var currentScale = currentMatrix.a;

  if (center) {
    centerPoint = assign(point, center);

    // revert applied viewport transformations
    originalPoint = centerPoint.matrixTransform(currentMatrix.inverse());

    // create scale matrix
    scaleMatrix = matrix
                    .translate(originalPoint.x, originalPoint.y)
                    .scale(1 / currentScale * scale)
                    .translate(-originalPoint.x, -originalPoint.y);

    newMatrix = currentMatrix.multiply(scaleMatrix);
  } else {
    newMatrix = matrix.scale(scale);
  }

  setCTM(this._viewport, newMatrix);

  return newMatrix;
};


/**
 * Returns the size of the canvas
 *
 * @return {Dimensions}
 */
Canvas.prototype.getSize = function() {
  return {
    width: this._container.clientWidth,
    height: this._container.clientHeight
  };
};


/**
 * Return the absolute bounding box for the given element
 *
 * The absolute bounding box may be used to display overlays in the
 * callers (browser) coordinate system rather than the zoomed in/out
 * canvas coordinates.
 *
 * @param  {ElementDescriptor} element
 * @return {Bounds} the absolute bounding box
 */
Canvas.prototype.getAbsoluteBBox = function(element) {
  var vbox = this.viewbox();
  var bbox;

  // connection
  // use svg bbox
  if (element.waypoints) {
    var gfx = this.getGraphics(element);

    var transformBBox = gfx.getBBox(true);
    bbox = gfx.getBBox();

    bbox.x -= transformBBox.x;
    bbox.y -= transformBBox.y;

    bbox.width += 2 * transformBBox.x;
    bbox.height +=  2 * transformBBox.y;
  }
  // shapes
  // use data
  else {
    bbox = element;
  }

  var x = bbox.x * vbox.scale - vbox.x * vbox.scale;
  var y = bbox.y * vbox.scale - vbox.y * vbox.scale;

  var width = bbox.width * vbox.scale;
  var height = bbox.height * vbox.scale;

  return {
    x: x,
    y: y,
    width: width,
    height: height
  };
};

/**
 * Fires an event in order other modules can react to the
 * canvas resizing
 */
Canvas.prototype.resized = function() {

  // force recomputation of view box
  delete this._cachedViewbox;

  this._eventBus.fire('canvas.resized');
};

},{"../util/Collections":167,"../util/Elements":169,"lodash/collection/every":201,"lodash/collection/forEach":204,"lodash/function/debounce":213,"lodash/lang/isNumber":322,"lodash/object/assign":328,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/create":357,"tiny-svg/lib/geometry":358,"tiny-svg/lib/transform":360}],60:[function(require,module,exports){
'use strict';

var Model = require('../model');

var assign = require('lodash/object/assign');

/**
 * A factory for diagram-js shapes
 */
function ElementFactory() {
  this._uid = 12;
}

module.exports = ElementFactory;


ElementFactory.prototype.createRoot = function(attrs) {
  return this.create('root', attrs);
};

ElementFactory.prototype.createLabel = function(attrs) {
  return this.create('label', attrs);
};

ElementFactory.prototype.createShape = function(attrs) {
  return this.create('shape', attrs);
};

ElementFactory.prototype.createConnection = function(attrs) {
  return this.create('connection', attrs);
};

/**
 * Create a model element with the given type and
 * a number of pre-set attributes.
 *
 * @param  {String} type
 * @param  {Object} attrs
 * @return {djs.model.Base} the newly created model instance
 */
ElementFactory.prototype.create = function(type, attrs) {

  attrs = assign({}, attrs || {});

  if (!attrs.id) {
    attrs.id = type + '_' + (this._uid++);
  }

  return Model.create(type, attrs);
};
},{"../model":163,"lodash/object/assign":328}],61:[function(require,module,exports){
'use strict';

var ELEMENT_ID = 'data-element-id';

var svgAttr = require('tiny-svg/lib/attr');


/**
 * @class
 *
 * A registry that keeps track of all shapes in the diagram.
 */
function ElementRegistry(eventBus) {
  this._elements = {};

  this._eventBus = eventBus;
}

ElementRegistry.$inject = [ 'eventBus' ];

module.exports = ElementRegistry;

/**
 * Register a pair of (element, gfx, (secondaryGfx)).
 *
 * @param {djs.model.Base} element
 * @param {SVGElement} gfx
 * @param {SVGElement} [secondaryGfx] optional other element to register, too
 */
ElementRegistry.prototype.add = function(element, gfx, secondaryGfx) {

  var id = element.id;

  this._validateId(id);

  // associate dom node with element
  svgAttr(gfx, ELEMENT_ID, id);

  if (secondaryGfx) {
    svgAttr(secondaryGfx, ELEMENT_ID, id);
  }

  this._elements[id] = { element: element, gfx: gfx, secondaryGfx: secondaryGfx };
};

/**
 * Removes an element from the registry.
 *
 * @param {djs.model.Base} element
 */
ElementRegistry.prototype.remove = function(element) {
  var elements = this._elements,
      id = element.id || element,
      container = id && elements[id];

  if (container) {

    // unset element id on gfx
    svgAttr(container.gfx, ELEMENT_ID, '');

    if (container.secondaryGfx) {
      svgAttr(container.secondaryGfx, ELEMENT_ID, '');
    }

    delete elements[id];
  }
};

/**
 * Update the id of an element
 *
 * @param {djs.model.Base} element
 * @param {String} newId
 */
ElementRegistry.prototype.updateId = function(element, newId) {

  this._validateId(newId);

  if (typeof element === 'string') {
    element = this.get(element);
  }

  this._eventBus.fire('element.updateId', {
    element: element,
    newId: newId
  });

  var gfx = this.getGraphics(element),
      secondaryGfx = this.getGraphics(element, true);

  this.remove(element);

  element.id = newId;

  this.add(element, gfx, secondaryGfx);
};

/**
 * Return the model element for a given id or graphics.
 *
 * @example
 *
 * elementRegistry.get('SomeElementId_1');
 * elementRegistry.get(gfx);
 *
 *
 * @param {String|SVGElement} filter for selecting the element
 *
 * @return {djs.model.Base}
 */
ElementRegistry.prototype.get = function(filter) {
  var id;

  if (typeof filter === 'string') {
    id = filter;
  } else {
    id = filter && svgAttr(filter, ELEMENT_ID);
  }

  var container = this._elements[id];
  return container && container.element;
};

/**
 * Return all elements that match a given filter function.
 *
 * @param {Function} fn
 *
 * @return {Array<djs.model.Base>}
 */
ElementRegistry.prototype.filter = function(fn) {

  var filtered = [];

  this.forEach(function(element, gfx) {
    if (fn(element, gfx)) {
      filtered.push(element);
    }
  });

  return filtered;
};

/**
 * Return all rendered model elements.
 *
 * @return {Array<djs.model.Base>}
 */
ElementRegistry.prototype.getAll = function() {
  return this.filter(function(e) { return e; });
};

/**
 * Iterate over all diagram elements.
 *
 * @param {Function} fn
 */
ElementRegistry.prototype.forEach = function(fn) {

  var map = this._elements;

  Object.keys(map).forEach(function(id) {
    var container = map[id],
        element = container.element,
        gfx = container.gfx;

    return fn(element, gfx);
  });
};

/**
 * Return the graphical representation of an element or its id.
 *
 * @example
 * elementRegistry.getGraphics('SomeElementId_1');
 * elementRegistry.getGraphics(rootElement); // <g ...>
 *
 * elementRegistry.getGraphics(rootElement, true); // <svg ...>
 *
 *
 * @param {String|djs.model.Base} filter
 * @param {Boolean} [secondary=false] whether to return the secondary connected element
 *
 * @return {SVGElement}
 */
ElementRegistry.prototype.getGraphics = function(filter, secondary) {
  var id = filter.id || filter;

  var container = this._elements[id];
  return container && (secondary ? container.secondaryGfx : container.gfx);
};

/**
 * Validate the suitability of the given id and signals a problem
 * with an exception.
 *
 * @param {String} id
 *
 * @throws {Error} if id is empty or already assigned
 */
ElementRegistry.prototype._validateId = function(id) {
  if (!id) {
    throw new Error('element must have an id');
  }

  if (this._elements[id]) {
    throw new Error('element with id ' + id + ' already added');
  }
};

},{"tiny-svg/lib/attr":353}],62:[function(require,module,exports){
'use strict';

var isFunction = require('lodash/lang/isFunction'),
    isArray = require('lodash/lang/isArray'),
    isNumber = require('lodash/lang/isNumber'),
    bind = require('lodash/function/bind'),
    assign = require('lodash/object/assign');

var FN_REF = '__fn';

var DEFAULT_PRIORITY = 1000;

var slice = Array.prototype.slice;

/**
 * A general purpose event bus.
 *
 * This component is used to communicate across a diagram instance.
 * Other parts of a diagram can use it to listen to and broadcast events.
 *
 *
 * ## Registering for Events
 *
 * The event bus provides the {@link EventBus#on} and {@link EventBus#once}
 * methods to register for events. {@link EventBus#off} can be used to
 * remove event registrations. Listeners receive an instance of {@link Event}
 * as the first argument. It allows them to hook into the event execution.
 *
 * ```javascript
 *
 * // listen for event
 * eventBus.on('foo', function(event) {
 *
 *   // access event type
 *   event.type; // 'foo'
 *
 *   // stop propagation to other listeners
 *   event.stopPropagation();
 *
 *   // prevent event default
 *   event.preventDefault();
 * });
 *
 * // listen for event with custom payload
 * eventBus.on('bar', function(event, payload) {
 *   console.log(payload);
 * });
 *
 * // listen for event returning value
 * eventBus.on('foobar', function(event) {
 *
 *   // stop event propagation + prevent default
 *   return false;
 *
 *   // stop event propagation + return custom result
 *   return {
 *     complex: 'listening result'
 *   };
 * });
 *
 *
 * // listen with custom priority (default=1000, higher is better)
 * eventBus.on('priorityfoo', 1500, function(event) {
 *   console.log('invoked first!');
 * });
 *
 *
 * // listen for event and pass the context (`this`)
 * eventBus.on('foobar', function(event) {
 *   this.foo();
 * }, this);
 * ```
 *
 *
 * ## Emitting Events
 *
 * Events can be emitted via the event bus using {@link EventBus#fire}.
 *
 * ```javascript
 *
 * // false indicates that the default action
 * // was prevented by listeners
 * if (eventBus.fire('foo') === false) {
 *   console.log('default has been prevented!');
 * };
 *
 *
 * // custom args + return value listener
 * eventBus.on('sum', function(event, a, b) {
 *   return a + b;
 * });
 *
 * // you can pass custom arguments + retrieve result values.
 * var sum = eventBus.fire('sum', 1, 2);
 * console.log(sum); // 3
 * ```
 */
function EventBus() {
  this._listeners = {};

  // cleanup on destroy on lowest priority to allow
  // message passing until the bitter end
  this.on('diagram.destroy', 1, this._destroy, this);
}

module.exports = EventBus;


/**
 * Register an event listener for events with the given name.
 *
 * The callback will be invoked with `event, ...additionalArguments`
 * that have been passed to {@link EventBus#fire}.
 *
 * Returning false from a listener will prevent the events default action
 * (if any is specified). To stop an event from being processed further in
 * other listeners execute {@link Event#stopPropagation}.
 *
 * Returning anything but `undefined` from a listener will stop the listener propagation.
 *
 * @param {String|Array<String>} events
 * @param {Number} [priority=1000] the priority in which this listener is called, larger is higher
 * @param {Function} callback
 * @param {Object} [that] Pass context (`this`) to the callback
 */
EventBus.prototype.on = function(events, priority, callback, that) {

  events = isArray(events) ? events : [ events ];

  if (isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY;
  }

  if (!isNumber(priority)) {
    throw new Error('priority must be a number');
  }

  var actualCallback = callback;

  if (that) {
    actualCallback = bind(callback, that);

    // make sure we remember and are able to remove
    // bound callbacks via {@link #off} using the original
    // callback
    actualCallback[FN_REF] = callback[FN_REF] || callback;
  }

  var self = this,
      listener = { priority: priority, callback: actualCallback };

  events.forEach(function(e) {
    self._addListener(e, listener);
  });
};


/**
 * Register an event listener that is executed only once.
 *
 * @param {String} event the event name to register for
 * @param {Function} callback the callback to execute
 * @param {Object} [that] Pass context (`this`) to the callback
 */
EventBus.prototype.once = function(event, priority, callback, that) {
  var self = this;

  if (isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY;
  }

  if (!isNumber(priority)) {
    throw new Error('priority must be a number');
  }

  function wrappedCallback() {
    self.off(event, wrappedCallback);
    return callback.apply(that, arguments);
  }

  // make sure we remember and are able to remove
  // bound callbacks via {@link #off} using the original
  // callback
  wrappedCallback[FN_REF] = callback;

  this.on(event, priority, wrappedCallback);
};


/**
 * Removes event listeners by event and callback.
 *
 * If no callback is given, all listeners for a given event name are being removed.
 *
 * @param {String} event
 * @param {Function} [callback]
 */
EventBus.prototype.off = function(event, callback) {
  var listeners = this._getListeners(event),
      listener,
      listenerCallback,
      idx;

  if (callback) {

    // move through listeners from back to front
    // and remove matching listeners
    for (idx = listeners.length - 1; (listener = listeners[idx]); idx--) {
      listenerCallback = listener.callback;

      if (listenerCallback === callback || listenerCallback[FN_REF] === callback) {
        listeners.splice(idx, 1);
      }
    }
  } else {
    // clear listeners
    listeners.length = 0;
  }
};


/**
 * Fires a named event.
 *
 * @example
 *
 * // fire event by name
 * events.fire('foo');
 *
 * // fire event object with nested type
 * var event = { type: 'foo' };
 * events.fire(event);
 *
 * // fire event with explicit type
 * var event = { x: 10, y: 20 };
 * events.fire('element.moved', event);
 *
 * // pass additional arguments to the event
 * events.on('foo', function(event, bar) {
 *   alert(bar);
 * });
 *
 * events.fire({ type: 'foo' }, 'I am bar!');
 *
 * @param {String} [name] the optional event name
 * @param {Object} [event] the event object
 * @param {...Object} additional arguments to be passed to the callback functions
 *
 * @return {Boolean} the events return value, if specified or false if the
 *                   default action was prevented by listeners
 */
EventBus.prototype.fire = function(type, data) {

  var event,
      listeners,
      returnValue,
      args;

  args = slice.call(arguments);

  if (typeof type === 'object') {
    event = type;
    type = event.type;
  }

  if (!type) {
    throw new Error('no event type specified');
  }

  listeners = this._listeners[type];

  if (!listeners) {
    return;
  }

  // we make sure we fire instances of our home made
  // events here. We wrap them only once, though
  if (data instanceof Event) {
    // we are fine, we alread have an event
    event = data;
  } else {
    event = new Event();
    event.init(data);
  }

  // ensure we pass the event as the first parameter
  args[0] = event;

  // original event type (in case we delegate)
  var originalType = event.type;

  // update event type before delegation
  if (type !== originalType) {
    event.type = type;
  }

  try {
    returnValue = this._invokeListeners(event, args, listeners);
  } finally {
    // reset event type after delegation
    if (type !== originalType) {
      event.type = originalType;
    }
  }

  // set the return value to false if the event default
  // got prevented and no other return value exists
  if (returnValue === undefined && event.defaultPrevented) {
    returnValue = false;
  }

  return returnValue;
};


EventBus.prototype.handleError = function(error) {
  return this.fire('error', { error: error }) === false;
};


EventBus.prototype._destroy = function() {
  this._listeners = {};
};

EventBus.prototype._invokeListeners = function(event, args, listeners) {

  var idx,
      listener,
      returnValue;

  for (idx = 0; (listener = listeners[idx]); idx++) {

    // handle stopped propagation
    if (event.cancelBubble) {
      break;
    }

    returnValue = this._invokeListener(event, args, listener);
  }

  return returnValue;
};

EventBus.prototype._invokeListener = function(event, args, listener) {

  var returnValue;

  try {
    // returning false prevents the default action
    returnValue = invokeFunction(listener.callback, args);

    // stop propagation on return value
    if (returnValue !== undefined) {
      event.returnValue = returnValue;
      event.stopPropagation();
    }

    // prevent default on return false
    if (returnValue === false) {
      event.preventDefault();
    }
  } catch (e) {
    if (!this.handleError(e)) {
      console.error('unhandled error in event listener');
      console.error(e.stack);

      throw e;
    }
  }

  return returnValue;
};

/*
 * Add new listener with a certain priority to the list
 * of listeners (for the given event).
 *
 * The semantics of listener registration / listener execution are
 * first register, first serve: New listeners will always be inserted
 * after existing listeners with the same priority.
 *
 * Example: Inserting two listeners with priority 1000 and 1300
 *
 *    * before: [ 1500, 1500, 1000, 1000 ]
 *    * after: [ 1500, 1500, (new=1300), 1000, 1000, (new=1000) ]
 *
 * @param {String} event
 * @param {Object} listener { priority, callback }
 */
EventBus.prototype._addListener = function(event, newListener) {

  var listeners = this._getListeners(event),
      existingListener,
      idx;

  // ensure we order listeners by priority from
  // 0 (high) to n > 0 (low)
  for (idx = 0; (existingListener = listeners[idx]); idx++) {
    if (existingListener.priority < newListener.priority) {

      // prepend newListener at before existingListener
      listeners.splice(idx, 0, newListener);
      return;
    }
  }

  listeners.push(newListener);
};


EventBus.prototype._getListeners = function(name) {
  var listeners = this._listeners[name];

  if (!listeners) {
    this._listeners[name] = listeners = [];
  }

  return listeners;
};


/**
 * A event that is emitted via the event bus.
 */
function Event() { }

module.exports.Event = Event;

Event.prototype.stopPropagation = function() {
  this.cancelBubble = true;
};

Event.prototype.preventDefault = function() {
  this.defaultPrevented = true;
};

Event.prototype.init = function(data) {
  assign(this, data || {});
};


/**
 * Invoke function. Be fast...
 *
 * @param {Function} fn
 * @param {Array<Object>} args
 *
 * @return {Any}
 */
function invokeFunction(fn, args) {
  return fn.apply(null, args);
}

},{"lodash/function/bind":212,"lodash/lang/isArray":319,"lodash/lang/isFunction":320,"lodash/lang/isNumber":322,"lodash/object/assign":328}],63:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    reduce = require('lodash/collection/reduce');

var GraphicsUtil = require('../util/GraphicsUtil');

var translate = require('../util/SvgTransformUtil').translate;

var domClear = require('min-dom/lib/clear');

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClasses = require('tiny-svg/lib/classes'),
    svgCreate = require('tiny-svg/lib/create'),
    svgRemove = require('tiny-svg/lib/remove');


/**
 * A factory that creates graphical elements
 *
 * @param {EventBus} eventBus
 * @param {ElementRegistry} elementRegistry
 */
function GraphicsFactory(eventBus, elementRegistry) {
  this._eventBus = eventBus;
  this._elementRegistry = elementRegistry;
}

GraphicsFactory.$inject = [ 'eventBus' , 'elementRegistry' ];

module.exports = GraphicsFactory;


GraphicsFactory.prototype._getChildren = function(element) {

  var gfx = this._elementRegistry.getGraphics(element);

  var childrenGfx;

  // root element
  if (!element.parent) {
    childrenGfx = gfx;
  } else {
    childrenGfx = GraphicsUtil.getChildren(gfx);
    if (!childrenGfx) {
      childrenGfx = svgCreate('g');
      svgClasses(childrenGfx).add('djs-children');

      svgAppend(gfx.parentNode, childrenGfx);
    }
  }

  return childrenGfx;
};

/**
 * Clears the graphical representation of the element and returns the
 * cleared visual (the <g class="djs-visual" /> element).
 */
GraphicsFactory.prototype._clear = function(gfx) {
  var visual = GraphicsUtil.getVisual(gfx);

  domClear(visual);

  return visual;
};

/**
 * Creates a gfx container for shapes and connections
 *
 * The layout is as follows:
 *
 * <g class="djs-group">
 *
 *   <!-- the gfx -->
 *   <g class="djs-element djs-(shape|connection)">
 *     <g class="djs-visual">
 *       <!-- the renderer draws in here -->
 *     </g>
 *
 *     <!-- extensions (overlays, click box, ...) goes here
 *   </g>
 *
 *   <!-- the gfx child nodes -->
 *   <g class="djs-children"></g>
 * </g>
 *
 * @param {Object} parent
 * @param {String} type the type of the element, i.e. shape | connection
 */
GraphicsFactory.prototype._createContainer = function(type, parentGfx) {
  var outerGfx = svgCreate('g');
  svgClasses(outerGfx).add('djs-group');

  svgAppend(parentGfx, outerGfx);

  var gfx = svgCreate('g');
  svgClasses(gfx).add('djs-element');
  svgClasses(gfx).add('djs-' + type);

  svgAppend(outerGfx, gfx);

  // create visual
  var visual = svgCreate('g');
  svgClasses(visual).add('djs-visual');

  svgAppend(gfx, visual);

  return gfx;
};

GraphicsFactory.prototype.create = function(type, element) {
  var childrenGfx = this._getChildren(element.parent);
  return this._createContainer(type, childrenGfx);
};

GraphicsFactory.prototype.updateContainments = function(elements) {

  var self = this,
      elementRegistry = this._elementRegistry,
      parents;

  parents = reduce(elements, function(map, e) {

    if (e.parent) {
      map[e.parent.id] = e.parent;
    }

    return map;
  }, {});

  // update all parents of changed and reorganized their children
  // in the correct order (as indicated in our model)
  forEach(parents, function(parent) {

    var childGfx = self._getChildren(parent),
        children = parent.children;

    if (!children) {
      return;
    }

    forEach(children.slice().reverse(), function(c) {
      var gfx = elementRegistry.getGraphics(c);

      prependTo(gfx.parentNode, childGfx);
    });
  });
};

GraphicsFactory.prototype.drawShape = function(visual, element) {
  var eventBus = this._eventBus;

  return eventBus.fire('render.shape', { gfx: visual, element: element });
};

GraphicsFactory.prototype.getShapePath = function(element) {
  var eventBus = this._eventBus;

  return eventBus.fire('render.getShapePath', element);
};

GraphicsFactory.prototype.drawConnection = function(visual, element) {
  var eventBus = this._eventBus;

  return eventBus.fire('render.connection', { gfx: visual, element: element });
};

GraphicsFactory.prototype.getConnectionPath = function(waypoints) {
  var eventBus = this._eventBus;

  return eventBus.fire('render.getConnectionPath', waypoints);
};

GraphicsFactory.prototype.update = function(type, element, gfx) {
  // Do not update root element
  if (!element.parent) {
    return;
  }

  var visual = this._clear(gfx);

  // redraw
  if (type === 'shape') {
    this.drawShape(visual, element);

    // update positioning
    translate(gfx, element.x, element.y);
  } else
  if (type === 'connection') {
    this.drawConnection(visual, element);
  } else {
    throw new Error('unknown type: ' + type);
  }

  if (element.hidden) {
    svgAttr(gfx, 'display', 'none');
  } else {
    svgAttr(gfx, 'display', 'block');
  }
};

GraphicsFactory.prototype.remove = function(element) {
  var gfx = this._elementRegistry.getGraphics(element);

  // remove
  svgRemove(gfx.parentNode);
};

////////// helpers ///////////

function prependTo(newNode, parentNode) {
  parentNode.insertBefore(newNode, parentNode.firstChild);
}

},{"../util/GraphicsUtil":172,"../util/SvgTransformUtil":181,"lodash/collection/forEach":204,"lodash/collection/reduce":207,"min-dom/lib/clear":340,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/create":357,"tiny-svg/lib/remove":359}],64:[function(require,module,exports){
module.exports = {
  __depends__: [ require('../draw') ],
  __init__: [ 'canvas' ],
  canvas: [ 'type', require('./Canvas') ],
  elementRegistry: [ 'type', require('./ElementRegistry') ],
  elementFactory: [ 'type', require('./ElementFactory') ],
  eventBus: [ 'type', require('./EventBus') ],
  graphicsFactory: [ 'type', require('./GraphicsFactory') ]
};
},{"../draw":68,"./Canvas":59,"./ElementFactory":60,"./ElementRegistry":61,"./EventBus":62,"./GraphicsFactory":63}],65:[function(require,module,exports){
'use strict';

var DEFAULT_RENDER_PRIORITY = 1000;

/**
 * The base implementation of shape and connection renderers.
 *
 * @param {EventBus} eventBus
 * @param {Number} [renderPriority=1000]
 */
function BaseRenderer(eventBus, renderPriority) {
  var self = this;

  renderPriority = renderPriority || DEFAULT_RENDER_PRIORITY;

  eventBus.on([ 'render.shape', 'render.connection' ], renderPriority, function(evt, context) {
    var type = evt.type,
        element = context.element,
        visuals = context.gfx;

    if (self.canRender(element)) {
      if (type === 'render.shape') {
        return self.drawShape(visuals, element);
      } else {
        return self.drawConnection(visuals, element);
      }
    }
  });

  eventBus.on([ 'render.getShapePath', 'render.getConnectionPath'], renderPriority, function(evt, element) {
    if (self.canRender(element)) {
      if (evt.type === 'render.getShapePath') {
        return self.getShapePath(element);
      } else {
        return self.getConnectionPath(element);
      }
    }
  });
}

/**
 * Should check whether *this* renderer can render
 * the element/connection.
 *
 * @param {element} element
 *
 * @returns {Boolean}
 */
BaseRenderer.prototype.canRender = function() {};

/**
 * Provides the shape's snap svg element to be drawn on the `canvas`.
 *
 * @param {djs.Graphics} visuals
 * @param {Shape} shape
 *
 * @returns {Snap.svg} [returns a Snap.svg paper element ]
 */
BaseRenderer.prototype.drawShape = function() {};

/**
 * Provides the shape's snap svg element to be drawn on the `canvas`.
 *
 * @param {djs.Graphics} visuals
 * @param {Connection} connection
 *
 * @returns {Snap.svg} [returns a Snap.svg paper element ]
 */
BaseRenderer.prototype.drawConnection = function() {};

/**
 * Gets the SVG path of a shape that represents it's visual bounds.
 *
 * @param {Shape} shape
 *
 * @return {string} svg path
 */
BaseRenderer.prototype.getShapePath = function() {};

/**
 * Gets the SVG path of a connection that represents it's visual bounds.
 *
 * @param {Connection} connection
 *
 * @return {string} svg path
 */
BaseRenderer.prototype.getConnectionPath = function() {};

module.exports = BaseRenderer;

},{}],66:[function(require,module,exports){
'use strict';

var inherits = require('inherits');

var BaseRenderer = require('./BaseRenderer');

var renderUtil = require('../util/RenderUtil');

var componentsToPath = renderUtil.componentsToPath,
    createLine = renderUtil.createLine;

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgCreate = require('tiny-svg/lib/create');

// apply default renderer with lowest possible priority
// so that it only kicks in if noone else could render
var DEFAULT_RENDER_PRIORITY = 1;

/**
 * The default renderer used for shapes and connections.
 *
 * @param {EventBus} eventBus
 * @param {Styles} styles
 */
function DefaultRenderer(eventBus, styles) {
  //
  BaseRenderer.call(this, eventBus, DEFAULT_RENDER_PRIORITY);

  this.CONNECTION_STYLE = styles.style([ 'no-fill' ], { strokeWidth: 5, stroke: 'fuchsia' });
  this.SHAPE_STYLE = styles.style({ fill: 'white', stroke: 'fuchsia', strokeWidth: 2 });
}

inherits(DefaultRenderer, BaseRenderer);


DefaultRenderer.prototype.canRender = function() {
  return true;
};

DefaultRenderer.prototype.drawShape = function drawShape(visuals, element) {

  var rect = svgCreate('rect');
  svgAttr(rect, {
    x: 0,
    y: 0,
    width: element.width || 0,
    height: element.height || 0
  });
  svgAttr(rect, this.SHAPE_STYLE);

  svgAppend(visuals, rect);

  return rect;
};

DefaultRenderer.prototype.drawConnection = function drawConnection(visuals, connection) {

  var line = createLine(connection.waypoints, this.CONNECTION_STYLE);
  svgAppend(visuals, line);

  return line;
};

DefaultRenderer.prototype.getShapePath = function getShapePath(shape) {

  var x = shape.x,
      y = shape.y,
      width = shape.width,
      height = shape.height;

  var shapePath = [
    ['M', x, y],
    ['l', width, 0],
    ['l', 0, height],
    ['l', -width, 0],
    ['z']
  ];

  return componentsToPath(shapePath);
};

DefaultRenderer.prototype.getConnectionPath = function getConnectionPath(connection) {
  var waypoints = connection.waypoints;

  var idx, point, connectionPath = [];

  for (idx = 0; (point = waypoints[idx]); idx++) {

    // take invisible docking into account
    // when creating the path
    point = point.original || point;

    connectionPath.push([ idx === 0 ? 'M' : 'L', point.x, point.y ]);
  }

  return componentsToPath(connectionPath);
};


DefaultRenderer.$inject = [ 'eventBus', 'styles' ];

module.exports = DefaultRenderer;

},{"../util/RenderUtil":180,"./BaseRenderer":65,"inherits":191,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/create":357}],67:[function(require,module,exports){
'use strict';

var isArray = require('lodash/lang/isArray'),
    assign = require('lodash/object/assign'),
    reduce = require('lodash/collection/reduce');


/**
 * A component that manages shape styles
 */
function Styles() {

  var defaultTraits = {

    'no-fill': {
      fill: 'none'
    },
    'no-border': {
      strokeOpacity: 0.0
    },
    'no-events': {
      pointerEvents: 'none'
    }
  };

  var self = this;

  /**
   * Builds a style definition from a className, a list of traits and an object of additional attributes.
   *
   * @param  {String} className
   * @param  {Array<String>} traits
   * @param  {Object} additionalAttrs
   *
   * @return {Object} the style defintion
   */
  this.cls = function(className, traits, additionalAttrs) {
    var attrs = this.style(traits, additionalAttrs);

    return assign(attrs, { 'class': className });
  };

  /**
   * Builds a style definition from a list of traits and an object of additional attributes.
   *
   * @param  {Array<String>} traits
   * @param  {Object} additionalAttrs
   *
   * @return {Object} the style defintion
   */
  this.style = function(traits, additionalAttrs) {

    if (!isArray(traits) && !additionalAttrs) {
      additionalAttrs = traits;
      traits = [];
    }

    var attrs = reduce(traits, function(attrs, t) {
      return assign(attrs, defaultTraits[t] || {});
    }, {});

    return additionalAttrs ? assign(attrs, additionalAttrs) : attrs;
  };

  this.computeStyle = function(custom, traits, defaultStyles) {
    if (!isArray(traits)) {
      defaultStyles = traits;
      traits = [];
    }

    return self.style(traits || [], assign({}, defaultStyles, custom || {}));
  };
}

module.exports = Styles;

},{"lodash/collection/reduce":207,"lodash/lang/isArray":319,"lodash/object/assign":328}],68:[function(require,module,exports){
module.exports = {
  __init__: [ 'defaultRenderer' ],
  defaultRenderer: [ 'type', require('./DefaultRenderer') ],
  styles: [ 'type', require('./Styles') ]
};

},{"./DefaultRenderer":66,"./Styles":67}],69:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    flatten = require('lodash/array/flatten'),
    union = require('lodash/array/union'),
    filter = require('lodash/collection/filter'),
    groupBy = require('lodash/collection/groupBy'),
    map = require('lodash/collection/map');

var saveClear = require('../../util/Removal').saveClear,
    Collections = require('../../util/Collections');

var getNewAttachShapeDelta = require('../../util/AttachUtil').getNewAttachShapeDelta;

var inherits = require('inherits');

var HIGH_PRIORITY = 1500;

var CommandInterceptor = require('../../command/CommandInterceptor');


function AttachSupport(eventBus, modeling, movePreview, rules) {

  CommandInterceptor.call(this, eventBus);


  // remove all the attached elements from the shapes to be validated
  // add all the attached shapes to the overall list of moved shapes
  eventBus.on('shape.move.start', HIGH_PRIORITY, function(e) {

    var context = e.context,
        shapes = context.shapes,
        validatedShapes = context.validatedShapes;

    context.shapes = addAttached(shapes);

    context.validatedShapes = removeAttached(validatedShapes);
  });


  // move all attachments after the other shapes are done moving
  this.postExecuted([ 'elements.move' ], function(event) {

    var context = event.context,
        delta = context.delta,
        newParent = context.newParent,
        closure = context.closure,
        enclosedElements = closure.enclosedElements,
        attachers = getAttachers(enclosedElements);

    // ensure we move all attachers with their hosts
    // if they have not been moved already
    forEach(attachers, function(attacher) {
      if (!enclosedElements[attacher.id]) {
        modeling.moveShape(attacher, delta, newParent);
      }
    });
  });

  // perform the attaching after shapes are done moving
  this.postExecuted([ 'elements.move' ], function(e) {

    var context = e.context,
        shapes = context.shapes,
        newHost = context.newHost,
        attachers;

    // we only support attachment / detachment of one element
    if (shapes.length > 1) {
      return;
    }

    if (newHost) {

      attachers = shapes;
    } else {

      attachers = filter(shapes, function(s) {
        return !!s.host;
      });
    }

    forEach(attachers, function(attacher) {
      modeling.updateAttachment(attacher, newHost);
    });
  });

  // ensure invalid attachment connections are removed
  this.postExecuted([ 'elements.move' ], function(e) {

    var shapes = e.context.shapes;

    forEach(shapes, function(shape) {

      forEach(shape.attachers, function(attacher) {

        // remove invalid outgoing connections
        forEach(attacher.outgoing.slice(), function(connection) {
          var allowed = rules.allowed('connection.reconnectStart', {
            connection: connection,
            source: connection.source,
            target: connection.target
          });

          if (!allowed) {
            modeling.removeConnection(connection);
          }
        });

        // remove invalid incoming connections
        forEach(attacher.incoming.slice(), function(connection) {
          var allowed = rules.allowed('connection.reconnectEnd', {
            connection: connection,
            source: connection.source,
            target: connection.target
          });

          if (!allowed) {
            modeling.removeConnection(connection);
          }
        });
      });
    });
  });

  this.postExecute([ 'shape.create' ], function(e) {
    var context = e.context,
        shape = context.shape,
        host = context.host;

    if (host) {
      modeling.updateAttachment(shape, host);
    }
  });

  // update attachments if the host is replaced
  this.postExecute([ 'shape.replace' ], function(e) {

    var context = e.context,
        oldShape = context.oldShape,
        newShape = context.newShape;

    // move the attachers to the new host
    saveClear(oldShape.attachers, function(attacher) {
      var allowed = rules.allowed('elements.move', {
        target: newShape,
        shapes: [attacher]
      });

      if (allowed === 'attach') {
        modeling.updateAttachment(attacher, newShape);
      } else {
        modeling.removeShape(attacher);
      }
    });

    // move attachers if new host has different size
    if (newShape.attachers.length) {

      forEach(newShape.attachers, function(attacher) {
        var delta = getNewAttachShapeDelta(attacher, oldShape, newShape);
        modeling.moveShape(attacher, delta, attacher.parent);
      });
    }

  });

  // move shape on host resize
  this.postExecute([ 'shape.resize' ], function(event) {
    var context = event.context,
        shape = context.shape,
        oldBounds = context.oldBounds,
        newBounds = context.newBounds,
        attachers = shape.attachers;

    if (!attachers.length) {
      return;
    }

    forEach(attachers, function(attacher) {
      var delta = getNewAttachShapeDelta(attacher, oldBounds, newBounds);

      modeling.moveShape(attacher, delta, attacher.parent);

      if (attacher.label) {
        modeling.moveShape(attacher.label, delta, attacher.label.parent);
      }
    });
  });

  // remove attachments
  this.preExecute([ 'shape.delete' ], function(event) {

    var shape = event.context.shape;

    saveClear(shape.attachers, function(attacher) {
      modeling.removeShape(attacher);
    });

    if (shape.host) {
      modeling.updateAttachment(shape, null);
    }
  });


  // Prevent attachers and their labels from moving, when the space tool is performed.
  // Otherwise the attachers and their labels would be moved twice.
  eventBus.on('spaceTool.move', function(event) {

    var movingShapes = event.context.movingShapes;

    // Collect all attachers which would be moved using the space tool
    var movingAttachers = filter(movingShapes, function(shape) {
      return shape.host && shape.host.id;
    });

    forEach(movingAttachers, function(shape) {
      // Remove all attachers and their labels from the movingShapes, because they
      // already will be moved along with the host.
      Collections.remove(movingShapes, shape);
      if (shape.label) {
        Collections.remove(movingShapes, shape.label);
      }
    });

  });
}

inherits(AttachSupport, CommandInterceptor);

AttachSupport.$inject = [ 'eventBus', 'modeling', 'movePreview', 'rules' ];

module.exports = AttachSupport;


/**
 * Return attachers of the given shapes
 *
 * @param {Array<djs.model.Base>} shapes
 * @return {Array<djs.model.Base>}
 */
function getAttachers(shapes) {
  return flatten(map(shapes, function(s) {
    return s.attachers || [];
  }));
}

/**
 * Return a combined list of elements and
 * attachers.
 *
 * @param {Array<djs.model.Base>} elements
 * @return {Array<djs.model.Base>} filtered
 */
function addAttached(elements) {
  var attachers = getAttachers(elements);

  return union(elements, attachers);
}

/**
 * Return a filtered list of elements that do not
 * contain attached elements with hosts being part
 * of the selection.
 *
 * @param  {Array<djs.model.Base>} elements
 *
 * @return {Array<djs.model.Base>} filtered
 */
function removeAttached(elements) {

  var ids = groupBy(elements, 'id');

  return filter(elements, function(element) {
    while (element) {

      // host in selection
      if (element.host && ids[element.host.id]) {
        return false;
      }

      element = element.parent;
    }

    return true;
  });
}

},{"../../command/CommandInterceptor":56,"../../util/AttachUtil":165,"../../util/Collections":167,"../../util/Removal":179,"inherits":191,"lodash/array/flatten":193,"lodash/array/union":195,"lodash/collection/filter":202,"lodash/collection/forEach":204,"lodash/collection/groupBy":205,"lodash/collection/map":206}],70:[function(require,module,exports){
module.exports = {
  __depends__: [
    require('../move'),
    require('../label-support')
  ],
  __init__: [ 'attachSupport'],
  attachSupport: [ 'type', require('./AttachSupport') ]
};

},{"../label-support":93,"../move":121,"./AttachSupport":69}],71:[function(require,module,exports){
'use strict';

var Geometry = require('../../util/Geometry'),
    BendpointUtil = require('./BendpointUtil');

var MARKER_OK = 'connect-ok',
    MARKER_NOT_OK = 'connect-not-ok',
    MARKER_CONNECT_HOVER = 'connect-hover',
    MARKER_CONNECT_UPDATING = 'djs-updating';

var COMMAND_BENDPOINT_UPDATE = 'connection.updateWaypoints',
    COMMAND_RECONNECT_START = 'connection.reconnectStart',
    COMMAND_RECONNECT_END = 'connection.reconnectEnd';

var round = Math.round;

var svgClasses = require('tiny-svg/lib/classes'),
    svgRemove = require('tiny-svg/lib/remove');

var translate = require('../../util/SvgTransformUtil').translate;


/**
 * A component that implements moving of bendpoints
 */
function BendpointMove(injector, eventBus, canvas, dragging, graphicsFactory, rules, modeling) {

  // optional connection docking integration
  var connectionDocking = injector.get('connectionDocking', false);


  // API

  this.start = function(event, connection, bendpointIndex, insert) {

    var type,
        context,
        waypoints = connection.waypoints,
        gfx = canvas.getGraphics(connection);

    if (!insert && bendpointIndex === 0) {
      type = COMMAND_RECONNECT_START;
    } else
    if (!insert && bendpointIndex === waypoints.length - 1) {
      type = COMMAND_RECONNECT_END;
    } else {
      type = COMMAND_BENDPOINT_UPDATE;
    }

    context = {
      connection: connection,
      bendpointIndex: bendpointIndex,
      insert: insert,
      type: type
    };

    dragging.init(event, 'bendpoint.move', {
      data: {
        connection: connection,
        connectionGfx: gfx,
        context: context
      }
    });
  };


  // DRAGGING IMPLEMENTATION


  function redrawConnection(data) {
    graphicsFactory.update('connection', data.connection, data.connectionGfx);
  }

  function filterRedundantWaypoints(waypoints) {

    // alter copy of waypoints, not original
    waypoints = waypoints.slice();

    var idx = 0,
        point,
        previousPoint,
        nextPoint;

    while (waypoints[idx]) {
      point = waypoints[idx];
      previousPoint = waypoints[idx - 1];
      nextPoint = waypoints[idx + 1];

      if (Geometry.pointDistance(point, nextPoint) === 0 ||
          Geometry.pointsOnLine(previousPoint, nextPoint, point)) {

        // remove point, if overlapping with {nextPoint}
        // or on line with {previousPoint} -> {point} -> {nextPoint}
        waypoints.splice(idx, 1);
      } else {
        idx++;
      }
    }

    return waypoints;
  }

  eventBus.on('bendpoint.move.start', function(e) {

    var context = e.context,
        connection = context.connection,
        originalWaypoints = connection.waypoints,
        waypoints = originalWaypoints.slice(),
        insert = context.insert,
        idx = context.bendpointIndex;

    context.originalWaypoints = originalWaypoints;

    if (insert) {
      // insert placeholder for bendpoint to-be-added
      waypoints.splice(idx, 0, null);
    }

    connection.waypoints = waypoints;

    // add dragger gfx
    context.draggerGfx = BendpointUtil.addBendpoint(canvas.getLayer('overlays'));
    svgClasses(context.draggerGfx).add('djs-dragging');

    canvas.addMarker(connection, MARKER_CONNECT_UPDATING);
  });

  eventBus.on('bendpoint.move.hover', function(e) {

    e.context.hover = e.hover;
    canvas.addMarker(e.hover, MARKER_CONNECT_HOVER);
  });

  eventBus.on([
    'bendpoint.move.out',
    'bendpoint.move.cleanup'
  ], function(e) {

    // remove connect marker
    // if it was added
    var hover = e.context.hover;

    if (hover) {
      canvas.removeMarker(hover, MARKER_CONNECT_HOVER);
      canvas.removeMarker(hover, e.context.target ? MARKER_OK : MARKER_NOT_OK);
    }
  });

  eventBus.on('bendpoint.move.move', function(e) {

    var context = e.context,
        moveType = context.type,
        connection = e.connection,
        source, target;

    connection.waypoints[context.bendpointIndex] = { x: e.x, y: e.y };

    if (connectionDocking) {

      if (context.hover) {
        if (moveType === COMMAND_RECONNECT_START) {
          source = context.hover;
        }

        if (moveType === COMMAND_RECONNECT_END) {
          target = context.hover;
        }
      }

      connection.waypoints = connectionDocking.getCroppedWaypoints(connection, source, target);
    }

    // asks whether reconnect / bendpoint move / bendpoint add
    // is allowed at the given position
    var allowed = context.allowed = rules.allowed(context.type, context);

    if (allowed) {

      if (context.hover) {
        canvas.removeMarker(context.hover, MARKER_NOT_OK);
        canvas.addMarker(context.hover, MARKER_OK);

        context.target = context.hover;
      }
    } else
    if (allowed === false) {
      if (context.hover) {
        canvas.removeMarker(context.hover, MARKER_OK);
        canvas.addMarker(context.hover, MARKER_NOT_OK);

        context.target = null;
      }
    }

    // add dragger gfx
    translate(context.draggerGfx, e.x, e.y);

    redrawConnection(e);
  });

  eventBus.on([
    'bendpoint.move.end',
    'bendpoint.move.cancel'
  ], function(e) {

    var context = e.context,
        hover = context.hover,
        connection = context.connection;

    // remove dragger gfx
    svgRemove(context.draggerGfx);
    context.newWaypoints = connection.waypoints.slice();
    connection.waypoints = context.originalWaypoints;
    canvas.removeMarker(connection, MARKER_CONNECT_UPDATING);

    if (hover) {
      canvas.removeMarker(hover, MARKER_OK);
      canvas.removeMarker(hover, MARKER_NOT_OK);
    }
  });

  eventBus.on('bendpoint.move.end', function(e) {

    var context = e.context,
        waypoints = context.newWaypoints,
        bendpointIndex = context.bendpointIndex,
        bendpoint = waypoints[bendpointIndex],
        allowed = context.allowed,
        hints;

    // ensure we have actual pixel values bendpoint
    // coordinates (important when zoom level was > 1 during move)
    bendpoint.x = round(bendpoint.x);
    bendpoint.y = round(bendpoint.y);

    if (allowed && context.type === COMMAND_RECONNECT_START) {
      modeling.reconnectStart(context.connection, context.target, bendpoint);
    } else
    if (allowed && context.type === COMMAND_RECONNECT_END) {
      modeling.reconnectEnd(context.connection, context.target, bendpoint);
    } else
    if (allowed !== false && context.type === COMMAND_BENDPOINT_UPDATE) {

      // pass hints on the actual moved bendpoint
      // this is useful for connection and label layouting
      hints = {
        bendpointMove: {
          insert: e.context.insert,
          bendpointIndex: bendpointIndex
        }
      };

      modeling.updateWaypoints(context.connection, filterRedundantWaypoints(waypoints), hints);
    } else {
      redrawConnection(e);

      return false;
    }
  });

  eventBus.on('bendpoint.move.cancel', function(e) {
    redrawConnection(e);
  });
}

BendpointMove.$inject = [ 'injector', 'eventBus', 'canvas', 'dragging', 'graphicsFactory', 'rules', 'modeling' ];

module.exports = BendpointMove;

},{"../../util/Geometry":171,"../../util/SvgTransformUtil":181,"./BendpointUtil":73,"tiny-svg/lib/classes":354,"tiny-svg/lib/remove":359}],72:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign'),
    forEach = require('lodash/collection/forEach'),
    isArray = require('lodash/lang/isArray');

var abs= Math.abs,
    round = Math.round;

var TOLERANCE = 10;


function BendpointSnapping(eventBus) {

  function snapTo(values, value) {

    if (isArray(values)) {
      var i = values.length;

      while (i--) if (abs(values[i] - value) <= TOLERANCE) {
        return values[i];
      }
    } else {
      values = +values;
      var rem = value % values;

      if (rem < TOLERANCE) {
        return value - rem;
      }

      if (rem > values - TOLERANCE) {
        return value - rem + values;
      }
    }

    return value;
  }

  function mid(element) {
    if (element.width) {
      return {
        x: round(element.width / 2 + element.x),
        y: round(element.height / 2 + element.y)
      };
    }
  }

  ////////// connection segment snapping //////////////////////////////////////

  function getConnectionSegmentSnaps(context) {

    var snapPoints = context.snapPoints,
        connection = context.connection,
        waypoints = connection.waypoints,
        segmentStart = context.segmentStart,
        segmentStartIndex = context.segmentStartIndex,
        segmentEnd = context.segmentEnd,
        segmentEndIndex = context.segmentEndIndex,
        axis = context.axis;

    if (snapPoints) {
      return snapPoints;
    }

    var referenceWaypoints = [
      waypoints[segmentStartIndex - 1],
      segmentStart,
      segmentEnd,
      waypoints[segmentEndIndex + 1]
    ];

    if (segmentStartIndex < 2) {
      referenceWaypoints.unshift(mid(connection.source));
    }

    if (segmentEndIndex > waypoints.length - 3) {
      referenceWaypoints.unshift(mid(connection.target));
    }

    context.snapPoints = snapPoints = { horizontal: [] , vertical: [] };

    forEach(referenceWaypoints, function(p) {
      // we snap on existing bendpoints only,
      // not placeholders that are inserted during add
      if (p) {
        p = p.original || p;

        if (axis === 'y') {
          snapPoints.horizontal.push(p.y);
        }

        if (axis === 'x') {
          snapPoints.vertical.push(p.x);
        }
      }
    });

    return snapPoints;
  }

  eventBus.on('connectionSegment.move.move', 1500, function(event) {
    var context = event.context,
        snapPoints = getConnectionSegmentSnaps(context),
        x = event.x,
        y = event.y,
        sx, sy;

    if (!snapPoints) {
      return;
    }

    // snap
    sx = snapTo(snapPoints.vertical, x);
    sy = snapTo(snapPoints.horizontal, y);


    // correction x/y
    var cx = (x - sx),
        cy = (y - sy);

    // update delta
    assign(event, {
      dx: event.dx - cx,
      dy: event.dy - cy,
      x: sx,
      y: sy
    });
  });


  ///////// bendpoint snapping /////////////////////////////

  function getBendpointSnaps(context) {

    var snapPoints = context.snapPoints,
        waypoints = context.connection.waypoints,
        bendpointIndex = context.bendpointIndex;

    if (snapPoints) {
      return snapPoints;
    }

    var referenceWaypoints = [ waypoints[bendpointIndex - 1], waypoints[bendpointIndex + 1] ];

    context.snapPoints = snapPoints = { horizontal: [] , vertical: [] };

    forEach(referenceWaypoints, function(p) {
      // we snap on existing bendpoints only,
      // not placeholders that are inserted during add
      if (p) {
        p = p.original || p;

        snapPoints.horizontal.push(p.y);
        snapPoints.vertical.push(p.x);
      }
    });

    return snapPoints;
  }


  eventBus.on('bendpoint.move.move', 1500, function(event) {

    var context = event.context,
        snapPoints = getBendpointSnaps(context),
        target = context.target,
        targetMid = target && mid(target),
        x = event.x,
        y = event.y,
        sx, sy;

    if (!snapPoints) {
      return;
    }

    // snap
    sx = snapTo(targetMid ? snapPoints.vertical.concat([ targetMid.x ]) : snapPoints.vertical, x);
    sy = snapTo(targetMid ? snapPoints.horizontal.concat([ targetMid.y ]) : snapPoints.horizontal, y);


    // correction x/y
    var cx = (x - sx),
        cy = (y - sy);

    // update delta
    assign(event, {
      dx: event.dx - cx,
      dy: event.dy - cy,
      x: event.x - cx,
      y: event.y - cy
    });
  });
}


BendpointSnapping.$inject = [ 'eventBus' ];

module.exports = BendpointSnapping;

},{"lodash/collection/forEach":204,"lodash/lang/isArray":319,"lodash/object/assign":328}],73:[function(require,module,exports){
'use strict';

var Events = require('../../util/Event'),
    Geometry = require('../../util/Geometry');

var BENDPOINT_CLS = module.exports.BENDPOINT_CLS = 'djs-bendpoint';
var SEGMENT_DRAGGER_CLS = module.exports.SEGMENT_DRAGGER_CLS = 'djs-segment-dragger';

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClasses = require('tiny-svg/lib/classes'),
    svgCreate = require('tiny-svg/lib/create');

var rotate = require('../../util/SvgTransformUtil').rotate,
    translate = require('../../util/SvgTransformUtil').translate;


module.exports.toCanvasCoordinates = function(canvas, event) {

  var position = Events.toPoint(event),
      clientRect = canvas._container.getBoundingClientRect(),
      offset;

  // canvas relative position

  offset = {
    x: clientRect.left,
    y: clientRect.top
  };

  // update actual event payload with canvas relative measures

  var viewbox = canvas.viewbox();

  return {
    x: viewbox.x + (position.x - offset.x) / viewbox.scale,
    y: viewbox.y + (position.y - offset.y) / viewbox.scale
  };
};

module.exports.addBendpoint = function(parentGfx, cls) {
  var groupGfx = svgCreate('g');
  svgClasses(groupGfx).add(BENDPOINT_CLS);

  svgAppend(parentGfx, groupGfx);

  var visual = svgCreate('circle');
  svgAttr(visual, {
    cx: 0,
    cy: 0,
    r: 4
  });
  svgClasses(visual).add('djs-visual');

  svgAppend(groupGfx, visual);

  var hit = svgCreate('circle');
  svgAttr(hit, {
    cx: 0,
    cy: 0,
    r: 10
  });
  svgClasses(hit).add('djs-hit');

  svgAppend(groupGfx, hit);

  if (cls) {
    svgClasses(groupGfx).add(cls);
  }

  return groupGfx;
};

function createParallelDragger(parentGfx, position, alignment) {
  var draggerGfx = svgCreate('g');

  svgAppend(parentGfx, draggerGfx);

  var width = 14,
      height = 3,
      padding = 6,
      hitWidth = width + padding,
      hitHeight = height + padding;

  var visual = svgCreate('rect');
  svgAttr(visual, {
    x: -width / 2,
    y: -height / 2,
    width: width,
    height: height
  });
  svgClasses(visual).add('djs-visual');

  svgAppend(draggerGfx, visual);

  var hit = svgCreate('rect');
  svgAttr(hit, {
    x: -hitWidth / 2,
    y: -hitHeight / 2,
    width: hitWidth,
    height: hitHeight
  });
  svgClasses(hit).add('djs-hit');

  svgAppend(draggerGfx, hit);

  rotate(draggerGfx, alignment === 'h' ? 90 : 0, 0, 0);

  return draggerGfx;
}


module.exports.addSegmentDragger = function(parentGfx, segmentStart, segmentEnd) {

  var groupGfx = svgCreate('g'),
      mid = Geometry.getMidPoint(segmentStart, segmentEnd),
      alignment = Geometry.pointsAligned(segmentStart, segmentEnd);

  svgAppend(parentGfx, groupGfx);

  createParallelDragger(groupGfx, mid, alignment);

  svgClasses(groupGfx).add(SEGMENT_DRAGGER_CLS);
  svgClasses(groupGfx).add(alignment === 'h' ? 'vertical' : 'horizontal');

  translate(groupGfx, mid.x, mid.y);

  return groupGfx;
};

},{"../../util/Event":170,"../../util/Geometry":171,"../../util/SvgTransformUtil":181,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/create":357}],74:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var domEvent = require('min-dom/lib/event'),
    domQuery = require('min-dom/lib/query'),
    BendpointUtil = require('./BendpointUtil');

var pointsAligned = require('../../util/Geometry').pointsAligned,
    getMidPoint = require('../../util/Geometry').getMidPoint;

var BENDPOINT_CLS = BendpointUtil.BENDPOINT_CLS,
    SEGMENT_DRAGGER_CLS = BendpointUtil.SEGMENT_DRAGGER_CLS;

var getApproxIntersection = require('../../util/LineIntersection').getApproxIntersection;

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClasses = require('tiny-svg/lib/classes'),
    svgCreate = require('tiny-svg/lib/create'),
    svgRemove = require('tiny-svg/lib/remove');

var translate = require('../../util/SvgTransformUtil').translate;


/**
 * A service that adds editable bendpoints to connections.
 */
function Bendpoints(eventBus, canvas, interactionEvents,
                    bendpointMove, connectionSegmentMove) {

  function getConnectionIntersection(waypoints, event) {
    var localPosition = BendpointUtil.toCanvasCoordinates(canvas, event),
        intersection = getApproxIntersection(waypoints, localPosition);

    return intersection;
  }

  function isIntersectionMiddle(intersection, waypoints, treshold) {
    var idx = intersection.index,
        p = intersection.point,
        p0, p1, mid, aligned, xDelta, yDelta;

    if (idx <= 0 || intersection.bendpoint) {
      return false;
    }

    p0 = waypoints[idx - 1];
    p1 = waypoints[idx];
    mid = getMidPoint(p0, p1),
    aligned = pointsAligned(p0, p1);
    xDelta = Math.abs(p.x - mid.x);
    yDelta = Math.abs(p.y - mid.y);

    return aligned && xDelta <= treshold && yDelta <= treshold;
  }

  function activateBendpointMove(event, connection) {
    var waypoints = connection.waypoints,
        intersection = getConnectionIntersection(waypoints, event);

    if (!intersection) {
      return;
    }

    if (isIntersectionMiddle(intersection, waypoints, 10)) {
      connectionSegmentMove.start(event, connection, intersection.index);
    } else {
      bendpointMove.start(event, connection, intersection.index, !intersection.bendpoint);
    }
  }

  function bindInteractionEvents(node, eventName, element) {

    domEvent.bind(node, eventName, function(event) {
      interactionEvents.triggerMouseEvent(eventName, event, element);
      event.stopPropagation();
    });
  }

  function getBendpointsContainer(element, create) {

    var layer = canvas.getLayer('overlays'),
        gfx = domQuery('.djs-bendpoints[data-element-id=' + element.id + ']', layer);

    if (!gfx && create) {
      gfx = svgCreate('g');
      svgAttr(gfx, { 'data-element-id': element.id });
      svgClasses(gfx).add('djs-bendpoints');

      svgAppend(layer, gfx);

      bindInteractionEvents(gfx, 'mousedown', element);
      bindInteractionEvents(gfx, 'click', element);
      bindInteractionEvents(gfx, 'dblclick', element);
    }

    return gfx;
  }

  function createBendpoints(gfx, connection) {
    connection.waypoints.forEach(function(p, idx) {
      var bendpoint = BendpointUtil.addBendpoint(gfx);

      svgAppend(gfx, bendpoint);

      translate(bendpoint, p.x, p.y);
    });

    // add floating bendpoint
    BendpointUtil.addBendpoint(gfx, 'floating');
  }

  function createSegmentDraggers(gfx, connection) {

    var waypoints = connection.waypoints;

    var segmentStart,
        segmentEnd;

    for (var i = 1; i < waypoints.length; i++) {

      segmentStart = waypoints[i - 1];
      segmentEnd = waypoints[i];

      if (pointsAligned(segmentStart, segmentEnd)) {
        BendpointUtil.addSegmentDragger(gfx, segmentStart, segmentEnd);
      }
    }
  }

  function clearBendpoints(gfx) {
    forEach(domQuery.all('.' + BENDPOINT_CLS, gfx), function(node) {
      svgRemove(node);
    });
  }

  function clearSegmentDraggers(gfx) {
    forEach(domQuery.all('.' + SEGMENT_DRAGGER_CLS, gfx), function(node) {
      svgRemove(node);
    });
  }

  function addHandles(connection) {

    var gfx = getBendpointsContainer(connection);

    if (!gfx) {
      gfx = getBendpointsContainer(connection, true);

      createBendpoints(gfx, connection);
      createSegmentDraggers(gfx, connection);
    }

    return gfx;
  }

  function updateHandles(connection) {

    var gfx = getBendpointsContainer(connection);

    if (gfx) {
      clearSegmentDraggers(gfx);
      clearBendpoints(gfx);
      createSegmentDraggers(gfx, connection);
      createBendpoints(gfx, connection);
    }
  }

  eventBus.on('connection.changed', function(event) {
    updateHandles(event.element);
  });

  eventBus.on('connection.remove', function(event) {
    var gfx = getBendpointsContainer(event.element);

    if (gfx) {
      svgRemove(gfx);
    }
  });

  eventBus.on('element.marker.update', function(event) {

    var element = event.element,
        bendpointsGfx;

    if (!element.waypoints) {
      return;
    }

    bendpointsGfx = addHandles(element);

    if (event.add) {
      svgClasses(bendpointsGfx).add(event.marker);
    } else {
      svgClasses(bendpointsGfx).remove(event.marker);
    }
  });

  eventBus.on('element.mousemove', function(event) {

    var element = event.element,
        waypoints = element.waypoints,
        bendpointsGfx,
        floating,
        intersection;

    if (waypoints) {
      bendpointsGfx = getBendpointsContainer(element, true);
      floating = domQuery('.floating', bendpointsGfx);

      if (!floating) {
        return;
      }

      intersection = getConnectionIntersection(waypoints, event.originalEvent);

      if (intersection) {
        translate(floating, intersection.point.x, intersection.point.y);
      }
    }
  });

  eventBus.on('element.mousedown', function(event) {

    var originalEvent = event.originalEvent,
        element = event.element,
        waypoints = element.waypoints;

    if (!waypoints) {
      return;
    }

    activateBendpointMove(originalEvent, element, waypoints);
  });

  eventBus.on('selection.changed', function(event) {
    var newSelection = event.newSelection,
        primary = newSelection[0];

    if (primary && primary.waypoints) {
      addHandles(primary);
    }
  });

  eventBus.on('element.hover', function(event) {
    var element = event.element;

    if (element.waypoints) {
      addHandles(element);
      interactionEvents.registerEvent(event.gfx, 'mousemove', 'element.mousemove');
    }
  });

  eventBus.on('element.out', function(event) {
    interactionEvents.unregisterEvent(event.gfx, 'mousemove', 'element.mousemove');
  });

  // update bendpoint container data attribute on element ID change
  eventBus.on('element.updateId', function(context) {
    var element = context.element,
        newId = context.newId;

    if (element.waypoints) {
      var bendpointContainer = getBendpointsContainer(element);

      if (bendpointContainer) {
        svgAttr(bendpointContainer, { 'data-element-id': newId });
      }
    }
  });

  // API

  this.addHandles = addHandles;
  this.updateHandles = updateHandles;
  this.getBendpointsContainer = getBendpointsContainer;
}

Bendpoints.$inject = [
  'eventBus', 'canvas', 'interactionEvents',
  'bendpointMove', 'connectionSegmentMove'
];

module.exports = Bendpoints;

},{"../../util/Geometry":171,"../../util/LineIntersection":175,"../../util/SvgTransformUtil":181,"./BendpointUtil":73,"lodash/collection/forEach":204,"min-dom/lib/event":344,"min-dom/lib/query":346,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/create":357,"tiny-svg/lib/remove":359}],75:[function(require,module,exports){
'use strict';

var Geometry = require('../../util/Geometry'),
    BendpointUtil = require('./BendpointUtil'),
    LayoutUtil = require('../../layout/LayoutUtil');

var MARKER_CONNECT_HOVER = 'connect-hover',
    MARKER_CONNECT_UPDATING = 'djs-updating';

var svgClasses = require('tiny-svg/lib/classes'),
    svgRemove = require('tiny-svg/lib/remove');

var translate = require('../../util/SvgTransformUtil').translate;


function axisAdd(point, axis, delta) {
  return axisSet(point, axis, point[axis] + delta);
}

function axisSet(point, axis, value) {
  return {
    x: (axis === 'x' ? value : point.x),
    y: (axis === 'y' ? value : point.y)
  };
}

function axisFenced(position, segmentStart, segmentEnd, axis) {

  var maxValue = Math.max(segmentStart[axis], segmentEnd[axis]),
      minValue = Math.min(segmentStart[axis], segmentEnd[axis]);

  var padding = 20;

  var fencedValue = Math.min(Math.max(minValue + padding, position[axis]), maxValue - padding);

  return axisSet(segmentStart, axis, fencedValue);
}

function flipAxis(axis) {
  return axis === 'x' ? 'y' : 'x';
}

/**
 * Get the docking point on the given element.
 *
 * Compute a reasonable docking, if non exists.
 *
 * @param  {Point} point
 * @param  {djs.model.Shape} referenceElement
 * @param  {String} moveAxis (x|y)
 *
 * @return {Point}
 */
function getDocking(point, referenceElement, moveAxis) {

  var referenceMid,
      inverseAxis;

  if (point.original) {
    return point.original;
  } else {
    referenceMid = LayoutUtil.getMid(referenceElement);
    inverseAxis = flipAxis(moveAxis);

    return axisSet(point, inverseAxis, referenceMid[inverseAxis]);
  }
}

/**
 * A component that implements moving of bendpoints
 */
function ConnectionSegmentMove(injector, eventBus, canvas, dragging, graphicsFactory, rules, modeling) {

  // optional connection docking integration
  var connectionDocking = injector.get('connectionDocking', false);


  // API

  this.start = function(event, connection, idx) {

    var context,
        gfx = canvas.getGraphics(connection),
        segmentStartIndex = idx - 1,
        segmentEndIndex = idx,
        waypoints = connection.waypoints,
        segmentStart = waypoints[segmentStartIndex],
        segmentEnd = waypoints[segmentEndIndex],
        direction,
        axis;

    direction = Geometry.pointsAligned(segmentStart, segmentEnd);

    // do not move diagonal connection
    if (!direction) {
      return;
    }

    // the axis where we are going to move things
    axis = direction === 'v' ? 'y' : 'x';

    if (segmentStartIndex === 0) {
      segmentStart = getDocking(segmentStart, connection.source, axis);
    }

    if (segmentEndIndex === waypoints.length - 1) {
      segmentEnd = getDocking(segmentEnd, connection.target, axis);
    }

    context = {
      connection: connection,
      segmentStartIndex: segmentStartIndex,
      segmentEndIndex: segmentEndIndex,
      segmentStart: segmentStart,
      segmentEnd: segmentEnd,
      axis: axis
    };

    dragging.init(event, {
      x: (segmentStart.x + segmentEnd.x)/2,
      y: (segmentStart.y + segmentEnd.y)/2
    }, 'connectionSegment.move', {
      cursor: axis === 'x' ? 'resize-ew' : 'resize-ns',
      data: {
        connection: connection,
        connectionGfx: gfx,
        context: context
      }
    });
  };

  /**
   * Crop connection if connection cropping is provided.
   *
   * @param {Connection} connection
   * @param {Array<Point>} newWaypoints
   *
   * @return {Array<Point>} cropped connection waypoints
   */
  function cropConnection(connection, newWaypoints) {

    // crop connection, if docking service is provided only
    if (!connectionDocking) {
      return newWaypoints;
    }

    var oldWaypoints = connection.waypoints,
        croppedWaypoints;

    // temporary set new waypoints
    connection.waypoints = newWaypoints;

    croppedWaypoints = connectionDocking.getCroppedWaypoints(connection);

    // restore old waypoints
    connection.waypoints = oldWaypoints;

    return croppedWaypoints;
  }

  // DRAGGING IMPLEMENTATION

  function redrawConnection(data) {
    graphicsFactory.update('connection', data.connection, data.connectionGfx);
  }

  function updateDragger(context, segmentOffset, event) {

    var newWaypoints = context.newWaypoints,
        segmentStartIndex = context.segmentStartIndex + segmentOffset,
        segmentStart = newWaypoints[segmentStartIndex],
        segmentEndIndex = context.segmentEndIndex + segmentOffset,
        segmentEnd = newWaypoints[segmentEndIndex],
        axis = flipAxis(context.axis);

    // make sure the dragger does not move
    // outside the connection
    var draggerPosition = axisFenced(event, segmentStart, segmentEnd, axis);

    // update dragger
    translate(context.draggerGfx, draggerPosition.x, draggerPosition.y);
  }

  /**
   * Filter waypoints for redundant ones (i.e. on the same axis).
   * Returns the filtered waypoints and the offset related to the segment move.
   *
   * @param {Array<Point>} waypoints
   * @param {Integer} segmentStartIndex of moved segment start
   *
   * @return {Object} { filteredWaypoints, segmentOffset }
   */
  function filterRedundantWaypoints(waypoints, segmentStartIndex) {

    var segmentOffset = 0;

    var filteredWaypoints = waypoints.filter(function(r, idx) {
      if (Geometry.pointsOnLine(waypoints[idx - 1], waypoints[idx + 1], r)) {

        // remove point and increment offset
        segmentOffset = idx <= segmentStartIndex ? segmentOffset - 1 : segmentOffset;
        return false;
      }

      // dont remove point
      return true;
    });

    return {
      waypoints: filteredWaypoints,
      segmentOffset: segmentOffset
    };
  }

  eventBus.on('connectionSegment.move.start', function(e) {

    var context = e.context,
        connection = e.connection,
        layer = canvas.getLayer('overlays');

    context.originalWaypoints = connection.waypoints.slice();

    // add dragger gfx
    context.draggerGfx = BendpointUtil.addSegmentDragger(layer, context.segmentStart, context.segmentEnd);
    svgClasses(context.draggerGfx).add('djs-dragging');

    canvas.addMarker(connection, MARKER_CONNECT_UPDATING);
  });

  eventBus.on('connectionSegment.move.move', function(e) {

    var context = e.context,
        connection = context.connection,
        segmentStartIndex = context.segmentStartIndex,
        segmentEndIndex = context.segmentEndIndex,
        segmentStart = context.segmentStart,
        segmentEnd = context.segmentEnd,
        axis = context.axis;

    var newWaypoints = context.originalWaypoints.slice(),
        newSegmentStart = axisAdd(segmentStart, axis, e['d' + axis]),
        newSegmentEnd = axisAdd(segmentEnd, axis, e['d' + axis]);

    // original waypoint count and added / removed
    // from start waypoint delta. We use the later
    // to retrieve the updated segmentStartIndex / segmentEndIndex
    var waypointCount = newWaypoints.length,
        segmentOffset = 0;

    // move segment start / end by axis delta
    newWaypoints[segmentStartIndex] = newSegmentStart;
    newWaypoints[segmentEndIndex] = newSegmentEnd;

    var sourceToSegmentOrientation,
        targetToSegmentOrientation;

    // handle first segment
    if (segmentStartIndex < 2) {
      sourceToSegmentOrientation = LayoutUtil.getOrientation(connection.source, newSegmentStart);

      // first bendpoint, remove first segment if intersecting
      if (segmentStartIndex === 1) {

        if (sourceToSegmentOrientation === 'intersect') {
          newWaypoints.shift();
          newWaypoints[0] = newSegmentStart;
          segmentOffset--;
        }
      }

      // docking point, add segment if not intersecting anymore
      else {
        if (sourceToSegmentOrientation !== 'intersect') {
          newWaypoints.unshift(segmentStart);
          segmentOffset++;
        }
      }
    }

    // handle last segment
    if (segmentEndIndex > waypointCount - 3) {
      targetToSegmentOrientation = LayoutUtil.getOrientation(connection.target, newSegmentEnd);

      // last bendpoint, remove last segment if intersecting
      if (segmentEndIndex === waypointCount - 2) {

        if (targetToSegmentOrientation === 'intersect') {
          newWaypoints.pop();
          newWaypoints[newWaypoints.length - 1] = newSegmentEnd;
        }
      }

      // last bendpoint, remove last segment if intersecting
      else {
        if (targetToSegmentOrientation !== 'intersect') {
          newWaypoints.push(segmentEnd);
        }
      }
    }

    // update connection waypoints
    context.newWaypoints = connection.waypoints = cropConnection(connection, newWaypoints);

    // update dragger position
    updateDragger(context, segmentOffset, e);

    // save segmentOffset in context
    context.newSegmentStartIndex = segmentStartIndex + segmentOffset;

    // redraw connection
    redrawConnection(e);
  });

  eventBus.on('connectionSegment.move.hover', function(e) {

    e.context.hover = e.hover;
    canvas.addMarker(e.hover, MARKER_CONNECT_HOVER);
  });

  eventBus.on([
    'connectionSegment.move.out',
    'connectionSegment.move.cleanup'
  ], function(e) {

    // remove connect marker
    // if it was added
    var hover = e.context.hover;

    if (hover) {
      canvas.removeMarker(hover, MARKER_CONNECT_HOVER);
    }
  });

  eventBus.on('connectionSegment.move.cleanup', function(e) {

    var context = e.context,
        connection = context.connection;

    // remove dragger gfx
    if (context.draggerGfx) {
      svgRemove(context.draggerGfx);
    }

    canvas.removeMarker(connection, MARKER_CONNECT_UPDATING);
  });

  eventBus.on([
    'connectionSegment.move.cancel',
    'connectionSegment.move.end'
  ], function(e) {
    var context = e.context,
        connection = context.connection;

    connection.waypoints = context.originalWaypoints;

    redrawConnection(e);
  });

  eventBus.on('connectionSegment.move.end', function(e) {

    var context = e.context,
        connection = context.connection,
        newWaypoints = context.newWaypoints,
        newSegmentStartIndex = context.newSegmentStartIndex;

    // ensure we have actual pixel values bendpoint
    // coordinates (important when zoom level was > 1 during move)
    newWaypoints = newWaypoints.map(function(p) {
      return {
        original: p.original,
        x: Math.round(p.x),
        y: Math.round(p.y)
      };
    });

    // apply filter redunant waypoints
    var filtered = filterRedundantWaypoints(newWaypoints, newSegmentStartIndex);

    // get filtered waypoints
    var filteredWaypoints = filtered.waypoints,
        croppedWaypoints = cropConnection(connection, filteredWaypoints),
        segmentOffset = filtered.segmentOffset;

    var hints = {
      segmentMove: {
        segmentStartIndex: context.segmentStartIndex,
        newSegmentStartIndex: newSegmentStartIndex + segmentOffset
      }
    };

    modeling.updateWaypoints(connection, croppedWaypoints, hints);
  });
}

ConnectionSegmentMove.$inject = [
  'injector', 'eventBus', 'canvas',
  'dragging', 'graphicsFactory', 'rules',
  'modeling'
];

module.exports = ConnectionSegmentMove;

},{"../../layout/LayoutUtil":161,"../../util/Geometry":171,"../../util/SvgTransformUtil":181,"./BendpointUtil":73,"tiny-svg/lib/classes":354,"tiny-svg/lib/remove":359}],76:[function(require,module,exports){
module.exports = {
  __depends__: [ require('../dragging'), require('../rules') ],
  __init__: [ 'bendpoints', 'bendpointSnapping' ],
  bendpoints: [ 'type', require('./Bendpoints') ],
  bendpointMove: [ 'type', require('./BendpointMove') ],
  connectionSegmentMove: [ 'type', require('./ConnectionSegmentMove') ],
  bendpointSnapping: [ 'type', require('./BendpointSnapping') ]
};

},{"../dragging":87,"../rules":138,"./BendpointMove":71,"./BendpointSnapping":72,"./Bendpoints":74,"./ConnectionSegmentMove":75}],77:[function(require,module,exports){
'use strict';

var getElementType = require('../../util/Elements').getType;

/**
 * Adds change support to the diagram, including
 *
 * <ul>
 *   <li>redrawing shapes and connections on change</li>
 * </ul>
 *
 * @param {EventBus} eventBus
 * @param {Canvas} canvas
 * @param {ElementRegistry} elementRegistry
 * @param {GraphicsFactory} graphicsFactory
 */
function ChangeSupport(eventBus, canvas, elementRegistry, graphicsFactory) {

  // redraw shapes / connections on change

  eventBus.on('element.changed', function(event) {

    var element = event.element;

    // element might have been deleted and replaced by new element with same ID
    // thus check for parent of element except for root element
    if (element.parent || element === canvas.getRootElement()) {
      event.gfx = elementRegistry.getGraphics(element);
    }

    // shape + gfx may have been deleted
    if (!event.gfx) {
      return;
    }

    eventBus.fire(getElementType(element) + '.changed', event);
  });

  eventBus.on('elements.changed', function(event) {

    var elements = event.elements;

    elements.forEach(function(e) {
      eventBus.fire('element.changed', { element: e });
    });

    graphicsFactory.updateContainments(elements);
  });

  eventBus.on('shape.changed', function(event) {
    graphicsFactory.update('shape', event.element, event.gfx);
  });

  eventBus.on('connection.changed', function(event) {
    graphicsFactory.update('connection', event.element, event.gfx);
  });
}

ChangeSupport.$inject = [ 'eventBus', 'canvas', 'elementRegistry', 'graphicsFactory' ];

module.exports = ChangeSupport;

},{"../../util/Elements":169}],78:[function(require,module,exports){
module.exports = {
  __init__: [ 'changeSupport'],
  changeSupport: [ 'type', require('./ChangeSupport') ]
};
},{"./ChangeSupport":77}],79:[function(require,module,exports){
'use strict';

var LayoutUtil = require('../../layout/LayoutUtil');

var MARKER_OK = 'connect-ok',
    MARKER_NOT_OK = 'connect-not-ok';

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgCreate = require('tiny-svg/lib/create'),
    svgRemove = require('tiny-svg/lib/remove');


function Connect(eventBus, dragging, modeling, rules, canvas, graphicsFactory) {

  // TODO(nre): separate UI and events

  // rules

  function canConnect(source, target) {
    return rules.allowed('connection.create', {
      source: source,
      target: target
    });
  }


  // layouting

  function crop(start, end, source, target) {

    var sourcePath = graphicsFactory.getShapePath(source),
        targetPath = target && graphicsFactory.getShapePath(target),
        connectionPath = graphicsFactory.getConnectionPath({ waypoints: [ start, end ] });

    start = LayoutUtil.getElementLineIntersection(sourcePath, connectionPath, true) || start;
    end = (target && LayoutUtil.getElementLineIntersection(targetPath, connectionPath, false)) || end;

    return [ start, end ];
  }


  // event handlers

  eventBus.on('connect.move', function(event) {

    var context = event.context,
        source = context.source,
        target = context.target,
        visual = context.visual,
        sourcePosition = context.sourcePosition,
        endPosition,
        waypoints;

    // update connection visuals during drag

    endPosition = {
      x: event.x,
      y: event.y
    };

    waypoints = crop(sourcePosition, endPosition, source, target);

    svgAttr(visual, { 'points': [ waypoints[0].x, waypoints[0].y, waypoints[1].x, waypoints[1].y ] });
  });

  eventBus.on('connect.hover', function(event) {
    var context = event.context,
        source = context.source,
        hover = event.hover,
        canExecute;

    canExecute = context.canExecute = canConnect(source, hover);

    // simply ignore hover
    if (canExecute === null) {
      return;
    }

    context.target = hover;

    canvas.addMarker(hover, canExecute ? MARKER_OK : MARKER_NOT_OK);
  });

  eventBus.on([ 'connect.out', 'connect.cleanup' ], function(event) {
    var context = event.context;

    if (context.target) {
      canvas.removeMarker(context.target, context.canExecute ? MARKER_OK : MARKER_NOT_OK);
    }

    context.target = null;
  });

  eventBus.on('connect.cleanup', function(event) {
    var context = event.context;

    if (context.visual) {
      svgRemove(context.visual);
    }
  });

  eventBus.on('connect.start', function(event) {
    var context = event.context,
        visual;

    visual = svgCreate('polyline');
    svgAttr(visual, {
      'stroke': '#333',
      'strokeDasharray': [ 1 ],
      'strokeWidth': 2,
      'pointer-events': 'none'
    });

    svgAppend(canvas.getDefaultLayer(), visual);

    context.visual = visual;
  });

  eventBus.on('connect.end', function(event) {

    var context = event.context,
        source = context.source,
        sourcePosition = context.sourcePosition,
        target = context.target,
        targetPosition = {
          x: event.x,
          y: event.y
        },
        canExecute = context.canExecute || canConnect(source, target);

    if (!canExecute) {
      return false;
    }

    var attrs = null,
        hints = {
          connectionStart: sourcePosition,
          connectionEnd: targetPosition
        };

    if (typeof canExecute === 'object') {
      attrs = canExecute;
    }

    modeling.connect(source, target, attrs, hints);
  });


  // API

  /**
   * Start connect operation.
   *
   * @param {DOMEvent} event
   * @param {djs.model.Base} source
   * @param {Point} [sourcePosition]
   * @param {Boolean} [autoActivate=false]
   */
  this.start = function(event, source, sourcePosition, autoActivate) {

    if (typeof sourcePosition !== 'object') {
      autoActivate = sourcePosition;
      sourcePosition = LayoutUtil.getMid(source);
    }

    dragging.init(event, 'connect', {
      autoActivate: autoActivate,
      data: {
        shape: source,
        context: {
          source: source,
          sourcePosition: sourcePosition
        }
      }
    });
  };
}

Connect.$inject = [ 'eventBus', 'dragging', 'modeling', 'rules', 'canvas', 'graphicsFactory' ];

module.exports = Connect;

},{"../../layout/LayoutUtil":161,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/create":357,"tiny-svg/lib/remove":359}],80:[function(require,module,exports){
module.exports = {
  __depends__: [
    require('../selection'),
    require('../rules'),
    require('../dragging')
  ],
  connect: [ 'type', require('./Connect') ]
};

},{"../dragging":87,"../rules":138,"../selection":142,"./Connect":79}],81:[function(require,module,exports){
'use strict';

var isFunction = require('lodash/lang/isFunction'),
    isArray = require('lodash/lang/isArray'),
    forEach = require('lodash/collection/forEach'),

    domDelegate = require('min-dom/lib/delegate'),
    domEvent = require('min-dom/lib/event'),
    domAttr = require('min-dom/lib/attr'),
    domQuery = require('min-dom/lib/query'),
    domClasses = require('min-dom/lib/classes'),
    domify = require('min-dom/lib/domify');


var entrySelector = '.entry';


/**
 * A context pad that displays element specific, contextual actions next
 * to a diagram element.
 *
 * @param {EventBus} eventBus
 * @param {Overlays} overlays
 */
function ContextPad(eventBus, overlays) {

  this._providers = [];

  this._eventBus = eventBus;
  this._overlays = overlays;

  this._current = null;

  this._init();
}

ContextPad.$inject = [ 'eventBus', 'overlays' ];

module.exports = ContextPad;


/**
 * Registers events needed for interaction with other components
 */
ContextPad.prototype._init = function() {

  var eventBus = this._eventBus;

  var self = this;

  eventBus.on('selection.changed', function(e) {

    var selection = e.newSelection;

    if (selection.length === 1) {
      self.open(selection[0]);
    } else {
      self.close();
    }
  });

  eventBus.on('elements.delete', function(event) {
    var elements = event.elements;

    forEach(elements, function(e) {
      if (self.isOpen(e)) {
        self.close();
      }
    });
  });

  eventBus.on('element.changed', function(event) {
    var element = event.element,
        current = self._current;

    // force reopen if element for which we are currently opened changed
    if (current && current.element === element) {
      self.open(element, true);
    }
  });
};


/**
 * Register a provider with the context pad
 *
 * @param  {ContextPadProvider} provider
 */
ContextPad.prototype.registerProvider = function(provider) {
  this._providers.push(provider);
};


/**
 * Returns the context pad entries for a given element
 *
 * @param {djs.element.Base} element
 *
 * @return {Array<ContextPadEntryDescriptor>} list of entries
 */
ContextPad.prototype.getEntries = function(element) {
  var entries = {};

  // loop through all providers and their entries.
  // group entries by id so that overriding an entry is possible
  forEach(this._providers, function(provider) {
    var e = provider.getContextPadEntries(element);

    forEach(e, function(entry, id) {
      entries[id] = entry;
    });
  });

  return entries;
};


/**
 * Trigger an action available on the opened context pad
 *
 * @param  {String} action
 * @param  {Event} event
 * @param  {Boolean} [autoActivate=false]
 */
ContextPad.prototype.trigger = function(action, event, autoActivate) {

  var element = this._current.element,
      entries = this._current.entries,
      entry,
      handler,
      originalEvent,
      button = event.delegateTarget || event.target;

  if (!button) {
    return event.preventDefault();
  }

  entry = entries[domAttr(button, 'data-action')];
  handler = entry.action;

  originalEvent = event.originalEvent || event;

  // simple action (via callback function)
  if (isFunction(handler)) {
    if (action === 'click') {
      return handler(originalEvent, element, autoActivate);
    }
  } else {
    if (handler[action]) {
      return handler[action](originalEvent, element, autoActivate);
    }
  }

  // silence other actions
  event.preventDefault();
};


/**
 * Open the context pad for the given element
 *
 * @param {djs.model.Base} element
 * @param {Boolean} force if true, force reopening the context pad
 */
ContextPad.prototype.open = function(element, force) {
  if (!force && this.isOpen(element)) {
    return;
  }

  this.close();
  this._updateAndOpen(element);
};


ContextPad.prototype._updateAndOpen = function(element) {

  var entries = this.getEntries(element),
      pad = this.getPad(element),
      html = pad.html;

  forEach(entries, function(entry, id) {
    var grouping = entry.group || 'default',
        control = domify(entry.html || '<div class="entry" draggable="true"></div>'),
        container;

    domAttr(control, 'data-action', id);

    container = domQuery('[data-group=' + grouping + ']', html);
    if (!container) {
      container = domify('<div class="group" data-group="' + grouping + '"></div>');
      html.appendChild(container);
    }

    container.appendChild(control);

    if (entry.className) {
      addClasses(control, entry.className);
    }

    if (entry.title) {
      domAttr(control, 'title', entry.title);
    }

    if (entry.imageUrl) {
      control.appendChild(domify('<img src="' + entry.imageUrl + '">'));
    }
  });

  domClasses(html).add('open');

  this._current = {
    element: element,
    pad: pad,
    entries: entries
  };

  this._eventBus.fire('contextPad.open', { current: this._current });
};


ContextPad.prototype.getPad = function(element) {
  if (this.isOpen()) {
    return this._current.pad;
  }

  var self = this;

  var overlays = this._overlays;

  var html = domify('<div class="djs-context-pad"></div>');

  domDelegate.bind(html, entrySelector, 'click', function(event) {
    self.trigger('click', event);
  });

  domDelegate.bind(html, entrySelector, 'dragstart', function(event) {
    self.trigger('dragstart', event);
  });

  // stop propagation of mouse events
  domEvent.bind(html, 'mousedown', function(event) {
    event.stopPropagation();
  });

  this._overlayId = overlays.add(element, 'context-pad', {
    position: {
      right: -9,
      top: -6
    },
    html: html
  });

  var pad = overlays.get(this._overlayId);

  this._eventBus.fire('contextPad.create', { element: element, pad: pad });

  return pad;
};


/**
 * Close the context pad
 */
ContextPad.prototype.close = function() {
  if (!this.isOpen()) {
    return;
  }

  this._overlays.remove(this._overlayId);

  this._overlayId = null;

  this._eventBus.fire('contextPad.close', { current: this._current });

  this._current = null;
};

/**
 * Check if pad is open. If element is given, will check
 * if pad is opened with given element.
 *
 * @param {Element} element
 * @return {Boolean}
 */
ContextPad.prototype.isOpen = function(element) {
  return !!this._current && (!element ? true : this._current.element === element);
};




////////// helpers /////////////////////////////

function addClasses(element, classNames) {

  var classes = domClasses(element);

  var actualClassNames = isArray(classNames) ? classNames : classNames.split(/\s+/g);
  actualClassNames.forEach(function(cls) {
    classes.add(cls);
  });
}
},{"lodash/collection/forEach":204,"lodash/lang/isArray":319,"lodash/lang/isFunction":320,"min-dom/lib/attr":338,"min-dom/lib/classes":339,"min-dom/lib/delegate":342,"min-dom/lib/domify":343,"min-dom/lib/event":344,"min-dom/lib/query":346}],82:[function(require,module,exports){
module.exports = {
  __depends__: [
    require('../interaction-events'),
    require('../overlays')
  ],
  contextPad: [ 'type', require('./ContextPad') ]
};
},{"../interaction-events":91,"../overlays":126,"./ContextPad":81}],83:[function(require,module,exports){
'use strict';

var LOW_PRIORITY = 750;

var MARKER_OK = 'drop-ok',
    MARKER_NOT_OK = 'drop-not-ok',
    MARKER_ATTACH = 'attach-ok',
    MARKER_NEW_PARENT = 'new-parent';

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClasses = require('tiny-svg/lib/classes'),
    svgCreate = require('tiny-svg/lib/create'),
    svgRemove = require('tiny-svg/lib/remove');

var translate = require('../../util/SvgTransformUtil').translate;


function Create(eventBus, dragging, rules, modeling, canvas, styles, graphicsFactory) {

  // rules

  function canCreate(shape, target, source, position) {

    if (source) {
      return rules.allowed('shape.append', {
        source: source,
        shape: shape,
        target: target,
        position: position
      });
    } else {
      return rules.allowed('shape.create', {
        shape: shape,
        target: target,
        position: position
      });
    }
  }


  /** set drop marker on an element */
  function setMarker(element, marker) {

    [ MARKER_ATTACH, MARKER_OK, MARKER_NOT_OK, MARKER_NEW_PARENT ].forEach(function(m) {

      if (m === marker) {
        canvas.addMarker(element, m);
      } else {
        canvas.removeMarker(element, m);
      }
    });
  }


  // visual helpers

  function createVisual(shape) {
    var group, preview, visual;

    group = svgCreate('g');
    svgAttr(group, styles.cls('djs-drag-group', [ 'no-events' ]));

    svgAppend(canvas.getDefaultLayer(), group);

    preview = svgCreate('g');
    svgClasses(preview).add('djs-dragger');

    svgAppend(group, preview);

    translate(preview, shape.width / -2, shape.height / -2);

    var visualGroup = svgCreate('g');
    svgClasses(visualGroup).add('djs-visual');

    svgAppend(preview, visualGroup);

    visual = visualGroup;

    // hijack renderer to draw preview
    graphicsFactory.drawShape(visual, shape);

    return group;
  }


  // event handlers

  eventBus.on('create.move', function(event) {

    var context = event.context,
        hover = event.hover,
        canExecute;

    var position = {
      x: event.x,
      y: event.y
    };

    canExecute = context.canExecute = hover && canCreate(context.shape, hover, context.source, position);

    // ignore hover visually if canExecute is null
    if (hover && canExecute !== null) {
      context.target = hover;

      if (canExecute === 'attach') {
        setMarker(hover, MARKER_ATTACH);
      } else {
        setMarker(hover, context.canExecute ? MARKER_NEW_PARENT : MARKER_NOT_OK);
      }
    }
  });

  eventBus.on('create.move', LOW_PRIORITY, function(event) {

    var context = event.context,
        shape = context.shape,
        visual = context.visual;

    // lazy init drag visual once we received the first real
    // drag move event (this allows us to get the proper canvas local coordinates)
    if (!visual) {
      visual = context.visual = createVisual(shape);
    }

    translate(visual, event.x, event.y);
  });


  eventBus.on([ 'create.end', 'create.out', 'create.cleanup' ], function(event) {
    var context = event.context,
        target = context.target;

    if (target) {
      setMarker(target, null);
    }
  });

  eventBus.on('create.end', function(event) {
    var context = event.context,
        source = context.source,
        shape = context.shape,
        target = context.target,
        canExecute = context.canExecute,
        isAttach,
        position = {
          x: event.x,
          y: event.y
        };

    if (!canExecute) {
      return false;
    }

    if (source) {
      shape = modeling.appendShape(source, shape, position, target);
    } else {
      isAttach = canExecute === 'attach';

      shape = modeling.createShape(shape, position, target, isAttach);
    }

    // make sure we provide the actual attached
    // shape with the context so that selection and
    // other components can use it right after the create
    // operation ends
    context.shape = shape;
  });


  eventBus.on('create.cleanup', function(event) {
    var context = event.context;

    if (context.visual) {
      svgRemove(context.visual);
    }
  });

  // API

  this.start = function(event, shape, source) {

    dragging.init(event, 'create', {
      cursor: 'grabbing',
      autoActivate: true,
      data: {
        shape: shape,
        context: {
          shape: shape,
          source: source
        }
      }
    });
  };
}

Create.$inject = [ 'eventBus', 'dragging', 'rules', 'modeling', 'canvas', 'styles', 'graphicsFactory' ];

module.exports = Create;

},{"../../util/SvgTransformUtil":181,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/create":357,"tiny-svg/lib/remove":359}],84:[function(require,module,exports){
module.exports = {
  __depends__: [
    require('../dragging'),
    require('../selection'),
    require('../rules')
  ],
  create: [ 'type', require('./Create') ]
};

},{"../dragging":87,"../rules":138,"../selection":142,"./Create":83}],85:[function(require,module,exports){
'use strict';

/* global TouchEvent */

var round = Math.round;

var assign = require('lodash/object/assign');

var domEvent = require('min-dom/lib/event'),
    Event = require('../../util/Event'),
    ClickTrap = require('../../util/ClickTrap'),
    Cursor = require('../../util/Cursor');

var EventBusEvent = require('../../core/EventBus').Event;

var DRAG_ACTIVE_CLS = 'djs-drag-active';


function suppressEvent(event) {
  if (event instanceof MouseEvent) {
    Event.stopEvent(event, true);
  } else {
    Event.preventDefault(event);
  }
}

function getLength(point) {
  return Math.sqrt(Math.pow(point.x, 2) + Math.pow(point.y, 2));
}

function substract(p1, p2) {
  return {
    x: p1.x - p2.x,
    y: p1.y - p2.y
  };
}

/**
 * A helper that fires canvas localized drag events and realizes
 * the general "drag-and-drop" look and feel.
 *
 * Calling {@link Dragging#activate} activates dragging on a canvas.
 *
 * It provides the following:
 *
 *   * emits life cycle events, namespaced with a prefix assigned
 *     during dragging activation
 *   * sets and restores the cursor
 *   * sets and restores the selection
 *   * ensures there can be only one drag operation active at a time
 *
 * Dragging may be canceled manually by calling {@link Dragging#cancel}
 * or by pressing ESC.
 *
 *
 * ## Life-cycle events
 *
 * Dragging can be in three different states, off, initialized
 * and active.
 *
 * (1) off: no dragging operation is in progress
 * (2) initialized: a new drag operation got initialized but not yet
 *                  started (i.e. because of no initial move)
 * (3) started: dragging is in progress
 *
 * Eventually dragging will be off again after a drag operation has
 * been ended or canceled via user click or ESC key press.
 *
 * To indicate transitions between these states dragging emits generic
 * life-cycle events with the `drag.` prefix _and_ events namespaced
 * to a prefix choosen by a user during drag initialization.
 *
 * The following events are emitted (appropriately prefixed) via
 * the {@link EventBus}.
 *
 * * `init`
 * * `start`
 * * `move`
 * * `end`
 * * `ended` (dragging already in off state)
 * * `cancel` (only if previously started)
 * * `canceled` (dragging already in off state, only if previously started)
 * * `cleanup`
 *
 *
 * @example
 *
 * function MyDragComponent(eventBus, dragging) {
 *
 *   eventBus.on('mydrag.start', function(event) {
 *     console.log('yes, we start dragging');
 *   });
 *
 *   eventBus.on('mydrag.move', function(event) {
 *     console.log('canvas local coordinates', event.x, event.y, event.dx, event.dy);
 *
 *     // local drag data is passed with the event
 *     event.context.foo; // "BAR"
 *
 *     // the original mouse event, too
 *     event.originalEvent; // MouseEvent(...)
 *   });
 *
 *   eventBus.on('element.click', function(event) {
 *     dragging.init(event, 'mydrag', {
 *       cursor: 'grabbing',
 *       data: {
 *         context: {
 *           foo: "BAR"
 *         }
 *       }
 *     });
 *   });
 * }
 */
function Dragging(eventBus, canvas, selection) {

  var defaultOptions = {
    threshold: 5,
    trapClick: true
  };

  // the currently active drag operation
  // dragging is active as soon as this context exists.
  //
  // it is visually _active_ only when a context.active flag is set to true.
  var context;

  /* convert a global event into local coordinates */
  function toLocalPoint(globalPosition) {

    var viewbox = canvas.viewbox();

    var clientRect = canvas._container.getBoundingClientRect();

    return {
      x: viewbox.x + round((globalPosition.x - clientRect.left) / viewbox.scale),
      y: viewbox.y + round((globalPosition.y - clientRect.top) / viewbox.scale)
    };
  }

  // helpers

  function fire(type, dragContext) {
    dragContext = dragContext || context;

    var event = assign(new EventBusEvent(), dragContext.payload, dragContext.data);

    // default integration
    if (eventBus.fire('drag.' + type, event) === false) {
      return false;
    }

    return eventBus.fire(dragContext.prefix + '.' + type, event);
  }

  // event listeners

  function move(event, activate) {
    var payload = context.payload,
        displacement = context.displacement;

    var globalStart = context.globalStart,
        globalCurrent = Event.toPoint(event),
        globalDelta = substract(globalCurrent, globalStart);

    var localStart = context.localStart,
        localCurrent = toLocalPoint(globalCurrent),
        localDelta = substract(localCurrent, localStart);

    // activate context explicitly or once threshold is reached
    if (!context.active && (activate || getLength(globalDelta) > context.threshold)) {

      // fire start event with original
      // starting coordinates

      assign(payload, {
        x: localStart.x + displacement.x,
        y: localStart.y + displacement.y,
        dx: 0,
        dy: 0
      }, { originalEvent: event });

      if (false === fire('start')) {
        return cancel();
      }

      context.active = true;

      // unset selection and remember old selection
      // the previous (old) selection will always passed
      // with the event via the event.previousSelection property
      if (!context.keepSelection) {
        payload.previousSelection = selection.get();
        selection.select(null);
      }

      // allow custom cursor
      if (context.cursor) {
        Cursor.set(context.cursor);
      }

      // indicate dragging via marker on root element
      canvas.addMarker(canvas.getRootElement(), DRAG_ACTIVE_CLS);
    }

    suppressEvent(event);

    if (context.active) {

      // update payload with actual coordinates
      assign(payload, {
        x: localCurrent.x + displacement.x,
        y: localCurrent.y + displacement.y,
        dx: localDelta.x,
        dy: localDelta.y
      }, { originalEvent: event });

      // emit move event
      fire('move');
    }
  }

  function end(event) {
    var previousContext,
        returnValue = true;

    if (context.active) {

      if (event) {
        context.payload.originalEvent = event;

        // suppress original event (click, ...)
        // because we just ended a drag operation
        suppressEvent(event);
      }

      // implementations may stop restoring the
      // original state (selections, ...) by preventing the
      // end events default action
      returnValue = fire('end');
    }

    if (returnValue === false) {
      fire('rejected');
    }

    previousContext = cleanup(returnValue !== true);

    // last event to be fired when all drag operations are done
    // at this point in time no drag operation is in progress anymore
    fire('ended', previousContext);
  }


  // cancel active drag operation if the user presses
  // the ESC key on the keyboard

  function checkCancel(event) {

    if (event.which === 27) {
      event.preventDefault();

      cancel();
    }
  }


  // prevent ghost click that might occur after a finished
  // drag and drop session

  function trapClickAndEnd(event) {

    var untrap;

    // trap the click in case we are part of an active
    // drag operation. This will effectively prevent
    // the ghost click that cannot be canceled otherwise.
    if (context.active) {
      untrap = ClickTrap.install();
      setTimeout(untrap, 400);
    }

    end(event);
  }

  function trapTouch(event) {
    move(event);
  }

  // update the drag events hover (djs.model.Base) and hoverGfx (Snap<SVGElement>)
  // properties during hover and out and fire {prefix}.hover and {prefix}.out properties
  // respectively

  function hover(event) {
    var payload = context.payload;

    payload.hoverGfx = event.gfx;
    payload.hover = event.element;

    fire('hover');
  }

  function out(event) {
    fire('out');

    var payload = context.payload;

    payload.hoverGfx = null;
    payload.hover = null;
  }


  // life-cycle methods

  function cancel(restore) {
    var previousContext;

    if (!context) {
      return;
    }

    var wasActive = context.active;

    if (wasActive) {
      fire('cancel');
    }

    previousContext = cleanup(restore);

    if (wasActive) {
      // last event to be fired when all drag operations are done
      // at this point in time no drag operation is in progress anymore
      fire('canceled', previousContext);
    }
  }

  function cleanup(restore) {
    var previousContext,
        endDrag;

    fire('cleanup');

    // reset cursor
    Cursor.unset();

    if (context.trapClick) {
      endDrag = trapClickAndEnd;
    } else {
      endDrag = end;
    }

    // reset dom listeners
    domEvent.unbind(document, 'mousemove', move);

    domEvent.unbind(document, 'mousedown', endDrag, true);
    domEvent.unbind(document, 'mouseup', endDrag, true);

    domEvent.unbind(document, 'keyup', checkCancel);

    domEvent.unbind(document, 'touchstart', trapTouch, true);
    domEvent.unbind(document, 'touchcancel', cancel, true);
    domEvent.unbind(document, 'touchmove', move, true);
    domEvent.unbind(document, 'touchend', end, true);

    eventBus.off('element.hover', hover);
    eventBus.off('element.out', out);

    // remove drag marker on root element
    canvas.removeMarker(canvas.getRootElement(), DRAG_ACTIVE_CLS);

    // restore selection, unless it has changed
    var previousSelection = context.payload.previousSelection;

    if (restore !== false && previousSelection && !selection.get().length) {
      selection.select(previousSelection);
    }

    previousContext = context;

    context = null;

    return previousContext;
  }

  /**
   * Initialize a drag operation.
   *
   * If `localPosition` is given, drag events will be emitted
   * relative to it.
   *
   * @param {MouseEvent|TouchEvent} [event]
   * @param {Point} [localPosition] actual diagram local position this drag operation should start at
   * @param {String} prefix
   * @param {Object} [options]
   */
  function init(event, relativeTo, prefix, options) {

    // only one drag operation may be active, at a time
    if (context) {
      cancel(false);
    }

    if (typeof relativeTo === 'string') {
      options = prefix;
      prefix = relativeTo;
      relativeTo = null;
    }

    options = assign({}, defaultOptions, options || {});

    var data = options.data || {},
        originalEvent,
        globalStart,
        endDrag;

    if (options.trapClick) {
      endDrag = trapClickAndEnd;
    } else {
      endDrag = end;
    }

    if (event) {
      originalEvent = Event.getOriginal(event) || event;
      globalStart = Event.toPoint(event);

      suppressEvent(event);
    } else {
      originalEvent = null;
      globalStart = { x: 0, y: 0 };
    }

    var localStart = toLocalPoint(globalStart);

    if (!relativeTo) {
      relativeTo = localStart;
    }

    context = assign({
      prefix: prefix,
      data: data,
      payload: {},
      globalStart: globalStart,
      displacement: substract(relativeTo, localStart),
      localStart: localStart
    }, options);

    // skip dom registration if trigger
    // is set to manual (during testing)
    if (!options.manual) {

      // add dom listeners

      // fixes TouchEvent not being available on desktop Firefox
      if (typeof TouchEvent !== 'undefined' && originalEvent instanceof TouchEvent) {
        domEvent.bind(document, 'touchstart', trapTouch, true);
        domEvent.bind(document, 'touchcancel', cancel, true);
        domEvent.bind(document, 'touchmove', move, true);
        domEvent.bind(document, 'touchend', end, true);
      } else {
        // assume we use the mouse to interact per default
        domEvent.bind(document, 'mousemove', move);

        domEvent.bind(document, 'mousedown', endDrag, true);
        domEvent.bind(document, 'mouseup', endDrag, true);
      }

      domEvent.bind(document, 'keyup', checkCancel);

      eventBus.on('element.hover', hover);
      eventBus.on('element.out', out);
    }

    fire('init');

    if (options.autoActivate) {
      move(event, true);
    }
  }

  // cancel on diagram destruction
  eventBus.on('diagram.destroy', cancel);


  // API

  this.init = init;
  this.move = move;
  this.hover = hover;
  this.out = out;
  this.end = end;

  this.cancel = cancel;

  // for introspection

  this.context = function() {
    return context;
  };

  this.setOptions = function(options) {
    assign(defaultOptions, options);
  };
}

Dragging.$inject = [ 'eventBus', 'canvas', 'selection' ];

module.exports = Dragging;

},{"../../core/EventBus":62,"../../util/ClickTrap":166,"../../util/Cursor":168,"../../util/Event":170,"lodash/object/assign":328,"min-dom/lib/event":344}],86:[function(require,module,exports){
'use strict';

var domClosest = require('min-dom/lib/closest');

var Event = require('../../util/Event');

function getGfx(target) {
  var node = domClosest(target, 'svg, .djs-element', true);
  return node;
}


/**
 * Browsers may swallow the hover event if users are to
 * fast with the mouse.
 *
 * @see http://stackoverflow.com/questions/7448468/why-cant-i-reliably-capture-a-mouseout-event
 *
 * The fix implemented in this component ensure that we
 * have a hover state after a successive drag.move event.
 *
 * @param {EventBus} eventBus
 * @param {Dragging} dragging
 * @param {ElementRegistry} elementRegistry
 */
function HoverFix(eventBus, dragging, elementRegistry) {

  var self = this;

  // we wait for a specific sequence of events before
  // emitting a fake drag.hover event.
  //
  // Event Sequence:
  //
  // drag.start
  // drag.move
  // drag.move >> ensure we are hovering
  //
  eventBus.on('drag.start', function(event) {

    eventBus.once('drag.move', function() {

      eventBus.once('drag.move', function(event) {

        self.ensureHover(event);
      });
    });
  });

  /**
   * Make sure we are god damn hovering!
   *
   * @param {Event} dragging event
   */
  this.ensureHover = function(event) {

    if (event.hover) {
      return;
    }

    var originalEvent = event.originalEvent,
        position,
        target,
        element,
        gfx;

    if (!(originalEvent instanceof MouseEvent)) {
      return;
    }

    position = Event.toPoint(originalEvent);

    // damn expensive operation, ouch!
    target = document.elementFromPoint(position.x, position.y);

    gfx = getGfx(target);

    if (gfx) {
      element = elementRegistry.get(gfx);

      dragging.hover({ element: element, gfx: gfx });
    }
  };

}

HoverFix.$inject = [ 'eventBus', 'dragging', 'elementRegistry' ];

module.exports = HoverFix;

},{"../../util/Event":170,"min-dom/lib/closest":341}],87:[function(require,module,exports){
module.exports = {
  __init__: [
    'hoverFix'
  ],
  __depends__: [
    require('../selection')
  ],
  dragging: [ 'type', require('./Dragging') ],
  hoverFix: [ 'type', require('./HoverFix') ]
};
},{"../selection":142,"./Dragging":85,"./HoverFix":86}],88:[function(require,module,exports){
'use strict';

var MARKER_OK = 'connect-ok',
    MARKER_NOT_OK = 'connect-not-ok';


function GlobalConnect(eventBus, dragging, connect, canvas, toolManager) {
  var self = this;

  this._dragging = dragging;

  toolManager.registerTool('global-connect', {
    tool: 'global-connect',
    dragging: 'global-connect.drag'
  });

  eventBus.on('global-connect.hover', function(event) {
    var context = event.context,
        startTarget = event.hover;

    var canStartConnect = context.canStartConnect = self.canStartConnect(startTarget);

    // simply ignore hover
    if (canStartConnect === null) {
      return;
    }

    context.startTarget = startTarget;

    canvas.addMarker(startTarget, canStartConnect ? MARKER_OK : MARKER_NOT_OK);
  });


  eventBus.on([ 'global-connect.out', 'global-connect.cleanup' ], function(event) {
    var startTarget = event.context.startTarget,
        canStartConnect = event.context.canStartConnect;

    if (startTarget) {
      canvas.removeMarker(startTarget, canStartConnect ? MARKER_OK : MARKER_NOT_OK);
    }
  });


  eventBus.on([ 'global-connect.ended' ], function(event) {
    var context = event.context,
        startTarget = context.startTarget,
        startPosition = {
          x: event.x,
          y: event.y
        };

    var canStartConnect = self.canStartConnect(startTarget);

    if (!canStartConnect) {
      return;
    }

    eventBus.once('element.out', function() {
      eventBus.once([ 'connect.ended', 'connect.canceled' ], function() {
        eventBus.fire('global-connect.drag.ended');
      });

      connect.start(null, startTarget, startPosition);
    });

    return false;
  });
}

GlobalConnect.$inject = [ 'eventBus', 'dragging', 'connect', 'canvas', 'toolManager' ];

module.exports = GlobalConnect;


/**
 * Initiates tool activity.
 */
GlobalConnect.prototype.start = function(event) {
  this._dragging.init(event, 'global-connect', {
    trapClick: false,
    data: {
      context: {}
    }
  });
};


GlobalConnect.prototype.toggle = function() {
  if (this.isActive()) {
    this._dragging.cancel();
  } else {
    this.start();
  }
};

GlobalConnect.prototype.isActive = function() {
  var context = this._dragging.context();

  return context && /^global-connect/.test(context.prefix);
};


GlobalConnect.prototype.registerProvider = function(provider) {
  this._provider = provider;
};


/**
 * Check if source shape can initiate connection.
 *
 * @param  {Shape} startTarget
 * @return {Boolean}
 */
GlobalConnect.prototype.canStartConnect = function(startTarget) {
  return this._provider.canStartConnect(startTarget);
};

},{}],89:[function(require,module,exports){
module.exports = {
  __depends__: [
    require('../connect'),
    require('../rules'),
    require('../dragging'),
    require('../tool-manager')
  ],
  globalConnect: [ 'type', require('./GlobalConnect') ]
};

},{"../connect":80,"../dragging":87,"../rules":138,"../tool-manager":151,"./GlobalConnect":88}],90:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    domDelegate = require('min-dom/lib/delegate');

var isPrimaryButton = require('../../util/Mouse').isPrimaryButton;

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgCreate = require('tiny-svg/lib/create');

var domQuery = require('min-dom/lib/query');

var renderUtil = require('../../util/RenderUtil');

var createLine = renderUtil.createLine,
    updateLine = renderUtil.updateLine;

var LOW_PRIORITY = 500;

/**
 * A plugin that provides interaction events for diagram elements.
 *
 * It emits the following events:
 *
 *   * element.hover
 *   * element.out
 *   * element.click
 *   * element.dblclick
 *   * element.mousedown
 *
 * Each event is a tuple { element, gfx, originalEvent }.
 *
 * Canceling the event via Event#preventDefault() prevents the original DOM operation.
 *
 * @param {EventBus} eventBus
 */
function InteractionEvents(eventBus, elementRegistry, styles) {

  var HIT_STYLE = styles.cls('djs-hit', [ 'no-fill', 'no-border' ], {
    stroke: 'white',
    strokeWidth: 15
  });

  /**
   * Fire an interaction event.
   *
   * @param {String} type local event name, e.g. element.click.
   * @param {DOMEvent} event native event
   * @param {djs.model.Base} [element] the diagram element to emit the event on;
   *                                   defaults to the event target
   */
  function fire(type, event, element) {

    // only react on left mouse button interactions
    // for interaction events
    if (!isPrimaryButton(event)) {
      return;
    }

    var target, gfx, returnValue;

    if (!element) {
      target = event.delegateTarget || event.target;

      if (target) {
        gfx = target;
        element = elementRegistry.get(gfx);
      }
    } else {
      gfx = elementRegistry.getGraphics(element);
    }

    if (!gfx || !element) {
      return;
    }

    returnValue = eventBus.fire(type, { element: element, gfx: gfx, originalEvent: event });

    if (returnValue === false) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  // TODO(nikku): document this
  var handlers = {};

  function mouseHandler(type) {

    var fn = handlers[type];

    if (!fn) {
      fn = handlers[type] = function(event) {
        fire(type, event);
      };
    }

    return fn;
  }

  var bindings = {
    mouseover: 'element.hover',
    mouseout: 'element.out',
    click: 'element.click',
    dblclick: 'element.dblclick',
    mousedown: 'element.mousedown',
    mouseup: 'element.mouseup'
  };


  ///// manual event trigger

  /**
   * Trigger an interaction event (based on a native dom event)
   * on the target shape or connection.
   *
   * @param {String} eventName the name of the triggered DOM event
   * @param {MouseEvent} event
   * @param {djs.model.Base} targetElement
   */
  function triggerMouseEvent(eventName, event, targetElement) {

    // i.e. element.mousedown...
    var localEventName = bindings[eventName];

    if (!localEventName) {
      throw new Error('unmapped DOM event name <' + eventName + '>');
    }

    return fire(localEventName, event, targetElement);
  }


  var elementSelector = 'svg, .djs-element';

  ///// event registration

  function registerEvent(node, event, localEvent) {
    var handler = mouseHandler(localEvent);
    handler.$delegate = domDelegate.bind(node, elementSelector, event, handler);
  }

  function unregisterEvent(node, event, localEvent) {
    domDelegate.unbind(node, event, mouseHandler(localEvent).$delegate);
  }

  function registerEvents(svg) {
    forEach(bindings, function(val, key) {
      registerEvent(svg, key, val);
    });
  }

  function unregisterEvents(svg) {
    forEach(bindings, function(val, key) {
      unregisterEvent(svg, key, val);
    });
  }

  eventBus.on('canvas.destroy', function(event) {
    unregisterEvents(event.svg);
  });

  eventBus.on('canvas.init', function(event) {
    registerEvents(event.svg);
  });


  eventBus.on([ 'shape.added', 'connection.added' ], function(event) {
    var element = event.element,
        gfx = event.gfx,
        hit;

    if (element.waypoints) {
      hit = createLine(element.waypoints);
    } else {
      hit = svgCreate('rect');
      svgAttr(hit, {
        x: 0,
        y: 0,
        width: element.width,
        height: element.height
      });
    }

    svgAttr(hit, HIT_STYLE);

    svgAppend(gfx, hit);
  });

  // Update djs-hit on change.
  // A low priortity is necessary, because djs-hit of labels has to be updated
  // after the label bounds have been updated in the renderer.
  eventBus.on('shape.changed', LOW_PRIORITY, function(event) {

    var element = event.element,
        gfx = event.gfx,
        hit = domQuery('.djs-hit', gfx);

    svgAttr(hit, {
      width: element.width,
      height: element.height
    });
  });

  eventBus.on('connection.changed', function(event) {

    var element = event.element,
        gfx = event.gfx,
        hit = domQuery('.djs-hit', gfx);

    updateLine(hit, element.waypoints);
  });


  // API

  this.fire = fire;

  this.triggerMouseEvent = triggerMouseEvent;

  this.mouseHandler = mouseHandler;

  this.registerEvent = registerEvent;
  this.unregisterEvent = unregisterEvent;
}


InteractionEvents.$inject = [ 'eventBus', 'elementRegistry', 'styles' ];

module.exports = InteractionEvents;


/**
 * An event indicating that the mouse hovered over an element
 *
 * @event element.hover
 *
 * @type {Object}
 * @property {djs.model.Base} element
 * @property {SVGElement} gfx
 * @property {Event} originalEvent
 */

/**
 * An event indicating that the mouse has left an element
 *
 * @event element.out
 *
 * @type {Object}
 * @property {djs.model.Base} element
 * @property {SVGElement} gfx
 * @property {Event} originalEvent
 */

/**
 * An event indicating that the mouse has clicked an element
 *
 * @event element.click
 *
 * @type {Object}
 * @property {djs.model.Base} element
 * @property {SVGElement} gfx
 * @property {Event} originalEvent
 */

/**
 * An event indicating that the mouse has double clicked an element
 *
 * @event element.dblclick
 *
 * @type {Object}
 * @property {djs.model.Base} element
 * @property {SVGElement} gfx
 * @property {Event} originalEvent
 */

/**
 * An event indicating that the mouse has gone down on an element.
 *
 * @event element.mousedown
 *
 * @type {Object}
 * @property {djs.model.Base} element
 * @property {SVGElement} gfx
 * @property {Event} originalEvent
 */

/**
 * An event indicating that the mouse has gone up on an element.
 *
 * @event element.mouseup
 *
 * @type {Object}
 * @property {djs.model.Base} element
 * @property {SVGElement} gfx
 * @property {Event} originalEvent
 */

},{"../../util/Mouse":176,"../../util/RenderUtil":180,"lodash/collection/forEach":204,"min-dom/lib/delegate":342,"min-dom/lib/query":346,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/create":357}],91:[function(require,module,exports){
module.exports = {
  __init__: [ 'interactionEvents' ],
  interactionEvents: [ 'type', require('./InteractionEvents') ]
};
},{"./InteractionEvents":90}],92:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    filter = require('lodash/collection/filter'),
    inherits = require('inherits');

var LOW_PRIORITY = 250,
    HIGH_PRIORITY = 1400;

var CommandInterceptor = require('../../command/CommandInterceptor');


/**
 * A handler that makes sure labels are properly moved with
 * their label targets.
 */
function LabelSupport(eventBus, modeling, movePreview) {

  CommandInterceptor.call(this, eventBus);

  // remove labels from the collection that are being
  // moved with other elements anyway
  eventBus.on('shape.move.start', HIGH_PRIORITY, function(e) {

    var context = e.context,
        shapes = context.shapes,
        validatedShapes = context.validatedShapes;

    context.shapes = removeLabels(shapes);
    context.validatedShapes = removeLabels(validatedShapes);
  });


  // add labels to visual's group
  eventBus.on('shape.move.start', LOW_PRIORITY, function(e) {

    var context = e.context,
        shapes = context.shapes;

    var labels = [];

    forEach(shapes, function(element) {
      var label = element.label;

      if (label && !label.hidden && context.shapes.indexOf(label) === -1) {
        labels.push(label);
      }

      if (element.labelTarget) {
        labels.push(element);
      }
    });

    forEach(labels, function(label) {
      movePreview.makeDraggable(context, label, true);
    });

  });

  // move labels after the other shapes are done moving
  this.postExecuted([ 'elements.move' ], function(e) {
    var context = e.context,
        closure = context.closure,
        enclosedElements = closure.enclosedElements;

    // ensure we move all labels with their respective elements
    // if they have not been moved already

    forEach(enclosedElements, function(e) {
      if (e.label && !enclosedElements[e.label.id]) {
        modeling.moveShape(e.label, context.delta, e.parent);
      }
    });

  });

}

inherits(LabelSupport, CommandInterceptor);

LabelSupport.$inject = [ 'eventBus', 'modeling', 'movePreview' ];

module.exports = LabelSupport;


/**
 * Return a filtered list of elements that do not
 * contain attached elements with hosts being part
 * of the selection.
 *
 * @param  {Array<djs.model.Base>} elements
 *
 * @return {Array<djs.model.Base>} filtered
 */
function removeLabels(elements) {

  return filter(elements, function(element) {

    // filter out labels that are move together
    // with their label targets
    return elements.indexOf(element.labelTarget) === -1;
  });
}

},{"../../command/CommandInterceptor":56,"inherits":191,"lodash/collection/filter":202,"lodash/collection/forEach":204}],93:[function(require,module,exports){
module.exports = {
  __depends__: [
    require('../move')
  ],
  __init__: [ 'labelSupport'],
  labelSupport: [ 'type', require('./LabelSupport') ]
};

},{"../move":121,"./LabelSupport":92}],94:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var model = require('../../model');


/**
 * The basic modeling entry point.
 *
 * @param {EventBus} eventBus
 * @param {ElementFactory} elementFactory
 * @param {CommandStack} commandStack
 */
function Modeling(eventBus, elementFactory, commandStack) {
  this._eventBus = eventBus;
  this._elementFactory = elementFactory;
  this._commandStack = commandStack;

  var self = this;

  eventBus.on('diagram.init', function() {
    // register modeling handlers
    self.registerHandlers(commandStack);
  });
}

Modeling.$inject = [ 'eventBus', 'elementFactory', 'commandStack' ];

module.exports = Modeling;


Modeling.prototype.getHandlers = function() {
  return {
    'shape.append': require('./cmd/AppendShapeHandler'),
    'shape.create': require('./cmd/CreateShapeHandler'),
    'shape.delete': require('./cmd/DeleteShapeHandler'),
    'shape.move': require('./cmd/MoveShapeHandler'),
    'shape.resize': require('./cmd/ResizeShapeHandler'),
    'shape.replace': require('./cmd/ReplaceShapeHandler'),
    'shape.toggleCollapse': require('./cmd/ToggleShapeCollapseHandler'),

    'spaceTool': require('./cmd/SpaceToolHandler'),

    'label.create': require('./cmd/CreateLabelHandler'),

    'connection.create': require('./cmd/CreateConnectionHandler'),
    'connection.delete': require('./cmd/DeleteConnectionHandler'),
    'connection.move': require('./cmd/MoveConnectionHandler'),
    'connection.layout': require('./cmd/LayoutConnectionHandler'),

    'connection.updateWaypoints': require('./cmd/UpdateWaypointsHandler'),

    'connection.reconnectStart': require('./cmd/ReconnectConnectionHandler'),
    'connection.reconnectEnd': require('./cmd/ReconnectConnectionHandler'),

    'elements.move': require('./cmd/MoveElementsHandler'),
    'elements.delete': require('./cmd/DeleteElementsHandler'),

    'elements.distribute': require('./cmd/DistributeElementsHandler'),
    'elements.align': require('./cmd/AlignElementsHandler'),

    'element.updateAttachment': require('./cmd/UpdateAttachmentHandler'),

    'elements.paste': require('./cmd/PasteHandler')
  };
};

/**
 * Register handlers with the command stack
 *
 * @param {CommandStack} commandStack
 */
Modeling.prototype.registerHandlers = function(commandStack) {
  forEach(this.getHandlers(), function(handler, id) {
    commandStack.registerHandler(id, handler);
  });
};


///// modeling helpers /////////////////////////////////////////

Modeling.prototype.moveShape = function(shape, delta, newParent, newParentIndex, hints) {

  if (typeof newParentIndex === 'object') {
    hints = newParentIndex;
    newParentIndex = null;
  }

  var context = {
    shape: shape,
    delta:  delta,
    newParent: newParent,
    newParentIndex: newParentIndex,
    hints: hints || {}
  };

  this._commandStack.execute('shape.move', context);
};


/**
 * Update the attachment of the given shape.
 *
 * @param  {djs.mode.Base} shape
 * @param  {djs.model.Base} [newHost]
 */
Modeling.prototype.updateAttachment = function(shape, newHost) {
  var context = {
    shape: shape,
    newHost: newHost
  };

  this._commandStack.execute('element.updateAttachment', context);
};

/**
 * Move a number of shapes to a new target, either setting it as
 * the new parent or attaching it.
 *
 * @param {Array<djs.mode.Base>} shapes
 * @param {Point} delta
 * @param {djs.model.Base} [target]
 * @param {Boolean} [isAttach=false]
 * @param {Object} [hints]
 */
Modeling.prototype.moveElements = function(shapes, delta, target, isAttach, hints) {
  if (typeof isAttach === 'object') {
    hints = isAttach;
    isAttach = undefined;
  }

  var newParent = target,
      newHost;

  if (isAttach === true) {
    newHost = target;
    newParent = target.parent;
  }

  if (isAttach === false) {
    newHost = null;
  }

  var context = {
    shapes: shapes,
    delta: delta,
    newParent: newParent,
    newHost: newHost,
    hints: hints || {}
  };

  this._commandStack.execute('elements.move', context);
};

Modeling.prototype.moveConnection = function(connection, delta, newParent, newParentIndex, hints) {

  if (typeof newParentIndex === 'object') {
    hints = newParentIndex;
    newParentIndex = undefined;
  }

  var context = {
    connection: connection,
    delta: delta,
    newParent: newParent,
    newParentIndex: newParentIndex,
    hints: hints || {}
  };

  this._commandStack.execute('connection.move', context);
};


Modeling.prototype.layoutConnection = function(connection, hints) {
  var context = {
    connection: connection,
    hints: hints || {}
  };

  this._commandStack.execute('connection.layout', context);
};

/**
 * Create connection.
 *
 * @param {djs.model.Base} source
 * @param {djs.model.Base} target
 * @param {Number} [targetIndex]
 * @param {Object|djs.model.Connection} connection
 * @param {djs.model.Base} parent
 * @param {Object} hints
 *
 * @return {djs.model.Connection} the created connection.
 */
Modeling.prototype.createConnection = function(source, target, targetIndex, connection, parent, hints) {

  if (typeof targetIndex === 'object') {
    hints = parent;
    parent = connection;
    connection = targetIndex;
    targetIndex = undefined;
  }

  connection = this._create('connection', connection);

  var context = {
    source: source,
    target: target,
    parent: parent,
    parentIndex: targetIndex,
    connection: connection,
    hints: hints
  };

  this._commandStack.execute('connection.create', context);

  return context.connection;
};

Modeling.prototype.createShape = function(shape, position, target, targetIndex, isAttach, hints) {

  if (typeof targetIndex !== 'number') {
    hints = isAttach;
    isAttach = targetIndex;
  }

  if (typeof isAttach !== 'boolean') {
    hints = isAttach;
    isAttach = false;
  }

  shape = this._create('shape', shape);

  var context = {
    position: position,
    shape: shape,
    parent: target,
    parentIndex: targetIndex,
    host: shape.host,
    hints: hints || {}
  };

  if (isAttach) {
    context.parent = target.parent;
    context.host = target;
  }

  this._commandStack.execute('shape.create', context);

  return context.shape;
};


Modeling.prototype.createLabel = function(labelTarget, position, label, parent) {

  label = this._create('label', label);

  var context = {
    labelTarget: labelTarget,
    position: position,
    parent: parent || labelTarget.parent,
    shape: label
  };

  this._commandStack.execute('label.create', context);

  return context.shape;
};


Modeling.prototype.appendShape = function(source, shape, position, parent, connection, connectionParent) {

  shape = this._create('shape', shape);

  var context = {
    source: source,
    position: position,
    parent: parent,
    shape: shape,
    connection: connection,
    connectionParent: connectionParent
  };

  this._commandStack.execute('shape.append', context);

  return context.shape;
};


Modeling.prototype.removeElements = function(elements) {
  var context = {
    elements: elements
  };

  this._commandStack.execute('elements.delete', context);
};


Modeling.prototype.distributeElements = function(groups, axis, dimension) {
  var context = {
    groups: groups,
    axis: axis,
    dimension: dimension
  };

  this._commandStack.execute('elements.distribute', context);
};


Modeling.prototype.removeShape = function(shape, hints) {
  var context = {
    shape: shape,
    hints: hints || {}
  };

  this._commandStack.execute('shape.delete', context);
};


Modeling.prototype.removeConnection = function(connection, hints) {
  var context = {
    connection: connection,
    hints: hints || {}
  };

  this._commandStack.execute('connection.delete', context);
};

Modeling.prototype.replaceShape = function(oldShape, newShape, hints) {
  var context = {
    oldShape: oldShape,
    newData: newShape,
    hints: hints || {}
  };

  this._commandStack.execute('shape.replace', context);

  return context.newShape;
};

Modeling.prototype.pasteElements = function(tree, topParent, position) {
  var context = {
    tree: tree,
    topParent: topParent,
    position: position
  };

  this._commandStack.execute('elements.paste', context);
};

Modeling.prototype.alignElements = function(elements, alignment) {
  var context = {
    elements: elements,
    alignment: alignment
  };

  this._commandStack.execute('elements.align', context);
};

Modeling.prototype.resizeShape = function(shape, newBounds, minBounds) {
  var context = {
    shape: shape,
    newBounds: newBounds,
    minBounds: minBounds
  };

  this._commandStack.execute('shape.resize', context);
};

Modeling.prototype.createSpace = function(movingShapes, resizingShapes, delta, direction) {
  var context = {
    movingShapes: movingShapes,
    resizingShapes: resizingShapes,
    delta: delta,
    direction: direction
  };

  this._commandStack.execute('spaceTool', context);
};

Modeling.prototype.updateWaypoints = function(connection, newWaypoints, hints) {
  var context = {
    connection: connection,
    newWaypoints: newWaypoints,
    hints: hints || {}
  };

  this._commandStack.execute('connection.updateWaypoints', context);
};

Modeling.prototype.reconnectStart = function(connection, newSource, dockingOrPoints) {
  var context = {
    connection: connection,
    newSource: newSource,
    dockingOrPoints: dockingOrPoints
  };

  this._commandStack.execute('connection.reconnectStart', context);
};

Modeling.prototype.reconnectEnd = function(connection, newTarget, dockingOrPoints) {
  var context = {
    connection: connection,
    newTarget: newTarget,
    dockingOrPoints: dockingOrPoints
  };

  this._commandStack.execute('connection.reconnectEnd', context);
};

Modeling.prototype.connect = function(source, target, attrs, hints) {
  return this.createConnection(source, target, attrs || {}, source.parent, hints);
};

Modeling.prototype._create = function(type, attrs) {
  if (attrs instanceof model.Base) {
    return attrs;
  } else {
    return this._elementFactory.create(type, attrs);
  }
};

Modeling.prototype.toggleCollapse = function(shape, hints) {
  var context = {
    shape: shape,
    hints: hints || {}
  };

  this._commandStack.execute('shape.toggleCollapse', context);
};

},{"../../model":163,"./cmd/AlignElementsHandler":95,"./cmd/AppendShapeHandler":96,"./cmd/CreateConnectionHandler":97,"./cmd/CreateLabelHandler":98,"./cmd/CreateShapeHandler":99,"./cmd/DeleteConnectionHandler":100,"./cmd/DeleteElementsHandler":101,"./cmd/DeleteShapeHandler":102,"./cmd/DistributeElementsHandler":103,"./cmd/LayoutConnectionHandler":104,"./cmd/MoveConnectionHandler":105,"./cmd/MoveElementsHandler":106,"./cmd/MoveShapeHandler":107,"./cmd/PasteHandler":109,"./cmd/ReconnectConnectionHandler":110,"./cmd/ReplaceShapeHandler":111,"./cmd/ResizeShapeHandler":112,"./cmd/SpaceToolHandler":113,"./cmd/ToggleShapeCollapseHandler":114,"./cmd/UpdateAttachmentHandler":115,"./cmd/UpdateWaypointsHandler":116,"lodash/collection/forEach":204}],95:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

/**
 * A handler that align elements in a certain way.
 *
 */
function AlignElements(modeling, canvas) {
  this._modeling = modeling;
  this._canvas = canvas;
}

AlignElements.$inject = [ 'modeling', 'canvas' ];

module.exports = AlignElements;


AlignElements.prototype.preExecute = function(context) {
  var modeling = this._modeling;

  var elements = context.elements,
      alignment = context.alignment;


  forEach(elements, function(element) {
    var delta = {
      x: 0,
      y: 0
    };

    if (alignment.left) {
      delta.x = alignment.left - element.x;

    } else if (alignment.right) {
      delta.x = (alignment.right - element.width) - element.x;

    } else if (alignment.center) {
      delta.x = (alignment.center - Math.round(element.width / 2)) - element.x;

    } else if (alignment.top) {
      delta.y = alignment.top - element.y;

    } else if (alignment.bottom) {
      delta.y = (alignment.bottom - element.height) - element.y;

    } else if (alignment.middle) {
      delta.y = (alignment.middle - Math.round(element.height / 2)) - element.y;
    }

    modeling.moveElements([ element ], delta, element.parent);
  });
};

AlignElements.prototype.postExecute = function(context) {

};

},{"lodash/collection/forEach":204}],96:[function(require,module,exports){
'use strict';

var any = require('lodash/collection/any');

var inherits = require('inherits');


/**
 * A handler that implements reversible appending of shapes
 * to a source shape.
 *
 * @param {canvas} Canvas
 * @param {elementFactory} ElementFactory
 * @param {modeling} Modeling
 */
function AppendShapeHandler(modeling) {
  this._modeling = modeling;
}

inherits(AppendShapeHandler, require('./NoopHandler'));


AppendShapeHandler.$inject = [ 'modeling' ];

module.exports = AppendShapeHandler;


////// api /////////////////////////////////////////////

/**
 * Creates a new shape
 *
 * @param {Object} context
 * @param {ElementDescriptor} context.shape the new shape
 * @param {ElementDescriptor} context.source the source object
 * @param {ElementDescriptor} context.parent the parent object
 * @param {Point} context.position position of the new element
 */
AppendShapeHandler.prototype.preExecute = function(context) {

  if (!context.source) {
    throw new Error('source required');
  }

  var parent = context.parent || context.source.parent,
      shape = this._modeling.createShape(context.shape, context.position, parent);

  context.shape = shape;
};

AppendShapeHandler.prototype.postExecute = function(context) {
  var parent = context.connectionParent || context.shape.parent;

  if (!existsConnection(context.source, context.shape)) {

    // create connection
    this._modeling.connect(context.source, context.shape, context.connection, parent);
  }
};


function existsConnection(source, target) {
  return any(source.outgoing, function(c) {
    return c.target === target;
  });
}
},{"./NoopHandler":108,"inherits":191,"lodash/collection/any":200}],97:[function(require,module,exports){
'use strict';


function CreateConnectionHandler(canvas, layouter) {
  this._canvas = canvas;
  this._layouter = layouter;
}

CreateConnectionHandler.$inject = [ 'canvas', 'layouter' ];

module.exports = CreateConnectionHandler;



////// api /////////////////////////////////////////

/**
 * Appends a shape to a target shape
 *
 * @param {Object} context
 * @param {djs.element.Base} context.source the source object
 * @param {djs.element.Base} context.target the parent object
 * @param {Point} context.position position of the new element
 */
CreateConnectionHandler.prototype.execute = function(context) {

  var connection = context.connection,
      source = context.source,
      target = context.target,
      parent = context.parent,
      hints = context.hints;

  if (!source || !target) {
    throw new Error('source and target required');
  }

  if (!parent) {
    throw new Error('parent required');
  }

  connection.source = source;
  connection.target = target;

  if (!connection.waypoints) {
    connection.waypoints = this._layouter.layoutConnection(connection, hints);
  }

  // add connection
  this._canvas.addConnection(connection, parent);

  return connection;
};

CreateConnectionHandler.prototype.revert = function(context) {
  var connection = context.connection;

  this._canvas.removeConnection(connection);

  connection.source = null;
  connection.target = null;
};
},{}],98:[function(require,module,exports){
'use strict';

var inherits = require('inherits');

var CreateShapeHandler = require('./CreateShapeHandler');


/**
 * A handler that attaches a label to a given target shape.
 *
 * @param {canvas} Canvas
 */
function CreateLabelHandler(canvas) {
  CreateShapeHandler.call(this, canvas);
}

inherits(CreateLabelHandler, CreateShapeHandler);

CreateLabelHandler.$inject = [ 'canvas' ];

module.exports = CreateLabelHandler;



////// api /////////////////////////////////////////


var originalExecute = CreateShapeHandler.prototype.execute;

/**
 * Appends a label to a target shape.
 *
 * @method CreateLabelHandler#execute
 *
 * @param {Object} context
 * @param {ElementDescriptor} context.target the element the label is attached to
 * @param {ElementDescriptor} context.parent the parent object
 * @param {Point} context.position position of the new element
 */
CreateLabelHandler.prototype.execute = function(context) {

  var label = context.shape;

  ensureValidDimensions(label);

  label.labelTarget = context.labelTarget;

  return originalExecute.call(this, context);
};

var originalRevert = CreateShapeHandler.prototype.revert;

/**
 * Undo append by removing the shape
 */
CreateLabelHandler.prototype.revert = function(context) {
  context.shape.labelTarget = null;

  return originalRevert.call(this, context);
};


////// helpers /////////////////////////////////////////

function ensureValidDimensions(label) {
  // make sure a label has valid { width, height } dimensions
  [ 'width', 'height' ].forEach(function(prop) {
    if (typeof label[prop] === 'undefined') {
      label[prop] = 0;
    }
  });
}
},{"./CreateShapeHandler":99,"inherits":191}],99:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign');

var round = Math.round;


/**
 * A handler that implements reversible addition of shapes.
 *
 * @param {canvas} Canvas
 */
function CreateShapeHandler(canvas) {
  this._canvas = canvas;
}

CreateShapeHandler.$inject = [ 'canvas' ];

module.exports = CreateShapeHandler;



////// api /////////////////////////////////////////


/**
 * Appends a shape to a target shape
 *
 * @param {Object} context
 * @param {djs.model.Base} context.parent the parent object
 * @param {Point} context.position position of the new element
 */
CreateShapeHandler.prototype.execute = function(context) {

  var shape = context.shape,
      positionOrBounds = context.position,
      parent = context.parent,
      parentIndex = context.parentIndex;

  if (!parent) {
    throw new Error('parent required');
  }

  if (!positionOrBounds) {
    throw new Error('position required');
  }

  // (1) add at event center position _or_ at given bounds
  if (positionOrBounds.width !== undefined) {
    assign(shape, positionOrBounds);
  } else {
    assign(shape, {
      x: positionOrBounds.x - round(shape.width / 2),
      y: positionOrBounds.y - round(shape.height / 2)
    });
  }

  // (2) add to canvas
  this._canvas.addShape(shape, parent, parentIndex);

  return shape;
};


/**
 * Undo append by removing the shape
 */
CreateShapeHandler.prototype.revert = function(context) {

  // (3) remove form canvas
  this._canvas.removeShape(context.shape);
};
},{"lodash/object/assign":328}],100:[function(require,module,exports){
'use strict';

var Collections = require('../../../util/Collections');


/**
 * A handler that implements reversible deletion of Connections.
 *
 */
function DeleteConnectionHandler(canvas, modeling) {
  this._canvas = canvas;
  this._modeling = modeling;
}

DeleteConnectionHandler.$inject = [ 'canvas', 'modeling' ];

module.exports = DeleteConnectionHandler;


/**
 * - Remove attached label
 */
DeleteConnectionHandler.prototype.preExecute = function(context) {

  var connection = context.connection;

  // Remove label
  if (connection.label) {
    this._modeling.removeShape(connection.label);
  }
};

DeleteConnectionHandler.prototype.execute = function(context) {

  var connection = context.connection,
      parent = connection.parent;

  context.parent = parent;
  context.parentIndex = Collections.indexOf(parent.children, connection);

  context.source = connection.source;
  context.target = connection.target;

  this._canvas.removeConnection(connection);

  connection.source = null;
  connection.target = null;
  connection.label  = null;

  return connection;
};

/**
 * Command revert implementation.
 */
DeleteConnectionHandler.prototype.revert = function(context) {

  var connection = context.connection,
      parent = context.parent,
      parentIndex = context.parentIndex;

  connection.source = context.source;
  connection.target = context.target;

  // restore previous location in old parent
  Collections.add(parent.children, connection, parentIndex);

  this._canvas.addConnection(connection, parent);

  return connection;
};

},{"../../../util/Collections":167}],101:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    inherits = require('inherits');


function DeleteElementsHandler(modeling, elementRegistry) {
  this._modeling = modeling;
  this._elementRegistry = elementRegistry;
}

inherits(DeleteElementsHandler, require('./NoopHandler'));

DeleteElementsHandler.$inject = [ 'modeling', 'elementRegistry' ];

module.exports = DeleteElementsHandler;


DeleteElementsHandler.prototype.postExecute = function(context) {

  var modeling = this._modeling,
      elementRegistry = this._elementRegistry,
      elements = context.elements;

  forEach(elements, function(element) {

    // element may have been removed with previous
    // remove operations already (e.g. in case of nesting)
    if (!elementRegistry.get(element.id)) {
      return;
    }

    if (element.waypoints) {
      modeling.removeConnection(element);
    } else {
      modeling.removeShape(element);
    }
  });
};
},{"./NoopHandler":108,"inherits":191,"lodash/collection/forEach":204}],102:[function(require,module,exports){
'use strict';

var Collections = require('../../../util/Collections');

var saveClear = require('../../../util/Removal').saveClear;


/**
 * A handler that implements reversible deletion of shapes.
 *
 */
function DeleteShapeHandler(canvas, modeling) {
  this._canvas = canvas;
  this._modeling = modeling;
}

DeleteShapeHandler.$inject = [ 'canvas', 'modeling' ];

module.exports = DeleteShapeHandler;


/**
 * - Remove connections
 * - Remove all direct children
 */
DeleteShapeHandler.prototype.preExecute = function(context) {

  var modeling = this._modeling;

  var shape = context.shape,
      label = shape.label;

  // Clean up on removeShape(label)
  if (shape.labelTarget) {
    context.labelTarget = shape.labelTarget;
    shape.labelTarget = null;
  }

  // Remove label
  if (label) {
    this._modeling.removeShape(label, { nested: true });
  }

  // remove connections
  saveClear(shape.incoming, function(connection) {
    // To make sure that the connection isn't removed twice
    // For example if a container is removed
    modeling.removeConnection(connection, { nested: true });
  });

  saveClear(shape.outgoing, function(connection) {
    modeling.removeConnection(connection, { nested: true });
  });

  // remove child shapes and connections
  saveClear(shape.children, function(child) {
    if (isConnection(child)) {
      modeling.removeConnection(child, { nested: true });
    } else {
      modeling.removeShape(child, { nested: true });
    }
  });
};

/**
 * Remove shape and remember the parent
 */
DeleteShapeHandler.prototype.execute = function(context) {
  var canvas = this._canvas;

  var shape = context.shape,
      oldParent = shape.parent;

  context.oldParent = oldParent;
  context.oldParentIndex = Collections.indexOf(oldParent.children, shape);

  shape.label = null;

  canvas.removeShape(shape);

  return shape;
};


/**
 * Command revert implementation
 */
DeleteShapeHandler.prototype.revert = function(context) {

  var canvas = this._canvas;

  var shape = context.shape,
      oldParent = context.oldParent,
      oldParentIndex = context.oldParentIndex,
      labelTarget = context.labelTarget;

  // restore previous location in old oldParent
  Collections.add(oldParent.children, shape, oldParentIndex);

  if (labelTarget) {
    labelTarget.label = shape;
  }

  canvas.addShape(shape, oldParent);

  return shape;
};

function isConnection(element) {
  return element.waypoints;
}

},{"../../../util/Collections":167,"../../../util/Removal":179}],103:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    sortBy = require('lodash/collection/sortBy');

/**
 * A handler that distributes elements evenly.
 */
function DistributeElements(modeling) {
  this._modeling = modeling;
}

DistributeElements.$inject = [ 'modeling' ];

module.exports = DistributeElements;

var OFF_AXIS = {
  x: 'y',
  y: 'x'
};

DistributeElements.prototype.preExecute = function(context) {
  var modeling = this._modeling;

  var groups = context.groups,
      axis = context.axis,
      dimension = context.dimension;

  function updateRange(group, element) {
    group.range.min = Math.min(element[axis], group.range.min);
    group.range.max = Math.max(element[axis] + element[dimension], group.range.max);
  }

  function center(element) {
    return element[axis] + element[dimension] / 2;
  }

  function lastIdx(arr) {
    return arr.length - 1;
  }

  function rangeDiff(range) {
    return range.max - range.min;
  }

  function centerElement(refCenter, element) {
    var delta = { y: 0 };

    delta[axis] = refCenter - center(element);

    if (delta[axis]) {

      delta[OFF_AXIS[axis]] = 0;

      modeling.moveElements([ element ], delta, element.parent);
    }
  }

  var firstGroup = groups[0],
      lastGroupIdx = lastIdx(groups),
      lastGroup = groups[ lastGroupIdx ];

  var margin,
      spaceInBetween,
      groupsSize = 0; // the size of each range

  forEach(groups, function(group, idx) {
    var sortedElements,
        refElem,
        refCenter;

    if (group.elements.length < 2) {
      if (idx && idx !== groups.length - 1) {
        updateRange(group, group.elements[0]);

        groupsSize += rangeDiff(group.range);
      }
      return;
    }

    sortedElements = sortBy(group.elements, axis);

    refElem = sortedElements[0];

    if (idx === lastGroupIdx) {
      refElem = sortedElements[lastIdx(sortedElements)];
    }

    refCenter = center(refElem);

    // wanna update the ranges after the shapes have been centered
    group.range = null;

    forEach(sortedElements, function(element) {

      centerElement(refCenter, element);

      if (group.range === null) {
        group.range = {
          min: element[axis],
          max: element[axis] + element[dimension]
        };

        return;
      }

      // update group's range after centering the range elements
      updateRange(group, element);
    });

    if (idx && idx !== groups.length - 1) {
      groupsSize += rangeDiff(group.range);
    }
  });

  spaceInBetween = Math.abs(lastGroup.range.min - firstGroup.range.max);

  margin = Math.round((spaceInBetween - groupsSize) / (groups.length - 1));

  if (margin < groups.length - 1) {
    return;
  }

  forEach(groups, function(group, groupIdx) {
    var delta = {},
        prevGroup;

    if (group === firstGroup || group === lastGroup) {
      return;
    }

    prevGroup = groups[groupIdx - 1];

    group.range.max = 0;

    forEach(group.elements, function(element, idx) {
      delta[OFF_AXIS[axis]] = 0;
      delta[axis] = (prevGroup.range.max - element[axis]) + margin;

      if (group.range.min !== element[axis]) {
        delta[axis] += element[axis] - group.range.min;
      }

      if (delta[axis]) {
        modeling.moveElements([ element ], delta, element.parent);
      }

      group.range.max = Math.max(element[axis] + element[dimension], idx ? group.range.max : 0);
    });
  });
};

DistributeElements.prototype.postExecute = function(context) {

};

},{"lodash/collection/forEach":204,"lodash/collection/sortBy":210}],104:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign');


/**
 * A handler that implements reversible moving of shapes.
 */
function LayoutConnectionHandler(layouter, canvas) {
  this._layouter = layouter;
  this._canvas = canvas;
}

LayoutConnectionHandler.$inject = [ 'layouter', 'canvas' ];

module.exports = LayoutConnectionHandler;

LayoutConnectionHandler.prototype.execute = function(context) {

  var connection = context.connection,
      parent = connection.parent,
      connectionSiblings = parent.children;

  var oldIndex = connectionSiblings.indexOf(connection);

  var oldWaypoints = connection.waypoints;

  assign(context, {
    oldWaypoints: oldWaypoints,
    oldIndex: oldIndex
  });

  sendToFront(connection);

  connection.waypoints = this._layouter.layoutConnection(connection, context.hints);

  return connection;
};

LayoutConnectionHandler.prototype.revert = function(context) {

  var connection = context.connection,
      parent = connection.parent,
      connectionSiblings = parent.children,
      currentIndex = connectionSiblings.indexOf(connection),
      oldIndex = context.oldIndex;

  connection.waypoints = context.oldWaypoints;

  if (oldIndex !== currentIndex) {

    // change position of connection in shape
    connectionSiblings.splice(currentIndex, 1);
    connectionSiblings.splice(oldIndex, 0, connection);
  }

  return connection;
};


////////////// helpers /////////////////////////////////////


// connections should have a higher z-order as there source and targets
function sendToFront(connection) {

  var connectionSiblings = connection.parent.children;

  var connectionIdx = connectionSiblings.indexOf(connection),
      sourceIdx = findIndex(connectionSiblings, connection.source),
      targetIdx = findIndex(connectionSiblings, connection.target),

      // ensure we do not send the connection back
      // if it is already in front
      insertIndex = Math.max(sourceIdx + 1, targetIdx + 1, connectionIdx);

  if (connectionIdx < insertIndex) {
    connectionSiblings.splice(insertIndex, 0, connection); // add to new position
    connectionSiblings.splice(connectionIdx, 1); // remove from old position
  }

  function findIndex(array, obj) {

    var index = array.indexOf(obj);
    if (index < 0 && obj) {
      var parent = obj.parent;
      index = findIndex(array, parent);
    }
    return index;
  }

  return insertIndex;
}

},{"lodash/object/assign":328}],105:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var Collections = require('../../../util/Collections');


/**
 * A handler that implements reversible moving of connections.
 *
 * The handler differs from the layout connection handler in a sense
 * that it preserves the connection layout.
 */
function MoveConnectionHandler() { }

module.exports = MoveConnectionHandler;


MoveConnectionHandler.prototype.execute = function(context) {

  var connection = context.connection,
      delta = context.delta;

  var newParent = context.newParent || connection.parent,
      newParentIndex = context.newParentIndex,
      oldParent = connection.parent;

  // save old parent in context
  context.oldParent = oldParent;
  context.oldParentIndex = Collections.remove(oldParent.children, connection);

  // add to new parent at position
  Collections.add(newParent.children, connection, newParentIndex);

  // update parent
  connection.parent = newParent;

  // update waypoint positions
  forEach(connection.waypoints, function(p) {
    p.x += delta.x;
    p.y += delta.y;

    if (p.original) {
      p.original.x += delta.x;
      p.original.y += delta.y;
    }
  });

  return connection;
};

MoveConnectionHandler.prototype.revert = function(context) {

  var connection = context.connection,
      newParent = connection.parent,
      oldParent = context.oldParent,
      oldParentIndex = context.oldParentIndex,
      delta = context.delta;

  // remove from newParent
  Collections.remove(newParent.children, connection);

  // restore previous location in old parent
  Collections.add(oldParent.children, connection, oldParentIndex);

  // restore parent
  connection.parent = oldParent;

  // revert to old waypoint positions
  forEach(connection.waypoints, function(p) {
    p.x -= delta.x;
    p.y -= delta.y;

    if (p.original) {
      p.original.x -= delta.x;
      p.original.y -= delta.y;
    }
  });

  return connection;
};
},{"../../../util/Collections":167,"lodash/collection/forEach":204}],106:[function(require,module,exports){
'use strict';

var MoveHelper = require('./helper/MoveHelper');


/**
 * A handler that implements reversible moving of shapes.
 */
function MoveElementsHandler(modeling) {
  this._helper = new MoveHelper(modeling);
}

MoveElementsHandler.$inject = [ 'modeling' ];

module.exports = MoveElementsHandler;

MoveElementsHandler.prototype.preExecute = function(context) {
  context.closure = this._helper.getClosure(context.shapes);
};

MoveElementsHandler.prototype.postExecute = function(context) {

  var hints = context.hints,
      primaryShape;

  if (hints && hints.primaryShape) {
    primaryShape = hints.primaryShape;
    hints.oldParent = primaryShape.parent;
  }

  this._helper.moveClosure(context.closure, context.delta, context.newParent, context.newHost, primaryShape);
};


MoveElementsHandler.prototype.execute = function(context) { };
MoveElementsHandler.prototype.revert = function(context) { };

},{"./helper/MoveHelper":118}],107:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign'),
    forEach = require('lodash/collection/forEach'),
    pick = require('lodash/object/pick');

var MoveHelper = require('./helper/MoveHelper'),
    Collections = require('../../../util/Collections');

var getMovedSourceAnchor = require('./helper/AnchorsHelper').getMovedSourceAnchor,
    getMovedTargetAnchor = require('./helper/AnchorsHelper').getMovedTargetAnchor;


/**
 * A handler that implements reversible moving of shapes.
 */
function MoveShapeHandler(modeling) {
  this._modeling = modeling;

  this._helper = new MoveHelper(modeling);
}

MoveShapeHandler.$inject = [ 'modeling' ];

module.exports = MoveShapeHandler;


MoveShapeHandler.prototype.execute = function(context) {

  var shape = context.shape,
      delta = context.delta,
      newParent = context.newParent || shape.parent,
      newParentIndex = context.newParentIndex,
      oldParent = shape.parent;

  context.oldBounds = pick(shape, [ 'x', 'y', 'width', 'height']);

  // save old parent in context
  context.oldParent = oldParent;
  context.oldParentIndex = Collections.remove(oldParent.children, shape);

  // add to new parent at position
  Collections.add(newParent.children, shape, newParentIndex);

  // update shape parent + position
  assign(shape, {
    parent: newParent,
    x: shape.x + delta.x,
    y: shape.y + delta.y
  });

  return shape;
};

MoveShapeHandler.prototype.postExecute = function(context) {

  var shape = context.shape,
      delta = context.delta,
      hints = context.hints;

  var modeling = this._modeling;

  if (hints.layout !== false) {

    forEach(shape.incoming, function(c) {
      modeling.layoutConnection(c, {
        connectionEnd: getMovedTargetAnchor(c, shape, delta)
      });
    });

    forEach(shape.outgoing, function(c) {
      modeling.layoutConnection(c, {
        connectionStart: getMovedSourceAnchor(c, shape, delta)
      });
    });
  }

  if (hints.recurse !== false) {
    this.moveChildren(context);
  }
};

MoveShapeHandler.prototype.revert = function(context) {

  var shape = context.shape,
      oldParent = context.oldParent,
      oldParentIndex = context.oldParentIndex,
      delta = context.delta;

  // restore previous location in old parent
  Collections.add(oldParent.children, shape, oldParentIndex);

  // revert to old position and parent
  assign(shape, {
    parent: oldParent,
    x: shape.x - delta.x,
    y: shape.y - delta.y
  });

  return shape;
};

MoveShapeHandler.prototype.moveChildren = function(context) {

  var delta = context.delta,
      shape = context.shape;

  this._helper.moveRecursive(shape.children, delta, null);
};

MoveShapeHandler.prototype.getNewParent = function(context) {
  return context.newParent || context.shape.parent;
};

},{"../../../util/Collections":167,"./helper/AnchorsHelper":117,"./helper/MoveHelper":118,"lodash/collection/forEach":204,"lodash/object/assign":328,"lodash/object/pick":334}],108:[function(require,module,exports){
'use strict';

function NoopHandler() {}

module.exports = NoopHandler;

NoopHandler.prototype.execute = function() {};
NoopHandler.prototype.revert = function() {};
},{}],109:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    map = require('lodash/collection/map'),
    sortBy = require('lodash/collection/sortBy'),
    clone = require('lodash/lang/clone');

var inherits = require('inherits');



function removeProperties(element, properties) {
  forEach(properties, function(prop) {
    if (element[prop]) {
      delete element[prop];
    }
  });
}

/**
 * A handler that implements pasting of elements onto the diagram.
 *
 * @param {eventBus} EventBus
 * @param {canvas} Canvas
 * @param {selection} Selection
 * @param {elementFactory} ElementFactory
 * @param {modeling} Modeling
 * @param {rules} Rules
 */
function PasteHandler(eventBus, canvas, selection, elementFactory, modeling, rules) {
  this._eventBus = eventBus;
  this._canvas = canvas;
  this._selection = selection;
  this._elementFactory = elementFactory;
  this._modeling = modeling;
  this._rules = rules;
}

inherits(PasteHandler, require('./NoopHandler'));


PasteHandler.$inject = [
  'eventBus',
  'canvas',
  'selection',
  'elementFactory',
  'modeling',
  'rules'
];

module.exports = PasteHandler;


////// api /////////////////////////////////////////////

/**
 * Creates a new shape
 *
 * @param {Object} context
 * @param {Object} context.tree the new shape
 * @param {Element} context.topParent the paste target
 */
PasteHandler.prototype.preExecute = function(context) {
  var eventBus = this._eventBus;

  var tree = context.tree,
      topParent = context.topParent,
      position = context.position;

  tree.createdElements = {};

  tree.labels = [];

  forEach(tree, function(elements, depthStr) {
    var depth = parseInt(depthStr, 10);

    if (isNaN(depth)) {
      return;
    }

    // set the parent on the top level elements
    if (!depth) {
      elements = map(elements, function(descriptor) {
        descriptor.parent = topParent;

        return descriptor;
      });
    }

    // Order by priority for element creation
    elements = sortBy(elements, 'priority');

    forEach(elements, function(descriptor) {
      var id = descriptor.id,
          parent = descriptor.parent,
          isAttach = false,
          hints,
          newPosition;

      var element = clone(descriptor);

      if (depth) {
        element.parent = this._getCreatedElement(parent, tree);
      }

      // this happens when shapes have not been created due to rules
      if (!parent) {
        return;
      }

      eventBus.fire('element.paste', {
        createdElements: tree.createdElements,
        descriptor: element
      });

      // in case the parent changed during 'element.paste'
      parent = element.parent;

      if (element.waypoints) {
        element = this._createConnection(element, parent, position, tree);

        if (element) {
          tree.createdElements[id] = {
            element: element,
            descriptor: descriptor
          };
        }

        return;
      }

      // supply not-root information as hint
      if (element.parent !== topParent) {
        hints = { root: false };
      }

      // set host
      if (element.host) {
        isAttach = true;

        parent = this._getCreatedElement(element.host, tree);
      }

      // handle labels
      if (element.labelTarget) {
        return tree.labels.push(element);
      }

      newPosition = {
        x: Math.round(position.x + element.delta.x + (element.width / 2)),
        y: Math.round(position.y + element.delta.y + (element.height / 2))
      };

      removeProperties(element, [ 'id', 'parent', 'delta', 'host', 'priority' ]);

      element = this._createShape(element, parent, newPosition, isAttach, hints);

      if (element) {
        tree.createdElements[id] = {
          element: element,
          descriptor: descriptor
        };
      }
    }, this);
  }, this);
};

// move label's to their relative position
PasteHandler.prototype.postExecute = function(context) {
  var modeling = this._modeling,
      selection = this._selection;

  var tree = context.tree,
      labels = tree.labels,
      topLevelElements = [];

  forEach(labels, function(labelDescriptor) {
    var labelTarget = this._getCreatedElement(labelDescriptor.labelTarget, tree),
        label, labelTargetPos, newPosition;

    if (!labelTarget) {
      return;
    }

    label = labelTarget.label;

    if (!label) {
      return;
    }

    labelTargetPos = {
      x: labelTarget.x,
      y: labelTarget.y
    };

    if (labelTarget.waypoints) {
      labelTargetPos = labelTarget.waypoints[0];
    }

    newPosition = {
      x: Math.round((labelTargetPos.x - label.x) + labelDescriptor.delta.x),
      y: Math.round((labelTargetPos.y - label.y) + labelDescriptor.delta.y)
    };

    modeling.moveShape(label, newPosition, labelTarget.parent);
  }, this);

  forEach(tree[0], function(descriptor) {
    var id = descriptor.id,
        toplevel = tree.createdElements[id];

    if (toplevel) {
      topLevelElements.push(toplevel.element);
    }
  });

  selection.select(topLevelElements);
};


PasteHandler.prototype._createConnection = function(element, parent, parentCenter, tree) {
  var modeling = this._modeling,
      rules = this._rules;

  var connection, source, target, canPaste;

  element.waypoints = map(element.waypoints, function(waypoint, idx) {
    return {
      x: Math.round(parentCenter.x + element.delta[idx].x),
      y: Math.round(parentCenter.y + element.delta[idx].y)
    };
  });

  source = this._getCreatedElement(element.source, tree);
  target = this._getCreatedElement(element.target, tree);

  if (!source || !target) {
    return null;
  }

  canPaste = rules.allowed('element.paste', {
    source: source,
    target: target
  });

  if (!canPaste) {
    return null;
  }

  removeProperties(element, [ 'id', 'parent', 'delta', 'source', 'target', 'width', 'height', 'priority' ]);

  connection = modeling.createConnection(source, target, element, parent);

  return connection;
};


PasteHandler.prototype._createShape = function(element, parent, position, isAttach, hints) {
  var modeling = this._modeling,
      elementFactory = this._elementFactory,
      rules = this._rules;

  var canPaste = rules.allowed('element.paste', {
    element: element,
    position: position,
    parent: parent
  });

  if (!canPaste) {
    return null;
  }

  var shape = elementFactory.createShape(element);

  modeling.createShape(shape, position, parent, isAttach, hints);

  return shape;
};


PasteHandler.prototype._getCreatedElement = function(id, tree) {
  return tree.createdElements[id] && tree.createdElements[id].element;
};

},{"./NoopHandler":108,"inherits":191,"lodash/collection/forEach":204,"lodash/collection/map":206,"lodash/collection/sortBy":210,"lodash/lang/clone":317}],110:[function(require,module,exports){
'use strict';

var isArray = require('lodash/lang/isArray');


/**
 * Reconnect connection handler
 */
function ReconnectConnectionHandler() { }

ReconnectConnectionHandler.$inject = [ ];

module.exports = ReconnectConnectionHandler;

ReconnectConnectionHandler.prototype.execute = function(context) {

  var newSource = context.newSource,
      newTarget = context.newTarget,
      connection = context.connection,
      dockingOrPoints = context.dockingOrPoints,
      oldWaypoints = connection.waypoints,
      newWaypoints;

  if (!newSource && !newTarget) {
    throw new Error('newSource or newTarget are required');
  }

  if (newSource && newTarget) {
    throw new Error('must specify either newSource or newTarget');
  }

  context.oldWaypoints = oldWaypoints;

  if (isArray(dockingOrPoints)) {
    newWaypoints = dockingOrPoints;
  } else {
    newWaypoints = oldWaypoints.slice();

    newWaypoints.splice(newSource ? 0 : -1, 1, dockingOrPoints);
  }

  if (newSource) {
    context.oldSource = connection.source;
    connection.source = newSource;
  }

  if (newTarget) {
    context.oldTarget = connection.target;
    connection.target = newTarget;
  }

  connection.waypoints = newWaypoints;

  return connection;
};

ReconnectConnectionHandler.prototype.revert = function(context) {

  var newSource = context.newSource,
      newTarget = context.newTarget,
      connection = context.connection;

  if (newSource) {
    connection.source = context.oldSource;
  }

  if (newTarget) {
    connection.target = context.oldTarget;
  }

  connection.waypoints = context.oldWaypoints;

  return connection;
};
},{"lodash/lang/isArray":319}],111:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');


/**
 * A handler that implements reversible replacing of shapes.
 * Internally the old shape will be removed and the new shape will be added.
 *
 *
 * @class
 * @constructor
 *
 * @param {canvas} Canvas
 */
function ReplaceShapeHandler(modeling, rules) {
  this._modeling = modeling;
  this._rules = rules;
}

ReplaceShapeHandler.$inject = [ 'modeling', 'rules' ];

module.exports = ReplaceShapeHandler;



////// api /////////////////////////////////////////


/**
 * Replaces a shape with an replacement Element.
 *
 * The newData object should contain type, x, y.
 *
 * If possible also the incoming/outgoing connection
 * will be restored.
 *
 * @param {Object} context
 */
ReplaceShapeHandler.prototype.preExecute = function(context) {

  var self = this,
      modeling = this._modeling,
      rules = this._rules;

  var oldShape = context.oldShape,
      newData = context.newData,
      hints = context.hints,
      newShape;

  function canReconnect(type, source, target, connection) {
    return rules.allowed(type, {
      source: source,
      target: target,
      connection: connection
    });
  }


  // (1) place a new shape at the given position

  var position = {
    x: newData.x,
    y: newData.y
  };

  newShape = context.newShape = context.newShape || self.createShape(newData, position, oldShape.parent);


  // (2) update the host

  if (oldShape.host) {
    modeling.updateAttachment(newShape, oldShape.host);
  }


  // (3) adopt all children from the old shape

  var children;

  if (hints.moveChildren !== false) {
    children = oldShape.children.slice();

    modeling.moveElements(children, { x: 0, y: 0 }, newShape);
  }

  // (4) reconnect connections to the new shape (where allowed)

  var incoming = oldShape.incoming.slice(),
      outgoing = oldShape.outgoing.slice();

  forEach(incoming, function(connection) {
    var waypoints = connection.waypoints,
        docking = waypoints[waypoints.length - 1],
        source = connection.source,
        allowed = canReconnect('connection.reconnectEnd', source, newShape, connection);

    if (allowed) {
      self.reconnectEnd(connection, newShape, docking);
    }
  });

  forEach(outgoing, function(connection) {
    var waypoints = connection.waypoints,
        docking = waypoints[0],
        target = connection.target,
        allowed = canReconnect('connection.reconnectStart', newShape, target, connection);

    if (allowed) {
      self.reconnectStart(connection, newShape, docking);
    }

  });
};


ReplaceShapeHandler.prototype.postExecute = function(context) {
  var modeling = this._modeling;

  var oldShape = context.oldShape,
      newShape = context.newShape;

  // if an element gets resized on replace, layout the connection again
  forEach(newShape.incoming, function(c) {
    modeling.layoutConnection(c, { endChanged: true });
  });

  forEach(newShape.outgoing, function(c) {
    modeling.layoutConnection(c, { startChanged: true });
  });

  modeling.removeShape(oldShape);
};


ReplaceShapeHandler.prototype.execute = function(context) {};

ReplaceShapeHandler.prototype.revert = function(context) {};


ReplaceShapeHandler.prototype.createShape = function(shape, position, target) {
  var modeling = this._modeling;
  return modeling.createShape(shape, position, target);
};


ReplaceShapeHandler.prototype.reconnectStart = function(connection, newSource, dockingPoint) {
  var modeling = this._modeling;
  modeling.reconnectStart(connection, newSource, dockingPoint);
};


ReplaceShapeHandler.prototype.reconnectEnd = function(connection, newTarget, dockingPoint) {
  var modeling = this._modeling;
  modeling.reconnectEnd(connection, newTarget, dockingPoint);
};

},{"lodash/collection/forEach":204}],112:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign'),
    forEach = require('lodash/collection/forEach');

var getResizedSourceAnchor = require('./helper/AnchorsHelper').getResizedSourceAnchor,
    getResizedTargetAnchor = require('./helper/AnchorsHelper').getResizedTargetAnchor;

/**
 * A handler that implements reversible resizing of shapes.
 *
 * @param {Modeling} modeling
 */
function ResizeShapeHandler(modeling) {
  this._modeling = modeling;
}

ResizeShapeHandler.$inject = [ 'modeling' ];

module.exports = ResizeShapeHandler;

/**
 * {
 *   shape: {....}
 *   newBounds: {
 *     width:  20,
 *     height: 40,
 *     x:       5,
 *     y:      10
 *   }
 *
 * }
 */
ResizeShapeHandler.prototype.execute = function(context) {
  var shape = context.shape,
      newBounds = context.newBounds,
      minBounds = context.minBounds;

  if (newBounds.x === undefined || newBounds.y === undefined ||
      newBounds.width === undefined || newBounds.height === undefined) {
    throw new Error('newBounds must have {x, y, width, height} properties');
  }

  if (minBounds && (newBounds.width < minBounds.width
    || newBounds.height < minBounds.height)) {
    throw new Error('width and height cannot be less than minimum height and width');
  } else if (!minBounds
    && newBounds.width < 10 || newBounds.height < 10) {
    throw new Error('width and height cannot be less than 10px');
  }

  // save old bbox in context
  context.oldBounds = {
    width:  shape.width,
    height: shape.height,
    x:      shape.x,
    y:      shape.y
  };

  // update shape
  assign(shape, {
    width:  newBounds.width,
    height: newBounds.height,
    x:      newBounds.x,
    y:      newBounds.y
  });

  return shape;
};

ResizeShapeHandler.prototype.postExecute = function(context) {

  var shape = context.shape,
      oldBounds = context.oldBounds;

  var modeling = this._modeling;

  forEach(shape.incoming, function(c) {
    modeling.layoutConnection(c, {
      connectionEnd: getResizedTargetAnchor(c, shape, oldBounds)
    });
  });

  forEach(shape.outgoing, function(c) {
    modeling.layoutConnection(c, {
      connectionStart: getResizedSourceAnchor(c, shape, oldBounds)
    });
  });

};

ResizeShapeHandler.prototype.revert = function(context) {

  var shape = context.shape,
      oldBounds = context.oldBounds;

  // restore previous bbox
  assign(shape, {
    width:  oldBounds.width,
    height: oldBounds.height,
    x:      oldBounds.x,
    y:      oldBounds.y
  });

  return shape;
};

},{"./helper/AnchorsHelper":117,"lodash/collection/forEach":204,"lodash/object/assign":328}],113:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var SpaceUtil = require('../../space-tool/SpaceUtil');

/**
 * A handler that implements reversible creating and removing of space.
 *
 * It executes in two phases:
 *
 *  (1) resize all affected resizeShapes
 *  (2) move all affected moveElements
 */
function SpaceToolHandler(modeling) {
  this._modeling = modeling;
}

SpaceToolHandler.$inject = [ 'modeling' ];

module.exports = SpaceToolHandler;


SpaceToolHandler.prototype.preExecute = function(context) {

  // resize
  var modeling = this._modeling,
      resizingShapes = context.resizingShapes,
      delta = context.delta,
      direction = context.direction;

  forEach(resizingShapes, function(shape) {
    var newBounds = SpaceUtil.resizeBounds(shape, direction, delta);

    modeling.resizeShape(shape, newBounds);
  });
};

SpaceToolHandler.prototype.postExecute = function(context) {
  // move
  var modeling = this._modeling,
      movingShapes = context.movingShapes,
      delta = context.delta;

  modeling.moveElements(movingShapes, delta, undefined, false, { autoResize: false });
};

SpaceToolHandler.prototype.execute = function(context) {};
SpaceToolHandler.prototype.revert = function(context) {};

},{"../../space-tool/SpaceUtil":148,"lodash/collection/forEach":204}],114:[function(require,module,exports){
'use strict';

/**
 * A handler that toggles the collapsed state of an element
 * and the visibility of all its children.
 *
 * @param {Modeling} modeling
 */
function ToggleShapeCollapseHandler(modeling) {
  this._modeling = modeling;
}

ToggleShapeCollapseHandler.$inject = [ 'modeling' ];

module.exports = ToggleShapeCollapseHandler;


ToggleShapeCollapseHandler.prototype.execute = function(context) {

  var shape = context.shape,
      children = shape.children;

  // remember previous visibility of children
  context.oldChildrenVisibility = getElementsVisibility(children);

  // toggle state
  shape.collapsed = !shape.collapsed;

  // hide/show children
  setHidden(children, shape.collapsed);

  return [shape].concat(children);
};


ToggleShapeCollapseHandler.prototype.revert = function(context) {

  var shape = context.shape,
      oldChildrenVisibility = context.oldChildrenVisibility;

  var children = shape.children;

  // set old visability of children
  restoreVisibility(children, oldChildrenVisibility);

  // retoggle state
  shape.collapsed = !shape.collapsed;

  return [shape].concat(children);
};


/////// helpers ///////////////////////////////

/**
 * Return a map { elementId -> hiddenState}.
 *
 * @param {Array<djs.model.Shape>} elements
 *
 * @return {Object}
 */
function getElementsVisibility(elements) {

  var result = {};

  elements.forEach(function(e) {
    result[e.id] = e.hidden;
  });

  return result;
}


function setHidden(elements, newHidden) {
  elements.forEach(function(element) {
    element.hidden = newHidden;
  });
}

function restoreVisibility(elements, lastState) {
  elements.forEach(function(e) {
    e.hidden = lastState[e.id];
  });
}

},{}],115:[function(require,module,exports){
'use strict';

var Collections = require('../../../util/Collections');

/**
 * A handler that implements reversible attaching/detaching of shapes.
 */
function UpdateAttachmentHandler(modeling) {
  this._modeling = modeling;
}

module.exports = UpdateAttachmentHandler;

UpdateAttachmentHandler.$inject = [ 'modeling' ];


UpdateAttachmentHandler.prototype.execute = function(context) {
  var shape = context.shape,
      newHost = context.newHost,
      oldHost = shape.host;

  // (0) detach from old host
  context.oldHost = oldHost;
  context.attacherIdx = removeAttacher(oldHost, shape);

  // (1) attach to new host
  addAttacher(newHost, shape);

  // (2) update host
  shape.host = newHost;

  return shape;
};

UpdateAttachmentHandler.prototype.revert = function(context) {
  var shape = context.shape,
      newHost = context.newHost,
      oldHost = context.oldHost,
      attacherIdx = context.attacherIdx;

  // (2) update host
  shape.host = oldHost;

  // (1) attach to new host
  removeAttacher(newHost, shape);

  // (0) detach from old host
  addAttacher(oldHost, shape, attacherIdx);

  return shape;
};


function removeAttacher(host, attacher) {
  // remove attacher from host
  return Collections.remove(host && host.attachers, attacher);
}

function addAttacher(host, attacher, idx) {

  if (!host) {
    return;
  }

  var attachers = host.attachers;

  if (!attachers) {
    host.attachers = attachers = [];
  }

  Collections.add(attachers, attacher, idx);
}

},{"../../../util/Collections":167}],116:[function(require,module,exports){
'use strict';

function UpdateWaypointsHandler() { }

module.exports = UpdateWaypointsHandler;

UpdateWaypointsHandler.prototype.execute = function(context) {

  var connection = context.connection,
      newWaypoints = context.newWaypoints;

  context.oldWaypoints = connection.waypoints;

  connection.waypoints = newWaypoints;

  return connection;
};

UpdateWaypointsHandler.prototype.revert = function(context) {

  var connection = context.connection,
      oldWaypoints = context.oldWaypoints;

  connection.waypoints = oldWaypoints;

  return connection;
};
},{}],117:[function(require,module,exports){
'use strict';

var getNewAttachPoint = require('../../../../util/AttachUtil').getNewAttachPoint;

function getResizedSourceAnchor(connection, shape, oldBounds) {

  var waypoints = safeGetWaypoints(connection),
      oldAnchor = waypoints[0];

  return getNewAttachPoint(oldAnchor.original || oldAnchor, oldBounds, shape);
}

module.exports.getResizedSourceAnchor = getResizedSourceAnchor;


function getResizedTargetAnchor(connection, shape, oldBounds) {

  var waypoints = safeGetWaypoints(connection),
      oldAnchor = waypoints[waypoints.length - 1];

  return getNewAttachPoint(oldAnchor.original || oldAnchor, oldBounds, shape);
}

module.exports.getResizedTargetAnchor = getResizedTargetAnchor;


function getMovedSourceAnchor(connection, source, moveDelta) {
  return getResizedSourceAnchor(connection, source, substractPosition(source, moveDelta));
}

module.exports.getMovedSourceAnchor = getMovedSourceAnchor;


function getMovedTargetAnchor(connection, target, moveDelta) {
  return getResizedTargetAnchor(connection, target, substractPosition(target, moveDelta));
}

module.exports.getMovedTargetAnchor = getMovedTargetAnchor;


//////// helpers ////////////////////////////////////

function substractPosition(bounds, delta) {
  return {
    x: bounds.x - delta.x,
    y: bounds.y - delta.y,
    width: bounds.width,
    height: bounds.height
  };
}


/**
 * Return waypoints of given connection; throw if non exists (should not happen!!).
 *
 * @param {Connection} connection
 *
 * @return {Array<Point>}
 */
function safeGetWaypoints(connection) {

  var waypoints = connection.waypoints;

  if (!waypoints.length) {
    throw new Error('connection#' + connection.id + ': no waypoints');
  }

  return waypoints;
}

},{"../../../../util/AttachUtil":165}],118:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var Elements = require('../../../../util/Elements');

var getMovedSourceAnchor = require('./AnchorsHelper').getMovedSourceAnchor,
    getMovedTargetAnchor = require('./AnchorsHelper').getMovedTargetAnchor;

/**
 * A helper that is able to carry out serialized move operations on multiple elements.
 *
 * @param {Modeling} modeling
 */
function MoveHelper(modeling) {
  this._modeling = modeling;
}

module.exports = MoveHelper;

/**
 * Move the specified elements and all children by the given delta.
 *
 * This moves all enclosed connections, too and layouts all affected
 * external connections.
 *
 * @param  {Array<djs.model.Base>} elements
 * @param  {Point} delta
 * @param  {djs.model.Base} newParent applied to the first level of shapes
 *
 * @return {Array<djs.model.Base>} list of touched elements
 */
MoveHelper.prototype.moveRecursive = function(elements, delta, newParent) {
  if (!elements) {
    return [];
  } else {
    return this.moveClosure(this.getClosure(elements), delta, newParent);
  }
};

/**
 * Move the given closure of elmements.
 *
 * @param {Object} closure
 * @param {Point} delta
 * @param {djs.model.Base} [newParent]
 * @param {djs.model.Base} [newHost]
 */
MoveHelper.prototype.moveClosure = function(closure, delta, newParent, newHost, primaryShape) {
  var modeling = this._modeling;

  var allShapes = closure.allShapes,
      allConnections = closure.allConnections,
      enclosedConnections = closure.enclosedConnections,
      topLevel = closure.topLevel,
      keepParent = false;

  if (primaryShape && primaryShape.parent === newParent) {
    keepParent = true;
  }

  // move all shapes
  forEach(allShapes, function(shape) {

    // move the element according to the given delta
    modeling.moveShape(shape, delta, topLevel[shape.id] && !keepParent && newParent, {
      recurse: false,
      layout: false
    });
  });

  // move all child connections / layout external connections
  forEach(allConnections, function(c) {

    var sourceMoved = !!allShapes[c.source.id],
        targetMoved = !!allShapes[c.target.id];

    if (enclosedConnections[c.id] && sourceMoved && targetMoved) {
      modeling.moveConnection(c, delta, topLevel[c.id] && !keepParent && newParent);
    } else {
      modeling.layoutConnection(c, {
        connectionStart: sourceMoved && getMovedSourceAnchor(c, c.source, delta),
        connectionEnd: targetMoved && getMovedTargetAnchor(c, c.target, delta)
      });
    }
  });
};

/**
 * Returns the closure for the selected elements
 *
 * @param  {Array<djs.model.Base>} elements
 * @return {Object} closure
 */
MoveHelper.prototype.getClosure = function(elements) {
  return Elements.getClosure(elements);
};

},{"../../../../util/Elements":169,"./AnchorsHelper":117,"lodash/collection/forEach":204}],119:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign'),
    filter = require('lodash/collection/filter'),
    groupBy = require('lodash/collection/groupBy');

var LOW_PRIORITY = 500,
    MEDIUM_PRIORITY = 1250,
    HIGH_PRIORITY = 1500;

var getOriginalEvent = require('../../util/Event').getOriginal;

var round = Math.round;

function mid(element) {
  return {
    x: element.x + round(element.width / 2),
    y: element.y + round(element.height / 2)
  };
}

/**
 * A plugin that makes shapes draggable / droppable.
 *
 * @param {EventBus} eventBus
 * @param {Dragging} dragging
 * @param {Modeling} modeling
 * @param {Selection} selection
 * @param {Rules} rules
 */
function MoveEvents(eventBus, dragging, modeling, selection, rules) {

  // rules

  function canMove(shapes, delta, position, target) {

    return rules.allowed('elements.move', {
      shapes: shapes,
      delta: delta,
      position: position,
      target: target
    });
  }


  // move events

  // assign a high priority to this handler to setup the environment
  // others may hook up later, e.g. at default priority and modify
  // the move environment.
  //
  // This sets up the context with
  //
  // * shape: the primary shape being moved
  // * shapes: a list of shapes to be moved
  // * validatedShapes: a list of shapes that are being checked
  //                    against the rules before and during move
  //
  eventBus.on('shape.move.start', HIGH_PRIORITY, function(event) {

    var context = event.context,
        shape = event.shape,
        shapes = selection.get().slice();

    // move only single shape if the dragged element
    // is not part of the current selection
    if (shapes.indexOf(shape) === -1) {
      shapes = [ shape ];
    }

    // ensure we remove nested elements in the collection
    // and add attachers for a proper dragger
    shapes = removeNested(shapes);

    // attach shapes to drag context
    assign(context, {
      shapes: shapes,
      validatedShapes: shapes,
      shape: shape
    });
  });


  // assign a high priority to this handler to setup the environment
  // others may hook up later, e.g. at default priority and modify
  // the move environment
  //
  eventBus.on('shape.move.start', MEDIUM_PRIORITY, function(event) {

    var context = event.context,
        validatedShapes = context.validatedShapes,
        canExecute;

    canExecute = context.canExecute = canMove(validatedShapes);

    // check if we can move the elements
    if (!canExecute) {
      // suppress move operation
      event.stopPropagation();

      return false;
    }
  });

  // assign a low priority to this handler
  // to let others modify the move event before we update
  // the context
  //
  eventBus.on('shape.move.move', LOW_PRIORITY, function(event) {

    var context = event.context,
        validatedShapes = context.validatedShapes,
        hover = event.hover,
        delta = { x: event.dx, y: event.dy },
        position = { x: event.x, y: event.y },
        canExecute;

    // check if we can move the elements
    canExecute = canMove(validatedShapes, delta, position, hover);

    context.delta = delta;
    context.canExecute = canExecute;

    // simply ignore move over
    if (canExecute === null) {
      context.target = null;

      return;
    }

    context.target = hover;
  });

  eventBus.on('shape.move.end', function(event) {

    var context = event.context;

    var delta = context.delta,
        canExecute = context.canExecute,
        isAttach = canExecute === 'attach',
        shapes = context.shapes;

    if (!canExecute) {
      return false;
    }

    // ensure we have actual pixel values deltas
    // (important when zoom level was > 1 during move)
    delta.x = round(delta.x);
    delta.y = round(delta.y);

    modeling.moveElements(shapes, delta, context.target, isAttach, { primaryShape: context.shape });
  });


  // move activation

  eventBus.on('element.mousedown', function(event) {

    var originalEvent = getOriginalEvent(event);

    if (!originalEvent) {
      throw new Error('must supply DOM mousedown event');
    }

    start(originalEvent, event.element);
  });


  function start(event, element, activate) {

    // do not move connections or the root element
    if (element.waypoints || !element.parent) {
      return;
    }

    var referencePoint = mid(element);

    dragging.init(event, referencePoint, 'shape.move', {
      cursor: 'grabbing',
      autoActivate: activate,
      data: {
        shape: element,
        context: {}
      }
    });
  }

  // API

  this.start = start;
}

MoveEvents.$inject = [ 'eventBus', 'dragging', 'modeling', 'selection', 'rules' ];

module.exports = MoveEvents;


/**
 * Return a filtered list of elements that do not contain
 * those nested into others.
 *
 * @param  {Array<djs.model.Base>} elements
 *
 * @return {Array<djs.model.Base>} filtered
 */
function removeNested(elements) {

  var ids = groupBy(elements, 'id');

  return filter(elements, function(element) {
    while ((element = element.parent)) {

      // parent in selection
      if (ids[element.id]) {
        return false;
      }
    }

    return true;
  });
}

},{"../../util/Event":170,"lodash/collection/filter":202,"lodash/collection/groupBy":205,"lodash/object/assign":328}],120:[function(require,module,exports){
'use strict';

var flatten = require('lodash/array/flatten'),
    forEach = require('lodash/collection/forEach'),
    filter = require('lodash/collection/filter'),
    find = require('lodash/collection/find'),
    size = require('lodash/collection/size'),
    groupBy = require('lodash/collection/groupBy'),
    map = require('lodash/collection/map');

var Elements = require('../../util/Elements');

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClear = require('tiny-svg/lib/clear'),
    svgCreate = require('tiny-svg/lib/create');

var translate = require('../../util/SvgTransformUtil').translate;

var LOW_PRIORITY = 500;

var MARKER_DRAGGING = 'djs-dragging',
    MARKER_OK = 'drop-ok',
    MARKER_NOT_OK = 'drop-not-ok',
    MARKER_NEW_PARENT = 'new-parent',
    MARKER_ATTACH = 'attach-ok';

/**
 * Provides previews for moving shapes when moving.
 *
 * @param {EventBus} eventBus
 * @param {ElementRegistry} elementRegistry
 * @param {Canvas} canvas
 * @param {Styles} styles
 */
function MovePreview(eventBus, elementRegistry, canvas, styles, previewSupport) {

  function getVisualDragShapes(shapes) {
    var elements = getAllDraggedElements(shapes);

    var filteredElements = removeEdges(elements);

    return filteredElements;
  }

  function getAllDraggedElements(shapes) {
    var allShapes = Elements.selfAndAllChildren(shapes, true);

    var allConnections = map(allShapes, function(shape) {
      return (shape.incoming || []).concat(shape.outgoing || []);
    });

    return flatten(allShapes.concat(allConnections), true);
  }

  /**
   * Sets drop marker on an element.
   */
  function setMarker(element, marker) {

    [ MARKER_ATTACH, MARKER_OK, MARKER_NOT_OK, MARKER_NEW_PARENT ].forEach(function(m) {

      if (m === marker) {
        canvas.addMarker(element, m);
      } else {
        canvas.removeMarker(element, m);
      }
    });
  }

  function makeDraggable(context, element, addMarker) {

    previewSupport.addDragger(element, context.dragGroup);

    if (addMarker) {
      canvas.addMarker(element, MARKER_DRAGGING);
    }

    if (context.allDraggedElements) {
      context.allDraggedElements.push(element);
    } else {
      context.allDraggedElements = [ element ];
    }
  }

  // expose to other components
  // that plug into the drag behavior
  this.makeDraggable = makeDraggable;

  // add previews
  eventBus.on('shape.move.start', LOW_PRIORITY, function(event) {

    var context = event.context,
        dragShapes = context.shapes,
        allDraggedElements = context.allDraggedElements;

    var visuallyDraggedShapes = getVisualDragShapes(dragShapes);

    if (!context.dragGroup) {
      var dragGroup = svgCreate('g');
      svgAttr(dragGroup, styles.cls('djs-drag-group', [ 'no-events' ]));

      var defaultLayer = canvas.getDefaultLayer();

      svgAppend(defaultLayer, dragGroup);

      context.dragGroup = dragGroup;
    }

    // add previews
    visuallyDraggedShapes.forEach(function(shape) {
      previewSupport.addDragger(shape, context.dragGroup);
    });

    // cache all dragged elements / gfx
    // so that we can quickly undo their state changes later
    if (!allDraggedElements) {
      allDraggedElements = getAllDraggedElements(dragShapes);
    } else {
      allDraggedElements = flatten(allDraggedElements, getAllDraggedElements(dragShapes));
    }

    // add dragging marker
    forEach(allDraggedElements, function(e) {
      canvas.addMarker(e, MARKER_DRAGGING);
    });

    context.allDraggedElements = allDraggedElements;

    // determine, if any of the dragged elements have different parents
    context.differentParents = haveDifferentParents(dragShapes);
  });

  // update previews
  eventBus.on('shape.move.move', LOW_PRIORITY, function(event) {

    var context = event.context,
        dragGroup = context.dragGroup,
        target = context.target,
        parent = context.shape.parent,
        canExecute = context.canExecute;

    if (target) {
      if (canExecute === 'attach') {
        setMarker(target, MARKER_ATTACH);
      } else if (context.canExecute && target && target.id !== parent.id) {
        setMarker(target, MARKER_NEW_PARENT);
      } else {
        setMarker(target, context.canExecute ? MARKER_OK : MARKER_NOT_OK);
      }
    }

    translate(dragGroup, event.dx, event.dy);
  });

  eventBus.on([ 'shape.move.out', 'shape.move.cleanup' ], function(event) {
    var context = event.context,
        target = context.target;

    if (target) {
      setMarker(target, null);
    }
  });

  // remove previews
  eventBus.on('shape.move.cleanup', function(event) {

    var context = event.context,
        allDraggedElements = context.allDraggedElements,
        dragGroup = context.dragGroup;


    // remove dragging marker
    forEach(allDraggedElements, function(e) {
      canvas.removeMarker(e, MARKER_DRAGGING);
    });

    if (dragGroup) {
      svgClear(dragGroup);
    }
  });
}

MovePreview.$inject = [ 'eventBus', 'elementRegistry', 'canvas', 'styles', 'previewSupport' ];

module.exports = MovePreview;

////////// helpers //////////

// returns elements minus all connections
// where source or target is not elements
function removeEdges(elements) {

  var filteredElements = filter(elements, function(element) {

    if (!isConnection(element)) {
      return true;
    } else {
      var srcFound = find(elements, element.source);
      var targetFound = find(elements, element.target);

      return srcFound && targetFound;
    }
  });

  return filteredElements;
}

function haveDifferentParents(elements) {
  return size(groupBy(elements, function(e) { return e.parent && e.parent.id; })) !== 1;
}

/**
 * Checks if an element is a connection.
 */
function isConnection(element) {
  return element.waypoints;
}

},{"../../util/Elements":169,"../../util/SvgTransformUtil":181,"lodash/array/flatten":193,"lodash/collection/filter":202,"lodash/collection/find":203,"lodash/collection/forEach":204,"lodash/collection/groupBy":205,"lodash/collection/map":206,"lodash/collection/size":208,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/clear":355,"tiny-svg/lib/create":357}],121:[function(require,module,exports){
module.exports = {
  __depends__: [
    require('../interaction-events'),
    require('../selection'),
    require('../outline'),
    require('../rules'),
    require('../dragging'),
    require('../preview-support')
  ],
  __init__: [ 'move', 'movePreview' ],
  move: [ 'type', require('./Move') ],
  movePreview: [ 'type', require('./MovePreview') ]
};

},{"../dragging":87,"../interaction-events":91,"../outline":124,"../preview-support":130,"../rules":138,"../selection":142,"./Move":119,"./MovePreview":120}],122:[function(require,module,exports){
'use strict';

var inherits = require('inherits');

var CommandInterceptor = require('../../command/CommandInterceptor');


/**
 * An abstract provider that allows modelers to implement a custom
 * ordering of diagram elements on the canvas.
 *
 * It makes sure that the order is always preserved during element
 * creation and move operations.
 *
 * In order to use this behavior, inherit from it and override
 * the method {@link OrderingProvider#getOrdering}.
 *
 * @example
 *
 * ```javascript
 * function CustomOrderingProvider(eventBus) {
 *   OrderingProvider.call(this, eventBus);
 *
 *   this.getOrdering = function(element, newParent) {
 *     // always insert elements at the front
 *     // when moving
 *     return {
 *       index: 0,
 *       parent: newParent
 *     };
 *   };
 * }
 * ```
 *
 * @param {EventBus} eventBus
 */
function OrderingProvider(eventBus) {

  CommandInterceptor.call(this, eventBus);


  var self = this;

  this.preExecute([ 'shape.create', 'connection.create' ], function(event) {

    var context = event.context,
        element = context.shape || context.connection,
        parent = context.parent;

    var ordering = self.getOrdering(element, parent);

    if (ordering) {

      if (ordering.parent !== undefined) {
        context.parent = ordering.parent;
      }

      context.parentIndex = ordering.index;
    }
  });

  this.preExecute([ 'shape.move', 'connection.move' ], function(event) {

    var context = event.context,
        element = context.shape || context.connection,
        parent = context.newParent || element.parent;

    var ordering = self.getOrdering(element, parent);

    if (ordering) {

      if (ordering.parent !== undefined) {
        context.newParent = ordering.parent;
      }

      context.newParentIndex = ordering.index;
    }
  });
}

/**
 * Return a custom ordering of the element, both in terms
 * of parent element and index in the new parent.
 *
 * Implementors of this method must return an object with
 * `parent` _and_ `index` in it.
 *
 * @param {djs.model.Base} element
 * @param {djs.model.Shape} newParent
 *
 * @return {Object} ordering descriptor
 */
OrderingProvider.prototype.getOrdering = function(element, newParent) {
  return null;
};

inherits(OrderingProvider, CommandInterceptor);

module.exports = OrderingProvider;
},{"../../command/CommandInterceptor":56,"inherits":191}],123:[function(require,module,exports){
'use strict';

var getBBox = require('../../util/Elements').getBBox;

var LOW_PRIORITY = 500;

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgCreate = require('tiny-svg/lib/create');

var domQuery = require('min-dom/lib/query');

var assign = require('lodash/object/assign');


/**
 * @class
 *
 * A plugin that adds an outline to shapes and connections that may be activated and styled
 * via CSS classes.
 *
 * @param {EventBus} eventBus
 * @param {Styles} styles
 * @param {ElementRegistry} elementRegistry
 */
function Outline(eventBus, styles, elementRegistry) {

  this.offset = 6;

  var OUTLINE_STYLE = styles.cls('djs-outline', [ 'no-fill' ]);

  var self = this;

  function createOutline(gfx, bounds) {
    var outline = svgCreate('rect');

    svgAttr(outline, assign({
      x: 10,
      y: 10,
      width: 100,
      height: 100
    }, OUTLINE_STYLE));

    svgAppend(gfx, outline);

    return outline;
  }

  // A low priortity is necessary, because outlines of labels have to be updated
  // after the label bounds have been updated in the renderer.
  eventBus.on([ 'shape.added', 'shape.changed' ], LOW_PRIORITY, function(event) {
    var element = event.element,
        gfx     = event.gfx;

    var outline = domQuery('.djs-outline', gfx);

    if (!outline) {
      outline = createOutline(gfx, element);
    }

    self.updateShapeOutline(outline, element);
  });

  eventBus.on([ 'connection.added', 'connection.changed' ], function(event) {
    var element = event.element,
        gfx     = event.gfx;

    var outline = domQuery('.djs-outline', gfx);

    if (!outline) {
      outline = createOutline(gfx, element);
    }

    self.updateConnectionOutline(outline, element);
  });
}


/**
 * Updates the outline of a shape respecting the dimension of the
 * element and an outline offset.
 *
 * @param  {SVGElement} outline
 * @param  {djs.model.Base} element
 */
Outline.prototype.updateShapeOutline = function(outline, element) {

  svgAttr(outline, {
    x: -this.offset,
    y: -this.offset,
    width: element.width + this.offset * 2,
    height: element.height + this.offset * 2
  });

};


/**
 * Updates the outline of a connection respecting the bounding box of
 * the connection and an outline offset.
 *
 * @param  {SVGElement} outline
 * @param  {djs.model.Base} element
 */
Outline.prototype.updateConnectionOutline = function(outline, connection) {

  var bbox = getBBox(connection);

  svgAttr(outline, {
    x: bbox.x - this.offset,
    y: bbox.y - this.offset,
    width: bbox.width + this.offset * 2,
    height: bbox.height + this.offset * 2
  });

};


Outline.$inject = ['eventBus', 'styles', 'elementRegistry'];

module.exports = Outline;

},{"../../util/Elements":169,"lodash/object/assign":328,"min-dom/lib/query":346,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/create":357}],124:[function(require,module,exports){
'use strict';

module.exports = {
  __init__: [ 'outline' ],
  outline: [ 'type', require('./Outline') ]
};
},{"./Outline":123}],125:[function(require,module,exports){
'use strict';

var isArray = require('lodash/lang/isArray'),
    isString = require('lodash/lang/isString'),
    isObject = require('lodash/lang/isObject'),
    assign = require('lodash/object/assign'),
    forEach = require('lodash/collection/forEach'),
    find = require('lodash/collection/find'),
    filter = require('lodash/collection/filter');

var domify = require('min-dom/lib/domify'),
    domClasses = require('min-dom/lib/classes'),
    domAttr = require('min-dom/lib/attr'),
    domRemove = require('min-dom/lib/remove'),
    domClear = require('min-dom/lib/clear');

var getBBox = require('../../util/Elements').getBBox;

// document wide unique overlay ids
var ids = new (require('../../util/IdGenerator'))('ov');

var LOW_PRIORITY = 500;


function createRoot(parent) {
  var root = domify('<div class="djs-overlay-container" style="position: absolute; width: 0; height: 0;" />');
  parent.insertBefore(root, parent.firstChild);

  return root;
}


function setPosition(el, x, y) {
  assign(el.style, { left: x + 'px', top: y + 'px' });
}

function setVisible(el, visible) {
  el.style.display = visible === false ? 'none' : '';
}

/**
 * A service that allows users to attach overlays to diagram elements.
 *
 * The overlay service will take care of overlay positioning during updates.
 *
 * @example
 *
 * // add a pink badge on the top left of the shape
 * overlays.add(someShape, {
 *   position: {
 *     top: -5,
 *     left: -5
 *   },
 *   html: '<div style="width: 10px; background: fuchsia; color: white;">0</div>'
 * });
 *
 * // or add via shape id
 *
 * overlays.add('some-element-id', {
 *   position: {
 *     top: -5,
 *     left: -5
 *   }
 *   html: '<div style="width: 10px; background: fuchsia; color: white;">0</div>'
 * });
 *
 * // or add with optional type
 *
 * overlays.add(someShape, 'badge', {
 *   position: {
 *     top: -5,
 *     left: -5
 *   }
 *   html: '<div style="width: 10px; background: fuchsia; color: white;">0</div>'
 * });
 *
 *
 * // remove an overlay
 *
 * var id = overlays.add(...);
 * overlays.remove(id);
 *
 * @param {EventBus} eventBus
 * @param {Canvas} canvas
 * @param {ElementRegistry} elementRegistry
 */
function Overlays(eventBus, canvas, elementRegistry) {

  this._eventBus = eventBus;
  this._canvas = canvas;
  this._elementRegistry = elementRegistry;

  this._ids = ids;

  this._overlayDefaults = {
    show: {
      minZoom: 0.7,
      maxZoom: 5.0
    }
  };

  /**
   * Mapping overlayId -> overlay
   */
  this._overlays = {};

  /**
   * Mapping elementId -> overlay container
   */
  this._overlayContainers = [];

  // root html element for all overlays
  this._overlayRoot = createRoot(canvas.getContainer());

  this._init();
}


Overlays.$inject = [ 'eventBus', 'canvas', 'elementRegistry' ];

module.exports = Overlays;


/**
 * Returns the overlay with the specified id or a list of overlays
 * for an element with a given type.
 *
 * @example
 *
 * // return the single overlay with the given id
 * overlays.get('some-id');
 *
 * // return all overlays for the shape
 * overlays.get({ element: someShape });
 *
 * // return all overlays on shape with type 'badge'
 * overlays.get({ element: someShape, type: 'badge' });
 *
 * // shape can also be specified as id
 * overlays.get({ element: 'element-id', type: 'badge' });
 *
 *
 * @param {Object} search
 * @param {String} [search.id]
 * @param {String|djs.model.Base} [search.element]
 * @param {String} [search.type]
 *
 * @return {Object|Array<Object>} the overlay(s)
 */
Overlays.prototype.get = function(search) {

  if (isString(search)) {
    search = { id: search };
  }

  if (isString(search.element)) {
    search.element = this._elementRegistry.get(search.element);
  }

  if (search.element) {
    var container = this._getOverlayContainer(search.element, true);

    // return a list of overlays when searching by element (+type)
    if (container) {
      return search.type ? filter(container.overlays, { type: search.type }) : container.overlays.slice();
    } else {
      return [];
    }
  } else
  if (search.type) {
    return filter(this._overlays, { type: search.type });
  } else {
    // return single element when searching by id
    return search.id ? this._overlays[search.id] : null;
  }
};

/**
 * Adds a HTML overlay to an element.
 *
 * @param {String|djs.model.Base}   element   attach overlay to this shape
 * @param {String}                  [type]    optional type to assign to the overlay
 * @param {Object}                  overlay   the overlay configuration
 *
 * @param {String|DOMElement}       overlay.html                 html element to use as an overlay
 * @param {Object}                  [overlay.show]               show configuration
 * @param {Number}                  [overlay.show.minZoom]       minimal zoom level to show the overlay
 * @param {Number}                  [overlay.show.maxZoom]       maximum zoom level to show the overlay
 * @param {Object}                  overlay.position             where to attach the overlay
 * @param {Number}                  [overlay.position.left]      relative to element bbox left attachment
 * @param {Number}                  [overlay.position.top]       relative to element bbox top attachment
 * @param {Number}                  [overlay.position.bottom]    relative to element bbox bottom attachment
 * @param {Number}                  [overlay.position.right]     relative to element bbox right attachment
 *
 * @return {String}                 id that may be used to reference the overlay for update or removal
 */
Overlays.prototype.add = function(element, type, overlay) {

  if (isObject(type)) {
    overlay = type;
    type = null;
  }

  if (!element.id) {
    element = this._elementRegistry.get(element);
  }

  if (!overlay.position) {
    throw new Error('must specifiy overlay position');
  }

  if (!overlay.html) {
    throw new Error('must specifiy overlay html');
  }

  if (!element) {
    throw new Error('invalid element specified');
  }

  var id = this._ids.next();

  overlay = assign({}, this._overlayDefaults, overlay, {
    id: id,
    type: type,
    element: element,
    html: overlay.html
  });

  this._addOverlay(overlay);

  return id;
};


/**
 * Remove an overlay with the given id or all overlays matching the given filter.
 *
 * @see Overlays#get for filter options.
 *
 * @param {String} [id]
 * @param {Object} [filter]
 */
Overlays.prototype.remove = function(filter) {

  var overlays = this.get(filter) || [];

  if (!isArray(overlays)) {
    overlays = [ overlays ];
  }

  var self = this;

  forEach(overlays, function(overlay) {

    var container = self._getOverlayContainer(overlay.element, true);

    if (overlay) {
      domRemove(overlay.html);
      domRemove(overlay.htmlContainer);

      delete overlay.htmlContainer;
      delete overlay.element;

      delete self._overlays[overlay.id];
    }

    if (container) {
      var idx = container.overlays.indexOf(overlay);
      if (idx !== -1) {
        container.overlays.splice(idx, 1);
      }
    }
  });

};


Overlays.prototype.show = function() {
  setVisible(this._overlayRoot);
};


Overlays.prototype.hide = function() {
  setVisible(this._overlayRoot, false);
};

Overlays.prototype.clear = function() {
  this._overlays = {};

  this._overlayContainers = [];

  domClear(this._overlayRoot);
};

Overlays.prototype._updateOverlayContainer = function(container) {
  var element = container.element,
      html = container.html;

  // update container left,top according to the elements x,y coordinates
  // this ensures we can attach child elements relative to this container

  var x = element.x,
      y = element.y;

  if (element.waypoints) {
    var bbox = getBBox(element);
    x = bbox.x;
    y = bbox.y;
  }

  setPosition(html, x, y);

  domAttr(container.html, 'data-container-id', element.id);
};


Overlays.prototype._updateOverlay = function(overlay) {

  var position = overlay.position,
      htmlContainer = overlay.htmlContainer,
      element = overlay.element;

  // update overlay html relative to shape because
  // it is already positioned on the element

  // update relative
  var left = position.left,
      top = position.top;

  if (position.right !== undefined) {

    var width;

    if (element.waypoints) {
      width = getBBox(element).width;
    } else {
      width = element.width;
    }

    left = position.right * -1 + width;
  }

  if (position.bottom !== undefined) {

    var height;

    if (element.waypoints) {
      height = getBBox(element).height;
    } else {
      height = element.height;
    }

    top = position.bottom * -1 + height;
  }

  setPosition(htmlContainer, left || 0, top || 0);
};

Overlays.prototype._createOverlayContainer = function(element) {
  var html = domify('<div class="djs-overlays" style="position: absolute" />');

  this._overlayRoot.appendChild(html);

  var container = {
    html: html,
    element: element,
    overlays: []
  };

  this._updateOverlayContainer(container);

  this._overlayContainers.push(container);

  return container;
};


Overlays.prototype._updateRoot = function(viewbox) {
  var a = viewbox.scale || 1;
  var d = viewbox.scale || 1;

  var matrix = 'matrix(' + a + ',0,0,' + d + ',' + (-1 * viewbox.x * a) + ',' + (-1 * viewbox.y * d) + ')';

  this._overlayRoot.style.transform = matrix;
  this._overlayRoot.style['-ms-transform'] = matrix;
  this._overlayRoot.style['-webkit-transform'] = matrix;
};


Overlays.prototype._getOverlayContainer = function(element, raw) {
  var container = find(this._overlayContainers, function(c) {
    return c.element === element;
  });


  if (!container && !raw) {
    return this._createOverlayContainer(element);
  }

  return container;
};





Overlays.prototype._addOverlay = function(overlay) {

  var id = overlay.id,
      element = overlay.element,
      html = overlay.html,
      htmlContainer,
      overlayContainer;

  // unwrap jquery (for those who need it)
  if (html.get && html.constructor.prototype.jquery) {
    html = html.get(0);
  }

  // create proper html elements from
  // overlay HTML strings
  if (isString(html)) {
    html = domify(html);
  }

  overlayContainer = this._getOverlayContainer(element);

  htmlContainer = domify('<div class="djs-overlay" data-overlay-id="' + id + '" style="position: absolute">');

  htmlContainer.appendChild(html);

  if (overlay.type) {
    domClasses(htmlContainer).add('djs-overlay-' + overlay.type);
  }

  overlay.htmlContainer = htmlContainer;

  overlayContainer.overlays.push(overlay);
  overlayContainer.html.appendChild(htmlContainer);

  this._overlays[id] = overlay;

  this._updateOverlay(overlay);
  this._updateOverlayVisibilty(overlay, this._canvas.viewbox());
};

Overlays.prototype._updateOverlayVisibilty = function(overlay, viewbox) {
  var show = overlay.show,
      htmlContainer = overlay.htmlContainer,
      visible = true;

  if (show) {
    if (show.minZoom > viewbox.scale ||
        show.maxZoom < viewbox.scale) {
      visible = false;
    }

    setVisible(htmlContainer, visible);
  }
};

Overlays.prototype._updateOverlaysVisibilty = function(viewbox) {

  var self = this;

  forEach(this._overlays, function(overlay) {
    self._updateOverlayVisibilty(overlay, viewbox);
  });
};


Overlays.prototype._init = function() {

  var eventBus = this._eventBus;

  var self = this;


  // scroll/zoom integration

  function updateViewbox(viewbox) {
    self._updateRoot(viewbox);
    self._updateOverlaysVisibilty(viewbox);

    self.show();
  }

  eventBus.on('canvas.viewbox.changing', function(event) {
    self.hide();
  });

  eventBus.on('canvas.viewbox.changed', function(event) {
    updateViewbox(event.viewbox);
  });


  // remove integration

  eventBus.on([ 'shape.remove', 'connection.remove' ], function(e) {
    var element = e.element;
    var overlays = self.get({ element: element });

    forEach(overlays, function(o) {
      self.remove(o.id);
    });

    var container = self._getOverlayContainer(element);

    if (container) {
      domRemove(container.html);
      var i = self._overlayContainers.indexOf(container);
      if (i !== -1) {
        self._overlayContainers.splice(i, 1);
      }
    }
  });


  // move integration

  eventBus.on('element.changed', LOW_PRIORITY, function(e) {
    var element = e.element;

    var container = self._getOverlayContainer(element, true);

    if (container) {
      forEach(container.overlays, function(overlay) {
        self._updateOverlay(overlay);
      });

      self._updateOverlayContainer(container);
    }
  });


  // marker integration, simply add them on the overlays as classes, too.

  eventBus.on('element.marker.update', function(e) {
    var container = self._getOverlayContainer(e.element, true);
    if (container) {
      domClasses(container.html)[e.add ? 'add' : 'remove'](e.marker);
    }
  });


  // clear overlays with diagram

  eventBus.on('diagram.clear', this.clear, this);
};

},{"../../util/Elements":169,"../../util/IdGenerator":173,"lodash/collection/filter":202,"lodash/collection/find":203,"lodash/collection/forEach":204,"lodash/lang/isArray":319,"lodash/lang/isObject":323,"lodash/lang/isString":325,"lodash/object/assign":328,"min-dom/lib/attr":338,"min-dom/lib/classes":339,"min-dom/lib/clear":340,"min-dom/lib/domify":343,"min-dom/lib/remove":347}],126:[function(require,module,exports){
module.exports = {
  __init__: [ 'overlays' ],
  overlays: [ 'type', require('./Overlays') ]
};
},{"./Overlays":125}],127:[function(require,module,exports){
'use strict';

var isFunction = require('lodash/lang/isFunction'),
    isArray = require('lodash/lang/isArray'),
    forEach = require('lodash/collection/forEach');

var domify = require('min-dom/lib/domify'),
    domQuery = require('min-dom/lib/query'),
    domAttr = require('min-dom/lib/attr'),
    domClear = require('min-dom/lib/clear'),
    domClasses = require('min-dom/lib/classes'),
    domMatches = require('min-dom/lib/matches'),
    domDelegate = require('min-dom/lib/delegate'),
    domEvent = require('min-dom/lib/event');


var toggleSelector = '.djs-palette-toggle',
    entrySelector = '.entry',
    elementSelector = toggleSelector + ', ' + entrySelector;


/**
 * A palette containing modeling elements.
 */
function Palette(eventBus, canvas, dragging) {

  this._eventBus = eventBus;
  this._canvas = canvas;
  this._dragging = dragging;

  this._providers = [];

  var self = this;

  eventBus.on('tool-manager.update', function(event) {
    var tool = event.tool;

    self.updateToolHighlight(tool);
  });

  eventBus.on('i18n.changed', function() {
    self._update();
  });
}

Palette.$inject = [ 'eventBus', 'canvas', 'dragging' ];

module.exports = Palette;


/**
 * Register a provider with the palette
 *
 * @param  {PaletteProvider} provider
 */
Palette.prototype.registerProvider = function(provider) {
  this._providers.push(provider);

  if (!this._container) {
    this._init();
  }

  this._update();
};


/**
 * Returns the palette entries for a given element
 *
 * @return {Array<PaletteEntryDescriptor>} list of entries
 */
Palette.prototype.getEntries = function() {

  var entries = {};

  // loop through all providers and their entries.
  // group entries by id so that overriding an entry is possible
  forEach(this._providers, function(provider) {
    var e = provider.getPaletteEntries();

    forEach(e, function(entry, id) {
      entries[id] = entry;
    });
  });

  return entries;
};


/**
 * Initialize
 */
Palette.prototype._init = function() {
  var canvas = this._canvas,
      eventBus = this._eventBus;

  var parent = canvas.getContainer(),
      container = this._container = domify(Palette.HTML_MARKUP),
      self = this;

  parent.appendChild(container);

  domDelegate.bind(container, elementSelector, 'click', function(event) {

    var target = event.delegateTarget;

    if (domMatches(target, toggleSelector)) {
      return self.toggle();
    }

    self.trigger('click', event);
  });

  // prevent drag propagation
  domEvent.bind(container, 'mousedown', function(event) {
    event.stopPropagation();
  });

  // prevent drag propagation
  domDelegate.bind(container, entrySelector, 'dragstart', function(event) {
    self.trigger('dragstart', event);
  });

  eventBus.fire('palette.create', {
    html: container
  });

  eventBus.on('canvas.resized', this.triggerTwoColumn, this);
};


Palette.prototype._update = function() {

  var entriesContainer = domQuery('.djs-palette-entries', this._container),
      entries = this._entries = this.getEntries();

  domClear(entriesContainer);

  forEach(entries, function(entry, id) {

    var grouping = entry.group || 'default';

    var container = domQuery('[data-group=' + grouping + ']', entriesContainer);
    if (!container) {
      container = domify('<div class="group" data-group="' + grouping + '"></div>');
      entriesContainer.appendChild(container);
    }

    var html = entry.html || (
      entry.separator ?
        '<hr class="separator" />' :
        '<div class="entry" draggable="true"></div>');


    var control = domify(html);
    container.appendChild(control);

    if (!entry.separator) {
      domAttr(control, 'data-action', id);

      if (entry.title) {
        domAttr(control, 'title', entry.title);
      }

      if (entry.className) {
        addClasses(control, entry.className);
      }

      if (entry.imageUrl) {
        control.appendChild(domify('<img src="' + entry.imageUrl + '">'));
      }
    }
  });

  // open after update
  this.open(true);
};


/**
 * Trigger an action available on the palette
 *
 * @param  {String} action
 * @param  {Event} event
 */
Palette.prototype.trigger = function(action, event, autoActivate) {
  var entries = this._entries,
      entry,
      handler,
      originalEvent,
      button = event.delegateTarget || event.target;

  if (!button) {
    return event.preventDefault();
  }

  entry = entries[domAttr(button, 'data-action')];

  // when user clicks on the palette and not on an action
  if (!entry) {
    return;
  }

  handler = entry.action;

  originalEvent = event.originalEvent || event;

  // simple action (via callback function)
  if (isFunction(handler)) {
    if (action === 'click') {
      handler(originalEvent, autoActivate);
    }
  } else {
    if (handler[action]) {
      handler[action](originalEvent, autoActivate);
    }
  }

  // silence other actions
  event.preventDefault();
};

Palette.prototype.triggerTwoColumn = function() {
  var canvas = this._canvas;

  var parent = canvas.getContainer();

  if (parent.clientHeight < 650) {
    domClasses(parent).add('two-column');
  } else {
    domClasses(parent).remove('two-column');
  }
};


/**
 * Close the palette
 */
Palette.prototype.close = function() {
  var canvas = this._canvas;

  var parent = canvas.getContainer();

  domClasses(this._container).remove('open');

  domClasses(parent).remove('two-column');
};


/**
 * Open the palette
 */
Palette.prototype.open = function() {
  domClasses(this._container).add('open');

  this.triggerTwoColumn();
};


Palette.prototype.toggle = function(open) {
  if (this.isOpen()) {
    this.close();
  } else {
    this.open();
  }
};

Palette.prototype.isActiveTool = function(tool) {
  return tool && this._activeTool === tool;
};

Palette.prototype.updateToolHighlight = function(name) {
  var entriesContainer,
      toolsContainer;

  if (!this._toolsContainer) {
    entriesContainer = domQuery('.djs-palette-entries', this._container);

    this._toolsContainer = domQuery('[data-group=tools]', entriesContainer);
  }

  toolsContainer = this._toolsContainer;

  forEach(toolsContainer.children, function(tool) {
    var actionName = tool.getAttribute('data-action');

    if (!actionName) {
      return;
    }

    actionName = actionName.replace('-tool', '');

    if (tool.classList.contains('entry') && actionName === name) {
      domClasses(tool).add('highlighted-entry');
    } else {
      domClasses(tool).remove('highlighted-entry');
    }
  });
};


/**
 * Return true if the palette is opened.
 *
 * @example
 *
 * palette.open();
 *
 * if (palette.isOpen()) {
 *   // yes, we are open
 * }
 *
 * @return {boolean} true if palette is opened
 */
Palette.prototype.isOpen = function() {
  return this._container && domClasses(this._container).has('open');
};


/* markup definition */

Palette.HTML_MARKUP =
  '<div class="djs-palette">' +
    '<div class="djs-palette-entries"></div>' +
    '<div class="djs-palette-toggle"></div>' +
  '</div>';


////////// helpers /////////////////////////////

function addClasses(element, classNames) {

  var classes = domClasses(element);

  var actualClassNames = isArray(classNames) ? classNames : classNames.split(/\s+/g);
  actualClassNames.forEach(function(cls) {
    classes.add(cls);
  });
}

},{"lodash/collection/forEach":204,"lodash/lang/isArray":319,"lodash/lang/isFunction":320,"min-dom/lib/attr":338,"min-dom/lib/classes":339,"min-dom/lib/clear":340,"min-dom/lib/delegate":342,"min-dom/lib/domify":343,"min-dom/lib/event":344,"min-dom/lib/matches":345,"min-dom/lib/query":346}],128:[function(require,module,exports){
'use strict';

module.exports = {
  __depends__: [ require('../tool-manager') ],
  __init__: [ 'palette' ],
  palette: [ 'type', require('./Palette') ]
};

},{"../tool-manager":151,"./Palette":127}],129:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClone = require('tiny-svg/lib/clone'),
    svgCreate = require('tiny-svg/lib/create');

/**
 * Adds support for previews of moving/resizing elements.
 */
function PreviewSupport(elementRegistry, canvas, styles) {
  this._elementRegistry = elementRegistry;
  this._canvas = canvas;
  this._styles = styles;
}

module.exports = PreviewSupport;

PreviewSupport.$inject = [ 'elementRegistry', 'canvas', 'styles' ];


/**
 * Returns graphics of an element.
 *
 * @param {djs.model.Base} element
 *
 * @return {SVGElement}
 */
PreviewSupport.prototype.getGfx = function(element) {
  return this._elementRegistry.getGraphics(element);
};

/**
 * Adds a move preview of a given shape to a given svg group.
 *
 * @param {djs.model.Base} element
 * @param {SVGElement} group
 *
 * @return {SVGElement} dragger
 */
PreviewSupport.prototype.addDragger = function(shape, group) {
  var gfx = this.getGfx(shape);

  // clone is not included in tsvg for some reason
  var dragger = svgClone(gfx);
  var bbox = gfx.getBoundingClientRect();

  // remove markers from connections
  if (isConnection(shape)) {
    removeMarkers(dragger);
  }

  svgAttr(dragger, this._styles.cls('djs-dragger', [], {
    x: bbox.top,
    y: bbox.left
  }));

  svgAppend(group, dragger);

  return dragger;
};

/**
 * Adds a resize preview of a given shape to a given svg group.
 *
 * @param {djs.model.Base} element
 * @param {SVGElement} group
 *
 * @return {SVGElement} frame
 */
PreviewSupport.prototype.addFrame = function(shape, group) {

  var frame = svgCreate('rect', {
    class: 'djs-resize-overlay',
    width:  shape.width,
    height: shape.height,
    x: shape.x,
    y: shape.y
  });

  svgAppend(group, frame);

  return frame;
};

////////// helpers //////////

/**
 * Removes all svg marker references from an SVG.
 *
 * @param {SVGElement} gfx
 */
function removeMarkers(gfx) {

  if (gfx.children) {

    forEach(gfx.children, function(child) {

      // recursion
      removeMarkers(child);

    });

  }

  gfx.style.markerStart = '';
  gfx.style.markerEnd = '';

}

/**
 * Checks if an element is a connection.
 */
function isConnection(element) {
  return element.waypoints;
}

},{"lodash/collection/forEach":204,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/clone":356,"tiny-svg/lib/create":357}],130:[function(require,module,exports){
'use strict';

module.exports = {
  __init__: [ 'previewSupport' ],
  previewSupport: [ 'type', require('./PreviewSupport') ]
};

},{"./PreviewSupport":129}],131:[function(require,module,exports){
'use strict';

var pick = require('lodash/object/pick'),
    assign = require('lodash/object/assign');

var ResizeUtil = require('./ResizeUtil');

var asTRBL = require('../../layout/LayoutUtil').asTRBL,
    roundBounds = require('../../layout/LayoutUtil').roundBounds;

var DEFAULT_MIN_WIDTH = 10;


/**
 * A component that provides resizing of shapes on the canvas.
 *
 * The following components are part of shape resize:
 *
 *  * adding resize handles,
 *  * creating a visual during resize
 *  * checking resize rules
 *  * committing a change once finished
 *
 *
 * ## Customizing
 *
 * It's possible to customize the resizing behaviour by intercepting 'resize.start'
 * and providing the following parameters through the 'context':
 *
 *   * minDimensions ({ width, height }): minimum shape dimensions
 *
 *   * childrenBoxPadding ({ left, top, bottom, right } || number):
 *     gap between the minimum bounding box and the container
 *
 * f.ex:
 *
 * ```javascript
 * eventBus.on('resize.start', 1500, function(event) {
 *   var context = event.context,
 *
 *  context.minDimensions = { width: 140, height: 120 };
 *
 *  // Passing general padding
 *  context.childrenBoxPadding = 30;
 *
 *  // Passing padding to a specific side
 *  context.childrenBoxPadding.left = 20;
 * });
 * ```
 */
function Resize(eventBus, rules, modeling, dragging) {

  this._dragging = dragging;
  this._rules = rules;

  var self = this;

  eventBus.on('resize.start', function(event) {

    var context = event.context,
        resizeConstraints = context.resizeConstraints,
        // evaluate minBounds for backwards compatibility
        minBounds = context.minBounds;

    if (resizeConstraints === undefined) {

      if (minBounds === undefined) {
        minBounds = self.computeMinResizeBox(context);
      }

      context.resizeConstraints = {
        min: asTRBL(minBounds)
      };
    }
  });

  eventBus.on('resize.move', function(event) {

    var context = event.context,
        shape = context.shape,
        direction = context.direction,
        resizeConstraints = context.resizeConstraints,
        delta,
        newBounds;

    delta = {
      x: event.dx,
      y: event.dy
    };

    context.delta = delta;

    newBounds = ResizeUtil.resizeBounds(shape, direction, delta);

    // ensure constraints during resize
    context.newBounds = ResizeUtil.ensureConstraints(newBounds, resizeConstraints);

    // update + cache executable state
    context.canExecute = self.canResize(context);
  });

  eventBus.on('resize.end', function(event) {
    var context = event.context,
        shape = context.shape,
        canExecute = context.canExecute,
        newBounds = context.newBounds;

    if (canExecute) {
      // ensure we have actual pixel values for new bounds
      // (important when zoom level was > 1 during move)
      newBounds = roundBounds(newBounds);

      // perform the actual resize
      modeling.resizeShape(shape, newBounds);
    }
  });
}


Resize.prototype.canResize = function(context) {
  var rules = this._rules;

  var ctx = pick(context, [ 'newBounds', 'shape', 'delta', 'direction' ]);

  return rules.allowed('shape.resize', ctx);
};

/**
 * Activate a resize operation
 *
 * You may specify additional contextual information and must specify a
 * resize direction during activation of the resize event.
 *
 * @param {MouseEvent} event
 * @param {djs.model.Shape} shape
 * @param {Object|String} contextOrDirection
 */
Resize.prototype.activate = function(event, shape, contextOrDirection) {
  var dragging = this._dragging,
      context,
      direction;

  if (typeof contextOrDirection === 'string') {
    contextOrDirection = {
      direction: contextOrDirection
    };
  }

  context = assign({ shape: shape }, contextOrDirection);

  direction = context.direction;

  if (!direction) {
    throw new Error('must provide a direction (nw|se|ne|sw)');
  }

  dragging.init(event, 'resize', {
    autoActivate: true,
    cursor: 'resize-' + (/nw|se/.test(direction) ? 'nwse' : 'nesw'),
    data: {
      shape: shape,
      context: context
    }
  });
};

Resize.prototype.computeMinResizeBox = function(context) {
  var shape = context.shape,
      direction = context.direction,
      minDimensions,
      childrenBounds;

  minDimensions = context.minDimensions || {
    width: DEFAULT_MIN_WIDTH,
    height: DEFAULT_MIN_WIDTH
  };

  // get children bounds
  childrenBounds = ResizeUtil.computeChildrenBBox(shape, context.childrenBoxPadding);

  // get correct minimum bounds from given resize direction
  // basically ensures that the minBounds is max(childrenBounds, minDimensions)
  return ResizeUtil.getMinResizeBounds(direction, shape, minDimensions, childrenBounds);
};


Resize.$inject = [ 'eventBus', 'rules', 'modeling', 'dragging' ];

module.exports = Resize;

},{"../../layout/LayoutUtil":161,"./ResizeUtil":134,"lodash/object/assign":328,"lodash/object/pick":334}],132:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var HANDLE_OFFSET = -2,
    HANDLE_SIZE  = 5,
    HANDLE_HIT_SIZE = 20;

var CLS_RESIZER   = 'djs-resizer';

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClasses = require('tiny-svg/lib/classes'),
    svgClear = require('tiny-svg/lib/clear'),
    svgCreate = require('tiny-svg/lib/create');

var domEvent = require('min-dom/lib/event');

var isPrimaryButton = require('../../util/Mouse').isPrimaryButton;

var asTRBL = require('../../layout/LayoutUtil').asTRBL;

var transform = require('../../util/SvgTransformUtil').transform;


/**
 * This component is responsible for adding resize handles.
 *
 * @param {EventBus} eventBus
 * @param {Canvas} canvas
 * @param {Selection} selection
 * @param {Resize} resize
 */
function ResizeHandles(eventBus, canvas, selection, resize) {

  this._resize = resize;
  this._canvas = canvas;

  var self = this;

  eventBus.on('selection.changed', function(e) {
    var newSelection = e.newSelection;

    // remove old selection markers
    self.removeResizers();

    // add new selection markers ONLY if single selection
    if (newSelection.length === 1) {
      forEach(newSelection, self.addResizer, self);
    }
  });

  eventBus.on('shape.changed', function(e) {
    var shape = e.element;

    if (selection.isSelected(shape)) {
      self.removeResizers();

      self.addResizer(shape);
    }
  });
}


ResizeHandles.prototype.makeDraggable = function(element, gfx, direction) {
  var resize = this._resize;

  function startResize(event) {
    // only trigger on left mouse button
    if (isPrimaryButton(event)) {
      resize.activate(event, element, direction);
    }
  }

  domEvent.bind(gfx, 'mousedown', startResize);
  domEvent.bind(gfx, 'touchstart', startResize);
};


ResizeHandles.prototype._createResizer = function(element, x, y, rotation, direction) {
  var resizersParent = this._getResizersParent();

  var group = svgCreate('g');
  svgClasses(group).add(CLS_RESIZER);
  svgClasses(group).add(CLS_RESIZER + '-' + element.id);
  svgClasses(group).add(CLS_RESIZER + '-' + direction);

  svgAppend(resizersParent, group);

  var origin = -HANDLE_SIZE + HANDLE_OFFSET;

  // Create four drag indicators on the outline
  var visual = svgCreate('rect');
  svgAttr(visual, {
    x: origin,
    y: origin,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE
  });
  svgClasses(visual).add(CLS_RESIZER + '-visual');

  svgAppend(group, visual);

  var hit = svgCreate('rect');
  svgAttr(hit, {
    x: origin,
    y: origin,
    width: HANDLE_HIT_SIZE,
    height: HANDLE_HIT_SIZE
  });
  svgClasses(hit).add(CLS_RESIZER + '-hit');

  svgAppend(group, hit);

  transform(group, x, y, rotation);

  return group;
};

ResizeHandles.prototype.createResizer = function(element, direction) {
  var resizer;

  var trbl = asTRBL(element);

  if (direction === 'nw') {
    resizer = this._createResizer(element, trbl.left, trbl.top, 0, direction);
  } else if (direction === 'ne') {
    resizer = this._createResizer(element, trbl.right, trbl.top, 90, direction);
  } else if (direction === 'se') {
    resizer = this._createResizer(element, trbl.right, trbl.bottom, 180, direction);
  } else {
    resizer = this._createResizer(element, trbl.left, trbl.bottom, 270, direction);
  }

  this.makeDraggable(element, resizer, direction);
};

// resize handles implementation ///////////////////////////////

/**
 * Add resizers for a given element.
 *
 * @param {djs.model.Shape} shape
 */
ResizeHandles.prototype.addResizer = function(shape) {
  var resize = this._resize;

  if (!resize.canResize({ shape: shape })) {
    return;
  }

  this.createResizer(shape, 'nw');
  this.createResizer(shape, 'ne');
  this.createResizer(shape, 'se');
  this.createResizer(shape, 'sw');
};

/**
 * Remove all resizers
 */
ResizeHandles.prototype.removeResizers = function() {
  var resizersParent = this._getResizersParent();

  svgClear(resizersParent);
};

ResizeHandles.prototype._getResizersParent = function() {
  return this._canvas.getLayer('resizers');
};

ResizeHandles.$inject = [ 'eventBus', 'canvas', 'selection', 'resize' ];

module.exports = ResizeHandles;

},{"../../layout/LayoutUtil":161,"../../util/Mouse":176,"../../util/SvgTransformUtil":181,"lodash/collection/forEach":204,"min-dom/lib/event":344,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/clear":355,"tiny-svg/lib/create":357}],133:[function(require,module,exports){
'use strict';

var MARKER_RESIZING = 'djs-resizing',
    MARKER_RESIZE_NOT_OK = 'resize-not-ok';

var LOW_PRIORITY = 500;

var svgAttr = require('tiny-svg/lib/attr'),
    svgRemove = require('tiny-svg/lib/remove');

var svgClasses = require('tiny-svg/lib/classes');


/**
 * Provides previews for resizing shapes when resizing.
 *
 * @param {EventBus} eventBus
 * @param {ElementRegistry} elementRegistry
 * @param {Canvas} canvas
 * @param {Styles} styles
 */
function ResizePreview(eventBus, elementRegistry, canvas, styles, previewSupport) {

  // add and update previews
  eventBus.on('resize.move', LOW_PRIORITY, function(event) {
    var context = event.context,
        shape = context.shape,
        bounds = context.newBounds,
        frame = context.frame;

    if (!frame) {
      frame = context.frame = previewSupport.addFrame(shape, canvas.getDefaultLayer());

      canvas.addMarker(shape, MARKER_RESIZING);
    }

    if (bounds.width > 5) {
      svgAttr(frame, { x: bounds.x, width: bounds.width });
    }

    if (bounds.height > 5) {
      svgAttr(frame, { y: bounds.y, height: bounds.height });
    }

    if (context.canExecute) {
      svgClasses(frame).remove(MARKER_RESIZE_NOT_OK);
    } else {
      svgClasses(frame).add(MARKER_RESIZE_NOT_OK);
    }

  });

  // remove previews
  eventBus.on('resize.cleanup', function(event) {
    var context = event.context,
        shape = context.shape,
        frame = context.frame;

    if (frame) {
      svgRemove(context.frame);
    }

    canvas.removeMarker(shape, MARKER_RESIZING);
  });
}

ResizePreview.$inject = [ 'eventBus', 'elementRegistry', 'canvas', 'styles', 'previewSupport'];

module.exports = ResizePreview;

},{"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/remove":359}],134:[function(require,module,exports){
'use strict';

var filter = require('lodash/collection/filter');

var max = Math.max,
    min = Math.min;

var DEFAULT_CHILD_BOX_PADDING = 20;

var getBBox = require('../../util/Elements').getBBox;


var asTRBL = require('../../layout/LayoutUtil').asTRBL,
    asBounds = require('../../layout/LayoutUtil').asBounds;

function isNumber(a) {
  return typeof a === 'number';
}

/**
 * Substract a TRBL from another
 *
 * @param  {TRBL} trblA
 * @param  {TRBL} trblB
 *
 * @return {TRBL}
 */
module.exports.substractTRBL = function(trblA, trblB) {
  return {
    top: trblA.top - trblB.top,
    right: trblA.right - trblB.right,
    bottom: trblA.bottom - trblB.bottom,
    left: trblA.left - trblB.left
  };
};

/**
 * Resize the given bounds by the specified delta from a given anchor point.
 *
 * @param {Bounds} bounds the bounding box that should be resized
 * @param {String} direction in which the element is resized (nw, ne, se, sw)
 * @param {Point} delta of the resize operation
 *
 * @return {Bounds} resized bounding box
 */
module.exports.resizeBounds = function(bounds, direction, delta) {

  var dx = delta.x,
      dy = delta.y;

  switch (direction) {

  case 'nw':
    return {
      x: bounds.x + dx,
      y: bounds.y + dy,
      width: bounds.width - dx,
      height: bounds.height - dy
    };

  case 'sw':
    return {
      x: bounds.x + dx,
      y: bounds.y,
      width: bounds.width - dx,
      height: bounds.height + dy
    };

  case 'ne':
    return {
      x: bounds.x,
      y: bounds.y + dy,
      width: bounds.width + dx,
      height: bounds.height - dy
    };

  case 'se':
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width + dx,
      height: bounds.height + dy
    };

  default:
    throw new Error('unrecognized direction: ' + direction);
  }
};


/**
 * Resize the given bounds by applying the passed
 * { top, right, bottom, left } delta.
 *
 * @param {Bounds} bounds
 * @param {TRBL} trblResize
 *
 * @return {Bounds}
 */
module.exports.resizeTRBL = function(bounds, resize) {
  return {
    x: bounds.x + (resize.left || 0),
    y: bounds.y + (resize.top || 0),
    width: bounds.width - (resize.left || 0) + (resize.right || 0),
    height: bounds.height - (resize.top || 0) + (resize.bottom || 0)
  };
};


module.exports.reattachPoint = function(bounds, newBounds, point) {

  var sx = bounds.width / newBounds.width,
      sy = bounds.height / newBounds.height;

  return {
    x: Math.round((newBounds.x + newBounds.width / 2)) - Math.floor(((bounds.x + bounds.width / 2) - point.x) / sx),
    y: Math.round((newBounds.y + newBounds.height / 2)) - Math.floor(((bounds.y + bounds.height / 2) - point.y) / sy)
  };
};


function applyConstraints(attr, trbl, resizeConstraints) {

  var value = trbl[attr],
      minValue = resizeConstraints.min && resizeConstraints.min[attr],
      maxValue = resizeConstraints.max && resizeConstraints.max[attr];

  if (isNumber(minValue)) {
    value = (/top|left/.test(attr) ? min : max)(value, minValue);
  }

  if (isNumber(maxValue)) {
    value = (/top|left/.test(attr) ? max : min)(value, maxValue);
  }

  return value;
}

module.exports.ensureConstraints = function(currentBounds, resizeConstraints) {

  if (!resizeConstraints) {
    return currentBounds;
  }

  var currentTrbl = asTRBL(currentBounds);

  return asBounds({
    top: applyConstraints('top', currentTrbl, resizeConstraints),
    right: applyConstraints('right', currentTrbl, resizeConstraints),
    bottom: applyConstraints('bottom', currentTrbl, resizeConstraints),
    left: applyConstraints('left', currentTrbl, resizeConstraints)
  });
};


module.exports.getMinResizeBounds = function(direction, currentBounds, minDimensions, childrenBounds) {

  var currentBox = asTRBL(currentBounds);

  var minBox = {
    top: /n/.test(direction) ? currentBox.bottom - minDimensions.height : currentBox.top,
    left: /w/.test(direction) ? currentBox.right - minDimensions.width : currentBox.left,
    bottom: /s/.test(direction) ? currentBox.top + minDimensions.height : currentBox.bottom,
    right: /e/.test(direction) ? currentBox.left + minDimensions.width : currentBox.right
  };

  var childrenBox = childrenBounds ? asTRBL(childrenBounds) : minBox;

  var combinedBox = {
    top: min(minBox.top, childrenBox.top),
    left: min(minBox.left, childrenBox.left),
    bottom: max(minBox.bottom, childrenBox.bottom),
    right: max(minBox.right, childrenBox.right)
  };

  return asBounds(combinedBox);
};

function asPadding(mayBePadding, defaultValue) {
  if (typeof mayBePadding !== 'undefined') {
    return mayBePadding;
  } else {
    return DEFAULT_CHILD_BOX_PADDING;
  }
}

function addPadding(bbox, padding) {
  var left, right, top, bottom;

  if (typeof padding === 'object') {
    left = asPadding(padding.left);
    right = asPadding(padding.right);
    top = asPadding(padding.top);
    bottom = asPadding(padding.bottom);
  } else {
    left = right = top = bottom = asPadding(padding);
  }

  return {
    x: bbox.x - left,
    y: bbox.y - top,
    width: bbox.width + left + right,
    height: bbox.height + top + bottom
  };
}

module.exports.addPadding = addPadding;


/**
 * Is the given element part of the resize
 * targets min boundary box?
 *
 * This is the default implementation which excludes
 * connections and labels.
 *
 * @param {djs.model.Base} element
 */
function isBBoxChild(element) {

  // exclude connections
  if (element.waypoints) {
    return false;
  }

  // exclude labels
  if (element.type === 'label') {
    return false;
  }

  return true;
}

/**
 * Return children bounding computed from a shapes children
 * or a list of prefiltered children.
 *
 * @param  {djs.model.Shape|Array<djs.model.Shape>} shapeOrChildren
 * @param  {Number|Object} padding
 *
 * @return {Bounds}
 */
function computeChildrenBBox(shapeOrChildren, padding) {

  var elements;

  // compute based on shape
  if (shapeOrChildren.length === undefined) {
    // grab all the children that are part of the
    // parents children box
    elements = filter(shapeOrChildren.children, isBBoxChild);

  } else {
    elements = shapeOrChildren;
  }

  if (elements.length) {
    return addPadding(getBBox(elements), padding);
  }
}

module.exports.computeChildrenBBox = computeChildrenBBox;

},{"../../layout/LayoutUtil":161,"../../util/Elements":169,"lodash/collection/filter":202}],135:[function(require,module,exports){
module.exports = {
  __depends__: [
    require('../rules'),
    require('../dragging'),
    require('../preview-support')
  ],
  __init__: [ 'resize', 'resizePreview', 'resizeHandles' ],
  resize: [ 'type', require('./Resize') ],
  resizePreview: [ 'type', require('./ResizePreview') ],
  resizeHandles: [ 'type', require('./ResizeHandles') ]
};

},{"../dragging":87,"../preview-support":130,"../rules":138,"./Resize":131,"./ResizeHandles":132,"./ResizePreview":133}],136:[function(require,module,exports){

'use strict';

var inherits = require('inherits');

var CommandInterceptor = require('../../command/CommandInterceptor');

/**
 * A basic provider that may be extended to implement modeling rules.
 *
 * Extensions should implement the init method to actually add their custom
 * modeling checks. Checks may be added via the #addRule(action, fn) method.
 *
 * @param {EventBus} eventBus
 */
function RuleProvider(eventBus) {
  CommandInterceptor.call(this, eventBus);

  this.init();
}

RuleProvider.$inject = [ 'eventBus' ];

inherits(RuleProvider, CommandInterceptor);

module.exports = RuleProvider;


/**
 * Adds a modeling rule for the given action, implemented through
 * a callback function.
 *
 * The function will receive the modeling specific action context
 * to perform its check. It must return `false` to disallow the
 * action from happening or `true` to allow the action.
 *
 * A rule provider may pass over the evaluation to lower priority
 * rules by returning return nothing (or <code>undefined</code>).
 *
 * @example
 *
 * ResizableRules.prototype.init = function() {
 *
 *   \/**
 *    * Return `true`, `false` or nothing to denote
 *    * _allowed_, _not allowed_ and _continue evaluating_.
 *    *\/
 *   this.addRule('shape.resize', function(context) {
 *
 *     var shape = context.shape;
 *
 *     if (!context.newBounds) {
 *       // check general resizability
 *       if (!shape.resizable) {
 *         return false;
 *       }
 *
 *       // not returning anything (read: undefined)
 *       // will continue the evaluation of other rules
 *       // (with lower priority)
 *       return;
 *     } else {
 *       // element must have minimum size of 10*10 points
 *       return context.newBounds.width > 10 && context.newBounds.height > 10;
 *     }
 *   });
 * };
 *
 * @param {String|Array<String>} actions the identifier for the modeling action to check
 * @param {Number} [priority] the priority at which this rule is being applied
 * @param {Function} fn the callback function that performs the actual check
 */
RuleProvider.prototype.addRule = function(actions, priority, fn) {

  var self = this;

  if (typeof actions === 'string') {
    actions = [ actions ];
  }

  actions.forEach(function(action) {

    self.canExecute(action, priority, function(context, action, event) {
      return fn(context);
    }, true);
  });
};

/**
 * Implement this method to add new rules during provider initialization.
 */
RuleProvider.prototype.init = function() {};
},{"../../command/CommandInterceptor":56,"inherits":191}],137:[function(require,module,exports){
'use strict';

/**
 * A service that provides rules for certain diagram actions.
 *
 * The default implementation will hook into the {@link CommandStack}
 * to perform the actual rule evaluation. Make sure to provide the
 * `commandStack` service with this module if you plan to use it.
 *
 * Together with this implementation you may use the {@link RuleProvider}
 * to implement your own rule checkers.
 *
 * This module is ment to be easily replaced, thus the tiny foot print.
 *
 * @param {Injector} injector
 */
function Rules(injector) {
  this._commandStack = injector.get('commandStack', false);
}

Rules.$inject = [ 'injector' ];

module.exports = Rules;


/**
 * Returns whether or not a given modeling action can be executed
 * in the specified context.
 *
 * This implementation will respond with allow unless anyone
 * objects.
 *
 * @param {String} action the action to be checked
 * @param {Object} [context] the context to check the action in
 *
 * @return {Boolean} returns true, false or null depending on whether the
 *                   operation is allowed, not allowed or should be ignored.
 */
Rules.prototype.allowed = function(action, context) {
  var allowed = true;

  var commandStack = this._commandStack;

  if (commandStack) {
    allowed = commandStack.canExecute(action, context);
  }

  // map undefined to true, i.e. no rules
  return allowed === undefined ? true : allowed;
};
},{}],138:[function(require,module,exports){
module.exports = {
  __init__: [ 'rules' ],
  rules: [ 'type', require('./Rules') ]
};

},{"./Rules":137}],139:[function(require,module,exports){
'use strict';

var isArray = require('lodash/lang/isArray'),
    forEach = require('lodash/collection/forEach');


/**
 * A service that offers the current selection in a diagram.
 * Offers the api to control the selection, too.
 *
 * @class
 *
 * @param {EventBus} eventBus the event bus
 */
function Selection(eventBus) {

  this._eventBus = eventBus;

  this._selectedElements = [];

  var self = this;

  eventBus.on([ 'shape.remove', 'connection.remove' ], function(e) {
    var element = e.element;
    self.deselect(element);
  });

  eventBus.on([ 'diagram.clear' ], function(e) {
    self.select(null);
  });
}

Selection.$inject = [ 'eventBus' ];

module.exports = Selection;


Selection.prototype.deselect = function(element) {
  var selectedElements = this._selectedElements;

  var idx = selectedElements.indexOf(element);

  if (idx !== -1) {
    var oldSelection = selectedElements.slice();

    selectedElements.splice(idx, 1);

    this._eventBus.fire('selection.changed', { oldSelection: oldSelection, newSelection: selectedElements });
  }
};


Selection.prototype.get = function() {
  return this._selectedElements;
};

Selection.prototype.isSelected = function(element) {
  return this._selectedElements.indexOf(element) !== -1;
};


/**
 * This method selects one or more elements on the diagram.
 *
 * By passing an additional add parameter you can decide whether or not the element(s)
 * should be added to the already existing selection or not.
 *
 * @method Selection#select
 *
 * @param  {Object|Object[]} elements element or array of elements to be selected
 * @param  {boolean} [add] whether the element(s) should be appended to the current selection, defaults to false
 */
Selection.prototype.select = function(elements, add) {
  var selectedElements = this._selectedElements,
      oldSelection = selectedElements.slice();

  if (!isArray(elements)) {
    elements = elements ? [ elements ] : [];
  }

  // selection may be cleared by passing an empty array or null
  // to the method
  if (add) {
    forEach(elements, function(element) {
      if (selectedElements.indexOf(element) !== -1) {
        // already selected
        return;
      } else {
        selectedElements.push(element);
      }
    });
  } else {
    this._selectedElements = selectedElements = elements.slice();
  }

  this._eventBus.fire('selection.changed', { oldSelection: oldSelection, newSelection: selectedElements });
};

},{"lodash/collection/forEach":204,"lodash/lang/isArray":319}],140:[function(require,module,exports){
'use strict';

var hasPrimaryModifier = require('../../util/Mouse').hasPrimaryModifier;

var find = require('lodash/collection/find');


function SelectionBehavior(eventBus, selection, canvas, elementRegistry) {

  eventBus.on('create.end', 500, function(e) {

    // select the created shape after a
    // successful create operation
    if (e.context.canExecute) {
      selection.select(e.context.shape);
    }
  });

  eventBus.on('connect.end', 500, function(e) {

    // select the connect end target
    // after a connect operation
    if (e.context.canExecute && e.context.target) {
      selection.select(e.context.target);
    }
  });

  eventBus.on('shape.move.end', 500, function(e) {
    var previousSelection = e.previousSelection || [];

    var shape = elementRegistry.get(e.context.shape.id);

    // make sure at least the main moved element is being
    // selected after a move operation
    var inSelection = find(previousSelection, function(selectedShape) {
      return shape.id === selectedShape.id;
    });

    if (!inSelection) {
      selection.select(shape);
    }
  });

  // Shift + click selection
  eventBus.on('element.click', function(event) {

    var element = event.element;

    // do not select the root element
    // or connections
    if (element === canvas.getRootElement()) {
      element = null;
    }

    var isSelected = selection.isSelected(element),
        isMultiSelect = selection.get().length > 1;

    // mouse-event: SELECTION_KEY
    var add = hasPrimaryModifier(event);

    // select OR deselect element in multi selection
    if (isSelected && isMultiSelect) {
      if (add) {
        return selection.deselect(element);
      } else {
        return selection.select(element);
      }
    } else
    if (!isSelected) {
      selection.select(element, add);
    } else {
      selection.deselect(element);
    }
  });
}

SelectionBehavior.$inject = [ 'eventBus', 'selection', 'canvas', 'elementRegistry' ];
module.exports = SelectionBehavior;

},{"../../util/Mouse":176,"lodash/collection/find":203}],141:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var MARKER_HOVER = 'hover',
    MARKER_SELECTED = 'selected';


/**
 * A plugin that adds a visible selection UI to shapes and connections
 * by appending the <code>hover</code> and <code>selected</code> classes to them.
 *
 * @class
 *
 * Makes elements selectable, too.
 *
 * @param {EventBus} events
 * @param {SelectionService} selection
 * @param {Canvas} canvas
 */
function SelectionVisuals(events, canvas, selection, styles) {

  this._multiSelectionBox = null;

  function addMarker(e, cls) {
    canvas.addMarker(e, cls);
  }

  function removeMarker(e, cls) {
    canvas.removeMarker(e, cls);
  }

  events.on('element.hover', function(event) {
    addMarker(event.element, MARKER_HOVER);
  });

  events.on('element.out', function(event) {
    removeMarker(event.element, MARKER_HOVER);
  });

  events.on('selection.changed', function(event) {

    function deselect(s) {
      removeMarker(s, MARKER_SELECTED);
    }

    function select(s) {
      addMarker(s, MARKER_SELECTED);
    }

    var oldSelection = event.oldSelection,
        newSelection = event.newSelection;

    forEach(oldSelection, function(e) {
      if (newSelection.indexOf(e) === -1) {
        deselect(e);
      }
    });

    forEach(newSelection, function(e) {
      if (oldSelection.indexOf(e) === -1) {
        select(e);
      }
    });
  });
}

SelectionVisuals.$inject = [
  'eventBus',
  'canvas',
  'selection',
  'styles'
];

module.exports = SelectionVisuals;

},{"lodash/collection/forEach":204}],142:[function(require,module,exports){
module.exports = {
  __init__: [ 'selectionVisuals', 'selectionBehavior' ],
  __depends__: [
    require('../interaction-events'),
    require('../outline')
  ],
  selection: [ 'type', require('./Selection') ],
  selectionVisuals: [ 'type', require('./SelectionVisuals') ],
  selectionBehavior: [ 'type', require('./SelectionBehavior') ]
};

},{"../interaction-events":91,"../outline":124,"./Selection":139,"./SelectionBehavior":140,"./SelectionVisuals":141}],143:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var snapTo = require('./SnapUtil').snapTo;


/**
 * A snap context, containing the (possibly incomplete)
 * mappings of drop targets (to identify the snapping)
 * to computed snap points.
 */
function SnapContext() {

  /**
   * Map<String, SnapPoints> mapping drop targets to
   * a list of possible snappings.
   *
   * @type {Object}
   */
  this._targets = {};

  /**
   * Map<String, Point> initial positioning of element
   * regarding various snap directions.
   *
   * @type {Object}
   */
  this._snapOrigins = {};

  /**
   * List of snap locations
   *
   * @type {Array<String>}
   */
  this._snapLocations = [];

  /**
   * Map<String, Array<Point>> of default snapping locations
   *
   * @type {Object}
   */
  this._defaultSnaps = {};
}


SnapContext.prototype.getSnapOrigin = function(snapLocation) {
  return this._snapOrigins[snapLocation];
};


SnapContext.prototype.setSnapOrigin = function(snapLocation, initialValue) {
  this._snapOrigins[snapLocation] = initialValue;

  if (this._snapLocations.indexOf(snapLocation) === -1) {
    this._snapLocations.push(snapLocation);
  }
};


SnapContext.prototype.addDefaultSnap = function(type, point) {

  var snapValues = this._defaultSnaps[type];

  if (!snapValues) {
    snapValues = this._defaultSnaps[type] = [];
  }

  snapValues.push(point);
};

/**
 * Return a number of initialized snaps, i.e. snap locations such as
 * top-left, mid, bottom-right and so forth.
 *
 * @return {Array<String>} snapLocations
 */
SnapContext.prototype.getSnapLocations = function() {
  return this._snapLocations;
};

/**
 * Set the snap locations for this context.
 *
 * The order of locations determines precedence.
 *
 * @param {Array<String>} snapLocations
 */
SnapContext.prototype.setSnapLocations = function(snapLocations) {
  this._snapLocations = snapLocations;
};

/**
 * Get snap points for a given target
 *
 * @param {Element|String} target
 */
SnapContext.prototype.pointsForTarget = function(target) {

  var targetId = target.id || target;

  var snapPoints = this._targets[targetId];

  if (!snapPoints) {
    snapPoints = this._targets[targetId] = new SnapPoints();
    snapPoints.initDefaults(this._defaultSnaps);
  }

  return snapPoints;
};

module.exports = SnapContext;


/**
 * Creates the snap points and initializes them with the
 * given default values.
 *
 * @param {Object<String, Array<Point>>} [defaultPoints]
 */
function SnapPoints(defaultSnaps) {

  /**
   * Map<String, Map<(x|y), Array<Number>>> mapping snap locations,
   * i.e. top-left, bottom-right, center to actual snap values.
   *
   * @type {Object}
   */
  this._snapValues = {};
}

SnapPoints.prototype.add = function(snapLocation, point) {

  var snapValues = this._snapValues[snapLocation];

  if (!snapValues) {
    snapValues = this._snapValues[snapLocation] = { x: [], y: [] };
  }

  if (snapValues.x.indexOf(point.x) === -1) {
    snapValues.x.push(point.x);
  }

  if (snapValues.y.indexOf(point.y) === -1) {
    snapValues.y.push(point.y);
  }
};


SnapPoints.prototype.snap = function(point, snapLocation, axis, tolerance) {
  var snappingValues = this._snapValues[snapLocation];
  
  return snappingValues && snapTo(point[axis], snappingValues[axis], tolerance);
};

/**
 * Initialize a number of default snapping points.
 *
 * @param  {Object} defaultSnaps
 */
SnapPoints.prototype.initDefaults = function(defaultSnaps) {

  var self = this;

  forEach(defaultSnaps || {}, function(snapPoints, snapLocation) {
    forEach(snapPoints, function(point) {
      self.add(snapLocation, point);
    });
  });
};
},{"./SnapUtil":144,"lodash/collection/forEach":204}],144:[function(require,module,exports){
'use strict';

var abs = Math.abs,
    round = Math.round;


/**
 * Snap value to a collection of reference values.
 *
 * @param  {Number} value
 * @param  {Array<Number>} values
 * @param  {Number} [tolerance=10]
 *
 * @return {Number} the value we snapped to or null, if none snapped
 */
function snapTo(value, values, tolerance) {
  tolerance = tolerance === undefined ? 10 : tolerance;

  var idx, snapValue;

  for (idx = 0; idx < values.length; idx++) {
    snapValue = values[idx];

    if (abs(snapValue - value) <= tolerance) {
      return snapValue;
    }
  }
}

module.exports.snapTo = snapTo;


function topLeft(bounds) {
  return {
    x: bounds.x,
    y: bounds.y
  };
}

module.exports.topLeft = topLeft;


function mid(bounds, defaultValue) {

  if (!bounds || isNaN(bounds.x) || isNaN(bounds.y)) {
    return defaultValue;
  }

  return {
    x: round(bounds.x + bounds.width / 2),
    y: round(bounds.y + bounds.height / 2)
  };
}

module.exports.mid = mid;


function bottomRight(bounds) {
  return {
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height
  };
}

module.exports.bottomRight = bottomRight;


/**
 * Retrieve the snap state of the given event.
 *
 * @param  {Event} event
 * @param  {String} axis
 *
 * @return {Boolean} the snapped state
 *
 */
module.exports.isSnapped = function(event, axis) {
  var snapped = event.snapped;

  if (!snapped) {
    return false;
  }

  if (typeof axis === 'string') {
    return snapped[axis];
  }

  return snapped.x && snapped.y;
};

/**
 * Set the given event as snapped.
 *
 * This method may change the x and/or y position of the shape
 * from the given event!
 *
 * @param {Event} event
 * @param {String} axis
 * @param {Number|Boolean} value
 *
 * @return {Number} old value
 */
module.exports.setSnapped = function(event, axis, value) {
  if (typeof axis !== 'string') {
    throw new Error('axis must be in [x, y]');
  }

  if (typeof value !== 'number' && value !== false) {
    throw new Error('value must be Number or false');
  }

  var delta,
      previousValue = event[axis];

  var snapped = event.snapped = (event.snapped || {});


  if (value === false) {
    snapped[axis] = false;
  } else {
    snapped[axis] = true;

    delta = value - previousValue;

    event[axis] += delta;
    event['d' + axis] += delta;
  }

  return previousValue;
};
},{}],145:[function(require,module,exports){
'use strict';

var filter = require('lodash/collection/filter'),
    forEach = require('lodash/collection/forEach'),
    debounce = require('lodash/function/debounce');

var mid = require('./SnapUtil').mid;

var SnapContext = require('./SnapContext');

var SnapUtil = require('./SnapUtil');

var HIGHER_PRIORITY = 1250;

var isSnapped = SnapUtil.isSnapped,
    setSnapped = SnapUtil.setSnapped;

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClasses = require('tiny-svg/lib/classes'),
    svgCreate = require('tiny-svg/lib/create');


/**
 * A general purpose snapping component for diagram elements.
 *
 * @param {EventBus} eventBus
 * @param {Canvas} canvas
 */
function Snapping(eventBus, canvas) {

  this._canvas = canvas;

  var self = this;

  eventBus.on([ 'shape.move.start', 'create.start' ], function(event) {
    self.initSnap(event);
  });

  eventBus.on([ 'shape.move.move', 'shape.move.end', 'create.move', 'create.end' ], HIGHER_PRIORITY, function(event) {

    if (event.originalEvent && event.originalEvent.ctrlKey) {
      return;
    }

    if (isSnapped(event)) {
      return;
    }

    self.snap(event);
  });

  eventBus.on([ 'shape.move.cleanup', 'create.cleanup' ], function(event) {
    self.hide();
  });

  // delay hide by 1000 seconds since last match
  this._asyncHide = debounce(this.hide, 1000);
}

Snapping.$inject = [ 'eventBus', 'canvas' ];

module.exports = Snapping;


Snapping.prototype.initSnap = function(event) {

  var context = event.context,
      shape = context.shape,
      snapContext = context.snapContext;

  if (!snapContext) {
    snapContext = context.snapContext = new SnapContext();
  }

  var snapMid = mid(shape, event);

  snapContext.setSnapOrigin('mid', {
    x: snapMid.x - event.x,
    y: snapMid.y - event.y
  });

  return snapContext;
};


Snapping.prototype.snap = function(event) {

  var context = event.context,
      snapContext = context.snapContext,
      shape = context.shape,
      target = context.target,
      snapLocations = snapContext.getSnapLocations();

  if (!target) {
    return;
  }

  var snapPoints = snapContext.pointsForTarget(target);

  if (!snapPoints.initialized) {
    this.addTargetSnaps(snapPoints, shape, target);

    snapPoints.initialized = true;
  }


  var snapping = {
    x: isSnapped(event, 'x'),
    y: isSnapped(event, 'y')
  };


  forEach(snapLocations, function(location) {

    var snapOrigin = snapContext.getSnapOrigin(location);

    var snapCurrent = {
      x: event.x + snapOrigin.x,
      y: event.y + snapOrigin.y
    };

    // snap on both axis, if not snapped already
    forEach([ 'x', 'y' ], function(axis) {
      var locationSnapping;

      if (!snapping[axis]) {
        locationSnapping = snapPoints.snap(snapCurrent, location, axis, 7);

        if (locationSnapping !== undefined) {
          snapping[axis] = {
            value: locationSnapping,
            originValue: locationSnapping - snapOrigin[axis]
          };
        }
      }
    });

    // no more need to snap, drop out of interation
    if (snapping.x && snapping.y) {
      return false;
    }
  });


  // show snap visuals

  this.showSnapLine('vertical', snapping.x && snapping.x.value);
  this.showSnapLine('horizontal', snapping.y && snapping.y.value);


  // adjust event { x, y, dx, dy } and mark as snapping
  forEach([ 'x', 'y' ], function(axis) {

    var axisSnapping = snapping[axis];

    if (typeof axisSnapping === 'object') {
      // set as snapped and adjust the x and/or y position of the event
      setSnapped(event, axis, axisSnapping.originValue);
    }
  });
};


Snapping.prototype._createLine = function(orientation) {

  var root = this._canvas.getLayer('snap');

  // var line = root.path('M0,0 L0,0').addClass('djs-snap-line');

  var line = svgCreate('path');
  svgAttr(line, { d: 'M0,0 L0,0' });
  svgClasses(line).add('djs-snap-line');

  svgAppend(root, line);

  return {
    update: function(position) {

      if (typeof position !== 'number') {
        svgAttr(line, { display: 'none' });
      } else {
        if (orientation === 'horizontal') {
          svgAttr(line, {
            d: 'M-100000,' + position + ' L+100000,' + position,
            display: ''
          });
        } else {
          svgAttr(line, {
            d: 'M ' + position + ',-100000 L ' + position + ', +100000',
            display: ''
          });
        }
      }
    }
  };
};


Snapping.prototype._createSnapLines = function() {

  this._snapLines = {
    horizontal: this._createLine('horizontal'),
    vertical: this._createLine('vertical')
  };
};

Snapping.prototype.showSnapLine = function(orientation, position) {

  var line = this.getSnapLine(orientation);

  if (line) {
    line.update(position);
  }

  this._asyncHide();
};

Snapping.prototype.getSnapLine = function(orientation) {
  if (!this._snapLines) {
    this._createSnapLines();
  }

  return this._snapLines[orientation];
};

Snapping.prototype.hide = function() {
  forEach(this._snapLines, function(l) {
    l.update();
  });
};

Snapping.prototype.addTargetSnaps = function(snapPoints, shape, target) {

  var siblings = this.getSiblings(shape, target);

  forEach(siblings, function(s) {
    snapPoints.add('mid', mid(s));
  });

};

Snapping.prototype.getSiblings = function(element, target) {

  // snap to all non connection siblings
  return target && filter(target.children, function(e) {
    return !e.hidden && !e.labelTarget && !e.waypoints && e.host !== element && e !== element;
  });
};

},{"./SnapContext":143,"./SnapUtil":144,"lodash/collection/filter":202,"lodash/collection/forEach":204,"lodash/function/debounce":213,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/create":357}],146:[function(require,module,exports){
'use strict';

var SpaceUtil = require('./SpaceUtil');

var Cursor = require('../../util/Cursor');

var hasPrimaryModifier = require('../../util/Mouse').hasPrimaryModifier;

var abs = Math.abs,
    round = Math.round;

var HIGH_PRIORITY = 1500,
    SPACE_TOOL_CURSOR = 'crosshair';

var AXIS_TO_DIMENSION = { x: 'width', y: 'height' },
    AXIS_INVERTED = { x: 'y', y: 'x' };

var getAllChildren = require('../../util/Elements').selfAndAllChildren;

var assign = require('lodash/object/assign'),
    forEach = require('lodash/collection/forEach');


/**
 * A tool that allows users to create and remove space in a diagram.
 *
 * The tool needs to be activated manually via {@link SpaceTool#activate(MouseEvent)}.
 */
function SpaceTool(eventBus, dragging, canvas, modeling, rules, toolManager) {

  this._canvas = canvas;
  this._dragging = dragging;
  this._modeling = modeling;
  this._rules = rules;
  this._toolManager = toolManager;

  var self = this;

  toolManager.registerTool('space', {
    tool: 'spaceTool.selection',
    dragging: 'spaceTool'
  });

  eventBus.on('spaceTool.selection.end', function(event) {
    var target = event.originalEvent.target;

    // only reactive on diagram click
    // on some occasions, event.hover is not set and we have to check if the target is an svg
    if (!event.hover && !(target instanceof SVGElement)) {
      return;
    }

    eventBus.once('spaceTool.selection.ended', function() {
      self.activateMakeSpace(event.originalEvent);
    });
  });


  eventBus.on('spaceTool.move', HIGH_PRIORITY , function(event) {

    var context = event.context;

    if (!context.initialized) {
      context.initialized = self.initializeMakeSpace(event, context);
    }
  });


  eventBus.on('spaceTool.end', function(event) {

    var context = event.context,
        axis = context.axis,
        direction = context.direction,
        movingShapes = context.movingShapes,
        resizingShapes = context.resizingShapes;

    // skip if create space has not been initialized yet
    if (!context.initialized) {
      return;
    }

    var delta = { x: round(event.dx), y: round(event.dy) };
    delta[ AXIS_INVERTED[ axis ] ] = 0;

    var insideBounds = true;

    // check if the space tool cursor is inside of bounds of
    // any of the shapes that would be resized.
    forEach(resizingShapes, function(shape) {

      if ((direction === 'w' && event.x > shape.x + shape.width) ||
          (direction === 'e' && event.x < shape.x) ||
          (direction === 'n' && event.y > shape.y + shape.height) ||
          (direction === 's' && event.y < shape.y)) {

        insideBounds = false;
        return;
      }
    });

    if (insideBounds) {
      // make space only if the cursor is inside bounds
      self.makeSpace(movingShapes, resizingShapes, delta, direction);
    }

    eventBus.once('spaceTool.ended', function(event) {
      // reactivate space tool after usage
      self.activateSelection(event.originalEvent, true, true);
    });

  });
}

SpaceTool.$inject = [ 'eventBus', 'dragging', 'canvas', 'modeling', 'rules', 'toolManager' ];

module.exports = SpaceTool;


/**
 * Activate space tool selection
 *
 * @param  {MouseEvent} event
 * @param  {Boolean} autoActivate
 */
SpaceTool.prototype.activateSelection = function(event, autoActivate, reactivate) {
  this._dragging.init(event, 'spaceTool.selection', {
    trapClick: false,
    cursor: SPACE_TOOL_CURSOR,
    autoActivate: autoActivate,
    data: {
      context: {
        reactivate: reactivate
      }
    }
  });
};

/**
 * Activate make space
 *
 * @param  {MouseEvent} event
 */
SpaceTool.prototype.activateMakeSpace = function(event) {
  this._dragging.init(event, 'spaceTool', {
    autoActivate: true,
    cursor: SPACE_TOOL_CURSOR,
    data: {
      context: {}
    }
  });
};

/**
 * Actually make space on the diagram
 *
 * @param  {Array<djs.model.Shape>} movingShapes
 * @param  {Array<djs.model.Shape>} resizingShapes
 * @param  {Point} delta
 * @param  {String} direction
 */
SpaceTool.prototype.makeSpace = function(movingShapes, resizingShapes, delta, direction) {
  return this._modeling.createSpace(movingShapes, resizingShapes, delta, direction);
};

/**
 * Initialize make space and return true if that was successful.
 *
 * @param {Event} event
 * @param {Object} context
 *
 * @return {Boolean} true, if successful
 */
SpaceTool.prototype.initializeMakeSpace = function(event, context) {

  var axis = abs(event.dx) > abs(event.dy) ? 'x' : 'y',
      offset = event['d' + axis],
      // start point of create space operation
      spacePos = event[axis] - offset;

  if (abs(offset) < 5) {
    return false;
  }

  // invert the offset in order to remove space when moving left
  if (offset < 0) {
    offset *= -1;
  }

  // inverts the offset to choose the shapes
  // on the opposite side of the resizer if
  // a key modifier is pressed
  if (hasPrimaryModifier(event)) {
    offset *= -1;
  }

  var rootShape = this._canvas.getRootElement();

  var allShapes = getAllChildren(rootShape, true);

  var adjustments = this.calculateAdjustments(allShapes, axis, offset, spacePos);

  // store data in context
  assign(context, adjustments, {
    axis: axis,
    direction: SpaceUtil.getDirection(axis, offset)
  });

  Cursor.set('resize-' + (axis === 'x' ? 'ew' : 'ns'));

  return true;
};

/**
 * Calculate adjustments needed when making space
 *
 * @param  {Array<djs.model.Shape>} elements
 * @param  {String} axis
 * @param  {Number} offset
 * @param  {Number} spacePos
 *
 * @return {Object}
 */
SpaceTool.prototype.calculateAdjustments = function(elements, axis, offset, spacePos) {

  var movingShapes = [],
      resizingShapes = [];

  var rules = this._rules;

  // collect all elements that need to be moved _AND_
  // resized given on the initial create space position
  elements.forEach(function(shape) {

    var shapeStart = shape[axis],
        shapeEnd = shapeStart + shape[AXIS_TO_DIMENSION[axis]];

    // checking if it's root
    if (!shape.parent) {
      return;
    }

    // checking if it's a shape
    if (shape.waypoints) {
      return;
    }

    // shape after spacePos
    if (offset > 0 && shapeStart > spacePos) {
      return movingShapes.push(shape);
    }

    // shape before spacePos
    if (offset < 0 && shapeEnd < spacePos) {
      return movingShapes.push(shape);
    }

    // shape on top of spacePos, resize only if allowed
    if (shapeStart < spacePos &&
        shapeEnd > spacePos &&
        rules.allowed('shape.resize', { shape: shape })) {

      return resizingShapes.push(shape);
    }
  });

  return {
    movingShapes: movingShapes,
    resizingShapes: resizingShapes
  };
};

SpaceTool.prototype.toggle = function() {
  if (this.isActive()) {
    this._dragging.cancel();
  } else {
    this.activateSelection();
  }
};

SpaceTool.prototype.isActive = function() {
  var context = this._dragging.context();

  return context && /^spaceTool/.test(context.prefix);
};

},{"../../util/Cursor":168,"../../util/Elements":169,"../../util/Mouse":176,"./SpaceUtil":148,"lodash/collection/forEach":204,"lodash/object/assign":328}],147:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var MARKER_DRAGGING = 'djs-dragging',
    MARKER_RESIZING = 'djs-resizing';

var LOW_PRIORITY = 250;

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgClasses = require('tiny-svg/lib/classes'),
    svgCreate = require('tiny-svg/lib/create'),
    svgRemove = require('tiny-svg/lib/remove');

var translate = require('../../util/SvgTransformUtil').translate;


/**
 * Provides previews for selecting/moving/resizing shapes when creating/removing space.
 *
 * @param {EventBus} eventBus
 * @param {ElementRegistry} elementRegistry
 * @param {Canvas} canvas
 * @param {Styles} styles
 */

function SpaceToolPreview(eventBus, elementRegistry, canvas, styles, previewSupport) {

  function addPreviewGfx(collection, dragGroup) {
    forEach(collection, function(element) {
      previewSupport.addDragger(element, dragGroup);

      canvas.addMarker(element, MARKER_DRAGGING);
    });
  }

  // add crosshair
  eventBus.on('spaceTool.selection.start', function(event) {
    var space = canvas.getLayer('space'),
        context = event.context;

    var orientation = {
      x: 'M 0,-10000 L 0,10000',
      y: 'M -10000,0 L 10000,0'
    };

    var crosshairGroup = svgCreate('g');
    svgAttr(crosshairGroup, styles.cls('djs-crosshair-group', [ 'no-events' ]));

    svgAppend(space, crosshairGroup);

    // horizontal path
    var pathX = svgCreate('path');
    svgAttr(pathX, 'd', orientation.x);
    svgClasses(pathX).add('djs-crosshair');

    svgAppend(crosshairGroup, pathX);

    // vertical path
    var pathY = svgCreate('path');
    svgAttr(pathY, 'd', orientation.y);
    svgClasses(pathY).add('djs-crosshair');

    svgAppend(crosshairGroup, pathY);

    context.crosshairGroup = crosshairGroup;
  });

  // update crosshair
  eventBus.on('spaceTool.selection.move', function(event) {
    var crosshairGroup = event.context.crosshairGroup;

    translate(crosshairGroup, event.x, event.y);
  });

  // remove crosshair
  eventBus.on('spaceTool.selection.cleanup', function(event) {
    var context = event.context,
        crosshairGroup = context.crosshairGroup;

    if (crosshairGroup) {
      svgRemove(crosshairGroup);
    }
  });

  // add and update move/resize previews
  eventBus.on('spaceTool.move', LOW_PRIORITY, function(event) {

    var context = event.context,
        line = context.line,
        axis = context.axis,
        movingShapes = context.movingShapes,
        resizingShapes = context.resizingShapes;

    if (!context.initialized) {
      return;
    }

    if (!context.dragGroup) {
      var spaceLayer = canvas.getLayer('space');

      line = svgCreate('path');
      svgAttr(line, 'd', 'M0,0 L0,0');
      svgClasses(line).add('djs-crosshair');

      svgAppend(spaceLayer, line);

      context.line  = line;

      var dragGroup = svgCreate('g');
      svgAttr(dragGroup, styles.cls('djs-drag-group', [ 'no-events' ]));

      svgAppend(canvas.getDefaultLayer(), dragGroup);

      // shapes
      addPreviewGfx(movingShapes, dragGroup);

      // connections
      var movingConnections = context.movingConnections = elementRegistry.filter(function(element) {
        var sourceIsMoving = false;

        forEach(movingShapes, function(shape) {
          forEach(shape.outgoing, function(connection) {
            if (element === connection) {
              sourceIsMoving = true;
            }
          });
        });

        var targetIsMoving = false;

        forEach(movingShapes, function(shape) {
          forEach(shape.incoming, function(connection) {
            if (element === connection) {
              targetIsMoving = true;
            }
          });
        });

        var sourceIsResizing = false;

        forEach(resizingShapes, function(shape) {
          forEach(shape.outgoing, function(connection) {
            if (element === connection) {
              sourceIsResizing = true;
            }
          });
        });

        var targetIsResizing = false;

        forEach(resizingShapes, function(shape) {
          forEach(shape.incoming, function(connection) {
            if (element === connection) {
              targetIsResizing = true;
            }
          });
        });

        return isConnection(element)
          && (sourceIsMoving || sourceIsResizing)
          && (targetIsMoving || targetIsResizing);
      });


      addPreviewGfx(movingConnections, dragGroup);

      context.dragGroup = dragGroup;
    }

    if (!context.frameGroup) {
      var frameGroup = svgCreate('g');
      svgAttr(frameGroup, styles.cls('djs-frame-group', [ 'no-events' ]));

      svgAppend(canvas.getDefaultLayer(), frameGroup);

      var frames = [];

      forEach(resizingShapes, function(shape) {
        var frame = previewSupport.addFrame(shape, frameGroup);

        frames.push({
          element: frame,
          initialWidth: frame.getBBox().width,
          initialHeight: frame.getBBox().height
        });

        canvas.addMarker(shape, MARKER_RESIZING);
      });

      context.frameGroup = frameGroup;
      context.frames = frames;
    }

    var orientation = {
      x: 'M' + event.x + ', -10000 L' + event.x + ', 10000',
      y: 'M -10000, ' + event.y + ' L 10000, ' + event.y
    };

    svgAttr(line, { path: orientation[ axis ], display: '' });

    var opposite = { x: 'y', y: 'x' };
    var delta = { x: event.dx, y: event.dy };
    delta[ opposite[ context.axis ] ] = 0;

    // update move previews
    translate(context.dragGroup, delta.x, delta.y);

    // update resize previews
    forEach(context.frames, function(frame) {
      if (frame.initialWidth + delta.x > 5) {
        svgAttr(frame.element, { width: frame.initialWidth + delta.x });
      }

      if (frame.initialHeight + delta.y > 5) {
        svgAttr(frame.element, { height: frame.initialHeight + delta.y });
      }
    });

  });

  // remove move/resize previews
  eventBus.on('spaceTool.cleanup', function(event) {

    var context = event.context,
        movingShapes = context.movingShapes,
        movingConnections = context.movingConnections,
        resizingShapes = context.resizingShapes,
        line = context.line,
        dragGroup = context.dragGroup,
        frameGroup = context.frameGroup;

    // moving shapes
    forEach(movingShapes, function(shape) {
      canvas.removeMarker(shape, MARKER_DRAGGING);
    });

    // moving connections
    forEach(movingConnections, function(connection) {
      canvas.removeMarker(connection, MARKER_DRAGGING);
    });

    if (dragGroup) {
      svgRemove(line);
      svgRemove(dragGroup);
    }

    forEach(resizingShapes, function(shape) {
      canvas.removeMarker(shape, MARKER_RESIZING);
    });

    if (frameGroup) {
      svgRemove(frameGroup);
    }
  });
}

SpaceToolPreview.$inject = [ 'eventBus', 'elementRegistry', 'canvas', 'styles', 'previewSupport' ];

module.exports = SpaceToolPreview;

////////// helpers //////////

/**
 * Checks if an element is a connection.
 */
function isConnection(element) {
  return element.waypoints;
}

},{"../../util/SvgTransformUtil":181,"lodash/collection/forEach":204,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/classes":354,"tiny-svg/lib/create":357,"tiny-svg/lib/remove":359}],148:[function(require,module,exports){
'use strict';

/**
 * Get Resize direction given axis + offset
 *
 * @param {String} axis (x|y)
 * @param {Number} offset
 *
 * @return {String} (e|w|n|s)
 */
function getDirection(axis, offset) {

  if (axis === 'x') {
    if (offset > 0) {
      return 'e';
    }

    if (offset < 0) {
      return 'w';
    }
  }

  if (axis === 'y') {
    if (offset > 0) {
      return 's';
    }

    if (offset < 0) {
      return 'n';
    }
  }

  return null;
}

module.exports.getDirection = getDirection;

/**
 * Resize the given bounds by the specified delta from a given anchor point.
 *
 * @param {Bounds} bounds the bounding box that should be resized
 * @param {String} direction in which the element is resized (n, s, e, w)
 * @param {Point} delta of the resize operation
 *
 * @return {Bounds} resized bounding box
 */
module.exports.resizeBounds = function(bounds, direction, delta) {

  var dx = delta.x,
      dy = delta.y;

  switch (direction) {

  case 'n':
    return {
      x: bounds.x,
      y: bounds.y + dy,
      width: bounds.width,
      height: bounds.height - dy
    };

  case 's':
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height + dy
    };

  case 'w':
    return {
      x: bounds.x + dx,
      y: bounds.y,
      width: bounds.width - dx,
      height: bounds.height
    };

  case 'e':
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width + dx,
      height: bounds.height
    };

  default:
    throw new Error('unrecognized direction: ' + direction);
  }
};
},{}],149:[function(require,module,exports){
'use strict';

module.exports = {
  __init__: ['spaceToolPreview'],
  __depends__: [
    require('../dragging'),
    require('../rules'),
    require('../tool-manager'),
    require('../preview-support')
  ],
  spaceTool: ['type', require('./SpaceTool')],
  spaceToolPreview: ['type', require('./SpaceToolPreview') ]
};

},{"../dragging":87,"../preview-support":130,"../rules":138,"../tool-manager":151,"./SpaceTool":146,"./SpaceToolPreview":147}],150:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach');

var LOW_PRIORITY = 250;

/**
 * The tool manager acts as middle-man between the available tool's and the Palette,
 * it takes care of making sure that the correct active state is set.
 *
 * @param  {Object}    eventBus
 * @param  {Object}    dragging
 */
function ToolManager(eventBus, dragging) {
  this._eventBus = eventBus;
  this._dragging = dragging;

  this._tools = [];
  this._active = null;
}

ToolManager.$inject = [ 'eventBus', 'dragging' ];

module.exports = ToolManager;

ToolManager.prototype.registerTool = function(name, events) {
  var tools = this._tools;

  if (!events) {
    throw new Error('A tool has to be registered with it\'s "events"');
  }

  tools.push(name);

  this.bindEvents(name, events);
};

ToolManager.prototype.isActive = function(tool) {
  return tool && this._active === tool;
};

ToolManager.prototype.length = function(tool) {
  return this._tools.length;
};

ToolManager.prototype.setActive = function(tool) {
  var eventBus = this._eventBus;

  if (this._active !== tool) {
    this._active = tool;

    eventBus.fire('tool-manager.update', { tool: tool });
  }
};

ToolManager.prototype.bindEvents = function(name, events) {
  var eventBus = this._eventBus,
      dragging = this._dragging;

  var eventsToRegister = [];

  eventBus.on(events.tool + '.init', function(event) {
    var context = event.context;

    // Active tools that want to reactivate themselves must do this explicitly
    if (!context.reactivate && this.isActive(name)) {
      this.setActive(null);

      dragging.cancel();
      return;
    }

    this.setActive(name);

  }, this);

  // Todo[ricardo]: add test cases
  forEach(events, function(event) {
    eventsToRegister.push(event + '.ended');
    eventsToRegister.push(event + '.canceled');
  });

  eventBus.on(eventsToRegister, LOW_PRIORITY, function(event) {
    var originalEvent = event.originalEvent;

    // We defer the de-activation of the tool to the .activate phase,
    // so we're able to check if we want to toggle off the current active tool or switch to a new one
    if (!this._active ||
        (originalEvent && originalEvent.target.parentNode.getAttribute('data-group') === 'tools')) {
      return;
    }

    this.setActive(null);
  }, this);
};

},{"lodash/collection/forEach":204}],151:[function(require,module,exports){
'use strict';

module.exports = {
  __depends__: [ require('../dragging') ],
  __init__: [ 'toolManager' ],
  toolManager: [ 'type', require('./ToolManager') ]
};

},{"../dragging":87,"./ToolManager":150}],152:[function(require,module,exports){
'use strict';

var isString = require('lodash/lang/isString'),
    assign = require('lodash/object/assign'),
    forEach = require('lodash/collection/forEach');

var domify = require('min-dom/lib/domify'),
    domAttr = require('min-dom/lib/attr'),
    domClasses = require('min-dom/lib/classes'),
    domRemove = require('min-dom/lib/remove'),
    domDelegate = require('min-dom/lib/delegate');


// document wide unique tooltip ids
var ids = new (require('../../util/IdGenerator'))('tt');


function createRoot(parent) {
  var root = domify('<div class="djs-tooltip-container" style="position: absolute; width: 0; height: 0;" />');
  parent.insertBefore(root, parent.firstChild);

  return root;
}


function setPosition(el, x, y) {
  assign(el.style, { left: x + 'px', top: y + 'px' });
}

function setVisible(el, visible) {
  el.style.display = visible === false ? 'none' : '';
}


var tooltipClass = 'djs-tooltip',
    tooltipSelector = '.' + tooltipClass;

/**
 * A service that allows users to render tool tips on the diagram.
 *
 * The tooltip service will take care of updating the tooltip positioning
 * during navigation + zooming.
 *
 * @example
 *
 * ```javascript
 *
 * // add a pink badge on the top left of the shape
 * tooltips.add({
 *   position: {
 *     x: 50,
 *     y: 100
 *   },
 *   html: '<div style="width: 10px; background: fuchsia; color: white;">0</div>'
 * });
 *
 * // or with optional life span
 * tooltips.add({
 *   position: {
 *     top: -5,
 *     left: -5
 *   },
 *   html: '<div style="width: 10px; background: fuchsia; color: white;">0</div>',
 *   ttl: 2000
 * });
 *
 * // remove a tool tip
 * var id = tooltips.add(...);
 * tooltips.remove(id);
 * ```
 *
 * @param {EventBus} eventBus
 * @param {Canvas} canvas
 */
function Tooltips(eventBus, canvas) {

  this._eventBus = eventBus;
  this._canvas = canvas;

  this._ids = ids;

  this._tooltipDefaults = {
    show: {
      minZoom: 0.7,
      maxZoom: 5.0
    }
  };

  /**
   * Mapping tooltipId -> tooltip
   */
  this._tooltips = {};

  // root html element for all tooltips
  this._tooltipRoot = createRoot(canvas.getContainer());


  var self = this;

  domDelegate.bind(this._tooltipRoot, tooltipSelector, 'mousedown', function(event) {
    event.stopPropagation();
  });

  domDelegate.bind(this._tooltipRoot, tooltipSelector, 'mouseover', function(event) {
    self.trigger('mouseover', event);
  });

  domDelegate.bind(this._tooltipRoot, tooltipSelector, 'mouseout', function(event) {
    self.trigger('mouseout', event);
  });

  this._init();
}


Tooltips.$inject = [ 'eventBus', 'canvas' ];

module.exports = Tooltips;


/**
 * Adds a HTML tooltip to the diagram
 *
 * @param {Object}               tooltip   the tooltip configuration
 *
 * @param {String|DOMElement}    tooltip.html                 html element to use as an tooltip
 * @param {Object}               [tooltip.show]               show configuration
 * @param {Number}               [tooltip.show.minZoom]       minimal zoom level to show the tooltip
 * @param {Number}               [tooltip.show.maxZoom]       maximum zoom level to show the tooltip
 * @param {Object}               tooltip.position             where to attach the tooltip
 * @param {Number}               [tooltip.position.left]      relative to element bbox left attachment
 * @param {Number}               [tooltip.position.top]       relative to element bbox top attachment
 * @param {Number}               [tooltip.position.bottom]    relative to element bbox bottom attachment
 * @param {Number}               [tooltip.position.right]     relative to element bbox right attachment
 * @param {Number}               [tooltip.timeout=-1]
 *
 * @return {String}              id that may be used to reference the tooltip for update or removal
 */
Tooltips.prototype.add = function(tooltip) {

  if (!tooltip.position) {
    throw new Error('must specifiy tooltip position');
  }

  if (!tooltip.html) {
    throw new Error('must specifiy tooltip html');
  }

  var id = this._ids.next();

  tooltip = assign({}, this._tooltipDefaults, tooltip, {
    id: id
  });

  this._addTooltip(tooltip);

  if (tooltip.timeout) {
    this.setTimeout(tooltip);
  }

  return id;
};

Tooltips.prototype.trigger = function(action, event) {

  var node = event.delegateTarget || event.target;

  var tooltip = this.get(domAttr(node, 'data-tooltip-id'));

  if (!tooltip) {
    return;
  }

  if (action === 'mouseover' && tooltip.timeout) {
    this.clearTimeout(tooltip);
  }

  if (action === 'mouseout' && tooltip.timeout) {
    // cut timeout after mouse out
    tooltip.timeout = 1000;

    this.setTimeout(tooltip);
  }
};

/**
 * Get a tooltip with the given id
 *
 * @param {String} id
 */
Tooltips.prototype.get = function(id) {

  if (typeof id !== 'string') {
    id = id.id;
  }

  return this._tooltips[id];
};

Tooltips.prototype.clearTimeout = function(tooltip) {

  tooltip = this.get(tooltip);

  if (!tooltip) {
    return;
  }

  var removeTimer = tooltip.removeTimer;

  if (removeTimer) {
    clearTimeout(removeTimer);
    tooltip.removeTimer = null;
  }
};

Tooltips.prototype.setTimeout = function(tooltip) {

  tooltip = this.get(tooltip);

  if (!tooltip) {
    return;
  }

  this.clearTimeout(tooltip);

  var self = this;

  tooltip.removeTimer = setTimeout(function() {
    self.remove(tooltip);
  }, tooltip.timeout);
};

/**
 * Remove an tooltip with the given id
 *
 * @param {String} id
 */
Tooltips.prototype.remove = function(id) {

  var tooltip = this.get(id);

  if (tooltip) {
    domRemove(tooltip.html);
    domRemove(tooltip.htmlContainer);

    delete tooltip.htmlContainer;

    delete this._tooltips[tooltip.id];
  }
};


Tooltips.prototype.show = function() {
  setVisible(this._tooltipRoot);
};


Tooltips.prototype.hide = function() {
  setVisible(this._tooltipRoot, false);
};


Tooltips.prototype._updateRoot = function(viewbox) {
  var a = viewbox.scale || 1;
  var d = viewbox.scale || 1;

  var matrix = 'matrix(' + a + ',0,0,' + d + ',' + (-1 * viewbox.x * a) + ',' + (-1 * viewbox.y * d) + ')';

  this._tooltipRoot.style.transform = matrix;
  this._tooltipRoot.style['-ms-transform'] = matrix;
};


Tooltips.prototype._addTooltip = function(tooltip) {

  var id = tooltip.id,
      html = tooltip.html,
      htmlContainer,
      tooltipRoot = this._tooltipRoot;

  // unwrap jquery (for those who need it)
  if (html.get && html.constructor.prototype.jquery) {
    html = html.get(0);
  }

  // create proper html elements from
  // tooltip HTML strings
  if (isString(html)) {
    html = domify(html);
  }

  htmlContainer = domify('<div data-tooltip-id="' + id + '" class="' + tooltipClass + '" style="position: absolute">');

  htmlContainer.appendChild(html);

  if (tooltip.type) {
    domClasses(htmlContainer).add('djs-tooltip-' + tooltip.type);
  }

  if (tooltip.className) {
    domClasses(htmlContainer).add(tooltip.className);
  }

  tooltip.htmlContainer = htmlContainer;

  tooltipRoot.appendChild(htmlContainer);

  this._tooltips[id] = tooltip;

  this._updateTooltip(tooltip);
};


Tooltips.prototype._updateTooltip = function(tooltip) {

  var position = tooltip.position,
      htmlContainer = tooltip.htmlContainer;

  // update overlay html based on tooltip x, y

  setPosition(htmlContainer, position.x, position.y);
};


Tooltips.prototype._updateTooltipVisibilty = function(viewbox) {

  forEach(this._tooltips, function(tooltip) {
    var show = tooltip.show,
        htmlContainer = tooltip.htmlContainer,
        visible = true;

    if (show) {
      if (show.minZoom > viewbox.scale ||
          show.maxZoom < viewbox.scale) {
        visible = false;
      }

      setVisible(htmlContainer, visible);
    }
  });
};

Tooltips.prototype._init = function() {

  var self = this;

  // scroll/zoom integration

  function updateViewbox(viewbox) {
    self._updateRoot(viewbox);
    self._updateTooltipVisibilty(viewbox);

    self.show();
  }

  this._eventBus.on('canvas.viewbox.changing', function(event) {
    self.hide();
  });

  this._eventBus.on('canvas.viewbox.changed', function(event) {
    updateViewbox(event.viewbox);
  });
};

},{"../../util/IdGenerator":173,"lodash/collection/forEach":204,"lodash/lang/isString":325,"lodash/object/assign":328,"min-dom/lib/attr":338,"min-dom/lib/classes":339,"min-dom/lib/delegate":342,"min-dom/lib/domify":343,"min-dom/lib/remove":347}],153:[function(require,module,exports){
module.exports = {
  __init__: [ 'tooltips' ],
  tooltips: [ 'type', require('./Tooltips') ]
};
},{"./Tooltips":152}],154:[function(require,module,exports){
'use strict';

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgCreate = require('tiny-svg/lib/create');


function TouchFix(canvas, eventBus) {

  var self = this;

  eventBus.on('canvas.init', function(e) {
    self.addBBoxMarker(e.svg);
  });
}

TouchFix.$inject = [ 'canvas', 'eventBus' ];

module.exports = TouchFix;


/**
 * Safari mobile (iOS 7) does not fire touchstart event in <SVG> element
 * if there is no shape between 0,0 and viewport elements origin.
 *
 * So touchstart event is only fired when the <g class="viewport"> element was hit.
 * Putting an element over and below the 'viewport' fixes that behavior.
 */
TouchFix.prototype.addBBoxMarker = function(svg) {

  var markerStyle = {
    fill: 'none',
    class: 'outer-bound-marker'
  };

  var rect1 = svgCreate('rect');
  svgAttr(rect1, {
    x: -10000,
    y: 10000,
    width: 10,
    height: 10
  });
  svgAttr(rect1, markerStyle);

  svgAppend(svg, rect1);

  var rect2 = svgCreate('rect');
  svgAttr(rect2, {
    x: 10000,
    y: 10000,
    width: 10,
    height: 10
  });
  svgAttr(rect2, markerStyle);

  svgAppend(svg, rect2);
};

},{"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/create":357}],155:[function(require,module,exports){
'use strict';

var forEach = require('lodash/collection/forEach'),
    domEvent = require('min-dom/lib/event'),
    domClosest = require('min-dom/lib/closest'),
    Hammer = require('hammerjs'),
    Event = require('../../util/Event');

var MIN_ZOOM = 0.2,
    MAX_ZOOM = 4;

var mouseEvents = [
  'mousedown',
  'mouseup',
  'mouseover',
  'mouseout',
  'click',
  'dblclick'
];

function log() {
  // console.log.apply(console, arguments);
}

function get(service, injector) {
  return injector.get(service, false);
}

function createTouchRecognizer(node) {

  function stopEvent(event) {
    Event.stopEvent(event, true);
  }

  function stopMouse(event) {

    forEach(mouseEvents, function(e) {
      domEvent.bind(node, e, stopEvent, true);
    });
  }

  function allowMouse(event) {
    setTimeout(function() {
      forEach(mouseEvents, function(e) {
        domEvent.unbind(node, e, stopEvent, true);
      });
    }, 500);
  }

  domEvent.bind(node, 'touchstart', stopMouse, true);
  domEvent.bind(node, 'touchend', allowMouse, true);
  domEvent.bind(node, 'touchcancel', allowMouse, true);

  // A touch event recognizer that handles
  // touch events only (we know, we can already handle
  // mouse events out of the box)

  var recognizer = new Hammer.Manager(node, {
    inputClass: Hammer.TouchInput,
    recognizers: []
  });


  var tap = new Hammer.Tap();
  var pan = new Hammer.Pan({ threshold: 10 });
  var press = new Hammer.Press();
  var pinch = new Hammer.Pinch();

  var doubleTap = new Hammer.Tap({ event: 'doubletap', taps: 2 });

  pinch.requireFailure(pan);
  pinch.requireFailure(press);

  recognizer.add([ pan, press, pinch, doubleTap, tap ]);

  recognizer.reset = function(force) {
    var recognizers = this.recognizers,
        session = this.session;

    if (session.stopped) {
      return;
    }

    log('recognizer', 'stop');

    recognizer.stop(force);

    setTimeout(function() {
      var i, r;

      log('recognizer', 'reset');
      for (i = 0; (r = recognizers[i]); i++) {
        r.reset();
        r.state = 8; // FAILED STATE
      }

      session.curRecognizer = null;
    }, 0);
  };

  recognizer.on('hammer.input', function(event) {
    if (event.srcEvent.defaultPrevented) {
      recognizer.reset(true);
    }
  });

  return recognizer;
}

/**
 * A plugin that provides touch events for elements.
 *
 * @param {EventBus} eventBus
 * @param {InteractionEvents} interactionEvents
 */
function TouchInteractionEvents(injector, canvas, eventBus, elementRegistry, interactionEvents) {

  // optional integrations
  var dragging = get('dragging', injector),
      move = get('move', injector),
      contextPad = get('contextPad', injector),
      palette = get('palette', injector);

  // the touch recognizer
  var recognizer;

  function handler(type) {

    return function(event) {
      log('element', type, event);

      interactionEvents.fire(type, event);
    };
  }

  function getGfx(target) {
    var node = domClosest(target, 'svg, .djs-element', true);
    return node;
  }

  function initEvents(svg) {

    // touch recognizer
    recognizer = createTouchRecognizer(svg);

    recognizer.on('doubletap', handler('element.dblclick'));

    recognizer.on('tap', handler('element.click'));

    function startGrabCanvas(event) {

      log('canvas', 'grab start');

      var lx = 0, ly = 0;

      function update(e) {

        var dx = e.deltaX - lx,
            dy = e.deltaY - ly;

        canvas.scroll({ dx: dx, dy: dy });

        lx = e.deltaX;
        ly = e.deltaY;
      }

      function end(e) {
        recognizer.off('panmove', update);
        recognizer.off('panend', end);
        recognizer.off('pancancel', end);

        log('canvas', 'grab end');
      }

      recognizer.on('panmove', update);
      recognizer.on('panend', end);
      recognizer.on('pancancel', end);
    }

    function startGrab(event) {

      var gfx = getGfx(event.target),
          element = gfx && elementRegistry.get(gfx);

      // recognizer
      if (move && canvas.getRootElement() !== element) {
        log('element', 'move start', element, event, true);
        return move.start(event, element, true);
      } else {
        startGrabCanvas(event);
      }
    }

    function startZoom(e) {

      log('canvas', 'zoom start');

      var zoom = canvas.zoom(),
          mid = e.center;

      function update(e) {

        var ratio = 1 - (1 - e.scale) / 1.50,
            newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ratio * zoom));

        canvas.zoom(newZoom, mid);

        Event.stopEvent(e, true);
      }

      function end(e) {
        recognizer.off('pinchmove', update);
        recognizer.off('pinchend', end);
        recognizer.off('pinchcancel', end);

        recognizer.reset(true);

        log('canvas', 'zoom end');
      }

      recognizer.on('pinchmove', update);
      recognizer.on('pinchend', end);
      recognizer.on('pinchcancel', end);
    }

    recognizer.on('panstart', startGrab);
    recognizer.on('press', startGrab);

    recognizer.on('pinchstart', startZoom);
  }

  if (dragging) {

    // simulate hover during dragging
    eventBus.on('drag.move', function(event) {

      var originalEvent = event.originalEvent;

      if (!originalEvent || originalEvent instanceof MouseEvent) {
        return;
      }

      var position = Event.toPoint(originalEvent);

      // this gets really expensive ...
      var node = document.elementFromPoint(position.x, position.y),
          gfx = getGfx(node),
          element = gfx && elementRegistry.get(gfx);

      if (element !== event.hover) {
        if (event.hover) {
          dragging.out(event);
        }

        if (element) {
          dragging.hover({ element: element, gfx: gfx });

          event.hover = element;
          event.hoverGfx = gfx;
        }
      }
    });
  }

  if (contextPad) {

    eventBus.on('contextPad.create', function(event) {
      var node = event.pad.html;

      // touch recognizer
      var padRecognizer = createTouchRecognizer(node);

      padRecognizer.on('panstart', function(event) {
        log('context-pad', 'panstart', event);
        contextPad.trigger('dragstart', event, true);
      });

      padRecognizer.on('press', function(event) {
        log('context-pad', 'press', event);
        contextPad.trigger('dragstart', event, true);
      });

      padRecognizer.on('tap', function(event) {
        log('context-pad', 'tap', event);
        contextPad.trigger('click', event);
      });
    });
  }

  if (palette) {
    eventBus.on('palette.create', function(event) {
      var node = event.html;

      // touch recognizer
      var padRecognizer = createTouchRecognizer(node);

      padRecognizer.on('panstart', function(event) {
        log('palette', 'panstart', event);
        palette.trigger('dragstart', event, true);
      });

      padRecognizer.on('press', function(event) {
        log('palette', 'press', event);
        palette.trigger('dragstart', event, true);
      });

      padRecognizer.on('tap', function(event) {
        log('palette', 'tap', event);
        palette.trigger('click', event);
      });
    });
  }

  eventBus.on('canvas.init', function(event) {
    initEvents(event.svg);
  });
}


TouchInteractionEvents.$inject = [
  'injector',
  'canvas',
  'eventBus',
  'elementRegistry',
  'interactionEvents',
  'touchFix'
];

module.exports = TouchInteractionEvents;

},{"../../util/Event":170,"hammerjs":188,"lodash/collection/forEach":204,"min-dom/lib/closest":341,"min-dom/lib/event":344}],156:[function(require,module,exports){
module.exports = {
  __depends__: [ require('../interaction-events') ],
  __init__: [ 'touchInteractionEvents' ],
  touchInteractionEvents: [ 'type', require('./TouchInteractionEvents') ],
  touchFix: [ 'type', require('./TouchFix') ]
};
},{"../interaction-events":91,"./TouchFix":154,"./TouchInteractionEvents":155}],157:[function(require,module,exports){
module.exports = {
  translate: [ 'value', require('./translate') ]
};
},{"./translate":158}],158:[function(require,module,exports){
'use strict';

/**
 * A simple translation stub to be used for multi-language support
 * in diagrams. Can be easily replaced with a more sophisticated
 * solution.
 *
 * @example
 *
 * // use it inside any diagram component by injecting `translate`.
 *
 * function MyService(translate) {
 *   alert(translate('HELLO {you}', { you: 'You!' }));
 * }
 *
 * @param {String} template to interpolate
 * @param {Object} [replacements] a map with substitutes
 *
 * @return {String} the translated string
 */
module.exports = function translate(template, replacements) {

  replacements = replacements || {};

  return template.replace(/{([^}]+)}/g, function(_, key) {
    return replacements[key] || '{' + key + '}';
  });
};
},{}],159:[function(require,module,exports){
'use strict';

var getMid = require('./LayoutUtil').getMid;


/**
 * A base connection layouter implementation
 * that layouts the connection by directly connecting
 * mid(source) + mid(target).
 */
function BaseLayouter() {}

module.exports = BaseLayouter;


/**
 * Return the new layouted waypoints for the given connection.
 *
 * The connection passed is still unchanged; you may figure out about
 * the new connection start / end via the layout hints provided.
 *
 * @param {djs.model.Connection} connection
 * @param {Object} [hints]
 * @param {Point} [hints.connectionStart]
 * @param {Point} [hints.connectionEnd]
 *
 * @return {Array<Point>} the layouted connection waypoints
 */
BaseLayouter.prototype.layoutConnection = function(connection, hints) {

  hints = hints || {};

  return [
    hints.connectionStart || getMid(connection.source),
    hints.connectionEnd || getMid(connection.target)
  ];
};

},{"./LayoutUtil":161}],160:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign');

var LayoutUtil = require('./LayoutUtil');


function dockingToPoint(docking) {
  // use the dockings actual point and
  // retain the original docking
  return assign({ original: docking.point.original || docking.point }, docking.actual);
}


/**
 * A {@link ConnectionDocking} that crops connection waypoints based on
 * the path(s) of the connection source and target.
 *
 * @param {djs.core.ElementRegistry} elementRegistry
 */
function CroppingConnectionDocking(elementRegistry, graphicsFactory) {
  this._elementRegistry = elementRegistry;
  this._graphicsFactory = graphicsFactory;
}

CroppingConnectionDocking.$inject = [ 'elementRegistry', 'graphicsFactory' ];

module.exports = CroppingConnectionDocking;


/**
 * @inheritDoc ConnectionDocking#getCroppedWaypoints
 */
CroppingConnectionDocking.prototype.getCroppedWaypoints = function(connection, source, target) {

  source = source || connection.source;
  target = target || connection.target;

  var sourceDocking = this.getDockingPoint(connection, source, true),
      targetDocking = this.getDockingPoint(connection, target);

  var croppedWaypoints = connection.waypoints.slice(sourceDocking.idx + 1, targetDocking.idx);

  croppedWaypoints.unshift(dockingToPoint(sourceDocking));
  croppedWaypoints.push(dockingToPoint(targetDocking));

  return croppedWaypoints;
};

/**
 * Return the connection docking point on the specified shape
 *
 * @inheritDoc ConnectionDocking#getDockingPoint
 */
CroppingConnectionDocking.prototype.getDockingPoint = function(connection, shape, dockStart) {

  var waypoints = connection.waypoints,
      dockingIdx,
      dockingPoint,
      croppedPoint;

  dockingIdx = dockStart ? 0 : waypoints.length - 1;
  dockingPoint = waypoints[dockingIdx];

  croppedPoint = this._getIntersection(shape, connection, dockStart);

  return {
    point: dockingPoint,
    actual: croppedPoint || dockingPoint,
    idx: dockingIdx
  };
};


////// helper methods ///////////////////////////////////////////////////

CroppingConnectionDocking.prototype._getIntersection = function(shape, connection, takeFirst) {

  var shapePath = this._getShapePath(shape),
      connectionPath = this._getConnectionPath(connection);

  return LayoutUtil.getElementLineIntersection(shapePath, connectionPath, takeFirst);
};

CroppingConnectionDocking.prototype._getConnectionPath = function(connection) {
  return this._graphicsFactory.getConnectionPath(connection);
};

CroppingConnectionDocking.prototype._getShapePath = function(shape) {
  return this._graphicsFactory.getShapePath(shape);
};

CroppingConnectionDocking.prototype._getGfx = function(element) {
  return this._elementRegistry.getGraphics(element);
};

},{"./LayoutUtil":161,"lodash/object/assign":328}],161:[function(require,module,exports){
'use strict';

var isObject = require('lodash/lang/isObject'),
    sortBy = require('lodash/collection/sortBy'),
    pointDistance = require('../util/Geometry').pointDistance;

var intersection = require('../util/Intersection').intersection;


function roundBounds(bounds) {
  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height)
  };
}

module.exports.roundBounds = roundBounds;


function roundPoint(point) {

  return {
    x: Math.round(point.x),
    y: Math.round(point.y)
  };
}

module.exports.roundPoint = roundPoint;


/**
 * Convert the given bounds to a { top, left, bottom, right } descriptor.
 *
 * @param {Bounds|Point} bounds
 *
 * @return {Object}
 */
function asTRBL(bounds) {
  return {
    top: bounds.y,
    right: bounds.x + (bounds.width || 0),
    bottom: bounds.y + (bounds.height || 0),
    left: bounds.x
  };
}

module.exports.asTRBL = asTRBL;

/**
 * Convert a { top, left, bottom, right } to an objects bounds.
 *
 * @param {Object} trbl
 *
 * @return {Bounds}
 */
function asBounds(trbl) {
  return {
    x: trbl.left,
    y: trbl.top,
    width: trbl.right - trbl.left,
    height: trbl.bottom - trbl.top
  };
}

module.exports.asBounds = asBounds;


/**
 * Get the mid of the given bounds or point.
 *
 * @param {Bounds|Point} bounds
 *
 * @return {Point}
 */
function getMid(bounds) {
  return roundPoint({
    x: bounds.x + (bounds.width || 0) / 2,
    y: bounds.y + (bounds.height || 0) / 2
  });
}

module.exports.getMid = getMid;


////// orientation utils //////////////////////////////

/**
 * Get orientation of the given rectangle with respect to
 * the reference rectangle.
 *
 * A padding (positive or negative) may be passed to influence
 * horizontal / vertical orientation and intersection.
 *
 * @param {Bounds} rect
 * @param {Bounds} reference
 * @param {Point|Number} padding
 *
 * @return {String} the orientation; one of top, top-left, left, ..., bottom, right or intersect.
 */
function getOrientation(rect, reference, padding) {

  padding = padding || 0;

  // make sure we can use an object, too
  // for individual { x, y } padding
  if (!isObject(padding)) {
    padding = { x: padding, y: padding };
  }


  var rectOrientation = asTRBL(rect),
      referenceOrientation = asTRBL(reference);

  var top = rectOrientation.bottom + padding.y <= referenceOrientation.top,
      right = rectOrientation.left - padding.x >= referenceOrientation.right,
      bottom = rectOrientation.top - padding.y >= referenceOrientation.bottom,
      left = rectOrientation.right + padding.x <= referenceOrientation.left;

  var vertical = top ? 'top' : (bottom ? 'bottom' : null),
      horizontal = left ? 'left' : (right ? 'right' : null);

  if (horizontal && vertical) {
    return vertical + '-' + horizontal;
  } else {
    return horizontal || vertical || 'intersect';
  }
}

module.exports.getOrientation = getOrientation;


////// intersection utils //////////////////////////////

/**
 * Get intersection between an element and a line path.
 *
 * @param {PathDef} elementPath
 * @param {PathDef} linePath
 * @param {Boolean} cropStart crop from start or end
 *
 * @return {Point}
 */
function getElementLineIntersection(elementPath, linePath, cropStart) {

  var intersections = getIntersections(elementPath, linePath);

  // recognize intersections
  // only one -> choose
  // two close together -> choose first
  // two or more distinct -> pull out appropriate one
  // none -> ok (fallback to point itself)
  if (intersections.length === 1) {
    return roundPoint(intersections[0]);
  } else if (intersections.length === 2 && pointDistance(intersections[0], intersections[1]) < 1) {
    return roundPoint(intersections[0]);
  } else if (intersections.length > 1) {

    // sort by intersections based on connection segment +
    // distance from start
    intersections = sortBy(intersections, function(i) {
      var distance = Math.floor(i.t2 * 100) || 1;

      distance = 100 - distance;

      distance = (distance < 10 ? '0' : '') + distance;

      // create a sort string that makes sure we sort
      // line segment ASC + line segment position DESC (for cropStart)
      // line segment ASC + line segment position ASC (for cropEnd)
      return i.segment2 + '#' + distance;
    });

    return roundPoint(intersections[cropStart ? 0 : intersections.length - 1]);
  }

  return null;
}

module.exports.getElementLineIntersection = getElementLineIntersection;


function getIntersections(a, b) {
  return intersection(a, b);
}

module.exports.getIntersections = getIntersections;

},{"../util/Geometry":171,"../util/Intersection":174,"lodash/collection/sortBy":210,"lodash/lang/isObject":323}],162:[function(require,module,exports){
'use strict';

var isArray = require('lodash/lang/isArray'),
    find = require('lodash/collection/find'),
    without = require('lodash/array/without'),
    assign = require('lodash/object/assign');

var LayoutUtil = require('./LayoutUtil'),
    Geometry = require('../util/Geometry');

var getOrientation = LayoutUtil.getOrientation,
    getMid = LayoutUtil.getMid,
    pointsAligned = Geometry.pointsAligned;

var pointInRect = Geometry.pointInRect,
    pointDistance = Geometry.pointDistance;

var INTERSECTION_THRESHOLD = 20,
    ORIENTATION_THRESHOLD = {
      'h:h': 20,
      'v:v': 20,
      'h:v': -10,
      'v:h': -10
    };


/**
 * Returns the mid points for a manhattan connection between two points.
 *
 * @example
 *
 * [a]----[x]
 *         |
 *        [x]----[b]
 *
 * @example
 *
 * [a]----[x]
 *         |
 *        [b]
 *
 * @param  {Point} a
 * @param  {Point} b
 * @param  {String} directions
 *
 * @return {Array<Point>}
 */
module.exports.getBendpoints = function(a, b, directions) {

  directions = directions || 'h:h';

  var xmid, ymid;

  // one point, next to a
  if (directions === 'h:v') {
    return [ { x: b.x, y: a.y } ];
  } else
  // one point, above a
  if (directions === 'v:h') {
    return [ { x: a.x, y: b.y } ];
  } else
  // vertical edge xmid
  if (directions === 'h:h') {
    xmid = Math.round((b.x - a.x) / 2 + a.x);

    return [
      { x: xmid, y: a.y },
      { x: xmid, y: b.y }
    ];
  } else
  // horizontal edge ymid
  if (directions === 'v:v') {
    ymid = Math.round((b.y - a.y) / 2 + a.y);

    return [
      { x: a.x, y: ymid },
      { x: b.x, y: ymid }
    ];
  } else {
    throw new Error(
      'unknown directions: <' + directions + '>: ' +
      'directions must be specified as {a direction}:{b direction} (direction in h|v)');
  }
};


/**
 * Create a connection between the two points according
 * to the manhattan layout (only horizontal and vertical) edges.
 *
 * @param {Point} a
 * @param {Point} b
 *
 * @param {String} [directions='h:h'] specifies manhattan directions for each point as {adirection}:{bdirection}.
                   A directionfor a point is either `h` (horizontal) or `v` (vertical)
 *
 * @return {Array<Point>}
 */
module.exports.connectPoints = function(a, b, directions) {

  var points = [];

  if (!pointsAligned(a, b)) {
    points = this.getBendpoints(a, b, directions);
  }

  points.unshift(a);
  points.push(b);

  return points;
};


/**
 * Connect two rectangles using a manhattan layouted connection.
 *
 * @param {Bounds} source source rectangle
 * @param {Bounds} target target rectangle
 * @param {Point} [start] source docking
 * @param {Point} [end] target docking
 *
 * @param {Object} [hints]
 * @param {String} [hints.preserveDocking=source] preserve docking on selected side
 * @param {Array<String>} [hints.preferredLayouts]
 * @param {Point|Boolean} [hints.connectionStart] whether the start changed
 * @param {Point|Boolean} [hints.connectionEnd] whether the end changed
 *
 * @return {Array<Point>} connection points
 */
module.exports.connectRectangles = function(source, target, start, end, hints) {

  var preferredLayouts = hints && hints.preferredLayouts || [];

  var preferredLayout = without(preferredLayouts, 'straight')[0] || 'h:h';

  var threshold = ORIENTATION_THRESHOLD[preferredLayout] || 0;

  var orientation = getOrientation(source, target, threshold);

  var directions = getDirections(orientation, preferredLayout);

  start = start || getMid(source);
  end = end || getMid(target);

  // overlapping elements
  if (!directions) {
    return;
  }

  if (directions === 'h:h') {

    switch (orientation) {
    case 'top-right':
    case 'right':
    case 'bottom-right':
      start = { original: start, x: source.x, y: start.y };
      end = { original: end, x: target.x + target.width, y: end.y };
      break;
    case 'top-left':
    case 'left':
    case 'bottom-left':
      start = { original: start, x: source.x + source.width, y: start.y };
      end = { original: end, x: target.x, y: end.y };
      break;
    }
  }

  if (directions === 'v:v') {

    switch (orientation) {
    case 'top-left':
    case 'top':
    case 'top-right':
      start = { original: start, x: start.x, y: source.y + source.height };
      end = { original: end, x: end.x, y: target.y };
      break;
    case 'bottom-left':
    case 'bottom':
    case 'bottom-right':
      start = { original: start, x: start.x, y: source.y };
      end = { original: end, x: end.x, y: target.y + target.height };
      break;
    }
  }

  return this.connectPoints(start, end, directions);
};

/**
 * Repair the connection between two rectangles, of which one has been updated.
 *
 * @param {Bounds} source
 * @param {Bounds} target
 * @param {Point} [start]
 * @param {Point} [end]
 * @param {Array<Point>} waypoints
 * @param {Object} [hints]
 * @param {Array<String>} [hints.preferredLayouts] list of preferred layouts
 * @param {Boolean} [hints.connectionStart]
 * @param {Boolean} [hints.connectionEnd]
 *
 * @return {Array<Point>} repaired waypoints
 */
module.exports.repairConnection = function(source, target, start, end, waypoints, hints) {

  if (isArray(start)) {
    waypoints = start;
    hints = end;

    start = getMid(source);
    end = getMid(target);
  }

  hints = assign({ preferredLayouts: [] }, hints);
  waypoints = waypoints || [];

  var preferredLayouts = hints.preferredLayouts,
      layoutStraight = preferredLayouts.indexOf('straight') !== -1,
      repairedWaypoints;

  // just layout non-existing or simple connections
  // attempt to render straight lines, if required

  if (layoutStraight) {
    // attempt to layout a straight line
    repairedWaypoints = this.layoutStraight(source, target, start, end, hints);
  }

  if (!repairedWaypoints) {
    // check if we layout from start or end
    if (hints.connectionEnd) {
      repairedWaypoints = this._repairConnectionSide(target, source, end, waypoints.slice().reverse());
      repairedWaypoints = repairedWaypoints && repairedWaypoints.reverse();
    } else
    if (hints.connectionStart) {
      repairedWaypoints = this._repairConnectionSide(source, target, start, waypoints);
    } else
    // or whether nothing seems to have changed
    if (waypoints && waypoints.length) {
      repairedWaypoints = waypoints;
    }
  }

  // simply reconnect if nothing else worked
  if (!repairedWaypoints) {
    repairedWaypoints = this.connectRectangles(source, target, start, end, hints);
  }

  return repairedWaypoints;
};


function inRange(a, start, end) {
  return a >= start && a <= end;
}

function isInRange(axis, a, b) {
  var size = {
    x: 'width',
    y: 'height'
  };

  return inRange(a[axis], b[axis], b[axis] + b[size[axis]]);
}

/**
 * Layout a straight connection
 *
 * @param {Bounds} source
 * @param {Bounds} target
 * @param {Point} start
 * @param {Point} end
 * @param {Object} [hints]
 *
 * @return {Array<Point>} waypoints if straight layout worked
 */
module.exports.layoutStraight = function(source, target, start, end, hints) {
  var axis = {},
      primaryAxis,
      orientation;

  orientation = getOrientation(source, target);

  // We're only interested in layouting a straight connection
  // if the shapes are horizontally or vertically aligned
  if (!/^(top|bottom|left|right)$/.test(orientation)) {
    return null;
  }

  if (/top|bottom/.test(orientation)) {
    primaryAxis = 'x';
  }

  if (/left|right/.test(orientation)) {
    primaryAxis = 'y';
  }

  if (hints.preserveDocking === 'target') {

    if (!isInRange(primaryAxis, end, source)) {
      return null;
    }

    axis[primaryAxis] = end[primaryAxis];

    return [
      {
        x: axis.x !== undefined ? axis.x : start.x,
        y: axis.y !== undefined ? axis.y : start.y,
        original: {
          x: axis.x !== undefined ? axis.x : start.x,
          y: axis.y !== undefined ? axis.y : start.y
        }
      },
      {
        x: end.x,
        y: end.y
      }
    ];

  } else {

    if (!isInRange(primaryAxis, start, target)) {
      return null;
    }

    axis[primaryAxis] = start[primaryAxis];

    return [
      {
        x: start.x,
        y: start.y
      },
      {
        x: axis.x !== undefined ? axis.x : end.x,
        y: axis.y !== undefined ? axis.y : end.y,
        original: {
          x: axis.x !== undefined ? axis.x : end.x,
          y: axis.y !== undefined ? axis.y : end.y
        }
      }
    ];
  }

};

/**
 * Repair a connection from one side that moved.
 *
 * @param {Bounds} moved
 * @param {Bounds} other
 * @param {Point} newDocking
 * @param {Array<Point>} points originalPoints from moved to other
 *
 * @return {Array<Point>} the repaired points between the two rectangles
 */
module.exports._repairConnectionSide = function(moved, other, newDocking, points) {

  function needsRelayout(moved, other, points) {

    if (points.length < 3) {
      return true;
    }

    if (points.length > 4) {
      return false;
    }

    // relayout if two points overlap
    // this is most likely due to
    return !!find(points, function(p, idx) {
      var q = points[idx - 1];

      return q && pointDistance(p, q) < 3;
    });
  }

  function repairBendpoint(candidate, oldPeer, newPeer) {

    var alignment = pointsAligned(oldPeer, candidate);

    switch (alignment) {
    case 'v':
        // repair vertical alignment
      return { x: candidate.x, y: newPeer.y };
    case 'h':
        // repair horizontal alignment
      return { x: newPeer.x, y: candidate.y };
    }

    return { x: candidate.x, y: candidate. y };
  }

  function removeOverlapping(points, a, b) {
    var i;

    for (i = points.length - 2; i !== 0; i--) {

      // intersects (?) break, remove all bendpoints up to this one and relayout
      if (pointInRect(points[i], a, INTERSECTION_THRESHOLD) ||
          pointInRect(points[i], b, INTERSECTION_THRESHOLD)) {

        // return sliced old connection
        return points.slice(i);
      }
    }

    return points;
  }


  // (0) only repair what has layoutable bendpoints

  // (1) if only one bendpoint and on shape moved onto other shapes axis
  //     (horizontally / vertically), relayout

  if (needsRelayout(moved, other, points)) {
    return null;
  }

  var oldDocking = points[0],
      newPoints = points.slice(),
      slicedPoints;

  // (2) repair only last line segment and only if it was layouted before

  newPoints[0] = newDocking;
  newPoints[1] = repairBendpoint(newPoints[1], oldDocking, newDocking);


  // (3) if shape intersects with any bendpoint after repair,
  //     remove all segments up to this bendpoint and repair from there

  slicedPoints = removeOverlapping(newPoints, moved, other);

  if (slicedPoints !== newPoints) {
    return this._repairConnectionSide(moved, other, newDocking, slicedPoints);
  }

  return newPoints;
};

/**
 * Returns the manhattan directions connecting two rectangles
 * with the given orientation.
 *
 * @example
 *
 * getDirections('top'); // -> 'v:v'
 *
 * getDirections('top-right', 'v:h'); // -> 'v:h'
 * getDirections('top-right', 'h:h'); // -> 'h:h'
 *
 *
 * @param {String} orientation
 * @param {String} defaultLayout
 *
 * @return {String}
 */
function getDirections(orientation, defaultLayout) {

  switch (orientation) {
  case 'intersect':
    return null;

  case 'top':
  case 'bottom':
    return 'v:v';

  case 'left':
  case 'right':
    return 'h:h';

    // 'top-left'
    // 'top-right'
    // 'bottom-left'
    // 'bottom-right'
  default:
    return defaultLayout;
  }
}

},{"../util/Geometry":171,"./LayoutUtil":161,"lodash/array/without":198,"lodash/collection/find":203,"lodash/lang/isArray":319,"lodash/object/assign":328}],163:[function(require,module,exports){
arguments[4][55][0].apply(exports,arguments)
},{"dup":55,"inherits":191,"lodash/object/assign":328,"object-refs":348}],164:[function(require,module,exports){
module.exports = {
  __depends__: [ require('../../features/touch') ]
};
},{"../../features/touch":156}],165:[function(require,module,exports){
'use strict';

var roundPoint = require('../layout/LayoutUtil').roundPoint;

var center = require('./PositionUtil').center,
    delta = require('./PositionUtil').delta;


/**
 * Calculates the absolute point relative to the new element's position
 *
 * @param {point} point [absolute]
 * @param {bounds} oldBounds
 * @param {bounds} newBounds
 *
 * @return {point} point [absolute]
 */
function getNewAttachPoint(point, oldBounds, newBounds) {
  var oldCenter = center(oldBounds),
      newCenter = center(newBounds),
      oldDelta = delta(point, oldCenter);

  var newDelta = {
    x: oldDelta.x * (newBounds.width / oldBounds.width),
    y: oldDelta.y * (newBounds.height / oldBounds.height)
  };

  return roundPoint({
    x: newCenter.x + newDelta.x,
    y: newCenter.y + newDelta.y
  });
}

module.exports.getNewAttachPoint = getNewAttachPoint;


/**
 * Calculates the shape's delta relative to a new position
 * of a certain element's bounds
 *
 * @param {djs.model.Shape} point [absolute]
 * @param {bounds} oldBounds
 * @param {bounds} newBounds
 *
 * @return {delta} delta
 */
function getNewAttachShapeDelta(shape, oldBounds, newBounds) {
  var shapeCenter = center(shape),
      oldCenter = center(oldBounds),
      newCenter = center(newBounds),
      shapeDelta = delta(shape, shapeCenter),
      oldCenterDelta = delta(shapeCenter, oldCenter);

  var newCenterDelta = {
    x: oldCenterDelta.x * (newBounds.width / oldBounds.width),
    y: oldCenterDelta.y * (newBounds.height / oldBounds.height)
  };

  var newShapeCenter = {
    x: newCenter.x + newCenterDelta.x,
    y: newCenter.y + newCenterDelta.y
  };

  return roundPoint({
    x: newShapeCenter.x + shapeDelta.x - shape.x,
    y: newShapeCenter.y + shapeDelta.y - shape.y
  });
}

module.exports.getNewAttachShapeDelta = getNewAttachShapeDelta;

},{"../layout/LayoutUtil":161,"./PositionUtil":178}],166:[function(require,module,exports){
'use strict';

var domEvent = require('min-dom/lib/event'),
    stopEvent = require('./Event').stopEvent;

function trap(event) {
  stopEvent(event);

  toggle(false);
}

function toggle(active) {
  domEvent[active ? 'bind' : 'unbind'](document.body, 'click', trap, true);
}

/**
 * Installs a click trap that prevents a ghost click following a dragging operation.
 *
 * @return {Function} a function to immediately remove the installed trap.
 */
function install() {

  toggle(true);

  return function() {
    toggle(false);
  };
}

module.exports.install = install;
},{"./Event":170,"min-dom/lib/event":344}],167:[function(require,module,exports){
'use strict';

/**
 * Failsafe remove an element from a collection
 *
 * @param  {Array<Object>} [collection]
 * @param  {Object} [element]
 *
 * @return {Number} the previous index of the element
 */
module.exports.remove = function(collection, element) {

  if (!collection || !element) {
    return -1;
  }

  var idx = collection.indexOf(element);

  if (idx !== -1) {
    collection.splice(idx, 1);
  }

  return idx;
};

/**
 * Fail save add an element to the given connection, ensuring
 * it does not yet exist.
 *
 * @param {Array<Object>} collection
 * @param {Object} element
 * @param {Number} idx
 */
module.exports.add = function(collection, element, idx) {

  if (!collection || !element) {
    return;
  }

  if (typeof idx !== 'number') {
    idx = -1;
  }

  var currentIdx = collection.indexOf(element);

  if (currentIdx !== -1) {

    if (currentIdx === idx) {
      // nothing to do, position has not changed
      return;
    } else {

      if (idx !== -1) {
        // remove from current position
        collection.splice(currentIdx, 1);
      } else {
        // already exists in collection
        return;
      }
    }
  }

  if (idx !== -1) {
    // insert at specified position
    collection.splice(idx, 0, element);
  } else {
    // push to end
    collection.push(element);
  }
};


/**
 * Fail save get the index of an element in a collection.
 *
 * @param {Array<Object>} collection
 * @param {Object} element
 *
 * @return {Number} the index or -1 if collection or element do
 *                  not exist or the element is not contained.
 */
module.exports.indexOf = function(collection, element) {

  if (!collection || !element) {
    return -1;
  }

  return collection.indexOf(element);
};

},{}],168:[function(require,module,exports){
'use strict';

var domClasses = require('min-dom/lib/classes');

var CURSOR_CLS_PATTERN = /^djs-cursor-.*$/;


module.exports.set = function(mode) {
  var classes = domClasses(document.body);

  classes.removeMatching(CURSOR_CLS_PATTERN);

  if (mode) {
    classes.add('djs-cursor-' + mode);
  }
};

module.exports.unset = function() {
  this.set(null);
};

module.exports.has = function(mode) {
  var classes = domClasses(document.body);

  return classes.has('djs-cursor-' + mode);
};

},{"min-dom/lib/classes":339}],169:[function(require,module,exports){
'use strict';

var isArray = require('lodash/lang/isArray'),
    isNumber = require('lodash/lang/isNumber'),
    groupBy = require('lodash/collection/groupBy'),
    forEach = require('lodash/collection/forEach');

/**
 * Adds an element to a collection and returns true if the
 * element was added.
 *
 * @param {Array<Object>} elements
 * @param {Object} e
 * @param {Boolean} unique
 */
function add(elements, e, unique) {
  var canAdd = !unique || elements.indexOf(e) === -1;

  if (canAdd) {
    elements.push(e);
  }

  return canAdd;
}

/**
 * Iterate over each element in a collection, calling the iterator function `fn`
 * with (element, index, recursionDepth).
 *
 * Recurse into all elements that are returned by `fn`.
 *
 * @param  {Object|Array<Object>} elements
 * @param  {Function} fn iterator function called with (element, index, recursionDepth)
 * @param  {Number} [depth] maximum recursion depth
 */
function eachElement(elements, fn, depth) {

  depth = depth || 0;

  if (!isArray(elements)) {
    elements = [ elements ];
  }

  forEach(elements, function(s, i) {
    var filter = fn(s, i, depth);

    if (isArray(filter) && filter.length) {
      eachElement(filter, fn, depth + 1);
    }
  });
}

/**
 * Collects self + child elements up to a given depth from a list of elements.
 *
 * @param  {djs.model.Base|Array<djs.model.Base>} elements the elements to select the children from
 * @param  {Boolean} unique whether to return a unique result set (no duplicates)
 * @param  {Number} maxDepth the depth to search through or -1 for infinite
 *
 * @return {Array<djs.model.Base>} found elements
 */
function selfAndChildren(elements, unique, maxDepth) {
  var result = [],
      processedChildren = [];

  eachElement(elements, function(element, i, depth) {
    add(result, element, unique);

    var children = element.children;

    // max traversal depth not reached yet
    if (maxDepth === -1 || depth < maxDepth) {

      // children exist && children not yet processed
      if (children && add(processedChildren, children, unique)) {
        return children;
      }
    }
  });

  return result;
}

/**
 * Return self + direct children for a number of elements
 *
 * @param  {Array<djs.model.Base>} elements to query
 * @param  {Boolean} allowDuplicates to allow duplicates in the result set
 *
 * @return {Array<djs.model.Base>} the collected elements
 */
function selfAndDirectChildren(elements, allowDuplicates) {
  return selfAndChildren(elements, !allowDuplicates, 1);
}

/**
 * Return self + ALL children for a number of elements
 *
 * @param  {Array<djs.model.Base>} elements to query
 * @param  {Boolean} allowDuplicates to allow duplicates in the result set
 *
 * @return {Array<djs.model.Base>} the collected elements
 */
function selfAndAllChildren(elements, allowDuplicates) {
  return selfAndChildren(elements, !allowDuplicates, -1);
}

/**
 * Gets the the closure for all selected elements,
 * their connections and their attachment's connections
 *
 * @param {Array<djs.model.Base>} elements
 * @return {Object} enclosure
 */
function getClosure(elements) {

  // original elements passed to this function
  var topLevel = groupBy(elements, function(e) { return e.id; });

  var allShapes = {},
      allConnections = {},
      enclosedElements = {},
      enclosedConnections = {};

  function handleConnection(c) {
    if (topLevel[c.source.id] && topLevel[c.target.id]) {
      topLevel[c.id] = c;
    }

    // not enclosed as a child, but maybe logically
    // (connecting two moved elements?)
    if (allShapes[c.source.id] && allShapes[c.target.id]) {
      enclosedConnections[c.id] = enclosedElements[c.id] = c;
    }

    allConnections[c.id] = c;
  }

  function handleElement(element) {

    enclosedElements[element.id] = element;

    if (element.waypoints) {
      // remember connection
      enclosedConnections[element.id] = allConnections[element.id] = element;
    } else {
      // remember shape
      allShapes[element.id] = element;

      // remember all connections
      forEach(element.incoming, handleConnection);

      forEach(element.outgoing, handleConnection);

      // recurse into children
      return element.children;
    }
  }

  eachElement(elements, handleElement);

  return {
    allShapes: allShapes,
    allConnections: allConnections,
    topLevel: topLevel,
    enclosedConnections: enclosedConnections,
    enclosedElements: enclosedElements
  };
}

/**
 * Returns the surrounding bbox for all elements in
 * the array or the element primitive.
 *
 * @param {Array<djs.model.Shape>|djs.model.Shape} elements
 * @param {Boolean} stopRecursion
 */
function getBBox(elements, stopRecursion) {

  stopRecursion = !!stopRecursion;
  if (!isArray(elements)) {
    elements = [elements];
  }

  var minX,
      minY,
      maxX,
      maxY;

  forEach(elements, function(element) {

    // If element is a connection the bbox must be computed first
    var bbox = element;
    if (element.waypoints && !stopRecursion) {
      bbox = getBBox(element.waypoints, true);
    }

    var x = bbox.x,
        y = bbox.y,
        height = bbox.height || 0,
        width  = bbox.width  || 0;

    if (x < minX || minX === undefined) {
      minX = x;
    }
    if (y < minY || minY === undefined) {
      minY = y;
    }

    if ((x + width) > maxX || maxX === undefined) {
      maxX = x + width;
    }
    if ((y + height) > maxY || maxY === undefined) {
      maxY = y + height;
    }
  });

  return {
    x: minX,
    y: minY,
    height: maxY - minY,
    width: maxX - minX
  };
}


/**
 * Returns all elements that are enclosed from the bounding box.
 *
 *   * If bbox.(width|height) is not specified the method returns
 *     all elements with element.x/y > bbox.x/y
 *   * If only bbox.x or bbox.y is specified, method return all elements with
 *     e.x > bbox.x or e.y > bbox.y
 *
 * @param {Array<djs.model.Shape>} elements List of Elements to search through
 * @param {djs.model.Shape} bbox the enclosing bbox.
 *
 * @return {Array<djs.model.Shape>} enclosed elements
 */
function getEnclosedElements(elements, bbox) {

  var filteredElements = {};

  forEach(elements, function(element) {

    var e = element;

    if (e.waypoints) {
      e = getBBox(e);
    }

    if (!isNumber(bbox.y) && (e.x > bbox.x)) {
      filteredElements[element.id] = element;
    }
    if (!isNumber(bbox.x) && (e.y > bbox.y)) {
      filteredElements[element.id] = element;
    }
    if (e.x > bbox.x && e.y > bbox.y) {
      if (isNumber(bbox.width) && isNumber(bbox.height) &&
          e.width  + e.x < bbox.width  + bbox.x &&
          e.height + e.y < bbox.height + bbox.y) {

        filteredElements[element.id] = element;
      } else if (!isNumber(bbox.width) || !isNumber(bbox.height)) {
        filteredElements[element.id] = element;
      }
    }
  });

  return filteredElements;
}


module.exports.add = add;
module.exports.eachElement = eachElement;
module.exports.selfAndDirectChildren = selfAndDirectChildren;
module.exports.selfAndAllChildren = selfAndAllChildren;
module.exports.getBBox = getBBox;
module.exports.getEnclosedElements = getEnclosedElements;

module.exports.getClosure = getClosure;


function getElementType(element) {

  if ('waypoints' in element) {
    return 'connection';
  }

  if ('x' in element) {
    return 'shape';
  }

  return 'root';
}

module.exports.getType = getElementType;
},{"lodash/collection/forEach":204,"lodash/collection/groupBy":205,"lodash/lang/isArray":319,"lodash/lang/isNumber":322}],170:[function(require,module,exports){
'use strict';

function __preventDefault(event) {
  return event && event.preventDefault();
}

function __stopPropagation(event, immediate) {
  if (!event) {
    return;
  }

  if (event.stopPropagation) {
    event.stopPropagation();
  }

  if (immediate && event.stopImmediatePropagation) {
    event.stopImmediatePropagation();
  }
}


function getOriginal(event) {
  return event.originalEvent || event.srcEvent;
}

module.exports.getOriginal = getOriginal;


function stopEvent(event, immediate) {
  stopPropagation(event, immediate);
  preventDefault(event);
}

module.exports.stopEvent = stopEvent;


function preventDefault(event) {
  __preventDefault(event);
  __preventDefault(getOriginal(event));
}

module.exports.preventDefault = preventDefault;


function stopPropagation(event, immediate) {
  __stopPropagation(event, immediate);
  __stopPropagation(getOriginal(event), immediate);
}

module.exports.stopPropagation = stopPropagation;


function toPoint(event) {

  if (event.pointers && event.pointers.length) {
    event = event.pointers[0];
  }

  if (event.touches && event.touches.length) {
    event = event.touches[0];
  }

  return event ? {
    x: event.clientX,
    y: event.clientY
  } : null;
}

module.exports.toPoint = toPoint;

},{}],171:[function(require,module,exports){
'use strict';

/**
 * Computes the distance between two points
 *
 * @param  {Point}  p
 * @param  {Point}  q
 *
 * @return {Number}  distance
 */
function pointDistance(a, b) {
  if (!a || !b) {
    return -1;
  }

  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

module.exports.pointDistance = pointDistance;


/**
 * Returns true if the point r is on the line between p and y
 *
 * @param  {Point}  p
 * @param  {Point}  q
 * @param  {Point}  r
 *
 * @return {Boolean}
 */
module.exports.pointsOnLine = function(p, q, r) {

  if (!p || !q || !r) {
    return false;
  }

  var val = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x),
      dist = pointDistance(p, q);

  // @see http://stackoverflow.com/a/907491/412190
  return Math.abs(val / dist) < 5;
};


var ALIGNED_THRESHOLD = 2;

/**
 * Returns whether two points are in a horizontal or vertical line.
 *
 * @param {Point} a
 * @param {Point} b
 *
 * @return {String|Boolean} returns false if the points are not
 *                          aligned or 'h|v' if they are aligned
 *                          horizontally / vertically.
 */
function pointsAligned(a, b) {
  if (Math.abs(a.x - b.x) <= ALIGNED_THRESHOLD) {
    return 'h';
  }

  if (Math.abs(a.y - b.y) <= ALIGNED_THRESHOLD) {
    return 'v';
  }

  return false;
}

module.exports.pointsAligned = pointsAligned;


/**
 * Returns true if the point p is inside the rectangle rect
 *
 * @param  {Point}  p
 * @param  {Rect}   rect
 * @param  {Number} tolerance
 *
 * @return {Boolean}
 */
module.exports.pointInRect = function(p, rect, tolerance) {
  tolerance = tolerance || 0;

  return p.x > rect.x - tolerance &&
         p.y > rect.y - tolerance &&
         p.x < rect.x + rect.width + tolerance &&
         p.y < rect.y + rect.height + tolerance;
};

/**
 * Returns a point in the middle of points p and q
 *
 * @param  {Point}  p
 * @param  {Point}  q
 *
 * @return {Point} middle point
 */
module.exports.getMidPoint = function(p, q) {
  return {
    x: Math.round(p.x + ((q.x - p.x) / 2.0)),
    y: Math.round(p.y + ((q.y - p.y) / 2.0))
  };
};

},{}],172:[function(require,module,exports){
'use strict';

var domQuery = require('min-dom/lib/query');

/**
 * SVGs for elements are generated by the {@link GraphicsFactory}.
 *
 * This utility gives quick access to the important semantic
 * parts of an element.
 */

/**
 * Returns the visual part of a diagram element
 *
 * @param {Snap<SVGElement>} gfx
 *
 * @return {Snap<SVGElement>}
 */
function getVisual(gfx) {
  return domQuery('.djs-visual', gfx);
}

/**
 * Returns the children for a given diagram element.
 *
 * @param {Snap<SVGElement>} gfx
 * @return {Snap<SVGElement>}
 */
function getChildren(gfx) {
  return gfx.parentNode.childNodes[1];
}

module.exports.getVisual = getVisual;
module.exports.getChildren = getChildren;

},{"min-dom/lib/query":346}],173:[function(require,module,exports){
'use strict';

/**
 * Util that provides unique IDs.
 *
 * @class djs.util.IdGenerator
 * @constructor
 * @memberOf djs.util
 *
 * The ids can be customized via a given prefix and contain a random value to avoid collisions.
 *
 * @param {String} prefix a prefix to prepend to generated ids (for better readability)
 */
function IdGenerator(prefix) {

  this._counter = 0;
  this._prefix = (prefix ? prefix + '-' : '') + Math.floor(Math.random() * 1000000000) + '-';
}

module.exports = IdGenerator;

/**
 * Returns a next unique ID.
 *
 * @method djs.util.IdGenerator#next
 *
 * @returns {String} the id
 */
IdGenerator.prototype.next = function() {
  return this._prefix + (++this._counter);
};

},{}],174:[function(require,module,exports){
/* eslint no-fallthrough: "off" */

'use strict';

var has = 'hasOwnProperty',
    p2s = /,?([a-z]),?/gi,
    toFloat = parseFloat,
    math = Math,
    PI = math.PI,
    mmin = math.min,
    mmax = math.max,
    pow = math.pow,
    abs = math.abs,
    pathCommand = /([a-z])[\s,]*((-?\d*\.?\d*(?:e[\-+]?\d+)?[\s]*,?[\s]*)+)/ig,
    pathValues = /(-?\d*\.?\d*(?:e[\-+]?\\d+)?)[\s]*,?[\s]*/ig;

function is(o, type) {
  type = String.prototype.toLowerCase.call(type);

  if (type == 'finite') {
    return isFinite(o);
  }

  if (type == 'array' && (o instanceof Array || Array.isArray && Array.isArray(o))) {
    return true;
  }

  return  (type == 'null' && o === null) ||
          (type == typeof o && o !== null) ||
          (type == 'object' && o === Object(o)) ||
          Object.prototype.toString.call(o).slice(8, -1).toLowerCase() == type;
}

function clone(obj) {

  if (typeof obj == 'function' || Object(obj) !== obj) {
    return obj;
  }

  var res = new obj.constructor;

  for (var key in obj) if (obj[has](key)) {
    res[key] = clone(obj[key]);
  }

  return res;
}

function repush(array, item) {
  for (var i = 0, ii = array.length; i < ii; i++) if (array[i] === item) {
    return array.push(array.splice(i, 1)[0]);
  }
}

function cacher(f, scope, postprocessor) {

  function newf() {

    var arg = Array.prototype.slice.call(arguments, 0),
        args = arg.join('\u2400'),
        cache = newf.cache = newf.cache || {},
        count = newf.count = newf.count || [];

    if (cache[has](args)) {
      repush(count, args);
      return postprocessor ? postprocessor(cache[args]) : cache[args];
    }

    count.length >= 1e3 && delete cache[count.shift()];
    count.push(args);
    cache[args] = f.apply(scope, arg);

    return postprocessor ? postprocessor(cache[args]) : cache[args];
  }
  return newf;
}

function parsePathString(pathString) {

  if (!pathString) {
    return null;
  }

  var pth = paths(pathString);

  if (pth.arr) {
    return clone(pth.arr);
  }

  var paramCounts = { a: 7, c: 6, o: 2, h: 1, l: 2, m: 2, r: 4, q: 4, s: 4, t: 2, v: 1, u: 3, z: 0 },
      data = [];

  if (is(pathString, 'array') && is(pathString[0], 'array')) { // rough assumption
    data = clone(pathString);
  }

  if (!data.length) {

    String(pathString).replace(pathCommand, function(a, b, c) {
      var params = [],
          name = b.toLowerCase();

      c.replace(pathValues, function(a, b) {
        b && params.push(+b);
      });

      if (name == 'm' && params.length > 2) {
        data.push([b].concat(params.splice(0, 2)));
        name = 'l';
        b = b == 'm' ? 'l' : 'L';
      }

      if (name == 'o' && params.length == 1) {
        data.push([b, params[0]]);
      }

      if (name == 'r') {
        data.push([b].concat(params));
      } else while (params.length >= paramCounts[name]) {
        data.push([b].concat(params.splice(0, paramCounts[name])));
        if (!paramCounts[name]) {
          break;
        }
      }
    });
  }

  data.toString = paths.toString;
  pth.arr = clone(data);

  return data;
}

function paths(ps) {
  var p = paths.ps = paths.ps || {};

  if (p[ps]) {
    p[ps].sleep = 100;
  } else {
    p[ps] = {
      sleep: 100
    };
  }

  setTimeout(function() {
    for (var key in p) if (p[has](key) && key != ps) {
      p[key].sleep--;
      !p[key].sleep && delete p[key];
    }
  });

  return p[ps];
}

function box(x, y, width, height) {
  if (x == null) {
    x = y = width = height = 0;
  }

  if (y == null) {
    y = x.y;
    width = x.width;
    height = x.height;
    x = x.x;
  }

  return {
    x: x,
    y: y,
    width: width,
    w: width,
    height: height,
    h: height,
    x2: x + width,
    y2: y + height,
    cx: x + width / 2,
    cy: y + height / 2,
    r1: math.min(width, height) / 2,
    r2: math.max(width, height) / 2,
    r0: math.sqrt(width * width + height * height) / 2,
    path: rectPath(x, y, width, height),
    vb: [x, y, width, height].join(' ')
  };
}

function toString() {
  return this.join(',').replace(p2s, '$1');
}

function pathClone(pathArray) {
  var res = clone(pathArray);
  res.toString = toString;
  return res;
}

function getPointAtSegmentLength(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, length) {
  if (length == null) {
    return bezlen(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y);
  } else {
    return findDotsAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y,
      getTotLen(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, length));
  }
}

function getLengthFactory(istotal, subpath) {
  function O(val) {
    return +(+val).toFixed(3);
  }

  return cacher(function(path, length, onlystart) {

    if (path instanceof Element) {
      path = path.attr('d');
    }

    path = path2curve(path);

    var x, y, p, l, sp = '', subpaths = {}, point,
        len = 0;

    for (var i = 0, ii = path.length; i < ii; i++) {
      p = path[i];

      if (p[0] == 'M') {
        x = +p[1];
        y = +p[2];
      } else {
        l = getPointAtSegmentLength(x, y, p[1], p[2], p[3], p[4], p[5], p[6]);

        if (len + l > length) {

          if (subpath && !subpaths.start) {
            point = getPointAtSegmentLength(x, y, p[1], p[2], p[3], p[4], p[5], p[6], length - len);

            sp += [
              'C' + O(point.start.x),
              O(point.start.y),
              O(point.m.x),
              O(point.m.y),
              O(point.x),
              O(point.y)
            ];

            if (onlystart) {
              return sp;
            }

            subpaths.start = sp;
            sp = [
              'M' + O(point.x),
              O(point.y) + 'C' + O(point.n.x),
              O(point.n.y),
              O(point.end.x),
              O(point.end.y),
              O(p[5]),
              O(p[6])
            ].join();
            len += l;
            x = +p[5];
            y = +p[6];
            continue;
          }

          if (!istotal && !subpath) {
            point = getPointAtSegmentLength(x, y, p[1], p[2], p[3], p[4], p[5], p[6], length - len);
            return point;
          }
        }

        len += l;
        x = +p[5];
        y = +p[6];
      }

      sp += p.shift() + p;
    }

    subpaths.end = sp;
    point = istotal ? len : subpath ? subpaths : findDotsAtSegment(x, y, p[0], p[1], p[2], p[3], p[4], p[5], 1);
    return point;
  }, null, clone);
}

var getTotalLength = getLengthFactory(1),
    getPointAtLength = getLengthFactory();

function findDotsAtSegment(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y, t) {
  var t1 = 1 - t,
      t13 = pow(t1, 3),
      t12 = pow(t1, 2),
      t2 = t * t,
      t3 = t2 * t,
      x = t13 * p1x + t12 * 3 * t * c1x + t1 * 3 * t * t * c2x + t3 * p2x,
      y = t13 * p1y + t12 * 3 * t * c1y + t1 * 3 * t * t * c2y + t3 * p2y,
      mx = p1x + 2 * t * (c1x - p1x) + t2 * (c2x - 2 * c1x + p1x),
      my = p1y + 2 * t * (c1y - p1y) + t2 * (c2y - 2 * c1y + p1y),
      nx = c1x + 2 * t * (c2x - c1x) + t2 * (p2x - 2 * c2x + c1x),
      ny = c1y + 2 * t * (c2y - c1y) + t2 * (p2y - 2 * c2y + c1y),
      ax = t1 * p1x + t * c1x,
      ay = t1 * p1y + t * c1y,
      cx = t1 * c2x + t * p2x,
      cy = t1 * c2y + t * p2y,
      alpha = (90 - math.atan2(mx - nx, my - ny) * 180 / PI);

  // (mx > nx || my < ny) && (alpha += 180);

  return {
    x: x,
    y: y,
    m: { x: mx, y: my },
    n: { x: nx, y: ny },
    start: { x: ax, y: ay },
    end: { x: cx, y: cy },
    alpha: alpha
  };
}

function bezierBBox(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y) {

  if (!is(p1x, 'array')) {
    p1x = [p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y];
  }

  var bbox = curveDim.apply(null, p1x);

  return box(
    bbox.min.x,
    bbox.min.y,
    bbox.max.x - bbox.min.x,
    bbox.max.y - bbox.min.y
  );
}

function isPointInsideBBox(bbox, x, y) {
  return x >= bbox.x &&
    x <= bbox.x + bbox.width &&
    y >= bbox.y &&
    y <= bbox.y + bbox.height;
}

function isBBoxIntersect(bbox1, bbox2) {
  bbox1 = box(bbox1);
  bbox2 = box(bbox2);
  return isPointInsideBBox(bbox2, bbox1.x, bbox1.y)
    || isPointInsideBBox(bbox2, bbox1.x2, bbox1.y)
    || isPointInsideBBox(bbox2, bbox1.x, bbox1.y2)
    || isPointInsideBBox(bbox2, bbox1.x2, bbox1.y2)
    || isPointInsideBBox(bbox1, bbox2.x, bbox2.y)
    || isPointInsideBBox(bbox1, bbox2.x2, bbox2.y)
    || isPointInsideBBox(bbox1, bbox2.x, bbox2.y2)
    || isPointInsideBBox(bbox1, bbox2.x2, bbox2.y2)
    || (bbox1.x < bbox2.x2 && bbox1.x > bbox2.x
        || bbox2.x < bbox1.x2 && bbox2.x > bbox1.x)
    && (bbox1.y < bbox2.y2 && bbox1.y > bbox2.y
        || bbox2.y < bbox1.y2 && bbox2.y > bbox1.y);
}

function base3(t, p1, p2, p3, p4) {
  var t1 = -3 * p1 + 9 * p2 - 9 * p3 + 3 * p4,
      t2 = t * t1 + 6 * p1 - 12 * p2 + 6 * p3;
  return t * t2 - 3 * p1 + 3 * p2;
}

function bezlen(x1, y1, x2, y2, x3, y3, x4, y4, z) {

  if (z == null) {
    z = 1;
  }

  z = z > 1 ? 1 : z < 0 ? 0 : z;

  var z2 = z / 2,
      n = 12,
      Tvalues = [-.1252,.1252,-.3678,.3678,-.5873,.5873,-.7699,.7699,-.9041,.9041,-.9816,.9816],
      Cvalues = [0.2491,0.2491,0.2335,0.2335,0.2032,0.2032,0.1601,0.1601,0.1069,0.1069,0.0472,0.0472],
      sum = 0;

  for (var i = 0; i < n; i++) {
    var ct = z2 * Tvalues[i] + z2,
        xbase = base3(ct, x1, x2, x3, x4),
        ybase = base3(ct, y1, y2, y3, y4),
        comb = xbase * xbase + ybase * ybase;

    sum += Cvalues[i] * math.sqrt(comb);
  }

  return z2 * sum;
}

function getTotLen(x1, y1, x2, y2, x3, y3, x4, y4, ll) {

  if (ll < 0 || bezlen(x1, y1, x2, y2, x3, y3, x4, y4) < ll) {
    return;
  }

  var t = 1,
      step = t / 2,
      t2 = t - step,
      l,
      e = .01;

  l = bezlen(x1, y1, x2, y2, x3, y3, x4, y4, t2);

  while (abs(l - ll) > e) {
    step /= 2;
    t2 += (l < ll ? 1 : -1) * step;
    l = bezlen(x1, y1, x2, y2, x3, y3, x4, y4, t2);
  }

  return t2;
}

function intersect(x1, y1, x2, y2, x3, y3, x4, y4) {

  if (
      mmax(x1, x2) < mmin(x3, x4) ||
      mmin(x1, x2) > mmax(x3, x4) ||
      mmax(y1, y2) < mmin(y3, y4) ||
      mmin(y1, y2) > mmax(y3, y4)
  ) {
    return;
  }

  var nx = (x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4),
      ny = (x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4),
      denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (!denominator) {
    return;
  }

  var px = nx / denominator,
      py = ny / denominator,
      px2 = +px.toFixed(2),
      py2 = +py.toFixed(2);

  if (
      px2 < +mmin(x1, x2).toFixed(2) ||
      px2 > +mmax(x1, x2).toFixed(2) ||
      px2 < +mmin(x3, x4).toFixed(2) ||
      px2 > +mmax(x3, x4).toFixed(2) ||
      py2 < +mmin(y1, y2).toFixed(2) ||
      py2 > +mmax(y1, y2).toFixed(2) ||
      py2 < +mmin(y3, y4).toFixed(2) ||
      py2 > +mmax(y3, y4).toFixed(2)
  ) {
    return;
  }

  return { x: px, y: py };
}

function interHelper(bez1, bez2, justCount) {
  var bbox1 = bezierBBox(bez1),
      bbox2 = bezierBBox(bez2);

  if (!isBBoxIntersect(bbox1, bbox2)) {
    return justCount ? 0 : [];
  }

  var l1 = bezlen.apply(0, bez1),
      l2 = bezlen.apply(0, bez2),
      n1 = ~~(l1 / 8),
      n2 = ~~(l2 / 8),
      dots1 = [],
      dots2 = [],
      xy = {},
      res = justCount ? 0 : [];

  for (var i = 0; i < n1 + 1; i++) {
    var p = findDotsAtSegment.apply(0, bez1.concat(i / n1));
    dots1.push({ x: p.x, y: p.y, t: i / n1 });
  }

  for (i = 0; i < n2 + 1; i++) {
    p = findDotsAtSegment.apply(0, bez2.concat(i / n2));
    dots2.push({ x: p.x, y: p.y, t: i / n2 });
  }

  for (i = 0; i < n1; i++) {

    for (var j = 0; j < n2; j++) {
      var di = dots1[i],
          di1 = dots1[i + 1],
          dj = dots2[j],
          dj1 = dots2[j + 1],
          ci = abs(di1.x - di.x) < .001 ? 'y' : 'x',
          cj = abs(dj1.x - dj.x) < .001 ? 'y' : 'x',
          is = intersect(di.x, di.y, di1.x, di1.y, dj.x, dj.y, dj1.x, dj1.y);

      if (is) {

        if (xy[is.x.toFixed(4)] == is.y.toFixed(4)) {
          continue;
        }

        xy[is.x.toFixed(4)] = is.y.toFixed(4);

        var t1 = di.t + abs((is[ci] - di[ci]) / (di1[ci] - di[ci])) * (di1.t - di.t),
            t2 = dj.t + abs((is[cj] - dj[cj]) / (dj1[cj] - dj[cj])) * (dj1.t - dj.t);

        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {

          if (justCount) {
            res++;
          } else {
            res.push({
              x: is.x,
              y: is.y,
              t1: t1,
              t2: t2
            });
          }
        }
      }
    }
  }

  return res;
}

function pathIntersection(path1, path2) {
  return interPathHelper(path1, path2);
}

function pathIntersectionNumber(path1, path2) {
  return interPathHelper(path1, path2, 1);
}

function interPathHelper(path1, path2, justCount) {
  path1 = path2curve(path1);
  path2 = path2curve(path2);

  var x1, y1, x2, y2, x1m, y1m, x2m, y2m, bez1, bez2,
      res = justCount ? 0 : [];

  for (var i = 0, ii = path1.length; i < ii; i++) {
    var pi = path1[i];

    if (pi[0] == 'M') {
      x1 = x1m = pi[1];
      y1 = y1m = pi[2];
    } else {

      if (pi[0] == 'C') {
        bez1 = [x1, y1].concat(pi.slice(1));
        x1 = bez1[6];
        y1 = bez1[7];
      } else {
        bez1 = [x1, y1, x1, y1, x1m, y1m, x1m, y1m];
        x1 = x1m;
        y1 = y1m;
      }

      for (var j = 0, jj = path2.length; j < jj; j++) {
        var pj = path2[j];

        if (pj[0] == 'M') {
          x2 = x2m = pj[1];
          y2 = y2m = pj[2];
        } else {

          if (pj[0] == 'C') {
            bez2 = [x2, y2].concat(pj.slice(1));
            x2 = bez2[6];
            y2 = bez2[7];
          } else {
            bez2 = [x2, y2, x2, y2, x2m, y2m, x2m, y2m];
            x2 = x2m;
            y2 = y2m;
          }

          var intr = interHelper(bez1, bez2, justCount);

          if (justCount) {
            res += intr;
          } else {

            for (var k = 0, kk = intr.length; k < kk; k++) {
              intr[k].segment1 = i;
              intr[k].segment2 = j;
              intr[k].bez1 = bez1;
              intr[k].bez2 = bez2;
            }

            res = res.concat(intr);
          }
        }
      }
    }
  }

  return res;
}

function isPointInsidePath(path, x, y) {
  var bbox = pathBBox(path);

  return isPointInsideBBox(bbox, x, y) &&
         interPathHelper(path, [['M', x, y], ['H', bbox.x2 + 10]], 1) % 2 == 1;
}

function pathBBox(path) {
  var pth = paths(path);

  if (pth.bbox) {
    return clone(pth.bbox);
  }

  if (!path) {
    return box();
  }

  path = path2curve(path);

  var x = 0,
      y = 0,
      X = [],
      Y = [],
      p;

  for (var i = 0, ii = path.length; i < ii; i++) {
    p = path[i];

    if (p[0] == 'M') {
      x = p[1];
      y = p[2];
      X.push(x);
      Y.push(y);
    } else {
      var dim = curveDim(x, y, p[1], p[2], p[3], p[4], p[5], p[6]);
      X = X.concat(dim.min.x, dim.max.x);
      Y = Y.concat(dim.min.y, dim.max.y);
      x = p[5];
      y = p[6];
    }
  }

  var xmin = mmin.apply(0, X),
      ymin = mmin.apply(0, Y),
      xmax = mmax.apply(0, X),
      ymax = mmax.apply(0, Y),
      bb = box(xmin, ymin, xmax - xmin, ymax - ymin);

  pth.bbox = clone(bb);

  return bb;
}

function rectPath(x, y, w, h, r) {
  if (r) {
    return [
      ['M', +x + (+r), y],
      ['l', w - r * 2, 0],
      ['a', r, r, 0, 0, 1, r, r],
      ['l', 0, h - r * 2],
      ['a', r, r, 0, 0, 1, -r, r],
      ['l', r * 2 - w, 0],
      ['a', r, r, 0, 0, 1, -r, -r],
      ['l', 0, r * 2 - h],
      ['a', r, r, 0, 0, 1, r, -r],
      ['z']
    ];
  }

  var res = [['M', x, y], ['l', w, 0], ['l', 0, h], ['l', -w, 0], ['z']];
  res.toString = toString;

  return res;
}

function ellipsePath(x, y, rx, ry, a) {
  if (a == null && ry == null) {
    ry = rx;
  }

  x = +x;
  y = +y;
  rx = +rx;
  ry = +ry;

  if (a != null) {
    var rad = Math.PI / 180,
        x1 = x + rx * Math.cos(-ry * rad),
        x2 = x + rx * Math.cos(-a * rad),
        y1 = y + rx * Math.sin(-ry * rad),
        y2 = y + rx * Math.sin(-a * rad),
        res = [['M', x1, y1], ['A', rx, rx, 0, +(a - ry > 180), 0, x2, y2]];
  } else {
    res = [
      ['M', x, y],
      ['m', 0, -ry],
      ['a', rx, ry, 0, 1, 1, 0, 2 * ry],
      ['a', rx, ry, 0, 1, 1, 0, -2 * ry],
      ['z']
    ];
  }

  res.toString = toString;

  return res;
}

function pathToRelative(pathArray) {
  var pth = paths(pathArray),
      lowerCase = String.prototype.toLowerCase;

  if (pth.rel) {
    return pathClone(pth.rel);
  }

  if (!is(pathArray, 'array') || !is(pathArray && pathArray[0], 'array')) {
    pathArray = parsePathString(pathArray);
  }

  var res = [],
      x = 0,
      y = 0,
      mx = 0,
      my = 0,
      start = 0;

  if (pathArray[0][0] == 'M') {
    x = pathArray[0][1];
    y = pathArray[0][2];
    mx = x;
    my = y;
    start++;
    res.push(['M', x, y]);
  }

  for (var i = start, ii = pathArray.length; i < ii; i++) {
    var r = res[i] = [],
        pa = pathArray[i];

    if (pa[0] != lowerCase.call(pa[0])) {
      r[0] = lowerCase.call(pa[0]);

      switch (r[0]) {
      case 'a':
        r[1] = pa[1];
        r[2] = pa[2];
        r[3] = pa[3];
        r[4] = pa[4];
        r[5] = pa[5];
        r[6] = +(pa[6] - x).toFixed(3);
        r[7] = +(pa[7] - y).toFixed(3);
        break;
      case 'v':
        r[1] = +(pa[1] - y).toFixed(3);
        break;
      case 'm':
        mx = pa[1];
        my = pa[2];
      default:
        for (var j = 1, jj = pa.length; j < jj; j++) {
          r[j] = +(pa[j] - ((j % 2) ? x : y)).toFixed(3);
        }
      }
    } else {
      r = res[i] = [];

      if (pa[0] == 'm') {
        mx = pa[1] + x;
        my = pa[2] + y;
      }

      for (var k = 0, kk = pa.length; k < kk; k++) {
        res[i][k] = pa[k];
      }
    }

    var len = res[i].length;

    switch (res[i][0]) {
    case 'z':
      x = mx;
      y = my;
      break;
    case 'h':
      x += +res[i][len - 1];
      break;
    case 'v':
      y += +res[i][len - 1];
      break;
    default:
      x += +res[i][len - 2];
      y += +res[i][len - 1];
    }
  }

  res.toString = toString;
  pth.rel = pathClone(res);

  return res;
}

function pathToAbsolute(pathArray) {
  var pth = paths(pathArray);

  if (pth.abs) {
    return pathClone(pth.abs);
  }

  if (!is(pathArray, 'array') || !is(pathArray && pathArray[0], 'array')) { // rough assumption
    pathArray = parsePathString(pathArray);
  }

  if (!pathArray || !pathArray.length) {
    return [['M', 0, 0]];
  }

  var res = [],
      x = 0,
      y = 0,
      mx = 0,
      my = 0,
      start = 0,
      pa0;

  if (pathArray[0][0] == 'M') {
    x = +pathArray[0][1];
    y = +pathArray[0][2];
    mx = x;
    my = y;
    start++;
    res[0] = ['M', x, y];
  }

  var crz = pathArray.length == 3 &&
      pathArray[0][0] == 'M' &&
      pathArray[1][0].toUpperCase() == 'R' &&
      pathArray[2][0].toUpperCase() == 'Z';

  for (var r, pa, i = start, ii = pathArray.length; i < ii; i++) {
    res.push(r = []);
    pa = pathArray[i];
    pa0 = pa[0];

    if (pa0 != pa0.toUpperCase()) {
      r[0] = pa0.toUpperCase();

      switch (r[0]) {
      case 'A':
        r[1] = pa[1];
        r[2] = pa[2];
        r[3] = pa[3];
        r[4] = pa[4];
        r[5] = pa[5];
        r[6] = +pa[6] + x;
        r[7] = +pa[7] + y;
        break;
      case 'V':
        r[1] = +pa[1] + y;
        break;
      case 'H':
        r[1] = +pa[1] + x;
        break;
      case 'R':
        var dots = [x, y].concat(pa.slice(1));

        for (var j = 2, jj = dots.length; j < jj; j++) {
          dots[j] = +dots[j] + x;
          dots[++j] = +dots[j] + y;
        }

        res.pop();
        res = res.concat(catmullRom2bezier(dots, crz));
        break;
      case 'O':
        res.pop();
        dots = ellipsePath(x, y, pa[1], pa[2]);
        dots.push(dots[0]);
        res = res.concat(dots);
        break;
      case 'U':
        res.pop();
        res = res.concat(ellipsePath(x, y, pa[1], pa[2], pa[3]));
        r = ['U'].concat(res[res.length - 1].slice(-2));
        break;
      case 'M':
        mx = +pa[1] + x;
        my = +pa[2] + y;
      default:

        for (j = 1, jj = pa.length; j < jj; j++) {
          r[j] = +pa[j] + ((j % 2) ? x : y);
        }
      }
    } else if (pa0 == 'R') {
      dots = [x, y].concat(pa.slice(1));
      res.pop();
      res = res.concat(catmullRom2bezier(dots, crz));
      r = ['R'].concat(pa.slice(-2));
    } else if (pa0 == 'O') {
      res.pop();
      dots = ellipsePath(x, y, pa[1], pa[2]);
      dots.push(dots[0]);
      res = res.concat(dots);
    } else if (pa0 == 'U') {
      res.pop();
      res = res.concat(ellipsePath(x, y, pa[1], pa[2], pa[3]));
      r = ['U'].concat(res[res.length - 1].slice(-2));
    } else {

      for (var k = 0, kk = pa.length; k < kk; k++) {
        r[k] = pa[k];
      }
    }
    pa0 = pa0.toUpperCase();

    if (pa0 != 'O') {
      switch (r[0]) {
      case 'Z':
        x = +mx;
        y = +my;
        break;
      case 'H':
        x = r[1];
        break;
      case 'V':
        y = r[1];
        break;
      case 'M':
        mx = r[r.length - 2];
        my = r[r.length - 1];
      default:
        x = r[r.length - 2];
        y = r[r.length - 1];
      }
    }
  }

  res.toString = toString;
  pth.abs = pathClone(res);

  return res;
}

function l2c(x1, y1, x2, y2) {
  return [x1, y1, x2, y2, x2, y2];
}

function q2c(x1, y1, ax, ay, x2, y2) {
  var _13 = 1 / 3,
      _23 = 2 / 3;

  return [
    _13 * x1 + _23 * ax,
    _13 * y1 + _23 * ay,
    _13 * x2 + _23 * ax,
    _13 * y2 + _23 * ay,
    x2,
    y2
  ];
}

function a2c(x1, y1, rx, ry, angle, large_arc_flag, sweep_flag, x2, y2, recursive) {

  // for more information of where this math came from visit:
  // http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
  var _120 = PI * 120 / 180,
      rad = PI / 180 * (+angle || 0),
      res = [],
      xy,
      rotate = cacher(function(x, y, rad) {
        var X = x * math.cos(rad) - y * math.sin(rad),
            Y = x * math.sin(rad) + y * math.cos(rad);

        return { x: X, y: Y };
      });

  if (!recursive) {
    xy = rotate(x1, y1, -rad);
    x1 = xy.x;
    y1 = xy.y;
    xy = rotate(x2, y2, -rad);
    x2 = xy.x;
    y2 = xy.y;

    var x = (x1 - x2) / 2,
        y = (y1 - y2) / 2;

    var h = (x * x) / (rx * rx) + (y * y) / (ry * ry);

    if (h > 1) {
      h = math.sqrt(h);
      rx = h * rx;
      ry = h * ry;
    }

    var rx2 = rx * rx,
        ry2 = ry * ry,
        k = (large_arc_flag == sweep_flag ? -1 : 1) *
            math.sqrt(abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x))),
        cx = k * rx * y / ry + (x1 + x2) / 2,
        cy = k * -ry * x / rx + (y1 + y2) / 2,
        f1 = math.asin(((y1 - cy) / ry).toFixed(9)),
        f2 = math.asin(((y2 - cy) / ry).toFixed(9));

    f1 = x1 < cx ? PI - f1 : f1;
    f2 = x2 < cx ? PI - f2 : f2;
    f1 < 0 && (f1 = PI * 2 + f1);
    f2 < 0 && (f2 = PI * 2 + f2);

    if (sweep_flag && f1 > f2) {
      f1 = f1 - PI * 2;
    }
    if (!sweep_flag && f2 > f1) {
      f2 = f2 - PI * 2;
    }
  } else {
    f1 = recursive[0];
    f2 = recursive[1];
    cx = recursive[2];
    cy = recursive[3];
  }

  var df = f2 - f1;

  if (abs(df) > _120) {
    var f2old = f2,
        x2old = x2,
        y2old = y2;

    f2 = f1 + _120 * (sweep_flag && f2 > f1 ? 1 : -1);
    x2 = cx + rx * math.cos(f2);
    y2 = cy + ry * math.sin(f2);
    res = a2c(x2, y2, rx, ry, angle, 0, sweep_flag, x2old, y2old, [f2, f2old, cx, cy]);
  }

  df = f2 - f1;

  var c1 = math.cos(f1),
      s1 = math.sin(f1),
      c2 = math.cos(f2),
      s2 = math.sin(f2),
      t = math.tan(df / 4),
      hx = 4 / 3 * rx * t,
      hy = 4 / 3 * ry * t,
      m1 = [x1, y1],
      m2 = [x1 + hx * s1, y1 - hy * c1],
      m3 = [x2 + hx * s2, y2 - hy * c2],
      m4 = [x2, y2];

  m2[0] = 2 * m1[0] - m2[0];
  m2[1] = 2 * m1[1] - m2[1];

  if (recursive) {
    return [m2, m3, m4].concat(res);
  } else {
    res = [m2, m3, m4].concat(res).join().split(',');
    var newres = [];

    for (var i = 0, ii = res.length; i < ii; i++) {
      newres[i] = i % 2 ? rotate(res[i - 1], res[i], rad).y : rotate(res[i], res[i + 1], rad).x;
    }

    return newres;
  }
}

// Returns bounding box of cubic bezier curve.
// Source: http://blog.hackers-cafe.net/2009/06/how-to-calculate-bezier-curves-bounding.html
// Original version: NISHIO Hirokazu
// Modifications: https://github.com/timo22345
function curveDim(x0, y0, x1, y1, x2, y2, x3, y3) {
  var tvalues = [],
      bounds = [[], []],
      a, b, c, t, t1, t2, b2ac, sqrtb2ac;

  for (var i = 0; i < 2; ++i) {

    if (i == 0) {
      b = 6 * x0 - 12 * x1 + 6 * x2;
      a = -3 * x0 + 9 * x1 - 9 * x2 + 3 * x3;
      c = 3 * x1 - 3 * x0;
    } else {
      b = 6 * y0 - 12 * y1 + 6 * y2;
      a = -3 * y0 + 9 * y1 - 9 * y2 + 3 * y3;
      c = 3 * y1 - 3 * y0;
    }

    if (abs(a) < 1e-12) {

      if (abs(b) < 1e-12) {
        continue;
      }

      t = -c / b;

      if (0 < t && t < 1) {
        tvalues.push(t);
      }

      continue;
    }

    b2ac = b * b - 4 * c * a;
    sqrtb2ac = math.sqrt(b2ac);

    if (b2ac < 0) {
      continue;
    }

    t1 = (-b + sqrtb2ac) / (2 * a);

    if (0 < t1 && t1 < 1) {
      tvalues.push(t1);
    }

    t2 = (-b - sqrtb2ac) / (2 * a);

    if (0 < t2 && t2 < 1) {
      tvalues.push(t2);
    }
  }

  var j = tvalues.length,
      jlen = j,
      mt;

  while (j--) {
    t = tvalues[j];
    mt = 1 - t;
    bounds[0][j] = (mt * mt * mt * x0) + (3 * mt * mt * t * x1) + (3 * mt * t * t * x2) + (t * t * t * x3);
    bounds[1][j] = (mt * mt * mt * y0) + (3 * mt * mt * t * y1) + (3 * mt * t * t * y2) + (t * t * t * y3);
  }

  bounds[0][jlen] = x0;
  bounds[1][jlen] = y0;
  bounds[0][jlen + 1] = x3;
  bounds[1][jlen + 1] = y3;
  bounds[0].length = bounds[1].length = jlen + 2;

  return {
    min: { x: mmin.apply(0, bounds[0]), y: mmin.apply(0, bounds[1]) },
    max: { x: mmax.apply(0, bounds[0]), y: mmax.apply(0, bounds[1]) }
  };
}

function path2curve(path, path2) {
  var pth = !path2 && paths(path);

  if (!path2 && pth.curve) {
    return pathClone(pth.curve);
  }

  var p = pathToAbsolute(path),
      p2 = path2 && pathToAbsolute(path2),
      attrs = { x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null },
      attrs2 = { x: 0, y: 0, bx: 0, by: 0, X: 0, Y: 0, qx: null, qy: null },
      processPath = function(path, d, pcom) {
        var nx, ny;

        if (!path) {
          return ['C', d.x, d.y, d.x, d.y, d.x, d.y];
        }

        !(path[0] in { T: 1, Q: 1 }) && (d.qx = d.qy = null);

        switch (path[0]) {
        case 'M':
          d.X = path[1];
          d.Y = path[2];
          break;
        case 'A':
          path = ['C'].concat(a2c.apply(0, [d.x, d.y].concat(path.slice(1))));
          break;
        case 'S':
          if (pcom == 'C' || pcom == 'S') { // In 'S' case we have to take into account, if the previous command is C/S.
            nx = d.x * 2 - d.bx;          // And reflect the previous
            ny = d.y * 2 - d.by;          // command's control point relative to the current point.
          }
          else {                            // or some else or nothing
            nx = d.x;
            ny = d.y;
          }
          path = ['C', nx, ny].concat(path.slice(1));
          break;
        case 'T':
          if (pcom == 'Q' || pcom == 'T') { // In 'T' case we have to take into account, if the previous command is Q/T.
            d.qx = d.x * 2 - d.qx;        // And make a reflection similar
            d.qy = d.y * 2 - d.qy;        // to case 'S'.
          }
          else {                            // or something else or nothing
            d.qx = d.x;
            d.qy = d.y;
          }
          path = ['C'].concat(q2c(d.x, d.y, d.qx, d.qy, path[1], path[2]));
          break;
        case 'Q':
          d.qx = path[1];
          d.qy = path[2];
          path = ['C'].concat(q2c(d.x, d.y, path[1], path[2], path[3], path[4]));
          break;
        case 'L':
          path = ['C'].concat(l2c(d.x, d.y, path[1], path[2]));
          break;
        case 'H':
          path = ['C'].concat(l2c(d.x, d.y, path[1], d.y));
          break;
        case 'V':
          path = ['C'].concat(l2c(d.x, d.y, d.x, path[1]));
          break;
        case 'Z':
          path = ['C'].concat(l2c(d.x, d.y, d.X, d.Y));
          break;
        }

        return path;
      },

      fixArc = function(pp, i) {

        if (pp[i].length > 7) {
          pp[i].shift();
          var pi = pp[i];

          while (pi.length) {
            pcoms1[i] = 'A'; // if created multiple C:s, their original seg is saved
            p2 && (pcoms2[i] = 'A'); // the same as above
            pp.splice(i++, 0, ['C'].concat(pi.splice(0, 6)));
          }

          pp.splice(i, 1);
          ii = mmax(p.length, p2 && p2.length || 0);
        }
      },

      fixM = function(path1, path2, a1, a2, i) {

        if (path1 && path2 && path1[i][0] == 'M' && path2[i][0] != 'M') {
          path2.splice(i, 0, ['M', a2.x, a2.y]);
          a1.bx = 0;
          a1.by = 0;
          a1.x = path1[i][1];
          a1.y = path1[i][2];
          ii = mmax(p.length, p2 && p2.length || 0);
        }
      },

      pcoms1 = [], // path commands of original path p
      pcoms2 = [], // path commands of original path p2
      pfirst = '', // temporary holder for original path command
      pcom = ''; // holder for previous path command of original path

  for (var i = 0, ii = mmax(p.length, p2 && p2.length || 0); i < ii; i++) {
    p[i] && (pfirst = p[i][0]); // save current path command

    if (pfirst != 'C') // C is not saved yet, because it may be result of conversion
    {
      pcoms1[i] = pfirst; // Save current path command
      i && ( pcom = pcoms1[i - 1]); // Get previous path command pcom
    }
    p[i] = processPath(p[i], attrs, pcom); // Previous path command is inputted to processPath

    if (pcoms1[i] != 'A' && pfirst == 'C') pcoms1[i] = 'C'; // A is the only command
    // which may produce multiple C:s
    // so we have to make sure that C is also C in original path

    fixArc(p, i); // fixArc adds also the right amount of A:s to pcoms1

    if (p2) { // the same procedures is done to p2
      p2[i] && (pfirst = p2[i][0]);

      if (pfirst != 'C') {
        pcoms2[i] = pfirst;
        i && (pcom = pcoms2[i - 1]);
      }

      p2[i] = processPath(p2[i], attrs2, pcom);

      if (pcoms2[i] != 'A' && pfirst == 'C') {
        pcoms2[i] = 'C';
      }

      fixArc(p2, i);
    }

    fixM(p, p2, attrs, attrs2, i);
    fixM(p2, p, attrs2, attrs, i);

    var seg = p[i],
        seg2 = p2 && p2[i],
        seglen = seg.length,
        seg2len = p2 && seg2.length;

    attrs.x = seg[seglen - 2];
    attrs.y = seg[seglen - 1];
    attrs.bx = toFloat(seg[seglen - 4]) || attrs.x;
    attrs.by = toFloat(seg[seglen - 3]) || attrs.y;
    attrs2.bx = p2 && (toFloat(seg2[seg2len - 4]) || attrs2.x);
    attrs2.by = p2 && (toFloat(seg2[seg2len - 3]) || attrs2.y);
    attrs2.x = p2 && seg2[seg2len - 2];
    attrs2.y = p2 && seg2[seg2len - 1];
  }

  if (!p2) {
    pth.curve = pathClone(p);
  }

  return p2 ? [p, p2] : p;
}

function mapPath(path, matrix) {

  if (!matrix) {
    return path;
  }

  var x, y, i, j, ii, jj, pathi;
  path = path2curve(path);

  for (i = 0, ii = path.length; i < ii; i++) {
    pathi = path[i];

    for (j = 1, jj = pathi.length; j < jj; j += 2) {
      x = matrix.x(pathi[j], pathi[j + 1]);
      y = matrix.y(pathi[j], pathi[j + 1]);
      pathi[j] = x;
      pathi[j + 1] = y;
    }
  }

  return path;
}

// http://schepers.cc/getting-to-the-point
function catmullRom2bezier(crp, z) {
  var d = [];

  for (var i = 0, iLen = crp.length; iLen - 2 * !z > i; i += 2) {
    var p = [
      { x: +crp[i - 2], y: +crp[i - 1] },
      { x: +crp[i],     y: +crp[i + 1] },
      { x: +crp[i + 2], y: +crp[i + 3] },
      { x: +crp[i + 4], y: +crp[i + 5] }
    ];

    if (z) {

      if (!i) {
        p[0] = { x: +crp[iLen - 2], y: +crp[iLen - 1] };
      } else if (iLen - 4 == i) {
        p[3] = { x: +crp[0], y: +crp[1] };
      } else if (iLen - 2 == i) {
        p[2] = { x: +crp[0], y: +crp[1] };
        p[3] = { x: +crp[2], y: +crp[3] };
      }

    } else {

      if (iLen - 4 == i) {
        p[3] = p[2];
      } else if (!i) {
        p[0] = { x: +crp[i], y: +crp[i + 1] };
      }

    }

    d.push(['C',
      (-p[0].x + 6 * p[1].x + p[2].x) / 6,
      (-p[0].y + 6 * p[1].y + p[2].y) / 6,
      (p[1].x + 6 * p[2].x - p[3].x) / 6,
      (p[1].y + 6*p[2].y - p[3].y) / 6,
      p[2].x,
      p[2].y
    ]);
  }

  return d;
}

paths.getTotalLength = getTotalLength;
paths.getPointAtLength = getPointAtLength;
paths.findDotsAtSegment = findDotsAtSegment;
paths.bezierBBox = bezierBBox;
paths.isPointInsideBBox = isPointInsideBBox;
paths.isBBoxIntersect = isBBoxIntersect;
paths.intersection = pathIntersection;
paths.intersectionNumber = pathIntersectionNumber;
paths.isPointInside = isPointInsidePath;
paths.getBBox = pathBBox;
paths.toRelative = pathToRelative;
paths.toAbsolute = pathToAbsolute;
paths.toCubic = path2curve;
paths.map = mapPath;
paths.toString = toString;
paths.clone = pathClone;

module.exports.intersection = pathIntersection;

},{}],175:[function(require,module,exports){
'use strict';

var pointDistance = require('./Geometry').pointDistance;

var intersection = require('./Intersection').intersection;

var round = Math.round,
    max = Math.max;


function circlePath(center, r) {
  var x = center.x,
      y = center.y;

  return [
    ['M', x, y],
    ['m', 0, -r],
    ['a', r, r, 0, 1, 1, 0, 2 * r],
    ['a', r, r, 0, 1, 1, 0, -2 * r],
    ['z']
  ];
}

function linePath(points) {
  var segments = [];

  points.forEach(function(p, idx) {
    segments.push([ idx === 0 ? 'M' : 'L', p.x, p.y ]);
  });

  return segments;
}


var INTERSECTION_THRESHOLD = 10;

function getBendpointIntersection(waypoints, reference) {

  var i, w;

  for (i = 0; (w = waypoints[i]); i++) {

    if (pointDistance(w, reference) <= INTERSECTION_THRESHOLD) {
      return {
        point: waypoints[i],
        bendpoint: true,
        index: i
      };
    }
  }

  return null;
}

function getPathIntersection(waypoints, reference) {

  var intersections = intersection(circlePath(reference, INTERSECTION_THRESHOLD), linePath(waypoints));

  var a = intersections[0],
      b = intersections[intersections.length - 1],
      idx;

  if (!a) {
    // no intersection
    return null;
  }

  if (a !== b) {

    if (a.segment2 !== b.segment2) {
      // we use the bendpoint in between both segments
      // as the intersection point

      idx = max(a.segment2, b.segment2) - 1;

      return {
        point: waypoints[idx],
        bendpoint: true,
        index: idx
      };
    }

    return {
      point: {
        x: (round(a.x + b.x) / 2),
        y: (round(a.y + b.y) / 2)
      },
      index: a.segment2
    };
  }

  return {
    point: {
      x: round(a.x),
      y: round(a.y)
    },
    index: a.segment2
  };
}

/**
 * Returns the closest point on the connection towards a given reference point.
 *
 * @param  {Array<Point>} waypoints
 * @param  {Point} reference
 *
 * @return {Object} intersection data (segment, point)
 */
module.exports.getApproxIntersection = function(waypoints, reference) {
  return getBendpointIntersection(waypoints, reference) || getPathIntersection(waypoints, reference);
};

},{"./Geometry":171,"./Intersection":174}],176:[function(require,module,exports){
'use strict';

var getOriginalEvent = require('./Event').getOriginal;

var isMac = require('./Platform').isMac;


function isPrimaryButton(event) {
  // button === 0 -> left áka primary mouse button
  return !(getOriginalEvent(event) || event).button;
}

module.exports.isPrimaryButton = isPrimaryButton;

module.exports.isMac = isMac;

module.exports.hasPrimaryModifier = function(event) {
  var originalEvent = getOriginalEvent(event) || event;

  if (!isPrimaryButton(event)) {
    return false;
  }

  // Use alt as primary modifier key for mac OS
  if (isMac()) {
    return originalEvent.metaKey;
  } else {
    return originalEvent.ctrlKey;
  }
};


module.exports.hasSecondaryModifier = function(event) {
  var originalEvent = getOriginalEvent(event) || event;

  return isPrimaryButton(event) && originalEvent.shiftKey;
};

},{"./Event":170,"./Platform":177}],177:[function(require,module,exports){
'use strict';

module.exports.isMac = function isMac() {
  return (/mac/i).test(navigator.platform);
};
},{}],178:[function(require,module,exports){
'use strict';

function center(bounds) {
  return {
    x: bounds.x + (bounds.width / 2),
    y: bounds.y + (bounds.height / 2)
  };
}

module.exports.center = center;


function delta(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  };
}

module.exports.delta = delta;

},{}],179:[function(require,module,exports){
'use strict';


/**
 * Remove from the beginning of a collection until it is empty.
 *
 * This is a null-safe operation that ensures elements
 * are being removed from the given collection until the
 * collection is empty.
 *
 * The implementation deals with the fact that a remove operation
 * may touch, i.e. remove multiple elements in the collection
 * at a time.
 *
 * @param {Array<Object>} [collection]
 * @param {Function} removeFn
 *
 * @return {Array<Object>} the cleared collection
 */
module.exports.saveClear = function(collection, removeFn) {

  if (typeof removeFn !== 'function') {
    throw new Error('removeFn iterator must be a function');
  }

  if (!collection) {
    return;
  }

  var e;

  while ((e = collection[0])) {
    removeFn(e);
  }

  return collection;
};

},{}],180:[function(require,module,exports){
'use strict';

var svgAttr = require('tiny-svg/lib/attr'),
    svgCreate = require('tiny-svg/lib/create');


module.exports.componentsToPath = function(elements) {
  return elements.join(',').replace(/,?([A-z]),?/g, '$1');
};

function toSVGPoints(points) {
  var result = '';

  for (var i = 0, p; (p = points[i]); i++) {
    result += p.x + ',' + p.y + ' ';
  }

  return result;
}

module.exports.toSVGPoints = toSVGPoints;

module.exports.createLine = function(points, attrs) {

  var line = svgCreate('polyline');
  svgAttr(line, { points: toSVGPoints(points) });

  if (attrs) {
    svgAttr(line, attrs);
  }

  return line;
};

module.exports.updateLine = function(gfx, points) {
  svgAttr(gfx, { points: toSVGPoints(points) });

  return gfx;
};

},{"tiny-svg/lib/attr":353,"tiny-svg/lib/create":357}],181:[function(require,module,exports){
'use strict';

var svgTransform = require('tiny-svg/lib/transform');

var createTransform = require('tiny-svg/lib/geometry').createTransform;


/**
 * @param {<SVGElement>} element
 * @param {Number} x
 * @param {Number} y
 * @param {Number} angle
 * @param {Number} amount
 */
module.exports.transform = function(gfx, x, y, angle, amount) {
  var translate = createTransform();
  translate.setTranslate(x, y);

  var rotate = createTransform();
  rotate.setRotate(angle, 0, 0);

  var scale = createTransform();
  scale.setScale(amount || 1, amount || 1);

  svgTransform(gfx, [ translate, rotate, scale ]);
};


/**
 * @param {SVGElement} element
 * @param {Number} x
 * @param {Number} y
 */
module.exports.translate = function(gfx, x, y) {
  var translate = createTransform();
  translate.setTranslate(x, y);

  svgTransform(gfx, translate);
};


/**
 * @param {SVGElement} element
 * @param {Number} angle
 */
module.exports.rotate = function(gfx, angle) {
  var rotate = createTransform();
  rotate.setRotate(angle, 0, 0);

  svgTransform(gfx, rotate);
};


/**
 * @param {SVGElement} element
 * @param {Number} amount
 */
module.exports.scale = function(gfx, amount) {
  var scale = createTransform();
  scale.setScale(amount, amount);

  svgTransform(gfx, scale);
};

},{"tiny-svg/lib/geometry":358,"tiny-svg/lib/transform":360}],182:[function(require,module,exports){
'use strict';

var isObject = require('lodash/lang/isObject'),
    assign = require('lodash/object/assign'),
    pick = require('lodash/object/pick'),
    forEach = require('lodash/collection/forEach'),
    reduce = require('lodash/collection/reduce'),
    merge = require('lodash/object/merge');

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgCreate = require('tiny-svg/lib/create'),
    svgRemove = require('tiny-svg/lib/remove');

var DEFAULT_BOX_PADDING = 0;

var DEFAULT_LABEL_SIZE = {
  width: 150,
  height: 50
};


function parseAlign(align) {

  var parts = align.split('-');

  return {
    horizontal: parts[0] || 'center',
    vertical: parts[1] || 'top'
  };
}

function parsePadding(padding) {

  if (isObject(padding)) {
    return assign({ top: 0, left: 0, right: 0, bottom: 0 }, padding);
  } else {
    return {
      top: padding,
      left: padding,
      right: padding,
      bottom: padding
    };
  }
}

function getTextBBox(text, fakeText) {

  fakeText.textContent = text;

  try {
    var bbox,
        emptyLine = text === '';

    // add dummy text, when line is empty to determine correct height
    fakeText.textContent = emptyLine ? 'dummy' : text;

    bbox = pick(fakeText.getBBox(), [ 'width', 'height' ]);

    if (emptyLine) {
      // correct width
      bbox.width = 0;
    }

    return bbox;
  } catch (e) {
    return { width: 0, height: 0 };
  }
}


/**
 * Layout the next line and return the layouted element.
 *
 * Alters the lines passed.
 *
 * @param  {Array<String>} lines
 * @return {Object} the line descriptor, an object { width, height, text }
 */
function layoutNext(lines, maxWidth, fakeText) {

  var originalLine = lines.shift(),
      fitLine = originalLine;

  var textBBox;

  for (;;) {
    textBBox = getTextBBox(fitLine, fakeText);

    textBBox.width = fitLine ? textBBox.width : 0;

    // try to fit
    if (fitLine === ' ' || fitLine === '' || textBBox.width < Math.round(maxWidth) || fitLine.length < 4) {
      return fit(lines, fitLine, originalLine, textBBox);
    }

    fitLine = shortenLine(fitLine, textBBox.width, maxWidth);
  }
}

function fit(lines, fitLine, originalLine, textBBox) {
  if (fitLine.length < originalLine.length) {
    var nextLine = lines[0] || '',
        remainder = originalLine.slice(fitLine.length).trim();

    if (/-\s*$/.test(remainder)) {
      nextLine = remainder + nextLine.replace(/^\s+/, '');
    } else {
      nextLine = remainder + ' ' + nextLine;
    }

    lines[0] = nextLine;
  }
  return { width: textBBox.width, height: textBBox.height, text: fitLine };
}


/**
 * Shortens a line based on spacing and hyphens.
 * Returns the shortened result on success.
 *
 * @param  {String} line
 * @param  {Number} maxLength the maximum characters of the string
 * @return {String} the shortened string
 */
function semanticShorten(line, maxLength) {
  var parts = line.split(/(\s|-)/g),
      part,
      shortenedParts = [],
      length = 0;

  // try to shorten via spaces + hyphens
  if (parts.length > 1) {
    while ((part = parts.shift())) {
      if (part.length + length < maxLength) {
        shortenedParts.push(part);
        length += part.length;
      } else {
        // remove previous part, too if hyphen does not fit anymore
        if (part === '-') {
          shortenedParts.pop();
        }

        break;
      }
    }
  }

  return shortenedParts.join('');
}


function shortenLine(line, width, maxWidth) {
  var length = Math.max(line.length * (maxWidth / width), 1);

  // try to shorten semantically (i.e. based on spaces and hyphens)
  var shortenedLine = semanticShorten(line, length);

  if (!shortenedLine) {

    // force shorten by cutting the long word
    shortenedLine = line.slice(0, Math.max(Math.round(length - 1), 1));
  }

  return shortenedLine;
}


function getHelperSvg() {
  var helperSvg = document.getElementById('helper-svg');

  if (!helperSvg) {
    helperSvg = svgCreate('svg');

    svgAttr(helperSvg, {
      id: 'helper-svg',
      width: 0,
      height: 0,
      style: 'visibility: hidden; position: fixed'
    });

    document.body.appendChild(helperSvg);
  }

  return helperSvg;
}


/**
 * Creates a new label utility
 *
 * @param {Object} config
 * @param {Dimensions} config.size
 * @param {Number} config.padding
 * @param {Object} config.style
 * @param {String} config.align
 */
function Text(config) {

  this._config = assign({}, {
    size: DEFAULT_LABEL_SIZE,
    padding: DEFAULT_BOX_PADDING,
    style: {},
    align: 'center-top'
  }, config || {});
}

/**
 * Returns the layouted text as an SVG element.
 *
 * @param {String} text
 * @param {Object} options
 *
 * @return {SVGText}
 */
Text.prototype.createText = function(text, options) {
  return this.layoutText(text, options).element;
};

/**
 * Returns a labels layouted dimensions.
 *
 * @param {String} text to layout
 * @param {Object} options
 *
 * @return {Dimensions}
 */
Text.prototype.getDimensions = function(text, options) {
  return this.layoutText(text, options).dimensions;
};

/**
 * Creates and returns a label and its bounding box.
 *
 * @method Text#createText
 *
 * @param {String} text the text to render on the label
 * @param {Object} options
 * @param {String} options.align how to align in the bounding box.
 *                               Any of { 'center-middle', 'center-top' },
 *                               defaults to 'center-top'.
 * @param {String} options.style style to be applied to the text
 * @param {boolean} options.fitBox indicates if box will be recalculated to
 *                                 fit text
 *
 * @return {Object} { element, dimensions }
 */
Text.prototype.layoutText = function(text, options) {
  var box = merge({}, this._config.size, options.box || {}),
      style = merge({}, this._config.style, options.style || {}),
      align = parseAlign(options.align || this._config.align),
      padding = parsePadding(options.padding !== undefined ? options.padding : this._config.padding),
      fitBox = options.fitBox || false;

  var lines = text.split(/\r?\n/g),
      layouted = [];

  var maxWidth = box.width - padding.left - padding.right;

  // ensure correct rendering by attaching helper text node to invisible SVG
  var helperText = svgCreate('text');
  svgAttr(helperText, { x: 0, y: 0 });
  svgAttr(helperText, style);

  var helperSvg = getHelperSvg();

  svgAppend(helperSvg, helperText);

  while (lines.length) {
    layouted.push(layoutNext(lines, maxWidth, helperText));
  }

  var totalHeight = reduce(layouted, function(sum, line, idx) {
    return sum + line.height;
  }, 0);

  var maxLineWidth = reduce(layouted, function(sum, line, idx) {
    return line.width > sum ? line.width : sum;
  }, 0);

  // the y position of the next line
  var y, x;

  switch (align.vertical) {
  case 'middle':
    y = (box.height - totalHeight) / 2 - layouted[0].height / 4;
    break;

  default:
    y = padding.top;
  }

  var textElement = svgCreate('text');

  svgAttr(textElement, style);

  // layout each line taking into account that parent
  // shape might resize to fit text size
  forEach(layouted, function(line) {
    y += line.height;

    switch (align.horizontal) {
    case 'left':
      x = padding.left;
      break;

    case 'right':
      x = ((fitBox ? maxLineWidth : maxWidth)
        - padding.right - line.width);
      break;

    default:
      // aka center
      x = Math.max((((fitBox ? maxLineWidth : maxWidth)
        - line.width) / 2 + padding.left), 0);
    }

    var tspan = svgCreate('tspan');
    svgAttr(tspan, { x: x, y: y });

    tspan.textContent = line.text;

    svgAppend(textElement, tspan);
  });

  svgRemove(helperText);

  var dimensions = {
    width: maxLineWidth,
    height: totalHeight
  };

  return {
    dimensions: dimensions,
    element: textElement
  };
};

module.exports = Text;

},{"lodash/collection/forEach":204,"lodash/collection/reduce":207,"lodash/lang/isObject":323,"lodash/object/assign":328,"lodash/object/merge":331,"lodash/object/pick":334,"tiny-svg/lib/append":351,"tiny-svg/lib/attr":353,"tiny-svg/lib/create":357,"tiny-svg/lib/remove":359}],183:[function(require,module,exports){

var isArray = function(obj) {
  return Object.prototype.toString.call(obj) === '[object Array]';
};

var annotate = function() {
  var args = Array.prototype.slice.call(arguments);
  
  if (args.length === 1 && isArray(args[0])) {
    args = args[0];
  }

  var fn = args.pop();

  fn.$inject = args;

  return fn;
};


// Current limitations:
// - can't put into "function arg" comments
// function /* (no parenthesis like this) */ (){}
// function abc( /* xx (no parenthesis like this) */ a, b) {}
//
// Just put the comment before function or inside:
// /* (((this is fine))) */ function(a, b) {}
// function abc(a) { /* (((this is fine))) */}

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG = /\/\*([^\*]*)\*\//m;

var parse = function(fn) {
  if (typeof fn !== 'function') {
    throw new Error('Cannot annotate "' + fn + '". Expected a function!');
  }

  var match = fn.toString().match(FN_ARGS);
  return match[1] && match[1].split(',').map(function(arg) {
    match = arg.match(FN_ARG);
    return match ? match[1].trim() : arg.trim();
  }) || [];
};


exports.annotate = annotate;
exports.parse = parse;
exports.isArray = isArray;

},{}],184:[function(require,module,exports){
module.exports = {
  annotate: require('./annotation').annotate,
  Module: require('./module'),
  Injector: require('./injector')
};

},{"./annotation":183,"./injector":185,"./module":186}],185:[function(require,module,exports){
var Module = require('./module');
var autoAnnotate = require('./annotation').parse;
var annotate = require('./annotation').annotate;
var isArray = require('./annotation').isArray;


var Injector = function(modules, parent) {
  parent = parent || {
    get: function(name, strict) {
      currentlyResolving.push(name);

      if (strict === false) {
        return null;
      } else {
        throw error('No provider for "' + name + '"!');
      }
    }
  };

  var currentlyResolving = [];
  var providers = this._providers = Object.create(parent._providers || null);
  var instances = this._instances = Object.create(null);

  var self = instances.injector = this;

  var error = function(msg) {
    var stack = currentlyResolving.join(' -> ');
    currentlyResolving.length = 0;
    return new Error(stack ? msg + ' (Resolving: ' + stack + ')' : msg);
  };

  /**
   * Return a named service.
   *
   * @param {String} name
   * @param {Boolean} [strict=true] if false, resolve missing services to null
   *
   * @return {Object}
   */
  var get = function(name, strict) {
    if (!providers[name] && name.indexOf('.') !== -1) {
      var parts = name.split('.');
      var pivot = get(parts.shift());

      while(parts.length) {
        pivot = pivot[parts.shift()];
      }

      return pivot;
    }

    if (Object.hasOwnProperty.call(instances, name)) {
      return instances[name];
    }

    if (Object.hasOwnProperty.call(providers, name)) {
      if (currentlyResolving.indexOf(name) !== -1) {
        currentlyResolving.push(name);
        throw error('Cannot resolve circular dependency!');
      }

      currentlyResolving.push(name);
      instances[name] = providers[name][0](providers[name][1]);
      currentlyResolving.pop();

      return instances[name];
    }

    return parent.get(name, strict);
  };

  var instantiate = function(Type) {
    var instance = Object.create(Type.prototype);
    var returned = invoke(Type, instance);

    return typeof returned === 'object' ? returned : instance;
  };

  var invoke = function(fn, context) {
    if (typeof fn !== 'function') {
      if (isArray(fn)) {
        fn = annotate(fn.slice());
      } else {
        throw new Error('Cannot invoke "' + fn + '". Expected a function!');
      }
    }

    var inject = fn.$inject && fn.$inject || autoAnnotate(fn);
    var dependencies = inject.map(function(dep) {
      return get(dep);
    });

    // TODO(vojta): optimize without apply
    return fn.apply(context, dependencies);
  };


  var createPrivateInjectorFactory = function(privateChildInjector) {
    return annotate(function(key) {
      return privateChildInjector.get(key);
    });
  };

  var createChild = function(modules, forceNewInstances) {
    if (forceNewInstances && forceNewInstances.length) {
      var fromParentModule = Object.create(null);
      var matchedScopes = Object.create(null);

      var privateInjectorsCache = [];
      var privateChildInjectors = [];
      var privateChildFactories = [];

      var provider;
      var cacheIdx;
      var privateChildInjector;
      var privateChildInjectorFactory;
      for (var name in providers) {
        provider = providers[name];

        if (forceNewInstances.indexOf(name) !== -1) {
          if (provider[2] === 'private') {
            cacheIdx = privateInjectorsCache.indexOf(provider[3]);
            if (cacheIdx === -1) {
              privateChildInjector = provider[3].createChild([], forceNewInstances);
              privateChildInjectorFactory = createPrivateInjectorFactory(privateChildInjector);
              privateInjectorsCache.push(provider[3]);
              privateChildInjectors.push(privateChildInjector);
              privateChildFactories.push(privateChildInjectorFactory);
              fromParentModule[name] = [privateChildInjectorFactory, name, 'private', privateChildInjector];
            } else {
              fromParentModule[name] = [privateChildFactories[cacheIdx], name, 'private', privateChildInjectors[cacheIdx]];
            }
          } else {
            fromParentModule[name] = [provider[2], provider[1]];
          }
          matchedScopes[name] = true;
        }

        if ((provider[2] === 'factory' || provider[2] === 'type') && provider[1].$scope) {
          /*jshint -W083 */
          forceNewInstances.forEach(function(scope) {
            if (provider[1].$scope.indexOf(scope) !== -1) {
              fromParentModule[name] = [provider[2], provider[1]];
              matchedScopes[scope] = true;
            }
          });
        }
      }

      forceNewInstances.forEach(function(scope) {
        if (!matchedScopes[scope]) {
          throw new Error('No provider for "' + scope + '". Cannot use provider from the parent!');
        }
      });

      modules.unshift(fromParentModule);
    }

    return new Injector(modules, self);
  };

  var factoryMap = {
    factory: invoke,
    type: instantiate,
    value: function(value) {
      return value;
    }
  };

  modules.forEach(function(module) {

    function arrayUnwrap(type, value) {
      if (type !== 'value' && isArray(value)) {
        value = annotate(value.slice());
      }

      return value;
    }

    // TODO(vojta): handle wrong inputs (modules)
    if (module instanceof Module) {
      module.forEach(function(provider) {
        var name = provider[0];
        var type = provider[1];
        var value = provider[2];

        providers[name] = [factoryMap[type], arrayUnwrap(type, value), type];
      });
    } else if (typeof module === 'object') {
      if (module.__exports__) {
        var clonedModule = Object.keys(module).reduce(function(m, key) {
          if (key.substring(0, 2) !== '__') {
            m[key] = module[key];
          }
          return m;
        }, Object.create(null));

        var privateInjector = new Injector((module.__modules__ || []).concat([clonedModule]), self);
        var getFromPrivateInjector = annotate(function(key) {
          return privateInjector.get(key);
        });
        module.__exports__.forEach(function(key) {
          providers[key] = [getFromPrivateInjector, key, 'private', privateInjector];
        });
      } else {
        Object.keys(module).forEach(function(name) {
          if (module[name][2] === 'private') {
            providers[name] = module[name];
            return;
          }

          var type = module[name][0];
          var value = module[name][1];

          providers[name] = [factoryMap[type], arrayUnwrap(type, value), type];
        });
      }
    }
  });

  // public API
  this.get = get;
  this.invoke = invoke;
  this.instantiate = instantiate;
  this.createChild = createChild;
};

module.exports = Injector;

},{"./annotation":183,"./module":186}],186:[function(require,module,exports){
var Module = function() {
  var providers = [];

  this.factory = function(name, factory) {
    providers.push([name, 'factory', factory]);
    return this;
  };

  this.value = function(name, value) {
    providers.push([name, 'value', value]);
    return this;
  };

  this.type = function(name, type) {
    providers.push([name, 'type', type]);
    return this;
  };

  this.forEach = function(iterator) {
    providers.forEach(iterator);
  };
};

module.exports = Module;

},{}],187:[function(require,module,exports){

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Tests for browser support.
 */

var innerHTMLBug = false;
var bugTestDiv;
if (typeof document !== 'undefined') {
  bugTestDiv = document.createElement('div');
  // Setup
  bugTestDiv.innerHTML = '  <link/><table></table><a href="/a">a</a><input type="checkbox"/>';
  // Make sure that link elements get serialized correctly by innerHTML
  // This requires a wrapper element in IE
  innerHTMLBug = !bugTestDiv.getElementsByTagName('link').length;
  bugTestDiv = undefined;
}

/**
 * Wrap map from jquery.
 */

var map = {
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  // for script/link/style tags to work in IE6-8, you have to wrap
  // in a div with a non-whitespace character in front, ha!
  _default: innerHTMLBug ? [1, 'X<div>', '</div>'] : [0, '', '']
};

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>'];

map.polyline =
map.ellipse =
map.polygon =
map.circle =
map.text =
map.line =
map.path =
map.rect =
map.g = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>'];

/**
 * Parse `html` and return a DOM Node instance, which could be a TextNode,
 * HTML DOM Node of some kind (<div> for example), or a DocumentFragment
 * instance, depending on the contents of the `html` string.
 *
 * @param {String} html - HTML string to "domify"
 * @param {Document} doc - The `document` instance to create the Node for
 * @return {DOMNode} the TextNode, DOM Node, or DocumentFragment instance
 * @api private
 */

function parse(html, doc) {
  if ('string' != typeof html) throw new TypeError('String expected');

  // default to the global `document` object
  if (!doc) doc = document;

  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) return doc.createTextNode(html);

  html = html.replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace

  var tag = m[1];

  // body support
  if (tag == 'body') {
    var el = doc.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = doc.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  // one element
  if (el.firstChild == el.lastChild) {
    return el.removeChild(el.firstChild);
  }

  // several elements
  var fragment = doc.createDocumentFragment();
  while (el.firstChild) {
    fragment.appendChild(el.removeChild(el.firstChild));
  }

  return fragment;
}

},{}],188:[function(require,module,exports){
/*! Hammer.JS - v2.0.7 - 2016-04-22
 * http://hammerjs.github.io/
 *
 * Copyright (c) 2016 Jorik Tangelder;
 * Licensed under the MIT license */
(function(window, document, exportName, undefined) {
  'use strict';

var VENDOR_PREFIXES = ['', 'webkit', 'Moz', 'MS', 'ms', 'o'];
var TEST_ELEMENT = document.createElement('div');

var TYPE_FUNCTION = 'function';

var round = Math.round;
var abs = Math.abs;
var now = Date.now;

/**
 * set a timeout with a given scope
 * @param {Function} fn
 * @param {Number} timeout
 * @param {Object} context
 * @returns {number}
 */
function setTimeoutContext(fn, timeout, context) {
    return setTimeout(bindFn(fn, context), timeout);
}

/**
 * if the argument is an array, we want to execute the fn on each entry
 * if it aint an array we don't want to do a thing.
 * this is used by all the methods that accept a single and array argument.
 * @param {*|Array} arg
 * @param {String} fn
 * @param {Object} [context]
 * @returns {Boolean}
 */
function invokeArrayArg(arg, fn, context) {
    if (Array.isArray(arg)) {
        each(arg, context[fn], context);
        return true;
    }
    return false;
}

/**
 * walk objects and arrays
 * @param {Object} obj
 * @param {Function} iterator
 * @param {Object} context
 */
function each(obj, iterator, context) {
    var i;

    if (!obj) {
        return;
    }

    if (obj.forEach) {
        obj.forEach(iterator, context);
    } else if (obj.length !== undefined) {
        i = 0;
        while (i < obj.length) {
            iterator.call(context, obj[i], i, obj);
            i++;
        }
    } else {
        for (i in obj) {
            obj.hasOwnProperty(i) && iterator.call(context, obj[i], i, obj);
        }
    }
}

/**
 * wrap a method with a deprecation warning and stack trace
 * @param {Function} method
 * @param {String} name
 * @param {String} message
 * @returns {Function} A new function wrapping the supplied method.
 */
function deprecate(method, name, message) {
    var deprecationMessage = 'DEPRECATED METHOD: ' + name + '\n' + message + ' AT \n';
    return function() {
        var e = new Error('get-stack-trace');
        var stack = e && e.stack ? e.stack.replace(/^[^\(]+?[\n$]/gm, '')
            .replace(/^\s+at\s+/gm, '')
            .replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@') : 'Unknown Stack Trace';

        var log = window.console && (window.console.warn || window.console.log);
        if (log) {
            log.call(window.console, deprecationMessage, stack);
        }
        return method.apply(this, arguments);
    };
}

/**
 * extend object.
 * means that properties in dest will be overwritten by the ones in src.
 * @param {Object} target
 * @param {...Object} objects_to_assign
 * @returns {Object} target
 */
var assign;
if (typeof Object.assign !== 'function') {
    assign = function assign(target) {
        if (target === undefined || target === null) {
            throw new TypeError('Cannot convert undefined or null to object');
        }

        var output = Object(target);
        for (var index = 1; index < arguments.length; index++) {
            var source = arguments[index];
            if (source !== undefined && source !== null) {
                for (var nextKey in source) {
                    if (source.hasOwnProperty(nextKey)) {
                        output[nextKey] = source[nextKey];
                    }
                }
            }
        }
        return output;
    };
} else {
    assign = Object.assign;
}

/**
 * extend object.
 * means that properties in dest will be overwritten by the ones in src.
 * @param {Object} dest
 * @param {Object} src
 * @param {Boolean} [merge=false]
 * @returns {Object} dest
 */
var extend = deprecate(function extend(dest, src, merge) {
    var keys = Object.keys(src);
    var i = 0;
    while (i < keys.length) {
        if (!merge || (merge && dest[keys[i]] === undefined)) {
            dest[keys[i]] = src[keys[i]];
        }
        i++;
    }
    return dest;
}, 'extend', 'Use `assign`.');

/**
 * merge the values from src in the dest.
 * means that properties that exist in dest will not be overwritten by src
 * @param {Object} dest
 * @param {Object} src
 * @returns {Object} dest
 */
var merge = deprecate(function merge(dest, src) {
    return extend(dest, src, true);
}, 'merge', 'Use `assign`.');

/**
 * simple class inheritance
 * @param {Function} child
 * @param {Function} base
 * @param {Object} [properties]
 */
function inherit(child, base, properties) {
    var baseP = base.prototype,
        childP;

    childP = child.prototype = Object.create(baseP);
    childP.constructor = child;
    childP._super = baseP;

    if (properties) {
        assign(childP, properties);
    }
}

/**
 * simple function bind
 * @param {Function} fn
 * @param {Object} context
 * @returns {Function}
 */
function bindFn(fn, context) {
    return function boundFn() {
        return fn.apply(context, arguments);
    };
}

/**
 * let a boolean value also be a function that must return a boolean
 * this first item in args will be used as the context
 * @param {Boolean|Function} val
 * @param {Array} [args]
 * @returns {Boolean}
 */
function boolOrFn(val, args) {
    if (typeof val == TYPE_FUNCTION) {
        return val.apply(args ? args[0] || undefined : undefined, args);
    }
    return val;
}

/**
 * use the val2 when val1 is undefined
 * @param {*} val1
 * @param {*} val2
 * @returns {*}
 */
function ifUndefined(val1, val2) {
    return (val1 === undefined) ? val2 : val1;
}

/**
 * addEventListener with multiple events at once
 * @param {EventTarget} target
 * @param {String} types
 * @param {Function} handler
 */
function addEventListeners(target, types, handler) {
    each(splitStr(types), function(type) {
        target.addEventListener(type, handler, false);
    });
}

/**
 * removeEventListener with multiple events at once
 * @param {EventTarget} target
 * @param {String} types
 * @param {Function} handler
 */
function removeEventListeners(target, types, handler) {
    each(splitStr(types), function(type) {
        target.removeEventListener(type, handler, false);
    });
}

/**
 * find if a node is in the given parent
 * @method hasParent
 * @param {HTMLElement} node
 * @param {HTMLElement} parent
 * @return {Boolean} found
 */
function hasParent(node, parent) {
    while (node) {
        if (node == parent) {
            return true;
        }
        node = node.parentNode;
    }
    return false;
}

/**
 * small indexOf wrapper
 * @param {String} str
 * @param {String} find
 * @returns {Boolean} found
 */
function inStr(str, find) {
    return str.indexOf(find) > -1;
}

/**
 * split string on whitespace
 * @param {String} str
 * @returns {Array} words
 */
function splitStr(str) {
    return str.trim().split(/\s+/g);
}

/**
 * find if a array contains the object using indexOf or a simple polyFill
 * @param {Array} src
 * @param {String} find
 * @param {String} [findByKey]
 * @return {Boolean|Number} false when not found, or the index
 */
function inArray(src, find, findByKey) {
    if (src.indexOf && !findByKey) {
        return src.indexOf(find);
    } else {
        var i = 0;
        while (i < src.length) {
            if ((findByKey && src[i][findByKey] == find) || (!findByKey && src[i] === find)) {
                return i;
            }
            i++;
        }
        return -1;
    }
}

/**
 * convert array-like objects to real arrays
 * @param {Object} obj
 * @returns {Array}
 */
function toArray(obj) {
    return Array.prototype.slice.call(obj, 0);
}

/**
 * unique array with objects based on a key (like 'id') or just by the array's value
 * @param {Array} src [{id:1},{id:2},{id:1}]
 * @param {String} [key]
 * @param {Boolean} [sort=False]
 * @returns {Array} [{id:1},{id:2}]
 */
function uniqueArray(src, key, sort) {
    var results = [];
    var values = [];
    var i = 0;

    while (i < src.length) {
        var val = key ? src[i][key] : src[i];
        if (inArray(values, val) < 0) {
            results.push(src[i]);
        }
        values[i] = val;
        i++;
    }

    if (sort) {
        if (!key) {
            results = results.sort();
        } else {
            results = results.sort(function sortUniqueArray(a, b) {
                return a[key] > b[key];
            });
        }
    }

    return results;
}

/**
 * get the prefixed property
 * @param {Object} obj
 * @param {String} property
 * @returns {String|Undefined} prefixed
 */
function prefixed(obj, property) {
    var prefix, prop;
    var camelProp = property[0].toUpperCase() + property.slice(1);

    var i = 0;
    while (i < VENDOR_PREFIXES.length) {
        prefix = VENDOR_PREFIXES[i];
        prop = (prefix) ? prefix + camelProp : property;

        if (prop in obj) {
            return prop;
        }
        i++;
    }
    return undefined;
}

/**
 * get a unique id
 * @returns {number} uniqueId
 */
var _uniqueId = 1;
function uniqueId() {
    return _uniqueId++;
}

/**
 * get the window object of an element
 * @param {HTMLElement} element
 * @returns {DocumentView|Window}
 */
function getWindowForElement(element) {
    var doc = element.ownerDocument || element;
    return (doc.defaultView || doc.parentWindow || window);
}

var MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android/i;

var SUPPORT_TOUCH = ('ontouchstart' in window);
var SUPPORT_POINTER_EVENTS = prefixed(window, 'PointerEvent') !== undefined;
var SUPPORT_ONLY_TOUCH = SUPPORT_TOUCH && MOBILE_REGEX.test(navigator.userAgent);

var INPUT_TYPE_TOUCH = 'touch';
var INPUT_TYPE_PEN = 'pen';
var INPUT_TYPE_MOUSE = 'mouse';
var INPUT_TYPE_KINECT = 'kinect';

var COMPUTE_INTERVAL = 25;

var INPUT_START = 1;
var INPUT_MOVE = 2;
var INPUT_END = 4;
var INPUT_CANCEL = 8;

var DIRECTION_NONE = 1;
var DIRECTION_LEFT = 2;
var DIRECTION_RIGHT = 4;
var DIRECTION_UP = 8;
var DIRECTION_DOWN = 16;

var DIRECTION_HORIZONTAL = DIRECTION_LEFT | DIRECTION_RIGHT;
var DIRECTION_VERTICAL = DIRECTION_UP | DIRECTION_DOWN;
var DIRECTION_ALL = DIRECTION_HORIZONTAL | DIRECTION_VERTICAL;

var PROPS_XY = ['x', 'y'];
var PROPS_CLIENT_XY = ['clientX', 'clientY'];

/**
 * create new input type manager
 * @param {Manager} manager
 * @param {Function} callback
 * @returns {Input}
 * @constructor
 */
function Input(manager, callback) {
    var self = this;
    this.manager = manager;
    this.callback = callback;
    this.element = manager.element;
    this.target = manager.options.inputTarget;

    // smaller wrapper around the handler, for the scope and the enabled state of the manager,
    // so when disabled the input events are completely bypassed.
    this.domHandler = function(ev) {
        if (boolOrFn(manager.options.enable, [manager])) {
            self.handler(ev);
        }
    };

    this.init();

}

Input.prototype = {
    /**
     * should handle the inputEvent data and trigger the callback
     * @virtual
     */
    handler: function() { },

    /**
     * bind the events
     */
    init: function() {
        this.evEl && addEventListeners(this.element, this.evEl, this.domHandler);
        this.evTarget && addEventListeners(this.target, this.evTarget, this.domHandler);
        this.evWin && addEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
    },

    /**
     * unbind the events
     */
    destroy: function() {
        this.evEl && removeEventListeners(this.element, this.evEl, this.domHandler);
        this.evTarget && removeEventListeners(this.target, this.evTarget, this.domHandler);
        this.evWin && removeEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
    }
};

/**
 * create new input type manager
 * called by the Manager constructor
 * @param {Hammer} manager
 * @returns {Input}
 */
function createInputInstance(manager) {
    var Type;
    var inputClass = manager.options.inputClass;

    if (inputClass) {
        Type = inputClass;
    } else if (SUPPORT_POINTER_EVENTS) {
        Type = PointerEventInput;
    } else if (SUPPORT_ONLY_TOUCH) {
        Type = TouchInput;
    } else if (!SUPPORT_TOUCH) {
        Type = MouseInput;
    } else {
        Type = TouchMouseInput;
    }
    return new (Type)(manager, inputHandler);
}

/**
 * handle input events
 * @param {Manager} manager
 * @param {String} eventType
 * @param {Object} input
 */
function inputHandler(manager, eventType, input) {
    var pointersLen = input.pointers.length;
    var changedPointersLen = input.changedPointers.length;
    var isFirst = (eventType & INPUT_START && (pointersLen - changedPointersLen === 0));
    var isFinal = (eventType & (INPUT_END | INPUT_CANCEL) && (pointersLen - changedPointersLen === 0));

    input.isFirst = !!isFirst;
    input.isFinal = !!isFinal;

    if (isFirst) {
        manager.session = {};
    }

    // source event is the normalized value of the domEvents
    // like 'touchstart, mouseup, pointerdown'
    input.eventType = eventType;

    // compute scale, rotation etc
    computeInputData(manager, input);

    // emit secret event
    manager.emit('hammer.input', input);

    manager.recognize(input);
    manager.session.prevInput = input;
}

/**
 * extend the data with some usable properties like scale, rotate, velocity etc
 * @param {Object} manager
 * @param {Object} input
 */
function computeInputData(manager, input) {
    var session = manager.session;
    var pointers = input.pointers;
    var pointersLength = pointers.length;

    // store the first input to calculate the distance and direction
    if (!session.firstInput) {
        session.firstInput = simpleCloneInputData(input);
    }

    // to compute scale and rotation we need to store the multiple touches
    if (pointersLength > 1 && !session.firstMultiple) {
        session.firstMultiple = simpleCloneInputData(input);
    } else if (pointersLength === 1) {
        session.firstMultiple = false;
    }

    var firstInput = session.firstInput;
    var firstMultiple = session.firstMultiple;
    var offsetCenter = firstMultiple ? firstMultiple.center : firstInput.center;

    var center = input.center = getCenter(pointers);
    input.timeStamp = now();
    input.deltaTime = input.timeStamp - firstInput.timeStamp;

    input.angle = getAngle(offsetCenter, center);
    input.distance = getDistance(offsetCenter, center);

    computeDeltaXY(session, input);
    input.offsetDirection = getDirection(input.deltaX, input.deltaY);

    var overallVelocity = getVelocity(input.deltaTime, input.deltaX, input.deltaY);
    input.overallVelocityX = overallVelocity.x;
    input.overallVelocityY = overallVelocity.y;
    input.overallVelocity = (abs(overallVelocity.x) > abs(overallVelocity.y)) ? overallVelocity.x : overallVelocity.y;

    input.scale = firstMultiple ? getScale(firstMultiple.pointers, pointers) : 1;
    input.rotation = firstMultiple ? getRotation(firstMultiple.pointers, pointers) : 0;

    input.maxPointers = !session.prevInput ? input.pointers.length : ((input.pointers.length >
        session.prevInput.maxPointers) ? input.pointers.length : session.prevInput.maxPointers);

    computeIntervalInputData(session, input);

    // find the correct target
    var target = manager.element;
    if (hasParent(input.srcEvent.target, target)) {
        target = input.srcEvent.target;
    }
    input.target = target;
}

function computeDeltaXY(session, input) {
    var center = input.center;
    var offset = session.offsetDelta || {};
    var prevDelta = session.prevDelta || {};
    var prevInput = session.prevInput || {};

    if (input.eventType === INPUT_START || prevInput.eventType === INPUT_END) {
        prevDelta = session.prevDelta = {
            x: prevInput.deltaX || 0,
            y: prevInput.deltaY || 0
        };

        offset = session.offsetDelta = {
            x: center.x,
            y: center.y
        };
    }

    input.deltaX = prevDelta.x + (center.x - offset.x);
    input.deltaY = prevDelta.y + (center.y - offset.y);
}

/**
 * velocity is calculated every x ms
 * @param {Object} session
 * @param {Object} input
 */
function computeIntervalInputData(session, input) {
    var last = session.lastInterval || input,
        deltaTime = input.timeStamp - last.timeStamp,
        velocity, velocityX, velocityY, direction;

    if (input.eventType != INPUT_CANCEL && (deltaTime > COMPUTE_INTERVAL || last.velocity === undefined)) {
        var deltaX = input.deltaX - last.deltaX;
        var deltaY = input.deltaY - last.deltaY;

        var v = getVelocity(deltaTime, deltaX, deltaY);
        velocityX = v.x;
        velocityY = v.y;
        velocity = (abs(v.x) > abs(v.y)) ? v.x : v.y;
        direction = getDirection(deltaX, deltaY);

        session.lastInterval = input;
    } else {
        // use latest velocity info if it doesn't overtake a minimum period
        velocity = last.velocity;
        velocityX = last.velocityX;
        velocityY = last.velocityY;
        direction = last.direction;
    }

    input.velocity = velocity;
    input.velocityX = velocityX;
    input.velocityY = velocityY;
    input.direction = direction;
}

/**
 * create a simple clone from the input used for storage of firstInput and firstMultiple
 * @param {Object} input
 * @returns {Object} clonedInputData
 */
function simpleCloneInputData(input) {
    // make a simple copy of the pointers because we will get a reference if we don't
    // we only need clientXY for the calculations
    var pointers = [];
    var i = 0;
    while (i < input.pointers.length) {
        pointers[i] = {
            clientX: round(input.pointers[i].clientX),
            clientY: round(input.pointers[i].clientY)
        };
        i++;
    }

    return {
        timeStamp: now(),
        pointers: pointers,
        center: getCenter(pointers),
        deltaX: input.deltaX,
        deltaY: input.deltaY
    };
}

/**
 * get the center of all the pointers
 * @param {Array} pointers
 * @return {Object} center contains `x` and `y` properties
 */
function getCenter(pointers) {
    var pointersLength = pointers.length;

    // no need to loop when only one touch
    if (pointersLength === 1) {
        return {
            x: round(pointers[0].clientX),
            y: round(pointers[0].clientY)
        };
    }

    var x = 0, y = 0, i = 0;
    while (i < pointersLength) {
        x += pointers[i].clientX;
        y += pointers[i].clientY;
        i++;
    }

    return {
        x: round(x / pointersLength),
        y: round(y / pointersLength)
    };
}

/**
 * calculate the velocity between two points. unit is in px per ms.
 * @param {Number} deltaTime
 * @param {Number} x
 * @param {Number} y
 * @return {Object} velocity `x` and `y`
 */
function getVelocity(deltaTime, x, y) {
    return {
        x: x / deltaTime || 0,
        y: y / deltaTime || 0
    };
}

/**
 * get the direction between two points
 * @param {Number} x
 * @param {Number} y
 * @return {Number} direction
 */
function getDirection(x, y) {
    if (x === y) {
        return DIRECTION_NONE;
    }

    if (abs(x) >= abs(y)) {
        return x < 0 ? DIRECTION_LEFT : DIRECTION_RIGHT;
    }
    return y < 0 ? DIRECTION_UP : DIRECTION_DOWN;
}

/**
 * calculate the absolute distance between two points
 * @param {Object} p1 {x, y}
 * @param {Object} p2 {x, y}
 * @param {Array} [props] containing x and y keys
 * @return {Number} distance
 */
function getDistance(p1, p2, props) {
    if (!props) {
        props = PROPS_XY;
    }
    var x = p2[props[0]] - p1[props[0]],
        y = p2[props[1]] - p1[props[1]];

    return Math.sqrt((x * x) + (y * y));
}

/**
 * calculate the angle between two coordinates
 * @param {Object} p1
 * @param {Object} p2
 * @param {Array} [props] containing x and y keys
 * @return {Number} angle
 */
function getAngle(p1, p2, props) {
    if (!props) {
        props = PROPS_XY;
    }
    var x = p2[props[0]] - p1[props[0]],
        y = p2[props[1]] - p1[props[1]];
    return Math.atan2(y, x) * 180 / Math.PI;
}

/**
 * calculate the rotation degrees between two pointersets
 * @param {Array} start array of pointers
 * @param {Array} end array of pointers
 * @return {Number} rotation
 */
function getRotation(start, end) {
    return getAngle(end[1], end[0], PROPS_CLIENT_XY) + getAngle(start[1], start[0], PROPS_CLIENT_XY);
}

/**
 * calculate the scale factor between two pointersets
 * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
 * @param {Array} start array of pointers
 * @param {Array} end array of pointers
 * @return {Number} scale
 */
function getScale(start, end) {
    return getDistance(end[0], end[1], PROPS_CLIENT_XY) / getDistance(start[0], start[1], PROPS_CLIENT_XY);
}

var MOUSE_INPUT_MAP = {
    mousedown: INPUT_START,
    mousemove: INPUT_MOVE,
    mouseup: INPUT_END
};

var MOUSE_ELEMENT_EVENTS = 'mousedown';
var MOUSE_WINDOW_EVENTS = 'mousemove mouseup';

/**
 * Mouse events input
 * @constructor
 * @extends Input
 */
function MouseInput() {
    this.evEl = MOUSE_ELEMENT_EVENTS;
    this.evWin = MOUSE_WINDOW_EVENTS;

    this.pressed = false; // mousedown state

    Input.apply(this, arguments);
}

inherit(MouseInput, Input, {
    /**
     * handle mouse events
     * @param {Object} ev
     */
    handler: function MEhandler(ev) {
        var eventType = MOUSE_INPUT_MAP[ev.type];

        // on start we want to have the left mouse button down
        if (eventType & INPUT_START && ev.button === 0) {
            this.pressed = true;
        }

        if (eventType & INPUT_MOVE && ev.which !== 1) {
            eventType = INPUT_END;
        }

        // mouse must be down
        if (!this.pressed) {
            return;
        }

        if (eventType & INPUT_END) {
            this.pressed = false;
        }

        this.callback(this.manager, eventType, {
            pointers: [ev],
            changedPointers: [ev],
            pointerType: INPUT_TYPE_MOUSE,
            srcEvent: ev
        });
    }
});

var POINTER_INPUT_MAP = {
    pointerdown: INPUT_START,
    pointermove: INPUT_MOVE,
    pointerup: INPUT_END,
    pointercancel: INPUT_CANCEL,
    pointerout: INPUT_CANCEL
};

// in IE10 the pointer types is defined as an enum
var IE10_POINTER_TYPE_ENUM = {
    2: INPUT_TYPE_TOUCH,
    3: INPUT_TYPE_PEN,
    4: INPUT_TYPE_MOUSE,
    5: INPUT_TYPE_KINECT // see https://twitter.com/jacobrossi/status/480596438489890816
};

var POINTER_ELEMENT_EVENTS = 'pointerdown';
var POINTER_WINDOW_EVENTS = 'pointermove pointerup pointercancel';

// IE10 has prefixed support, and case-sensitive
if (window.MSPointerEvent && !window.PointerEvent) {
    POINTER_ELEMENT_EVENTS = 'MSPointerDown';
    POINTER_WINDOW_EVENTS = 'MSPointerMove MSPointerUp MSPointerCancel';
}

/**
 * Pointer events input
 * @constructor
 * @extends Input
 */
function PointerEventInput() {
    this.evEl = POINTER_ELEMENT_EVENTS;
    this.evWin = POINTER_WINDOW_EVENTS;

    Input.apply(this, arguments);

    this.store = (this.manager.session.pointerEvents = []);
}

inherit(PointerEventInput, Input, {
    /**
     * handle mouse events
     * @param {Object} ev
     */
    handler: function PEhandler(ev) {
        var store = this.store;
        var removePointer = false;

        var eventTypeNormalized = ev.type.toLowerCase().replace('ms', '');
        var eventType = POINTER_INPUT_MAP[eventTypeNormalized];
        var pointerType = IE10_POINTER_TYPE_ENUM[ev.pointerType] || ev.pointerType;

        var isTouch = (pointerType == INPUT_TYPE_TOUCH);

        // get index of the event in the store
        var storeIndex = inArray(store, ev.pointerId, 'pointerId');

        // start and mouse must be down
        if (eventType & INPUT_START && (ev.button === 0 || isTouch)) {
            if (storeIndex < 0) {
                store.push(ev);
                storeIndex = store.length - 1;
            }
        } else if (eventType & (INPUT_END | INPUT_CANCEL)) {
            removePointer = true;
        }

        // it not found, so the pointer hasn't been down (so it's probably a hover)
        if (storeIndex < 0) {
            return;
        }

        // update the event in the store
        store[storeIndex] = ev;

        this.callback(this.manager, eventType, {
            pointers: store,
            changedPointers: [ev],
            pointerType: pointerType,
            srcEvent: ev
        });

        if (removePointer) {
            // remove from the store
            store.splice(storeIndex, 1);
        }
    }
});

var SINGLE_TOUCH_INPUT_MAP = {
    touchstart: INPUT_START,
    touchmove: INPUT_MOVE,
    touchend: INPUT_END,
    touchcancel: INPUT_CANCEL
};

var SINGLE_TOUCH_TARGET_EVENTS = 'touchstart';
var SINGLE_TOUCH_WINDOW_EVENTS = 'touchstart touchmove touchend touchcancel';

/**
 * Touch events input
 * @constructor
 * @extends Input
 */
function SingleTouchInput() {
    this.evTarget = SINGLE_TOUCH_TARGET_EVENTS;
    this.evWin = SINGLE_TOUCH_WINDOW_EVENTS;
    this.started = false;

    Input.apply(this, arguments);
}

inherit(SingleTouchInput, Input, {
    handler: function TEhandler(ev) {
        var type = SINGLE_TOUCH_INPUT_MAP[ev.type];

        // should we handle the touch events?
        if (type === INPUT_START) {
            this.started = true;
        }

        if (!this.started) {
            return;
        }

        var touches = normalizeSingleTouches.call(this, ev, type);

        // when done, reset the started state
        if (type & (INPUT_END | INPUT_CANCEL) && touches[0].length - touches[1].length === 0) {
            this.started = false;
        }

        this.callback(this.manager, type, {
            pointers: touches[0],
            changedPointers: touches[1],
            pointerType: INPUT_TYPE_TOUCH,
            srcEvent: ev
        });
    }
});

/**
 * @this {TouchInput}
 * @param {Object} ev
 * @param {Number} type flag
 * @returns {undefined|Array} [all, changed]
 */
function normalizeSingleTouches(ev, type) {
    var all = toArray(ev.touches);
    var changed = toArray(ev.changedTouches);

    if (type & (INPUT_END | INPUT_CANCEL)) {
        all = uniqueArray(all.concat(changed), 'identifier', true);
    }

    return [all, changed];
}

var TOUCH_INPUT_MAP = {
    touchstart: INPUT_START,
    touchmove: INPUT_MOVE,
    touchend: INPUT_END,
    touchcancel: INPUT_CANCEL
};

var TOUCH_TARGET_EVENTS = 'touchstart touchmove touchend touchcancel';

/**
 * Multi-user touch events input
 * @constructor
 * @extends Input
 */
function TouchInput() {
    this.evTarget = TOUCH_TARGET_EVENTS;
    this.targetIds = {};

    Input.apply(this, arguments);
}

inherit(TouchInput, Input, {
    handler: function MTEhandler(ev) {
        var type = TOUCH_INPUT_MAP[ev.type];
        var touches = getTouches.call(this, ev, type);
        if (!touches) {
            return;
        }

        this.callback(this.manager, type, {
            pointers: touches[0],
            changedPointers: touches[1],
            pointerType: INPUT_TYPE_TOUCH,
            srcEvent: ev
        });
    }
});

/**
 * @this {TouchInput}
 * @param {Object} ev
 * @param {Number} type flag
 * @returns {undefined|Array} [all, changed]
 */
function getTouches(ev, type) {
    var allTouches = toArray(ev.touches);
    var targetIds = this.targetIds;

    // when there is only one touch, the process can be simplified
    if (type & (INPUT_START | INPUT_MOVE) && allTouches.length === 1) {
        targetIds[allTouches[0].identifier] = true;
        return [allTouches, allTouches];
    }

    var i,
        targetTouches,
        changedTouches = toArray(ev.changedTouches),
        changedTargetTouches = [],
        target = this.target;

    // get target touches from touches
    targetTouches = allTouches.filter(function(touch) {
        return hasParent(touch.target, target);
    });

    // collect touches
    if (type === INPUT_START) {
        i = 0;
        while (i < targetTouches.length) {
            targetIds[targetTouches[i].identifier] = true;
            i++;
        }
    }

    // filter changed touches to only contain touches that exist in the collected target ids
    i = 0;
    while (i < changedTouches.length) {
        if (targetIds[changedTouches[i].identifier]) {
            changedTargetTouches.push(changedTouches[i]);
        }

        // cleanup removed touches
        if (type & (INPUT_END | INPUT_CANCEL)) {
            delete targetIds[changedTouches[i].identifier];
        }
        i++;
    }

    if (!changedTargetTouches.length) {
        return;
    }

    return [
        // merge targetTouches with changedTargetTouches so it contains ALL touches, including 'end' and 'cancel'
        uniqueArray(targetTouches.concat(changedTargetTouches), 'identifier', true),
        changedTargetTouches
    ];
}

/**
 * Combined touch and mouse input
 *
 * Touch has a higher priority then mouse, and while touching no mouse events are allowed.
 * This because touch devices also emit mouse events while doing a touch.
 *
 * @constructor
 * @extends Input
 */

var DEDUP_TIMEOUT = 2500;
var DEDUP_DISTANCE = 25;

function TouchMouseInput() {
    Input.apply(this, arguments);

    var handler = bindFn(this.handler, this);
    this.touch = new TouchInput(this.manager, handler);
    this.mouse = new MouseInput(this.manager, handler);

    this.primaryTouch = null;
    this.lastTouches = [];
}

inherit(TouchMouseInput, Input, {
    /**
     * handle mouse and touch events
     * @param {Hammer} manager
     * @param {String} inputEvent
     * @param {Object} inputData
     */
    handler: function TMEhandler(manager, inputEvent, inputData) {
        var isTouch = (inputData.pointerType == INPUT_TYPE_TOUCH),
            isMouse = (inputData.pointerType == INPUT_TYPE_MOUSE);

        if (isMouse && inputData.sourceCapabilities && inputData.sourceCapabilities.firesTouchEvents) {
            return;
        }

        // when we're in a touch event, record touches to  de-dupe synthetic mouse event
        if (isTouch) {
            recordTouches.call(this, inputEvent, inputData);
        } else if (isMouse && isSyntheticEvent.call(this, inputData)) {
            return;
        }

        this.callback(manager, inputEvent, inputData);
    },

    /**
     * remove the event listeners
     */
    destroy: function destroy() {
        this.touch.destroy();
        this.mouse.destroy();
    }
});

function recordTouches(eventType, eventData) {
    if (eventType & INPUT_START) {
        this.primaryTouch = eventData.changedPointers[0].identifier;
        setLastTouch.call(this, eventData);
    } else if (eventType & (INPUT_END | INPUT_CANCEL)) {
        setLastTouch.call(this, eventData);
    }
}

function setLastTouch(eventData) {
    var touch = eventData.changedPointers[0];

    if (touch.identifier === this.primaryTouch) {
        var lastTouch = {x: touch.clientX, y: touch.clientY};
        this.lastTouches.push(lastTouch);
        var lts = this.lastTouches;
        var removeLastTouch = function() {
            var i = lts.indexOf(lastTouch);
            if (i > -1) {
                lts.splice(i, 1);
            }
        };
        setTimeout(removeLastTouch, DEDUP_TIMEOUT);
    }
}

function isSyntheticEvent(eventData) {
    var x = eventData.srcEvent.clientX, y = eventData.srcEvent.clientY;
    for (var i = 0; i < this.lastTouches.length; i++) {
        var t = this.lastTouches[i];
        var dx = Math.abs(x - t.x), dy = Math.abs(y - t.y);
        if (dx <= DEDUP_DISTANCE && dy <= DEDUP_DISTANCE) {
            return true;
        }
    }
    return false;
}

var PREFIXED_TOUCH_ACTION = prefixed(TEST_ELEMENT.style, 'touchAction');
var NATIVE_TOUCH_ACTION = PREFIXED_TOUCH_ACTION !== undefined;

// magical touchAction value
var TOUCH_ACTION_COMPUTE = 'compute';
var TOUCH_ACTION_AUTO = 'auto';
var TOUCH_ACTION_MANIPULATION = 'manipulation'; // not implemented
var TOUCH_ACTION_NONE = 'none';
var TOUCH_ACTION_PAN_X = 'pan-x';
var TOUCH_ACTION_PAN_Y = 'pan-y';
var TOUCH_ACTION_MAP = getTouchActionProps();

/**
 * Touch Action
 * sets the touchAction property or uses the js alternative
 * @param {Manager} manager
 * @param {String} value
 * @constructor
 */
function TouchAction(manager, value) {
    this.manager = manager;
    this.set(value);
}

TouchAction.prototype = {
    /**
     * set the touchAction value on the element or enable the polyfill
     * @param {String} value
     */
    set: function(value) {
        // find out the touch-action by the event handlers
        if (value == TOUCH_ACTION_COMPUTE) {
            value = this.compute();
        }

        if (NATIVE_TOUCH_ACTION && this.manager.element.style && TOUCH_ACTION_MAP[value]) {
            this.manager.element.style[PREFIXED_TOUCH_ACTION] = value;
        }
        this.actions = value.toLowerCase().trim();
    },

    /**
     * just re-set the touchAction value
     */
    update: function() {
        this.set(this.manager.options.touchAction);
    },

    /**
     * compute the value for the touchAction property based on the recognizer's settings
     * @returns {String} value
     */
    compute: function() {
        var actions = [];
        each(this.manager.recognizers, function(recognizer) {
            if (boolOrFn(recognizer.options.enable, [recognizer])) {
                actions = actions.concat(recognizer.getTouchAction());
            }
        });
        return cleanTouchActions(actions.join(' '));
    },

    /**
     * this method is called on each input cycle and provides the preventing of the browser behavior
     * @param {Object} input
     */
    preventDefaults: function(input) {
        var srcEvent = input.srcEvent;
        var direction = input.offsetDirection;

        // if the touch action did prevented once this session
        if (this.manager.session.prevented) {
            srcEvent.preventDefault();
            return;
        }

        var actions = this.actions;
        var hasNone = inStr(actions, TOUCH_ACTION_NONE) && !TOUCH_ACTION_MAP[TOUCH_ACTION_NONE];
        var hasPanY = inStr(actions, TOUCH_ACTION_PAN_Y) && !TOUCH_ACTION_MAP[TOUCH_ACTION_PAN_Y];
        var hasPanX = inStr(actions, TOUCH_ACTION_PAN_X) && !TOUCH_ACTION_MAP[TOUCH_ACTION_PAN_X];

        if (hasNone) {
            //do not prevent defaults if this is a tap gesture

            var isTapPointer = input.pointers.length === 1;
            var isTapMovement = input.distance < 2;
            var isTapTouchTime = input.deltaTime < 250;

            if (isTapPointer && isTapMovement && isTapTouchTime) {
                return;
            }
        }

        if (hasPanX && hasPanY) {
            // `pan-x pan-y` means browser handles all scrolling/panning, do not prevent
            return;
        }

        if (hasNone ||
            (hasPanY && direction & DIRECTION_HORIZONTAL) ||
            (hasPanX && direction & DIRECTION_VERTICAL)) {
            return this.preventSrc(srcEvent);
        }
    },

    /**
     * call preventDefault to prevent the browser's default behavior (scrolling in most cases)
     * @param {Object} srcEvent
     */
    preventSrc: function(srcEvent) {
        this.manager.session.prevented = true;
        srcEvent.preventDefault();
    }
};

/**
 * when the touchActions are collected they are not a valid value, so we need to clean things up. *
 * @param {String} actions
 * @returns {*}
 */
function cleanTouchActions(actions) {
    // none
    if (inStr(actions, TOUCH_ACTION_NONE)) {
        return TOUCH_ACTION_NONE;
    }

    var hasPanX = inStr(actions, TOUCH_ACTION_PAN_X);
    var hasPanY = inStr(actions, TOUCH_ACTION_PAN_Y);

    // if both pan-x and pan-y are set (different recognizers
    // for different directions, e.g. horizontal pan but vertical swipe?)
    // we need none (as otherwise with pan-x pan-y combined none of these
    // recognizers will work, since the browser would handle all panning
    if (hasPanX && hasPanY) {
        return TOUCH_ACTION_NONE;
    }

    // pan-x OR pan-y
    if (hasPanX || hasPanY) {
        return hasPanX ? TOUCH_ACTION_PAN_X : TOUCH_ACTION_PAN_Y;
    }

    // manipulation
    if (inStr(actions, TOUCH_ACTION_MANIPULATION)) {
        return TOUCH_ACTION_MANIPULATION;
    }

    return TOUCH_ACTION_AUTO;
}

function getTouchActionProps() {
    if (!NATIVE_TOUCH_ACTION) {
        return false;
    }
    var touchMap = {};
    var cssSupports = window.CSS && window.CSS.supports;
    ['auto', 'manipulation', 'pan-y', 'pan-x', 'pan-x pan-y', 'none'].forEach(function(val) {

        // If css.supports is not supported but there is native touch-action assume it supports
        // all values. This is the case for IE 10 and 11.
        touchMap[val] = cssSupports ? window.CSS.supports('touch-action', val) : true;
    });
    return touchMap;
}

/**
 * Recognizer flow explained; *
 * All recognizers have the initial state of POSSIBLE when a input session starts.
 * The definition of a input session is from the first input until the last input, with all it's movement in it. *
 * Example session for mouse-input: mousedown -> mousemove -> mouseup
 *
 * On each recognizing cycle (see Manager.recognize) the .recognize() method is executed
 * which determines with state it should be.
 *
 * If the recognizer has the state FAILED, CANCELLED or RECOGNIZED (equals ENDED), it is reset to
 * POSSIBLE to give it another change on the next cycle.
 *
 *               Possible
 *                  |
 *            +-----+---------------+
 *            |                     |
 *      +-----+-----+               |
 *      |           |               |
 *   Failed      Cancelled          |
 *                          +-------+------+
 *                          |              |
 *                      Recognized       Began
 *                                         |
 *                                      Changed
 *                                         |
 *                                  Ended/Recognized
 */
var STATE_POSSIBLE = 1;
var STATE_BEGAN = 2;
var STATE_CHANGED = 4;
var STATE_ENDED = 8;
var STATE_RECOGNIZED = STATE_ENDED;
var STATE_CANCELLED = 16;
var STATE_FAILED = 32;

/**
 * Recognizer
 * Every recognizer needs to extend from this class.
 * @constructor
 * @param {Object} options
 */
function Recognizer(options) {
    this.options = assign({}, this.defaults, options || {});

    this.id = uniqueId();

    this.manager = null;

    // default is enable true
    this.options.enable = ifUndefined(this.options.enable, true);

    this.state = STATE_POSSIBLE;

    this.simultaneous = {};
    this.requireFail = [];
}

Recognizer.prototype = {
    /**
     * @virtual
     * @type {Object}
     */
    defaults: {},

    /**
     * set options
     * @param {Object} options
     * @return {Recognizer}
     */
    set: function(options) {
        assign(this.options, options);

        // also update the touchAction, in case something changed about the directions/enabled state
        this.manager && this.manager.touchAction.update();
        return this;
    },

    /**
     * recognize simultaneous with an other recognizer.
     * @param {Recognizer} otherRecognizer
     * @returns {Recognizer} this
     */
    recognizeWith: function(otherRecognizer) {
        if (invokeArrayArg(otherRecognizer, 'recognizeWith', this)) {
            return this;
        }

        var simultaneous = this.simultaneous;
        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        if (!simultaneous[otherRecognizer.id]) {
            simultaneous[otherRecognizer.id] = otherRecognizer;
            otherRecognizer.recognizeWith(this);
        }
        return this;
    },

    /**
     * drop the simultaneous link. it doesnt remove the link on the other recognizer.
     * @param {Recognizer} otherRecognizer
     * @returns {Recognizer} this
     */
    dropRecognizeWith: function(otherRecognizer) {
        if (invokeArrayArg(otherRecognizer, 'dropRecognizeWith', this)) {
            return this;
        }

        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        delete this.simultaneous[otherRecognizer.id];
        return this;
    },

    /**
     * recognizer can only run when an other is failing
     * @param {Recognizer} otherRecognizer
     * @returns {Recognizer} this
     */
    requireFailure: function(otherRecognizer) {
        if (invokeArrayArg(otherRecognizer, 'requireFailure', this)) {
            return this;
        }

        var requireFail = this.requireFail;
        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        if (inArray(requireFail, otherRecognizer) === -1) {
            requireFail.push(otherRecognizer);
            otherRecognizer.requireFailure(this);
        }
        return this;
    },

    /**
     * drop the requireFailure link. it does not remove the link on the other recognizer.
     * @param {Recognizer} otherRecognizer
     * @returns {Recognizer} this
     */
    dropRequireFailure: function(otherRecognizer) {
        if (invokeArrayArg(otherRecognizer, 'dropRequireFailure', this)) {
            return this;
        }

        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        var index = inArray(this.requireFail, otherRecognizer);
        if (index > -1) {
            this.requireFail.splice(index, 1);
        }
        return this;
    },

    /**
     * has require failures boolean
     * @returns {boolean}
     */
    hasRequireFailures: function() {
        return this.requireFail.length > 0;
    },

    /**
     * if the recognizer can recognize simultaneous with an other recognizer
     * @param {Recognizer} otherRecognizer
     * @returns {Boolean}
     */
    canRecognizeWith: function(otherRecognizer) {
        return !!this.simultaneous[otherRecognizer.id];
    },

    /**
     * You should use `tryEmit` instead of `emit` directly to check
     * that all the needed recognizers has failed before emitting.
     * @param {Object} input
     */
    emit: function(input) {
        var self = this;
        var state = this.state;

        function emit(event) {
            self.manager.emit(event, input);
        }

        // 'panstart' and 'panmove'
        if (state < STATE_ENDED) {
            emit(self.options.event + stateStr(state));
        }

        emit(self.options.event); // simple 'eventName' events

        if (input.additionalEvent) { // additional event(panleft, panright, pinchin, pinchout...)
            emit(input.additionalEvent);
        }

        // panend and pancancel
        if (state >= STATE_ENDED) {
            emit(self.options.event + stateStr(state));
        }
    },

    /**
     * Check that all the require failure recognizers has failed,
     * if true, it emits a gesture event,
     * otherwise, setup the state to FAILED.
     * @param {Object} input
     */
    tryEmit: function(input) {
        if (this.canEmit()) {
            return this.emit(input);
        }
        // it's failing anyway
        this.state = STATE_FAILED;
    },

    /**
     * can we emit?
     * @returns {boolean}
     */
    canEmit: function() {
        var i = 0;
        while (i < this.requireFail.length) {
            if (!(this.requireFail[i].state & (STATE_FAILED | STATE_POSSIBLE))) {
                return false;
            }
            i++;
        }
        return true;
    },

    /**
     * update the recognizer
     * @param {Object} inputData
     */
    recognize: function(inputData) {
        // make a new copy of the inputData
        // so we can change the inputData without messing up the other recognizers
        var inputDataClone = assign({}, inputData);

        // is is enabled and allow recognizing?
        if (!boolOrFn(this.options.enable, [this, inputDataClone])) {
            this.reset();
            this.state = STATE_FAILED;
            return;
        }

        // reset when we've reached the end
        if (this.state & (STATE_RECOGNIZED | STATE_CANCELLED | STATE_FAILED)) {
            this.state = STATE_POSSIBLE;
        }

        this.state = this.process(inputDataClone);

        // the recognizer has recognized a gesture
        // so trigger an event
        if (this.state & (STATE_BEGAN | STATE_CHANGED | STATE_ENDED | STATE_CANCELLED)) {
            this.tryEmit(inputDataClone);
        }
    },

    /**
     * return the state of the recognizer
     * the actual recognizing happens in this method
     * @virtual
     * @param {Object} inputData
     * @returns {Const} STATE
     */
    process: function(inputData) { }, // jshint ignore:line

    /**
     * return the preferred touch-action
     * @virtual
     * @returns {Array}
     */
    getTouchAction: function() { },

    /**
     * called when the gesture isn't allowed to recognize
     * like when another is being recognized or it is disabled
     * @virtual
     */
    reset: function() { }
};

/**
 * get a usable string, used as event postfix
 * @param {Const} state
 * @returns {String} state
 */
function stateStr(state) {
    if (state & STATE_CANCELLED) {
        return 'cancel';
    } else if (state & STATE_ENDED) {
        return 'end';
    } else if (state & STATE_CHANGED) {
        return 'move';
    } else if (state & STATE_BEGAN) {
        return 'start';
    }
    return '';
}

/**
 * direction cons to string
 * @param {Const} direction
 * @returns {String}
 */
function directionStr(direction) {
    if (direction == DIRECTION_DOWN) {
        return 'down';
    } else if (direction == DIRECTION_UP) {
        return 'up';
    } else if (direction == DIRECTION_LEFT) {
        return 'left';
    } else if (direction == DIRECTION_RIGHT) {
        return 'right';
    }
    return '';
}

/**
 * get a recognizer by name if it is bound to a manager
 * @param {Recognizer|String} otherRecognizer
 * @param {Recognizer} recognizer
 * @returns {Recognizer}
 */
function getRecognizerByNameIfManager(otherRecognizer, recognizer) {
    var manager = recognizer.manager;
    if (manager) {
        return manager.get(otherRecognizer);
    }
    return otherRecognizer;
}

/**
 * This recognizer is just used as a base for the simple attribute recognizers.
 * @constructor
 * @extends Recognizer
 */
function AttrRecognizer() {
    Recognizer.apply(this, arguments);
}

inherit(AttrRecognizer, Recognizer, {
    /**
     * @namespace
     * @memberof AttrRecognizer
     */
    defaults: {
        /**
         * @type {Number}
         * @default 1
         */
        pointers: 1
    },

    /**
     * Used to check if it the recognizer receives valid input, like input.distance > 10.
     * @memberof AttrRecognizer
     * @param {Object} input
     * @returns {Boolean} recognized
     */
    attrTest: function(input) {
        var optionPointers = this.options.pointers;
        return optionPointers === 0 || input.pointers.length === optionPointers;
    },

    /**
     * Process the input and return the state for the recognizer
     * @memberof AttrRecognizer
     * @param {Object} input
     * @returns {*} State
     */
    process: function(input) {
        var state = this.state;
        var eventType = input.eventType;

        var isRecognized = state & (STATE_BEGAN | STATE_CHANGED);
        var isValid = this.attrTest(input);

        // on cancel input and we've recognized before, return STATE_CANCELLED
        if (isRecognized && (eventType & INPUT_CANCEL || !isValid)) {
            return state | STATE_CANCELLED;
        } else if (isRecognized || isValid) {
            if (eventType & INPUT_END) {
                return state | STATE_ENDED;
            } else if (!(state & STATE_BEGAN)) {
                return STATE_BEGAN;
            }
            return state | STATE_CHANGED;
        }
        return STATE_FAILED;
    }
});

/**
 * Pan
 * Recognized when the pointer is down and moved in the allowed direction.
 * @constructor
 * @extends AttrRecognizer
 */
function PanRecognizer() {
    AttrRecognizer.apply(this, arguments);

    this.pX = null;
    this.pY = null;
}

inherit(PanRecognizer, AttrRecognizer, {
    /**
     * @namespace
     * @memberof PanRecognizer
     */
    defaults: {
        event: 'pan',
        threshold: 10,
        pointers: 1,
        direction: DIRECTION_ALL
    },

    getTouchAction: function() {
        var direction = this.options.direction;
        var actions = [];
        if (direction & DIRECTION_HORIZONTAL) {
            actions.push(TOUCH_ACTION_PAN_Y);
        }
        if (direction & DIRECTION_VERTICAL) {
            actions.push(TOUCH_ACTION_PAN_X);
        }
        return actions;
    },

    directionTest: function(input) {
        var options = this.options;
        var hasMoved = true;
        var distance = input.distance;
        var direction = input.direction;
        var x = input.deltaX;
        var y = input.deltaY;

        // lock to axis?
        if (!(direction & options.direction)) {
            if (options.direction & DIRECTION_HORIZONTAL) {
                direction = (x === 0) ? DIRECTION_NONE : (x < 0) ? DIRECTION_LEFT : DIRECTION_RIGHT;
                hasMoved = x != this.pX;
                distance = Math.abs(input.deltaX);
            } else {
                direction = (y === 0) ? DIRECTION_NONE : (y < 0) ? DIRECTION_UP : DIRECTION_DOWN;
                hasMoved = y != this.pY;
                distance = Math.abs(input.deltaY);
            }
        }
        input.direction = direction;
        return hasMoved && distance > options.threshold && direction & options.direction;
    },

    attrTest: function(input) {
        return AttrRecognizer.prototype.attrTest.call(this, input) &&
            (this.state & STATE_BEGAN || (!(this.state & STATE_BEGAN) && this.directionTest(input)));
    },

    emit: function(input) {

        this.pX = input.deltaX;
        this.pY = input.deltaY;

        var direction = directionStr(input.direction);

        if (direction) {
            input.additionalEvent = this.options.event + direction;
        }
        this._super.emit.call(this, input);
    }
});

/**
 * Pinch
 * Recognized when two or more pointers are moving toward (zoom-in) or away from each other (zoom-out).
 * @constructor
 * @extends AttrRecognizer
 */
function PinchRecognizer() {
    AttrRecognizer.apply(this, arguments);
}

inherit(PinchRecognizer, AttrRecognizer, {
    /**
     * @namespace
     * @memberof PinchRecognizer
     */
    defaults: {
        event: 'pinch',
        threshold: 0,
        pointers: 2
    },

    getTouchAction: function() {
        return [TOUCH_ACTION_NONE];
    },

    attrTest: function(input) {
        return this._super.attrTest.call(this, input) &&
            (Math.abs(input.scale - 1) > this.options.threshold || this.state & STATE_BEGAN);
    },

    emit: function(input) {
        if (input.scale !== 1) {
            var inOut = input.scale < 1 ? 'in' : 'out';
            input.additionalEvent = this.options.event + inOut;
        }
        this._super.emit.call(this, input);
    }
});

/**
 * Press
 * Recognized when the pointer is down for x ms without any movement.
 * @constructor
 * @extends Recognizer
 */
function PressRecognizer() {
    Recognizer.apply(this, arguments);

    this._timer = null;
    this._input = null;
}

inherit(PressRecognizer, Recognizer, {
    /**
     * @namespace
     * @memberof PressRecognizer
     */
    defaults: {
        event: 'press',
        pointers: 1,
        time: 251, // minimal time of the pointer to be pressed
        threshold: 9 // a minimal movement is ok, but keep it low
    },

    getTouchAction: function() {
        return [TOUCH_ACTION_AUTO];
    },

    process: function(input) {
        var options = this.options;
        var validPointers = input.pointers.length === options.pointers;
        var validMovement = input.distance < options.threshold;
        var validTime = input.deltaTime > options.time;

        this._input = input;

        // we only allow little movement
        // and we've reached an end event, so a tap is possible
        if (!validMovement || !validPointers || (input.eventType & (INPUT_END | INPUT_CANCEL) && !validTime)) {
            this.reset();
        } else if (input.eventType & INPUT_START) {
            this.reset();
            this._timer = setTimeoutContext(function() {
                this.state = STATE_RECOGNIZED;
                this.tryEmit();
            }, options.time, this);
        } else if (input.eventType & INPUT_END) {
            return STATE_RECOGNIZED;
        }
        return STATE_FAILED;
    },

    reset: function() {
        clearTimeout(this._timer);
    },

    emit: function(input) {
        if (this.state !== STATE_RECOGNIZED) {
            return;
        }

        if (input && (input.eventType & INPUT_END)) {
            this.manager.emit(this.options.event + 'up', input);
        } else {
            this._input.timeStamp = now();
            this.manager.emit(this.options.event, this._input);
        }
    }
});

/**
 * Rotate
 * Recognized when two or more pointer are moving in a circular motion.
 * @constructor
 * @extends AttrRecognizer
 */
function RotateRecognizer() {
    AttrRecognizer.apply(this, arguments);
}

inherit(RotateRecognizer, AttrRecognizer, {
    /**
     * @namespace
     * @memberof RotateRecognizer
     */
    defaults: {
        event: 'rotate',
        threshold: 0,
        pointers: 2
    },

    getTouchAction: function() {
        return [TOUCH_ACTION_NONE];
    },

    attrTest: function(input) {
        return this._super.attrTest.call(this, input) &&
            (Math.abs(input.rotation) > this.options.threshold || this.state & STATE_BEGAN);
    }
});

/**
 * Swipe
 * Recognized when the pointer is moving fast (velocity), with enough distance in the allowed direction.
 * @constructor
 * @extends AttrRecognizer
 */
function SwipeRecognizer() {
    AttrRecognizer.apply(this, arguments);
}

inherit(SwipeRecognizer, AttrRecognizer, {
    /**
     * @namespace
     * @memberof SwipeRecognizer
     */
    defaults: {
        event: 'swipe',
        threshold: 10,
        velocity: 0.3,
        direction: DIRECTION_HORIZONTAL | DIRECTION_VERTICAL,
        pointers: 1
    },

    getTouchAction: function() {
        return PanRecognizer.prototype.getTouchAction.call(this);
    },

    attrTest: function(input) {
        var direction = this.options.direction;
        var velocity;

        if (direction & (DIRECTION_HORIZONTAL | DIRECTION_VERTICAL)) {
            velocity = input.overallVelocity;
        } else if (direction & DIRECTION_HORIZONTAL) {
            velocity = input.overallVelocityX;
        } else if (direction & DIRECTION_VERTICAL) {
            velocity = input.overallVelocityY;
        }

        return this._super.attrTest.call(this, input) &&
            direction & input.offsetDirection &&
            input.distance > this.options.threshold &&
            input.maxPointers == this.options.pointers &&
            abs(velocity) > this.options.velocity && input.eventType & INPUT_END;
    },

    emit: function(input) {
        var direction = directionStr(input.offsetDirection);
        if (direction) {
            this.manager.emit(this.options.event + direction, input);
        }

        this.manager.emit(this.options.event, input);
    }
});

/**
 * A tap is ecognized when the pointer is doing a small tap/click. Multiple taps are recognized if they occur
 * between the given interval and position. The delay option can be used to recognize multi-taps without firing
 * a single tap.
 *
 * The eventData from the emitted event contains the property `tapCount`, which contains the amount of
 * multi-taps being recognized.
 * @constructor
 * @extends Recognizer
 */
function TapRecognizer() {
    Recognizer.apply(this, arguments);

    // previous time and center,
    // used for tap counting
    this.pTime = false;
    this.pCenter = false;

    this._timer = null;
    this._input = null;
    this.count = 0;
}

inherit(TapRecognizer, Recognizer, {
    /**
     * @namespace
     * @memberof PinchRecognizer
     */
    defaults: {
        event: 'tap',
        pointers: 1,
        taps: 1,
        interval: 300, // max time between the multi-tap taps
        time: 250, // max time of the pointer to be down (like finger on the screen)
        threshold: 9, // a minimal movement is ok, but keep it low
        posThreshold: 10 // a multi-tap can be a bit off the initial position
    },

    getTouchAction: function() {
        return [TOUCH_ACTION_MANIPULATION];
    },

    process: function(input) {
        var options = this.options;

        var validPointers = input.pointers.length === options.pointers;
        var validMovement = input.distance < options.threshold;
        var validTouchTime = input.deltaTime < options.time;

        this.reset();

        if ((input.eventType & INPUT_START) && (this.count === 0)) {
            return this.failTimeout();
        }

        // we only allow little movement
        // and we've reached an end event, so a tap is possible
        if (validMovement && validTouchTime && validPointers) {
            if (input.eventType != INPUT_END) {
                return this.failTimeout();
            }

            var validInterval = this.pTime ? (input.timeStamp - this.pTime < options.interval) : true;
            var validMultiTap = !this.pCenter || getDistance(this.pCenter, input.center) < options.posThreshold;

            this.pTime = input.timeStamp;
            this.pCenter = input.center;

            if (!validMultiTap || !validInterval) {
                this.count = 1;
            } else {
                this.count += 1;
            }

            this._input = input;

            // if tap count matches we have recognized it,
            // else it has began recognizing...
            var tapCount = this.count % options.taps;
            if (tapCount === 0) {
                // no failing requirements, immediately trigger the tap event
                // or wait as long as the multitap interval to trigger
                if (!this.hasRequireFailures()) {
                    return STATE_RECOGNIZED;
                } else {
                    this._timer = setTimeoutContext(function() {
                        this.state = STATE_RECOGNIZED;
                        this.tryEmit();
                    }, options.interval, this);
                    return STATE_BEGAN;
                }
            }
        }
        return STATE_FAILED;
    },

    failTimeout: function() {
        this._timer = setTimeoutContext(function() {
            this.state = STATE_FAILED;
        }, this.options.interval, this);
        return STATE_FAILED;
    },

    reset: function() {
        clearTimeout(this._timer);
    },

    emit: function() {
        if (this.state == STATE_RECOGNIZED) {
            this._input.tapCount = this.count;
            this.manager.emit(this.options.event, this._input);
        }
    }
});

/**
 * Simple way to create a manager with a default set of recognizers.
 * @param {HTMLElement} element
 * @param {Object} [options]
 * @constructor
 */
function Hammer(element, options) {
    options = options || {};
    options.recognizers = ifUndefined(options.recognizers, Hammer.defaults.preset);
    return new Manager(element, options);
}

/**
 * @const {string}
 */
Hammer.VERSION = '2.0.7';

/**
 * default settings
 * @namespace
 */
Hammer.defaults = {
    /**
     * set if DOM events are being triggered.
     * But this is slower and unused by simple implementations, so disabled by default.
     * @type {Boolean}
     * @default false
     */
    domEvents: false,

    /**
     * The value for the touchAction property/fallback.
     * When set to `compute` it will magically set the correct value based on the added recognizers.
     * @type {String}
     * @default compute
     */
    touchAction: TOUCH_ACTION_COMPUTE,

    /**
     * @type {Boolean}
     * @default true
     */
    enable: true,

    /**
     * EXPERIMENTAL FEATURE -- can be removed/changed
     * Change the parent input target element.
     * If Null, then it is being set the to main element.
     * @type {Null|EventTarget}
     * @default null
     */
    inputTarget: null,

    /**
     * force an input class
     * @type {Null|Function}
     * @default null
     */
    inputClass: null,

    /**
     * Default recognizer setup when calling `Hammer()`
     * When creating a new Manager these will be skipped.
     * @type {Array}
     */
    preset: [
        // RecognizerClass, options, [recognizeWith, ...], [requireFailure, ...]
        [RotateRecognizer, {enable: false}],
        [PinchRecognizer, {enable: false}, ['rotate']],
        [SwipeRecognizer, {direction: DIRECTION_HORIZONTAL}],
        [PanRecognizer, {direction: DIRECTION_HORIZONTAL}, ['swipe']],
        [TapRecognizer],
        [TapRecognizer, {event: 'doubletap', taps: 2}, ['tap']],
        [PressRecognizer]
    ],

    /**
     * Some CSS properties can be used to improve the working of Hammer.
     * Add them to this method and they will be set when creating a new Manager.
     * @namespace
     */
    cssProps: {
        /**
         * Disables text selection to improve the dragging gesture. Mainly for desktop browsers.
         * @type {String}
         * @default 'none'
         */
        userSelect: 'none',

        /**
         * Disable the Windows Phone grippers when pressing an element.
         * @type {String}
         * @default 'none'
         */
        touchSelect: 'none',

        /**
         * Disables the default callout shown when you touch and hold a touch target.
         * On iOS, when you touch and hold a touch target such as a link, Safari displays
         * a callout containing information about the link. This property allows you to disable that callout.
         * @type {String}
         * @default 'none'
         */
        touchCallout: 'none',

        /**
         * Specifies whether zooming is enabled. Used by IE10>
         * @type {String}
         * @default 'none'
         */
        contentZooming: 'none',

        /**
         * Specifies that an entire element should be draggable instead of its contents. Mainly for desktop browsers.
         * @type {String}
         * @default 'none'
         */
        userDrag: 'none',

        /**
         * Overrides the highlight color shown when the user taps a link or a JavaScript
         * clickable element in iOS. This property obeys the alpha value, if specified.
         * @type {String}
         * @default 'rgba(0,0,0,0)'
         */
        tapHighlightColor: 'rgba(0,0,0,0)'
    }
};

var STOP = 1;
var FORCED_STOP = 2;

/**
 * Manager
 * @param {HTMLElement} element
 * @param {Object} [options]
 * @constructor
 */
function Manager(element, options) {
    this.options = assign({}, Hammer.defaults, options || {});

    this.options.inputTarget = this.options.inputTarget || element;

    this.handlers = {};
    this.session = {};
    this.recognizers = [];
    this.oldCssProps = {};

    this.element = element;
    this.input = createInputInstance(this);
    this.touchAction = new TouchAction(this, this.options.touchAction);

    toggleCssProps(this, true);

    each(this.options.recognizers, function(item) {
        var recognizer = this.add(new (item[0])(item[1]));
        item[2] && recognizer.recognizeWith(item[2]);
        item[3] && recognizer.requireFailure(item[3]);
    }, this);
}

Manager.prototype = {
    /**
     * set options
     * @param {Object} options
     * @returns {Manager}
     */
    set: function(options) {
        assign(this.options, options);

        // Options that need a little more setup
        if (options.touchAction) {
            this.touchAction.update();
        }
        if (options.inputTarget) {
            // Clean up existing event listeners and reinitialize
            this.input.destroy();
            this.input.target = options.inputTarget;
            this.input.init();
        }
        return this;
    },

    /**
     * stop recognizing for this session.
     * This session will be discarded, when a new [input]start event is fired.
     * When forced, the recognizer cycle is stopped immediately.
     * @param {Boolean} [force]
     */
    stop: function(force) {
        this.session.stopped = force ? FORCED_STOP : STOP;
    },

    /**
     * run the recognizers!
     * called by the inputHandler function on every movement of the pointers (touches)
     * it walks through all the recognizers and tries to detect the gesture that is being made
     * @param {Object} inputData
     */
    recognize: function(inputData) {
        var session = this.session;
        if (session.stopped) {
            return;
        }

        // run the touch-action polyfill
        this.touchAction.preventDefaults(inputData);

        var recognizer;
        var recognizers = this.recognizers;

        // this holds the recognizer that is being recognized.
        // so the recognizer's state needs to be BEGAN, CHANGED, ENDED or RECOGNIZED
        // if no recognizer is detecting a thing, it is set to `null`
        var curRecognizer = session.curRecognizer;

        // reset when the last recognizer is recognized
        // or when we're in a new session
        if (!curRecognizer || (curRecognizer && curRecognizer.state & STATE_RECOGNIZED)) {
            curRecognizer = session.curRecognizer = null;
        }

        var i = 0;
        while (i < recognizers.length) {
            recognizer = recognizers[i];

            // find out if we are allowed try to recognize the input for this one.
            // 1.   allow if the session is NOT forced stopped (see the .stop() method)
            // 2.   allow if we still haven't recognized a gesture in this session, or the this recognizer is the one
            //      that is being recognized.
            // 3.   allow if the recognizer is allowed to run simultaneous with the current recognized recognizer.
            //      this can be setup with the `recognizeWith()` method on the recognizer.
            if (session.stopped !== FORCED_STOP && ( // 1
                    !curRecognizer || recognizer == curRecognizer || // 2
                    recognizer.canRecognizeWith(curRecognizer))) { // 3
                recognizer.recognize(inputData);
            } else {
                recognizer.reset();
            }

            // if the recognizer has been recognizing the input as a valid gesture, we want to store this one as the
            // current active recognizer. but only if we don't already have an active recognizer
            if (!curRecognizer && recognizer.state & (STATE_BEGAN | STATE_CHANGED | STATE_ENDED)) {
                curRecognizer = session.curRecognizer = recognizer;
            }
            i++;
        }
    },

    /**
     * get a recognizer by its event name.
     * @param {Recognizer|String} recognizer
     * @returns {Recognizer|Null}
     */
    get: function(recognizer) {
        if (recognizer instanceof Recognizer) {
            return recognizer;
        }

        var recognizers = this.recognizers;
        for (var i = 0; i < recognizers.length; i++) {
            if (recognizers[i].options.event == recognizer) {
                return recognizers[i];
            }
        }
        return null;
    },

    /**
     * add a recognizer to the manager
     * existing recognizers with the same event name will be removed
     * @param {Recognizer} recognizer
     * @returns {Recognizer|Manager}
     */
    add: function(recognizer) {
        if (invokeArrayArg(recognizer, 'add', this)) {
            return this;
        }

        // remove existing
        var existing = this.get(recognizer.options.event);
        if (existing) {
            this.remove(existing);
        }

        this.recognizers.push(recognizer);
        recognizer.manager = this;

        this.touchAction.update();
        return recognizer;
    },

    /**
     * remove a recognizer by name or instance
     * @param {Recognizer|String} recognizer
     * @returns {Manager}
     */
    remove: function(recognizer) {
        if (invokeArrayArg(recognizer, 'remove', this)) {
            return this;
        }

        recognizer = this.get(recognizer);

        // let's make sure this recognizer exists
        if (recognizer) {
            var recognizers = this.recognizers;
            var index = inArray(recognizers, recognizer);

            if (index !== -1) {
                recognizers.splice(index, 1);
                this.touchAction.update();
            }
        }

        return this;
    },

    /**
     * bind event
     * @param {String} events
     * @param {Function} handler
     * @returns {EventEmitter} this
     */
    on: function(events, handler) {
        if (events === undefined) {
            return;
        }
        if (handler === undefined) {
            return;
        }

        var handlers = this.handlers;
        each(splitStr(events), function(event) {
            handlers[event] = handlers[event] || [];
            handlers[event].push(handler);
        });
        return this;
    },

    /**
     * unbind event, leave emit blank to remove all handlers
     * @param {String} events
     * @param {Function} [handler]
     * @returns {EventEmitter} this
     */
    off: function(events, handler) {
        if (events === undefined) {
            return;
        }

        var handlers = this.handlers;
        each(splitStr(events), function(event) {
            if (!handler) {
                delete handlers[event];
            } else {
                handlers[event] && handlers[event].splice(inArray(handlers[event], handler), 1);
            }
        });
        return this;
    },

    /**
     * emit event to the listeners
     * @param {String} event
     * @param {Object} data
     */
    emit: function(event, data) {
        // we also want to trigger dom events
        if (this.options.domEvents) {
            triggerDomEvent(event, data);
        }

        // no handlers, so skip it all
        var handlers = this.handlers[event] && this.handlers[event].slice();
        if (!handlers || !handlers.length) {
            return;
        }

        data.type = event;
        data.preventDefault = function() {
            data.srcEvent.preventDefault();
        };

        var i = 0;
        while (i < handlers.length) {
            handlers[i](data);
            i++;
        }
    },

    /**
     * destroy the manager and unbinds all events
     * it doesn't unbind dom events, that is the user own responsibility
     */
    destroy: function() {
        this.element && toggleCssProps(this, false);

        this.handlers = {};
        this.session = {};
        this.input.destroy();
        this.element = null;
    }
};

/**
 * add/remove the css properties as defined in manager.options.cssProps
 * @param {Manager} manager
 * @param {Boolean} add
 */
function toggleCssProps(manager, add) {
    var element = manager.element;
    if (!element.style) {
        return;
    }
    var prop;
    each(manager.options.cssProps, function(value, name) {
        prop = prefixed(element.style, name);
        if (add) {
            manager.oldCssProps[prop] = element.style[prop];
            element.style[prop] = value;
        } else {
            element.style[prop] = manager.oldCssProps[prop] || '';
        }
    });
    if (!add) {
        manager.oldCssProps = {};
    }
}

/**
 * trigger dom event
 * @param {String} event
 * @param {Object} data
 */
function triggerDomEvent(event, data) {
    var gestureEvent = document.createEvent('Event');
    gestureEvent.initEvent(event, true, true);
    gestureEvent.gesture = data;
    data.target.dispatchEvent(gestureEvent);
}

assign(Hammer, {
    INPUT_START: INPUT_START,
    INPUT_MOVE: INPUT_MOVE,
    INPUT_END: INPUT_END,
    INPUT_CANCEL: INPUT_CANCEL,

    STATE_POSSIBLE: STATE_POSSIBLE,
    STATE_BEGAN: STATE_BEGAN,
    STATE_CHANGED: STATE_CHANGED,
    STATE_ENDED: STATE_ENDED,
    STATE_RECOGNIZED: STATE_RECOGNIZED,
    STATE_CANCELLED: STATE_CANCELLED,
    STATE_FAILED: STATE_FAILED,

    DIRECTION_NONE: DIRECTION_NONE,
    DIRECTION_LEFT: DIRECTION_LEFT,
    DIRECTION_RIGHT: DIRECTION_RIGHT,
    DIRECTION_UP: DIRECTION_UP,
    DIRECTION_DOWN: DIRECTION_DOWN,
    DIRECTION_HORIZONTAL: DIRECTION_HORIZONTAL,
    DIRECTION_VERTICAL: DIRECTION_VERTICAL,
    DIRECTION_ALL: DIRECTION_ALL,

    Manager: Manager,
    Input: Input,
    TouchAction: TouchAction,

    TouchInput: TouchInput,
    MouseInput: MouseInput,
    PointerEventInput: PointerEventInput,
    TouchMouseInput: TouchMouseInput,
    SingleTouchInput: SingleTouchInput,

    Recognizer: Recognizer,
    AttrRecognizer: AttrRecognizer,
    Tap: TapRecognizer,
    Pan: PanRecognizer,
    Swipe: SwipeRecognizer,
    Pinch: PinchRecognizer,
    Rotate: RotateRecognizer,
    Press: PressRecognizer,

    on: addEventListeners,
    off: removeEventListeners,
    each: each,
    merge: merge,
    extend: extend,
    assign: assign,
    inherit: inherit,
    bindFn: bindFn,
    prefixed: prefixed
});

// this prevents errors when Hammer is loaded in the presence of an AMD
//  style loader but by script tag, not by the loader.
var freeGlobal = (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : {})); // jshint ignore:line
freeGlobal.Hammer = Hammer;

if (typeof define === 'function' && define.amd) {
    define(function() {
        return Hammer;
    });
} else if (typeof module != 'undefined' && module.exports) {
    module.exports = Hammer;
} else {
    window[exportName] = Hammer;
}

})(window, document, 'Hammer');

},{}],189:[function(require,module,exports){
var hat = module.exports = function (bits, base) {
    if (!base) base = 16;
    if (bits === undefined) bits = 128;
    if (bits <= 0) return '0';
    
    var digits = Math.log(Math.pow(2, bits)) / Math.log(base);
    for (var i = 2; digits === Infinity; i *= 2) {
        digits = Math.log(Math.pow(2, bits / i)) / Math.log(base) * i;
    }
    
    var rem = digits - Math.floor(digits);
    
    var res = '';
    
    for (var i = 0; i < Math.floor(digits); i++) {
        var x = Math.floor(Math.random() * base).toString(base);
        res = x + res;
    }
    
    if (rem) {
        var b = Math.pow(base, rem);
        var x = Math.floor(Math.random() * b).toString(base);
        res = x + res;
    }
    
    var parsed = parseInt(res, base);
    if (parsed !== Infinity && parsed >= Math.pow(2, bits)) {
        return hat(bits, base)
    }
    else return res;
};

hat.rack = function (bits, base, expandBy) {
    var fn = function (data) {
        var iters = 0;
        do {
            if (iters ++ > 10) {
                if (expandBy) bits += expandBy;
                else throw new Error('too many ID collisions, use more bits')
            }
            
            var id = hat(bits, base);
        } while (Object.hasOwnProperty.call(hats, id));
        
        hats[id] = data;
        return id;
    };
    var hats = fn.hats = {};
    
    fn.get = function (id) {
        return fn.hats[id];
    };
    
    fn.set = function (id, value) {
        fn.hats[id] = value;
        return fn;
    };
    
    fn.bits = bits || 128;
    fn.base = base || 16;
    return fn;
};

},{}],190:[function(require,module,exports){
'use strict';

var hat = require('hat');


/**
 * Create a new id generator / cache instance.
 *
 * You may optionally provide a seed that is used internally.
 *
 * @param {Seed} seed
 */
function Ids(seed) {

  if (!(this instanceof Ids)) {
    return new Ids(seed);
  }

  seed = seed || [ 128, 36, 1 ];
  this._seed = seed.length ? hat.rack(seed[0], seed[1], seed[2]) : seed;
}

module.exports = Ids;

/**
 * Generate a next id.
 *
 * @param {Object} [element] element to bind the id to
 *
 * @return {String} id
 */
Ids.prototype.next = function(element) {
  return this._seed(element || true);
};

/**
 * Generate a next id with a given prefix.
 *
 * @param {Object} [element] element to bind the id to
 *
 * @return {String} id
 */
Ids.prototype.nextPrefixed = function(prefix, element) {
  var id;

  do {
    id = prefix + this.next(true);
  } while (this.assigned(id));

  // claim {prefix}{random}
  this.claim(id, element);

  // return
  return id;
};

/**
 * Manually claim an existing id.
 *
 * @param {String} id
 * @param {String} [element] element the id is claimed by
 */
Ids.prototype.claim = function(id, element) {
  this._seed.set(id, element || true);
};

/**
 * Returns true if the given id has already been assigned.
 *
 * @param  {String} id
 * @return {Boolean}
 */
Ids.prototype.assigned = function(id) {
  return this._seed.get(id) || false;
};

/**
 * Unclaim an id.
 *
 * @param  {String} id the id to unclaim
 */
Ids.prototype.unclaim = function(id) {
  delete this._seed.hats[id];
};


/**
 * Clear all claimed ids.
 */
Ids.prototype.clear = function() {

  var hats = this._seed.hats,
      id;

  for (id in hats) {
    this.unclaim(id);
  }
};
},{"hat":189}],191:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],192:[function(require,module,exports){
var createFindIndex = require('../internal/createFindIndex');

/**
 * This method is like `_.find` except that it returns the index of the first
 * element `predicate` returns truthy for instead of the element itself.
 *
 * If a property name is provided for `predicate` the created `_.property`
 * style callback returns the property value of the given element.
 *
 * If a value is also provided for `thisArg` the created `_.matchesProperty`
 * style callback returns `true` for elements that have a matching property
 * value, else `false`.
 *
 * If an object is provided for `predicate` the created `_.matches` style
 * callback returns `true` for elements that have the properties of the given
 * object, else `false`.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to search.
 * @param {Function|Object|string} [predicate=_.identity] The function invoked
 *  per iteration.
 * @param {*} [thisArg] The `this` binding of `predicate`.
 * @returns {number} Returns the index of the found element, else `-1`.
 * @example
 *
 * var users = [
 *   { 'user': 'barney',  'active': false },
 *   { 'user': 'fred',    'active': false },
 *   { 'user': 'pebbles', 'active': true }
 * ];
 *
 * _.findIndex(users, function(chr) {
 *   return chr.user == 'barney';
 * });
 * // => 0
 *
 * // using the `_.matches` callback shorthand
 * _.findIndex(users, { 'user': 'fred', 'active': false });
 * // => 1
 *
 * // using the `_.matchesProperty` callback shorthand
 * _.findIndex(users, 'active', false);
 * // => 0
 *
 * // using the `_.property` callback shorthand
 * _.findIndex(users, 'active');
 * // => 2
 */
var findIndex = createFindIndex();

module.exports = findIndex;

},{"../internal/createFindIndex":278}],193:[function(require,module,exports){
var baseFlatten = require('../internal/baseFlatten'),
    isIterateeCall = require('../internal/isIterateeCall');

/**
 * Flattens a nested array. If `isDeep` is `true` the array is recursively
 * flattened, otherwise it's only flattened a single level.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to flatten.
 * @param {boolean} [isDeep] Specify a deep flatten.
 * @param- {Object} [guard] Enables use as a callback for functions like `_.map`.
 * @returns {Array} Returns the new flattened array.
 * @example
 *
 * _.flatten([1, [2, 3, [4]]]);
 * // => [1, 2, 3, [4]]
 *
 * // using `isDeep`
 * _.flatten([1, [2, 3, [4]]], true);
 * // => [1, 2, 3, 4]
 */
function flatten(array, isDeep, guard) {
  var length = array ? array.length : 0;
  if (guard && isIterateeCall(array, isDeep, guard)) {
    isDeep = false;
  }
  return length ? baseFlatten(array, isDeep) : [];
}

module.exports = flatten;

},{"../internal/baseFlatten":239,"../internal/isIterateeCall":298}],194:[function(require,module,exports){
/**
 * Gets the last element of `array`.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to query.
 * @returns {*} Returns the last element of `array`.
 * @example
 *
 * _.last([1, 2, 3]);
 * // => 3
 */
function last(array) {
  var length = array ? array.length : 0;
  return length ? array[length - 1] : undefined;
}

module.exports = last;

},{}],195:[function(require,module,exports){
var baseFlatten = require('../internal/baseFlatten'),
    baseUniq = require('../internal/baseUniq'),
    restParam = require('../function/restParam');

/**
 * Creates an array of unique values, in order, from all of the provided arrays
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {...Array} [arrays] The arrays to inspect.
 * @returns {Array} Returns the new array of combined values.
 * @example
 *
 * _.union([1, 2], [4, 2], [2, 1]);
 * // => [1, 2, 4]
 */
var union = restParam(function(arrays) {
  return baseUniq(baseFlatten(arrays, false, true));
});

module.exports = union;

},{"../function/restParam":214,"../internal/baseFlatten":239,"../internal/baseUniq":262}],196:[function(require,module,exports){
var baseCallback = require('../internal/baseCallback'),
    baseUniq = require('../internal/baseUniq'),
    isIterateeCall = require('../internal/isIterateeCall'),
    sortedUniq = require('../internal/sortedUniq');

/**
 * Creates a duplicate-free version of an array, using
 * [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons, in which only the first occurence of each element
 * is kept. Providing `true` for `isSorted` performs a faster search algorithm
 * for sorted arrays. If an iteratee function is provided it's invoked for
 * each element in the array to generate the criterion by which uniqueness
 * is computed. The `iteratee` is bound to `thisArg` and invoked with three
 * arguments: (value, index, array).
 *
 * If a property name is provided for `iteratee` the created `_.property`
 * style callback returns the property value of the given element.
 *
 * If a value is also provided for `thisArg` the created `_.matchesProperty`
 * style callback returns `true` for elements that have a matching property
 * value, else `false`.
 *
 * If an object is provided for `iteratee` the created `_.matches` style
 * callback returns `true` for elements that have the properties of the given
 * object, else `false`.
 *
 * @static
 * @memberOf _
 * @alias unique
 * @category Array
 * @param {Array} array The array to inspect.
 * @param {boolean} [isSorted] Specify the array is sorted.
 * @param {Function|Object|string} [iteratee] The function invoked per iteration.
 * @param {*} [thisArg] The `this` binding of `iteratee`.
 * @returns {Array} Returns the new duplicate-value-free array.
 * @example
 *
 * _.uniq([2, 1, 2]);
 * // => [2, 1]
 *
 * // using `isSorted`
 * _.uniq([1, 1, 2], true);
 * // => [1, 2]
 *
 * // using an iteratee function
 * _.uniq([1, 2.5, 1.5, 2], function(n) {
 *   return this.floor(n);
 * }, Math);
 * // => [1, 2.5]
 *
 * // using the `_.property` callback shorthand
 * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
 * // => [{ 'x': 1 }, { 'x': 2 }]
 */
function uniq(array, isSorted, iteratee, thisArg) {
  var length = array ? array.length : 0;
  if (!length) {
    return [];
  }
  if (isSorted != null && typeof isSorted != 'boolean') {
    thisArg = iteratee;
    iteratee = isIterateeCall(array, isSorted, thisArg) ? undefined : isSorted;
    isSorted = false;
  }
  iteratee = iteratee == null ? iteratee : baseCallback(iteratee, thisArg, 3);
  return (isSorted)
    ? sortedUniq(array, iteratee)
    : baseUniq(array, iteratee);
}

module.exports = uniq;

},{"../internal/baseCallback":228,"../internal/baseUniq":262,"../internal/isIterateeCall":298,"../internal/sortedUniq":313}],197:[function(require,module,exports){
module.exports = require('./uniq');

},{"./uniq":196}],198:[function(require,module,exports){
var baseDifference = require('../internal/baseDifference'),
    isArrayLike = require('../internal/isArrayLike'),
    restParam = require('../function/restParam');

/**
 * Creates an array excluding all provided values using
 * [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to filter.
 * @param {...*} [values] The values to exclude.
 * @returns {Array} Returns the new array of filtered values.
 * @example
 *
 * _.without([1, 2, 1, 3], 1, 2);
 * // => [3]
 */
var without = restParam(function(array, values) {
  return isArrayLike(array)
    ? baseDifference(array, values)
    : [];
});

module.exports = without;

},{"../function/restParam":214,"../internal/baseDifference":233,"../internal/isArrayLike":296}],199:[function(require,module,exports){
var LazyWrapper = require('../internal/LazyWrapper'),
    LodashWrapper = require('../internal/LodashWrapper'),
    baseLodash = require('../internal/baseLodash'),
    isArray = require('../lang/isArray'),
    isObjectLike = require('../internal/isObjectLike'),
    wrapperClone = require('../internal/wrapperClone');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates a `lodash` object which wraps `value` to enable implicit chaining.
 * Methods that operate on and return arrays, collections, and functions can
 * be chained together. Methods that retrieve a single value or may return a
 * primitive value will automatically end the chain returning the unwrapped
 * value. Explicit chaining may be enabled using `_.chain`. The execution of
 * chained methods is lazy, that is, execution is deferred until `_#value`
 * is implicitly or explicitly called.
 *
 * Lazy evaluation allows several methods to support shortcut fusion. Shortcut
 * fusion is an optimization strategy which merge iteratee calls; this can help
 * to avoid the creation of intermediate data structures and greatly reduce the
 * number of iteratee executions.
 *
 * Chaining is supported in custom builds as long as the `_#value` method is
 * directly or indirectly included in the build.
 *
 * In addition to lodash methods, wrappers have `Array` and `String` methods.
 *
 * The wrapper `Array` methods are:
 * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`,
 * `splice`, and `unshift`
 *
 * The wrapper `String` methods are:
 * `replace` and `split`
 *
 * The wrapper methods that support shortcut fusion are:
 * `compact`, `drop`, `dropRight`, `dropRightWhile`, `dropWhile`, `filter`,
 * `first`, `initial`, `last`, `map`, `pluck`, `reject`, `rest`, `reverse`,
 * `slice`, `take`, `takeRight`, `takeRightWhile`, `takeWhile`, `toArray`,
 * and `where`
 *
 * The chainable wrapper methods are:
 * `after`, `ary`, `assign`, `at`, `before`, `bind`, `bindAll`, `bindKey`,
 * `callback`, `chain`, `chunk`, `commit`, `compact`, `concat`, `constant`,
 * `countBy`, `create`, `curry`, `debounce`, `defaults`, `defaultsDeep`,
 * `defer`, `delay`, `difference`, `drop`, `dropRight`, `dropRightWhile`,
 * `dropWhile`, `fill`, `filter`, `flatten`, `flattenDeep`, `flow`, `flowRight`,
 * `forEach`, `forEachRight`, `forIn`, `forInRight`, `forOwn`, `forOwnRight`,
 * `functions`, `groupBy`, `indexBy`, `initial`, `intersection`, `invert`,
 * `invoke`, `keys`, `keysIn`, `map`, `mapKeys`, `mapValues`, `matches`,
 * `matchesProperty`, `memoize`, `merge`, `method`, `methodOf`, `mixin`,
 * `modArgs`, `negate`, `omit`, `once`, `pairs`, `partial`, `partialRight`,
 * `partition`, `pick`, `plant`, `pluck`, `property`, `propertyOf`, `pull`,
 * `pullAt`, `push`, `range`, `rearg`, `reject`, `remove`, `rest`, `restParam`,
 * `reverse`, `set`, `shuffle`, `slice`, `sort`, `sortBy`, `sortByAll`,
 * `sortByOrder`, `splice`, `spread`, `take`, `takeRight`, `takeRightWhile`,
 * `takeWhile`, `tap`, `throttle`, `thru`, `times`, `toArray`, `toPlainObject`,
 * `transform`, `union`, `uniq`, `unshift`, `unzip`, `unzipWith`, `values`,
 * `valuesIn`, `where`, `without`, `wrap`, `xor`, `zip`, `zipObject`, `zipWith`
 *
 * The wrapper methods that are **not** chainable by default are:
 * `add`, `attempt`, `camelCase`, `capitalize`, `ceil`, `clone`, `cloneDeep`,
 * `deburr`, `endsWith`, `escape`, `escapeRegExp`, `every`, `find`, `findIndex`,
 * `findKey`, `findLast`, `findLastIndex`, `findLastKey`, `findWhere`, `first`,
 * `floor`, `get`, `gt`, `gte`, `has`, `identity`, `includes`, `indexOf`,
 * `inRange`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`,
 * `isEmpty`, `isEqual`, `isError`, `isFinite` `isFunction`, `isMatch`,
 * `isNative`, `isNaN`, `isNull`, `isNumber`, `isObject`, `isPlainObject`,
 * `isRegExp`, `isString`, `isUndefined`, `isTypedArray`, `join`, `kebabCase`,
 * `last`, `lastIndexOf`, `lt`, `lte`, `max`, `min`, `noConflict`, `noop`,
 * `now`, `pad`, `padLeft`, `padRight`, `parseInt`, `pop`, `random`, `reduce`,
 * `reduceRight`, `repeat`, `result`, `round`, `runInContext`, `shift`, `size`,
 * `snakeCase`, `some`, `sortedIndex`, `sortedLastIndex`, `startCase`,
 * `startsWith`, `sum`, `template`, `trim`, `trimLeft`, `trimRight`, `trunc`,
 * `unescape`, `uniqueId`, `value`, and `words`
 *
 * The wrapper method `sample` will return a wrapped value when `n` is provided,
 * otherwise an unwrapped value is returned.
 *
 * @name _
 * @constructor
 * @category Chain
 * @param {*} value The value to wrap in a `lodash` instance.
 * @returns {Object} Returns the new `lodash` wrapper instance.
 * @example
 *
 * var wrapped = _([1, 2, 3]);
 *
 * // returns an unwrapped value
 * wrapped.reduce(function(total, n) {
 *   return total + n;
 * });
 * // => 6
 *
 * // returns a wrapped value
 * var squares = wrapped.map(function(n) {
 *   return n * n;
 * });
 *
 * _.isArray(squares);
 * // => false
 *
 * _.isArray(squares.value());
 * // => true
 */
function lodash(value) {
  if (isObjectLike(value) && !isArray(value) && !(value instanceof LazyWrapper)) {
    if (value instanceof LodashWrapper) {
      return value;
    }
    if (hasOwnProperty.call(value, '__chain__') && hasOwnProperty.call(value, '__wrapped__')) {
      return wrapperClone(value);
    }
  }
  return new LodashWrapper(value);
}

// Ensure wrappers are instances of `baseLodash`.
lodash.prototype = baseLodash.prototype;

module.exports = lodash;

},{"../internal/LazyWrapper":215,"../internal/LodashWrapper":216,"../internal/baseLodash":248,"../internal/isObjectLike":302,"../internal/wrapperClone":316,"../lang/isArray":319}],200:[function(require,module,exports){
module.exports = require('./some');

},{"./some":209}],201:[function(require,module,exports){
var arrayEvery = require('../internal/arrayEvery'),
    baseCallback = require('../internal/baseCallback'),
    baseEvery = require('../internal/baseEvery'),
    isArray = require('../lang/isArray'),
    isIterateeCall = require('../internal/isIterateeCall');

/**
 * Checks if `predicate` returns truthy for **all** elements of `collection`.
 * The predicate is bound to `thisArg` and invoked with three arguments:
 * (value, index|key, collection).
 *
 * If a property name is provided for `predicate` the created `_.property`
 * style callback returns the property value of the given element.
 *
 * If a value is also provided for `thisArg` the created `_.matchesProperty`
 * style callback returns `true` for elements that have a matching property
 * value, else `false`.
 *
 * If an object is provided for `predicate` the created `_.matches` style
 * callback returns `true` for elements that have the properties of the given
 * object, else `false`.
 *
 * @static
 * @memberOf _
 * @alias all
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function|Object|string} [predicate=_.identity] The function invoked
 *  per iteration.
 * @param {*} [thisArg] The `this` binding of `predicate`.
 * @returns {boolean} Returns `true` if all elements pass the predicate check,
 *  else `false`.
 * @example
 *
 * _.every([true, 1, null, 'yes'], Boolean);
 * // => false
 *
 * var users = [
 *   { 'user': 'barney', 'active': false },
 *   { 'user': 'fred',   'active': false }
 * ];
 *
 * // using the `_.matches` callback shorthand
 * _.every(users, { 'user': 'barney', 'active': false });
 * // => false
 *
 * // using the `_.matchesProperty` callback shorthand
 * _.every(users, 'active', false);
 * // => true
 *
 * // using the `_.property` callback shorthand
 * _.every(users, 'active');
 * // => false
 */
function every(collection, predicate, thisArg) {
  var func = isArray(collection) ? arrayEvery : baseEvery;
  if (thisArg && isIterateeCall(collection, predicate, thisArg)) {
    predicate = undefined;
  }
  if (typeof predicate != 'function' || thisArg !== undefined) {
    predicate = baseCallback(predicate, thisArg, 3);
  }
  return func(collection, predicate);
}

module.exports = every;

},{"../internal/arrayEvery":220,"../internal/baseCallback":228,"../internal/baseEvery":235,"../internal/isIterateeCall":298,"../lang/isArray":319}],202:[function(require,module,exports){
var arrayFilter = require('../internal/arrayFilter'),
    baseCallback = require('../internal/baseCallback'),
    baseFilter = require('../internal/baseFilter'),
    isArray = require('../lang/isArray');

/**
 * Iterates over elements of `collection`, returning an array of all elements
 * `predicate` returns truthy for. The predicate is bound to `thisArg` and
 * invoked with three arguments: (value, index|key, collection).
 *
 * If a property name is provided for `predicate` the created `_.property`
 * style callback returns the property value of the given element.
 *
 * If a value is also provided for `thisArg` the created `_.matchesProperty`
 * style callback returns `true` for elements that have a matching property
 * value, else `false`.
 *
 * If an object is provided for `predicate` the created `_.matches` style
 * callback returns `true` for elements that have the properties of the given
 * object, else `false`.
 *
 * @static
 * @memberOf _
 * @alias select
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function|Object|string} [predicate=_.identity] The function invoked
 *  per iteration.
 * @param {*} [thisArg] The `this` binding of `predicate`.
 * @returns {Array} Returns the new filtered array.
 * @example
 *
 * _.filter([4, 5, 6], function(n) {
 *   return n % 2 == 0;
 * });
 * // => [4, 6]
 *
 * var users = [
 *   { 'user': 'barney', 'age': 36, 'active': true },
 *   { 'user': 'fred',   'age': 40, 'active': false }
 * ];
 *
 * // using the `_.matches` callback shorthand
 * _.pluck(_.filter(users, { 'age': 36, 'active': true }), 'user');
 * // => ['barney']
 *
 * // using the `_.matchesProperty` callback shorthand
 * _.pluck(_.filter(users, 'active', false), 'user');
 * // => ['fred']
 *
 * // using the `_.property` callback shorthand
 * _.pluck(_.filter(users, 'active'), 'user');
 * // => ['barney']
 */
function filter(collection, predicate, thisArg) {
  var func = isArray(collection) ? arrayFilter : baseFilter;
  predicate = baseCallback(predicate, thisArg, 3);
  return func(collection, predicate);
}

module.exports = filter;

},{"../internal/arrayFilter":221,"../internal/baseCallback":228,"../internal/baseFilter":236,"../lang/isArray":319}],203:[function(require,module,exports){
var baseEach = require('../internal/baseEach'),
    createFind = require('../internal/createFind');

/**
 * Iterates over elements of `collection`, returning the first element
 * `predicate` returns truthy for. The predicate is bound to `thisArg` and
 * invoked with three arguments: (value, index|key, collection).
 *
 * If a property name is provided for `predicate` the created `_.property`
 * style callback returns the property value of the given element.
 *
 * If a value is also provided for `thisArg` the created `_.matchesProperty`
 * style callback returns `true` for elements that have a matching property
 * value, else `false`.
 *
 * If an object is provided for `predicate` the created `_.matches` style
 * callback returns `true` for elements that have the properties of the given
 * object, else `false`.
 *
 * @static
 * @memberOf _
 * @alias detect
 * @category Collection
 * @param {Array|Object|string} collection The collection to search.
 * @param {Function|Object|string} [predicate=_.identity] The function invoked
 *  per iteration.
 * @param {*} [thisArg] The `this` binding of `predicate`.
 * @returns {*} Returns the matched element, else `undefined`.
 * @example
 *
 * var users = [
 *   { 'user': 'barney',  'age': 36, 'active': true },
 *   { 'user': 'fred',    'age': 40, 'active': false },
 *   { 'user': 'pebbles', 'age': 1,  'active': true }
 * ];
 *
 * _.result(_.find(users, function(chr) {
 *   return chr.age < 40;
 * }), 'user');
 * // => 'barney'
 *
 * // using the `_.matches` callback shorthand
 * _.result(_.find(users, { 'age': 1, 'active': true }), 'user');
 * // => 'pebbles'
 *
 * // using the `_.matchesProperty` callback shorthand
 * _.result(_.find(users, 'active', false), 'user');
 * // => 'fred'
 *
 * // using the `_.property` callback shorthand
 * _.result(_.find(users, 'active'), 'user');
 * // => 'barney'
 */
var find = createFind(baseEach);

module.exports = find;

},{"../internal/baseEach":234,"../internal/createFind":277}],204:[function(require,module,exports){
var arrayEach = require('../internal/arrayEach'),
    baseEach = require('../internal/baseEach'),
    createForEach = require('../internal/createForEach');

/**
 * Iterates over elements of `collection` invoking `iteratee` for each element.
 * The `iteratee` is bound to `thisArg` and invoked with three arguments:
 * (value, index|key, collection). Iteratee functions may exit iteration early
 * by explicitly returning `false`.
 *
 * **Note:** As with other "Collections" methods, objects with a "length" property
 * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
 * may be used for object iteration.
 *
 * @static
 * @memberOf _
 * @alias each
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @param {*} [thisArg] The `this` binding of `iteratee`.
 * @returns {Array|Object|string} Returns `collection`.
 * @example
 *
 * _([1, 2]).forEach(function(n) {
 *   console.log(n);
 * }).value();
 * // => logs each value from left to right and returns the array
 *
 * _.forEach({ 'a': 1, 'b': 2 }, function(n, key) {
 *   console.log(n, key);
 * });
 * // => logs each value-key pair and returns the object (iteration order is not guaranteed)
 */
var forEach = createForEach(arrayEach, baseEach);

module.exports = forEach;

},{"../internal/arrayEach":219,"../internal/baseEach":234,"../internal/createForEach":279}],205:[function(require,module,exports){
var createAggregator = require('../internal/createAggregator');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an object composed of keys generated from the results of running
 * each element of `collection` through `iteratee`. The corresponding value
 * of each key is an array of the elements responsible for generating the key.
 * The `iteratee` is bound to `thisArg` and invoked with three arguments:
 * (value, index|key, collection).
 *
 * If a property name is provided for `iteratee` the created `_.property`
 * style callback returns the property value of the given element.
 *
 * If a value is also provided for `thisArg` the created `_.matchesProperty`
 * style callback returns `true` for elements that have a matching property
 * value, else `false`.
 *
 * If an object is provided for `iteratee` the created `_.matches` style
 * callback returns `true` for elements that have the properties of the given
 * object, else `false`.
 *
 * @static
 * @memberOf _
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function|Object|string} [iteratee=_.identity] The function invoked
 *  per iteration.
 * @param {*} [thisArg] The `this` binding of `iteratee`.
 * @returns {Object} Returns the composed aggregate object.
 * @example
 *
 * _.groupBy([4.2, 6.1, 6.4], function(n) {
 *   return Math.floor(n);
 * });
 * // => { '4': [4.2], '6': [6.1, 6.4] }
 *
 * _.groupBy([4.2, 6.1, 6.4], function(n) {
 *   return this.floor(n);
 * }, Math);
 * // => { '4': [4.2], '6': [6.1, 6.4] }
 *
 * // using the `_.property` callback shorthand
 * _.groupBy(['one', 'two', 'three'], 'length');
 * // => { '3': ['one', 'two'], '5': ['three'] }
 */
var groupBy = createAggregator(function(result, value, key) {
  if (hasOwnProperty.call(result, key)) {
    result[key].push(value);
  } else {
    result[key] = [value];
  }
});

module.exports = groupBy;

},{"../internal/createAggregator":270}],206:[function(require,module,exports){
var arrayMap = require('../internal/arrayMap'),
    baseCallback = require('../internal/baseCallback'),
    baseMap = require('../internal/baseMap'),
    isArray = require('../lang/isArray');

/**
 * Creates an array of values by running each element in `collection` through
 * `iteratee`. The `iteratee` is bound to `thisArg` and invoked with three
 * arguments: (value, index|key, collection).
 *
 * If a property name is provided for `iteratee` the created `_.property`
 * style callback returns the property value of the given element.
 *
 * If a value is also provided for `thisArg` the created `_.matchesProperty`
 * style callback returns `true` for elements that have a matching property
 * value, else `false`.
 *
 * If an object is provided for `iteratee` the created `_.matches` style
 * callback returns `true` for elements that have the properties of the given
 * object, else `false`.
 *
 * Many lodash methods are guarded to work as iteratees for methods like
 * `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
 *
 * The guarded methods are:
 * `ary`, `callback`, `chunk`, `clone`, `create`, `curry`, `curryRight`,
 * `drop`, `dropRight`, `every`, `fill`, `flatten`, `invert`, `max`, `min`,
 * `parseInt`, `slice`, `sortBy`, `take`, `takeRight`, `template`, `trim`,
 * `trimLeft`, `trimRight`, `trunc`, `random`, `range`, `sample`, `some`,
 * `sum`, `uniq`, and `words`
 *
 * @static
 * @memberOf _
 * @alias collect
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function|Object|string} [iteratee=_.identity] The function invoked
 *  per iteration.
 * @param {*} [thisArg] The `this` binding of `iteratee`.
 * @returns {Array} Returns the new mapped array.
 * @example
 *
 * function timesThree(n) {
 *   return n * 3;
 * }
 *
 * _.map([1, 2], timesThree);
 * // => [3, 6]
 *
 * _.map({ 'a': 1, 'b': 2 }, timesThree);
 * // => [3, 6] (iteration order is not guaranteed)
 *
 * var users = [
 *   { 'user': 'barney' },
 *   { 'user': 'fred' }
 * ];
 *
 * // using the `_.property` callback shorthand
 * _.map(users, 'user');
 * // => ['barney', 'fred']
 */
function map(collection, iteratee, thisArg) {
  var func = isArray(collection) ? arrayMap : baseMap;
  iteratee = baseCallback(iteratee, thisArg, 3);
  return func(collection, iteratee);
}

module.exports = map;

},{"../internal/arrayMap":222,"../internal/baseCallback":228,"../internal/baseMap":249,"../lang/isArray":319}],207:[function(require,module,exports){
var arrayReduce = require('../internal/arrayReduce'),
    baseEach = require('../internal/baseEach'),
    createReduce = require('../internal/createReduce');

/**
 * Reduces `collection` to a value which is the accumulated result of running
 * each element in `collection` through `iteratee`, where each successive
 * invocation is supplied the return value of the previous. If `accumulator`
 * is not provided the first element of `collection` is used as the initial
 * value. The `iteratee` is bound to `thisArg` and invoked with four arguments:
 * (accumulator, value, index|key, collection).
 *
 * Many lodash methods are guarded to work as iteratees for methods like
 * `_.reduce`, `_.reduceRight`, and `_.transform`.
 *
 * The guarded methods are:
 * `assign`, `defaults`, `defaultsDeep`, `includes`, `merge`, `sortByAll`,
 * and `sortByOrder`
 *
 * @static
 * @memberOf _
 * @alias foldl, inject
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @param {*} [accumulator] The initial value.
 * @param {*} [thisArg] The `this` binding of `iteratee`.
 * @returns {*} Returns the accumulated value.
 * @example
 *
 * _.reduce([1, 2], function(total, n) {
 *   return total + n;
 * });
 * // => 3
 *
 * _.reduce({ 'a': 1, 'b': 2 }, function(result, n, key) {
 *   result[key] = n * 3;
 *   return result;
 * }, {});
 * // => { 'a': 3, 'b': 6 } (iteration order is not guaranteed)
 */
var reduce = createReduce(arrayReduce, baseEach);

module.exports = reduce;

},{"../internal/arrayReduce":224,"../internal/baseEach":234,"../internal/createReduce":282}],208:[function(require,module,exports){
var getLength = require('../internal/getLength'),
    isLength = require('../internal/isLength'),
    keys = require('../object/keys');

/**
 * Gets the size of `collection` by returning its length for array-like
 * values or the number of own enumerable properties for objects.
 *
 * @static
 * @memberOf _
 * @category Collection
 * @param {Array|Object|string} collection The collection to inspect.
 * @returns {number} Returns the size of `collection`.
 * @example
 *
 * _.size([1, 2, 3]);
 * // => 3
 *
 * _.size({ 'a': 1, 'b': 2 });
 * // => 2
 *
 * _.size('pebbles');
 * // => 7
 */
function size(collection) {
  var length = collection ? getLength(collection) : 0;
  return isLength(length) ? length : keys(collection).length;
}

module.exports = size;

},{"../internal/getLength":289,"../internal/isLength":301,"../object/keys":329}],209:[function(require,module,exports){
var arraySome = require('../internal/arraySome'),
    baseCallback = require('../internal/baseCallback'),
    baseSome = require('../internal/baseSome'),
    isArray = require('../lang/isArray'),
    isIterateeCall = require('../internal/isIterateeCall');

/**
 * Checks if `predicate` returns truthy for **any** element of `collection`.
 * The function returns as soon as it finds a passing value and does not iterate
 * over the entire collection. The predicate is bound to `thisArg` and invoked
 * with three arguments: (value, index|key, collection).
 *
 * If a property name is provided for `predicate` the created `_.property`
 * style callback returns the property value of the given element.
 *
 * If a value is also provided for `thisArg` the created `_.matchesProperty`
 * style callback returns `true` for elements that have a matching property
 * value, else `false`.
 *
 * If an object is provided for `predicate` the created `_.matches` style
 * callback returns `true` for elements that have the properties of the given
 * object, else `false`.
 *
 * @static
 * @memberOf _
 * @alias any
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function|Object|string} [predicate=_.identity] The function invoked
 *  per iteration.
 * @param {*} [thisArg] The `this` binding of `predicate`.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 * @example
 *
 * _.some([null, 0, 'yes', false], Boolean);
 * // => true
 *
 * var users = [
 *   { 'user': 'barney', 'active': true },
 *   { 'user': 'fred',   'active': false }
 * ];
 *
 * // using the `_.matches` callback shorthand
 * _.some(users, { 'user': 'barney', 'active': false });
 * // => false
 *
 * // using the `_.matchesProperty` callback shorthand
 * _.some(users, 'active', false);
 * // => true
 *
 * // using the `_.property` callback shorthand
 * _.some(users, 'active');
 * // => true
 */
function some(collection, predicate, thisArg) {
  var func = isArray(collection) ? arraySome : baseSome;
  if (thisArg && isIterateeCall(collection, predicate, thisArg)) {
    predicate = undefined;
  }
  if (typeof predicate != 'function' || thisArg !== undefined) {
    predicate = baseCallback(predicate, thisArg, 3);
  }
  return func(collection, predicate);
}

module.exports = some;

},{"../internal/arraySome":225,"../internal/baseCallback":228,"../internal/baseSome":259,"../internal/isIterateeCall":298,"../lang/isArray":319}],210:[function(require,module,exports){
var baseCallback = require('../internal/baseCallback'),
    baseMap = require('../internal/baseMap'),
    baseSortBy = require('../internal/baseSortBy'),
    compareAscending = require('../internal/compareAscending'),
    isIterateeCall = require('../internal/isIterateeCall');

/**
 * Creates an array of elements, sorted in ascending order by the results of
 * running each element in a collection through `iteratee`. This method performs
 * a stable sort, that is, it preserves the original sort order of equal elements.
 * The `iteratee` is bound to `thisArg` and invoked with three arguments:
 * (value, index|key, collection).
 *
 * If a property name is provided for `iteratee` the created `_.property`
 * style callback returns the property value of the given element.
 *
 * If a value is also provided for `thisArg` the created `_.matchesProperty`
 * style callback returns `true` for elements that have a matching property
 * value, else `false`.
 *
 * If an object is provided for `iteratee` the created `_.matches` style
 * callback returns `true` for elements that have the properties of the given
 * object, else `false`.
 *
 * @static
 * @memberOf _
 * @category Collection
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function|Object|string} [iteratee=_.identity] The function invoked
 *  per iteration.
 * @param {*} [thisArg] The `this` binding of `iteratee`.
 * @returns {Array} Returns the new sorted array.
 * @example
 *
 * _.sortBy([1, 2, 3], function(n) {
 *   return Math.sin(n);
 * });
 * // => [3, 1, 2]
 *
 * _.sortBy([1, 2, 3], function(n) {
 *   return this.sin(n);
 * }, Math);
 * // => [3, 1, 2]
 *
 * var users = [
 *   { 'user': 'fred' },
 *   { 'user': 'pebbles' },
 *   { 'user': 'barney' }
 * ];
 *
 * // using the `_.property` callback shorthand
 * _.pluck(_.sortBy(users, 'user'), 'user');
 * // => ['barney', 'fred', 'pebbles']
 */
function sortBy(collection, iteratee, thisArg) {
  if (collection == null) {
    return [];
  }
  if (thisArg && isIterateeCall(collection, iteratee, thisArg)) {
    iteratee = undefined;
  }
  var index = -1;
  iteratee = baseCallback(iteratee, thisArg, 3);

  var result = baseMap(collection, function(value, key, collection) {
    return { 'criteria': iteratee(value, key, collection), 'index': ++index, 'value': value };
  });
  return baseSortBy(result, compareAscending);
}

module.exports = sortBy;

},{"../internal/baseCallback":228,"../internal/baseMap":249,"../internal/baseSortBy":260,"../internal/compareAscending":267,"../internal/isIterateeCall":298}],211:[function(require,module,exports){
var getNative = require('../internal/getNative');

/* Native method references for those with the same name as other `lodash` methods. */
var nativeNow = getNative(Date, 'now');

/**
 * Gets the number of milliseconds that have elapsed since the Unix epoch
 * (1 January 1970 00:00:00 UTC).
 *
 * @static
 * @memberOf _
 * @category Date
 * @example
 *
 * _.defer(function(stamp) {
 *   console.log(_.now() - stamp);
 * }, _.now());
 * // => logs the number of milliseconds it took for the deferred function to be invoked
 */
var now = nativeNow || function() {
  return new Date().getTime();
};

module.exports = now;

},{"../internal/getNative":291}],212:[function(require,module,exports){
var createWrapper = require('../internal/createWrapper'),
    replaceHolders = require('../internal/replaceHolders'),
    restParam = require('./restParam');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1,
    PARTIAL_FLAG = 32;

/**
 * Creates a function that invokes `func` with the `this` binding of `thisArg`
 * and prepends any additional `_.bind` arguments to those provided to the
 * bound function.
 *
 * The `_.bind.placeholder` value, which defaults to `_` in monolithic builds,
 * may be used as a placeholder for partially applied arguments.
 *
 * **Note:** Unlike native `Function#bind` this method does not set the "length"
 * property of bound functions.
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to bind.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {...*} [partials] The arguments to be partially applied.
 * @returns {Function} Returns the new bound function.
 * @example
 *
 * var greet = function(greeting, punctuation) {
 *   return greeting + ' ' + this.user + punctuation;
 * };
 *
 * var object = { 'user': 'fred' };
 *
 * var bound = _.bind(greet, object, 'hi');
 * bound('!');
 * // => 'hi fred!'
 *
 * // using placeholders
 * var bound = _.bind(greet, object, _, '!');
 * bound('hi');
 * // => 'hi fred!'
 */
var bind = restParam(function(func, thisArg, partials) {
  var bitmask = BIND_FLAG;
  if (partials.length) {
    var holders = replaceHolders(partials, bind.placeholder);
    bitmask |= PARTIAL_FLAG;
  }
  return createWrapper(func, bitmask, thisArg, partials, holders);
});

// Assign default placeholders.
bind.placeholder = {};

module.exports = bind;

},{"../internal/createWrapper":283,"../internal/replaceHolders":310,"./restParam":214}],213:[function(require,module,exports){
var isObject = require('../lang/isObject'),
    now = require('../date/now');

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked. The debounced function comes with a `cancel` method to cancel
 * delayed invocations. Provide an options object to indicate that `func`
 * should be invoked on the leading and/or trailing edge of the `wait` timeout.
 * Subsequent calls to the debounced function return the result of the last
 * `func` invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is invoked
 * on the trailing edge of the timeout only if the the debounced function is
 * invoked more than once during the `wait` timeout.
 *
 * See [David Corbacho's article](http://drupalmotion.com/article/debounce-and-throttle-visual-explanation)
 * for details over the differences between `_.debounce` and `_.throttle`.
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to debounce.
 * @param {number} [wait=0] The number of milliseconds to delay.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.leading=false] Specify invoking on the leading
 *  edge of the timeout.
 * @param {number} [options.maxWait] The maximum time `func` is allowed to be
 *  delayed before it's invoked.
 * @param {boolean} [options.trailing=true] Specify invoking on the trailing
 *  edge of the timeout.
 * @returns {Function} Returns the new debounced function.
 * @example
 *
 * // avoid costly calculations while the window size is in flux
 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
 *
 * // invoke `sendMail` when the click event is fired, debouncing subsequent calls
 * jQuery('#postbox').on('click', _.debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * }));
 *
 * // ensure `batchLog` is invoked once after 1 second of debounced calls
 * var source = new EventSource('/stream');
 * jQuery(source).on('message', _.debounce(batchLog, 250, {
 *   'maxWait': 1000
 * }));
 *
 * // cancel a debounced call
 * var todoChanges = _.debounce(batchLog, 1000);
 * Object.observe(models.todo, todoChanges);
 *
 * Object.observe(models, function(changes) {
 *   if (_.find(changes, { 'user': 'todo', 'type': 'delete'})) {
 *     todoChanges.cancel();
 *   }
 * }, ['delete']);
 *
 * // ...at some point `models.todo` is changed
 * models.todo.completed = true;
 *
 * // ...before 1 second has passed `models.todo` is deleted
 * // which cancels the debounced `todoChanges` call
 * delete models.todo;
 */
function debounce(func, wait, options) {
  var args,
      maxTimeoutId,
      result,
      stamp,
      thisArg,
      timeoutId,
      trailingCall,
      lastCalled = 0,
      maxWait = false,
      trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  wait = wait < 0 ? 0 : (+wait || 0);
  if (options === true) {
    var leading = true;
    trailing = false;
  } else if (isObject(options)) {
    leading = !!options.leading;
    maxWait = 'maxWait' in options && nativeMax(+options.maxWait || 0, wait);
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  function cancel() {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId);
    }
    lastCalled = 0;
    maxTimeoutId = timeoutId = trailingCall = undefined;
  }

  function complete(isCalled, id) {
    if (id) {
      clearTimeout(id);
    }
    maxTimeoutId = timeoutId = trailingCall = undefined;
    if (isCalled) {
      lastCalled = now();
      result = func.apply(thisArg, args);
      if (!timeoutId && !maxTimeoutId) {
        args = thisArg = undefined;
      }
    }
  }

  function delayed() {
    var remaining = wait - (now() - stamp);
    if (remaining <= 0 || remaining > wait) {
      complete(trailingCall, maxTimeoutId);
    } else {
      timeoutId = setTimeout(delayed, remaining);
    }
  }

  function maxDelayed() {
    complete(trailing, timeoutId);
  }

  function debounced() {
    args = arguments;
    stamp = now();
    thisArg = this;
    trailingCall = trailing && (timeoutId || !leading);

    if (maxWait === false) {
      var leadingCall = leading && !timeoutId;
    } else {
      if (!maxTimeoutId && !leading) {
        lastCalled = stamp;
      }
      var remaining = maxWait - (stamp - lastCalled),
          isCalled = remaining <= 0 || remaining > maxWait;

      if (isCalled) {
        if (maxTimeoutId) {
          maxTimeoutId = clearTimeout(maxTimeoutId);
        }
        lastCalled = stamp;
        result = func.apply(thisArg, args);
      }
      else if (!maxTimeoutId) {
        maxTimeoutId = setTimeout(maxDelayed, remaining);
      }
    }
    if (isCalled && timeoutId) {
      timeoutId = clearTimeout(timeoutId);
    }
    else if (!timeoutId && wait !== maxWait) {
      timeoutId = setTimeout(delayed, wait);
    }
    if (leadingCall) {
      isCalled = true;
      result = func.apply(thisArg, args);
    }
    if (isCalled && !timeoutId && !maxTimeoutId) {
      args = thisArg = undefined;
    }
    return result;
  }
  debounced.cancel = cancel;
  return debounced;
}

module.exports = debounce;

},{"../date/now":211,"../lang/isObject":323}],214:[function(require,module,exports){
/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://developer.mozilla.org/Web/JavaScript/Reference/Functions/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.restParam(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function restParam(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        rest = Array(length);

    while (++index < length) {
      rest[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, rest);
      case 1: return func.call(this, args[0], rest);
      case 2: return func.call(this, args[0], args[1], rest);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = rest;
    return func.apply(this, otherArgs);
  };
}

module.exports = restParam;

},{}],215:[function(require,module,exports){
var baseCreate = require('./baseCreate'),
    baseLodash = require('./baseLodash');

/** Used as references for `-Infinity` and `Infinity`. */
var POSITIVE_INFINITY = Number.POSITIVE_INFINITY;

/**
 * Creates a lazy wrapper object which wraps `value` to enable lazy evaluation.
 *
 * @private
 * @param {*} value The value to wrap.
 */
function LazyWrapper(value) {
  this.__wrapped__ = value;
  this.__actions__ = [];
  this.__dir__ = 1;
  this.__filtered__ = false;
  this.__iteratees__ = [];
  this.__takeCount__ = POSITIVE_INFINITY;
  this.__views__ = [];
}

LazyWrapper.prototype = baseCreate(baseLodash.prototype);
LazyWrapper.prototype.constructor = LazyWrapper;

module.exports = LazyWrapper;

},{"./baseCreate":232,"./baseLodash":248}],216:[function(require,module,exports){
var baseCreate = require('./baseCreate'),
    baseLodash = require('./baseLodash');

/**
 * The base constructor for creating `lodash` wrapper objects.
 *
 * @private
 * @param {*} value The value to wrap.
 * @param {boolean} [chainAll] Enable chaining for all wrapper methods.
 * @param {Array} [actions=[]] Actions to peform to resolve the unwrapped value.
 */
function LodashWrapper(value, chainAll, actions) {
  this.__wrapped__ = value;
  this.__actions__ = actions || [];
  this.__chain__ = !!chainAll;
}

LodashWrapper.prototype = baseCreate(baseLodash.prototype);
LodashWrapper.prototype.constructor = LodashWrapper;

module.exports = LodashWrapper;

},{"./baseCreate":232,"./baseLodash":248}],217:[function(require,module,exports){
(function (global){
var cachePush = require('./cachePush'),
    getNative = require('./getNative');

/** Native method references. */
var Set = getNative(global, 'Set');

/* Native method references for those with the same name as other `lodash` methods. */
var nativeCreate = getNative(Object, 'create');

/**
 *
 * Creates a cache object to store unique values.
 *
 * @private
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var length = values ? values.length : 0;

  this.data = { 'hash': nativeCreate(null), 'set': new Set };
  while (length--) {
    this.push(values[length]);
  }
}

// Add functions to the `Set` cache.
SetCache.prototype.push = cachePush;

module.exports = SetCache;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./cachePush":266,"./getNative":291}],218:[function(require,module,exports){
/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function arrayCopy(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

module.exports = arrayCopy;

},{}],219:[function(require,module,exports){
/**
 * A specialized version of `_.forEach` for arrays without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

module.exports = arrayEach;

},{}],220:[function(require,module,exports){
/**
 * A specialized version of `_.every` for arrays without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if all elements pass the predicate check,
 *  else `false`.
 */
function arrayEvery(array, predicate) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (!predicate(array[index], index, array)) {
      return false;
    }
  }
  return true;
}

module.exports = arrayEvery;

},{}],221:[function(require,module,exports){
/**
 * A specialized version of `_.filter` for arrays without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function arrayFilter(array, predicate) {
  var index = -1,
      length = array.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[++resIndex] = value;
    }
  }
  return result;
}

module.exports = arrayFilter;

},{}],222:[function(require,module,exports){
/**
 * A specialized version of `_.map` for arrays without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

module.exports = arrayMap;

},{}],223:[function(require,module,exports){
/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

module.exports = arrayPush;

},{}],224:[function(require,module,exports){
/**
 * A specialized version of `_.reduce` for arrays without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {*} [accumulator] The initial value.
 * @param {boolean} [initFromArray] Specify using the first element of `array`
 *  as the initial value.
 * @returns {*} Returns the accumulated value.
 */
function arrayReduce(array, iteratee, accumulator, initFromArray) {
  var index = -1,
      length = array.length;

  if (initFromArray && length) {
    accumulator = array[++index];
  }
  while (++index < length) {
    accumulator = iteratee(accumulator, array[index], index, array);
  }
  return accumulator;
}

module.exports = arrayReduce;

},{}],225:[function(require,module,exports){
/**
 * A specialized version of `_.some` for arrays without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

module.exports = arraySome;

},{}],226:[function(require,module,exports){
var keys = require('../object/keys');

/**
 * A specialized version of `_.assign` for customizing assigned values without
 * support for argument juggling, multiple sources, and `this` binding `customizer`
 * functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {Function} customizer The function to customize assigned values.
 * @returns {Object} Returns `object`.
 */
function assignWith(object, source, customizer) {
  var index = -1,
      props = keys(source),
      length = props.length;

  while (++index < length) {
    var key = props[index],
        value = object[key],
        result = customizer(value, source[key], key, object, source);

    if ((result === result ? (result !== value) : (value === value)) ||
        (value === undefined && !(key in object))) {
      object[key] = result;
    }
  }
  return object;
}

module.exports = assignWith;

},{"../object/keys":329}],227:[function(require,module,exports){
var baseCopy = require('./baseCopy'),
    keys = require('../object/keys');

/**
 * The base implementation of `_.assign` without support for argument juggling,
 * multiple sources, and `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return source == null
    ? object
    : baseCopy(source, keys(source), object);
}

module.exports = baseAssign;

},{"../object/keys":329,"./baseCopy":231}],228:[function(require,module,exports){
var baseMatches = require('./baseMatches'),
    baseMatchesProperty = require('./baseMatchesProperty'),
    bindCallback = require('./bindCallback'),
    identity = require('../utility/identity'),
    property = require('../utility/property');

/**
 * The base implementation of `_.callback` which supports specifying the
 * number of arguments to provide to `func`.
 *
 * @private
 * @param {*} [func=_.identity] The value to convert to a callback.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {number} [argCount] The number of arguments to provide to `func`.
 * @returns {Function} Returns the callback.
 */
function baseCallback(func, thisArg, argCount) {
  var type = typeof func;
  if (type == 'function') {
    return thisArg === undefined
      ? func
      : bindCallback(func, thisArg, argCount);
  }
  if (func == null) {
    return identity;
  }
  if (type == 'object') {
    return baseMatches(func);
  }
  return thisArg === undefined
    ? property(func)
    : baseMatchesProperty(func, thisArg);
}

module.exports = baseCallback;

},{"../utility/identity":335,"../utility/property":337,"./baseMatches":250,"./baseMatchesProperty":251,"./bindCallback":263}],229:[function(require,module,exports){
var arrayCopy = require('./arrayCopy'),
    arrayEach = require('./arrayEach'),
    baseAssign = require('./baseAssign'),
    baseForOwn = require('./baseForOwn'),
    initCloneArray = require('./initCloneArray'),
    initCloneByTag = require('./initCloneByTag'),
    initCloneObject = require('./initCloneObject'),
    isArray = require('../lang/isArray'),
    isObject = require('../lang/isObject');

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values supported by `_.clone`. */
var cloneableTags = {};
cloneableTags[argsTag] = cloneableTags[arrayTag] =
cloneableTags[arrayBufferTag] = cloneableTags[boolTag] =
cloneableTags[dateTag] = cloneableTags[float32Tag] =
cloneableTags[float64Tag] = cloneableTags[int8Tag] =
cloneableTags[int16Tag] = cloneableTags[int32Tag] =
cloneableTags[numberTag] = cloneableTags[objectTag] =
cloneableTags[regexpTag] = cloneableTags[stringTag] =
cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] =
cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
cloneableTags[errorTag] = cloneableTags[funcTag] =
cloneableTags[mapTag] = cloneableTags[setTag] =
cloneableTags[weakMapTag] = false;

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * The base implementation of `_.clone` without support for argument juggling
 * and `this` binding `customizer` functions.
 *
 * @private
 * @param {*} value The value to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @param {Function} [customizer] The function to customize cloning values.
 * @param {string} [key] The key of `value`.
 * @param {Object} [object] The object `value` belongs to.
 * @param {Array} [stackA=[]] Tracks traversed source objects.
 * @param {Array} [stackB=[]] Associates clones with source counterparts.
 * @returns {*} Returns the cloned value.
 */
function baseClone(value, isDeep, customizer, key, object, stackA, stackB) {
  var result;
  if (customizer) {
    result = object ? customizer(value, key, object) : customizer(value);
  }
  if (result !== undefined) {
    return result;
  }
  if (!isObject(value)) {
    return value;
  }
  var isArr = isArray(value);
  if (isArr) {
    result = initCloneArray(value);
    if (!isDeep) {
      return arrayCopy(value, result);
    }
  } else {
    var tag = objToString.call(value),
        isFunc = tag == funcTag;

    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
      result = initCloneObject(isFunc ? {} : value);
      if (!isDeep) {
        return baseAssign(result, value);
      }
    } else {
      return cloneableTags[tag]
        ? initCloneByTag(value, tag, isDeep)
        : (object ? value : {});
    }
  }
  // Check for circular references and return its corresponding clone.
  stackA || (stackA = []);
  stackB || (stackB = []);

  var length = stackA.length;
  while (length--) {
    if (stackA[length] == value) {
      return stackB[length];
    }
  }
  // Add the source value to the stack of traversed objects and associate it with its clone.
  stackA.push(value);
  stackB.push(result);

  // Recursively populate clone (susceptible to call stack limits).
  (isArr ? arrayEach : baseForOwn)(value, function(subValue, key) {
    result[key] = baseClone(subValue, isDeep, customizer, key, value, stackA, stackB);
  });
  return result;
}

module.exports = baseClone;

},{"../lang/isArray":319,"../lang/isObject":323,"./arrayCopy":218,"./arrayEach":219,"./baseAssign":227,"./baseForOwn":242,"./initCloneArray":293,"./initCloneByTag":294,"./initCloneObject":295}],230:[function(require,module,exports){
/**
 * The base implementation of `compareAscending` which compares values and
 * sorts them in ascending order without guaranteeing a stable sort.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {number} Returns the sort order indicator for `value`.
 */
function baseCompareAscending(value, other) {
  if (value !== other) {
    var valIsNull = value === null,
        valIsUndef = value === undefined,
        valIsReflexive = value === value;

    var othIsNull = other === null,
        othIsUndef = other === undefined,
        othIsReflexive = other === other;

    if ((value > other && !othIsNull) || !valIsReflexive ||
        (valIsNull && !othIsUndef && othIsReflexive) ||
        (valIsUndef && othIsReflexive)) {
      return 1;
    }
    if ((value < other && !valIsNull) || !othIsReflexive ||
        (othIsNull && !valIsUndef && valIsReflexive) ||
        (othIsUndef && valIsReflexive)) {
      return -1;
    }
  }
  return 0;
}

module.exports = baseCompareAscending;

},{}],231:[function(require,module,exports){
/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @returns {Object} Returns `object`.
 */
function baseCopy(source, props, object) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];
    object[key] = source[key];
  }
  return object;
}

module.exports = baseCopy;

},{}],232:[function(require,module,exports){
var isObject = require('../lang/isObject');

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
var baseCreate = (function() {
  function object() {}
  return function(prototype) {
    if (isObject(prototype)) {
      object.prototype = prototype;
      var result = new object;
      object.prototype = undefined;
    }
    return result || {};
  };
}());

module.exports = baseCreate;

},{"../lang/isObject":323}],233:[function(require,module,exports){
var baseIndexOf = require('./baseIndexOf'),
    cacheIndexOf = require('./cacheIndexOf'),
    createCache = require('./createCache');

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * The base implementation of `_.difference` which accepts a single array
 * of values to exclude.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Array} values The values to exclude.
 * @returns {Array} Returns the new array of filtered values.
 */
function baseDifference(array, values) {
  var length = array ? array.length : 0,
      result = [];

  if (!length) {
    return result;
  }
  var index = -1,
      indexOf = baseIndexOf,
      isCommon = true,
      cache = (isCommon && values.length >= LARGE_ARRAY_SIZE) ? createCache(values) : null,
      valuesLength = values.length;

  if (cache) {
    indexOf = cacheIndexOf;
    isCommon = false;
    values = cache;
  }
  outer:
  while (++index < length) {
    var value = array[index];

    if (isCommon && value === value) {
      var valuesIndex = valuesLength;
      while (valuesIndex--) {
        if (values[valuesIndex] === value) {
          continue outer;
        }
      }
      result.push(value);
    }
    else if (indexOf(values, value, 0) < 0) {
      result.push(value);
    }
  }
  return result;
}

module.exports = baseDifference;

},{"./baseIndexOf":244,"./cacheIndexOf":265,"./createCache":275}],234:[function(require,module,exports){
var baseForOwn = require('./baseForOwn'),
    createBaseEach = require('./createBaseEach');

/**
 * The base implementation of `_.forEach` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array|Object|string} Returns `collection`.
 */
var baseEach = createBaseEach(baseForOwn);

module.exports = baseEach;

},{"./baseForOwn":242,"./createBaseEach":272}],235:[function(require,module,exports){
var baseEach = require('./baseEach');

/**
 * The base implementation of `_.every` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if all elements pass the predicate check,
 *  else `false`
 */
function baseEvery(collection, predicate) {
  var result = true;
  baseEach(collection, function(value, index, collection) {
    result = !!predicate(value, index, collection);
    return result;
  });
  return result;
}

module.exports = baseEvery;

},{"./baseEach":234}],236:[function(require,module,exports){
var baseEach = require('./baseEach');

/**
 * The base implementation of `_.filter` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function baseFilter(collection, predicate) {
  var result = [];
  baseEach(collection, function(value, index, collection) {
    if (predicate(value, index, collection)) {
      result.push(value);
    }
  });
  return result;
}

module.exports = baseFilter;

},{"./baseEach":234}],237:[function(require,module,exports){
/**
 * The base implementation of `_.find`, `_.findLast`, `_.findKey`, and `_.findLastKey`,
 * without support for callback shorthands and `this` binding, which iterates
 * over `collection` using the provided `eachFunc`.
 *
 * @private
 * @param {Array|Object|string} collection The collection to search.
 * @param {Function} predicate The function invoked per iteration.
 * @param {Function} eachFunc The function to iterate over `collection`.
 * @param {boolean} [retKey] Specify returning the key of the found element
 *  instead of the element itself.
 * @returns {*} Returns the found element or its key, else `undefined`.
 */
function baseFind(collection, predicate, eachFunc, retKey) {
  var result;
  eachFunc(collection, function(value, key, collection) {
    if (predicate(value, key, collection)) {
      result = retKey ? key : value;
      return false;
    }
  });
  return result;
}

module.exports = baseFind;

},{}],238:[function(require,module,exports){
/**
 * The base implementation of `_.findIndex` and `_.findLastIndex` without
 * support for callback shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {Function} predicate The function invoked per iteration.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseFindIndex(array, predicate, fromRight) {
  var length = array.length,
      index = fromRight ? length : -1;

  while ((fromRight ? index-- : ++index < length)) {
    if (predicate(array[index], index, array)) {
      return index;
    }
  }
  return -1;
}

module.exports = baseFindIndex;

},{}],239:[function(require,module,exports){
var arrayPush = require('./arrayPush'),
    isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isArrayLike = require('./isArrayLike'),
    isObjectLike = require('./isObjectLike');

/**
 * The base implementation of `_.flatten` with added support for restricting
 * flattening and specifying the start index.
 *
 * @private
 * @param {Array} array The array to flatten.
 * @param {boolean} [isDeep] Specify a deep flatten.
 * @param {boolean} [isStrict] Restrict flattening to arrays-like objects.
 * @param {Array} [result=[]] The initial result value.
 * @returns {Array} Returns the new flattened array.
 */
function baseFlatten(array, isDeep, isStrict, result) {
  result || (result = []);

  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index];
    if (isObjectLike(value) && isArrayLike(value) &&
        (isStrict || isArray(value) || isArguments(value))) {
      if (isDeep) {
        // Recursively flatten arrays (susceptible to call stack limits).
        baseFlatten(value, isDeep, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}

module.exports = baseFlatten;

},{"../lang/isArguments":318,"../lang/isArray":319,"./arrayPush":223,"./isArrayLike":296,"./isObjectLike":302}],240:[function(require,module,exports){
var createBaseFor = require('./createBaseFor');

/**
 * The base implementation of `baseForIn` and `baseForOwn` which iterates
 * over `object` properties returned by `keysFunc` invoking `iteratee` for
 * each property. Iteratee functions may exit iteration early by explicitly
 * returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

module.exports = baseFor;

},{"./createBaseFor":273}],241:[function(require,module,exports){
var baseFor = require('./baseFor'),
    keysIn = require('../object/keysIn');

/**
 * The base implementation of `_.forIn` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForIn(object, iteratee) {
  return baseFor(object, iteratee, keysIn);
}

module.exports = baseForIn;

},{"../object/keysIn":330,"./baseFor":240}],242:[function(require,module,exports){
var baseFor = require('./baseFor'),
    keys = require('../object/keys');

/**
 * The base implementation of `_.forOwn` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return baseFor(object, iteratee, keys);
}

module.exports = baseForOwn;

},{"../object/keys":329,"./baseFor":240}],243:[function(require,module,exports){
var toObject = require('./toObject');

/**
 * The base implementation of `get` without support for string paths
 * and default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} path The path of the property to get.
 * @param {string} [pathKey] The key representation of path.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path, pathKey) {
  if (object == null) {
    return;
  }
  if (pathKey !== undefined && pathKey in toObject(object)) {
    path = [pathKey];
  }
  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[path[index++]];
  }
  return (index && index == length) ? object : undefined;
}

module.exports = baseGet;

},{"./toObject":314}],244:[function(require,module,exports){
var indexOfNaN = require('./indexOfNaN');

/**
 * The base implementation of `_.indexOf` without support for binary searches.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} value The value to search for.
 * @param {number} fromIndex The index to search from.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseIndexOf(array, value, fromIndex) {
  if (value !== value) {
    return indexOfNaN(array, fromIndex);
  }
  var index = fromIndex - 1,
      length = array.length;

  while (++index < length) {
    if (array[index] === value) {
      return index;
    }
  }
  return -1;
}

module.exports = baseIndexOf;

},{"./indexOfNaN":292}],245:[function(require,module,exports){
var baseIsEqualDeep = require('./baseIsEqualDeep'),
    isObject = require('../lang/isObject'),
    isObjectLike = require('./isObjectLike');

/**
 * The base implementation of `_.isEqual` without support for `this` binding
 * `customizer` functions.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize comparing values.
 * @param {boolean} [isLoose] Specify performing partial comparisons.
 * @param {Array} [stackA] Tracks traversed `value` objects.
 * @param {Array} [stackB] Tracks traversed `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, customizer, isLoose, stackA, stackB) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, baseIsEqual, customizer, isLoose, stackA, stackB);
}

module.exports = baseIsEqual;

},{"../lang/isObject":323,"./baseIsEqualDeep":246,"./isObjectLike":302}],246:[function(require,module,exports){
var equalArrays = require('./equalArrays'),
    equalByTag = require('./equalByTag'),
    equalObjects = require('./equalObjects'),
    isArray = require('../lang/isArray'),
    isTypedArray = require('../lang/isTypedArray');

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    objectTag = '[object Object]';

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparing objects.
 * @param {boolean} [isLoose] Specify performing partial comparisons.
 * @param {Array} [stackA=[]] Tracks traversed `value` objects.
 * @param {Array} [stackB=[]] Tracks traversed `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, equalFunc, customizer, isLoose, stackA, stackB) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = arrayTag,
      othTag = arrayTag;

  if (!objIsArr) {
    objTag = objToString.call(object);
    if (objTag == argsTag) {
      objTag = objectTag;
    } else if (objTag != objectTag) {
      objIsArr = isTypedArray(object);
    }
  }
  if (!othIsArr) {
    othTag = objToString.call(other);
    if (othTag == argsTag) {
      othTag = objectTag;
    } else if (othTag != objectTag) {
      othIsArr = isTypedArray(other);
    }
  }
  var objIsObj = objTag == objectTag,
      othIsObj = othTag == objectTag,
      isSameTag = objTag == othTag;

  if (isSameTag && !(objIsArr || objIsObj)) {
    return equalByTag(object, other, objTag);
  }
  if (!isLoose) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      return equalFunc(objIsWrapped ? object.value() : object, othIsWrapped ? other.value() : other, customizer, isLoose, stackA, stackB);
    }
  }
  if (!isSameTag) {
    return false;
  }
  // Assume cyclic values are equal.
  // For more information on detecting circular references see https://es5.github.io/#JO.
  stackA || (stackA = []);
  stackB || (stackB = []);

  var length = stackA.length;
  while (length--) {
    if (stackA[length] == object) {
      return stackB[length] == other;
    }
  }
  // Add `object` and `other` to the stack of traversed objects.
  stackA.push(object);
  stackB.push(other);

  var result = (objIsArr ? equalArrays : equalObjects)(object, other, equalFunc, customizer, isLoose, stackA, stackB);

  stackA.pop();
  stackB.pop();

  return result;
}

module.exports = baseIsEqualDeep;

},{"../lang/isArray":319,"../lang/isTypedArray":326,"./equalArrays":284,"./equalByTag":285,"./equalObjects":286}],247:[function(require,module,exports){
var baseIsEqual = require('./baseIsEqual'),
    toObject = require('./toObject');

/**
 * The base implementation of `_.isMatch` without support for callback
 * shorthands and `this` binding.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Array} matchData The propery names, values, and compare flags to match.
 * @param {Function} [customizer] The function to customize comparing objects.
 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
 */
function baseIsMatch(object, matchData, customizer) {
  var index = matchData.length,
      length = index,
      noCustomizer = !customizer;

  if (object == null) {
    return !length;
  }
  object = toObject(object);
  while (index--) {
    var data = matchData[index];
    if ((noCustomizer && data[2])
          ? data[1] !== object[data[0]]
          : !(data[0] in object)
        ) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0],
        objValue = object[key],
        srcValue = data[1];

    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var result = customizer ? customizer(objValue, srcValue, key) : undefined;
      if (!(result === undefined ? baseIsEqual(srcValue, objValue, customizer, true) : result)) {
        return false;
      }
    }
  }
  return true;
}

module.exports = baseIsMatch;

},{"./baseIsEqual":245,"./toObject":314}],248:[function(require,module,exports){
/**
 * The function whose prototype all chaining wrappers inherit from.
 *
 * @private
 */
function baseLodash() {
  // No operation performed.
}

module.exports = baseLodash;

},{}],249:[function(require,module,exports){
var baseEach = require('./baseEach'),
    isArrayLike = require('./isArrayLike');

/**
 * The base implementation of `_.map` without support for callback shorthands
 * and `this` binding.
 *
 * @private
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function baseMap(collection, iteratee) {
  var index = -1,
      result = isArrayLike(collection) ? Array(collection.length) : [];

  baseEach(collection, function(value, key, collection) {
    result[++index] = iteratee(value, key, collection);
  });
  return result;
}

module.exports = baseMap;

},{"./baseEach":234,"./isArrayLike":296}],250:[function(require,module,exports){
var baseIsMatch = require('./baseIsMatch'),
    getMatchData = require('./getMatchData'),
    toObject = require('./toObject');

/**
 * The base implementation of `_.matches` which does not clone `source`.
 *
 * @private
 * @param {Object} source The object of property values to match.
 * @returns {Function} Returns the new function.
 */
function baseMatches(source) {
  var matchData = getMatchData(source);
  if (matchData.length == 1 && matchData[0][2]) {
    var key = matchData[0][0],
        value = matchData[0][1];

    return function(object) {
      if (object == null) {
        return false;
      }
      return object[key] === value && (value !== undefined || (key in toObject(object)));
    };
  }
  return function(object) {
    return baseIsMatch(object, matchData);
  };
}

module.exports = baseMatches;

},{"./baseIsMatch":247,"./getMatchData":290,"./toObject":314}],251:[function(require,module,exports){
var baseGet = require('./baseGet'),
    baseIsEqual = require('./baseIsEqual'),
    baseSlice = require('./baseSlice'),
    isArray = require('../lang/isArray'),
    isKey = require('./isKey'),
    isStrictComparable = require('./isStrictComparable'),
    last = require('../array/last'),
    toObject = require('./toObject'),
    toPath = require('./toPath');

/**
 * The base implementation of `_.matchesProperty` which does not clone `srcValue`.
 *
 * @private
 * @param {string} path The path of the property to get.
 * @param {*} srcValue The value to compare.
 * @returns {Function} Returns the new function.
 */
function baseMatchesProperty(path, srcValue) {
  var isArr = isArray(path),
      isCommon = isKey(path) && isStrictComparable(srcValue),
      pathKey = (path + '');

  path = toPath(path);
  return function(object) {
    if (object == null) {
      return false;
    }
    var key = pathKey;
    object = toObject(object);
    if ((isArr || !isCommon) && !(key in object)) {
      object = path.length == 1 ? object : baseGet(object, baseSlice(path, 0, -1));
      if (object == null) {
        return false;
      }
      key = last(path);
      object = toObject(object);
    }
    return object[key] === srcValue
      ? (srcValue !== undefined || (key in object))
      : baseIsEqual(srcValue, object[key], undefined, true);
  };
}

module.exports = baseMatchesProperty;

},{"../array/last":194,"../lang/isArray":319,"./baseGet":243,"./baseIsEqual":245,"./baseSlice":258,"./isKey":299,"./isStrictComparable":303,"./toObject":314,"./toPath":315}],252:[function(require,module,exports){
var arrayEach = require('./arrayEach'),
    baseMergeDeep = require('./baseMergeDeep'),
    isArray = require('../lang/isArray'),
    isArrayLike = require('./isArrayLike'),
    isObject = require('../lang/isObject'),
    isObjectLike = require('./isObjectLike'),
    isTypedArray = require('../lang/isTypedArray'),
    keys = require('../object/keys');

/**
 * The base implementation of `_.merge` without support for argument juggling,
 * multiple sources, and `this` binding `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {Function} [customizer] The function to customize merged values.
 * @param {Array} [stackA=[]] Tracks traversed source objects.
 * @param {Array} [stackB=[]] Associates values with source counterparts.
 * @returns {Object} Returns `object`.
 */
function baseMerge(object, source, customizer, stackA, stackB) {
  if (!isObject(object)) {
    return object;
  }
  var isSrcArr = isArrayLike(source) && (isArray(source) || isTypedArray(source)),
      props = isSrcArr ? undefined : keys(source);

  arrayEach(props || source, function(srcValue, key) {
    if (props) {
      key = srcValue;
      srcValue = source[key];
    }
    if (isObjectLike(srcValue)) {
      stackA || (stackA = []);
      stackB || (stackB = []);
      baseMergeDeep(object, source, key, baseMerge, customizer, stackA, stackB);
    }
    else {
      var value = object[key],
          result = customizer ? customizer(value, srcValue, key, object, source) : undefined,
          isCommon = result === undefined;

      if (isCommon) {
        result = srcValue;
      }
      if ((result !== undefined || (isSrcArr && !(key in object))) &&
          (isCommon || (result === result ? (result !== value) : (value === value)))) {
        object[key] = result;
      }
    }
  });
  return object;
}

module.exports = baseMerge;

},{"../lang/isArray":319,"../lang/isObject":323,"../lang/isTypedArray":326,"../object/keys":329,"./arrayEach":219,"./baseMergeDeep":253,"./isArrayLike":296,"./isObjectLike":302}],253:[function(require,module,exports){
var arrayCopy = require('./arrayCopy'),
    isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isArrayLike = require('./isArrayLike'),
    isPlainObject = require('../lang/isPlainObject'),
    isTypedArray = require('../lang/isTypedArray'),
    toPlainObject = require('../lang/toPlainObject');

/**
 * A specialized version of `baseMerge` for arrays and objects which performs
 * deep merges and tracks traversed objects enabling objects with circular
 * references to be merged.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {string} key The key of the value to merge.
 * @param {Function} mergeFunc The function to merge values.
 * @param {Function} [customizer] The function to customize merged values.
 * @param {Array} [stackA=[]] Tracks traversed source objects.
 * @param {Array} [stackB=[]] Associates values with source counterparts.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseMergeDeep(object, source, key, mergeFunc, customizer, stackA, stackB) {
  var length = stackA.length,
      srcValue = source[key];

  while (length--) {
    if (stackA[length] == srcValue) {
      object[key] = stackB[length];
      return;
    }
  }
  var value = object[key],
      result = customizer ? customizer(value, srcValue, key, object, source) : undefined,
      isCommon = result === undefined;

  if (isCommon) {
    result = srcValue;
    if (isArrayLike(srcValue) && (isArray(srcValue) || isTypedArray(srcValue))) {
      result = isArray(value)
        ? value
        : (isArrayLike(value) ? arrayCopy(value) : []);
    }
    else if (isPlainObject(srcValue) || isArguments(srcValue)) {
      result = isArguments(value)
        ? toPlainObject(value)
        : (isPlainObject(value) ? value : {});
    }
    else {
      isCommon = false;
    }
  }
  // Add the source value to the stack of traversed objects and associate
  // it with its merged value.
  stackA.push(srcValue);
  stackB.push(result);

  if (isCommon) {
    // Recursively merge objects and arrays (susceptible to call stack limits).
    object[key] = mergeFunc(result, srcValue, customizer, stackA, stackB);
  } else if (result === result ? (result !== value) : (value === value)) {
    object[key] = result;
  }
}

module.exports = baseMergeDeep;

},{"../lang/isArguments":318,"../lang/isArray":319,"../lang/isPlainObject":324,"../lang/isTypedArray":326,"../lang/toPlainObject":327,"./arrayCopy":218,"./isArrayLike":296}],254:[function(require,module,exports){
/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

module.exports = baseProperty;

},{}],255:[function(require,module,exports){
var baseGet = require('./baseGet'),
    toPath = require('./toPath');

/**
 * A specialized version of `baseProperty` which supports deep paths.
 *
 * @private
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new function.
 */
function basePropertyDeep(path) {
  var pathKey = (path + '');
  path = toPath(path);
  return function(object) {
    return baseGet(object, path, pathKey);
  };
}

module.exports = basePropertyDeep;

},{"./baseGet":243,"./toPath":315}],256:[function(require,module,exports){
/**
 * The base implementation of `_.reduce` and `_.reduceRight` without support
 * for callback shorthands and `this` binding, which iterates over `collection`
 * using the provided `eachFunc`.
 *
 * @private
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {*} accumulator The initial value.
 * @param {boolean} initFromCollection Specify using the first or last element
 *  of `collection` as the initial value.
 * @param {Function} eachFunc The function to iterate over `collection`.
 * @returns {*} Returns the accumulated value.
 */
function baseReduce(collection, iteratee, accumulator, initFromCollection, eachFunc) {
  eachFunc(collection, function(value, index, collection) {
    accumulator = initFromCollection
      ? (initFromCollection = false, value)
      : iteratee(accumulator, value, index, collection);
  });
  return accumulator;
}

module.exports = baseReduce;

},{}],257:[function(require,module,exports){
var identity = require('../utility/identity'),
    metaMap = require('./metaMap');

/**
 * The base implementation of `setData` without support for hot loop detection.
 *
 * @private
 * @param {Function} func The function to associate metadata with.
 * @param {*} data The metadata.
 * @returns {Function} Returns `func`.
 */
var baseSetData = !metaMap ? identity : function(func, data) {
  metaMap.set(func, data);
  return func;
};

module.exports = baseSetData;

},{"../utility/identity":335,"./metaMap":305}],258:[function(require,module,exports){
/**
 * The base implementation of `_.slice` without an iteratee call guard.
 *
 * @private
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the slice of `array`.
 */
function baseSlice(array, start, end) {
  var index = -1,
      length = array.length;

  start = start == null ? 0 : (+start || 0);
  if (start < 0) {
    start = -start > length ? 0 : (length + start);
  }
  end = (end === undefined || end > length) ? length : (+end || 0);
  if (end < 0) {
    end += length;
  }
  length = start > end ? 0 : ((end - start) >>> 0);
  start >>>= 0;

  var result = Array(length);
  while (++index < length) {
    result[index] = array[index + start];
  }
  return result;
}

module.exports = baseSlice;

},{}],259:[function(require,module,exports){
var baseEach = require('./baseEach');

/**
 * The base implementation of `_.some` without support for callback shorthands
 * and `this` binding.
 *
 * @private
 * @param {Array|Object|string} collection The collection to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function baseSome(collection, predicate) {
  var result;

  baseEach(collection, function(value, index, collection) {
    result = predicate(value, index, collection);
    return !result;
  });
  return !!result;
}

module.exports = baseSome;

},{"./baseEach":234}],260:[function(require,module,exports){
/**
 * The base implementation of `_.sortBy` which uses `comparer` to define
 * the sort order of `array` and replaces criteria objects with their
 * corresponding values.
 *
 * @private
 * @param {Array} array The array to sort.
 * @param {Function} comparer The function to define sort order.
 * @returns {Array} Returns `array`.
 */
function baseSortBy(array, comparer) {
  var length = array.length;

  array.sort(comparer);
  while (length--) {
    array[length] = array[length].value;
  }
  return array;
}

module.exports = baseSortBy;

},{}],261:[function(require,module,exports){
/**
 * Converts `value` to a string if it's not one. An empty string is returned
 * for `null` or `undefined` values.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  return value == null ? '' : (value + '');
}

module.exports = baseToString;

},{}],262:[function(require,module,exports){
var baseIndexOf = require('./baseIndexOf'),
    cacheIndexOf = require('./cacheIndexOf'),
    createCache = require('./createCache');

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/**
 * The base implementation of `_.uniq` without support for callback shorthands
 * and `this` binding.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Function} [iteratee] The function invoked per iteration.
 * @returns {Array} Returns the new duplicate free array.
 */
function baseUniq(array, iteratee) {
  var index = -1,
      indexOf = baseIndexOf,
      length = array.length,
      isCommon = true,
      isLarge = isCommon && length >= LARGE_ARRAY_SIZE,
      seen = isLarge ? createCache() : null,
      result = [];

  if (seen) {
    indexOf = cacheIndexOf;
    isCommon = false;
  } else {
    isLarge = false;
    seen = iteratee ? [] : result;
  }
  outer:
  while (++index < length) {
    var value = array[index],
        computed = iteratee ? iteratee(value, index, array) : value;

    if (isCommon && value === value) {
      var seenIndex = seen.length;
      while (seenIndex--) {
        if (seen[seenIndex] === computed) {
          continue outer;
        }
      }
      if (iteratee) {
        seen.push(computed);
      }
      result.push(value);
    }
    else if (indexOf(seen, computed, 0) < 0) {
      if (iteratee || isLarge) {
        seen.push(computed);
      }
      result.push(value);
    }
  }
  return result;
}

module.exports = baseUniq;

},{"./baseIndexOf":244,"./cacheIndexOf":265,"./createCache":275}],263:[function(require,module,exports){
var identity = require('../utility/identity');

/**
 * A specialized version of `baseCallback` which only supports `this` binding
 * and specifying the number of arguments to provide to `func`.
 *
 * @private
 * @param {Function} func The function to bind.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {number} [argCount] The number of arguments to provide to `func`.
 * @returns {Function} Returns the callback.
 */
function bindCallback(func, thisArg, argCount) {
  if (typeof func != 'function') {
    return identity;
  }
  if (thisArg === undefined) {
    return func;
  }
  switch (argCount) {
    case 1: return function(value) {
      return func.call(thisArg, value);
    };
    case 3: return function(value, index, collection) {
      return func.call(thisArg, value, index, collection);
    };
    case 4: return function(accumulator, value, index, collection) {
      return func.call(thisArg, accumulator, value, index, collection);
    };
    case 5: return function(value, other, key, object, source) {
      return func.call(thisArg, value, other, key, object, source);
    };
  }
  return function() {
    return func.apply(thisArg, arguments);
  };
}

module.exports = bindCallback;

},{"../utility/identity":335}],264:[function(require,module,exports){
(function (global){
/** Native method references. */
var ArrayBuffer = global.ArrayBuffer,
    Uint8Array = global.Uint8Array;

/**
 * Creates a clone of the given array buffer.
 *
 * @private
 * @param {ArrayBuffer} buffer The array buffer to clone.
 * @returns {ArrayBuffer} Returns the cloned array buffer.
 */
function bufferClone(buffer) {
  var result = new ArrayBuffer(buffer.byteLength),
      view = new Uint8Array(result);

  view.set(new Uint8Array(buffer));
  return result;
}

module.exports = bufferClone;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],265:[function(require,module,exports){
var isObject = require('../lang/isObject');

/**
 * Checks if `value` is in `cache` mimicking the return signature of
 * `_.indexOf` by returning `0` if the value is found, else `-1`.
 *
 * @private
 * @param {Object} cache The cache to search.
 * @param {*} value The value to search for.
 * @returns {number} Returns `0` if `value` is found, else `-1`.
 */
function cacheIndexOf(cache, value) {
  var data = cache.data,
      result = (typeof value == 'string' || isObject(value)) ? data.set.has(value) : data.hash[value];

  return result ? 0 : -1;
}

module.exports = cacheIndexOf;

},{"../lang/isObject":323}],266:[function(require,module,exports){
var isObject = require('../lang/isObject');

/**
 * Adds `value` to the cache.
 *
 * @private
 * @name push
 * @memberOf SetCache
 * @param {*} value The value to cache.
 */
function cachePush(value) {
  var data = this.data;
  if (typeof value == 'string' || isObject(value)) {
    data.set.add(value);
  } else {
    data.hash[value] = true;
  }
}

module.exports = cachePush;

},{"../lang/isObject":323}],267:[function(require,module,exports){
var baseCompareAscending = require('./baseCompareAscending');

/**
 * Used by `_.sortBy` to compare transformed elements of a collection and stable
 * sort them in ascending order.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @returns {number} Returns the sort order indicator for `object`.
 */
function compareAscending(object, other) {
  return baseCompareAscending(object.criteria, other.criteria) || (object.index - other.index);
}

module.exports = compareAscending;

},{"./baseCompareAscending":230}],268:[function(require,module,exports){
/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates an array that is the composition of partially applied arguments,
 * placeholders, and provided arguments into a single array of arguments.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to prepend to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgs(args, partials, holders) {
  var holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      leftIndex = -1,
      leftLength = partials.length,
      result = Array(leftLength + argsLength);

  while (++leftIndex < leftLength) {
    result[leftIndex] = partials[leftIndex];
  }
  while (++argsIndex < holdersLength) {
    result[holders[argsIndex]] = args[argsIndex];
  }
  while (argsLength--) {
    result[leftIndex++] = args[argsIndex++];
  }
  return result;
}

module.exports = composeArgs;

},{}],269:[function(require,module,exports){
/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * This function is like `composeArgs` except that the arguments composition
 * is tailored for `_.partialRight`.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to append to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgsRight(args, partials, holders) {
  var holdersIndex = -1,
      holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      rightIndex = -1,
      rightLength = partials.length,
      result = Array(argsLength + rightLength);

  while (++argsIndex < argsLength) {
    result[argsIndex] = args[argsIndex];
  }
  var offset = argsIndex;
  while (++rightIndex < rightLength) {
    result[offset + rightIndex] = partials[rightIndex];
  }
  while (++holdersIndex < holdersLength) {
    result[offset + holders[holdersIndex]] = args[argsIndex++];
  }
  return result;
}

module.exports = composeArgsRight;

},{}],270:[function(require,module,exports){
var baseCallback = require('./baseCallback'),
    baseEach = require('./baseEach'),
    isArray = require('../lang/isArray');

/**
 * Creates a `_.countBy`, `_.groupBy`, `_.indexBy`, or `_.partition` function.
 *
 * @private
 * @param {Function} setter The function to set keys and values of the accumulator object.
 * @param {Function} [initializer] The function to initialize the accumulator object.
 * @returns {Function} Returns the new aggregator function.
 */
function createAggregator(setter, initializer) {
  return function(collection, iteratee, thisArg) {
    var result = initializer ? initializer() : {};
    iteratee = baseCallback(iteratee, thisArg, 3);

    if (isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        var value = collection[index];
        setter(result, value, iteratee(value, index, collection), collection);
      }
    } else {
      baseEach(collection, function(value, key, collection) {
        setter(result, value, iteratee(value, key, collection), collection);
      });
    }
    return result;
  };
}

module.exports = createAggregator;

},{"../lang/isArray":319,"./baseCallback":228,"./baseEach":234}],271:[function(require,module,exports){
var bindCallback = require('./bindCallback'),
    isIterateeCall = require('./isIterateeCall'),
    restParam = require('../function/restParam');

/**
 * Creates a `_.assign`, `_.defaults`, or `_.merge` function.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return restParam(function(object, sources) {
    var index = -1,
        length = object == null ? 0 : sources.length,
        customizer = length > 2 ? sources[length - 2] : undefined,
        guard = length > 2 ? sources[2] : undefined,
        thisArg = length > 1 ? sources[length - 1] : undefined;

    if (typeof customizer == 'function') {
      customizer = bindCallback(customizer, thisArg, 5);
      length -= 2;
    } else {
      customizer = typeof thisArg == 'function' ? thisArg : undefined;
      length -= (customizer ? 1 : 0);
    }
    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, customizer);
      }
    }
    return object;
  });
}

module.exports = createAssigner;

},{"../function/restParam":214,"./bindCallback":263,"./isIterateeCall":298}],272:[function(require,module,exports){
var getLength = require('./getLength'),
    isLength = require('./isLength'),
    toObject = require('./toObject');

/**
 * Creates a `baseEach` or `baseEachRight` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    var length = collection ? getLength(collection) : 0;
    if (!isLength(length)) {
      return eachFunc(collection, iteratee);
    }
    var index = fromRight ? length : -1,
        iterable = toObject(collection);

    while ((fromRight ? index-- : ++index < length)) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}

module.exports = createBaseEach;

},{"./getLength":289,"./isLength":301,"./toObject":314}],273:[function(require,module,exports){
var toObject = require('./toObject');

/**
 * Creates a base function for `_.forIn` or `_.forInRight`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var iterable = toObject(object),
        props = keysFunc(object),
        length = props.length,
        index = fromRight ? length : -1;

    while ((fromRight ? index-- : ++index < length)) {
      var key = props[index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

module.exports = createBaseFor;

},{"./toObject":314}],274:[function(require,module,exports){
(function (global){
var createCtorWrapper = require('./createCtorWrapper');

/**
 * Creates a function that wraps `func` and invokes it with the `this`
 * binding of `thisArg`.
 *
 * @private
 * @param {Function} func The function to bind.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @returns {Function} Returns the new bound function.
 */
function createBindWrapper(func, thisArg) {
  var Ctor = createCtorWrapper(func);

  function wrapper() {
    var fn = (this && this !== global && this instanceof wrapper) ? Ctor : func;
    return fn.apply(thisArg, arguments);
  }
  return wrapper;
}

module.exports = createBindWrapper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./createCtorWrapper":276}],275:[function(require,module,exports){
(function (global){
var SetCache = require('./SetCache'),
    getNative = require('./getNative');

/** Native method references. */
var Set = getNative(global, 'Set');

/* Native method references for those with the same name as other `lodash` methods. */
var nativeCreate = getNative(Object, 'create');

/**
 * Creates a `Set` cache object to optimize linear searches of large arrays.
 *
 * @private
 * @param {Array} [values] The values to cache.
 * @returns {null|Object} Returns the new cache object if `Set` is supported, else `null`.
 */
function createCache(values) {
  return (nativeCreate && Set) ? new SetCache(values) : null;
}

module.exports = createCache;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./SetCache":217,"./getNative":291}],276:[function(require,module,exports){
var baseCreate = require('./baseCreate'),
    isObject = require('../lang/isObject');

/**
 * Creates a function that produces an instance of `Ctor` regardless of
 * whether it was invoked as part of a `new` expression or by `call` or `apply`.
 *
 * @private
 * @param {Function} Ctor The constructor to wrap.
 * @returns {Function} Returns the new wrapped function.
 */
function createCtorWrapper(Ctor) {
  return function() {
    // Use a `switch` statement to work with class constructors.
    // See http://ecma-international.org/ecma-262/6.0/#sec-ecmascript-function-objects-call-thisargument-argumentslist
    // for more details.
    var args = arguments;
    switch (args.length) {
      case 0: return new Ctor;
      case 1: return new Ctor(args[0]);
      case 2: return new Ctor(args[0], args[1]);
      case 3: return new Ctor(args[0], args[1], args[2]);
      case 4: return new Ctor(args[0], args[1], args[2], args[3]);
      case 5: return new Ctor(args[0], args[1], args[2], args[3], args[4]);
      case 6: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 7: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    }
    var thisBinding = baseCreate(Ctor.prototype),
        result = Ctor.apply(thisBinding, args);

    // Mimic the constructor's `return` behavior.
    // See https://es5.github.io/#x13.2.2 for more details.
    return isObject(result) ? result : thisBinding;
  };
}

module.exports = createCtorWrapper;

},{"../lang/isObject":323,"./baseCreate":232}],277:[function(require,module,exports){
var baseCallback = require('./baseCallback'),
    baseFind = require('./baseFind'),
    baseFindIndex = require('./baseFindIndex'),
    isArray = require('../lang/isArray');

/**
 * Creates a `_.find` or `_.findLast` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new find function.
 */
function createFind(eachFunc, fromRight) {
  return function(collection, predicate, thisArg) {
    predicate = baseCallback(predicate, thisArg, 3);
    if (isArray(collection)) {
      var index = baseFindIndex(collection, predicate, fromRight);
      return index > -1 ? collection[index] : undefined;
    }
    return baseFind(collection, predicate, eachFunc);
  };
}

module.exports = createFind;

},{"../lang/isArray":319,"./baseCallback":228,"./baseFind":237,"./baseFindIndex":238}],278:[function(require,module,exports){
var baseCallback = require('./baseCallback'),
    baseFindIndex = require('./baseFindIndex');

/**
 * Creates a `_.findIndex` or `_.findLastIndex` function.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new find function.
 */
function createFindIndex(fromRight) {
  return function(array, predicate, thisArg) {
    if (!(array && array.length)) {
      return -1;
    }
    predicate = baseCallback(predicate, thisArg, 3);
    return baseFindIndex(array, predicate, fromRight);
  };
}

module.exports = createFindIndex;

},{"./baseCallback":228,"./baseFindIndex":238}],279:[function(require,module,exports){
var bindCallback = require('./bindCallback'),
    isArray = require('../lang/isArray');

/**
 * Creates a function for `_.forEach` or `_.forEachRight`.
 *
 * @private
 * @param {Function} arrayFunc The function to iterate over an array.
 * @param {Function} eachFunc The function to iterate over a collection.
 * @returns {Function} Returns the new each function.
 */
function createForEach(arrayFunc, eachFunc) {
  return function(collection, iteratee, thisArg) {
    return (typeof iteratee == 'function' && thisArg === undefined && isArray(collection))
      ? arrayFunc(collection, iteratee)
      : eachFunc(collection, bindCallback(iteratee, thisArg, 3));
  };
}

module.exports = createForEach;

},{"../lang/isArray":319,"./bindCallback":263}],280:[function(require,module,exports){
(function (global){
var arrayCopy = require('./arrayCopy'),
    composeArgs = require('./composeArgs'),
    composeArgsRight = require('./composeArgsRight'),
    createCtorWrapper = require('./createCtorWrapper'),
    isLaziable = require('./isLaziable'),
    reorder = require('./reorder'),
    replaceHolders = require('./replaceHolders'),
    setData = require('./setData');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1,
    BIND_KEY_FLAG = 2,
    CURRY_BOUND_FLAG = 4,
    CURRY_FLAG = 8,
    CURRY_RIGHT_FLAG = 16,
    PARTIAL_FLAG = 32,
    PARTIAL_RIGHT_FLAG = 64,
    ARY_FLAG = 128;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that wraps `func` and invokes it with optional `this`
 * binding of, partial application, and currying.
 *
 * @private
 * @param {Function|string} func The function or method name to reference.
 * @param {number} bitmask The bitmask of flags. See `createWrapper` for more details.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [partialsRight] The arguments to append to those provided to the new function.
 * @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createHybridWrapper(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
  var isAry = bitmask & ARY_FLAG,
      isBind = bitmask & BIND_FLAG,
      isBindKey = bitmask & BIND_KEY_FLAG,
      isCurry = bitmask & CURRY_FLAG,
      isCurryBound = bitmask & CURRY_BOUND_FLAG,
      isCurryRight = bitmask & CURRY_RIGHT_FLAG,
      Ctor = isBindKey ? undefined : createCtorWrapper(func);

  function wrapper() {
    // Avoid `arguments` object use disqualifying optimizations by
    // converting it to an array before providing it to other functions.
    var length = arguments.length,
        index = length,
        args = Array(length);

    while (index--) {
      args[index] = arguments[index];
    }
    if (partials) {
      args = composeArgs(args, partials, holders);
    }
    if (partialsRight) {
      args = composeArgsRight(args, partialsRight, holdersRight);
    }
    if (isCurry || isCurryRight) {
      var placeholder = wrapper.placeholder,
          argsHolders = replaceHolders(args, placeholder);

      length -= argsHolders.length;
      if (length < arity) {
        var newArgPos = argPos ? arrayCopy(argPos) : undefined,
            newArity = nativeMax(arity - length, 0),
            newsHolders = isCurry ? argsHolders : undefined,
            newHoldersRight = isCurry ? undefined : argsHolders,
            newPartials = isCurry ? args : undefined,
            newPartialsRight = isCurry ? undefined : args;

        bitmask |= (isCurry ? PARTIAL_FLAG : PARTIAL_RIGHT_FLAG);
        bitmask &= ~(isCurry ? PARTIAL_RIGHT_FLAG : PARTIAL_FLAG);

        if (!isCurryBound) {
          bitmask &= ~(BIND_FLAG | BIND_KEY_FLAG);
        }
        var newData = [func, bitmask, thisArg, newPartials, newsHolders, newPartialsRight, newHoldersRight, newArgPos, ary, newArity],
            result = createHybridWrapper.apply(undefined, newData);

        if (isLaziable(func)) {
          setData(result, newData);
        }
        result.placeholder = placeholder;
        return result;
      }
    }
    var thisBinding = isBind ? thisArg : this,
        fn = isBindKey ? thisBinding[func] : func;

    if (argPos) {
      args = reorder(args, argPos);
    }
    if (isAry && ary < args.length) {
      args.length = ary;
    }
    if (this && this !== global && this instanceof wrapper) {
      fn = Ctor || createCtorWrapper(func);
    }
    return fn.apply(thisBinding, args);
  }
  return wrapper;
}

module.exports = createHybridWrapper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./arrayCopy":218,"./composeArgs":268,"./composeArgsRight":269,"./createCtorWrapper":276,"./isLaziable":300,"./reorder":309,"./replaceHolders":310,"./setData":311}],281:[function(require,module,exports){
(function (global){
var createCtorWrapper = require('./createCtorWrapper');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1;

/**
 * Creates a function that wraps `func` and invokes it with the optional `this`
 * binding of `thisArg` and the `partials` prepended to those provided to
 * the wrapper.
 *
 * @private
 * @param {Function} func The function to partially apply arguments to.
 * @param {number} bitmask The bitmask of flags. See `createWrapper` for more details.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} partials The arguments to prepend to those provided to the new function.
 * @returns {Function} Returns the new bound function.
 */
function createPartialWrapper(func, bitmask, thisArg, partials) {
  var isBind = bitmask & BIND_FLAG,
      Ctor = createCtorWrapper(func);

  function wrapper() {
    // Avoid `arguments` object use disqualifying optimizations by
    // converting it to an array before providing it `func`.
    var argsIndex = -1,
        argsLength = arguments.length,
        leftIndex = -1,
        leftLength = partials.length,
        args = Array(leftLength + argsLength);

    while (++leftIndex < leftLength) {
      args[leftIndex] = partials[leftIndex];
    }
    while (argsLength--) {
      args[leftIndex++] = arguments[++argsIndex];
    }
    var fn = (this && this !== global && this instanceof wrapper) ? Ctor : func;
    return fn.apply(isBind ? thisArg : this, args);
  }
  return wrapper;
}

module.exports = createPartialWrapper;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./createCtorWrapper":276}],282:[function(require,module,exports){
var baseCallback = require('./baseCallback'),
    baseReduce = require('./baseReduce'),
    isArray = require('../lang/isArray');

/**
 * Creates a function for `_.reduce` or `_.reduceRight`.
 *
 * @private
 * @param {Function} arrayFunc The function to iterate over an array.
 * @param {Function} eachFunc The function to iterate over a collection.
 * @returns {Function} Returns the new each function.
 */
function createReduce(arrayFunc, eachFunc) {
  return function(collection, iteratee, accumulator, thisArg) {
    var initFromArray = arguments.length < 3;
    return (typeof iteratee == 'function' && thisArg === undefined && isArray(collection))
      ? arrayFunc(collection, iteratee, accumulator, initFromArray)
      : baseReduce(collection, baseCallback(iteratee, thisArg, 4), accumulator, initFromArray, eachFunc);
  };
}

module.exports = createReduce;

},{"../lang/isArray":319,"./baseCallback":228,"./baseReduce":256}],283:[function(require,module,exports){
var baseSetData = require('./baseSetData'),
    createBindWrapper = require('./createBindWrapper'),
    createHybridWrapper = require('./createHybridWrapper'),
    createPartialWrapper = require('./createPartialWrapper'),
    getData = require('./getData'),
    mergeData = require('./mergeData'),
    setData = require('./setData');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1,
    BIND_KEY_FLAG = 2,
    PARTIAL_FLAG = 32,
    PARTIAL_RIGHT_FLAG = 64;

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that either curries or invokes `func` with optional
 * `this` binding and partially applied arguments.
 *
 * @private
 * @param {Function|string} func The function or method name to reference.
 * @param {number} bitmask The bitmask of flags.
 *  The bitmask may be composed of the following flags:
 *     1 - `_.bind`
 *     2 - `_.bindKey`
 *     4 - `_.curry` or `_.curryRight` of a bound function
 *     8 - `_.curry`
 *    16 - `_.curryRight`
 *    32 - `_.partial`
 *    64 - `_.partialRight`
 *   128 - `_.rearg`
 *   256 - `_.ary`
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to be partially applied.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createWrapper(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
  var isBindKey = bitmask & BIND_KEY_FLAG;
  if (!isBindKey && typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var length = partials ? partials.length : 0;
  if (!length) {
    bitmask &= ~(PARTIAL_FLAG | PARTIAL_RIGHT_FLAG);
    partials = holders = undefined;
  }
  length -= (holders ? holders.length : 0);
  if (bitmask & PARTIAL_RIGHT_FLAG) {
    var partialsRight = partials,
        holdersRight = holders;

    partials = holders = undefined;
  }
  var data = isBindKey ? undefined : getData(func),
      newData = [func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity];

  if (data) {
    mergeData(newData, data);
    bitmask = newData[1];
    arity = newData[9];
  }
  newData[9] = arity == null
    ? (isBindKey ? 0 : func.length)
    : (nativeMax(arity - length, 0) || 0);

  if (bitmask == BIND_FLAG) {
    var result = createBindWrapper(newData[0], newData[2]);
  } else if ((bitmask == PARTIAL_FLAG || bitmask == (BIND_FLAG | PARTIAL_FLAG)) && !newData[4].length) {
    result = createPartialWrapper.apply(undefined, newData);
  } else {
    result = createHybridWrapper.apply(undefined, newData);
  }
  var setter = data ? baseSetData : setData;
  return setter(result, newData);
}

module.exports = createWrapper;

},{"./baseSetData":257,"./createBindWrapper":274,"./createHybridWrapper":280,"./createPartialWrapper":281,"./getData":287,"./mergeData":304,"./setData":311}],284:[function(require,module,exports){
var arraySome = require('./arraySome');

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparing arrays.
 * @param {boolean} [isLoose] Specify performing partial comparisons.
 * @param {Array} [stackA] Tracks traversed `value` objects.
 * @param {Array} [stackB] Tracks traversed `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, equalFunc, customizer, isLoose, stackA, stackB) {
  var index = -1,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isLoose && othLength > arrLength)) {
    return false;
  }
  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index],
        result = customizer ? customizer(isLoose ? othValue : arrValue, isLoose ? arrValue : othValue, index) : undefined;

    if (result !== undefined) {
      if (result) {
        continue;
      }
      return false;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (isLoose) {
      if (!arraySome(other, function(othValue) {
            return arrValue === othValue || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB);
          })) {
        return false;
      }
    } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, customizer, isLoose, stackA, stackB))) {
      return false;
    }
  }
  return true;
}

module.exports = equalArrays;

},{"./arraySome":225}],285:[function(require,module,exports){
/** `Object#toString` result references. */
var boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    numberTag = '[object Number]',
    regexpTag = '[object RegExp]',
    stringTag = '[object String]';

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag) {
  switch (tag) {
    case boolTag:
    case dateTag:
      // Coerce dates and booleans to numbers, dates to milliseconds and booleans
      // to `1` or `0` treating invalid dates coerced to `NaN` as not equal.
      return +object == +other;

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case numberTag:
      // Treat `NaN` vs. `NaN` as equal.
      return (object != +object)
        ? other != +other
        : object == +other;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings primitives and string
      // objects as equal. See https://es5.github.io/#x15.10.6.4 for more details.
      return object == (other + '');
  }
  return false;
}

module.exports = equalByTag;

},{}],286:[function(require,module,exports){
var keys = require('../object/keys');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparing values.
 * @param {boolean} [isLoose] Specify performing partial comparisons.
 * @param {Array} [stackA] Tracks traversed `value` objects.
 * @param {Array} [stackB] Tracks traversed `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, equalFunc, customizer, isLoose, stackA, stackB) {
  var objProps = keys(object),
      objLength = objProps.length,
      othProps = keys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isLoose) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isLoose ? key in other : hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  var skipCtor = isLoose;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key],
        result = customizer ? customizer(isLoose ? othValue : objValue, isLoose? objValue : othValue, key) : undefined;

    // Recursively compare objects (susceptible to call stack limits).
    if (!(result === undefined ? equalFunc(objValue, othValue, customizer, isLoose, stackA, stackB) : result)) {
      return false;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (!skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      return false;
    }
  }
  return true;
}

module.exports = equalObjects;

},{"../object/keys":329}],287:[function(require,module,exports){
var metaMap = require('./metaMap'),
    noop = require('../utility/noop');

/**
 * Gets metadata for `func`.
 *
 * @private
 * @param {Function} func The function to query.
 * @returns {*} Returns the metadata for `func`.
 */
var getData = !metaMap ? noop : function(func) {
  return metaMap.get(func);
};

module.exports = getData;

},{"../utility/noop":336,"./metaMap":305}],288:[function(require,module,exports){
var realNames = require('./realNames');

/**
 * Gets the name of `func`.
 *
 * @private
 * @param {Function} func The function to query.
 * @returns {string} Returns the function name.
 */
function getFuncName(func) {
  var result = (func.name + ''),
      array = realNames[result],
      length = array ? array.length : 0;

  while (length--) {
    var data = array[length],
        otherFunc = data.func;
    if (otherFunc == null || otherFunc == func) {
      return data.name;
    }
  }
  return result;
}

module.exports = getFuncName;

},{"./realNames":308}],289:[function(require,module,exports){
var baseProperty = require('./baseProperty');

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

module.exports = getLength;

},{"./baseProperty":254}],290:[function(require,module,exports){
var isStrictComparable = require('./isStrictComparable'),
    pairs = require('../object/pairs');

/**
 * Gets the propery names, values, and compare flags of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the match data of `object`.
 */
function getMatchData(object) {
  var result = pairs(object),
      length = result.length;

  while (length--) {
    result[length][2] = isStrictComparable(result[length][1]);
  }
  return result;
}

module.exports = getMatchData;

},{"../object/pairs":333,"./isStrictComparable":303}],291:[function(require,module,exports){
var isNative = require('../lang/isNative');

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

module.exports = getNative;

},{"../lang/isNative":321}],292:[function(require,module,exports){
/**
 * Gets the index at which the first occurrence of `NaN` is found in `array`.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {number} fromIndex The index to search from.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched `NaN`, else `-1`.
 */
function indexOfNaN(array, fromIndex, fromRight) {
  var length = array.length,
      index = fromIndex + (fromRight ? 0 : -1);

  while ((fromRight ? index-- : ++index < length)) {
    var other = array[index];
    if (other !== other) {
      return index;
    }
  }
  return -1;
}

module.exports = indexOfNaN;

},{}],293:[function(require,module,exports){
/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Initializes an array clone.
 *
 * @private
 * @param {Array} array The array to clone.
 * @returns {Array} Returns the initialized clone.
 */
function initCloneArray(array) {
  var length = array.length,
      result = new array.constructor(length);

  // Add array properties assigned by `RegExp#exec`.
  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
    result.index = array.index;
    result.input = array.input;
  }
  return result;
}

module.exports = initCloneArray;

},{}],294:[function(require,module,exports){
var bufferClone = require('./bufferClone');

/** `Object#toString` result references. */
var boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    numberTag = '[object Number]',
    regexpTag = '[object RegExp]',
    stringTag = '[object String]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to match `RegExp` flags from their coerced string values. */
var reFlags = /\w*$/;

/**
 * Initializes an object clone based on its `toStringTag`.
 *
 * **Note:** This function only supports cloning values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to clone.
 * @param {string} tag The `toStringTag` of the object to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneByTag(object, tag, isDeep) {
  var Ctor = object.constructor;
  switch (tag) {
    case arrayBufferTag:
      return bufferClone(object);

    case boolTag:
    case dateTag:
      return new Ctor(+object);

    case float32Tag: case float64Tag:
    case int8Tag: case int16Tag: case int32Tag:
    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
      var buffer = object.buffer;
      return new Ctor(isDeep ? bufferClone(buffer) : buffer, object.byteOffset, object.length);

    case numberTag:
    case stringTag:
      return new Ctor(object);

    case regexpTag:
      var result = new Ctor(object.source, reFlags.exec(object));
      result.lastIndex = object.lastIndex;
  }
  return result;
}

module.exports = initCloneByTag;

},{"./bufferClone":264}],295:[function(require,module,exports){
/**
 * Initializes an object clone.
 *
 * @private
 * @param {Object} object The object to clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneObject(object) {
  var Ctor = object.constructor;
  if (!(typeof Ctor == 'function' && Ctor instanceof Ctor)) {
    Ctor = Object;
  }
  return new Ctor;
}

module.exports = initCloneObject;

},{}],296:[function(require,module,exports){
var getLength = require('./getLength'),
    isLength = require('./isLength');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

module.exports = isArrayLike;

},{"./getLength":289,"./isLength":301}],297:[function(require,module,exports){
/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

module.exports = isIndex;

},{}],298:[function(require,module,exports){
var isArrayLike = require('./isArrayLike'),
    isIndex = require('./isIndex'),
    isObject = require('../lang/isObject');

/**
 * Checks if the provided arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    var other = object[index];
    return value === value ? (value === other) : (other !== other);
  }
  return false;
}

module.exports = isIterateeCall;

},{"../lang/isObject":323,"./isArrayLike":296,"./isIndex":297}],299:[function(require,module,exports){
var isArray = require('../lang/isArray'),
    toObject = require('./toObject');

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\n\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/;

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  var type = typeof value;
  if ((type == 'string' && reIsPlainProp.test(value)) || type == 'number') {
    return true;
  }
  if (isArray(value)) {
    return false;
  }
  var result = !reIsDeepProp.test(value);
  return result || (object != null && value in toObject(object));
}

module.exports = isKey;

},{"../lang/isArray":319,"./toObject":314}],300:[function(require,module,exports){
var LazyWrapper = require('./LazyWrapper'),
    getData = require('./getData'),
    getFuncName = require('./getFuncName'),
    lodash = require('../chain/lodash');

/**
 * Checks if `func` has a lazy counterpart.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` has a lazy counterpart, else `false`.
 */
function isLaziable(func) {
  var funcName = getFuncName(func),
      other = lodash[funcName];

  if (typeof other != 'function' || !(funcName in LazyWrapper.prototype)) {
    return false;
  }
  if (func === other) {
    return true;
  }
  var data = getData(other);
  return !!data && func === data[0];
}

module.exports = isLaziable;

},{"../chain/lodash":199,"./LazyWrapper":215,"./getData":287,"./getFuncName":288}],301:[function(require,module,exports){
/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;

},{}],302:[function(require,module,exports){
/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],303:[function(require,module,exports){
var isObject = require('../lang/isObject');

/**
 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` if suitable for strict
 *  equality comparisons, else `false`.
 */
function isStrictComparable(value) {
  return value === value && !isObject(value);
}

module.exports = isStrictComparable;

},{"../lang/isObject":323}],304:[function(require,module,exports){
var arrayCopy = require('./arrayCopy'),
    composeArgs = require('./composeArgs'),
    composeArgsRight = require('./composeArgsRight'),
    replaceHolders = require('./replaceHolders');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1,
    CURRY_BOUND_FLAG = 4,
    CURRY_FLAG = 8,
    ARY_FLAG = 128,
    REARG_FLAG = 256;

/** Used as the internal argument placeholder. */
var PLACEHOLDER = '__lodash_placeholder__';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMin = Math.min;

/**
 * Merges the function metadata of `source` into `data`.
 *
 * Merging metadata reduces the number of wrappers required to invoke a function.
 * This is possible because methods like `_.bind`, `_.curry`, and `_.partial`
 * may be applied regardless of execution order. Methods like `_.ary` and `_.rearg`
 * augment function arguments, making the order in which they are executed important,
 * preventing the merging of metadata. However, we make an exception for a safe
 * common case where curried functions have `_.ary` and or `_.rearg` applied.
 *
 * @private
 * @param {Array} data The destination metadata.
 * @param {Array} source The source metadata.
 * @returns {Array} Returns `data`.
 */
function mergeData(data, source) {
  var bitmask = data[1],
      srcBitmask = source[1],
      newBitmask = bitmask | srcBitmask,
      isCommon = newBitmask < ARY_FLAG;

  var isCombo =
    (srcBitmask == ARY_FLAG && bitmask == CURRY_FLAG) ||
    (srcBitmask == ARY_FLAG && bitmask == REARG_FLAG && data[7].length <= source[8]) ||
    (srcBitmask == (ARY_FLAG | REARG_FLAG) && bitmask == CURRY_FLAG);

  // Exit early if metadata can't be merged.
  if (!(isCommon || isCombo)) {
    return data;
  }
  // Use source `thisArg` if available.
  if (srcBitmask & BIND_FLAG) {
    data[2] = source[2];
    // Set when currying a bound function.
    newBitmask |= (bitmask & BIND_FLAG) ? 0 : CURRY_BOUND_FLAG;
  }
  // Compose partial arguments.
  var value = source[3];
  if (value) {
    var partials = data[3];
    data[3] = partials ? composeArgs(partials, value, source[4]) : arrayCopy(value);
    data[4] = partials ? replaceHolders(data[3], PLACEHOLDER) : arrayCopy(source[4]);
  }
  // Compose partial right arguments.
  value = source[5];
  if (value) {
    partials = data[5];
    data[5] = partials ? composeArgsRight(partials, value, source[6]) : arrayCopy(value);
    data[6] = partials ? replaceHolders(data[5], PLACEHOLDER) : arrayCopy(source[6]);
  }
  // Use source `argPos` if available.
  value = source[7];
  if (value) {
    data[7] = arrayCopy(value);
  }
  // Use source `ary` if it's smaller.
  if (srcBitmask & ARY_FLAG) {
    data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
  }
  // Use source `arity` if one is not provided.
  if (data[9] == null) {
    data[9] = source[9];
  }
  // Use source `func` and merge bitmasks.
  data[0] = source[0];
  data[1] = newBitmask;

  return data;
}

module.exports = mergeData;

},{"./arrayCopy":218,"./composeArgs":268,"./composeArgsRight":269,"./replaceHolders":310}],305:[function(require,module,exports){
(function (global){
var getNative = require('./getNative');

/** Native method references. */
var WeakMap = getNative(global, 'WeakMap');

/** Used to store function metadata. */
var metaMap = WeakMap && new WeakMap;

module.exports = metaMap;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./getNative":291}],306:[function(require,module,exports){
var toObject = require('./toObject');

/**
 * A specialized version of `_.pick` which picks `object` properties specified
 * by `props`.
 *
 * @private
 * @param {Object} object The source object.
 * @param {string[]} props The property names to pick.
 * @returns {Object} Returns the new object.
 */
function pickByArray(object, props) {
  object = toObject(object);

  var index = -1,
      length = props.length,
      result = {};

  while (++index < length) {
    var key = props[index];
    if (key in object) {
      result[key] = object[key];
    }
  }
  return result;
}

module.exports = pickByArray;

},{"./toObject":314}],307:[function(require,module,exports){
var baseForIn = require('./baseForIn');

/**
 * A specialized version of `_.pick` which picks `object` properties `predicate`
 * returns truthy for.
 *
 * @private
 * @param {Object} object The source object.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Object} Returns the new object.
 */
function pickByCallback(object, predicate) {
  var result = {};
  baseForIn(object, function(value, key, object) {
    if (predicate(value, key, object)) {
      result[key] = value;
    }
  });
  return result;
}

module.exports = pickByCallback;

},{"./baseForIn":241}],308:[function(require,module,exports){
/** Used to lookup unminified function names. */
var realNames = {};

module.exports = realNames;

},{}],309:[function(require,module,exports){
var arrayCopy = require('./arrayCopy'),
    isIndex = require('./isIndex');

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMin = Math.min;

/**
 * Reorder `array` according to the specified indexes where the element at
 * the first index is assigned as the first element, the element at
 * the second index is assigned as the second element, and so on.
 *
 * @private
 * @param {Array} array The array to reorder.
 * @param {Array} indexes The arranged array indexes.
 * @returns {Array} Returns `array`.
 */
function reorder(array, indexes) {
  var arrLength = array.length,
      length = nativeMin(indexes.length, arrLength),
      oldArray = arrayCopy(array);

  while (length--) {
    var index = indexes[length];
    array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
  }
  return array;
}

module.exports = reorder;

},{"./arrayCopy":218,"./isIndex":297}],310:[function(require,module,exports){
/** Used as the internal argument placeholder. */
var PLACEHOLDER = '__lodash_placeholder__';

/**
 * Replaces all `placeholder` elements in `array` with an internal placeholder
 * and returns an array of their indexes.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {*} placeholder The placeholder to replace.
 * @returns {Array} Returns the new array of placeholder indexes.
 */
function replaceHolders(array, placeholder) {
  var index = -1,
      length = array.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    if (array[index] === placeholder) {
      array[index] = PLACEHOLDER;
      result[++resIndex] = index;
    }
  }
  return result;
}

module.exports = replaceHolders;

},{}],311:[function(require,module,exports){
var baseSetData = require('./baseSetData'),
    now = require('../date/now');

/** Used to detect when a function becomes hot. */
var HOT_COUNT = 150,
    HOT_SPAN = 16;

/**
 * Sets metadata for `func`.
 *
 * **Note:** If this function becomes hot, i.e. is invoked a lot in a short
 * period of time, it will trip its breaker and transition to an identity function
 * to avoid garbage collection pauses in V8. See [V8 issue 2070](https://code.google.com/p/v8/issues/detail?id=2070)
 * for more details.
 *
 * @private
 * @param {Function} func The function to associate metadata with.
 * @param {*} data The metadata.
 * @returns {Function} Returns `func`.
 */
var setData = (function() {
  var count = 0,
      lastCalled = 0;

  return function(key, value) {
    var stamp = now(),
        remaining = HOT_SPAN - (stamp - lastCalled);

    lastCalled = stamp;
    if (remaining > 0) {
      if (++count >= HOT_COUNT) {
        return key;
      }
    } else {
      count = 0;
    }
    return baseSetData(key, value);
  };
}());

module.exports = setData;

},{"../date/now":211,"./baseSetData":257}],312:[function(require,module,exports){
var isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isIndex = require('./isIndex'),
    isLength = require('./isLength'),
    keysIn = require('../object/keysIn');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A fallback implementation of `Object.keys` which creates an array of the
 * own enumerable property names of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function shimKeys(object) {
  var props = keysIn(object),
      propsLength = props.length,
      length = propsLength && object.length;

  var allowIndexes = !!length && isLength(length) &&
    (isArray(object) || isArguments(object));

  var index = -1,
      result = [];

  while (++index < propsLength) {
    var key = props[index];
    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
      result.push(key);
    }
  }
  return result;
}

module.exports = shimKeys;

},{"../lang/isArguments":318,"../lang/isArray":319,"../object/keysIn":330,"./isIndex":297,"./isLength":301}],313:[function(require,module,exports){
/**
 * An implementation of `_.uniq` optimized for sorted arrays without support
 * for callback shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Function} [iteratee] The function invoked per iteration.
 * @returns {Array} Returns the new duplicate free array.
 */
function sortedUniq(array, iteratee) {
  var seen,
      index = -1,
      length = array.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    var value = array[index],
        computed = iteratee ? iteratee(value, index, array) : value;

    if (!index || seen !== computed) {
      seen = computed;
      result[++resIndex] = value;
    }
  }
  return result;
}

module.exports = sortedUniq;

},{}],314:[function(require,module,exports){
var isObject = require('../lang/isObject');

/**
 * Converts `value` to an object if it's not one.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {Object} Returns the object.
 */
function toObject(value) {
  return isObject(value) ? value : Object(value);
}

module.exports = toObject;

},{"../lang/isObject":323}],315:[function(require,module,exports){
var baseToString = require('./baseToString'),
    isArray = require('../lang/isArray');

/** Used to match property names within property paths. */
var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\n\\]|\\.)*?)\2)\]/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/**
 * Converts `value` to property path array if it's not one.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {Array} Returns the property path array.
 */
function toPath(value) {
  if (isArray(value)) {
    return value;
  }
  var result = [];
  baseToString(value).replace(rePropName, function(match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
}

module.exports = toPath;

},{"../lang/isArray":319,"./baseToString":261}],316:[function(require,module,exports){
var LazyWrapper = require('./LazyWrapper'),
    LodashWrapper = require('./LodashWrapper'),
    arrayCopy = require('./arrayCopy');

/**
 * Creates a clone of `wrapper`.
 *
 * @private
 * @param {Object} wrapper The wrapper to clone.
 * @returns {Object} Returns the cloned wrapper.
 */
function wrapperClone(wrapper) {
  return wrapper instanceof LazyWrapper
    ? wrapper.clone()
    : new LodashWrapper(wrapper.__wrapped__, wrapper.__chain__, arrayCopy(wrapper.__actions__));
}

module.exports = wrapperClone;

},{"./LazyWrapper":215,"./LodashWrapper":216,"./arrayCopy":218}],317:[function(require,module,exports){
var baseClone = require('../internal/baseClone'),
    bindCallback = require('../internal/bindCallback'),
    isIterateeCall = require('../internal/isIterateeCall');

/**
 * Creates a clone of `value`. If `isDeep` is `true` nested objects are cloned,
 * otherwise they are assigned by reference. If `customizer` is provided it's
 * invoked to produce the cloned values. If `customizer` returns `undefined`
 * cloning is handled by the method instead. The `customizer` is bound to
 * `thisArg` and invoked with up to three argument; (value [, index|key, object]).
 *
 * **Note:** This method is loosely based on the
 * [structured clone algorithm](http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm).
 * The enumerable properties of `arguments` objects and objects created by
 * constructors other than `Object` are cloned to plain `Object` objects. An
 * empty object is returned for uncloneable values such as functions, DOM nodes,
 * Maps, Sets, and WeakMaps.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @param {Function} [customizer] The function to customize cloning values.
 * @param {*} [thisArg] The `this` binding of `customizer`.
 * @returns {*} Returns the cloned value.
 * @example
 *
 * var users = [
 *   { 'user': 'barney' },
 *   { 'user': 'fred' }
 * ];
 *
 * var shallow = _.clone(users);
 * shallow[0] === users[0];
 * // => true
 *
 * var deep = _.clone(users, true);
 * deep[0] === users[0];
 * // => false
 *
 * // using a customizer callback
 * var el = _.clone(document.body, function(value) {
 *   if (_.isElement(value)) {
 *     return value.cloneNode(false);
 *   }
 * });
 *
 * el === document.body
 * // => false
 * el.nodeName
 * // => BODY
 * el.childNodes.length;
 * // => 0
 */
function clone(value, isDeep, customizer, thisArg) {
  if (isDeep && typeof isDeep != 'boolean' && isIterateeCall(value, isDeep, customizer)) {
    isDeep = false;
  }
  else if (typeof isDeep == 'function') {
    thisArg = customizer;
    customizer = isDeep;
    isDeep = false;
  }
  return typeof customizer == 'function'
    ? baseClone(value, isDeep, bindCallback(customizer, thisArg, 3))
    : baseClone(value, isDeep);
}

module.exports = clone;

},{"../internal/baseClone":229,"../internal/bindCallback":263,"../internal/isIterateeCall":298}],318:[function(require,module,exports){
var isArrayLike = require('../internal/isArrayLike'),
    isObjectLike = require('../internal/isObjectLike');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Native method references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is classified as an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  return isObjectLike(value) && isArrayLike(value) &&
    hasOwnProperty.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
}

module.exports = isArguments;

},{"../internal/isArrayLike":296,"../internal/isObjectLike":302}],319:[function(require,module,exports){
var getNative = require('../internal/getNative'),
    isLength = require('../internal/isLength'),
    isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var arrayTag = '[object Array]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

module.exports = isArray;

},{"../internal/getNative":291,"../internal/isLength":301,"../internal/isObjectLike":302}],320:[function(require,module,exports){
var isObject = require('./isObject');

/** `Object#toString` result references. */
var funcTag = '[object Function]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 which returns 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

module.exports = isFunction;

},{"./isObject":323}],321:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isObjectLike = require('../internal/isObjectLike');

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isNative;

},{"../internal/isObjectLike":302,"./isFunction":320}],322:[function(require,module,exports){
var isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var numberTag = '[object Number]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Number` primitive or object.
 *
 * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are classified
 * as numbers, use the `_.isFinite` method.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isNumber(8.4);
 * // => true
 *
 * _.isNumber(NaN);
 * // => true
 *
 * _.isNumber('8.4');
 * // => false
 */
function isNumber(value) {
  return typeof value == 'number' || (isObjectLike(value) && objToString.call(value) == numberTag);
}

module.exports = isNumber;

},{"../internal/isObjectLike":302}],323:[function(require,module,exports){
/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = isObject;

},{}],324:[function(require,module,exports){
var baseForIn = require('../internal/baseForIn'),
    isArguments = require('./isArguments'),
    isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * **Note:** This method assumes objects created by the `Object` constructor
 * have no inherited enumerable properties.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  var Ctor;

  // Exit early for non `Object` objects.
  if (!(isObjectLike(value) && objToString.call(value) == objectTag && !isArguments(value)) ||
      (!hasOwnProperty.call(value, 'constructor') && (Ctor = value.constructor, typeof Ctor == 'function' && !(Ctor instanceof Ctor)))) {
    return false;
  }
  // IE < 9 iterates inherited properties before own properties. If the first
  // iterated property is an object's own property then there are no inherited
  // enumerable properties.
  var result;
  // In most environments an object's own properties are iterated before
  // its inherited properties. If the last iterated property is an object's
  // own property then there are no inherited enumerable properties.
  baseForIn(value, function(subValue, key) {
    result = key;
  });
  return result === undefined || hasOwnProperty.call(value, result);
}

module.exports = isPlainObject;

},{"../internal/baseForIn":241,"../internal/isObjectLike":302,"./isArguments":318}],325:[function(require,module,exports){
var isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var stringTag = '[object String]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' || (isObjectLike(value) && objToString.call(value) == stringTag);
}

module.exports = isString;

},{"../internal/isObjectLike":302}],326:[function(require,module,exports){
var isLength = require('../internal/isLength'),
    isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dateTag] = typedArrayTags[errorTag] =
typedArrayTags[funcTag] = typedArrayTags[mapTag] =
typedArrayTags[numberTag] = typedArrayTags[objectTag] =
typedArrayTags[regexpTag] = typedArrayTags[setTag] =
typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
function isTypedArray(value) {
  return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[objToString.call(value)];
}

module.exports = isTypedArray;

},{"../internal/isLength":301,"../internal/isObjectLike":302}],327:[function(require,module,exports){
var baseCopy = require('../internal/baseCopy'),
    keysIn = require('../object/keysIn');

/**
 * Converts `value` to a plain object flattening inherited enumerable
 * properties of `value` to own properties of the plain object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {Object} Returns the converted plain object.
 * @example
 *
 * function Foo() {
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.assign({ 'a': 1 }, new Foo);
 * // => { 'a': 1, 'b': 2 }
 *
 * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
 * // => { 'a': 1, 'b': 2, 'c': 3 }
 */
function toPlainObject(value) {
  return baseCopy(value, keysIn(value));
}

module.exports = toPlainObject;

},{"../internal/baseCopy":231,"../object/keysIn":330}],328:[function(require,module,exports){
var assignWith = require('../internal/assignWith'),
    baseAssign = require('../internal/baseAssign'),
    createAssigner = require('../internal/createAssigner');

/**
 * Assigns own enumerable properties of source object(s) to the destination
 * object. Subsequent sources overwrite property assignments of previous sources.
 * If `customizer` is provided it's invoked to produce the assigned values.
 * The `customizer` is bound to `thisArg` and invoked with five arguments:
 * (objectValue, sourceValue, key, object, source).
 *
 * **Note:** This method mutates `object` and is based on
 * [`Object.assign`](http://ecma-international.org/ecma-262/6.0/#sec-object.assign).
 *
 * @static
 * @memberOf _
 * @alias extend
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @param {Function} [customizer] The function to customize assigned values.
 * @param {*} [thisArg] The `this` binding of `customizer`.
 * @returns {Object} Returns `object`.
 * @example
 *
 * _.assign({ 'user': 'barney' }, { 'age': 40 }, { 'user': 'fred' });
 * // => { 'user': 'fred', 'age': 40 }
 *
 * // using a customizer callback
 * var defaults = _.partialRight(_.assign, function(value, other) {
 *   return _.isUndefined(value) ? other : value;
 * });
 *
 * defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
 * // => { 'user': 'barney', 'age': 36 }
 */
var assign = createAssigner(function(object, source, customizer) {
  return customizer
    ? assignWith(object, source, customizer)
    : baseAssign(object, source);
});

module.exports = assign;

},{"../internal/assignWith":226,"../internal/baseAssign":227,"../internal/createAssigner":271}],329:[function(require,module,exports){
var getNative = require('../internal/getNative'),
    isArrayLike = require('../internal/isArrayLike'),
    isObject = require('../lang/isObject'),
    shimKeys = require('../internal/shimKeys');

/* Native method references for those with the same name as other `lodash` methods. */
var nativeKeys = getNative(Object, 'keys');

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
var keys = !nativeKeys ? shimKeys : function(object) {
  var Ctor = object == null ? undefined : object.constructor;
  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
      (typeof object != 'function' && isArrayLike(object))) {
    return shimKeys(object);
  }
  return isObject(object) ? nativeKeys(object) : [];
};

module.exports = keys;

},{"../internal/getNative":291,"../internal/isArrayLike":296,"../internal/shimKeys":312,"../lang/isObject":323}],330:[function(require,module,exports){
var isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isIndex = require('../internal/isIndex'),
    isLength = require('../internal/isLength'),
    isObject = require('../lang/isObject');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keysIn;

},{"../internal/isIndex":297,"../internal/isLength":301,"../lang/isArguments":318,"../lang/isArray":319,"../lang/isObject":323}],331:[function(require,module,exports){
var baseMerge = require('../internal/baseMerge'),
    createAssigner = require('../internal/createAssigner');

/**
 * Recursively merges own enumerable properties of the source object(s), that
 * don't resolve to `undefined` into the destination object. Subsequent sources
 * overwrite property assignments of previous sources. If `customizer` is
 * provided it's invoked to produce the merged values of the destination and
 * source properties. If `customizer` returns `undefined` merging is handled
 * by the method instead. The `customizer` is bound to `thisArg` and invoked
 * with five arguments: (objectValue, sourceValue, key, object, source).
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @param {Function} [customizer] The function to customize assigned values.
 * @param {*} [thisArg] The `this` binding of `customizer`.
 * @returns {Object} Returns `object`.
 * @example
 *
 * var users = {
 *   'data': [{ 'user': 'barney' }, { 'user': 'fred' }]
 * };
 *
 * var ages = {
 *   'data': [{ 'age': 36 }, { 'age': 40 }]
 * };
 *
 * _.merge(users, ages);
 * // => { 'data': [{ 'user': 'barney', 'age': 36 }, { 'user': 'fred', 'age': 40 }] }
 *
 * // using a customizer callback
 * var object = {
 *   'fruits': ['apple'],
 *   'vegetables': ['beet']
 * };
 *
 * var other = {
 *   'fruits': ['banana'],
 *   'vegetables': ['carrot']
 * };
 *
 * _.merge(object, other, function(a, b) {
 *   if (_.isArray(a)) {
 *     return a.concat(b);
 *   }
 * });
 * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot'] }
 */
var merge = createAssigner(baseMerge);

module.exports = merge;

},{"../internal/baseMerge":252,"../internal/createAssigner":271}],332:[function(require,module,exports){
var arrayMap = require('../internal/arrayMap'),
    baseDifference = require('../internal/baseDifference'),
    baseFlatten = require('../internal/baseFlatten'),
    bindCallback = require('../internal/bindCallback'),
    keysIn = require('./keysIn'),
    pickByArray = require('../internal/pickByArray'),
    pickByCallback = require('../internal/pickByCallback'),
    restParam = require('../function/restParam');

/**
 * The opposite of `_.pick`; this method creates an object composed of the
 * own and inherited enumerable properties of `object` that are not omitted.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The source object.
 * @param {Function|...(string|string[])} [predicate] The function invoked per
 *  iteration or property names to omit, specified as individual property
 *  names or arrays of property names.
 * @param {*} [thisArg] The `this` binding of `predicate`.
 * @returns {Object} Returns the new object.
 * @example
 *
 * var object = { 'user': 'fred', 'age': 40 };
 *
 * _.omit(object, 'age');
 * // => { 'user': 'fred' }
 *
 * _.omit(object, _.isNumber);
 * // => { 'user': 'fred' }
 */
var omit = restParam(function(object, props) {
  if (object == null) {
    return {};
  }
  if (typeof props[0] != 'function') {
    var props = arrayMap(baseFlatten(props), String);
    return pickByArray(object, baseDifference(keysIn(object), props));
  }
  var predicate = bindCallback(props[0], props[1], 3);
  return pickByCallback(object, function(value, key, object) {
    return !predicate(value, key, object);
  });
});

module.exports = omit;

},{"../function/restParam":214,"../internal/arrayMap":222,"../internal/baseDifference":233,"../internal/baseFlatten":239,"../internal/bindCallback":263,"../internal/pickByArray":306,"../internal/pickByCallback":307,"./keysIn":330}],333:[function(require,module,exports){
var keys = require('./keys'),
    toObject = require('../internal/toObject');

/**
 * Creates a two dimensional array of the key-value pairs for `object`,
 * e.g. `[[key1, value1], [key2, value2]]`.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the new array of key-value pairs.
 * @example
 *
 * _.pairs({ 'barney': 36, 'fred': 40 });
 * // => [['barney', 36], ['fred', 40]] (iteration order is not guaranteed)
 */
function pairs(object) {
  object = toObject(object);

  var index = -1,
      props = keys(object),
      length = props.length,
      result = Array(length);

  while (++index < length) {
    var key = props[index];
    result[index] = [key, object[key]];
  }
  return result;
}

module.exports = pairs;

},{"../internal/toObject":314,"./keys":329}],334:[function(require,module,exports){
var baseFlatten = require('../internal/baseFlatten'),
    bindCallback = require('../internal/bindCallback'),
    pickByArray = require('../internal/pickByArray'),
    pickByCallback = require('../internal/pickByCallback'),
    restParam = require('../function/restParam');

/**
 * Creates an object composed of the picked `object` properties. Property
 * names may be specified as individual arguments or as arrays of property
 * names. If `predicate` is provided it's invoked for each property of `object`
 * picking the properties `predicate` returns truthy for. The predicate is
 * bound to `thisArg` and invoked with three arguments: (value, key, object).
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The source object.
 * @param {Function|...(string|string[])} [predicate] The function invoked per
 *  iteration or property names to pick, specified as individual property
 *  names or arrays of property names.
 * @param {*} [thisArg] The `this` binding of `predicate`.
 * @returns {Object} Returns the new object.
 * @example
 *
 * var object = { 'user': 'fred', 'age': 40 };
 *
 * _.pick(object, 'user');
 * // => { 'user': 'fred' }
 *
 * _.pick(object, _.isString);
 * // => { 'user': 'fred' }
 */
var pick = restParam(function(object, props) {
  if (object == null) {
    return {};
  }
  return typeof props[0] == 'function'
    ? pickByCallback(object, bindCallback(props[0], props[1], 3))
    : pickByArray(object, baseFlatten(props));
});

module.exports = pick;

},{"../function/restParam":214,"../internal/baseFlatten":239,"../internal/bindCallback":263,"../internal/pickByArray":306,"../internal/pickByCallback":307}],335:[function(require,module,exports){
/**
 * This method returns the first argument provided to it.
 *
 * @static
 * @memberOf _
 * @category Utility
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = identity;

},{}],336:[function(require,module,exports){
/**
 * A no-operation function that returns `undefined` regardless of the
 * arguments it receives.
 *
 * @static
 * @memberOf _
 * @category Utility
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.noop(object) === undefined;
 * // => true
 */
function noop() {
  // No operation performed.
}

module.exports = noop;

},{}],337:[function(require,module,exports){
var baseProperty = require('../internal/baseProperty'),
    basePropertyDeep = require('../internal/basePropertyDeep'),
    isKey = require('../internal/isKey');

/**
 * Creates a function that returns the property value at `path` on a
 * given object.
 *
 * @static
 * @memberOf _
 * @category Utility
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var objects = [
 *   { 'a': { 'b': { 'c': 2 } } },
 *   { 'a': { 'b': { 'c': 1 } } }
 * ];
 *
 * _.map(objects, _.property('a.b.c'));
 * // => [2, 1]
 *
 * _.pluck(_.sortBy(objects, _.property(['a', 'b', 'c'])), 'a.b.c');
 * // => [1, 2]
 */
function property(path) {
  return isKey(path) ? baseProperty(path) : basePropertyDeep(path);
}

module.exports = property;

},{"../internal/baseProperty":254,"../internal/basePropertyDeep":255,"../internal/isKey":299}],338:[function(require,module,exports){
/**
 * Set attribute `name` to `val`, or get attr `name`.
 *
 * @param {Element} el
 * @param {String} name
 * @param {String} [val]
 * @api public
 */

module.exports = function(el, name, val) {
  // get
  if (arguments.length == 2) {
    return el.getAttribute(name);
  }

  // remove
  if (val === null) {
    return el.removeAttribute(name);
  }

  // set
  el.setAttribute(name, val);

  return el;
};
},{}],339:[function(require,module,exports){
module.exports = require('component-classes');
},{"component-classes":46}],340:[function(require,module,exports){
module.exports = function(el) {

  var c;

  while (el.childNodes.length) {
    c = el.childNodes[0];
    el.removeChild(c);
  }

  return el;
};
},{}],341:[function(require,module,exports){
module.exports = require('component-closest');
},{"component-closest":47}],342:[function(require,module,exports){
module.exports = require('component-delegate');
},{"component-delegate":48}],343:[function(require,module,exports){
module.exports = require('domify');
},{"domify":187}],344:[function(require,module,exports){
module.exports = require('component-event');
},{"component-event":49}],345:[function(require,module,exports){
module.exports = require('component-matches-selector');
},{"component-matches-selector":51}],346:[function(require,module,exports){
module.exports = require('component-query');
},{"component-query":52}],347:[function(require,module,exports){
module.exports = function(el) {
  el.parentNode && el.parentNode.removeChild(el);
};
},{}],348:[function(require,module,exports){
module.exports = require('./lib/refs');

module.exports.Collection = require('./lib/collection');
},{"./lib/collection":349,"./lib/refs":350}],349:[function(require,module,exports){
'use strict';

/**
 * An empty collection stub. Use {@link RefsCollection.extend} to extend a
 * collection with ref semantics.
 *
 * @class RefsCollection
 */

/**
 * Extends a collection with {@link Refs} aware methods
 *
 * @memberof RefsCollection
 * @static
 *
 * @param  {Array<Object>} collection
 * @param  {Refs} refs instance
 * @param  {Object} property represented by the collection
 * @param  {Object} target object the collection is attached to
 *
 * @return {RefsCollection<Object>} the extended array
 */
function extend(collection, refs, property, target) {

  var inverseProperty = property.inverse;

  /**
   * Removes the given element from the array and returns it.
   *
   * @method RefsCollection#remove
   *
   * @param {Object} element the element to remove
   */
  Object.defineProperty(collection, 'remove', {
    value: function(element) {
      var idx = this.indexOf(element);
      if (idx !== -1) {
        this.splice(idx, 1);

        // unset inverse
        refs.unset(element, inverseProperty, target);
      }

      return element;
    }
  });

  /**
   * Returns true if the collection contains the given element
   *
   * @method RefsCollection#contains
   *
   * @param {Object} element the element to check for
   */
  Object.defineProperty(collection, 'contains', {
    value: function(element) {
      return this.indexOf(element) !== -1;
    }
  });

  /**
   * Adds an element to the array, unless it exists already (set semantics).
   *
   * @method RefsCollection#add
   *
   * @param {Object} element the element to add
   */
  Object.defineProperty(collection, 'add', {
    value: function(element) {

      if (!this.contains(element)) {
        this.push(element);

        // set inverse
        refs.set(element, inverseProperty, target);
      }
    }
  });

  // a simple marker, identifying this element
  // as being a refs collection
  Object.defineProperty(collection, '__refs_collection', {
    value: true
  });

  return collection;
}


function isExtended(collection) {
  return collection.__refs_collection === true;
}

module.exports.extend = extend;

module.exports.isExtended = isExtended;
},{}],350:[function(require,module,exports){
'use strict';

var Collection = require('./collection');

function hasOwnProperty(e, property) {
  return Object.prototype.hasOwnProperty.call(e, property.name || property);
}

function defineCollectionProperty(ref, property, target) {
  Object.defineProperty(target, property.name, {
    enumerable: property.enumerable,
    value: Collection.extend(target[property.name] || [], ref, property, target)
  });
}


function defineProperty(ref, property, target) {

  var inverseProperty = property.inverse;

  var _value = target[property.name];

  Object.defineProperty(target, property.name, {
    enumerable: property.enumerable,

    get: function() {
      return _value;
    },

    set: function(value) {

      // return if we already performed all changes
      if (value === _value) {
        return;
      }

      var old = _value;

      // temporary set null
      _value = null;

      if (old) {
        ref.unset(old, inverseProperty, target);
      }

      // set new value
      _value = value;

      // set inverse value
      ref.set(_value, inverseProperty, target);
    }
  });

}

/**
 * Creates a new references object defining two inversly related
 * attribute descriptors a and b.
 *
 * <p>
 *   When bound to an object using {@link Refs#bind} the references
 *   get activated and ensure that add and remove operations are applied
 *   reversely, too.
 * </p>
 *
 * <p>
 *   For attributes represented as collections {@link Refs} provides the
 *   {@link RefsCollection#add}, {@link RefsCollection#remove} and {@link RefsCollection#contains} extensions
 *   that must be used to properly hook into the inverse change mechanism.
 * </p>
 *
 * @class Refs
 *
 * @classdesc A bi-directional reference between two attributes.
 *
 * @param {Refs.AttributeDescriptor} a property descriptor
 * @param {Refs.AttributeDescriptor} b property descriptor
 *
 * @example
 *
 * var refs = Refs({ name: 'wheels', collection: true, enumerable: true }, { name: 'car' });
 *
 * var car = { name: 'toyota' };
 * var wheels = [{ pos: 'front-left' }, { pos: 'front-right' }];
 *
 * refs.bind(car, 'wheels');
 *
 * car.wheels // []
 * car.wheels.add(wheels[0]);
 * car.wheels.add(wheels[1]);
 *
 * car.wheels // [{ pos: 'front-left' }, { pos: 'front-right' }]
 *
 * wheels[0].car // { name: 'toyota' };
 * car.wheels.remove(wheels[0]);
 *
 * wheels[0].car // undefined
 */
function Refs(a, b) {

  if (!(this instanceof Refs)) {
    return new Refs(a, b);
  }

  // link
  a.inverse = b;
  b.inverse = a;

  this.props = {};
  this.props[a.name] = a;
  this.props[b.name] = b;
}

/**
 * Binds one side of a bi-directional reference to a
 * target object.
 *
 * @memberOf Refs
 *
 * @param  {Object} target
 * @param  {String} property
 */
Refs.prototype.bind = function(target, property) {
  if (typeof property === 'string') {
    if (!this.props[property]) {
      throw new Error('no property <' + property + '> in ref');
    }
    property = this.props[property];
  }

  if (property.collection) {
    defineCollectionProperty(this, property, target);
  } else {
    defineProperty(this, property, target);
  }
};

Refs.prototype.ensureRefsCollection = function(target, property) {

  var collection = target[property.name];

  if (!Collection.isExtended(collection)) {
    defineCollectionProperty(this, property, target);
  }

  return collection;
};

Refs.prototype.ensureBound = function(target, property) {
  if (!hasOwnProperty(target, property)) {
    this.bind(target, property);
  }
};

Refs.prototype.unset = function(target, property, value) {

  if (target) {
    this.ensureBound(target, property);

    if (property.collection) {
      this.ensureRefsCollection(target, property).remove(value);
    } else {
      target[property.name] = undefined;
    }
  }
};

Refs.prototype.set = function(target, property, value) {

  if (target) {
    this.ensureBound(target, property);

    if (property.collection) {
      this.ensureRefsCollection(target, property).add(value);
    } else {
      target[property.name] = value;
    }
  }
};

module.exports = Refs;


/**
 * An attribute descriptor to be used specify an attribute in a {@link Refs} instance
 *
 * @typedef {Object} Refs.AttributeDescriptor
 * @property {String} name
 * @property {boolean} [collection=false]
 * @property {boolean} [enumerable=false]
 */
},{"./collection":349}],351:[function(require,module,exports){
/**
 * append utility
 */

module.exports = append;

var appendTo = require('./appendTo');

/**
 * Append a node to an element
 *
 * @param  {SVGElement} element
 * @param  {SVGElement} node
 *
 * @return {SVGElement} the element
 */
function append(element, node) {
  appendTo(node, element);
  return element;
}
},{"./appendTo":352}],352:[function(require,module,exports){
/**
 * appendTo utility
 */
module.exports = appendTo;

var ensureImported = require('./util/ensureImported');

/**
 * Append a node to a target element and return the appended node.
 *
 * @param  {SVGElement} element
 * @param  {SVGElement} node
 *
 * @return {SVGElement} the appended node
 */
function appendTo(element, target) {
  target.appendChild(ensureImported(element, target));
  return element;
}
},{"./util/ensureImported":361}],353:[function(require,module,exports){
/**
 * attribute accessor utility
 */

module.exports = attr;


var LENGTH_ATTR = 2;

var CSS_PROPERTIES = {
  'alignment-baseline': 1,
  'baseline-shift': 1,
  'clip': 1,
  'clip-path': 1,
  'clip-rule': 1,
  'color': 1,
  'color-interpolation': 1,
  'color-interpolation-filters': 1,
  'color-profile': 1,
  'color-rendering': 1,
  'cursor': 1,
  'direction': 1,
  'display': 1,
  'dominant-baseline': 1,
  'enable-background': 1,
  'fill': 1,
  'fill-opacity': 1,
  'fill-rule': 1,
  'filter': 1,
  'flood-color': 1,
  'flood-opacity': 1,
  'font': 1,
  'font-family': 1,
  'font-size': LENGTH_ATTR,
  'font-size-adjust': 1,
  'font-stretch': 1,
  'font-style': 1,
  'font-variant': 1,
  'font-weight': 1,
  'glyph-orientation-horizontal': 1,
  'glyph-orientation-vertical': 1,
  'image-rendering': 1,
  'kerning': 1,
  'letter-spacing': 1,
  'lighting-color': 1,
  'marker': 1,
  'marker-end': 1,
  'marker-mid': 1,
  'marker-start': 1,
  'mask': 1,
  'opacity': 1,
  'overflow': 1,
  'pointer-events': 1,
  'shape-rendering': 1,
  'stop-color': 1,
  'stop-opacity': 1,
  'stroke': 1,
  'stroke-dasharray': 1,
  'stroke-dashoffset': 1,
  'stroke-linecap': 1,
  'stroke-linejoin': 1,
  'stroke-miterlimit': 1,
  'stroke-opacity': 1,
  'stroke-width': LENGTH_ATTR,
  'text-anchor': 1,
  'text-decoration': 1,
  'text-rendering': 1,
  'unicode-bidi': 1,
  'visibility': 1,
  'word-spacing': 1,
  'writing-mode': 1
};


function getAttribute(node, name) {
  if (CSS_PROPERTIES[name]) {
    return node.style[name];
  } else {
    return node.getAttributeNS(null, name);
  }
}

function setAttribute(node, name, value) {
  var hyphenated = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

  var type = CSS_PROPERTIES[hyphenated];

  if (type) {
    // append pixel unit, unless present
    if (type === LENGTH_ATTR && typeof value === 'number') {
      value = String(value) + 'px';
    }

    node.style[hyphenated] = value;
  } else {
    node.setAttributeNS(null, name, value);
  }
}

function setAttributes(node, attrs) {

  var names = Object.keys(attrs), i, name;

  for (i = 0, name; (name = names[i]); i++) {
    setAttribute(node, name, attrs[name]);
  }
}

/**
 * Gets or sets raw attributes on a node.
 *
 * @param  {SVGElement} node
 * @param  {Object} [attrs]
 * @param  {String} [name]
 * @param  {String} [value]
 *
 * @return {String}
 */
function attr(node, name, value) {
  if (typeof name === 'string') {
    if (value !== undefined) {
      setAttribute(node, name, value);
    } else {
      return getAttribute(node, name);
    }
  } else {
    setAttributes(node, name);
  }

  return node;
}

},{}],354:[function(require,module,exports){
/**
 * Clear utility
 */
module.exports = classes;

var index = function(arr, obj) {
  if (arr.indexOf) {
    return arr.indexOf(obj);
  }


  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) {
      return i;
    }
  }

  return -1;
};

var re = /\s+/;

var toString = Object.prototype.toString;

function defined(o) {
  return typeof o !== 'undefined';
}

/**
 * Wrap `el` in a `ClassList`.
 *
 * @param {Element} el
 * @return {ClassList}
 * @api public
 */

function classes(el) {
  return new ClassList(el);
}

function ClassList(el) {
  if (!el || !el.nodeType) {
    throw new Error('A DOM element reference is required');
  }
  this.el = el;
  this.list = el.classList;
}

/**
 * Add class `name` if not already present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.add = function(name) {

  // classList
  if (this.list) {
    this.list.add(name);
    return this;
  }

  // fallback
  var arr = this.array();
  var i = index(arr, name);
  if (!~i) {
    arr.push(name);
  }

  if (defined(this.el.className.baseVal)) {
    this.el.className.baseVal = arr.join(' ');
  } else {
    this.el.className = arr.join(' ');
  }

  return this;
};

/**
 * Remove class `name` when present, or
 * pass a regular expression to remove
 * any which match.
 *
 * @param {String|RegExp} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.remove = function(name) {
  if ('[object RegExp]' === toString.call(name)) {
    return this.removeMatching(name);
  }

  // classList
  if (this.list) {
    this.list.remove(name);
    return this;
  }

  // fallback
  var arr = this.array();
  var i = index(arr, name);
  if (~i) {
    arr.splice(i, 1);
  }
  this.el.className.baseVal = arr.join(' ');
  return this;
};

/**
 * Remove all classes matching `re`.
 *
 * @param {RegExp} re
 * @return {ClassList}
 * @api private
 */

ClassList.prototype.removeMatching = function(re) {
  var arr = this.array();
  for (var i = 0; i < arr.length; i++) {
    if (re.test(arr[i])) {
      this.remove(arr[i]);
    }
  }
  return this;
};

/**
 * Toggle class `name`, can force state via `force`.
 *
 * For browsers that support classList, but do not support `force` yet,
 * the mistake will be detected and corrected.
 *
 * @param {String} name
 * @param {Boolean} force
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.toggle = function(name, force) {
  // classList
  if (this.list) {
    if (defined(force)) {
      if (force !== this.list.toggle(name, force)) {
        this.list.toggle(name); // toggle again to correct
      }
    } else {
      this.list.toggle(name);
    }
    return this;
  }

  // fallback
  if (defined(force)) {
    if (!force) {
      this.remove(name);
    } else {
      this.add(name);
    }
  } else {
    if (this.has(name)) {
      this.remove(name);
    } else {
      this.add(name);
    }
  }

  return this;
};

/**
 * Return an array of classes.
 *
 * @return {Array}
 * @api public
 */

ClassList.prototype.array = function() {
  var className = this.el.getAttribute('class') || '';
  var str = className.replace(/^\s+|\s+$/g, '');
  var arr = str.split(re);
  if ('' === arr[0]) {
    arr.shift();
  }
  return arr;
};

/**
 * Check if class `name` is present.
 *
 * @param {String} name
 * @return {ClassList}
 * @api public
 */

ClassList.prototype.has =
ClassList.prototype.contains = function(name) {
  return (
    this.list ?
      this.list.contains(name) :
      !! ~index(this.array(), name)
  );
};

},{}],355:[function(require,module,exports){
/**
 * Clear utility
 */

module.exports = clear;


var remove = require('./remove');

/**
 * Removes all children from the given element
 *
 * @param  {DOMElement} element
 * @return {DOMElement} the element (for chaining)
 */
function clear(element) {
  var child;

  while ((child = element.firstChild)) {
    remove(child);
  }

  return element;
}
},{"./remove":359}],356:[function(require,module,exports){
module.exports = clone;

function clone(element) {
  return element.cloneNode(true);
}
},{}],357:[function(require,module,exports){
/**
 * Create utility for SVG elements
 */

module.exports = create;


var attr = require('./attr');
var parse = require('./util/parse');
var ns = require('./util/ns');


/**
 * Create a specific type from name or SVG markup.
 *
 * @param {String} name the name or markup of the element
 * @param {Object} [attrs] attributes to set on the element
 *
 * @returns {SVGElement}
 */
function create(name, attrs) {
  var element;

  if (name.charAt(0) === '<') {
    element = parse(name).firstChild;
    element = document.importNode(element, true);
  } else {
    element = document.createElementNS(ns.svg, name);
  }

  if (attrs) {
    attr(element, attrs);
  }

  return element;
}
},{"./attr":353,"./util/ns":362,"./util/parse":363}],358:[function(require,module,exports){
/**
 * Geometry helpers
 */

module.exports = { createPoint: createPoint, createMatrix: createMatrix, createTransform: createTransform };


var create = require('./create');

// fake node used to instantiate svg geometry elements
var node = create('svg');

function extend(object, props) {
  var i, k, keys = Object.keys(props);

  for (i = 0; (k = keys[i]); i++) {
    object[k] = props[k];
  }

  return object;
}


function createPoint(x, y) {
  var point = node.createSVGPoint();

  switch (arguments.length) {
  case 0:
    return point;
  case 2:
    x = {
      x: x,
      y: y
    };
    break;
  }

  return extend(point, x);
}

function createMatrix(a, b, c, d, e, f) {
  var matrix = node.createSVGMatrix();

  switch (arguments.length) {
  case 0:
    return matrix;
  case 6:
    a = {
      a: a,
      b: b,
      c: c,
      d: d,
      e: e,
      f: f
    };
    break;
  }

  return extend(matrix, a);
}

function createTransform(matrix) {
  if (matrix) {
    return node.createSVGTransformFromMatrix(matrix);
  } else {
    return node.createSVGTransform();
  }
}
},{"./create":357}],359:[function(require,module,exports){
module.exports = remove;

function remove(element) {
  element.parentNode.removeChild(element);
  return element;
}
},{}],360:[function(require,module,exports){
/**
 * transform accessor utility
 */

module.exports = transform;

function wrapMatrix(transformList, transform) {
  if (transform instanceof SVGMatrix) {
    return transformList.createSVGTransformFromMatrix(transform);
  } else {
    return transform;
  }
}

function setTransforms(transformList, transforms) {
  var i, t;

  transformList.clear();

  for (i = 0; (t = transforms[i]); i++) {
    transformList.appendItem(wrapMatrix(transformList, t));
  }

  transformList.consolidate();
}

function transform(node, transforms) {
  var transformList = node.transform.baseVal;

  if (arguments.length === 1) {
    return transformList.consolidate();
  } else {
    if (transforms.length) {
      setTransforms(transformList, transforms);
    } else {
      transformList.initialize(wrapMatrix(transformList, transforms));
    }
  }
}
},{}],361:[function(require,module,exports){
module.exports = ensureImported;

function ensureImported(element, target) {

  if (element.ownerDocument !== target.ownerDocument) {
    try {
      // may fail on webkit
      return target.ownerDocument.importNode(element, true);
    } catch (e) {
      // ignore
    }
  }

  return element;
}
},{}],362:[function(require,module,exports){
var ns = {
  svg: 'http://www.w3.org/2000/svg'
};

module.exports = ns;
},{}],363:[function(require,module,exports){
/**
 * DOM parsing utility
 */

module.exports = parse;


var ns = require('./ns');

var SVG_START = '<svg xmlns="' + ns.svg + '"';

function parse(svg) {

  // ensure we import a valid svg document
  if (svg.substring(0, 4) === '<svg') {
    if (svg.indexOf(ns.svg) === -1) {
      svg = SVG_START + svg.substring(4);
    }
  } else {
    // namespace svg
    svg = SVG_START + '>' + svg + '</svg>';
  }

  return parseDocument(svg);
}

function parseDocument(svg) {

  var parser;

  // parse
  parser = new DOMParser();
  parser.async = false;

  return parser.parseFromString(svg, 'text/xml');
}
},{"./ns":362}]},{},[1])(1)
});