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

