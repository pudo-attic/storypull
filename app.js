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

function makeUri(req, path) {
    return req.protocol + "://" + req.get('host') + path;
}

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

app.get('/api/stories', function(req, res) {
    dbPromise.done(function(db) {
        var storiesColl = db.collection('stories');
        storiesColl.find().toArray(function(err, results) {
            results.forEach(function(story) {
                story.uri = makeUri(req, '/api/stories/' + story.slug);
            });
            res.jsonp({'results': results});
        });
    });
});

app.get('/api/stories/:slug', function(req, res) {
    dbPromise.done(function(db) {
        var storiesColl = db.collection('stories');
        var grafsColl = db.collection('grafs');

        storiesColl.findOne({'slug': req.params.slug}, function(err, story) {
            if (story===null) {
                res.status(404).jsonp({'status': 'Not found'});
            }
            grafsColl.find({'story': story.slug}).toArray(function(err, results) {
                story.grafs = results;
                res.jsonp(story);
            });
        });
        
    });
});

var port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port);
console.log('Listening on port ' + port);

