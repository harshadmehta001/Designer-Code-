'use strict';

/* global window */
var domify = require('min-dom/lib/domify');
var kendoInstance = window.kendo;
var jQuery = window.jQuery;

/**
 * A properties panel implementation.
 *
 * @param {Object} config
 * @param {EventBus} eventBus
 * @param {Modeling} modeling
 * @param {CommandStack} commandStack
 * @param {Canvas} canvas
 * @param {Model} model
 */
function PropertiesPanel(config, eventBus, modeling, commandStack, canvas, model) {
    this._eventBus = eventBus;
    this._modeling = modeling;
    this._commandStack = commandStack;
    this._canvas = canvas;
    this._model = model;
    this._element = null;
    this._parentInitialStateId = null;
    this._oldData = {};
    this._init();
}

PropertiesPanel.$inject = ['config.propertiesPanel', 'eventBus', 'modeling', 'commandStack', 'canvas', 'model'];

module.exports = PropertiesPanel;

PropertiesPanel.prototype._init = function () {
    var eventBus = this._eventBus;
    var self = this;

    eventBus.on('propertywindow.changed', function (e) {
        var newElement = e.element[0], parentNode;

        if (newElement) {
            parentNode = self._canvas._container.parentElement.parentNode;
            if (parentNode) {
                attachTo.call(self, parentNode);
                self._element = newElement;
                self._oldData = JSON.stringify(newElement.businessObject);
                update.call(self, newElement);
                self._propertyWindow.center();
                self._propertyWindow.open();
            } else {
                throw 'Not able to resolve parent node';
            }
        } else if (self._container) {
            detach.call(this);
        }
    });
};

function attachTo(parentNode) {
    var propertyWindow;
    this._container = domify('<div id="impactWrightPropertyEditor"></div>');
    parentNode.appendChild(this._container);

    propertyWindow = jQuery('#impactWrightPropertyEditor')
        .kendoWindow({
            iframe: true,
            title: 'Edit Properties',
            resizable: true,
            draggable: true,
            modal: true
        })
        .data('kendoWindow');

    this._propertyWindow = propertyWindow;

    this._emit('attach');
}

function detach() {
    var container = this._container,
        parentNode = container.parentNode;

    if (!parentNode) {
        return;
    }

    this._emit('detach');

    parentNode.removeChild(container);

    this._container = null;
    this._propertyWindow.close();
}

function update(element) {
    var self = this; //PropertiesPanel Object
    var currentBO = element.businessObject;

    var viewModel = kendoInstance.observable(currentBO);

    create.call(this, viewModel);

    kendoInstance.bind(this._container, viewModel);

    viewModel.bind('change', function (e) {
        var parent, newLabel;
        if (e.field === 'gfx.labelVisible') {
            currentBO.gfx.labelVisible = this.gfx.labelVisible;
            newLabel = this['action'];
            self._modeling.updateLabel(element, newLabel);
        } else {
            currentBO[e.field] = this[e.field];
            if (e.field === 'name' || e.field === 'action') {
                newLabel = this[e.field];
                self._modeling.updateLabel(element, newLabel);
            } else if (e.field === 'tracksHistory' || e.field === 'withHistory') {
                self._modeling.redraw(element);
            } else if (e.field === 'isInitial') {
                parent = currentBO.parentId === null ? self._model : self._model.children[currentBO.parentId];
                if (typeof parent.initialStateId !== 'undefined') {
                    self._parentInitialStateId = parent.initialStateId;
                    if (currentBO.state === 'start') {
                        currentBO.state = 'intermediate';
                        parent.initialStateId = null;
                    } else {
                        currentBO.state = 'start';
                        parent.initialStateId = currentBO.id;
                    }
                }
                self._modeling.redraw(element);
            }
        }
    });

    return viewModel;
}

function create(viewModel) {

    var containerNode = this._container;

    var editorFields = getEditorFields.call(this, viewModel);

    containerNode.appendChild(editorFields);

    attachActions.call(this);
}

function getEditorFields(viewModel) {
    var returnNode = '';

    if (viewModel.type === 'atomic-state') {
        if (viewModel.state === 'final') {
            returnNode = getFieldsForFinal();
        }
        else {
            returnNode = getFieldsForAtomic();
        }
    }
    else if (viewModel.type === 'compound-state') {
        returnNode = getFieldsForCompound();
    } else if (viewModel.type === 'parallel-state') {
        returnNode = getFieldsForParallel();
    } else if (viewModel.type === 'region') {
        returnNode = getFieldsForRegion();
    } else if (viewModel.type === 'transition') {
        returnNode =
            viewModel.sourceStateId === viewModel.targetStateId
                ? getFieldsForSelfTransition()
                : getFieldsForTransition();
    }

    returnNode = domify(returnNode + getActions());

    return returnNode;
}

