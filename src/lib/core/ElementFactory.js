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
