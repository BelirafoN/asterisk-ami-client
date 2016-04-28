/**
* Developer: Alex Voronyansky <belirafon@gmail.com>
* Date: 27.04.2016
* Time: 15:36
*/

"use strict";

const AmiClient = require('asterisk-ami-client');

let client = new AmiClient({
    reconnect: true,
    keepAlive: true
});

client.connect('user', 'secret', {host: 'localhost', port: 5800})
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
