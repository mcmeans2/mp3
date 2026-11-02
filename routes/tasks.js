var Task = require('../models/task.js');
var helpers = require('./helpers.js');
var queries = require('./queries.js');
var validation = require('./validation.js');

var DEFAULT_TASK_LIMIT = 100;

async function createTask(req, res) {
    var fields = validation.parseTask(req);

    // TODO (bucket 5): assign the task to fields.assignedUser. Until then it stays unassigned.
    var task = await Task.create({
        name: fields.name,
        description: fields.description,
        deadline: fields.deadline,
        completed: fields.completed
    });
    helpers.sendSuccess(res, 201, task);
}

module.exports = function (router) {

    router.route('/tasks')
        .get(queries.getList(Task, DEFAULT_TASK_LIMIT))
        .post(createTask);

    router.route('/tasks/:id').get(queries.getOne(Task, 'Task'));

    return router;
}
