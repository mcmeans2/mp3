var helpers = require('./helpers.js');

/*
 * Connect all of your endpoints together here.
 */
module.exports = function (app, router) {
    require('./home.js')(router);
    require('./users.js')(router);
    require('./tasks.js')(router);
    app.use('/api', router);

    // These must come after the routes so they only catch what the routes did not handle
    app.use(helpers.handleNotFound);
    app.use(helpers.handleError);
};
