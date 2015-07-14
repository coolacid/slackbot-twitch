var Slack = require('slack-client');
var request = require('request');
var irc = require('irc');
var fs = require('fs');

var config = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));

var streamers = [];
config.irc.channels.forEach(function(item) {
    streamers.push(item.substr(1));//clean #
});

var metadata = {}

var slack = new Slack(config.slack_token, true, true);

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

//    channel_general = slack.getChannelByName('general')
//    channel_general.send('Hey! I've just started again. There may be missing twitch notifications.')

});

init()
slack.login();
start_ircbot();

function init() {
    streamers.forEach(function(item) {
        metadata[item] = {}
        metadata[item]['statechange'] = Date.now()
        metadata[item]['state'] = false
    })
    setInterval(streamer_statuspoll, 10000);
}

function streamer_statuspoll() {
//    console.log('polling');
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
            sChannel = slack.getChannelByName('dev')
            sChannel.send('I need to be invited to: ' + room)
        }
    }
}

function streamer_poll(channel) {
    // stupidity check
    channel = channel.toLowerCase();

    request({
        url: 'https://api.twitch.tv/kraken/streams/' + channel,
        headers: {
            'Client-ID': config.twitch_client_id
        }
    }, function (error, response, body) {
        if (error) {
            console.log('Generic Error when getting a stream for ' + channel);
            console.log(error);
            return;
        }
        if (response.statusCode != 200) {
            console.log('Not 200 Code from Twitch ' + response.statusCode);
            return;
        }

        try {
            body = JSON.parse(body);
        } catch (Err) {
            console.log('Failed to JSON Parse for ' + channel);
            return;
        }

        if (body.stream == null) {
            if (metadata[channel]['state'] == true & (Date.now() - metadata[channel]['statechange'] > 60000)) {
                console.log (channel + ' Streamer offline')
                sendslackmessage('twitch_' + channel, 'Streamer has gone offline')
                if (config.sendstreamertogeneral) sendslackmessage('general', channel + ' has gone offline')
                metadata[channel]['statechange'] = Date.now()
                metadata[channel]['state'] = false
                metadata[channel]['packet'] = null
            }
        } else {
            if (metadata[channel]['state'] == false & (Date.now() - metadata[channel]['statechange'] > 60000)) {
                console.log (channel + ' Streamer online')
                sendslackmessage('twitch_' + channel, 'Streamer has gone online')
                sendslackmessage('twitch_' + channel, 'Title: ' + body.stream.channel.status + ' Game: ' + body.stream.game);
                if (config.sendstreamertogeneral) sendslackmessage('general', channel + ' has gone online')
                metadata[channel]['statechange'] = Date.now()
                metadata[channel]['state'] = true
            }
            metadata[channel]['packet'] = body.stream;
        }
    });
}

function start_ircbot() {
    // Start the IRC Bot to listen for new subscribers
    bot = new irc.Client(config.irc.network, config.irc.userName, {
        debug: false,
        channels: config.irc.channels,
        password: config.irc.password
    });

    bot.addListener('error', function(message) {
        console.error('ERROR: %s: %s', message.command, message.args.join(' '));
    });

    bot.addListener('message', function (from, to, message) {
        if ( from.match(/^twitchnotify$/) && message.match(/.*(just subscribed|subscribed for .* in a row)!/) ) {
            sendslackmessage ('twitch_' + to.replace(/^\#/, ''), message)
            console.log ('from: ' + from + '  |  to: ' + to + '  |  message: ' + message)
        }
    });
}

slack.on('message', function(message) {
    var channel = slack.getChannelGroupOrDMByID(message.channel);

    if (undefined === channel.is_channel) {
        // is a private channel
        var message_text = message.text.split(' ');
        if (message_text[0] == '!stats') {
            // parse for twitch username as per format
            var streamer = channel.name.substr(7);
            // just in case
            if (undefined !== metadata[streamer]) {
                if (metadata[streamer]['state']) {
                    var d = new Date(metadata[streamer]['packet']['created_at']);
                    var timepacket = convertTime(Date.now(), d.getTime());
                    uptime = timepacket.hours + ':' + timepacket.minutes + ':' + timepacket.seconds;
                    // shave this off if not needed
                    if (timepacket.days > 0) {
                        uptime = timepacket.days + ' days ' + uptime;
                    }

                    sendslackmessage('twitch_' + streamer, 'Game: ' + metadata[streamer]['packet']['game'] + ' Viewers: ' + metadata[streamer]['packet']['viewers'] + ' Started: ' + metadata[streamer]['packet']['created_at'] + ' Up: ' + uptime);
                } else {
                    sendslackmessage('twitch_' + streamer, 'Streamer is not live')
                }
            }
        }
        // code duplicate is a tad more efficent than the additional parsing
        if (message_text[0] == '!title') {
            // parse for twitch username as per format
            var streamer = channel.name.substr(7);
            // just in case
            if (undefined !== metadata[streamer]) {
                if (metadata[streamer]['state']) {
                    sendslackmessage('twitch_' + streamer, 'Title: ' + metadata[streamer]['packet']['channel']['status'] + ' Game: ' + metadata[streamer]['packet']['game']);
                } else {
                    sendslackmessage('twitch_' + streamer, 'Streamer is not live')
                }
            }
        }
    }
});


/* utility functions */
var convertTime = function(date_future, date_now) {
    var packet = {};

    // get total seconds between the times
    var delta = Math.abs(date_future - date_now) / 1000;
    packet.delta = delta;

    // calculate (and subtract) whole days
    var days = Math.floor(delta / 86400);
    delta -= days * 86400;

    // calculate (and subtract) whole hours
    var hours = Math.floor(delta / 3600) % 24;
    delta -= hours * 3600;

    // calculate (and subtract) whole minutes
    var minutes = Math.floor(delta / 60) % 60;
    delta -= minutes * 60;

    if (minutes < 10) {
        minutes = '0' + minutes;
    }

    // what's left is seconds
    var seconds = Math.floor(delta % 60);  // in theory the modulus is not required
    if (seconds < 10) {
        seconds = '0' + seconds;
    }

    packet.days = days;
    packet.hours = hours;
    packet.minutes = minutes;
    packet.seconds = seconds;

    return packet;
}
