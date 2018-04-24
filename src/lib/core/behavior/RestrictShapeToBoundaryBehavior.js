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
