/**************************************************
 ** NODE.JS REQUIREMENTS
 **************************************************/
var util = require("util"),					// Utility resources (logging, object inspection, etc)
    http = require("http"),                 // Http
    mysql = require("mysql"),               // MySql
    async = require("async"),               // Async Module
    Player = require("./Player").Player,
    Simulation = require("./Simulation").Simulation,	// Player class
    flash = require('connect-flash'),
    express = require('express'),
    RedisStore = require('connect-redis')(express),
    redis = require("redis").createClient(),
    sessionStore = new RedisStore({ host: 'localhost', client: redis}),
    passportSocketIo = require("passport.socketio"),
    passport = require('passport'),         //User authentication with passport.js
    LocalStrategy = require('passport-local').Strategy,
    app = express(),
    server = http.createServer(app),        //Allow for express and socket.io to bind to same port
    io = require('socket.io').listen(server),
    cookieParser = express.cookieParser(),
    connect = require('connect'),          //For autheticating socket io using passport.js
    usage = require('usage');

//misc
var domain = 'http://edchnm.gmu.edu',
    basePath = '/microbe/',
    secret = 'ZmQyMWYzMGFlNDQ1YzQzYWE3ODk0OTZk';

/**************************************************
 ** GAME VARIABLES
 **************************************************/
var socket,		// Socket controller
    players;	// Array of connected players

var simulation;


/**************************************************
 ** GAME INITIALISATION
 **************************************************/
function init() {
    // Create an empty array to store players
    players = [];

    app.configure(function() {
        app.set('views', __dirname + '/views');
        app.set('view engine', 'ejs');
        app.use(express.logger());
        app.use(cookieParser);
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express.session({ secret: 'ZmQyMWYzMGFlNDQ1YzQzYWE3ODk0OTZk', store: sessionStore}));
        // Initialize Passport!  Also use passport.session() middleware, to support
        // persistent login sessions (recommended).
        app.use(flash());
        app.use(passport.initialize());
        app.use(passport.session());
        app.use(app.router);
        app.use(express.static(__dirname + '/../../public'));
    });

    // Set up Socket.IO to listen on port 3001
    //socket = io.listen(3001);

    // Configure Socket.IO
    io.configure(function() {
        // Only use WebSockets
        io.set("transports", ["websocket"]);

        // Restrict log output
        io.set("log level", 2);
    });

    io.set("authorization", passportSocketIo.authorize({
        cookieParser: express.cookieParser, //or connect.cookieParser
        key:          'connect.sid',        //the cookie where express (or connect) stores its session id.
        secret:       secret,  //the session secret to parse the cookie
        store:         sessionStore,      //the session store that express uses
        fail: function(data, accept) {      // *optional* callbacks on success or fail
            accept(null, false);              // second param takes boolean on whether or not to allow handshake
        },
        success: function(data, accept) {
            accept(null, true);
        }
    }));

    server.listen(3001);

    simulation = new Simulation();
    simulation.start();

    // Start listening for events
    setEventHandlers();



};


/**************************************************
 ** GAME EVENT HANDLERS
 **************************************************/
var setEventHandlers = function() {
    // Socket.IO
    io.sockets.on("connection", onSocketConnection);
};

// New socket connection
function onSocketConnection(client) {
    util.log("New player has connected: "+client.id);

    // Listen for client disconnected
    client.on("disconnect", onClientDisconnect);

    // Listen for new player message
    client.on("new player", onNewPlayer);

    // Listen for move player message
    client.on("move player", onMovePlayer);

    client.on("update", onUpdate);
};

// Socket client has disconnected
function onClientDisconnect() {
    util.log("Player has disconnected: "+this.id);

    var removePlayer = playerById(this.id);

    // Player not found
    if (!removePlayer) {
        util.log("Player not found: "+this.id);
        return;
    };

    // Remove player from players array
    players.splice(players.indexOf(removePlayer), 1);

    // Broadcast removed player to connected socket clients
    this.broadcast.emit("remove player", {id: this.id});
};

// New player has joined
function onNewPlayer(data) {
    // Create a new player
    var newPlayer = new Player(data.x, data.y);
    newPlayer.id = this.id;

    // Broadcast new player to connected socket clients
    this.broadcast.emit("new player", {id: newPlayer.id, x: newPlayer.getX(), y: newPlayer.getY()});

    // Send existing players to the new player
    var i, existingPlayer;
    for (i = 0; i < players.length; i++) {
        existingPlayer = players[i];
        this.emit("new player", {id: existingPlayer.id, x: existingPlayer.getX(), y: existingPlayer.getY()});
    };

    // Add new player to the players array
    players.push(newPlayer);
};

