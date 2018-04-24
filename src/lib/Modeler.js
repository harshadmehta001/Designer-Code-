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
