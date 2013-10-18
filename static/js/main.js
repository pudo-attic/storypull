var storypull = angular.module('storypull', []);

storypull.config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/story/:slug', {
        templateUrl: 'story.html',
        controller: 'StoryCtrl'
    }).
    when('/', {
        templateUrl: 'story-list.html',
        controller: 'StoryListCtrl'
    }).
    otherwise({
        redirectTo: '/'
    });
}]);

function AppCtrl($scope, $window, $routeParams, $http) {
    $http.get('/api/status').success(function(data) {
        $scope.status = data;
        $scope.current_user = data.user;
        $scope.logged_in = !!data.user;
        console.log(data, $scope.logged_in);
    });
}

function StoryListCtrl($scope, $location, $http) {
    $http.get('/api/stories').success(function(data) {
        $scope.stories = data.results;
    });
}

function StoryCtrl($scope, $location, $routeParams, $http) {
    $scope.slug = $routeParams.slug;
    $scope.reviewMode = false;
    $scope.isReviewer = false;
    
    function handleUpdate(story) {
        var contributors = [], cn = [];
        
        story.grafs.forEach(function(graf) {
            if (graf.author != story.author && cn.indexOf(graf.author) == -1) {
                cn.push(graf.author);
                contributors.push(graf.author_data);
            }
            graf.editing = false;
            graf.minor = true;
            graf.contributed = (graf.author != story.author);
        });
        story.contributors = contributors;
        $scope.isReviewer = $scope.logged_in && (story.author == $scope.current_user.screen_name);
        $scope.story = story;
    }

    $scope.toggleReviewMode = function(opt) {
        $scope.reviewMode = opt;
        $scope.story.grafs.forEach(function(graf) {
            graf.editing = false;
        });
        return false;
    };

    $scope.edit = function(graf) {
        if (!$scope.logged_in) {
            document.location = '/api/auth/twitter';
        } else {
            graf.editing = true;
        }
    };

    $scope.update = function(obj) {
        var graf = angular.copy(obj);
        obj.editing = false;
        delete graf.editing;
        delete graf.contributed;

        $http.post('/api/stories/' + $scope.slug + '/graf', graf).success(handleUpdate);
    };

    $scope.approve = function(graf) {
        $http.post('/api/stories/' + $scope.slug + '/approve/' + graf.key + '/' + graf._id, {}).success(handleUpdate);
    };
    
    $http.get('/api/stories/' + $scope.slug).success(handleUpdate);
}
