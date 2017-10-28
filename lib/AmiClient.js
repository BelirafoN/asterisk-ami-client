/**
 * Developer: BelirafoN
 * Date: 27.04.2016
 * Time: 15:37
 */

"use strict";

const EventEmitter = require('events').EventEmitter;
const amiConnector = require('asterisk-ami-connector');
const debugLog = require('debug')('AmiClient');
const debugError = require('debug')('AmiClient:error');

/**
 * AmiClient class
 */
class AmiClient extends EventEmitter{

    /**
     * Constructor
     */
    constructor(options){
        super();

        Object.assign(this, {
            _specPrefix: '--spec_',
            _connector: null,
            _kaTimer: null,
            _kaActionId: null,
            _options: Object.assign({
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
            }, options || {}),
            _connection: null,
            _lastAction: null,
            _credentials: {user: null, secret: null},
            _connectionOptions: {},
            _userDisconnect: false,
            _prEmitter: new EventEmitter(),
            _prPendingActions: {}
        });

        this._prepareOptions();
        this._connector = amiConnector({
            reconnect: this._options.reconnect,
            maxAttemptsCount: this._options.maxAttemptsCount,
            attemptsDelay: this._options.attemptsDelay
        });

        this.on('disconnect', () => {
            Object.keys(this._prPendingActions).forEach(actionId => {
                this._prEmitter.emit(`disconnect_${actionId}`);
                debugLog(`disconnect_${actionId}`);
            }, this);
        });
    }

    /**
     *
     * @param user
     * @param secret
     * @param options
     * @returns {Promise}
     */
    connect(user, secret, options){
        this._credentials = {user, secret};
        this._connectionOptions = options || {};

        return this._connector.connect(user, secret, options)
            .then(amiConnection => {
                this._connection = amiConnection;
                this._userDisconnect = false;
                this.emit('connect', this._connection);

                this._connection
                    .on('event', event => {
                        if(!this._eventIsAllow(event)){ return; }
                        if(this._options.addTime){
                            event.$time = Date.now();
                        }
                        this.emit('event', event);
                        if(this._options.emitEventsByTypes && event.Event){
                            let eventName = this._options.eventTypeToLowerCase ?
                                event.Event.toLowerCase() : event.Event;
                            this.emit(eventName, event);
                        }
                    })
                    .on('response', response => {
                        if(this._options.keepAlive && response.ActionID === this._kaActionId){
                            debugLog('keep-alive heart bit');
                            this._keepAliveBit();
                            return;
                        }

                        if(this._options.addTime){
                            response.$time = Date.now();
                        }

                        if(response.ActionID){
                            if(this._options.emitResponsesById){
                                this.emit(`resp_${response.ActionID}`, response);
                            }
                            this._prEmitter.emit(`resp_${response.ActionID}`, response);

                            if(!this._options.dontDeleteSpecActionId && response.ActionID.startsWith(this._specPrefix)){
                                delete response.ActionID;
                            }
                        }
                        this.emit('response', response);
                    })
                    .on('data', chunk => this.emit('data', chunk))
                    .on('error', error => this.emit('internalError', error))
                    .on('close', () => {
                        clearTimeout(this._kaTimer);
                        this.emit('disconnect');
                        this._prEmitter.emit('disconnect');
                        setTimeout(() => {
                            this._connection.removeAllListeners();
                            if(!this._userDisconnect && this._options.reconnect){
                                this.emit('reconnection');
                                this.connect(
                                    this._credentials.user,
                                    this._credentials.secret,
                                    this._connectionOptions
                                )
                                .catch(error => this.emit('internalError', error));
                            }
                        }, 1);
                    });

                if(this._options.keepAlive){
                    this._keepAliveBit();
                }
                return this._connection;
            })
    }

    /**
     * Disconnect from Asterisk
     */
    disconnect(){
        this._userDisconnect = true;
        clearTimeout(this._kaTimer);
        this.emit('disconnect');
        if(this._connection){
            this._connection.close();
            setTimeout(this._connection.removeAllListeners, 1);
        }
        return this;
    }

    /**
     *
     * @param message
     * @param promisable
     * @returns {AmiClient}
     */
    action(message, promisable){
        if(!this._connection){
            throw new Error(`Call 'connect' method before.`);
        }
        this._lastAction = message;
        this.emit('action', message);

        if(!message.ActionID){
            message.ActionID = this._genActionId(this._specPrefix);
        }

        if(promisable){
            return this._promisable(message);
        }

        this._connection.write(message);
        return this;
    }

