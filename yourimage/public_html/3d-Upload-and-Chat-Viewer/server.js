var express = require('express')
  , app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);

server.listen(8095);

app.use(express.cookieParser())
   .use(express.bodyParser())
   .use(express.cookieSession({
     secret: "stupid"
   }))
   .use(express.static(__dirname + '/static'));

app.get('/', function(req, res) {
  res.render('index.ejs', { email: req.session.email || null });
});

// usernames which are currently connected to the chat
var usernames = {};

// rooms which are currently available in chat
var rooms = {};

app.get('/:room', function (req, res, next) {
    if (rooms[req.params.room]){
        console.log('Sent');
        res.render('room.ejs', { email: req.session.email || null });
    } else {
       console.log('Redirected');
       res.redirect('/'); 
    }
});

io.sockets.on('connection', function (socket) {

  // when the client emits 'adduser', this listens and executes
  socket.on('adduser', function(username){
    socket.username = username;
    usernames[username] = username;
  });

  socket.on('addroom', function(room){
    socket.join(room);
    socket.emit('updatechat', 'SERVER', 'you have connected to '+ room);
    socket.rooms = room;
    rooms[room] = room;
    socket.broadcast.to(room).emit('updatechat', 'SERVER', socket.username+' has joined this room');
    socket.emit('updaterooms', rooms, room);
  });

  // when the client emits 'sendchat', this listens and executes
  socket.on('sendchat', function (data) {
    // we tell the client to execute 'updatechat' with 2 parameters
    io.sockets.in(socket.room).emit('updatechat', socket.username, data);
  });

  socket.on('switchRoom', function(newroom){
    socket.leave(socket.room);
    socket.join(newroom);
    socket.emit('updatechat', 'SERVER', 'you have connected to '+ newroom);
    // sent message to OLD room
    socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username+' has left this room');
    // update socket session room title
    socket.room = newroom;
    rooms[newroom] = newroom;
    socket.broadcast.to(newroom).emit('updatechat', 'SERVER', socket.username+' has joined this room');
    socket.emit('updaterooms', rooms, newroom);
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function(){
    // remove the username from global usernames list
    delete usernames[socket.username];
    // update list of users in chat, client-side
    io.sockets.emit('updateusers', usernames);
    // echo globally that this client has left
    socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' has disconnected');
    socket.leave(socket.room);
  });

});
