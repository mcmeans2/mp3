var Task = require('../models/task.js');
var queries = require('./queries.js');

var DEFAULT_TASK_LIMIT = 100;

module.exports = function (router) {

    router.route('/tasks').get(queries.getList(Task, DEFAULT_TASK_LIMIT));

    router.route('/tasks/:id').get(queries.getOne(Task, 'Task'));

    return router;
}
