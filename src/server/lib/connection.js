"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
// 使用 Node 的 IPC 作为传输方式，为服务器创建连接。
// 还包括所有预览/建议的 LSP 功能。
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    // 客户端是否支持 "工作空间/配置 "请求？
    // 如果不支持，我们将使用全局设置。
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // 告诉客户端此服务器支持代码自动补全。
            completionProvider: {
                resolveProvider: true
            },
            hoverProvider: true,
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // 注册所有配置更改。
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

// 全局设置，在客户端不支持 "工作空间/配置 "请求时使用。
// 请注意，在使用本服务器和本示例中提供的客户端时不会出现这种情况。
// 但其他客户端可能会出现这种情况。
const defaultSettings = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;
// 缓存所有打开文档的设置
const documentSettings = new Map();
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // 重置所有缓存文件设置
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.languageServerExample || defaultSettings));
    }
});

// 仅保留打开文档的设置
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

module.exports = {
    getConnection: function(){
        return connection;
    },
    getDocuments: function(){
        return documents;
    },
    hasDiagnosticRelatedInformationCapability,
    node_1,
}
