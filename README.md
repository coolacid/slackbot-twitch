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

    "sendstreamertogeneral": true,
    "offline_toggle": 5
}
```

  - irc - holds ALL Irc connection settings
    - network - usually irc.twitch.tv
    - userName - justinfan12345 is an anon login, no password needed
    - password
      - usually oauth:SOMESTRING
      - connecting a Application to a known user with the chat scope parameter
      - blank when Justinfan-ing
  - twitch_client_id - obtained from [Twitch Connections](http://www.twitch.tv/settings/connections)
  - slack_token - you are given this at Bot Creation in Slack Integrations
  - sendstreamertogeneral - send online/offline updates to #general
  - offline_toggle - number of minutes to wait before saying channel is offline 3-5 recommended
