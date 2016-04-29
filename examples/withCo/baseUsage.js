/**
* Developer: Alex Voronyansky <belirafon@gmail.com>
* Date: 27.04.2016
* Time: 15:36
*/

"use strict";

const co = require('co');
const AmiClient = require('asterisk-ami-client');

co(function* (){

    let client = new AmiClient({
        reconnect: true,
        keepAlive: true
    });

    yield client.connect('user', 'secret', {host: 'localhost', port: 5038});

    client
        .on('event', event => console.log(event))
        .on('response', response => {
            console.log(response);
            client.disconnect();
        })
        .on('internalError', error => console.log(error))
        .action({Action: 'Ping'});
})
    .catch(error => console.log(error));
