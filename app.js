var express = require('express'),
    mongo = require('mongodb'),
    Q = require('q'),
    passport = require('passport'),
    TwitterStrategy = require('passport-twitter').Strategy,
    MongoStore = require('connect-mongo')(express);


var mongoUri = process.env.MONGOLAB_URI ||
  process.env.MONGOHQ_URL ||
  'mongodb://localhost/storypull';

var dbQ = Q.defer(),
    dbPromise = dbQ.promise;

mongo.Db.connect(mongoUri, function (err, db) {
    db.users = db.collection('users');
    db.stories = db.collection('stories');
    db.grafs = db.collection('grafs');
    dbQ.resolve(db);
});

function makeUri(req, path) {
    return req.protocol + "://" + req.get('host') + path;
}

function makeUUID() {
    return 'xxxxxxxxxxxx'.replace(/[x]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

function getProfiles(screen_names, callback) {
    dbPromise.done(function(db) {
        db.users.find({'screen_name': {'$in': screen_names}}).toArray(function(err, results) {
            var profiles = {};
            results.forEach(function(p) {
                profiles[p.screen_name] = p;
            });
            callback(profiles);
        });
    });
}

function getStory(req, slug, callback, errCallback) {
    dbPromise.done(function(db) {
        db.stories.findOne({'slug': req.params.slug}, function(err, story) {
            if (err) {
                return errCallback(err);
            }
            if (story===null) {
                return errCallback({'status': 'Not found'});
            }
            story.uri = makeUri(req, '/api/stories/' + story.slug);
            var options = {'sort': [['sequence', 1], ['created_at', 1]]};
            db.grafs.find({'story': story.slug, 'old': false}, options).toArray(function(err, results) {
                if (err) {
                    return errCallback(err);
                }
                var screen_names = [story.author];
                story.grafs = results;
                story.grafs.forEach(function(g) {
                    if (g.author && screen_names.indexOf(g.author) == -1) {
                        screen_names.push(g.author);
                    }
                });
                getProfiles(screen_names, function(profiles) {
                    story.author_data = profiles[story.author];
                    story.grafs.forEach(function(g) {
                        g.author_data = profiles[g.author];
                    });
                    return callback(story, db);
                });
            });
        });
    });
}

var app = express();
app.use(express.logger());
app.use(express.errorHandler());
app.use(express.static(__dirname + '/static'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({
  store: new MongoStore({
    url: mongoUri
  }),
  secret: '1234567890QWERTY'
}));
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
        delete profile._json.status;
        delete profile._json.entities;

        db.users.findOne({'screen_name': profile.username}, function(err, user) {
            if (user!==null) {
                done(null, user);
            }
            db.users.insert(profile._json, function(err, user) {
                done(null, user[0]);
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
        db.users.findOne({'screen_name': id}, function(err, user) {
            done(err, user);
        });
    });
});

app.get('/api/status', function(req, res) {
    res.jsonp({'status': 'ok', 'user': req.user});
});

app.get('/api/auth/twitter', passport.authenticate('twitter'));

app.get('/api/auth/callback',
  passport.authenticate('twitter', { successRedirect: '/',
                                     failureRedirect: '/' }));

app.post('/api/import', function(req, res){
    dbPromise.done(function(db) {
        var stories = req.body.stories || [];

        stories.forEach(function(story) {
            var grafs = story.grafs || [];
            story.created_at = new Date();
            story.last_change = story.created_at;

            db.grafs.remove({'story': story.slug}, {}, function(err, docs) {
                grafs.forEach(function(graf, sequence) {
                    graf.story = story.slug;
                    graf.sequence = sequence + 1;
                    graf.key = makeUUID();
                    graf.old = graf.old || false;
                    graf.created_at = story.created_at;
                    db.grafs.insert(graf, function(err, docs) {});
                });
            });
            delete story.grafs;
            db.stories.update({'slug': story.slug}, story, {'upsert': true}, function(err, docs) {});
        });
        res.jsonp({'status': 'ok'});
    });
});

app.get('/api/stories', function(req, res) {
    dbPromise.done(function(db) {
        db.stories.find().toArray(function(err, results) {
            results.forEach(function(story) {
                story.uri = makeUri(req, '/api/stories/' + story.slug);
            });
            res.jsonp({'results': results});
        });
    });
});

app.get('/api/stories/:slug', function(req, res) {
    getStory(req, req.params.slug, function(story) {
        res.jsonp(story);
    }, function(err) {
        res.status(404).jsonp(err);
    });
});

app.post('/api/stories/:slug/graf', function(req, res) {
    getStory(req, req.params.slug, function(story, db) {
        var graf = req.body;

        if (!story) {
            res.status(404).jsonp({'status': 'No such story'});
        }

        if (!req.user) {
            res.status(401).jsonp({'status': 'Not logged in'});
        }

        if (!graf || !graf.text || graf.text.length===0) {
            res.status(400).jsonp({'status': 'No text'});
        }

        if (graf._id) {
            delete graf._id;
        }

        graf.latest = true;
        if (!graf.author) {
            graf.author = req.user.screen_name;
        }
        graf.author = (story.author == req.user.screen_name) ? graf.author : req.user.screen_name;
        graf.approved = (story.author == req.user.screen_name);
        graf.current = graf.approved;
        graf.old = false;
        graf.created_at = new Date();

        if (!graf.key && !graf.sequence) {
            var max = 0;
            // todo: generate and update sequence - implement shifting.
            story.grafs.forEach(function(g) {
                if (g.sequence > max) {
                    max = g.sequence;
                }
            });
            graf.sequence = max + 1;
        }

        graf.key = graf.key || makeUUID();

        db.stories.update({'slug': story.slug}, {'$set': {'last_change': graf.created_at}},
            {}, function(err, docs) {});
        var query = graf.approved ? {'$set': {'current': false, 'latest': false}} : {'$set': {'latest': false}};
        db.grafs.update({'story': story.slug, 'key': graf.key, 'current': true}, {'old': true}, {'multi': true}, function(err, docs) {
            db.grafs.update({'story': story.slug, 'key': graf.key}, query, {'multi': true}, function(err, docs) {
                db.grafs.insert(graf, function(err, docs) {
                    getStory(req, story.slug, function(story) {
                        res.jsonp(story);
                    }, function(err) {
                        res.status(404).jsonp(err);
                    });
                });
            });
        });

    }, function(err) {
        res.status(404).jsonp(err);
    });
});


app.post('/api/stories/:slug/approve/:key/:id', function(req, res) {
    getStory(req, req.params.slug, function(story, db) {
        if (!story) {
            res.status(404).jsonp({'status': 'No such story'});
        }

        if (!req.user || req.user.screen_name != story.author) {
            res.status(401).jsonp({'status': 'Not logged in'});
        }

        db.stories.update({'slug': story.slug}, {'$set': {'last_change': new Date()}},
            {}, function(err, docs) {});
        //res.jsonp(story);
        
        db.grafs.update({'story': story.slug, 'key': req.params.key}, {'$set': {'current': false}},
            {'multi': true}, function(err, docs) {
            db.grafs.update({'_id': mongo.ObjectID(req.params.id)},
                {'$set': {'current': true, 'approved': true}}, {}, function(err, docs) {
                getStory(req, story.slug, function(story) {
                    res.jsonp(story);
                }, function(err) {
                    res.status(404).jsonp(err);
                });
            });
        });
    }, function(err) {
        res.status(404).jsonp(err);
    });
});

var port = parseInt(process.env.PORT, 10) || 3000;
app.listen(port);
//console.log('Listening on port ' + port);

