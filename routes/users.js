var User = require('../models/user.js');
var Task = require('../models/task.js');
var helpers = require('./helpers.js');
var queries = require('./queries.js');
var validation = require('./validation.js');

var HttpError = helpers.HttpError;

var DUPLICATE_EMAIL_MESSAGE = 'That email is already used by another user';
var DUPLICATE_KEY_CODE = 11000;
var UNASSIGNED = { assignedUser: '', assignedUserName: 'unassigned' };

async function checkEmailIsFree(user, email) {
    if (await User.exists({ email: email, _id: { $ne: user._id } })) {
        throw new HttpError(400, DUPLICATE_EMAIL_MESSAGE);
    }
}

async function checkTasksCanBeAssigned(taskIds) {
    var tasks = await Task.find({ _id: { $in: taskIds } }).lean();
    if (tasks.length !== taskIds.length) {
        throw new HttpError(404, 'A task in pendingTasks was not found');
    }
    if (tasks.some(function (task) { return task.completed; })) {
        throw new HttpError(400, 'A completed task cannot be in pendingTasks');
    }
}

// Make the tasks match the user's new pendingTasks
async function syncTasks(user, oldTaskIds) {
    var userId = String(user._id);
    var newTaskIds = Array.from(user.pendingTasks);
    var removedTaskIds = oldTaskIds.filter(function (id) {
        return !newTaskIds.includes(id);
    });

    await Task.updateMany({ _id: { $in: removedTaskIds } }, UNASSIGNED);
    // A task can only have one user, so take the new tasks away from anyone else who has them
    await User.updateMany(
        { _id: { $ne: userId }, pendingTasks: { $in: newTaskIds } },
        { $pull: { pendingTasks: { $in: newTaskIds } } }
    );
    await Task.updateMany({ _id: { $in: newTaskIds } }, { assignedUser: userId });
    // This also catches a changed name on tasks the user already had, completed ones included
    await Task.updateMany({ assignedUser: userId }, { assignedUserName: user.name });
}

// Shared by POST and PUT. Every check runs before anything is written.
async function saveUser(user, fields) {
    await checkEmailIsFree(user, fields.email);
    await checkTasksCanBeAssigned(fields.pendingTasks);

    var oldTaskIds = Array.from(user.pendingTasks);
    user.set(fields);
    try {
        await user.save();
    } catch (err) {
        // Two requests with the same email can both get past the check above
        if (err.code === DUPLICATE_KEY_CODE) {
            throw new HttpError(400, DUPLICATE_EMAIL_MESSAGE);
        }
        throw err;
    }
    await syncTasks(user, oldTaskIds);
}

async function createUser(req, res) {
    var fields = validation.parseUser(req);
    var user = new User();
    await saveUser(user, fields);
    helpers.sendSuccess(res, 201, user);
}

async function replaceUser(req, res) {
    var user = await queries.findExisting(User, req.params.id, 'User');
    var fields = validation.parseUser(req);
    await saveUser(user, fields);
    helpers.sendSuccess(res, 200, user);
}

async function deleteUser(req, res) {
    var user = await queries.findExisting(User, req.params.id, 'User');
    await Task.updateMany({ assignedUser: String(user._id) }, UNASSIGNED);
    await user.deleteOne();
    res.status(204).end();
}

module.exports = function (router) {

    router.route('/users')
        .get(queries.getList(User))
        .post(createUser);

    router.route('/users/:id')
        .get(queries.getOne(User, 'User'))
        .put(replaceUser)
        .delete(deleteUser);

    return router;
}
