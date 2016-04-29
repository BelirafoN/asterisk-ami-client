/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:36
 */

"use strict";

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
