

const { load, defaluVersion, supportedVersions } = require("../../lib/load.js");
const { setLang, getLocalize } = require("../../lib/localize.js");
const { DiagnosticSeverity } = require("vscode-languageserver");
const { lexer } = require("../../lib/lexer.js");

const DEBUG = false;

function localize(key, defaultText) {
    return getLocalize().localize(key, defaultText);
}

const versions = {};
const defaultSettings = {
    use: "1.19.4",
    lang: "en",
};

function configSettings(settings) {
    let output = {};
    Object.keys(defaultSettings).forEach(k => {
        if (settings[k] === undefined) {
            output[k] = defaultSettings[k];
        } else {
            output[k] = settings[k];
        }
    });
    return output;
}
function init(settings, methods) {
    let output = {};
    setLang(settings["lang"].value);
    let ver = load(settings["use"].value?.trim());
    if (!ver) {
        methods.warn(
            settings["use"]._position,
            `${localize("error:unknownVersion_1")}"${settings["use"].value}"${localize("error:unknownVersion_2")}`,
            undefined,
            [localize("information:supportedVersions") + supportedVersions.join(",")]);
        ver = load(defaluVersion);
    }
    output.version = ver;
    return output;
}

function parse(content, connection, document, { whenReject } = { whenReject: () => { } }) {
    // console.log(content)
    let diagnostics = [];
    function genDiagnostic(level, position, message, source, information = []) {
        if (!position) return;
        let range = {
            start: document.positionAt(position.start),
            end: document.positionAt(position.end)
        };
        let diagnostic = {
            severity: DiagnosticSeverity[({ error: "Error", warn: "Warning" })[level]],
            range,
            message,
            source,
            relatedInformation: information.map(v => {
                return {
                    location: {
                        uri: document.uri,
                        range: Object.assign({}, range)
                    },
                    message: v
                }
            })
        };
        diagnostics.push(diagnostic);
    }
    let methods = {
        error: function (items) {
            diagnostics = [];
            if (Array.isArray(items)) items.forEach(v => {
                genDiagnostic("error", v.position, v.message, v.source, v.information);
            })
            connection.sendDiagnostics({ uri: document.uri, diagnostics });
        },
        warn: function (items) {
            diagnostics = [];
            if (Array.isArray(items)) items.forEach(v => {
                genDiagnostic("warn", v.position, v.message, v.source, v.information);
            })
            connection.sendDiagnostics({ uri: document.uri, diagnostics });
        },
    }
    let configs = init(configSettings(content.settings || {}), methods);

    let current = 0, tokens = content.tokens;
    function verbosePosition(c, ...args) {
        let _position = {}, _end = false, getToken = (c) => tokens[c] || { _position: { start: 0, end: 0 } };
        _position.start = getToken(current)._position.start;
        let start = current;
        _position.createEnd = function (end, offset = 1) {
            _position.end = getToken(start)._position.end + offset;
            // _position.start = getToken(end + offset)._position.start
            _end = true;
            return _position;
        }
        let result = c.apply({ _position }, args);
        if (_position.end === undefined) _position.end = current;
        delete _position.createEnd;
        if (typeof result === "object" && result !== undefined && result !== null && !_end) result._position = _position;
        return result;
    }
    function skip() {
        return ++current;
    }
    function walk({ reject, expectedField } = {}) {
        let token = tokens[current];

        // setting
        if (token.type === "setting") {
            skip();
            return undefined;
        }

        // ignore
        if (token.type === "ignore" && token.value === "/") {
            return verbosePosition(function () {
                skip();
                if (tokens[current].type !== "name") {
                    let l = this;
                    return reject({
                        type: "Error",
                        message: localize("error:invalid"),
                        _position: l._position.createEnd(current - 1)
                    });
                }
                let commandName = walk({ reject });
                skip();
                let args = [], rejected = false;
                while (tokens[current] !== undefined) {
                    if (tokens[current].type !== 'ignore' && tokens[current].value !== "/") {
                        let c = walk({ reject });
                        if (c && c.type === "Error") rejected = true;
                        if (c && !rejected) args.push(c);
                    } else {
                        break;
                    }
                }
                return {
                    type: "Command",
                    value: commandName,
                    args,
                }
            })
        }

        // number & NumberExpression
        if (token.type === "number") {
            return verbosePosition(function () {
                skip();
                let c = null, d = null;
                if (tokens[current] && tokens[current].type === "compare") {
                    d = ">";
                    skip();
                    if (tokens[current].type === "number") {
                        c = walk({ reject });
                        d = "~";
                    };
                    return {
                        type: "NumberExpression",
                        compare: d,
                        value: {
                            left: {
                                type: "Number",
                                value: token.value,
                                _position: token._position
                            },
                            right: c
                        }
                    }
                }
                return {
                    type: "Number",
                    value: token.value
                }
            });
        }

        // compare
        if (token.type === "compare") {
            return verbosePosition(function () {
                skip();
                if (tokens[current] === undefined) {
                    let l = this;
                    return reject({
                        type: "Error",
                        message: localize("error:expectedNumber"),
                        _position: l._position.createEnd(current - 1)
                    });
                }
                let v = walk({ reject });
                return {
                    type: "NumberExpression",
                    compare: "<",
                    value: {
                        left: null,
                        right: v,
                    }
                }
            });
        }

        // operator[
        if (token.type === "operator" && token.value === "[") {
            return verbosePosition(function () {
                skip();
                let value = [];
                let dataType = null;
                if (tokens[current] && tokens[current]?.type === "declaration") {
                    dataType = tokens[current].value;
                    skip();
                }
                while (true) {
                    if (tokens[current] === undefined) {
                        let l = this;
                        return reject({
                            type: "Error",
                            message: localize("error:missing["),
                            _position: l._position.createEnd(current - 1)
                        });
                    }
                    if(tokens[current].type === "operator" && tokens[current].value === "]"){
                        skip();
                        break;
                    }
                    let c = walk({ reject });
                    if (c) value.push(c);
                }
                return {
                    type: "Array",
                    dataType,
                    value,
                }
            })
        }

        // Target Selector
        if (token.type === "selector") {
            return verbosePosition(function () {
                let selectorType = token.value;
                skip();
                console.log("qwe",tokens[current])
                if (tokens[current].type === "operator" && tokens[current].value === "[") {
                    skip();
                    let filter = [];
                    while (true) {
                        if (tokens[current] === undefined) {
                            let l = this;
                            return reject({
                                type: "Error",
                                message: localize("error:missing["),
                                _position: l._position.createEnd(current)
                            });
                        }
                        console.log("qwq",tokens[current])
                        if (tokens[current].type === "operator" && tokens[current].value === "]") {
                            skip();
                            break;
                        }
                        let item = walk({ reject }), compare = null, right = null;
                        if (tokens[current].type !== "operator" || !["=", "=!"].includes(tokens[current].value)) {
                            let l = this;
                            return reject({
                                type: "Error",
                                message: localize("error:invalidToken"),
                                _position: l._position.createEnd(current)
                            });
                        }
                        compare = tokens[current].value;
                        console.log("awa",tokens[current])
                        skip();
                        if (tokens[current] === undefined) {
                            let l = this;
                            return reject({
                                type: "Error",
                                message: localize("error:invalidToken"),
                                _position: l._position.createEnd(current)
                            });
                        }
                        if (tokens[current].type === "operator" && tokens[current].value === "{") {
                            let v = [];
                            skip();
                            while (true) {
                                if (tokens[current] === undefined) {
                                    let l = this;
                                    return reject({
                                        type: "Error",
                                        message: localize("error:missing{"),
                                        _position: l._position.createEnd(current)
                                    });
                                }

                                if (tokens[current].type === "operator" && tokens[current].value === "}") {
                                    skip();
                                    break;
                                }
                                if (tokens[current].type !== "name") {
                                    let l = this;
                                    return reject({
                                        type: "Error",
                                        message: localize("error:invalid"),
                                        _position: l._position.createEnd(current)
                                    });
                                }
                                let left = walk({ reject }), compare, right;
                                if (tokens[current] && tokens[current].type === "compare") {
                                    compare = walk({ reject });
                                    skip();
                                } else {
                                    let l = this;
                                    return reject({
                                        type: "Error",
                                        message: localize("error:invalid"),
                                        _position: l._position.createEnd(current)
                                    });
                                }
                                if (tokens[current] === undefined) {
                                    let l = this;
                                    return reject({
                                        type: "Error",
                                        message: localize("error:invalid"),
                                        _position: l._position.createEnd(current)
                                    });
                                }
                                right = walk({ reject });
                                v.push({ left, compare, right })
                                if (tokens[current].type === "mid" && tokens[current].value === ",") {
                                    skip();
                                }
                            }
                        } else {
                            right = walk({ reject });
                        }
                        filter.push({ left: item, compare, right });
                        if (tokens[current].type === "mid" && tokens[current].value === ",") {
                            skip();
                        }
                    }
                    skip();
                    return {
                        type: "Selector",
                        value: selectorType,
                        filter,
                    }
                }
                return {
                    type: "Selector",
                    value: selectorType,
                }
            })
        }

        // operator{
        if (token.type === "operator" && token.value === "{") {
            return verbosePosition(function () {
                skip();
                let value = [];
                while (true) {
                    if (tokens[current] === undefined) {
                        let l = this;
                        return reject({
                            type: "Error",
                            message: localize("error:missing{"),
                            _position: l._position.createEnd(current)
                        });
                    }
                    if (tokens[current].type === "operator" && tokens[current].value === "}") {
                        skip();
                        break;
                    }
                    if (tokens[current].type === "name") {
                        let name = walk({ reject, expectedField: true });
                        if (tokens[current].type === "mid" && tokens[current].value === ":") {
                            skip();
                            if (tokens[current] && (tokens[current].type !== "operator" || tokens[current].value !== "}")) {
                                value.push([name, walk({ reject })]);
                            } else {
                                let l = this;
                                return reject({
                                    type: "Error",
                                    message: localize("error:invalid"),
                                    _position: l._position.createEnd(current)
                                });
                            }
                        } else {
                            let l = this;
                            return reject({
                                type: "Error",
                                message: localize("error:invalid"),
                                _position: l._position.createEnd(current)
                            });
                        }
                    } else {
                        let l = this;
                        return reject({
                            type: "Error",
                            message: localize("error:invalid"),
                            _position: l._position.createEnd(current)
                        });
                    }
                }
                return {
                    type: "Scope",
                    value,
                }
            })
        }

        // name
        if (token.type === "name") {
            return verbosePosition(function () {
                let n = token;
                skip();
                if (tokens[current] && !expectedField && tokens[current].type === "mid" && (tokens[current].value === ":" || tokens[current].value === ".")) {
                    let _type = ({
                        ":": "RegistrationName",
                        ".": "ReadExpression",
                    })[tokens[current].value], sec = null;
                    skip();
                    if (tokens[current] === undefined) {
                        let l = this;
                        return reject({
                            type: "Error",
                            message: localize("error:requireName"),
                            _position: l._position.createEnd(current)
                        });
                    }
                    sec = walk({ reject });
                    if (tokens[current] && tokens[current].type === "operator" && tokens[current].value === "{") {
                    }
                    return {
                        type: _type,
                        value: {
                            left: {
                                type: "Name",
                                value: n.value,
                                _position: n._position
                            },
                            right: sec,
                        }
                    }
                } else {
                    return {
                        type: "Name",
                        value: n.value,
                    }
                }
            })
        }

        // Relative Position
        if (token.type === "position") {
            return verbosePosition(function () {
                let positionType = token.value;
                let v = [token.value];
                skip();
                for (let i = 0; i < 2; i++) {
                    if (tokens[current] === undefined) {
                        let l = this;
                        return reject({
                            type: "Error",
                            message: localize("error:expectedPosition"),
                            _position: l._position.createEnd(current)
                        });
                    }
                    let value = tokens[current];
                    if (value.type === "number" || value.type === "position") {
                        if (value.type === "position" && value.value !== positionType) {
                            let l = this;
                            return reject({
                                type: "Error",
                                message: localize("error:positionMix"),
                                _position: l._position.createEnd(current)
                            });
                        }
                        v.push(value.value);
                    } else {
                        let l = this;
                        return reject({
                            type: "Error",
                            message: localize("error:expectedPosition"),
                            _position: l._position.createEnd(current)
                        });
                    }
                }
                return {
                    type: "Position",
                    value: v
                }
            });
        }

        // Tag
        if (token.type === "tag") {
            return verbosePosition(function () {
                skip();
                return {
                    type: "Tag",
                    value: token.value
                }
            })
        }

        // String
        if (token.type === "string") {
            return verbosePosition(function () {
                skip();
                return {
                    type: "String",
                    value: token.value
                }
            });
        }

        if (token.type === "compare") {
            return verbosePosition(function () {
                skip();
                return {
                    type: "Compare",
                    value: token.value
                }
            });
        }

        if (token.type === "mid") {
            return verbosePosition(function () {
                skip();
                return {
                    type: "Mid",
                    value: token.value
                }
            });
        }

        if (token.type === "operator" && token.value === "}") {
            return verbosePosition(function () {
                skip();
                let l = this;
                return reject({
                    type: "Error",
                    message: localize("error:missing{_2"),
                    _position: l._position.createEnd(current)
                });
            });
        }

        if (token.type === "operator" && token.value === "]") {
            return verbosePosition(function () {
                skip();
                let l = this;
                return reject({
                    type: "Error",
                    message: localize("error:missing[_2"),
                    _position: l._position.createEnd(current)
                });
            });
        }

        if (token.type === "operator") {
            return verbosePosition(function () {
                skip();
                return {
                    type: "Operator",
                    value: token.value
                }
            });
        }

        console.log(tokens.slice(current - 2, current + 2))
        throw new Error("Unknown Token: " + JSON.stringify(token));
    }

    let body = [], errors = [];
    let count = 0;
    while (current < tokens.length) {
        if (count > 300000) return;
        let result = walk({
            reject: function (item) {
                console.log(item)
                errors.push({
                    position: item._position,
                    message: item.message,
                    source: item.source,
                    information: item.information,
                });
                if (DEBUG) throw new Error()
                return item;
            }
        });
        // console.log(result);
        if (result) body.push(result);
        count++;
    }
    methods.error(errors);
    return body;
}

