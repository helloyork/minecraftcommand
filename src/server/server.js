
const { getConnection, getDocuments, hasDiagnosticRelatedInformationCapability, node_1 } = require("./lib/connection.js");
const connection = getConnection();
const documents = getDocuments();


documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
async function validateTextDocument(textDocument) {
    // 验证器为长度为 2 或以上的所有大写单词创建诊断程序
    const text = textDocument.getText();
    const pattern = /\b[A-Z]{2,}\b/g;
    let m;
    let problems = 0;
    const diagnostics = [];
    while ((m = pattern.exec(text)) && problems < 50) {
        problems++;
        const diagnostic = {
            severity: node_1.DiagnosticSeverity.Warning,
            range: {
                start: textDocument.positionAt(m.index),
                end: textDocument.positionAt(m.index + m[0].length)
            },
            message: `${m[0]} is all uppercase.`,
            source: 'ex'
        };
        if (hasDiagnosticRelatedInformationCapability) {
            diagnostic.relatedInformation = [
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnostic.range)
                    },
                    message: 'Spelling matters'
                },
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnostic.range)
                    },
                    message: 'Particularly for names'
                }
            ];
        }
        diagnostics.push(diagnostic);
    }
    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
connection.onDidChangeWatchedFiles(_change => {
    // 监控文件的 VSCode 发生变化
    connection.console.log('We received an file change event');
});

// 该处理程序提供完成项的初始列表。
connection.onCompletion((_textDocumentPosition) => {
    // 传入参数包含请求完成代码的文本文档的位置。
    // 的位置。在示例中，我们将忽略此
    // 信息，并始终提供相同的完成项。
    return [
        {
            label: 'TypeScript',
            kind: node_1.CompletionItemKind.Text,
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
// This handler resolves additional information for the item selected in
// the completion list.
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
// 使文本文档管理器监听连接
// 打开、更改和关闭文本文档事件
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map