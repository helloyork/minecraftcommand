const vscode = require('vscode');

function parse(content){
    
}

function findTokenAtPosition(tokens, position) {
    return tokens.find(token => token._position.start <= position && token._position.end >= position);
}

function parseCompletion({ tokens, settings }, documentPosition) {
    documentPosition.p
}

module.exports = {
    parseCompletion,
}
