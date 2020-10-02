# dc-chartreuse

_an open source project by [wh](https://github.com/wh0),_
_README provided by [Hiroyuki](https://github.com/WeebHiroyuki)._

## What is dc-chartreuse?

dc-chartreuse is a prototype relay system for making Discord bots usable and viable on serverless-hosting platforms such as [Glitch](https://glitch.com) and [Heroku](https://heroku.com).

**Disclaimer:** This is a general introduction and more simplified version of this project. If you would like to read more details and information about this project, feel free to read the [blog post](https://support.glitch.com/t/a-prototype-bot-relay-for-discord/27845) posted by wh. It contains an in-depth explanation of this project, its purpose, some background information concerning the project, as well as the conventions utilized in the process of achieving the project’s goal.

## Introduction to the Project and FAQs (Frequently Asked Questions)

### Why did wh create this project?

Due to the nature and behavior of the [Discord API](https://discord.com/developers/docs/intro), hosting your Discord bot on a serverless hosting provider such as Glitch or Heroku becomes quite difficult.
Heroku and Glitch’s “serverless” design causes complications for developers trying to host and run their Discord bot.
Basically, the Discord API uses a gateway technique. This requires a constant stable connection to be open 24/7 for the bot to operate. This conflicts with Heroku and Glitch’s design because as mentioned previously, it’s serverless, which means that operations will only be performed when a request is made to the server. Once the server becomes inactive again, it will be shut down.
With that being said, wh created this for developers to be able to circumvent Glitch and Heroku’s serverless system by maintaining an active gateway connection.

### A security vulnerability may be involved — a man in the middle.

wh is personally not sure what to tell you to do about this. My personal opinion is to go with something or someone whom you trust and have confidence in. Be extremely careful about whom you give your login credentials to. Keep in mind that wh will not be responsible for your misuse of this project and any disadvantages/problems caused by it.

### How do I host the prototype?

So far, there isn’t an official host developed for this project. wh is still actively looking for a host for it. You can feel free to host an instance yourself for your own bots however. _The prototype can manage multiple bot connections at once._

For setup instructions, see [the setup instructions posted by wh](https://support.glitch.com/t/a-prototype-bot-relay-for-discord/27845/8).

### The Action-Plan — Moving forward with this Prototype

- a Trusted Entity and Relay/“Man-in-the-middle” Resource. _Note: you can do this on your own if you have the resources._
- Load-testing. We would need to start running heavy traffic on the prototype to see what and what not it can handle. This is to guide users to keeping their instance of the prototype stable.
- More technical documentation

_If Discord supports a serverless API, this would ultimately make this project a bigger success._

## Contributions and Contact

If you think that you can contribute to this project in any way, feel free to open a pull request. If you would like to find out more about this and talk to the maintainer more, contact wh on Discord (wh#9692).
