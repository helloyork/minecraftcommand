

class Rejected {
    get isRejected() {
        return true;
    }
    constructor(type, message, position) {
        this.type = type;
        this.message = message;
        this.position = position;
    }
}

const lexer = function (input, { reject } = { reject: () => { } }) {
    let current = 0, tokens = [], rejected = false;
    const EscapeChars = {
        "n": '\n',
        "r": '\r',
        "t": '\t',
        "b": '\b',
        "f": "\f",
        "\\": "\\",
        "/": "/",
        "\"": "\""
    }
    function skip() {
        current++;
    }
    function flowString() {
        let value = "";
        while (input[current] !== undefined) {
            if (/^[\u4e00-\u9fa5a-zA-Z0-9_\\]$/.test(input[current])) {
                if (input[current] === "\\") {
                    if (EscapeChars[input[current + 1]]) {
                        value = value.concat('\\' + EscapeChars[input[current + 1]]);
                        current += 2;
                    } else {
                        value = value.concat(EscapeChars[input[current + 1]]);
                        current += 2;
                    }
                } else {
                    value = value.concat(input[current]);
                    skip();
                }
            } else {
                break;
            }
        };
        return value;
    }
    function flowNumber() {
        let value = "", hasPoint = false;
        while (input[current] !== undefined) {
            if (input[current] === ".") {
                if (hasPoint) {
                    return value;
                } else {
                    if (/^[0-9]$/.test(input[current + 1])) {
                        value = value.concat(input[current]);
                        hasPoint = true;
                        skip();
                    } else {
                        return value;
                    }
                }
            } else {
                if (/^[0-9]$/.test(input[current])) {
                    value = value.concat(input[current]);
                    skip();
                } else {
                    if (["b", "s", "l", "f", "d", "B", "I", "L", "S", "F", "D"].includes(input[current])) {
                        value = value.concat(input[current]);
                        skip();
                    }
                    else return value;
                }
            }
        }
        return value;
    }
    function verbosePosition(c, ...args) {
        let _position = {};
        _position.start = current;
        _position.createEnd = function (end) {
            _position.end = end;
            return _position;
        }
        let result = c.apply({ _position }, args);
        if (_position.end === undefined) _position.end = current;
        delete _position.createEnd;
        if (typeof result === "object" && result !== undefined && result !== null) result._position = _position;
        return result;
    }
    let rows = input.split("\n"), settings = {};
    for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] !== "@") break;
        let a = rows[i].split(" "), b = a.shift().slice(1), c = a.join(" ").slice(0, -1);
        console.log([a,b,c])
        if (b.length) {
            settings[b] = {
                value: c,
                _position: {
                    start: current,
                    end: current + b.length + c.length + 3
                }
            };
        }
        tokens.push(verbosePosition(function () {
            current += rows[i].length;
            return {
                type: "setting",
                value: c
            };
        }))
    }

    lexerMain: while (input[current] !== undefined) {
        if (rejected) break;
        let char = input[current];
        if (/\s/.test(char)) {
            skip();
            continue;
        }

        if (char === "/") {
            tokens.push(verbosePosition(function () {
                skip();
                return {
                    type: "ignore",
                    value: "/",
                    toString:function(){
                        return "/";
                    }
                }
            }));
            continue;
        }

        // Number
        if (/^[0-9]$/.test(char)) {
            tokens.push(verbosePosition(function () {
                let v = flowNumber();
                return {
                    type: "number",
                    value: v,
                    toString:function(){
                        return v;
                    }
                };
            }));
            continue;
        }

        // Negative Number
        if (char === "-" && /^[0-9]$/.test(input[current + 1])) {
            tokens.push(verbosePosition(function () {
                skip();
                let v = flowNumber();
                return {
                    type: "number",
                    value: "-" + v,
                    toString:function(){
                        return "-" + v;
                    }
                };
            }));
            continue;
        }

        // Operator
        if (["[", "]", "{", "}"].includes(char)) {
            tokens.push(verbosePosition(function () {
                skip();
                return {
                    type: "operator",
                    value: char,
                    toString:function(){
                        return char;
                    }
                }
            }));
            continue;
        }
        if ([",", ":"].includes(char)) {
            tokens.push(verbosePosition(function () {
                skip();
                return {
                    type: "mid",
                    value: char,
                    toString:function(){
                        return char;
                    }
                }
            }));
            continue;
        }
        if (char === "=") {
            tokens.push(verbosePosition(function () {
                if (input[current + 1] === "!") {
                    current += 2;
                    return {
                        type: "operator",
                        value: "=!",
                        toString:function(){
                            return "=!";
                        }
                    }
                }
                skip();
                return {
                    type: "operator",
                    value: char,
                    toString:function(){
                        return char;
                    }
                }
            }));
            continue;
        }

        // Relative Position
        if (["~", "^"].includes(char)) {
            tokens.push(verbosePosition(function () {
                skip();
                let neg = false;
                if (input[current] === "-") {
                    neg = true;
                    skip();
                }
                if (/^[0-9]$/.test(input[current])) {
                    char = char + (neg ? "-" : "") + flowNumber();
                }
                return {
                    type: "position",
                    value: char,
                    toString:function(){
                        return char;
                    }
                }
            }));
            skip();
            continue;
        }

        // Tag
        if (char === "#") {
            tokens.push(verbosePosition(function () {
                skip();
                if (input[current] === undefined) {
                    return reject(new Rejected("SyntaxError", "Expected Tag Name", this._position.createEnd(current)));
                }
                let v = flowString();
                return {
                    type: "tag",
                    value: v,
                    toString:function(){
                        return v;
                    }
                }
            }));
            continue;
        }

        // Target Selector
        if (char === "@") {
            let _position = {
                start: current,
                end: null,
            };
            skip();
            let value = flowString();
            _position.end = current;
            if (["p", "r", "a", "e", "s", "c", "v", "initiator"].includes(value)) {
                tokens.push({
                    type: "selector",
                    value,
                    _position,
                    toString:function(){
                        return value;
                    }
                });
                continue;
            } else {
                tokens.push({
                    type: "name",
                    value,
                    _position,
                    toString:function(){
                        return value;
                    }
                });
                continue;
            }
        }

        // String
        if (char === "\"") {
            tokens.push(verbosePosition(function () {
                let value = "";
                skip();
                while (input[current] !== "\"") {
                    if (input[current] === undefined) {
                        rejected = true;
                        return reject(new Rejected("SyntaxError", `Missing '"'`, this._position.createEnd(current)));
                    }
                    if (input[current] === "\\") {
                        if (EscapeChars[input[current + 1]]) {
                            value = value.concat(EscapeChars[input[current + 1]]);
                            current += 2;
                        } else {
                            value = value.concat(EscapeChars[input[current + 1]]);
                            current += 2;
                        }
                    } else {
                        value = value.concat(input[current]);
                        skip();
                    }
                };
                skip();
                return {
                    type: "string",
                    value,
                    toString:function(){
                        return value;
                    }
                };
            }));
            continue;
        }

        // Compare
        if (char === "." && input[current + 1] === ".") {
            tokens.push(verbosePosition(function () {
                current += 2;
                return {
                    type: "compare",
                    value: "..",
                    toString:function(){
                        return "..";
                    }
                }
            }))
            continue;
        }

        // Date Type
        if (["B", "I", "L"].includes(char) && input[current + 1] === ";") {
            tokens.push(verbosePosition(function () {
                current += 2;
                return {
                    type: "declaration",
                    value: char,
                    toString:function(){
                        return char;
                    }
                }
            }));
            continue;
        }

        // Name
        if (/^[\u4e00-\u9fa5a-zA-Z0-9]$/.test(char)) {
            tokens.push(verbosePosition(function () {
                let name = flowString();
                if (name !== null && name !== undefined && typeof name === "object" && name.isRejected) {
                    return name;
                }
                if (name === "true" || name === "false") return {
                    type: "boolean",
                    value: name,
                    toString:function(){
                        return name;
                    }
                }
                return {
                    type: "name",
                    value: name,
                    toString:function(){
                        return name;
                    }
                };
            }));
            continue;
        }

        rejected = true;
        tokens.push(reject(new Rejected("SyntaxError", `Unknown Token`, { start: current, end: current })));
    };
    console.log({
        input,
        tokens,
        settings,
    })
    return {
        tokens,
        settings,
    };
}

function getPosition(f, l) {
    let totalChars = 0;
    let line = 0;
    let column = 0;
    for (let i = 0; i < f.length; i++) {
        if (totalChars + f[i] >= l) {
            line = i;
            column = l - totalChars;
            break;
        }
        totalChars += f[i] + 1;
    }
    return { line, column };
}

module.exports = {
    lexer,
    getPosition
}
