
module.exports = {
    Rejected: class Rejected {
        get isRejected() {
            return true;
        }
        constructor(type, message, position) {
            this.type = type;
            this.message = message;
            this.position = position;
        }
    }
}


