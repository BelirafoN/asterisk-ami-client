/**
 * Developer: BelirafoN
 * Date: 27.04.2016
 * Time: 15:37
 */

"use strict";

const EventEmitter = require('events').EventEmitter;
const amiConnector = require('asterisk-ami-connector')({
    reconnect: true,
    maxAttemptsCount: 30,
    attemptsDelay: 1000
});
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
            _kaTimer: null,
            _kaActionId: null,
            _options: Object.assign({
                reconnect: false,
                keepAlive: false,
                keepAliveDelay: 5000
            }, options),
            _connection: null,
            _lastAction: null
        })
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
        return  this._connection ? this._connection.lastResponse : null;
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

    /**
     *
     * @param user
     * @param secret
     * @param options
     * @returns {Promise}
     */
    connect(user, secret, options){
        return amiConnector.connect(user, secret, options)
            .then(amiConnection => {
                this._connection = amiConnection;
                this.emit('connect', this._connection);

                this._connection
                    .on('event', event => {
                        this.emit('event', event);

                        if(event.Event){
                            this.emit(event.Event, event);
                        }
                    })
                    .on('response', response => {
                        if(this._options.keepAlive && response.ActionID === this._kaActionId){
                            debugLog('keep-alive heart bit');
                            this._keepAliveBit();
                            return;
                        }
                        this.emit('response', response);
                    })
                    .on('data', chunk => this.emit('data', chunk))
                    .on('error', error => this.emit('error', error))
                    .on('close', () => {
                        clearTimeout(this._kaTimer);
                        this.emit('disconnect');
                    });

                if(this._options.keepAlive){
                    this._keepAliveBit();
                }
                return this._connection;
            })
    }

    /**
     *
     */
    disconnect(){
        clearTimeout(this._kaTimer);
        this._connection.close();
    }

    /**
     *
     * @param message
     */
    action(message){
        this._lastAction = message;
        this.emit('action', message);
        this._connection.write(message);
    }

    /**
     * Keep-alive heart bit handler
     * @private
     */
    _keepAliveBit(){
        this._kaTimer = setTimeout(() => {
            if(this._options.keepAlive && this._connection && this.isConnected){
                this._kaActionId = `--spec_${Date.now()}--`;
                this._connection.write({
                    Action: 'Ping',
                    ActionID: this._kaActionId
                });
            }
        }, this._options.keepAliveDelay);
        this._kaTimer.unref();
        return this;
    }

}

module.exports = AmiClient;