'use strict';

/**
 * Is an element of the given type?
 *
 * @param  {djs.model.Base|ModelElement} element
 * @param  {String} type
 *
 * @return {Boolean}
 */
function is(element, type) {
    var bo = getBusinessObject(element);

    //return bo && (typeof bo.$instanceOf === 'function') && bo.$instanceOf(type);
    return bo && bo.type === type;
}

module.exports.is = is;

/**
 * Return the business object for a given element.
 *
 * @param  {djs.model.Base|ModelElement} element
 *
 * @return {ModelElement}
 */
function getBusinessObject(element) {
    return (element && element.businessObject) || element;
}

function getParent(element) {
    return element && element.getParent || null;
}

module.exports.getBusinessObject = getBusinessObject;
