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
