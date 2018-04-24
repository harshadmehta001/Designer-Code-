'use strict';
var workflowModel1 = require('../data/childrenTestCase1.js');
var workflowModel2 = require('../data/testCase2.js');
var workflowModel3 = require('../data/crossRegionTestCase.js');
var Validation = require('../../lib/validation/CustomModalValidations');

describe('workflow validation ', function() {
    it('positive scenario', function() {
        expect(Validation.ValidateWorkflow(workflowModel1)).to.equal(0);
    });

    it('negative scenario', function() {
        expect(Validation.ValidateWorkflow(workflowModel2)).to.equal(0);
    });

    it('cross region testCase', function() {
        expect(Validation.ValidateWorkflow(workflowModel3)).to.equal(0);
    });
});
