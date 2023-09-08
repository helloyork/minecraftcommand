

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
    console.log(content)
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
            return null;
        }

        // ignore
        if (token.type === "ignore" && token.value === "/") {
            return verbosePosition(function () {
                skip();
                let args = [];
                while (tokens[current] !== undefined) {
                    if (tokens[current].type !== 'ignore') {
                        let c = walk();
                        if (c) args.push(c);
                    }
                }
                return {
                    type: "Command",
                    args,
                }
            })
        }

        // number
        if (token.type === "number") {
            return verbosePosition(function () {
                skip();
                return {
                    type: "Number",
                    value: token.value
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
                            _position: l.createEnd(current - 1)
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
                while (true) {
                    if (tokens[current] === undefined) {
                        break;
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
                                reject({
                                    type: "Error",
                                    message: localize("error:invalid"),
                                    _position: l.createEnd(current)
                                });
                                return null;
                            }
                        } else {
                            reject({
                                type: "Error",
                                message: localize("error:invalid"),
                                _position: l.createEnd(current)
                            })
                            return null;
                        }
                    } else {
                        let l = this;
                        reject({
                            type: "Error",
                            message: localize("error:invalid"),
                            _position: l.createEnd(current)
                        })
                        return null;
                    }
                    if (tokens[current].type === "mid" && tokens[current].value === ",") {
                        skip();
                        continue;
                    }
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
                        ":":"RegistrationName",
                        ".":"ReadExpression",
                    })[tokens[current].value], sec = null;
                    skip();
                    if(tokens[current+1] === undefined){
                        let l = this;
                        reject({
                            type: "Error",
                            message: localize("error:requireName"),
                            _position: l.createEnd(current)
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
                }else {
                    return {
                        type: "Name",
                        value: n
                    }
                }
            })

        }
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

module.exports = {
    parseCompletion,
}
