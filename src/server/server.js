
const { getConnection, getDocuments, hasDiagnosticRelatedInformationCapability, node_1 } = require("./lib/connection.js");
const { setLang, getLocalize } = require("../lib/localize.js");
const { parseCompletion, test } = require("./lib/parser.js");
const connection = getConnection();
const documents = getDocuments();


documents.onDidChangeContent(change => {
    if (change) {
        // console.log(change.document.getText());
        // content, connection, document
        test(change.document.getText(), connection, change.document)
        // parseCompletion(change.document.getText(), connection, change.document);
    }
});

connection.onDidChangeConfiguration((change) => {
    // console.log(change)
})

connection.onCompletion((textDocument) => {
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
    // console.log(document)
    if (!document) return {
        contents: {
            kind: "markdown",
            value: localize("a", "默认文字")
        }
    };

    return {
        contents: {
            kind: "markdown",
            value: localize("a", "默认文字")
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

function localize(key, defaultText) {
    return getLocalize().localize(key, defaultText);
}
