module.exports = {
    "env": {
        "browser": true,
        "node": true,
        "mocha": true,
        "jasmine": true
    },
    "extends": "eslint:recommended",
    "rules": {
        "indent": ["error", 4, { "SwitchCase": 1 }],
        "linebreak-style": [
            "error",
            "windows"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "vars-on-top": "warn",
        "block-scoped-var": "error",
        "consistent-return": ["error", { "treatUndefinedAsUnspecified": true }],
        "curly": "warn",
        "default-case": "warn",
        "eqeqeq": ["warn", "smart"],
        "no-alert": "error",
        "no-caller": "error",
        "no-eq-null": "error",
        "no-floating-decimal": "error",
        "no-loop-func": "warn",
        "no-new": "error",
        "no-return-assign": "error",
        "no-warning-comments": ["warn", { "terms": ["todo", "fixme", "query"], "location": "anywhere" }],
        "no-with": "error",
        "strict": ["error", "global"],
        "no-catch-shadow": "error",
        "no-label-var": "error",
        "no-shadow-restricted-names": "error",
        "no-undefined": "error",
        "no-use-before-define": "off", // this is done to support calling functions declared later in the file

    }
};
