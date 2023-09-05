const { createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult } = require('vscode-languageserver');
const {
    TextDocument
} = require('vscode-languageserver-textdocument');

let connection = createConnection(ProposedFeatures.all);
let documents = new TextDocuments();
// documents.onDidOpen((event) => {
//     console.log(event)
// });

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );
    const result = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    
    // connection.onCompletion((textDocumentPosition) => {
    //     console.log(textDocumentPosition)
    //     // 基于 textDocumentPosition 提供代码补全项
    //     return [
    //         {
    //             label: 'HelloWorld',
    //             kind: 1, // Text
    //             data: 1
    //         }
    //     ];
    // });

    // connection.onCompletionResolve((item) => {
    //     if (item.data === 1) {
    //         item.detail = 'HelloWorld details';
    //         item.documentation = 'Type HelloWorld to log "Hello, World!"';
    //     }
    //     return item;
    // });
    return result;
});

connection.onHover(({ textDocument, position }) => {
    const document = documents.get(textDocument.uri);
    // console.log('Received hover request for:', textDocument);
    console.log('Documents:', document);
    // console.log(arguments[0])
    // const text = document.getText();
    // const lines = text.split(/\r?\n/g);

    // const line = lines[position.line];
    if(document){
        return {
            contents: [
                { language: 'markdown', value: "HELLO WORLD!" }
            ]
        };
    }
    return {
        contents: [
            { language: 'markdown', value: "qwq" }
        ]
    };
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});



documents.listen(connection);
connection.listen();