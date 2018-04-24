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