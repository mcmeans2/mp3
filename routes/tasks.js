var Task = require('../models/task.js');
var User = require('../models/user.js');
var helpers = require('./helpers.js');
var queries = require('./queries.js');
var validation = require('./validation.js');

var HttpError = helpers.HttpError;

var DEFAULT_TASK_LIMIT = 100;
var UNASSIGNED_NAME = 'unassigned';

// Check that assignedUser and assignedUserName agree, and return the name to store
async function resolveAssignedUserName(fields) {
    var name = fields.assignedUserName;
    if (fields.assignedUser === '') {
        if (name !== '' && name !== UNASSIGNED_NAME) {
            throw new HttpError(400, 'The assignedUserName does not match the assignedUser');
        }
        return UNASSIGNED_NAME;
    }

    var user = await User.findById(fields.assignedUser).lean();
    if (!user) {
        throw new HttpError(404, 'The assigned user was not found');
    }
    if (name !== '' && name !== user.name) {
        throw new HttpError(400, 'The assignedUserName does not match the assignedUser');
    }
    return user.name;
}

// Make the users' pendingTasks match the task
async function syncUsers(task) {
    var taskId = String(task._id);
    var isPending = task.assignedUser !== '' && !task.completed;

    var usersToRemoveFrom = { pendingTasks: taskId };
    if (isPending) {
        usersToRemoveFrom._id = { $ne: task.assignedUser };
    }
    await User.updateMany(usersToRemoveFrom, { $pull: { pendingTasks: taskId } });

    if (isPending) {
        await User.updateOne({ _id: task.assignedUser }, { $addToSet: { pendingTasks: taskId } });
    }
}

// Shared by POST and PUT. Every check runs before anything is written.
async function saveTask(task, fields) {
    fields.assignedUserName = await resolveAssignedUserName(fields);
    task.set(fields);
    await task.save();
    await syncUsers(task);
}

async function createTask(req, res) {
    var fields = validation.parseTask(req);
    var task = new Task();
    await saveTask(task, fields);
    helpers.sendSuccess(res, 201, task);
}

async function replaceTask(req, res) {
    var task = await queries.findExisting(Task, req.params.id, 'Task');
    var fields = validation.parseTask(req);
    await saveTask(task, fields);
    helpers.sendSuccess(res, 200, task);
}

async function deleteTask(req, res) {
    var task = await queries.findExisting(Task, req.params.id, 'Task');
    var taskId = String(task._id);
    await User.updateMany({ pendingTasks: taskId }, { $pull: { pendingTasks: taskId } });
    await task.deleteOne();
    res.status(204).end();
}

module.exports = function (router) {

    router.route('/tasks')
        .get(queries.getList(Task, DEFAULT_TASK_LIMIT))
        .post(createTask);

    router.route('/tasks/:id')
        .get(queries.getOne(Task, 'Task'))
        .put(replaceTask)
        .delete(deleteTask);

    return router;
}
