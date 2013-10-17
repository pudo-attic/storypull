var express = require('express'),
    mongo = require('mongodb'),
    Q = require('q');

var mongoUri = process.env.MONGOLAB_URI ||
  process.env.MONGOHQ_URL ||
  'mongodb://localhost/newspull';

var dbQ = Q.defer(),
    dbPromise = dbQ.promise;

mongo.Db.connect(mongoUri, function (err, db) {
    dbQ.resolve(db);
});

var app = express();
app.use(express.logger());
app.use(express.errorHandler());
app.use(express.static(__dirname + '/static'));

app.get('/', function(req, res) {
    dbPromise.done(function(db) {
        console.log(db);
        res.send('Hello World');
    });
});

var port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port);
console.log('Listening on port ' + port);

