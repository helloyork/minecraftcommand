const vscode = require('vscode');
const path = require('path');
const { lexer } = require("./lib/lexer.js");
const { refresh } = require("./lib/shader.js")
const { LanguageClient, TransportKind } = require('vscode-languageclient');


/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
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

    let serverModule = context.asAbsolutePath(path.join('src/server', 'server.js'));
    let serverOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc }
    };
    let clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'mcmd' }]
    };

    let disposable = new LanguageClient('mcmd', 'MCMD Language Server', serverOptions, clientOptions).start();
    context.subscriptions.push(disposable);
}





exports.activate = activate;

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
