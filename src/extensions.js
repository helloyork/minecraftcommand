const vscode = require('vscode');
const { active } = require("./client/client.js");
const { LanguageClient, TransportKind } = require('vscode-languageclient');
const serverPath = "src/server/server.js";

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    active();

    let serverModule = context.asAbsolutePath(serverPath);
    let serverOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc }
    };
    let clientOptions = {
        documentSelector: [{ scheme: 'file', language: 'mcmd' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc'),
        },
    };

    let disposable = new LanguageClient('mcmd', 'MCMD Language Server', serverOptions, clientOptions).start();
    context.subscriptions.push(disposable);
}

exports.activate = activate;

function deactivate() {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

module.exports = {
    activate,
    deactivate
};