function attachActions() {
    var self = this;
    var parent, oldData, label, ele;
    oldData = JSON.parse(self._oldData);
    if (oldData.type === 'atomic-state' || oldData.type === 'parallel-state' || oldData.type === 'compound-state') {
        self._parentInitialStateId = getParentInitialStateId(oldData, self._model);
        if (self._parentInitialStateId !== null && self._parentInitialStateId !== oldData.id) {
            jQuery('#checkInitial').attr('disabled', true);
            jQuery('#checkInitial').parent().append('<span class="PropertyEditor">Parent initial state already set</span>');
        }
    }
    jQuery('#impactWrightPropertyEditor').find('#btnOk').click(function () {
        // render current data 
        ele = self._element; label = ele.businessObject.name || ele.businessObject.action;
        self._modeling.updateLabel(ele, label);
        self._modeling.redraw(ele);
        detach.call(self);
    });

    jQuery('#impactWrightPropertyEditor').find('#btnCancel').click(function () {
        //render old data
        self._element.businessObject = oldData;
        ele = self._element; label = ele.businessObject.name || ele.businessObject.action;
        self._modeling.updateLabel(ele, label);
        if (typeof oldData.isInitial !== 'undefined') {
            parent = getParent(oldData, self._model);
            if (typeof parent.initialStateId !== 'undefined') {
                parent.initialStateId = self._parentInitialStateId;
            }
        }
        self._modeling.redraw(self._element);
        detach.call(self);
    });
}

function getParent(bo, model) {
    var parent;
    parent = (bo.parentId === null ? model : model.children[bo.parentId]);
    return parent;
}

function getParentInitialStateId(bo, model) {
    var parent, initialStateId;
    parent = getParent(bo, model);
    if (typeof parent.initialStateId !== 'undefined') {
        initialStateId = parent.initialStateId;
    }
    return initialStateId;
}

function getBaseFieldForRender() {
    var innerHtml =
        '<tr>' +
        '<td width="140px" style="text-align:left;">Key:</td>' +
        '<td><input type="text" id="txtKey"  data-bind="value: key" style="width: 300px;" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Name:</td>' +
        '<td><input type="text" id="txtName"  data-bind="value: name" style="width: 300px;" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;vertical-align: top;">Guard:</td>' +
        '<td><textarea rows="4" id="txtGuard" data-bind="value: guard" style="width: 300px;resize: none;" ></textarea></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;vertical-align: top;">Guard Error Message:</td>' +
        '<td><textarea rows="4" id="txtGuardMessage" data-bind="value: guardMessage" style="width: 300px;resize: none;" ></textarea></td>' +
        '</tr>';

    return innerHtml;
}

function getFieldsForAtomic() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Reset History:</td>' +
        '<td><input type="checkbox" id="chkResetH"  data-bind="checked: resetHistory" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Is Initial:</td>' +
        '<td><input type="checkbox" id="checkInitial"  data-bind="checked: isInitial" /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForFinal() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Reset History:</td>' +
        '<td><input type="checkbox" id="chkResetH"  data-bind="checked: resetHistory" /></td>' +
        '</tr>' +
        '<tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForCompound() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Tracks History:</td>' +
        '<td><input type="checkbox" id="checkTrackH"  data-bind="checked: tracksHistory" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Is Initial:</td>' +
        '<td><input type="checkbox" id="checkInitial"  data-bind="checked: isInitial" /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForParallel() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Is Initial:</td>' +
        '<td><input type="checkbox" id="checkInitial"  data-bind="checked: isInitial" /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForRegion() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Tracks History:</td>' +
        '<td><input type="checkbox" id="checkRegionTH"  data-bind="checked: tracksHistory" /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForTransition() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Action:</td>' +
        '<td><input type="text" id="txtTranAction"  data-bind="value: action" style="width: 300px;" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">With History:</td>' +
        '<td><input type="checkbox" id="chkWithH"  data-bind="checked: withHistory" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Show Label:</td>' +
        '<td><input type="checkbox" id="chkLblVisible"  data-bind="checked: gfx.labelVisible"  /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForSelfTransition() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Action:</td>' +
        '<td><input type="text" id="txtTranAction"  data-bind="value: action" style="width: 300px;" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Show Label:</td>' +
        '<td><input type="checkbox" id="chkLblVisible"  data-bind="checked: gfx.labelVisible"  /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}
function getActions() {
    var buttonNode =
        '<hr><div style="float:right;"><input type="button" id="btnOk" name="Ok" value="OK"> <input type="button" id="btnCancel" name="Cancel" value="Cancel"></div>';

    return buttonNode;
}

PropertiesPanel.prototype._emit = function (event) {
    this._eventBus.fire('propertiesPanel.' + event, { panel: this });
};
