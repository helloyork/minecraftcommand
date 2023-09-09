// @todo 完成节点搜寻
// @todo 注意一下对象字段的位置追踪

const { load, defaluVersion, supportedVersions } = require("../../lib/load.js");
const { setLang, getLocalize } = require("../../lib/localize.js");
const { DiagnosticSeverity } = require("vscode-languageserver");
const { lexer } = require("../../lib/lexer.js");

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

function parse(content, connection, document, { reject } = { reject: () => { } }) {
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
        error: function (...args) {
            genDiagnostic("error", ...args)
        },
        warn: function (...args) {
            genDiagnostic("warn", ...args)
        },
    }
    let configs = init(configSettings(content.settings || {}), methods);
    let output = parseExpected(content.tokens, configs)
    connection.sendDiagnostics({ uri: document.uri, diagnostics });

    let current = 0, tokens = content.tokens;
    function verbosePosition(c, ...args) {
        let _position = {}, _end = false;
        _position.start = current;
        _position.createEnd = function (end) {
            _position.end = end;
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
    function walk() {
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
                    reject({
                        type: "Error",
                        message: localize("error:invalid"),
                        _position: l._position.createEnd(current - 1)
                    });
                    return null;
                }
                let commandName = tokens[current];
                skip();
                let args = [], rejected = false;
                while (tokens[current] !== undefined) {
                    if (tokens[current].type !== 'ignore') {
                        let c = walk();
                        if (c === null) rejected = true;
                        if (c && !rejected) args.push(c);
                    }else {
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
                if (tokens[current]&&tokens[current].type === "compare") {
                    d = ">";
                    skip();
                    if (tokens[current].type === "number") {
                        c = walk();
                        d = "~";
                    };
                    return {
                        type: "NumberExpression",
                        compare: d,
                        value: {
                            left: token.value,
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
                    reject({
                        type: "Error",
                        message: localize("error:expectedNumber"),
                        _position: l._position.createEnd(current - 1)
                    });
                    return null;
                }
                let v = walk();
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
                if (tokens[current] && tokens[current].type === "declaration") {
                    dataType = tokens[current].value;
                    skip();
                }
                while ((tokens[current].type !== "operator" || tokens[current].value !== "]")) {
                    if (tokens[current] === undefined) {
                        let l = this;
                        reject({
                            type: "Error",
                            message: localize("error:missing["),
                            _position: l._position.createEnd(current - 1)
                        });
                        return null;
                    }
                    let c = walk();
                    if (c) value.push(c);
                }
                skip();
                return {
                    type: "Array",
                    dataType,
                    value,
                }
            })
        }

        // operator{
        if (token.type === "operator" && token.value === "{") {
            return verbosePosition(function () {
                skip();
                let value = {};
                while (tokens[current] !== "operator" && tokens[current].value !== "}") {
                    if (tokens[current] === undefined) {
                        let l = this;
                        reject({
                            type: "Error",
                            message: localize("error:missing{"),
                            _position: l._position.createEnd(current)
                        });
                        return null;
                    }
                    if (tokens[current].type === "operator" && tokens[current].value === "}") {
                        skip();
                        break;
                    }
                    if (tokens[current].type === "name") {
                        let name = tokens[current].value;
                        skip();
                        if (tokens[current].type === "mid" && tokens[current].value === ":") {
                            skip();
                            if (tokens[current] && (tokens[current].type !== "operator" || tokens[current].value !== "}")) {
                                value[name] = walk();
                            } else {
                                let l = this;
                                reject({
                                    type: "Error",
                                    message: localize("error:invalid"),
                                    _position: l._position.createEnd(current)
                                });
                                return null;
                            }
                        } else {
                            let l = this;
                            reject({
                                type: "Error",
                                message: localize("error:invalid"),
                                _position: l._position.createEnd(current)
                            })
                            return null;
                        }
                    } else {
                        let l = this;
                        reject({
                            type: "Error",
                            message: localize("error:invalid"),
                            _position: l._position.createEnd(current)
                        })
                        return null;
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
                let n = token.value;
                skip();
                if (tokens[current].type === "mid" && (tokens[current].value === ":" || tokens[current].value === ".")) {
                    let _type = ({
                        ":": "RegistrationName",
                        ".": "ReadExpression",
                    })[tokens[current].value], sec = null;
                    skip();
                    if (tokens[current + 1] === undefined) {
                        let l = this;
                        reject({
                            type: "Error",
                            message: localize("error:requireName"),
                            _position: l._position.createEnd(current)
                        });
                        return null;
                    }
                    sec = walk();
                    return {
                        type: _type,
                        value: {
                            left: n,
                            right: sec,
                        }
                    }
                } else {
                    return {
                        type: "Name",
                        value: n
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
                        reject({
                            type: "Error",
                            message: localize("error:expectedPosition"),
                            _position: l._position.createEnd(current)
                        });
                        return null;
                    }
                    let value = tokens[current];
                    if (value.type === "number" || value.type === "position") {
                        if (value.type === "position" && value.value !== positionType) {
                            reject({
                                type: "Error",
                                message: localize("error:positionMix"),
                                _position: l._position.createEnd(current)
                            });
                            return null;
                        }
                        v.push(value.value);
                    } else {
                        reject({
                            type: "Error",
                            message: localize("error:expectedPosition"),
                            _position: l._position.createEnd(current)
                        });
                        return null;
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

        // Target Selector
        if (token.type === "selector") {
            return verbosePosition(function () {
                let selectorType = token.value;
                skip();
                if (tokens[current].type === "operator" && tokens[current].value === "[") {
                    skip();
                    let filter = [];
                    while (tokens[current].type !== "operator" || tokens[current].value !== "]") {
                        if (tokens[current].type === "operator" && tokens[current].value === "]") {
                            skip();
                            break;
                        }
                        if (tokens[current] === undefined) {
                            let l = this;
                            reject({
                                type: "Error",
                                message: localize("error:missing["),
                                _position: l._position.createEnd(current)
                            });
                            return null;
                        }
                        let item = walk(), compare = null, right = null;
                        if (tokens[current].type !== "operator" || !["=", "=!"].includes(tokens[current].value)) {
                            let l = this;
                            reject({
                                type: "Error",
                                message: localize("error:invalidToken"),
                                _position: l._position.createEnd(current)
                            });
                            return null;
                        }
                        compare = tokens[current].value;
                        skip();
                        if (!tokens[current]) {
                            let l = this;
                            reject({
                                type: "Error",
                                message: localize("error:invalidToken"),
                                _position: l._position.createEnd(current)
                            });
                            return null;
                        }
                        if (tokens[current].type === "operator" && tokens[current].value === "{") {
                            let v = [];
                            skip();
                            while (tokens[current].type !== "operator" || tokens[current].value !== "}") {
                                if (tokens[current] === undefined) {
                                    let l = this;
                                    reject({
                                        type: "Error",
                                        message: localize("error:missing{"),
                                        _position: l._position.createEnd(current)
                                    });
                                    return null;
                                }
                                if(tokens[current].type !== "name"){
                                    let l = this;
                                    reject({
                                        type: "Error",
                                        message: localize("error:invalid"),
                                        _position: l._position.createEnd(current)
                                    })
                                    return null;
                                }
                                let left = walk(), compare, right;
                                if (tokens[current] && tokens[current].type === "compare") {
                                    compare = tokens[current];
                                    skip();
                                } else {
                                    let l = this;
                                    reject({
                                        type: "Error",
                                        message: localize("error:invalid"),
                                        _position: l._position.createEnd(current)
                                    })
                                    return null;
                                }
                                if(tokens[current] === undefined){
                                    let l = this;
                                    reject({
                                        type: "Error",
                                        message: localize("error:invalid"),
                                        _position: l._position.createEnd(current)
                                    })
                                    return null;
                                }
                                right = walk();
                                v.push({left, compare, right}) 
                                if(tokens[current].type === "mid" && tokens[current].value === ","){
                                    skip();
                                }
                            }
                        } else {
                            right = walk();
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

        // Name
        if (token.type === "name") {
            return verbosePosition(function () {
                skip();
                return {
                    type: "Name",
                    value: token.value
                }
            });
        }

        console.log(tokens.slice(current - 2, current + 2))
        throw new Error("Unknown Token: " + JSON.stringify(token));
    }

    let body = [];
    let count = 0;
    while (current < tokens.length) {
        if (count > 300) throw new Error(`Count Stop`)
        let result = walk();
        // console.log(result);
        if (result) body.push(result);
        count++;
    }
    return body;
}

function findNode(ast, position){
    if(!ast || !ast._position) return null;
    if(ast._position.start > position || ast._position.end < position) return null;
    if(ast.type === "Command") {
        for(let c of ast.args) {
            let found = findNode(c, position);
            if(found) return found;
        }
    } else if (["Number"].includes(ast.type)) {
        return ast
    }
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
    console.log(res);
    return res;
}

module.exports = {
    test,
    parseCompletion,
}
