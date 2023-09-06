const vscode = require('vscode');
const { decorationType } = require("./decoration.js");

const decTypes = {};
Object.keys(decorationType).forEach(v => decTypes[v] = vscode.window.createTextEditorDecorationType(decorationType[v]));

function dec(tokens, document) {
    if (!tokens) return;
    let result = [];
    for (let i = 0; i < tokens.length; i++) {
        if (!tokens[i].isRejected) result.push([
            document.positionAt(tokens[i]._position.start),
            document.positionAt(tokens[i]._position.end),
            tokens[i].type
        ])
    };
    return result;
}

function refresh(content, editor) {
    let decs = dec(content.tokens, editor.document);
    if (!decs) return;
    let _dects = {};

    for (let i = 0; i < decs.length; i++) {
        if (!_dects[decs[i][2]]) _dects[decs[i][2]] = [];
        let decoration = {
            range: new vscode.Range(decs[i][0], decs[i][1])
        };
        _dects[decs[i][2]].push(decoration);
    }
    for (let [k, v] of Object.entries(_dects)) {
        editor.setDecorations(decTypes[k] || {
            color: "#444444"
        }, v);
    }
}

module.exports = {
    refresh,
}

