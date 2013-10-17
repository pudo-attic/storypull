var express = require('express'),
    mongo = require('mongodb'),
    Q = require('q'),
    passport = require('passport'),
    TwitterStrategy = require('passport-twitter').Strategy;


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
app.use(express.errorHandler());
app.use(express.static(__dirname + '/static'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({ secret: process.env.SECRET || 'foobar' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: process.env.TWITTER_CALLBACK_URL
  },
  function(token, tokenSecret, profile, done) {
    dbPromise.done(function(db) {
        var usersColl = db.collection('users');
        delete profile._json.status;
        delete profile._json.entities;

        usersColl.findOne({'screen_name': profile.username}, function(err, user) {
            if (user!==null) {
                done(null, user);
            }
            usersColl.insert(profile._json, function(err, docs) {
                done(null, docs);
            });
        });
    });
  }
));

passport.serializeUser(function(user, done) {
    done(null, user.screen_name);
});

passport.deserializeUser(function(id, done) {
    dbPromise.done(function(db) {
        var usersColl = db.collection('users');
        usersColl.findOne({'screen_name': id}, function(err, user) {
            done(err, user);
        });
    });
});

app.get('/api/status', function(req, res) {
    dbPromise.done(function(db) {
        res.jsonp({'status': 'ok', 'user': req.user});
    });
});

app.get('/api/auth/twitter', passport.authenticate('twitter'));

app.get('/api/auth/callback',
  passport.authenticate('twitter', { successRedirect: '/',
                                     failureRedirect: '/' }));

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
            story.uri = makeUri(req, '/api/stories/' + story.slug);
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

