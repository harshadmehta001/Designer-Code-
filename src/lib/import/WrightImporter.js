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
