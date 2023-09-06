
const { getConnection, getDocuments, hasDiagnosticRelatedInformationCapability, node_1 } = require("./lib/connection.js");
const connection = getConnection();
const documents = getDocuments();


documents.onDidChangeContent(change => {
    (change.document);
});

connection.onCompletion((_textDocumentPosition) => {
    return [
        {
            label: 'TypeScript',
            kind: node_1.CompletionItemKind.Keyword,
            data: 1
        },
        {
            label: 'JavaScript',
            kind: node_1.CompletionItemKind.Text,
            data: 2
        }
    ];
});

connection.onHover(({ textDocument, position }) => {
    // 获取文档
    const document = documents.get(textDocument.uri);
    console.log(document)
    if (!document) return {
        contents: {
            kind: "markdown",
            value: '!document'
        }
    };

    return {
        contents: {
            kind: "markdown",
            value: '**teleport** command: Teleports you to the specified destination'
        }
    };
});

connection.onCompletionResolve((item) => {
    if (item.data === 1) {
        item.detail = 'TypeScript details';
        item.documentation = 'TypeScript documentation';
    }
    else if (item.data === 2) {
        item.detail = 'JavaScript details';
        item.documentation = 'JavaScript documentation';
    }
    return item;
});
documents.listen(connection);
connection.listen();