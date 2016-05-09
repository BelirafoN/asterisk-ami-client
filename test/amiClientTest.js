/**
 * Developer: Alex Voronyansky <belirafon@gmail.com>
 * Date: 27.04.2016
 * Time: 15:37
 */

"use strict";

const amiUtils = require('asterisk-ami-event-utils');
const AmiTestServer = require('asterisk-ami-test-server');
const AmiClient = require('../lib/AmiClient');
const AmiConnection = require('../node_modules/asterisk-ami-connector/lib/AmiConnection');
const assert = require('assert');

let serverOptions = {
        credentials: {
            username: 'test',
            secret: 'test'
        }
    },
    socketOptions = {
        host: '127.0.0.1',
        port: 5038
    };

describe('Ami Client internal functionality', function(){
    this.timeout(3000);

    let server = null,
        client = null;

    afterEach(done => {
        if(server instanceof AmiTestServer){
            server.close();
            server.removeAllListeners();
            server = null;
        }
        if(client instanceof AmiClient){
            client.disconnect();
            client = null;
        }
        setTimeout(done, 100);
    });

    describe('Regular connection with default configuration', function(){

        beforeEach(done => {
            client = new AmiClient();
            server = new AmiTestServer(serverOptions);
            server.listen({port: socketOptions.port}).then(done);
        });

        it('Connect with correct credentials', done => {
            client.connect('test', 'test', socketOptions).then(() => done());
        });

        it('Connector returns instance of AmiConnection', done => {
            client.connect('test', 'test', socketOptions).then(amiConnection => {
                assert.ok(amiConnection instanceof AmiConnection);
                done();
            });
        });

        it('Connect with invalid credentials', done => {
            client.connect('username', 'secret', socketOptions)
                .catch(error => {
                    assert.ok(error instanceof Error);
                    assert.equal('ami message: authentication failed', error.message.toLowerCase());
                    done();
                });
        });
    });

    describe('Reconnection functioanlity', function(){

        beforeEach(() => {
            server = new AmiTestServer(serverOptions);
        });

        it('Reconnection with correct credentials', done => {
            client = new AmiClient({
                reconnect: true
            });
            client.connect('test', 'test', socketOptions).then(() => done());
            setTimeout(() => {
                server.listen({port: socketOptions.port});
            }, 1500);
        });

        it('Reconnection with invalid credentials', done => {
            client = new AmiClient({
                reconnect: true
            });
            client.connect('username', 'secret', socketOptions).catch(error => {
                assert.ok(error instanceof Error);
                assert.equal('ami message: authentication failed', error.message.toLowerCase());
                done();
            });
            setTimeout(() => {
                server.listen({port: socketOptions.port});
            }, 1500);
        });

        it('Limit of attempts of reconnection', done => {
            client = new AmiClient({
                reconnect: true,
                maxAttemptsCount: 1
            });
            client.connect('test', 'test', socketOptions).catch(error => {
                assert.ok(error instanceof Error);
                assert.equal('reconnection error after max count attempts.', error.message.toLowerCase());
                done();
            });
            setTimeout(() => {
                server.listen({port: socketOptions.port});
            }, 1500);
        });

        it('Ban for reconnection', done => {
            client = new AmiClient({
                reconnect: false
            });
            client.connect('test', 'test', socketOptions).catch(error => {
                assert.ok(error instanceof Error);
                assert.equal('connect ECONNREFUSED 127.0.0.1:5038', error.message);
                done();
            });
        });

        it('Reconnection after disconnect from Asterisk', done => {
            let wasDisconnect = false,
                connectCounter = 0;

            client = new AmiClient({
                reconnect: true,
                maxAttemptsCount: null,
                attemptsDelay: 1000
            });
            client
                .on('disconnect', () => {
                    wasDisconnect = true;
                })
                .on('connect', () => {
                    if(++connectCounter == 2 && wasDisconnect){
                        done();
                    }
                });

            server.listen({port: socketOptions.port}).then(() => {
                client.connect('test', 'test', socketOptions).then(() => {
                    server.close();
                    setTimeout(() => {
                        server.listen({port: socketOptions.port});
                    }, 1000);
                });
            });
        });
    });

    describe('Last event/response/action', function(){

        beforeEach(done => {
            client = new AmiClient();
            server = new AmiTestServer(serverOptions);
            server.listen({port: socketOptions.port}).then(done);
        });

        it('Get last Event', done => {
            let testEvent = {
                Event: 'TestEvent',
                Value: 'TestValue'
            };
            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                server.broadcast(amiUtils.fromObject(testEvent));
                client.once('event', event => {
                    assert.deepEqual(event, client.lastEvent);
                    done();
                });
            });
        });

        it('Get last Response', done => {
            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                client.action({Action: 'Ping'});
                client.once('response', response => {
                    assert.equal(response.Response, 'Success');
                    assert.equal(response.Ping, 'Pong');
                    done();
                });
            });
        });

        it('Get last Action', done => {
            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                let testAction = {Action: 'Ping'};
                client.action(testAction);
                assert.deepEqual(testAction, client.lastAction);
                done();
            });
        });

    });

    describe('Client\'s events', function(){

        beforeEach(done => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen({port: socketOptions.port}).then(done);
        });

        it('Connect event', done => {
            client.on('connect', () => done());
            client.connect('test', 'test', {port: socketOptions.port});
        });

        it('Disconnect event', done => {
            client.once('disconnect', done);
            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                setTimeout(server.close.bind(server), 100);
            });
        });

        it('Reconnect event', done => {
            client = new AmiClient({reconnect: true});
            client.once('reconnection', () => done());
            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                server.close();
            });
        });

        it('Event event', done => {
            let testEvent = {
                Event: 'TestEvent'
            };

            client.on('event', event => {
                assert.deepEqual(event, testEvent);
                done();
            });

            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                server.broadcast(amiUtils.fromObject(testEvent));
            });
        });

        it('Event by event\'s type', done => {
            let testEvent = {
                Event: 'TestEvent'
            };

            client.on('TestEvent', event => {
                assert.deepEqual(event, testEvent);
                done();
            });

            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                server.broadcast(amiUtils.fromObject(testEvent));
            });
        });

        it('Response event', done => {
            client.on('response', response => {
                assert(response.Response, 'Success');
                assert(response.Ping, 'Pong');
                done();
            });

            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                client.action({Action: 'Ping'});
            });
        });

        it('Response event by ActionID', done => {
            client.on('resp_1234567', response => {
                assert(response.Response, 'Success');
                assert(response.Ping, 'Pong');
                done();
            });

            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                client.action({
                    Action: 'Ping',
                    ActionID: '1234567'
                });
            });
        });

        it('Data event', done => {
            let testChunk = amiUtils.fromString('test chunk');
            client.once('data', chunk => {
                assert.equal(chunk.toString(), testChunk);
                done();
            });

            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                server.broadcast(testChunk);
            });
        });

    });

    describe('Action-method and aliases', function(){

        beforeEach(done => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen({port: socketOptions.port}).then(done);
        });

        it('Call action before connection => exception', () => {
            assert.throws(() => {
                client.action({Action: 'Ping'});
            }, error => {
                assert.ok(error instanceof Error);
                assert.equal(`Call 'connect' method before.`, error.message);
                return true;
            });
        });

        it('Write is a alias of action', done => {
            let action = client.action,
                testAction = {Action: 'Ping'};

            client.action = function(message){
                assert.deepEqual(testAction, message);
                done();
            };
            client.write(testAction);
        });

        it('Send is a alias of action', done => {
            let action = client.action,
                testAction = {Action: 'Ping'};

            client.action = function(message){
                assert.deepEqual(testAction, message);
                done();
            };
            client.send(testAction);
        });

        it('Action is promissable', done => {
            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                assert.ok(client.action({Action: 'Ping'}, true) instanceof Promise);
                done();
            });
        });

        it('Resolving promissabled action with ActionID', done => {
            let action = {
                Action: 'Ping',
                ActionID: '1234567'
            };

            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                client.action(action, true).then( response => {
                    delete response.Timestamp;
                    assert.deepEqual({
                        Response: 'Success',
                        Ping: 'Pong',
                        ActionID: action.ActionID
                    }, response);
                    done();
                });
            });
        });

        it('Resolving promissabled action without ActionID', done => {
            client.connect('test', 'test', {port: socketOptions.port}).then(() => {
                client.action({Action: 'Ping'}, true).then( response => {
                    delete response.Timestamp;
                    assert.deepEqual({
                        Response: 'Success',
                        Ping: 'Pong'
                    }, response);
                    done();
                });
            });
        });

    });

});

