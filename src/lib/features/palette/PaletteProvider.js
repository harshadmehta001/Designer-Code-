'use strict';

var assign = require('lodash/object/assign');

/**
 * A palette provider for WrightJS elements
 * @param {Palette} palette 
 * @param {Create} create 
 * @param {ElementFactory} elementFactory 
 * @param {SpaceTool} spaceTool 
 * @param {LassoTool} lassoTool 
 * @param {HandTool} handTool 
 * @param {ElementConnect} elementConnect 
 * @param {Translate} translate 
 */
function PaletteProvider(palette, create, elementFactory, elementConnect, translate) {
    this._palette = palette;
    this._create = create;
    this._elementFactory = elementFactory;
    this._elementConnect = elementConnect;
    this._translate = translate;

    palette.registerProvider(this);
}

PaletteProvider.$inject = ['palette', 'create', 'elementFactory', 'elementConnect', 'translate'];

module.exports = PaletteProvider;

PaletteProvider.prototype.getPaletteEntries = function (/*element*/) {
    var actions = {},
        create = this._create,
        elementFactory = this._elementFactory,
        elementConnect = this._elementConnect,
        translate = this._translate;

    function createAction(type, group, className, title, options) {
        function createListener(event) {
            var shape = elementFactory.createShape(
                assign(
                    {
                        type: type
                    },
                    options
                )
            );

            create.start(event, shape);
        }

        return {
            group: group,
            className: className,
            title: title ||
            translate('Create {type}', {
                type: type
            }),
            action: {
                dragstart: createListener,
                click: createListener
            }
        };
    }

    assign(actions, {
        'element-connect-tool': {
            group: 'tools',
            className: 'wright-icon-connection',
            title: translate('Create Transition'),
            action: {
                click: function (event) {
                    elementConnect.toggle(event, {
                        type: 'transition',
                        isAuto: false
                    });
                }
            }
        },
        'element-connect-tool-auto': {
            group: 'tools',
            className: 'wright-icon-connection-auto',
            title: translate('Create Auto Transition'),
            action: {
                click: function (event) {
                    elementConnect.toggle(event, {
                        type: 'transition',
                        isAuto: true
                    });
                }
            }
        },
        'tool-separator': {
            group: 'tools',
            separator: true
        },
        'atomic-state-intermediate': createAction(
            'atomic-state',
            'state',
            'wright-icon-intermediate-state',
            'Create Atomic State',
            {
                state: 'intermediate'
            }
        ),
        'atomic-state-final': createAction('atomic-state', 'state', 'wright-icon-final-state', 'Create Final State', {
            state: 'final'
        }),
        'compound-state': createAction(
            'compound-state',
            'state',
            'wright-icon-compound-state',
            'Create Compound State'
        ),
        'parallel-state': createAction('parallel-state', 'state', 'wright-icon-parallel-state', 'Create Parallel State')
    });

    return actions;
};
