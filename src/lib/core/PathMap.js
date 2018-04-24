'use strict';

/**
 * Map containing SVG paths needed by Renderer.
 */

// copied from https://github.com/adobe-webplatform/Snap.svg/blob/master/src/svg.js
var tokenRegex = /\{([^\}]+)\}/g, objNotationRegex = /(?:(?:^|\.)(.+?)(?=\[|\.|$|\()|\[('|")(.+?)\2\])(\(\))?/g; // matches .xxxxx or ["xxxxx"] to run over object properties
function PathMap() {
    /**
     * Contains a map of path elements
     *
     * <h1>Path definition</h1>
     * A parameterized path is defined like this:
     * <pre>
     * 'GATEWAY_PARALLEL': {
     *   d: 'm {mx},{my} {e.x0},0 0,{e.x1} {e.x1},0 0,{e.y0} -{e.x1},0 0,{e.y1} ' +
    '-{e.x0},0 0,-{e.y1} -{e.x1},0 0,-{e.y0} {e.x1},0 z',
     *   height: 17.5,
     *   width:  17.5,
     *   heightElements: [2.5, 7.5],
     *   widthElements: [2.5, 7.5]
     * }
     * </pre>
     * <p>It's important to specify a correct <b>height and width</b> for the path as the scaling
     * is based on the ratio between the specified height and width in this object and the
     * height and width that is set as scale target (Note x,y coordinates will be scaled with
     * individual ratios).</p>
     * <p>The '<b>heightElements</b>' and '<b>widthElements</b>' array must contain the values that will be scaled.
     * The scaling is based on the computed ratios.
     * Coordinates on the y axis should be in the <b>heightElement</b>'s array, they will be scaled using
     * the computed ratio coefficient.
     * In the parameterized path the scaled values can be accessed through the 'e' object in {} brackets.
     *   <ul>
     *    <li>The values for the y axis can be accessed in the path string using {e.y0}, {e.y1}, ....</li>
     *    <li>The values for the x axis can be accessed in the path string using {e.x0}, {e.x1}, ....</li>
     *   </ul>
     *   The numbers x0, x1 respectively y0, y1, ... map to the corresponding array index.
     * </p>
     */
    this.pathMap = {
        MARKER_HISTORY: {
            d: 'm{mx},{my} m 5,3 l 0,10 m 0,-5 l 5,0 m 0,-5 l 0,10',
            height: 12,
            width: 12,
            heightElements: [],
            widthElements: []
        }
    };

    this.getRawPath = function getRawPath(pathId) {
        return this.pathMap[pathId].d;
    };

    /**
     * Scales the path to the given height and width.
     * <h1>Use case</h1>
     * <p>Use case is to scale the content of elements (event, gateways) based
     * on the element bounding box's size.
     * </p>
     * <h1>Why not transform</h1>
     * <p>Scaling a path with transform() will also scale the stroke and IE does not support
     * the option 'non-scaling-stroke' to prevent this.
     * Also there are use cases where only some parts of a path should be
     * scaled.</p>
     *
     * @param {String} pathId The ID of the path.
     * @param {Object} param <p>
     *   Example param object scales the path to 60% size of the container (data.width, data.height).
     *   <pre>
     *   {
     *     xScaleFactor: 0.6,
     *     yScaleFactor:0.6,
     *     containerWidth: data.width,
     *     containerHeight: data.height,
     *     position: {
     *       mx: 0.46,
     *       my: 0.2,
     *     }
     *   }
     *   </pre>
     *   <ul>
     *    <li>targetpathwidth = xScaleFactor * containerWidth</li>
     *    <li>targetpathheight = yScaleFactor * containerHeight</li>
     *    <li>Position is used to set the starting coordinate of the path. M is computed:
     *    <ul>
     *      <li>position.x * containerWidth</li>
     *      <li>position.y * containerHeight</li>
     *    </ul>
     *    Center of the container <pre> position: {
     *       mx: 0.5,
     *       my: 0.5,
     *     }</pre>
     *     Upper left corner of the container
     *     <pre> position: {
     *       mx: 0.0,
     *       my: 0.0,
     *     }</pre>
     *    </li>
     *   </ul>
     * </p>
     *
     */
    this.getScaledPath = function getScaledPath(pathId, param) {
        var rawPath = this.pathMap[pathId];

        // positioning
        // compute the start point of the path
        var mx, my, coordinates, path,heightRatio, widthRatio,heightIndex, widthIndex;

        if (param.abspos) {
            mx = param.abspos.x;
            my = param.abspos.y;
        } else {
            mx = param.containerWidth * param.position.mx;
            my = param.containerHeight * param.position.my;
        }

        coordinates = {}; //map for the scaled coordinates
        if (param.position) {
          
            // path
            heightRatio = param.containerHeight / rawPath.height * param.yScaleFactor;
            widthRatio = param.containerWidth / rawPath.width * param.xScaleFactor;

            //Apply height ratio
            for (heightIndex = 0; heightIndex < rawPath.heightElements.length; heightIndex++) {
                coordinates['y' + heightIndex] = rawPath.heightElements[heightIndex] * heightRatio;
            }

            //Apply width ratio
            for (widthIndex = 0; widthIndex < rawPath.widthElements.length; widthIndex++) {
                coordinates['x' + widthIndex] = rawPath.widthElements[widthIndex] * widthRatio;
            }
        }

        //Apply value to raw path
        path = format(rawPath.d, {
            mx: mx,
            my: my,
            e: coordinates
        });
        return path;
    };
}

module.exports = PathMap;

////////// helpers //////////

function replacer(all, key, obj) {
    var res = obj;
    key.replace(objNotationRegex, function (all, name, quote, quotedName, isFunc) {
        name = name || quotedName;
        if (res) {
            if (name in res) {
                res = res[name];
            }
            typeof res == 'function' && isFunc && (res = res());
        }
    });
    res = (res === null || res === obj ? all : res) + '';

    return res;
}

function format(str, obj) {
    return String(str).replace(tokenRegex, function (all, key) {
        return replacer(all, key, obj);
    });
}
