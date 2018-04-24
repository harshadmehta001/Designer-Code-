'use strict';

var inherits = require('inherits'),
    isObject = require('lodash/lang/isObject'),
    assign = require('lodash/object/assign');

var BaseRenderer = require('diagram-js/lib/draw/BaseRenderer'),
    TextUtil = require('diagram-js/lib/util/Text');

var getBusinessObject = require('../util/ModelUtil').getBusinessObject;

var RenderUtil = require('diagram-js/lib/util/RenderUtil');

var componentsToPath = RenderUtil.componentsToPath;

var domQuery = require('min-dom/lib/query');

var svgAppend = require('tiny-svg/lib/append'),
    svgAttr = require('tiny-svg/lib/attr'),
    svgCreate = require('tiny-svg/lib/create'),
    svgClasses = require('tiny-svg/lib/classes');

var TASK_BORDER_RADIUS = 10;

/**
 * Decides the appearance of each element and provides the shape's snap svg 
 * element to be drawn on the canvas
 * @param {EventBus} eventBus 
 * @param {Styles} styles 
 * @param {PathMap} pathMap 
 * @param {Canvas} canvas 
 * @param {Priority} priority 
 */
function ElementRenderer(eventBus, styles, pathMap, canvas, priority) {
    var textUtil,
        computeStyle,
        markers = {};
    BaseRenderer.call(this, eventBus, priority);

    textUtil = new TextUtil({
        size: {
            width: 100
        }
    });

    computeStyle = styles.computeStyle;

    function addMarker(id, options) {
        var attrs = assign(
            {
                fill: 'black',
                strokeWidth: 1,
                strokeLinecap: 'round',
                strokeDasharray: 'none'
            },
            options.attrs
        );

        var ref = options.ref || {
            x: 0,
            y: 0
        };
        var marker, defs;
        var scale = options.scale || 1;

        // resetting stroke dash array
        if (attrs.strokeDasharray === 'none') {
            attrs.strokeDasharray = [10000, 1];
        }

        marker = svgCreate('marker');

        svgAttr(options.element, attrs);

        svgAppend(marker, options.element);

        svgAttr(marker, {
            id: id,
            viewBox: '0 0 20 20',
            refX: ref.x,
            refY: ref.y,
            markerWidth: 20 * scale,
            markerHeight: 20 * scale,
            orient: 'auto'
        });

        defs = domQuery('defs', canvas._svg);

        if (!defs) {
            defs = svgCreate('defs');

            svgAppend(canvas._svg, defs);
        }

        svgAppend(defs, marker);

        markers[id] = marker;
    }

    function marker(type, fill, stroke) {
        var id = type + '-' + fill + '-' + stroke;

        if (!markers[id]) {
            createMarker(type, fill, stroke);
        }

        return 'url(#' + id + ')';
    }

    function createMarker(type, fill, stroke) {
        var transitionMarker,
            transitionHistoryMarkerStart,
            id = type + '-' + fill + '-' + stroke;

        switch (type) {
            case 'transition-marker':
            case 'transition-history-marker-end': {
                transitionMarker = svgCreate('path');
                svgAttr(transitionMarker, {
                    d: 'M 1 5 L 11 10 L 1 15 Z'
                });

                addMarker(id, {
                    element: transitionMarker,
                    ref: {
                        x: 11,
                        y: 10
                    },
                    scale: 0.5,
                    attrs: {
                        fill: fill,
                        stroke: stroke
                    }
                });
                break;
            }
            case 'transition-history-marker-start': {
                transitionHistoryMarkerStart = svgCreate('circle');
                svgAttr(transitionHistoryMarkerStart, { cx: 6, cy: 6, r: 3.0 });

                addMarker(id, {
                    element: transitionHistoryMarkerStart,
                    attrs: {
                        fill: fill,
                        stroke: stroke
                    },
                    ref: { x: 3, y: 6 }
                });
                break;
            }
            default: {
                break;
            }
        }
    }

    function drawCircle(parentGfx, width, height, offset, attrs) {
        var cx, cy, circle;
        if (isObject(offset)) {
            attrs = offset;
            offset = 0;
        }

        offset = offset || 0;

        attrs = computeStyle(attrs, {
            stroke: 'black',
            strokeWidth: 2,
            fill: 'white'
        });
        cx = width / 2;
        cy = height / 2;
        circle = svgCreate('circle');

        svgAttr(circle, {
            cx: cx,
            cy: cy,
            r: Math.round((width + height) / 4 - offset)
        });

        svgAttr(circle, attrs);

        svgAppend(parentGfx, circle);

        return circle;
    }
    function drawCircle2(parentGfx, r, x, y, attrs) {
        var circle;
        attrs = computeStyle(attrs, {
            stroke: 'black',
            strokeWidth: 2,
            fill: 'white'
        });

        circle = svgCreate('circle');

        svgAttr(circle, {
            cx: x,
            cy: y,
            r: r
        });

        svgAttr(circle, attrs);

        svgAppend(parentGfx, circle);

        return circle;
    }

    function drawRect(parentGfx, width, height, r, offset, attrs) {
        var rect;
        if (isObject(offset)) {
            attrs = offset;
            offset = 0;
        }

        offset = offset || 0;

        attrs = computeStyle(attrs, {
            stroke: 'black',
            strokeWidth: 1,
            fill: 'white'
        });

        rect = svgCreate('rect');
        svgAttr(rect, {
            x: offset,
            y: offset,
            width: width - offset * 2,
            height: height - offset * 2,
            rx: r,
            ry: r
        });
        svgAttr(rect, attrs);

        svgAppend(parentGfx, rect);

        return rect;
    }

    function drawPath(parentGfx, d, attrs) {
        var path;
        attrs = computeStyle(attrs, ['no-fill'], {
            strokeWidth: 2,
            stroke: 'black'
        });

        path = svgCreate('path');
        svgAttr(path, {
            d: d
        });
        svgAttr(path, attrs);

        svgAppend(parentGfx, path);

        return path;
    }

    function renderLabel(parentGfx, label, options) {
        var text = textUtil.createText(label || '', options);
        svgClasses(text).add('djs-label');
        svgAppend(parentGfx, text);

        return text;
    }

    function renderEmbeddedLabel(parentGfx, element, align) {
        var businessObject = getBusinessObject(element);

        return renderLabel(parentGfx, businessObject.name, {
            box: element,
            align: align,
            padding: 5,
            style: {
                fill: getStrokeColor(element),
                fontSize: '.7em',
                fontWeight: 'bold'
            }
        });
    }

    function renderExternalLabel(parentGfx, element) {
        var businessObject = getBusinessObject(element);
        var box = {
            width: 90,
            height: 30,
            x: element.width / 2 + element.x ,
            y: element.height / 2 + element.y
        };

        var labelText = '';
        var fontStyle = 'normal';

        if (businessObject.type === 'transition') {
            fontStyle = 'italic';
            labelText = businessObject.isAuto === true ? 'Auto' : businessObject.action;
            if (typeof businessObject.gfx.labelVisible === 'undefined') {
                businessObject.gfx.labelVisible = true;
            }
        } else {
            labelText = businessObject.name;
        }

        return renderLabel(parentGfx, labelText, {
            box: box,
            fitBox: true,
            style: {
                fontSize: '.6em',
                fontWeight: 'normal',
                fontStyle: fontStyle
            }
        });
    }

    function createPathFromConnection(connection) {
        var waypoints = connection.waypoints,
            i;

        var pathData = 'm  ' + waypoints[0].x + ',' + waypoints[0].y;
        for (i = 1; i < waypoints.length; i++) {
            pathData += 'L' + waypoints[i].x + ',' + waypoints[i].y + ' ';
        }
        return pathData;
    }

    function renderHistoryIcon(parentGfx, element) {
        var pathData;
        var bo = getBusinessObject(element);

        if (bo.type === 'region' || bo.type === 'compound-state') {
            if (bo.tracksHistory === true) {
                /* add history icon */
                pathData = pathMap.getScaledPath('MARKER_HISTORY', {
                    abspos: {
                        x: element.width - 24,
                        y: element.height - 24
                    }
                });
                drawCircle2(parentGfx, 9, element.width - 16, element.height - 16, {
                    strokeWidth: 1,
                    fill: '#F5F5F5',
                    stroke: getStrokeColor(element)
                });
                drawPath(parentGfx, pathData, {
                    strokeWidth: 1.5, // 0.25,
                    fill: 'white',
                    stroke: getStrokeColor(element)
                });

                /* end add history */
            }
        }
    }

    this.handlers = {
        'atomic-state': function (parentGfx, element, attrs) {
            // remember assign only add missing attribute and never replaces that
            var circle,
                state,
                cstroke = '#3f3f3f',
                vattrs;
            var bo = getBusinessObject(element);
            state = bo.state;
            attrs = assign(
                {
                    fill: getFillColor(element),
                    stroke: cstroke
                },
                attrs
            );
            switch (state) {
                case 'start': {
                    vattrs = assign(
                        {
                            strokeWidth: 0,
                            strokeOpacity: 0
                        },
                        attrs
                    );
                    // main circle
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    // decorators
                    vattrs = { stroke: cstroke, strokeWidth: 1.5, strokeOpacity: 1, fillOpacity: 0 };
                    drawCircle(parentGfx, element.width, element.height, vattrs);
                    vattrs.strokeWidth = 3;
                    vattrs.stroke = 'white';
                    drawCircle(parentGfx, element.width, element.height, 2, vattrs);
                    vattrs.strokeWidth = 1.5;
                    vattrs.stroke = cstroke;
                    drawCircle(parentGfx, element.width, element.height, 4, vattrs);
                    break;
                }

                case 'intermediate': {

                    vattrs = assign({ strokeWidth: 1.5 }, attrs);
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    vattrs = { stroke: cstroke, strokeWidth: 1.5, strokeOpacity: 1, fillOpacity: 0 };
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    break;
                }

                case 'final': {

                    vattrs = assign({ strokeWidth: 1 }, attrs);
                    drawCircle(parentGfx, element.width, element.height, vattrs);
                    vattrs = { stroke: cstroke, strokeWidth: 4, strokeOpacity: 1, fillOpacity: 0.0 };
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    break;
                }

                default:
                    vattrs = assign({ strokeWidth: 1 }, attrs);
                    circle = drawCircle(parentGfx, element.width, element.height, vattrs);
                    break;
            }
            return circle;
        },
        'compound-state': function (parentGfx, element, attrs) {
            var rect, labelAlignment, vattrs;
            var bo = getBusinessObject(element);
            var offset = 3;
            var fillColor = 'white',
                fillOpacity = 0.95;
            vattrs = assign(
                { fillOpacity: fillOpacity, fill: fillColor, stroke: getStrokeColor(element), strokeWidth: 2 },
                attrs
            );

            if (bo.isInitial === true) {
                vattrs.strokeWidth = 1;
                rect = drawRect(parentGfx, element.width, element.height, TASK_BORDER_RADIUS, vattrs);
                vattrs.fillOpacity = fillOpacity;
                drawRect(parentGfx, element.width, element.height, TASK_BORDER_RADIUS, offset, vattrs);
            } else {
                rect = drawRect(parentGfx, element.width, element.height, TASK_BORDER_RADIUS, vattrs);
            }

            labelAlignment = ['center-top', 'center-middle'];

            renderHistoryIcon(parentGfx, element);
            renderEmbeddedLabel(parentGfx, element, labelAlignment[0]);

            return rect;
        },
        'parallel-state': function (parentGfx, element, attrs) {
            var rect, labelAlignment, attr;
            var bo = getBusinessObject(element);
            var fillColor = 'white',
                fillOpacity = 0.95;
            attr = assign(
                {
                    fillOpacity: fillOpacity,
                    fill: fillColor,
                    stroke: 'black',
                    strokeWidth: 1
                },
                attrs
            );
            rect = drawRect(parentGfx, element.width, element.height - 2, TASK_BORDER_RADIUS, 0, attr);

            if (bo.isInitial === true) {
                // additional border for initial=true                
                drawRect(parentGfx, element.width, element.height - 2, TASK_BORDER_RADIUS, 3, attrs);
            }

            labelAlignment = ['center-top', 'center-middle'];

            renderEmbeddedLabel(parentGfx, element, labelAlignment[0]);

            return rect;
        },
        region: function (parentGfx, element, attrs) {
            var rect, labelAlignment;
            var fillColor = 'white',
                fillOpacity = 0.95;
            attrs = assign(
                {
                    fill: fillColor,
                    fillOpacity: fillOpacity,
                    stroke: 'black',
                    strokeDasharray: '2,1',
                    strokeWidth: 1
                },
                attrs
            );

            rect = drawRect(parentGfx, element.width, element.height, 0, attrs);

            labelAlignment = ['center-top', 'center-middle'];
            renderHistoryIcon(parentGfx, element);
            renderEmbeddedLabel(parentGfx, element, labelAlignment[0]);

            return rect;
        },
        transition: function (parentGfx, element, attrs) {
            var pathData = createPathFromConnection(element);
            var strokeStyle = 'none';
            var fillColor = getFillColor(element),
                strokeColor = getStrokeColor(element);
            var path;
            var bo = element && element.businessObject ? element.businessObject : null;

            if (element.isAuto) {
                strokeStyle = '3,2';
            }

            attrs = {
                strokeLinejoin: 'round',
                markerEnd: marker('transition-marker', strokeColor, strokeColor),
                stroke: strokeColor,
                strokeDasharray: strokeStyle,
                strokeWidth: 1.25
            };
            if (bo !== null) {
                // mark with history
                if (bo.withHistory === true) {
                    attrs.stroke = strokeColor;
                    attrs.markerStart = marker('transition-history-marker-start', fillColor, strokeColor);
                    attrs.markerEnd = marker('transition-history-marker-end', fillColor, strokeColor);
                }
            }
            path = drawPath(parentGfx, pathData, attrs);
            return path;
        },
        label: function (parentGfx, element) {
            // Update external label size and bounds during rendering when
            // we have the actual rendered bounds anyway.
            var textElement = renderExternalLabel(parentGfx, element);

            var textBBox;

            try {
                textBBox = textElement.getBBox();
            } catch (e) {
                textBBox = {
                    width: 0,
                    height: 0,
                    x: 0
                };
            }

            // update element.x so that the layouted text is still
            // center alligned (newX = oldMidX - newWidth / 2)
            element.x = Math.ceil(element.x + element.width / 2) - Math.ceil(textBBox.width / 2);

            // take element width, height from actual bounds
            element.width = Math.ceil(textBBox.width);
            element.height = Math.ceil(textBBox.height);

            // compensate bounding box x
            svgAttr(textElement, {
                transform: 'translate(' + -1 * textBBox.x + ',0)'
            });

            return textElement;
        }
    };
}

