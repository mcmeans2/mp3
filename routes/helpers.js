// An error whose status and message are safe to send to the client
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendSuccess(res, status, data) {
    res.status(status).json({ message: 'OK', data: data });
}

function sendError(res, status, message) {
    res.status(status).json({ message: message, data: null });
}

// Parse JSON query string parameters such as where, sort and select.
// Parameters that were not supplied are left out of the result.
function parseJsonParams(query, names) {
    var parsed = {};
    names.forEach(function (name) {
        if (query[name] === undefined) {
            return;
        }
        var value;
        try {
            value = JSON.parse(query[name]);
        } catch (err) {
            throw new HttpError(400, 'The ' + name + ' parameter must be valid JSON');
        }
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            throw new HttpError(400, 'The ' + name + ' parameter must be a JSON object');
        }
        parsed[name] = value;
    });
    return parsed;
}

function handleNotFound(req, res) {
    sendError(res, 404, 'The requested resource was not found');
}

// Express requires all four arguments to treat this as an error handler
function handleError(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }
    if (err instanceof HttpError) {
        return sendError(res, err.status, err.message);
    }
    // A URL id that cannot even be decoded is an id that does not exist
    if (err instanceof URIError) {
        return handleNotFound(req, res);
    }
    // Errors from Express itself, such as a request body that is not valid JSON
    if (err.status >= 400 && err.status < 500) {
        return sendError(res, err.status, 'The request could not be read');
    }
    console.error(err);
    sendError(res, 500, 'Something went wrong on the server');
}

module.exports = {
    HttpError: HttpError,
    sendSuccess: sendSuccess,
    sendError: sendError,
    parseJsonParams: parseJsonParams,
    handleNotFound: handleNotFound,
    handleError: handleError
};
