var helpers = require('./helpers.js');
var queries = require('./queries.js');

var HttpError = helpers.HttpError;

// Form-encoded bodies carry every value as a string, so convert them to what JSON would send
function readBody(req) {
    var body = req.body === undefined ? {} : req.body;
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new HttpError(400, 'The request body must be a JSON object');
    }
    if (!req.is('urlencoded')) {
        return body;
    }
    var fields = Object.assign({}, body);
    if (fields.completed === 'true' || fields.completed === 'false') {
        fields.completed = fields.completed === 'true';
    }
    if (typeof fields.pendingTasks === 'string') {
        fields.pendingTasks = fields.pendingTasks === '' ? [] : [fields.pendingTasks];
    }
    if (/^\d+$/.test(fields.deadline)) {
        fields.deadline = Number(fields.deadline);
    }
    return fields;
}

function requireText(body, field) {
    var value = body[field];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new HttpError(400, 'A ' + field + ' is required and must be text');
    }
    return value;
}

function optionalText(body, field, defaultValue) {
    var value = body[field];
    if (value === undefined) {
        return defaultValue;
    }
    if (typeof value !== 'string') {
        throw new HttpError(400, 'The ' + field + ' must be text');
    }
    return value;
}

function requireEmail(body) {
    var email = requireText(body, 'email');
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
        throw new HttpError(400, 'The email must be a valid email address');
    }
    return email;
}

function requireDate(body, field) {
    var value = body[field];
    var isDateString = typeof value === 'string' && !/^\s*\d*\s*$/.test(value);
    var date = isDateString || typeof value === 'number' ? new Date(value) : null;
    if (date === null || isNaN(date.getTime())) {
        throw new HttpError(400, 'A ' + field + ' is required and must be a valid date');
    }
    return date;
}

function optionalBoolean(body, field, defaultValue) {
    var value = body[field];
    if (value === undefined) {
        return defaultValue;
    }
    if (typeof value !== 'boolean') {
        throw new HttpError(400, 'The ' + field + ' must be true or false');
    }
    return value;
}

function optionalIdList(body, field) {
    var value = body[field];
    if (value === undefined) {
        return [];
    }
    var valid = Array.isArray(value) && value.every(function (id) {
        return typeof id === 'string' && queries.isValidId(id);
    });
    if (!valid) {
        throw new HttpError(400, 'The ' + field + ' must be a list of valid ids');
    }
    return Array.from(new Set(value));
}

function optionalId(body, field) {
    var value = optionalText(body, field, '');
    if (value !== '' && !queries.isValidId(value)) {
        throw new HttpError(400, 'The ' + field + ' must be a valid id');
    }
    return value;
}

// Fields the client may set on a user. Anything else in the body, such as dateCreated, is ignored.
function parseUser(req) {
    var body = readBody(req);
    return {
        name: requireText(body, 'name'),
        email: requireEmail(body),
        pendingTasks: optionalIdList(body, 'pendingTasks')
    };
}

// Fields the client may set on a task. Anything else in the body, such as dateCreated, is ignored.
function parseTask(req) {
    var body = readBody(req);
    return {
        name: requireText(body, 'name'),
        description: optionalText(body, 'description', ''),
        deadline: requireDate(body, 'deadline'),
        completed: optionalBoolean(body, 'completed', false),
        assignedUser: optionalId(body, 'assignedUser'),
        assignedUserName: optionalText(body, 'assignedUserName', '')
    };
}

module.exports = {
    parseUser: parseUser,
    parseTask: parseTask
};
