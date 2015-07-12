# slackbot-twitch
A simple bot todo cool things with slack and twitch

# Sample config.json

justinfan with a string of up to 5 numbers and no password creates an anonomous login to Twitch Chat

```
{
    "irc": {
        "network": "irc.twitch.tv",
        "userName": "justinfan24356",
        "password": "",

        "channels": ["#achannel", "#anotherchannel"]
    },

    "twitch_client_id": "FROM Twitch API Signup",

    "slack_token": "SOME-SOME-KEY",

    "sendstreamertogeneral": true
}
```

# Channel Commands

Private groups in slack follow the format of #twitch_channelname

In such a private group channel you can run the following commands:

  - !stats
    - Game: GameName Viewers: Count Started: Time Up: Uptime: 0:00:00
  - !title
    - Title: StreamTitle Game: GameName

