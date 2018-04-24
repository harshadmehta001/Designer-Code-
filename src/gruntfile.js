'use strict';

module.exports = function(grunt) {
    var TEST_BROWSERS;
    require('load-grunt-tasks')(grunt);

    /* global process */

    // configures browsers to run test against
    // any of [ 'PhantomJS', 'Chrome', 'Firefox', 'IE']
    TEST_BROWSERS = ((process.env.TEST_BROWSERS || '').replace(/^\s+|\s+$/, '') ||
    'PhantomJS')
        .split(/\s*,\s*/g);

    // project configuration
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        config: {
            sources: 'lib',
            tests: 'test',
            dist: 'dist'
        },

        eslint: {
            check: {
                src: ['{lib,test}/**/*.js']
            },
            fix: {
                src: ['{lib,test}/**/*.js'],
                options: {
                    fix: true
                }
            }
        },

        karma: {
            options: {
                configFile: '<%= config.tests %>/config/karma.unit.js'
            },
            single: {
                singleRun: true,
                autoWatch: false,

                browsers: TEST_BROWSERS
            },
            unit: {
                browsers: TEST_BROWSERS,
                debug: true
            }
        }
    });

    // tasks

    grunt.registerTask('test', ['karma:single']);

    //grunt.registerTask('auto-test', ['karma:unit']);

    grunt.registerTask('default', ['eslint:check', 'test']);

    // grunt.registerTask('default', ['test']);
};
