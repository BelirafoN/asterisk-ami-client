/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:36
 */

"use strict";

const AmiClient = require('asterisk-ami-client');
let client = new AmiClient();

client.connect('user', 'secret', {host: 'localhost', port: 5038})
    .then(() => {

        client
            .on('connect', () => console.log('connect'))
            .on('event', event => console.log(event))
            .on('data', chunk => console.log(chunk))
            .on('response', response => console.log(response))
            .on('disconnect', () => console.log('disconnect'))
            .on('reconnection', () => console.log('reconnection'))
            .on('error', error => console.log(error));

    })
    .catch(error => console.log(error));