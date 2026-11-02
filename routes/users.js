var User = require('../models/user.js');
var queries = require('./queries.js');

module.exports = function (router) {

    router.route('/users').get(queries.getList(User));

    router.route('/users/:id').get(queries.getOne(User, 'User'));

    return router;
}
