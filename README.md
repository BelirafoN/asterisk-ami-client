# Asterisk AMI Client for NodeJS (ES2015)

[![Build Status](https://travis-ci.org/BelirafoN/asterisk-ami-client.svg?branch=master)](https://travis-ci.org/BelirafoN/asterisk-ami-client)
[![Coverage Status](https://coveralls.io/repos/github/BelirafoN/asterisk-ami-client/badge.svg?branch=master)](https://coveralls.io/github/BelirafoN/asterisk-ami-client?branch=master)
[![Code Climate](https://codeclimate.com/github/BelirafoN/asterisk-ami-client/badges/gpa.svg)](https://codeclimate.com/github/BelirafoN/asterisk-ami-client)
[![npm version](https://badge.fury.io/js/asterisk-ami-client.svg)](https://badge.fury.io/js/asterisk-ami-client)

Full functionality client for Asterisk's AMI. Support any data packages (action/event/response/custom responses) from AMI; 
With this client you can select you'r own case of programming interactions with Asterisk AMI.  

If you like events & handlers - you can use it!  
If you like promises - you can use it!  
If you like `co` & sync-style of code - you can use it! 

1. [Install](#install)
2. [Usage](#usage)
    * [Example 1](#example-1)
    * [Example 2](#example-2)
    * [Example 3](#example-3)
    * [Example 4](#example-4)
    * [Example 5](#example-5)
3. [More examples](#more-examples)
4. [Docs & internal details](#docs--internal-details)
    * [Events](#events)
    * [Client's parameters](#clients-parameters)
    * [Methods](#methods)
    * [Properties](#properties) 
5. [Tests](#tests)
6. [License](#license)

## Install 

```bash
$ npm i asterisk-ami-client
```

## NodeJS versions 

support `>=4.0.0`

## Usage 

It is only some usage cases.

#### Example 1:
 
Listening all events on instance of client;
 
```javascript
const AmiClient = require('asterisk-ami-client');
let client = new AmiClient();

client.connect('user', 'secret', {host: 'localhost', port: 5038})
 .then(amiConnection => {

     client
         .on('connect', () => console.log('connect'))
         .on('event', event => console.log(event))
         .on('data', chunk => console.log(chunk))
         .on('response', response => console.log(response))
         .on('disconnect', () => console.log('disconnect'))
         .on('reconnection', () => console.log('reconnection'))
         .on('internalError', error => console.log(error))
         .action({
             Action: 'Ping'
         });

     setTimeout(() => {
         client.disconnect();
     }, 5000);

 })
 .catch(error => console.log(error));
```
 
#### Example 2: 

Receive Asterisk's AMI responses with promise-chunk.

```javascript
const AmiClient = require('asterisk-ami-client');
let client = new AmiClient({reconnect: true});

client.connect('username', 'secret', {host: '127.0.0.1', port: 5038})
    .then(() => { // any action after connection
        return client.action({Action: 'Ping'}, true);
    })
    .then(response1 => { // response of first action
        console.log(response1);
    })
    .then(() => { // any second action
        return client.action({Action: 'Ping'}, true);
    })
    .then(response2 => { // response of second action
        console.log(response2)
    })
    .catch(error => error)
    .then(error => {
        client.disconnect(); // disconnect
        if(error instanceof Error){ throw error; }
    });
```
or with `co`-library for sync-style of code 

#### Example 3:

Receive Asterisk's AMI responses with `co`.

```javascript
const AmiClient = require('asterisk-ami-client');
const co = require('co');

let client = new AmiClient({reconnect: true});

co(function* (){
    yield client.connect('username', 'secret', {host: '127.0.0.1', port: 5038});

    let response1 = yield client.action({Action: 'Ping'}, true);
    console.log(response1);

    let response2 = yield client.action({Action: 'Ping'}, true);
    console.log(response2);

    client.disconnect();
}).catch(error => console.log(error));
```

#### Example 4:

Listening `event` and `response` events on instance of client. 

```javascript
const AmiClient = require('asterisk-ami-client');

let client = new AmiClient({
    reconnect: true,
    keepAlive: true
});

client.connect('user', 'secret', {host: 'localhost', port: 5038})
    .then(() => {
        client
            .on('event', event => console.log(event))
            .on('response', response => {
                console.log(response);
                client.disconnect();
            })
            .on('internalError', error => console.log(error));

        client.action({Action: 'Ping'});
    })
    .catch(error => console.log(error));
```

### Example 5:

Emit events by names and emit of response by `resp_${ActionID}` 
(if ActionID is set in action's data package).

```javascript
const AmiClient = require('asterisk-ami-client');

let client = new AmiClient({
    reconnect: true,
    keepAlive: true,
    emitEventsByTypes: true,
    emitResponsesById: true
});

client.connect('user', 'secret', {host: 'localhost', port: 5038})
    .then(() => {
        client
            .on('Dial', event => console.log(event))
            .on('Hangup', event => console.log(event))
            .on('Hold', event => console.log(event))
            .on('Bridge', event => console.log(event))
            .on('resp_123', response => {
                console.log(response);
                client.disconnect();
            })
            .on('internalError', error => console.log(error));

        client.action({
            Action: 'Ping',
            ActionID: 123
        });
    })
    .catch(error => console.log(error));
```

## More examples

For more examples, please, see `./examples/*`. 

## Docs & internal details

### Events 

* `connect` - emits when client was connected;
* `event` - emits when was received a new event of Asterisk;
* `data` - emits when was received a new chunk of data form the Asterisk's socket;
* `response` -  emits when was received a new response of Asterisk;
* `disconnect` -  emits when client was disconnected;
* `reconnection` -  emits when client tries reconnect to Asterisk;
* `internalError` - emit when happens something very bad. Like a disconnection from Asterisk and etc;
* `${eventName}` - emits when was received event with name `eventName` of Asterisk and parameter `emitEventsByTypes` was set to `true`. [See example 5](#example-5);
* `${resp_ActionID}` - emits when was received response with `ActionID` of Asterisk and parameter `emitResponsesById` was set to `true`. [See example 5](#example-5).

### Client's parameters 

Default values: 

```javascript
{
    reconnect: false,
    maxAttemptsCount: 30,
    attemptsDelay: 1000,
    keepAlive: false,
    keepAliveDelay: 1000,
    emitEventsByTypes: true,
    eventTypeToLowerCase: false,
    emitResponsesById: true,
    dontDeleteSpecActionId: false,
    addTime: false,
    eventFilter: null  // filter disabled
}
```

* `reconnect` - auto reconnection;
* `maxAttemptsCount` - max count of attempts when client tries to reconnect to Asterisk;
* `attemptsDelay` - delay (ms) between attempts of reconnection;
* `keepAlive` - when is `true`, client send `Action: Ping` to Asterisk automatic every minute;
* `keepAliveDelay` - delay (ms) between keep-alive actions, when parameter `keepAlive` was set to `true`;
* `emitEventsByTypes` - when is `true`, client will emit events by names. See [example 5](#example-5);
* `eventTypeToLowerCase` - when is `true`, client will emit events by names in lower case. Uses with `emitEventsByTypes`;
* `emitResponsesById` - when is `true` and data package of action has ActionID field, client will emit responses by `resp_ActionID`. See [example 5](#example-5);
* `dontDeleteSpecActionId` - when is `true`, client will not hide generated ActionID field in responses;
* `addTime` - when is `true`, client will be add into events and responses field `$time` with value equal to ms-timestamp;
* `eventFilter` - object, array or Set with names of events, which will be ignored by client. 

### Methods 

* `.connect(username, secret[, options])` - connect to Asterisk. See [examples](#usage);
*  `.disconnect()` - disconnect from Asterisk;
*  `.action(message)` - send new action to Asterisk;
*  `.write(message)` - alias of `action` method;
*  `.send(message)` - alias of `action` method;
*  `.option(name[, value])` - get or set option of client;
*  `.options([newOptions])` - get or set all options of client.

### Properties
 
Getters

* `lastEvent` - last event, which was receive from Asterisk;
* `lastResponse` - last response which was receive from Asterisk; 
* `isConnected` - status of current connection to Asterisk;
* `lastAction` -  last action data which was transmitted to Asterisk;
* `connection` - get current amiConnection.

## Tests 

Tests require [Mocha](https://mochajs.org/). 

```bash 
mocha ./tests
``` 

or with `npm` 

```bash
npm test 
```

Test coverage with [Istanbul](https://gotwarlost.github.io/istanbul/) 

```bash
npm run coverage
```

## License 

Licensed under the MIT License
