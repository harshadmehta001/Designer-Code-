'use strict';

var path = require('path');

var basePath = '../../';

var absoluteBasePath = path.resolve(path.join(__dirname, basePath));
module.exports = function(karma) {
    karma.set({
        basePath: basePath,

        frameworks: ['browserify', 'mocha', 'chai'],

        files: ['test/**/*Spec.js'],

        preprocessors: {
            'test/**/*Spec.js': ['browserify']
        },

        reporters: ['spec'],

        browsers: ['PhantomJS'],

        browserNoActivityTimeout: 30000,

        singleRun: false,
        autoWatch: true,

        //  logLevel: karma.LOG_DEBUG,

        // browserify configuration
        browserify: {
            debug: true,
            paths: [absoluteBasePath],
            transform: ['brfs']
        }
    });
};
