/* jshint esversion: 6 */
/* jshint node: true */

'use strict';

const request = require('request');
const cheerio = require('cheerio');

// Defines input IDs as expected by the setInput function and as stored in the Denon state to input names
// that need to be sent to the Denon receiver.
const Inputs = [
    'TV/CBL',
    'TUNER',
    'PHONO',
    'CD',
    'DVD',
    'HDP',
    'SAT',
    'VCR/iPod',
    'DVR',
    'V.AUX',
    'NET/USB',
    'XM'
];

const defaultState = { isPoweredOn: false, input: '', volumeDb: -80, volumePercent: 0, isMuted: true };

var Denon3808 = function(ip) {
    this.ip = ip;
    this.getUrl = '/MAINZONE/d_mainzone.asp';
    this.postUrl = '/MAINZONE/s_mainzone.asp';
    this.lastGetFullStateTime = [0, 0];
    this.cachedState = defaultState;
};

Denon3808.prototype.Inputs = Inputs;

Denon3808.prototype._post = function (postFormData, callback) {
    request.post({
        url: 'http://' + this.ip + this.postUrl, 
        form: postFormData},
        function (error, response, body) {
            if (error)
                callback(error);
            else if (response.statusCode != 200)
                callback(new Error(`Unexpected response. Status code ${response.statusCode}`));
            else
                callback(null);
        }
    );
};

Denon3808.prototype.getFullState = function (callback) {
    // If the last successful call to this function wasn't that long ago, just return the already known
    // state instead of querying the receiver again, because that's costly.
    const timeDiff = process.hrtime(this.lastGetFullStateTime);
    const timeDiffMs = timeDiff[0] * 1e6 + timeDiff[1] / 1000;
    if (timeDiffMs <= 250) {
        callback(null, this.cachedState);
        return;
    }

    request.get({ url: 'http://' + this.ip + this.getUrl, timeout: 5000 },
        (error, response, body) => {
            if (error) {
                if (error.code == 'EHOSTUNREACH' || error.code == 'ETIMEDOUT' || error.code == 'ECONNREFUSED') {    // Consider receiver as powered down for these errors
                    this.cachedState = defaultState;
                    this.lastGetFullStateTime = process.hrtime();
                    callback(null, this.cachedState);
                } else {
                    callback(error);
                }
            } else if (response.statusCode != 200) {
                callback(new Error(`Unexpected response. Status code ${response.statusCode}`));
            } else {
                var $ = cheerio.load(body);
                
                const volumeStr = $("input[name='textMas']").attr('value');
                const volumeDb = this._convertVolumeStrToDb(volumeStr);
                const volumePercent = this._convertVolumeDbToPercent(volumeDb);
                const isMuted = $("input[name='checkMmute']").attr('value') == 'on';
                
                var input = $("select[name='listInputFunction'] > option").filter(":selected").attr('value');
                if (this.Inputs.findIndex((value) => { return value == input; }) == -1)
                    input = '';

                this.cachedState = { isPoweredOn: true, input: input, volumeDb: volumeDb, volumePercent: volumePercent, isMuted: isMuted };
                this.lastGetFullStateTime = process.hrtime();
                callback(null, this.cachedState);
            }
        }
    );
};

Denon3808.prototype._roundVolume = function (volume) {
    // The Denon receiver only supports 0.5 db increments, so round to that.
    return 0.5 * Math.round(2 * volume);
};

Denon3808.prototype._convertVolumePercentToDb = function (volumePercent) {
    // The Denon 3808's volume scale, if not "--" goes from -80 db to 18 db, so a range of 98 db.
    // If the passed in volume percentage is < 2% we map to "--", which is effectively negative infinity db.
    if (volumePercent < 2)
        return Number.NEGATIVE_INFINITY;
    else
        return volumePercent - 2 - 80;
};

