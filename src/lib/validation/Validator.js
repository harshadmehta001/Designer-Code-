'use strict';
var flatten = require('lodash/array/flatten');

var validate = function (model, constraints, ownerObjectKey) {
    var myError, errors = [], property;

    for (property in constraints) {
        
        if (!constraints[property].optional && !model.hasOwnProperty(property)) {
            myError = {
                'message': constraints[property].propertyName + ' is not specified in ' + ownerObjectKey,
                'target': model,
                'key': property,
                'tag': ownerObjectKey
            };
            errors.push(myError);

            continue;
        }

        myError = callValidators(model, constraints, property, ownerObjectKey);
        if(myError.length > 0)
        {
            errors.push(myError);
        }
    }

    return flatten(errors, true);
};

function callValidators(model, constraints, property, ownerObjectKey) {
    var errors = [], myError, i,  validator;
    if (constraints[property].hasOwnProperty('validators')) {
       
        for ( i = 0; i < constraints[property].validators.length; i++) {
            validator = constraints[property].validators[i];
            myError = validator(model[property], model, property, constraints[property].propertyName, ownerObjectKey);
            if (myError !== null) {
                if (myError.length > 0) {
                    errors.push(myError);
                    break;
                }
            }
        }
    }

    return errors;
}

module.exports = validate;