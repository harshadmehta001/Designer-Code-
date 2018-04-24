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
