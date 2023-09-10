
const { getConnection, getDocuments, hasDiagnosticRelatedInformationCapability, node_1 } = require("./lib/connection.js");
const { setLang, getLocalize } = require("../lib/localize.js");
const { parseCompletion, test, findToken, parser, flat } = require("./lib/parser.js");
const connection = getConnection();
const documents = getDocuments();

let parseResult = null;

documents.onDidChangeContent(change => {
    if (change) {
        parseResult = parser(change.document.getText(), connection, change.document);
        // console.log(change.document.getText());
        // content, connection, document
        // test(change.document.getText(), connection, change.document)
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
    console.log(parseResult);
    console.log(findToken(flat(parseResult), document.offsetAt(position)))
    return {
        contents: {
            kind: "markdown",
            value: findToken(flat(parseResult), document.offsetAt(position))
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