ElementRenderer.$inject = ['eventBus', 'styles', 'pathMap', 'canvas'];

inherits(ElementRenderer, BaseRenderer);

module.exports = ElementRenderer;

ElementRenderer.prototype.canRender = function (/*element*/) {
    return true;
};

ElementRenderer.prototype.drawShape = function (parentGfx, element) {
    var type = element.type;
    var h = this.handlers[type];
    var bo = getBusinessObject(element);
    /* jshint -W040 */
    return h(parentGfx, element, {
        state: bo.state
    });
};

ElementRenderer.prototype.drawConnection = function (parentGfx, element) {
    var type = element.type;
    var h = this.handlers[type];

    /* jshint -W040 */
    return h(parentGfx, element);
};

ElementRenderer.prototype.getShapePath = function (element) {
    if (element.type === 'atomic-state') {
        return getCirclePath(element);
    }
    if (element.type === 'transition' || element.type === 'connection') {
        return getConnectionPath(element);
    }
    return getRectPath(element);
};

function getConnectionPath(connection) {
    var waypoints = connection.waypoints.map(function (p) {
        return p.original || p;
    });

    var connectionPath = [['M', waypoints[0].x, waypoints[0].y]];

    waypoints.forEach(function (waypoint, index) {
        if (index !== 0) {
            connectionPath.push(['L', waypoint.x, waypoint.y]);
        }
    });

    return componentsToPath(connectionPath);
}

function getCirclePath(shape) {
    var cx = shape.x + shape.width / 2,
        cy = shape.y + shape.height / 2,
        radius = shape.width / 2;

    var circlePath = [
        ['M', cx, cy],
        ['m', 0, -radius],
        ['a', radius, radius, 0, 1, 1, 0, 2 * radius],
        ['a', radius, radius, 0, 1, 1, 0, -2 * radius],
        ['z']
    ];

    return componentsToPath(circlePath);
}

function getRectPath(shape) {
    var x = shape.x,
        y = shape.y,
        width = shape.width,
        height = shape.height;

    var rectPath = [['M', x, y], ['l', width, 0], ['l', 0, height], ['l', -width, 0], ['z']];

    return componentsToPath(rectPath);
}

function getFillColor(element) {
    var bo = getBusinessObject(element);

    if (bo.gfx.color) {
        return bo.gfx.color;
    }

    return '#D3D3D3';
}

function getStrokeColor(element) {
    var bo = getBusinessObject(element);

    if (element.type === 'transition' && bo.gfx.color) {
        return bo.gfx.color;
    }
    return 'black';
}