function parser(content, connection, document, handlers = { reject: console.log, crash: console.log }) {
    try {
        let words = lexer(content, { reject: console.log });
        let result = parse(words, connection, document, handlers);
        return result;
    } catch (err) {
        handlers.crash(err);
        return null;
    }
}

function flat(ast, _depth = 0) {
    if (ast === null || !ast) return [];
    let output = [];
    output.push({ ...ast, _depth });
    switch (ast.type) {
        case "Command":
            output.push(...flat(ast.value, _depth + 1));
            ast.args.forEach(v => output.push(...flat(v, _depth + 1)));
            break;
        case "NumberExpression":
            output.push(...flat(ast.value.left || [], _depth + 1));
            output.push(...flat(ast.value.right || [], _depth + 1));
            break;
        case "Array":
            ast.value.forEach(v => output.push(...flat(v, _depth + 1)));
            break;
        case "Scope":
            ast.value.forEach(v => {
                output.push(...flat(v[0] || [], _depth + 1));
                output.push(...flat(v[1] || [], _depth + 1));
            });
            break;
        case "Name":
            output.push(...flat(ast.field || [], _depth + 1))
            break;
        case "RegistrationName":
            output.push(...flat(ast.value.left || [], _depth + 1));
            output.push(...flat(ast.value.right || [], _depth + 1));
            break;
        case "ReadExpression":
            output.push(...flat(ast.value.left || [], _depth + 1));
            output.push(...flat(ast.value.right || [], _depth + 1));
            break;
        case "Selector":
            if (ast.filter) {
                ast.filter.forEach(v => {
                    output.push(
                        ...flat(v.left || [], _depth + 1),
                        ...flat(v.compare || [], _depth + 1),
                        ...flat(v.right || [], _depth + 1)
                    )
                })
            }
            break;
    }
    return output;
}

function findToken(flatAst, position) {
    let deepestToken = null;
    let maxDepth = -1;

    for (let i = 0; i < flatAst.length; i++) {
        const token = flatAst[i];
        const { _position, _depth } = token;

        if (_position && _depth !== undefined) {
            const { start, end } = _position;
            if (position >= start && position <= end) {
                if (_depth > maxDepth) {
                    deepestToken = token;
                    maxDepth = _depth;
                }
            }
        }
    }

    return deepestToken;
}

function parseExpected(tokens, configs) {
    let version = configs.version;
}

function findTokenAtPosition(tokens, position) {
    return tokens.find(token => token._position.start <= position && token._position.end >= position);
}

function parseCompletion(content, connection, document) {
    console.log(lexer(content, { reject: console.log }))
    parse(lexer(content), connection, document);
}

function test(content, connection, document, handlers = { reject: console.log }) {
    let res = parse(lexer(content, { reject: console.log }), connection, document, handlers);
    // res.forEach(v => console.log(v.args))
    return res;
}

module.exports = {
    test,
    parseCompletion,
    findToken,
    flat,
    parse,
    parser
}
