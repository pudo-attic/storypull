var express = require('express');
var mongo = require('mongodb');

var mongoUri = process.env.MONGOLAB_URI ||
  process.env.MONGOHQ_URL ||
  'mongodb://localhost/newspull';

mongo.Db.connect(mongoUri, function (err, db) {
    console.log('success!');
});

var app = express();
app.use(express.logger());
app.use(express.errorHandler());
app.use(express.static(__dirname + '/static'));

app.get('/', function(req, res){
    res.send('Hello World');
});

var port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port);
console.log('Listening on port ' + port);

