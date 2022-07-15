const path = require('path');

module.exports = {
    "env": {
        "commonjs": true,
        "es6": true
    },
    "globals": {
        "clearInterval": false,
        "clearTimeout": false,
        "console": false,
        "setInterval": false,
        "setTimeout": false
    },
    "parserOptions": {
        "ecmaVersion": 2017,
        "sourceType": "script"
    },
    "plugins": [
        "import"
    ],
    "rules": {
        "array-bracket-spacing": [
            "error",
            "never"
        ],
        "array-callback-return": "error",
        "arrow-parens": "off",
        "arrow-spacing": "error",
        "brace-style": [
            "error",
            "stroustrup",
            {
                "allowSingleLine": true
            }
        ],
        "camelcase": [
            "error",
            {
                "properties": "always"
            }
        ],
        "comma-dangle": [
            "error",
            "always-multiline"
        ],
        "comma-spacing": [
            "error",
            {
                "after": true
            }
        ],
        "comma-style": [
            "error",
            "last"
        ],
        "complexity": "warn",
        "consistent-return": "error",
        "constructor-super": "error",
        "curly": "error",
        "dot-location": [
            "error",
            "property"
        ],
        "dot-notation": [
            "error",
            {
                "allowPattern": "^[a-z]+(_[a-z]+)+$"
            }
        ],
        "eol-last": "error",
        "eqeqeq": "error",
        "generator-star-spacing": [
            "error",
            {
                "after": true,
                "before": false
            }
        ],
        "global-require": "error",
        "import/default": "error",
        "import/export": "error",
        "import/first": "error",
        "import/namespace": "error",
        "import/newline-after-import": "error",
        "import/no-absolute-path": "error",
        "import/no-extraneous-dependencies": [
            "error", {
                "devDependencies": [
                    "test/**",
                    "docs/**"
                ]
            }
        ],
        "import/no-mutable-exports": "error",
        "import/no-named-default": "error",
        "import/no-unassigned-import": "error",
        "import/no-webpack-loader-syntax": "error",
        "import/order": [
            "error",
            {
                "groups": [
                    ["builtin", "external"],
                    ["index","sibling","parent","internal"]
                ],
                "newlines-between": "always"
            }
        ],
        "indent": [
            "error",
            4,
            {
                "MemberExpression": 0,
                "SwitchCase": 1,
                "FunctionDeclaration": {
                    "parameters": 1,
                    "body": 1
                },
                "FunctionExpression": {
                    "parameters": 1,
                    "body": 1
                },
                "CallExpression": {
                    "arguments": 1
                }
            }
        ],
        "key-spacing": [
            "error",
            {
                "afterColon": true,
                "beforeColon": false,
                "mode": "minimum"
            }
        ],
        "keyword-spacing": "error",
        "linebreak-style": [
            "error",
            "unix"
        ],
        "max-len": [
            "error",
            140
        ],
        "max-nested-callbacks": [
            "error",
            4
        ],
        "max-params": [
            "error",
            5
        ],
        "new-cap": [
            "error",
            {
                "capIsNewExceptions": [
                    "Array",
                    "Boolean",
                    "Error",
                    "Number",
                    "Object",
                    "String",
                    "Symbol",
                    "Immutable.List",
                    "Immutable.Map",
                    "Immutable.OrderedMap",
                    "Immutable.OrderedSet",
                    "Immutable.Record",
                    "Immutable.Set"
                ]
            }
        ],
        "no-array-constructor": "error",
        "no-caller": "error",
        "no-case-declarations": "error",
        "no-catch-shadow": "error",
        "no-class-assign": "error",
        "no-cond-assign": [
            "error",
            "except-parens"
        ],
        "no-confusing-arrow": [
            "error",
            {
                "allowParens": true
            }
        ],
        "no-console": "error",
        "no-const-assign": "error",
        "no-div-regex": "error",
        "no-dupe-args": "error",
        "no-dupe-class-members": "error",
        "no-dupe-keys": "error",
        "no-duplicate-case": "error",
        "no-empty-character-class": "error",
        "no-empty-pattern": "error",
        "no-eval": "error",
        "no-ex-assign": "error",
        "no-fallthrough": "error",
        "no-floating-decimal": "error",
        "no-func-assign": "error",
        "no-implicit-coercion": [
            "error",
            {
                "boolean": true,
                "number": true,
                "string": true
            }
        ],
        "no-implied-eval": "error",
        "no-inner-declarations": "error",
        "no-invalid-regexp": "error",
        "no-iterator": "error",
        "no-lonely-if": "error",
        "no-loop-func": "error",
        "no-multi-str": "error",
        "no-native-reassign": "error",
        "no-negated-in-lhs": "error",
        "no-new-func": "error",
        "no-new-object": "error",
        "no-new-symbol": "error",
        "no-new-wrappers": "error",
        "no-obj-calls": "error",
        "no-octal": "error",
        "no-octal-escape": "error",
        "no-param-reassign": "error",
        "no-proto": "error",
        "no-prototype-builtins": "error",
        "no-regex-spaces": "error",
        "no-return-assign": "error",
        "no-self-assign": "error",
        "no-self-compare": "error",
        "no-spaced-func": "error",
        "no-sparse-arrays": "error",
        "no-tabs": "error",
        "no-this-before-super": "error",
        "no-throw-literal": "error",
        "no-trailing-spaces": "error",
        "no-undef": "error",
        "no-unexpected-multiline": "error",
        "no-unmodified-loop-condition": "error",
        "no-unreachable": "error",
        "no-unsafe-finally": "error",
        "no-unsafe-negation": "error",
        "no-unused-vars": [
            "error",
            {
                "args": "none"
            }
        ],
        "no-useless-call": "error",
        "no-useless-computed-key": "error",
        "no-var": "error",
        "no-void": "error",
        "no-with": "error",
        "object-curly-spacing": [
            "error",
            "never"
        ],
        "one-var": [
            "error",
            "never"
        ],
        "prefer-arrow-callback": "error",
        "prefer-const": "error",
        "prefer-rest-params": "error",
        "prefer-spread": "error",
        "quote-props": [
            "error",
            "as-needed"
        ],
        "quotes": [
            "error",
            "single",
            {
                "allowTemplateLiterals": true
            }
        ],
        "radix": "error",
        "rest-spread-spacing": "error",
        "semi": [
            "error",
            "always"
        ],
        "semi-spacing": [
            "error",
            {
                "after": true,
                "before": false
            }
        ],
        "space-before-blocks": [
            "error",
            "always"
        ],
        "space-before-function-paren": [
            "error",
            {
                "anonymous": "ignore",
                "named": "never"
            }
        ],
        "space-in-parens": [
            "error",
            "never"
        ],
        "space-infix-ops": "error",
        "space-unary-ops": [
            "error",
            {
                "nonwords": false,
                "words": false
            }
        ],
        "spaced-comment": [
            "error",
            "always"
        ],
        "strict": "error",
        "unicode-bom": "error",
        "use-isnan": "error",
        "valid-jsdoc": [
            "error",
            {
                "prefer": {
                    "arg": "param",
                    "argument": "param",
                    "class": "constructor",
                    "returns": "return",
                    "virtual": "abstract"
                },
                "requireParamDescription": false,
                "requireReturn": false,
                "requireReturnDescription": false
            }
        ],
        "valid-typeof": [
            "error",
            {
                "requireStringLiterals": true
            }
        ],
        "wrap-iife": "error",
        "yoda": [
            "error",
            "never"
        ]
    },

    "overrides": [
        {
            "files": ["*.ts"],
            "parser": "@typescript-eslint/parser",
            "parserOptions": {
                "tsconfigRootDir": __dirname,
                "project": [
                    "tsconfig.json",
                    "tsconfig.integration-redux.json"
                ],
                "sourceType": "module"
            },
            "plugins": ["@typescript-eslint"],
            "rules": {
                "@typescript-eslint/adjacent-overload-signatures": "error",
                "@typescript-eslint/array-type": "error",
                "@typescript-eslint/await-thenable": "error",
                "@typescript-eslint/ban-types": "error",
                "@typescript-eslint/ban-ts-comment": "error",
                "camelcase": "off",
                "@typescript-eslint/naming-convention": "error",
                "@typescript-eslint/explicit-function-return-type": "error",
                "@typescript-eslint/explicit-member-accessibility": "error",
                "indent": "off",
                "@typescript-eslint/indent": "error",
                "@typescript-eslint/member-delimiter-style": "error",
                "@typescript-eslint/consistent-type-assertions": "error",
                "no-array-constructor": "off",
                "@typescript-eslint/no-array-constructor": "error",
                "@typescript-eslint/no-empty-interface": "error",
                "@typescript-eslint/no-inferrable-types": "error",
                "@typescript-eslint/no-misused-new": "error",
                "@typescript-eslint/no-namespace": "error",
                "@typescript-eslint/no-non-null-assertion": "error",
                "@typescript-eslint/no-parameter-properties": "error",
                "@typescript-eslint/no-require-imports": "error",
                "@typescript-eslint/triple-slash-reference": "error",
                "no-unused-vars": "off",
                "@typescript-eslint/no-unused-vars": "error",
                "@typescript-eslint/no-use-before-define": "error",
                "@typescript-eslint/no-var-requires": "error",
                "@typescript-eslint/consistent-type-definitions": "error",
                "@typescript-eslint/prefer-namespace-keyword": "error",
                "@typescript-eslint/type-annotation-spacing": "error"
            }
        }
    ]
}
