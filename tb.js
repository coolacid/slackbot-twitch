var Slack = require('slack-client');
var http = require('https');
var irc = require('irc');

var token = '';

var ircbotname = ''
var ircbotpass = ''

var sendstreamertogeneral = true;

var streamers = ['']

// NOTHING TO EDIT BEYOND HERE
var metadata = {}
var ircbotchan = []

var slack = new Slack(token, true, true);
 
slack.on('open', function () {

    var channels = Object.keys(slack.channels)
        .map(function (k) { return slack.channels[k]; })
        .filter(function (c) { return c.is_member; })
        .map(function (c) { return c.name; });
 
    var groups = Object.keys(slack.groups)
        .map(function (k) { return slack.groups[k]; })
        .filter(function (g) { return g.is_open && !g.is_archived; })
        .map(function (g) { return g.name; });
 
    console.log('Welcome to Slack. You are ' + slack.self.name + ' of ' + slack.team.name);
 
    if (channels.length > 0) {
        console.log('You are in: ' + channels.join(', '));
    }
    else {
        console.log('You are not in any channels.');
    }
 
    if (groups.length > 0) {
       console.log('As well as: ' + groups.join(', '));
    }

//    channel_general = slack.getChannelByName("general")
//    channel_general.send("Hey! I've just started again. There may be missing twitch notifications.")

});

init()
slack.login();
start_ircbot();

function init() {
    streamers.forEach(function(item) {
        metadata[item] = {}
        metadata[item]["statechange"] = Date.now()
        metadata[item]["state"] = false
        ircbotchan.push("#" + item)
    })
    setInterval(streamer_statuspoll, 10000);
}

function streamer_statuspoll() {
    streamers.forEach(function(item) {
        streamer_poll(item)
    })
}

function sendslackmessage (room, message) {
    if (slack.connected) {
      var channels = Object.keys(slack.channels)
        .map(function (k) { return slack.channels[k]; })
        .filter(function (c) { return c.is_member; })
        .map(function (c) { return c.name; });
 
      var groups = Object.keys(slack.groups)
        .map(function (k) { return slack.groups[k]; })
        .filter(function (g) { return g.is_open && !g.is_archived; })
        .map(function (g) { return g.name; });

      if (channels.indexOf(room) > -1 || groups.indexOf(room) > -1) {
            sChannel = slack.getChannelGroupOrDMByName(room)
            sChannel.send(message)
      } else {
            sChannel = slack.getChannelByName("dev") 
            sChannel.send("I need to be invited to: " + room)
      }
    }
}

function streamer_poll(channel) {
    var url = 'https://api.twitch.tv/kraken/streams/' + channel;

    http.get(url, function(res) {
        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            var fbResponse = JSON.parse(body)
            if (fbResponse.stream == null) {
                if (metadata[channel]["state"] == true & (Date.now() - metadata[channel]["statechange"] > 60000)) {
                    console.log (channel + " Streamer offline")
                    sendslackmessage("twitch_" + channel, "Streamer has gone offline")
                    if (sendstreamertogeneral) sendslackmessage("general", channel + " has gone offline")
		    metadata[channel]["statechange"] = Date.now()
            	    metadata[channel]["state"] = false
                }
            } else {
                if (metadata[channel]["state"] == false & (Date.now() - metadata[channel]["statechange"] > 60000)) {
                    console.log (channel + " Streamer online")
                    sendslackmessage("twitch_" + channel, "Streamer has gone online")
                    if (sendstreamertogeneral) sendslackmessage("general", channel + " has gone online")
		    metadata[channel]["statechange"] = Date.now()
		    metadata[channel]["state"] = true
                }
            }
        });
    }).on('error', function(e) {
        console.log("Got error: ", e);
    });
}


function start_ircbot() {
    // Start the IRC Bot to listen for new subscribers
    bot = new irc.Client('irc.twitch.tv', ircbotname, {
        debug: false,
        channels: ircbotchan,
        password: ircbotpass
    });

    bot.addListener('error', function(message) {
        console.error('ERROR: %s: %s', message.command, message.args.join(' '));
    });

    bot.addListener('message', function (from, to, message) {
        if ( from.match(/^twitchnotify$/) ) {
            sendslackmessage ("twitch_" + to.replace(/^\#/, ''), message)
            console.log ("from: " + from + "  |  to: " + to + "  |  message: " + message)
        }
    });
}
