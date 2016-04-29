# Asterisk AMI Client for NodeJS (ES2015)

[![Code Climate](https://codeclimate.com/github/BelirafoN/asterisk-ami-client/badges/gpa.svg)](https://codeclimate.com/github/BelirafoN/asterisk-ami-client)
[![npm version](https://badge.fury.io/js/asterisk-ami-client.svg)](https://badge.fury.io/js/asterisk-ami-client)

Full functionality client for Asterisk's AMI. Support any data packages (action/event/response/custom responses) from AMI; 
With this client you can select you'r own case of programming interactions with Asterisk AMI.  

If you like events & handlers - you can use it!  
If you like promises - you can use it!  
If you like `co` & sync-style of code - you can use it! 

## Install 

```bash
$ npm i asterisk-ami-client
```

## NodeJS versions 

support `>=4.0.0`

## Usage 

It is only some usage cases.

#### Example 1: 

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

#### Example 2:

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

#### Example 3:

```javascript
const AmiClient = require('asterisk-ami-client');

let client = new AmiClient({
    reconnect: true,
    keepAlive: true
});

client.connect('user', 'secret', {host: 'localhost', port: 5038})
    .then(() => {
        client
            .on('response', response => {
                console.log(response);
                client.disconnect();
            })
            .on('error', error => console.log(error));

        client.action({Action: 'Ping'});
    })
    .catch(error => console.log(error));
```

## Docs & internal details

comming soon

## More examples

For more examples, please, see `./examples/*`. 

### Tests 

comming soon

### License 

Licensed under the MIT License
