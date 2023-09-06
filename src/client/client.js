const vscode = require('vscode');
const { lexer } = require("../lib/lexer.js");
const { refresh } = require("../lib/shader.js");

function active(){
    let activeEditor = vscode.window.activeTextEditor;

    if (activeEditor) {
        let text = activeEditor.document.getText();
        let tokens = lexer(text);
        refresh(tokens, activeEditor);
    }

    vscode.workspace.onDidChangeTextDocument((event) => {
        activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && event.document === activeEditor.document) {
            let text = event.document.getText();
            if (event.contentChanges.length) {
                let tokens = lexer(text);
                refresh(tokens, activeEditor);
            }
        }
    });
}

module.exports = {
    active,
}
