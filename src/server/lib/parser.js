

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
        [localize("information:supportedVersions")+supportedVersions.join(",")]);
        ver = load(defaluVersion);
    }
    output.version = ver;
    return output;
}

function parse(content, connection, document) {
    console.log(content)
    let diagnostics = [];
    function genDiagnostic(level, position, message, source, information = []){
        if(!position) return;
        let range = {
            start: document.positionAt(position.start),
            end: document.positionAt(position.end)
        };
        let diagnostic = {
            severity: DiagnosticSeverity[({error:"Error", warn: "Warning"})[level]],
            range,
            message,
            source,
            relatedInformation: information.map(v=>{
                return {
                    location:{
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
    let configs = init(configSettings(content.settings||{}), methods);
    let output = parseExpected(content.tokens, configs)
    connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

function parseExpected(tokens, configs) {
    let version = configs.version;
}

function findTokenAtPosition(tokens, position) {
    return tokens.find(token => token._position.start <= position && token._position.end >= position);
}

function parseCompletion(content, connection, document) {
    console.log(lexer(content, {reject:console.log}))
    parse(lexer(content), connection, document);
}

module.exports = {
    parseCompletion,
}
