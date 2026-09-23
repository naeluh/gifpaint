var fs = require('fs');
var bodyParser = require('body-parser');
var express = require('express');

var dataChanged = false;
var foundIt = false;
var dataFile = './db/page.json';
var data = require(dataFile);

var app = express();

app.use(bodyParser.json({
    limit: '5000mb'
}));
app.use(bodyParser.urlencoded({
    limit: '5000mb',
    extended: true
}));

app.use(express.static(__dirname + '/public'));

app.get('/:url_id', function (req, res, next) {
    if (data[req.params.url_id]){
        console.log('Sent Index');
        res.sendFile('/var/www/yourimage/public_html/node_Test/public/index.html');
    } else {
       console.log('Redirected');
       res.redirect('/'); 
    }
});

app.get('/image/:url_id', function (req, res, next) {
    if (data[req.params.url_id]){
        console.log('Sent Image');
        var imgToSend = data[req.params.url_id];
        res.send(imgToSend);
    } else {
       console.log('NotFound');
       res.sendStatus(404);
    }
});

app.get('/image/fs/:url_id', function (req, res, next) {
    if (data[req.params.url_id]){
        console.log('Sent Image');
        var imgToSend = data[req.params.url_id];
        res.send(imgToSend);
    } else {
       console.log('NotFound');
       res.sendStatus(404);
    }
});

app.get('/fs/:url_id', function (req, res, next) {
    if (data[req.params.url_id]){
        console.log('Sent Index');
        res.sendFile('/var/www/yourimage/public_html/node_Test/public/fs/index.html');
    } else {
       console.log('Redirected');
       res.sendFile('/var/www/yourimage/public_html/node_Test/public/fs/404.html');
    }
});

app.get('/contact', function (req, res) {
    res.sendStatus({
        your: 'response'
    });
});

app.post('/contact', function (req, res) {
    var a = req.body.url;
    var b = req.body.img;
    data[a] = b;
    dataChanged = true;
    res.send(a);
    //res.sendStatus(204);
});

setInterval(function () {
    if (!dataChanged) return;

    var str = JSON.stringify(data, null, 4);
    dataChanged = false;

    fs.writeFile(dataFile, str, function (err) {
        console.log(err ? err : 'JSON saved.');
    });

    //res.redirect('/'+a);
}, 10000);

app.listen(5447, function () {
    console.log('listening')
});