$.getJSON( "/api/status", function(data) {
    var loggedIn = !!data.user;
    if(loggedIn) {
        $('#current-user').html(data.user.name || data.user.screen_name);
    }
    $('#sign-in').toggle(!loggedIn);
    $('#session-status').toggle(loggedIn);
});