    /**
     *
     * @param message
     * @param promisable
     * @returns {*}
     */
    write(message, promisable){
        return this.action(message, promisable);
    }

    /**
     *
     * @param message
     * @param promisable
     * @returns {*}
     */
    send(message, promisable){
        return this.action(message, promisable);
    }

    /**
     *
     * @param name
     * @param value
     * @returns {*}
     */
    option(name, value){
        if(!Object.hasOwnProperty.call(this._options, name)){
            return value === undefined ? undefined : false;
        }
        if(value !== undefined){
            this._options[name] = value;
            this._prepareOptions();
            return true;
        }
        return this._options[name];
    }

    /**
     *
     * @param newOptions
     * @returns {*}
     */
    options(newOptions){
        if(newOptions === undefined){
            return this._options;
        }

        Object.keys(this._options).forEach(optionName => {
            if(Object.hasOwnProperty.call(newOptions, optionName)){
                this._options[optionName] = newOptions[optionName];
            }
        }, this);
        return this._prepareOptions();
    }

    /**
     * Keep-alive heart bit handler
     * @private
     */
    _keepAliveBit(){
        this._kaTimer = setTimeout(() => {
            if(this._options.keepAlive && this._connection && this.isConnected){
                this._kaActionId = this._genActionId(this._specPrefix);
                this._connection.write({
                    Action: 'Ping',
                    ActionID: this._kaActionId
                });
            }
        }, this._options.keepAliveDelay);
        this._kaTimer.unref();
        return this;
    }

    /**
     *
     * @returns {AmiClient}
     * @private
     */
    _prepareOptions(){
        if(this._options.eventFilter && !(this._options.eventFilter instanceof Set)){
            let eventNames = this._options.eventFilter;

            if(!Array.isArray(eventNames)){
                eventNames = Object.keys(this._options.eventFilter);
            }
            eventNames = eventNames.reduce((result, eventName) => {
                let name = eventName ? eventName.toString() : '';
                if(name){
                    result.push(name.toLowerCase());
                }
                return result;
            }, []);
            this._options.eventFilter = new Set(eventNames);
        }
        return this;
    }

    /**
     *
     * @param event
     * @private
     */
    _eventIsAllow(event){
        let eventName = event.Event ? event.Event.toLowerCase() : null;

        if(eventName && this._options.eventFilter){
            return !this._options.eventFilter.has(eventName);
        }
        return true;
    }

    /**
     *
     * @param prefix
     * @returns {string}
     * @private
     */
    _genActionId(prefix){
        prefix = prefix || '';
        return `${prefix}${Date.now()}`;
    }

    /**
     *
     * @param message
     * @private
     */
    _promisable(message){
        return new Promise((resolve, reject) => {
            let resolveTimer = setTimeout(() => {
                reject(new Error('Timeout response came.'));
            }, 10000).unref();

            this._connection.write(message);
            this._prPendingActions[message.ActionID] = message;
            this._prEmitter
                .on(`resp_${message.ActionID}`, response => {
                    clearTimeout(resolveTimer);
                    resolve(response);
                })
                .on(`disconnect_${message.ActionID}`, () => {
                    clearTimeout(resolveTimer);
                    reject(new Error('Client disconnected.'));
                });
        })
            .catch(error => error)
            .then(response => {
                this._prEmitter.removeAllListeners(`disconnect_${message.ActionID}`);
                this._prEmitter.removeAllListeners(`resp_${message.ActionID}`);
                delete this._prPendingActions[message.ActionID];
                if(response instanceof Error){ throw response; }
                return response;
            });
    }

    /**
     *
     * @returns {null}
     */
    get lastEvent(){
        return this._connection ? this._connection.lastEvent : null;
    }

    /**
     *
     * @returns {null}
     */
    get lastResponse(){
        let response = this._connection ? this._connection.lastResponse : null;
        if(response && response.ActionID && !this._options.dontDeleteSpecActionId 
                && response.ActionID.startsWith(this._specPrefix)){
            delete response.ActionID;
        }
        return response
    }

    /**
     *
     * @returns {boolean}
     */
    get isConnected(){
        return  this._connection ? this._connection.isConnected : null;
    }

    /**
     *
     * @returns {null}
     */
    get lastAction(){
        return this._lastAction;
    }

    /**
     *
     * @returns {T|*}
     */
    get connection(){
        return this._connection;
    }
}

module.exports = AmiClient;