// Player has moved
function onMovePlayer(data) {
    // Find player in array
    var movePlayer = playerById(this.id);

    // Player not found
    if (!movePlayer) {
        util.log("Player not found: "+this.id);
        return;
    };

    // Update player position
    movePlayer.setX(data.x);
    movePlayer.setY(data.y);

    // Broadcast updated position to connected socket clients
    this.broadcast.emit("move player", {id: movePlayer.id, x: movePlayer.getX(), y: movePlayer.getY()});
};

function onUpdate(data){
    var update = "Running: " + simulation.running + "   Paused: " + simulation.paused + "<br/>   Interpolation: " + simulation.currentInterpolation;
    this.emit("update", {update: update});
}


/**************************************************
 ** GAME HELPER FUNCTIONS
 **************************************************/
// Find player by ID
function playerById(id) {
    var i;
    for (i = 0; i < players.length; i++) {
        if (players[i].id == id)
            return players[i];
    };

    return false;
};


/**************************************************
 ** RUN THE GAME
 **************************************************/
init();

/**************************************************
 ** User Authentication with Passport.js
 **************************************************/
var users = [
    { id: 1, username: 'james', password: 'james', email: 'bob@example.com' }
    , { id: 2, username: 'lara', password: 'lara', email: 'joe@example.com' }
    , { id: 3, username: 'j', password: 'j', email: 'j@example.com' }
];

function findById(id, fn) {
    var idx = id - 1;
    if (users[idx]) {
        fn(null, users[idx]);
    } else {
        fn(new Error('User ' + id + ' does not exist'));
    }
}

function findByUsername(username, fn) {
    for (var i = 0, len = users.length; i < len; i++) {
        var user = users[i];
        if (user.username === username) {
            return fn(null, user);
        }
    }
    return fn(null, null);
}


// Passport session setup.
// To support persistent login sessions, Passport needs to be able to
// serialize users into and deserialize users out of the session. Typically,
// this will be as simple as storing the user ID when serializing, and finding
// the user by ID when deserializing.
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    findById(id, function (err, user) {
        done(err, user);
    });
});


// Use the LocalStrategy within Passport.
// Strategies in passport require a `verify` function, which accept
// credentials (in this case, a username and password), and invoke a callback
// with a user object. In the real world, this would query a database;
// however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy(
    function(username, password, done) {
        // asynchronous verification, for effect...
        process.nextTick(function () {

            // Find the user by username. If there is no user with the given
            // username, or the password is not correct, set the user to `false` to
            // indicate failure and set a flash message. Otherwise, return the
            // authenticated `user`.
            findByUsername(username, function(err, user) {
                if (err) { return done(err); }
                if (!user) { return done(null, false, { message: 'Unknown user ' + username }); }
                if (user.password != password) { return done(null, false, { message: 'Invalid password' }); }
                return done(null, user);
            })
        });
    }
));

app.get('/', function(req, res){
    res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
    res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
    res.render('login', { user: req.user, message: req.flash('error') });
});

// POST /login
// Use passport.authenticate() as route middleware to authenticate the
// request. If authentication fails, the user will be redirected back to the
// login page. Otherwise, the primary route function function will be called,
// which, in this example, will redirect the user to the home page.
//
// curl -v -d "username=bob&password=secret" http://127.0.0.1:3000/login
app.post('/login',
    passport.authenticate('local', { failureRedirect: '/login', failureFlash: true }),
    function(req, res) {
        res.redirect(domain + basePath + 'portal.php');
    });

app.get('/logout', function(req, res){
    req.logout();
    res.redirect(domain + basePath);
});

////////////////////////
//
//Server stat stuff
//
///////////////////////

app.get('/server/loadavg', function(req, res){
    //http://h3manth.com/content/getting-server-info-using-nodejs
    var os = require('os');
    var url = require('url');
    res.writeHead(200, {'Content-Type': 'text/plain'});
    var call = 'loadavg';//hardcode in loadavg
    if( call === "all"){
        Object.keys(os).map(function(method) { res.write(method+":"+JSON.stringify(os[method](),2,true))+","; })
    }
    else{
        try{
            var resu = os[call]();
            res.write(JSON.stringify(resu),'utf8');
        }
        catch(e){
            res.end("Sorry, try on of : "+Object.keys(os).join(", "));
        }
    }
    res.end();
});

app.get('/server/nodecpu', function(req, res){
    var pid = process.pid;
    var options = { keepHistory: true }
    usage.lookup(pid, options, function(err, result) {
        if (err) { return done(err); }
        if(result){ return done(result)}
    });
});

// Simple route middleware to ensure user is authenticated.
// Use this route middleware on any resource that needs to be protected. If
// the request is authenticated (typically via a persistent login session),
// the request will proceed. Otherwise, the user will be redirected to the
// login page.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect(domain + basePath)
}