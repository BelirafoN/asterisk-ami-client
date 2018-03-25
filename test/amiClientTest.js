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

const USERNAME = 'test';
const SECRET = 'test';

let serverOptions = {
        silent: true,
        credentials: {
            username: USERNAME,
            secret: SECRET
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
            server.listen(socketOptions).then(done);
        });

        it('Connect with correct credentials', done => {
            client.connect(USERNAME, SECRET, socketOptions).then(() => done());
        });

        it('Connector returns instance of AmiConnection', done => {
            client.connect(USERNAME, SECRET, socketOptions).then(amiConnection => {
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
            client.connect(USERNAME, SECRET, socketOptions).then(() => done());
            setTimeout(() => {
                server.listen(socketOptions);
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
                server.listen(socketOptions);
            }, 1500);
        });

        it('Limit of attempts of reconnection', done => {
            client = new AmiClient({
                reconnect: true,
                maxAttemptsCount: 1
            });
            client.connect(USERNAME, SECRET, socketOptions).catch(error => {
                assert.ok(error instanceof Error);
                assert.equal('reconnection error after max count attempts.', error.message.toLowerCase());
                done();
            });
            setTimeout(() => {
                server.listen(socketOptions);
            }, 1500);
        });

        it('Ban for reconnection', done => {
            client = new AmiClient({
                reconnect: false
            });
            client.connect(USERNAME, SECRET, socketOptions).catch(error => {
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

            server.listen(socketOptions).then(() => {
                client.connect(USERNAME, SECRET, socketOptions).then(() => {
                    server.close();
                    setTimeout(() => {
                        server.listen(socketOptions);
                    }, 1000);
                });
            });
        });
    });

    describe('Last event/response/action', function(){

        beforeEach(done => {
            client = new AmiClient();
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions).then(done);
        });

        it('Get last Event after event', done => {
            let testEvent = {
                Event: 'TestEvent',
                Value: 'TestValue'
            };
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                server.broadcast(amiUtils.fromObject(testEvent));
                client.once('event', event => {
                    assert.deepEqual(event, client.lastEvent);
                    done();
                });
            });
        });

        it('Get last Event before event', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                assert.equal(null, client.lastEvent);
                done();
            });
        });

        it('Get last Response after action', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client.action({Action: 'Ping'});
                client.once('response', response => {
                    assert.equal(response.Response, 'Success');
                    assert.equal(response.Ping, 'Pong');
                    done();
                });
            });
        });

        it('Get last Response before action', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                assert.equal(null, client.lastResponse);
                done();
            });
        });

        it('Get last Action after action (without ActionID)', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                let testAction = {Action: 'Ping'};
                client.action(testAction);
                assert.deepEqual(testAction, client.lastAction);
                done();
            });
        });

        it('Get last Action after action (with ActionID)', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                let testAction = {
                    Action: 'Ping',
                    ActionID: '1234567'
                };
                client.action(testAction);
                assert.deepEqual(testAction, client.lastAction);
                done();
            });
        });

        it('Get last Action before action', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                assert.equal(null, client.lastAction);
                done();
            });
        });

    });

    describe('Client\'s events', function(){

        beforeEach(done => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions).then(done);
        });

        it('Connect event', done => {
            client.on('connect', () => done());
            client.connect(USERNAME, SECRET, {port: socketOptions.port});
        });

        it('Disconnect event', done => {
            client.once('disconnect', done);
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                setTimeout(server.close.bind(server), 100);
            });
        });

        it('Reconnect event', done => {
            client = new AmiClient({reconnect: true});
            client.once('reconnection', () => done());
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
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

            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
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

            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                server.broadcast(amiUtils.fromObject(testEvent));
            });
        });

        it('Response event', done => {
            client.on('response', response => {
                assert(response.Response, 'Success');
                assert(response.Ping, 'Pong');
                done();
            });

            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client.action({Action: 'Ping'});
            });
        });

        it('Response event by ActionID', done => {
            client.on('resp_1234567', response => {
                assert(response.Response, 'Success');
                assert(response.Ping, 'Pong');
                done();
            });

            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
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

            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                server.broadcast(testChunk);
            });
        });

    });

    describe('Action-method and aliases', function(){

        beforeEach(done => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions).then(done);
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
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                assert.ok(client.action({Action: 'Ping'}, true) instanceof Promise);
                done();
            });
        });

        it('Resolving promissabled action with ActionID', done => {
            let action = {
                Action: 'Ping',
                ActionID: '1234567'
            };

            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
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
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
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

        it('Last response not have $time field after resolving promissabled action without ActionID', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client.action({Action: 'Ping'}, true).then(() => {
                    assert.ok(client.lastResponse.$time === undefined);
                    done();
                });
            });
        });

    });

    describe('Client\'s configuration', function(){

        beforeEach(done => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions).then(done);
        });

        it('Get all options of client', () => {
            assert.deepEqual(client.options(), {
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
                eventFilter: null
            })
        });

        it('Set all options of client', () => {
            let newOptions = {
                reconnect: true,
                maxAttemptsCount: 5,
                attemptsDelay: 5000,
                keepAlive: true,
                keepAliveDelay: 5000,
                emitEventsByTypes: false,
                eventTypeToLowerCase: true,
                emitResponsesById: false,
                dontDeleteSpecActionId: true,
                addTime: true,
                eventFilter: new Set(['Dial'])
            };

            client.options(Object.assign({}, newOptions, {undefinedOption: 'testValue'}));
            assert.deepEqual(client.options(), newOptions)
        });

        it('Get value of exists option', () => {
            assert.equal(client.option('maxAttemptsCount'), 30)
        });

        it('Get value of not exists option', () => {
            assert.equal(client.option('notExistsOption'), undefined)
        });

        it('Set value for exists option', () => {
            let optionName = 'maxAttemptsCount',
                result = client.option(optionName, 1);
            assert.equal(client.option(optionName), 1);
            assert.equal(result, true);
        });

        it('Set value for not exists option', () => {
            let result = client.option('notExistsOption', 1);
            assert.equal(result, false);
        });

        it('Set event filter from array', () => {
            let eventNames = ['Dial', 'Hangup', 'Dial'];
            client.option('eventFilter', eventNames);
            assert.ok(client.option('eventFilter') instanceof Set);
            assert.deepEqual(
                Array.from(client.option('eventFilter')),
                Array.from(new Set(eventNames)).map(name => name.toLowerCase())
            );
        });

        it('Set event filter from object', () => {
            let eventNames = {
                Dial: 1,
                Hangup: 1
            };
            client.option('eventFilter', eventNames);
            assert.ok(client.option('eventFilter') instanceof Set);
            assert.deepEqual(
                Array.from(client.option('eventFilter')),
                Object.keys(eventNames).map(name => name.toLowerCase())
            );
        });

        it('Set event filter from Set', () => {
            let eventNames = new Set(['Dial', 'Hangup', 'Dial']);
            client.option('eventFilter', eventNames);
            assert.deepEqual(client.option('eventFilter'), eventNames);
        });

        it('Event not have $time field', done => {
           client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
               client.on('event', event => {
                   assert.ok(event.$time === undefined);
                   done();
               });
               server.broadcast(amiUtils.fromObject({Event: 'TestEvent'}));
           });
        });

        it('Response not have $time field', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client
                    .on('response', response => {
                        assert.ok(response.$time === undefined);
                        done();
                    })
                    .action({Action: 'Ping'});
            });
        });

        it('Event has $time field', done => {
            client = new AmiClient({addTime: true});
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client.once('event', event => {
                    assert.ok(/^\d{13}$/.test(event.$time));
                    done();
                });
                server.broadcast(amiUtils.fromObject({Event: 'TestEvent'}));
            });
        });

        it('Response has $time field', done => {
            client = new AmiClient({addTime: true});
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client.once('response', response => {
                    assert.ok(/^\d{13}$/.test(response.$time));
                    done();
                })
                .action({Action: 'Ping'});
            });
        });

        it('Response have deleted generated ActionID field', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client
                    .on('response', response => {
                        assert.ok(response.ActionID === undefined);
                        done();
                    })
                    .action({Action: 'Ping'});
            });
        });

        it('Response has generated ActionID field', done => {
            client = new AmiClient({dontDeleteSpecActionId: true});
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client.once('response', response => {
                    assert.ok(/^--spec_\d{13}$/.test(response.ActionID));
                    done();
                })
                .action({Action: 'Ping'});
            });
        });


    });

    describe('Connection state', function(){

        beforeEach(done => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions).then(done);
        });

        it('State of AmiConnection before connect is "disconnected"', () => {
            assert.equal(client.connection, null);
        });

        it('State of AmiConnection after connect is "connected"', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                assert.ok(client.connection instanceof AmiConnection);
                done();
            });
        });

        it('State of connection before connect is "disconnected"', () => {
            assert.ok(!client.isConnected);
        });

        it('State of connection after connect is "connected"', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                assert.ok(client.isConnected);
                done();
            });
        });

        it('State of connection after disconnect is "disconnected"', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                server.close();
                setTimeout(() => {
                    assert.ok(!client.isConnected);
                    done();
                }, 100);
            });
        });

    });

    describe('Event filtering', function(){

        beforeEach(done => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions).then(done);
        });

        it('Filter is disabled', done => {
            let srcEvents = [
                    {Event: 'Test1', Value: 'TestValue1'},
                    {Event: 'Test2', Value: 'TestValue2'}
                ],
                controlEvents = [];

            assert.equal(null, client.option('eventFilter'));
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client
                    .on('event', event => {
                        controlEvents.push(event);
                    })
                    .on('response', () => {
                        assert.deepEqual(controlEvents, [
                            {Event: 'Test1', Value: 'TestValue1'},
                            {Event: 'Test2', Value: 'TestValue2'}
                        ]);
                        done();
                    });

                srcEvents.forEach(event => {
                    server.broadcast(amiUtils.fromObject(event));
                });
                server.broadcast(amiUtils.fromObject({
                    Response: 'Success'
                }));
            });
        });

        it('Filter is enabled', done => {
            let srcEvents = [
                    {Event: 'Test1', Value: 'TestValue1'},
                    {Event: 'Test2', Value: 'TestValue2'}
                ],
                controlEvents = [];

            client.option('eventFilter', ['Test1']);
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                client
                    .on('event', event => {
                        controlEvents.push(event);
                    })
                    .on('response', () => {
                        assert.deepEqual(controlEvents, [
                            {Event: 'Test2', Value: 'TestValue2'}
                        ]);
                        done();
                    });

                srcEvents.forEach(event => {
                    server.broadcast(amiUtils.fromObject(event));
                });
                server.broadcast(amiUtils.fromObject({
                    Response: 'Success'
                }));
            });
        });

    });

    describe('Keep-alive', function(){

        beforeEach(done => {
            client = new AmiClient({});
            server = new AmiTestServer(serverOptions);
            server.listen(socketOptions).then(done);
        });

        it('keep-alive is disabled', done => {
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                let clientEventsStream = server.getAuthClients()[0]._eventStream,
                    timeout = setTimeout(() => {
                        clientEventsStream.removeAllListeners('amiAction');
                        done();
                    }, 2000);

                clientEventsStream.on('amiAction', action => {
                    if(action.Action === 'Ping'){
                        clearTimeout(timeout);
                    }
                });
            });
        });

        it('keep-alive is enabled', done => {
            client = new AmiClient({
                keepAlive: true,
                keepAliveDelay: 100
            });
            client.connect(USERNAME, SECRET, {port: socketOptions.port}).then(() => {
                let clientEventsStream = server.getAuthClients()[0]._eventStream;
                clientEventsStream.on('amiAction', action => {
                    if(action.Action === 'Ping'){
                        assert.ok(action.ActionID.startsWith(client._specPrefix));
                        clientEventsStream.removeAllListeners('amiAction');
                        done();
                    }
                });
            });
        });

    });

});

