var User = require('../models/user.js');
var helpers = require('./helpers.js');
var queries = require('./queries.js');
var validation = require('./validation.js');

var DUPLICATE_EMAIL_MESSAGE = 'That email is already used by another user';
var DUPLICATE_KEY_CODE = 11000;

async function createUser(req, res) {
    var fields = validation.parseUser(req);
    if (await User.exists({ email: fields.email })) {
        throw new helpers.HttpError(400, DUPLICATE_EMAIL_MESSAGE);
    }

    // TODO (bucket 5): assign fields.pendingTasks to this user. Until then the list stays empty.
    var user;
    try {
        user = await User.create({ name: fields.name, email: fields.email });
    } catch (err) {
        // Two requests with the same email can both get past the check above
        if (err.code === DUPLICATE_KEY_CODE) {
            throw new helpers.HttpError(400, DUPLICATE_EMAIL_MESSAGE);
        }
        throw err;
    }
    helpers.sendSuccess(res, 201, user);
}

module.exports = function (router) {

    router.route('/users')
        .get(queries.getList(User))
        .post(createUser);

    router.route('/users/:id').get(queries.getOne(User, 'User'));

    return router;
}