Denon3808.prototype._convertVolumeDbToPercent = function (volumeDb) {
    // Converter from the [-80, 18] db scale to a percentage in the range [2, 100] %.
    // If the receiver is set to a volume level of negative infinite db we return 0%.
    if (volumeDb == Number.NEGATIVE_INFINITY)
        return 0;
    else
        return volumeDb + 80 + 2;
};

Denon3808.prototype._convertVolumeDbToStr = function (volumeDb) {
    if (volumeDb == Number.NEGATIVE_INFINITY)
        return "--";
    else
        return volumeDb.toString();
};

Denon3808.prototype._convertVolumeStrToDb = function (volumeStr) {
    if (volumeStr == '--')
        return Number.NEGATIVE_INFINITY;
    else
        return Math.min(Math.max(parseFloat(volumeStr), -80), 18);
};

Denon3808.prototype.getPowerState = function (callback) {
    this.getFullState((error, state) => {
        if (error)
            callback(error);
        else
            callback(null, state.isPoweredOn);
    });
};

Denon3808.prototype.setPowerState = function (powerState, callback) {
    if (powerState) {
        callback(new Error('Cannot turn power on via HTTP. You have to use the power button on the remote or the receiver to do this.'));
    } else {
        this._post({'radioSystemPower': 'STANDBY'}, (error) => {
            if (error) {
                callback(error);
            } else {
                this.cachedState.isPoweredOn = powerState;
                callback(null, powerState);
            }
        });
    }
};

Denon3808.prototype.getMuteState = function (callback) {
    this.getFullState((error, state) => {
        if (error)
            callback(error);
        else
            callback(null, state.isMuted);
    });
};

Denon3808.prototype.setMuteState = function (muteState, callback) {
    this._post({'checkMmute': muteState ? 'on' : 'off'}, (error) => {
        if (error) {
            callback(error);
        } else {
            this.cachedState.isMuted = muteState;
            callback(null, muteState);
        }
    });
};

Denon3808.prototype.getVolumePercent = function (callback) {
    this.getFullState((error, state) => {
        if (error)
            callback(error);
        else
            callback(null, state.volumePercent);
    });
};

Denon3808.prototype.getVolumeDb = function (callback) {
    this.getFullState((error, state) => {
        if (error)
            callback(error);
        else
            callback(null, state.volumeDb);
    });
};

Denon3808.prototype.setVolumePercent = function (volumePercent, callback) {
    const roundedVolumePercent = this._roundVolume(volumePercent);
    const volumeDb = this._convertVolumePercentToDb(roundedVolumePercent);
    this._post({'textMas': this._convertVolumeDbToStr(volumeDb), 'setMas': 'on'}, (error) => {
        if (error) {
            callback(error);
        } else {
            this.cachedState.volumePercent = roundedVolumePercent;
            this.cachedState.volumeDb = volumeDb;
            callback(null, roundedVolumePercent);
        }
    });
};

Denon3808.prototype.setVolumeDb = function (volumeDb, callback) {
    const roundedVolumeDb = this._roundVolume(volumeDb);
    this._post({'textMas': this._convertVolumeDbToStr(roundedVolumeDb), 'setMas': 'on'}, (error) => {
        if (error) {
            callback(error);
        } else {
            this.cachedState.volumeDb = roundedVolumeDb;
            this.cachedState.volumePercent = this._convertVolumeDbToPercent(roundedVolumeDb);
            callback(null, volumeDb);
        }
    });
};

Denon3808.prototype.getInput = function (callback) {
    this.getFullState((error, state) => {
        if (error)
            callback(error);
        else
            callback(null, state.input);
    });  
};

Denon3808.prototype.setInput = function (input, callback) {
    if (this.Inputs.findIndex((value) => { return value == input; }) == -1) {
        callback(new Error("Invalid input " + input));
        return;
    }

    this._post({'listInputFunction': input}, (error) => {
        if (error) {
            callback(error);
        } else {
            this.cachedState.input = input;
            callback(null, input);            
        }
    });
};

module.exports = Denon3808;
