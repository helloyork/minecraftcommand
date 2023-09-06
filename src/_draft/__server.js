const { createConnection, ProposedFeatures, TextDocuments, CompletionItemKind, TextDocumentSyncKind } = require('vscode-languageserver');

// 创建一个连接。
const connection = createConnection(ProposedFeatures.all);

// 创建一个简单的文本文档管理器。 文本文档管理器负责同步所有打开、更改和关闭的文本文档。
const documents = new TextDocuments();

documents.onDidOpen((e) => {
    console.log(`Document opened: ${e.document.uri}`);
});

documents.onDidChangeContent((e) => {
    console.log(`Document changed: ${e.document.uri}`);
});


connection.onInitialize((params) => {
    console.log("Initialized");
    console.log(documents.syncKind)
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
            },
            hoverProvider: true,
        },
    };
});

// 指令补全逻辑
connection.onCompletion((_textDocumentPosition) => {
    // 在这里写您的补全逻辑
    return [
        {
            label: 'say',
            kind: CompletionItemKind.Command,
        },
        {
            label: 'teleport',
            kind: CompletionItemKind.Command,
        },
        // 添加其他命令
    ];
});

connection.onCompletionResolve((item) => {
    if (item.label === 'say') {
        item.detail = 'say <message>';
        item.documentation = 'Displays a message to players.';
    }
    // ...其他命令的详细信息
    return item;
});

connection.onHover(({ textDocument, position }) => {
    // 获取文档
    const document = documents.get(textDocument.uri);
    console.log(document)
    if (!document) return null;

    // 获取光标所在的单词或符号，这里只是一个简单示例
    const wordRange = document.getWordRangeAtPosition(position, /\w+/);
    if (!wordRange) return null;

    const word = document.getText(wordRange);

    // 对应不同的单词显示不同的悬停信息
    if (word === 'say') {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: '**say** command: Displays a message to other players'
            }
        };
    }

    if (word === 'teleport') {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: '**teleport** command: Teleports you to the specified destination'
            }
        };
    }

    return null;
});

documents.listen(connection);
connection.listen();
