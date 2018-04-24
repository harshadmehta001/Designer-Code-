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
