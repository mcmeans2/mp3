var helpers = require('./helpers.js');

var HttpError = helpers.HttpError;

// MongoDB error codes for a query that is malformed: bad operator or argument, invalid regex
var BAD_QUERY_CODES = [2, 51091];

function isValidId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id);
}

function parseWholeNumber(query, name) {
    var value = query[name];
    if (value === undefined) {
        return undefined;
    }
    var number = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number)) {
        throw new HttpError(400, 'The ' + name + ' parameter must be a whole number that is 0 or greater');
    }
    return number;
}

function parseCount(query) {
    var value = query.count;
    if (value !== undefined && value !== 'true' && value !== 'false') {
        throw new HttpError(400, 'The count parameter must be true or false');
    }
    return value === 'true';
}

function checkSort(sort) {
    var valid = Object.values(sort).every(function (value) {
        return value === 1 || value === -1;
    });
    if (!valid) {
        throw new HttpError(400, 'The sort parameter must use 1 (ascending) or -1 (descending)');
    }
}

function checkSelect(select) {
    var values = Object.values(select);
    var valid = values.every(function (value) {
        return value === 0 || value === 1;
    });
    if (!valid) {
        throw new HttpError(400, 'The select parameter must use 1 (include) or 0 (exclude)');
    }
    // MongoDB only allows _id to be treated differently from the other fields
    var others = Object.keys(select).filter(function (field) {
        return field !== '_id';
    }).map(function (field) {
        return select[field];
    });
    if (others.includes(0) && others.includes(1)) {
        throw new HttpError(400, 'The select parameter cannot both include and exclude fields');
    }
}

function parseSelect(query) {
    var select = helpers.parseJsonParams(query, ['select']).select || {};
    checkSelect(select);
    return select;
}

// Turn a failure caused by the client's query into a 400. Anything else stays a 500.
function toQueryError(err) {
    var isBadQuery = err.name === 'CastError' ||
        BAD_QUERY_CODES.includes(err.code) ||
        (err.code === 8000 && /not allowed/.test(err.message)) ||
        /^Can't use \$/.test(err.message);
    return isBadQuery ? new HttpError(400, 'The where parameter is not a valid query') : err;
}

// Handler for GET on a collection, such as GET /users
function getList(Model, defaultLimit) {
    return async function (req, res) {
        var params = helpers.parseJsonParams(req.query, ['where', 'sort']);
        var where = params.where || {};
        var sort = params.sort || {};
        var select = parseSelect(req.query);
        var skip = parseWholeNumber(req.query, 'skip');
        var limit = parseWholeNumber(req.query, 'limit');
        var count = parseCount(req.query);
        checkSort(sort);

        if (limit === undefined) {
            limit = defaultLimit;
        }

        var data;
        try {
            if (count) {
                data = await Model.countDocuments(where);
            } else {
                var query = Model.find(where).sort(sort).select(select).skip(skip || 0);
                if (limit !== undefined) {
                    query = query.limit(limit);
                }
                data = await query.lean();
            }
        } catch (err) {
            throw toQueryError(err);
        }
        helpers.sendSuccess(res, 200, data);
    };
}

// Load the resource named in the URL, or respond 404 if there is no such resource
async function findExisting(Model, id, label) {
    var doc = isValidId(id) ? await Model.findById(id) : null;
    if (!doc) {
        throw new HttpError(404, label + ' not found');
    }
    return doc;
}

// Handler for GET on a single resource, such as GET /users/:id
function getOne(Model, label) {
    return async function (req, res) {
        var select = parseSelect(req.query);
        var doc = null;
        if (isValidId(req.params.id)) {
            doc = await Model.findById(req.params.id).select(select).lean();
        }
        if (!doc) {
            throw new HttpError(404, label + ' not found');
        }
        helpers.sendSuccess(res, 200, doc);
    };
}

module.exports = {
    isValidId: isValidId,
    findExisting: findExisting,
    getList: getList,
    getOne: getOne
};
