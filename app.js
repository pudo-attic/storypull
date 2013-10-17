var express = require('express'),
    mongo = require('mongodb'),
    Q = require('q');

var mongoUri = process.env.MONGOLAB_URI ||
  process.env.MONGOHQ_URL ||
  'mongodb://localhost/storypull';

var dbQ = Q.defer(),
    dbPromise = dbQ.promise;

mongo.Db.connect(mongoUri, function (err, db) {
    dbQ.resolve(db);
});

var app = express();
app.use(express.logger());
app.use(express.bodyParser());
app.use(express.errorHandler());
app.use(express.static(__dirname + '/static'));

app.get('/api/status', function(req, res) {
    dbPromise.done(function(db) {
        res.jsonp({'status': 'ok'});
    });
});

app.post('/api/import', function(req, res){
    dbPromise.done(function(db) {
        var stories = req.body.stories || [];
        var storiesColl = db.collection('stories');
        var grafsColl = db.collection('grafs');

        stories.forEach(function(story) {
            var grafs = story.grafs || [];

            grafsColl.remove({'story': story.slug}, {}, function(err, docs) {
                grafs.forEach(function(graf) {
                    graf.story = story.slug;
                    grafsColl.insert(graf, function(err, docs) {});
                });
            });
            delete story.grafs;
            storiesColl.update({'slug': story.slug}, story, {'upsert': true}, function(err, docs) {});
        });
        res.jsonp({'status': 'ok'});
    });
});

var port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port);
console.log('Listening on port ' + port);

