/* jshint esversion: 6 */
/* jshint node: true */

'use strict';

var Service, Characteristic;
var Denon3808 = require('./lib/denon3808');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-denon-avr3808ci-http', 'DenonAVR-3808CI-HTTP', Denon3808Accessory);
};

function getConfigIntWithDefaultAndRange(valueStr, defaultValue, minValue, maxValue) {
    if (!valueStr)
        return defaultValue;

    const value = parseInt(valueStr);
    if (value == Number.NaN)
        return defaultValue;

    return Math.min(Math.max(value, minValue), maxValue);
}

function Denon3808Accessory(log, config) {
    this.log = log;
    this.config = config;

    if (!config.hasOwnProperty('ip'))
        this.log.error("'ip' config is missing!");
    if (!config.hasOwnProperty('name'))
        this.log.error("'name' config is missing!");

    // Extract configuration from config.json section.
    this.ip = config.ip;
    this.name = config.name;
    this.switchesForAllInputs = (config.hasOwnProperty('switchesForAllInputs') && (config.switchesForAllInputs == 'true' || config.switchesForAllInputs == '1'));
    this.addPowerSwitch = (!config.hasOwnProperty('addPowerSwitch') || config.addPowerSwitch == 'true' || config.addPowerSwitch == '1');
    this.maxVolume = getConfigIntWithDefaultAndRange(config.maxVolume, 70, 0, 100);
    this.pollingIntervalMs = getConfigIntWithDefaultAndRange(config.pollingIntervalMs, 15000, 250, 600000); // clamp between 250 ms and 10 minutes, default to polling every 15 seconds

    const configInputs = config.inputs;
    this.supportedInputs = new Map();
    if (configInputs) {
        Object.keys(configInputs).forEach((input) => {
            const friendlyName = configInputs[input];
            this.supportedInputs.set(input, friendlyName);
        });
    }

    this.denon = new Denon3808(this.ip);
}

Denon3808Accessory.prototype._updateState = function () {
    clearTimeout(this.pollingTimeout);

    this.log(`Polling full Denon state...`);
    this.denon.getFullState((error, denonState) => {
        if (error) {
            this.log(`Couldn't poll full Denon state. Error: ` + error);
        } else {
            this.log(`Polled full Denon state: power ` + (denonState.isPoweredOn ? 'on' : 'off') + `, ` +
                "input " + denonState.input + ", " + (denonState.isMuted ? 'muted' : 'unmuted') + 
                ", volume " + denonState.volumeDb + " dB, " + denonState.volumePercent + "%");

            if (this.addPowerSwitch)
                this.switchService.getCharacteristic(Characteristic.On).updateValue(denonState.isPoweredOn, null, "polling");

            this.lightService.getCharacteristic(Characteristic.On).updateValue(!denonState.isMuted, null, "polling");
            this.lightService.getCharacteristic(Characteristic.Brightness).updateValue(denonState.volumePercent, null, "polling");

            this.speakerService.getCharacteristic(Characteristic.On).updateValue(denonState.isPoweredOn, null, "polling");
            this.speakerService.getCharacteristic(Characteristic.Mute).updateValue(denonState.isMuted, null, "polling");
            this.speakerService.getCharacteristic(Characteristic.Volume).updateValue(denonState.volumePercent, null, "polling");

            if (this.inputSwitchServices.hasOwnProperty(denonState.input)) {
                this.inputSwitchServices[denonState.input].getCharacteristic(Characteristic.On).updateValue(true, null, "polling");
            } else {
                Object.keys(this.inputSwitchServices).forEach((input) => {
                    this.inputSwitchServices[input].getCharacteristic(Characteristic.On).updateValue(false, null, "polling");
                });
            }
        }

        this.pollingTimout = setTimeout(this._updateState.bind(this), this.pollingIntervalMs);
    });
};

Denon3808Accessory.prototype.getPowerState = function (callback) {
    this.denon.getPowerState((error, currentPowerState) => {
        if (error) {
            this.log("Denon AVR-3808CI couldn't get power state: " + error);
            callback(error, false);
        } else {
            this.log('Denon AVR-3808CI power is %s', (currentPowerState) ? 'ON' : 'OFF');
            callback(null, currentPowerState);
        }
    });
};

Denon3808Accessory.prototype.setPowerState = function (powerState, callback, context) {
    if (context && context == "polling") {
        callback(null, powerState);
        return;
    }

    this.denon.setPowerState(powerState, (error, currentPowerState) => {
        if (error) {
            this.log("Denon AVR-3808CI couldn't set power state: " + error);
            callback(error, false);
        } else {
            this.log('Denon AVR-3808CI power is now %s', (currentPowerState) ? 'ON' : 'OFF');
            callback(null, currentPowerState);
        }
    });
};

Denon3808Accessory.prototype.getVolume = function (callback) {
    this.denon.getVolumePercent((error, currentVolume) => {
        if (error) {
            this.log("Denon AVR-3808CI couldn't get volume: " + error);
            callback(error, 0);
        } else {
            this.log('Denon AVR-3808CI volume is now ' + currentVolume + '%');
            callback(null, currentVolume);
        }
    });
};

Denon3808Accessory.prototype.setVolume = function (volume, callback, context) {
    if (context && context == "polling") {
        callback(null, volume);
        return;
    }

    volume = Math.min(volume, this.maxVolume);
    this.denon.setVolumePercent(volume, (error, currentVolume) => {
        if (error) {
            this.log("Denon AVR-3808CI couldn't set volume: " + error);
            callback(error, 0);
        } else {
            this.log('Denon AVR-3808CI volume is now ' + currentVolume + '%');
            callback(null, currentVolume);
        }
    });
};

Denon3808Accessory.prototype.getMuteState = function (callback) {
    this.denon.getMuteState((error, currentMuteState) => {
        if (error) {
            this.log("Denon AVR-3808CI couldn't get mute state: " + error);
            callback(error, true);
        } else {
            this.log('Denon AVR-3808CI mute state is %s', (currentMuteState) ? 'MUTED' : 'UNMUTED');
            callback(null, currentMuteState);
        }
    });
};

Denon3808Accessory.prototype.setMuteState = function (muteState, callback, context) {
    if (context && context == "polling") {
        callback(null, muteState);
        return;
    }

    this.denon.setMuteState(muteState, (error, currentMuteState) => {
        if (error) {
            this.log("Denon AVR-3808CI couldn't set mute state: " + error);
            callback(error, true);
        } else {
            this.log('Denon AVR-3808CI mute state is %s', (currentMuteState) ? 'MUTED' : 'UNMUTED');
            callback(null, currentMuteState);
        }
    });
};

Denon3808Accessory.prototype.getFakeLightOnState = function (callback) {
    this.getMuteState((error, muteState) => {
        // Convert mute state to on state by inverting it. If there's an error return false to indicate that the receiver is off/muted.
        if (error)
            callback(error, true);
        else
            callback(null, !muteState);
    });
};

Denon3808Accessory.prototype.setFakeLightOnState = function (onState, callback, context) {
    this.setMuteState(!onState, callback, context);
};

Denon3808Accessory.prototype.getInput = function (assignedInput, callback) {
    this.denon.getInput((error, currentInput) => {
        if (error) {
            this.log("Denon AVR-3808CI couldn't get input: " + error);
            callback(error, false);
        } else {
            this.log('Denon AVR-3808CI input is ' + currentInput);
            callback(null, currentInput == assignedInput);
        }
    });
};

Denon3808Accessory.prototype.setInput = function (assignedInput, inputState, callback, context) {
    if (context && context == "polling") {
        callback(null, inputState);
        return;
    }

    if (!inputState)
    {
        callback(new Error("Cannot turn off input buttons. Instead, turn on one of the other input buttons to disable this one"));
        return;
    }

    this.denon.setInput(assignedInput, (error, currentInput) => {
        if (error) {
            this.log("Denon AVR-3808CI couldn't set input: " + error);
            callback(error, false);
        } else {
            this.log('Denon AVR-3808CI input is ' + currentInput);
            callback(null, currentInput == assignedInput);

            Object.keys(this.inputSwitchServices).forEach((input) => {
                if (input != assignedInput)
                    this.inputSwitchServices[input].getCharacteristic(Characteristic.On).updateValue(false, null, "polling");
            });
        }
    });
};

Denon3808Accessory.prototype.getServices = function () {
    this.informationService = new Service.AccessoryInformation();
    this.informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, 'Denon')
        .setCharacteristic(Characteristic.Model, 'AVR-3808CI');

    if (this.addPowerSwitch) {
        // Power state switch. You can only turn receiver off (which puts it into standby), but not on.
        // Turning it on requires using the remote or the physical button on the receiver.
        this.switchService = new Service.Switch(this.name, this.name + 'Power');
        this.switchService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getPowerState.bind(this))
            .on('set', this.setPowerState.bind(this));
    }

    this.lightService = new Service.Lightbulb(this.name);
    this.lightService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getFakeLightOnState.bind(this))
        .on('set', this.setFakeLightOnState.bind(this));
    this.lightService
        .getCharacteristic(Characteristic.Brightness)
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));

    // Speaker service only works in Eve Elgato app right now, but not with Home app or Siri.
    this.speakerService = new Service.Speaker(this.name);
    this.speakerService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
    this.speakerService
        .getCharacteristic(Characteristic.Mute)
        .on('get', this.getMuteState.bind(this))
        .on('set', this.setMuteState.bind(this));
    this.speakerService
        .getCharacteristic(Characteristic.Volume)
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));
    
    this.inputSwitchServices = {};

    var addInputSwitchService = (friendlyName, input) => {
        if (this.denon.Inputs.findIndex((value) => { return value == input; }) == -1) {
            this.log.error("Incorrect input name '%s' in config.json. Not adding input switch for this input.", input);
        } else {
            var service = new Service.Switch(this.name + ' ' + friendlyName, this.name + 'Input ' + input);
            service
                .getCharacteristic(Characteristic.On)
                .on('get', this.getInput.bind(this, input))
                .on('set', this.setInput.bind(this, input));

            this.inputSwitchServices[input] = service;
        }
    };

    this.supportedInputs.forEach(addInputSwitchService);

    if (this.switchesForAllInputs) {
        this.denon.Inputs((input) => {
            if (this.supportedInputs.get(input) == undefined)
                addInputSwitchService(input, input);
        });
    }

    this.pollingTimout = setTimeout(this._updateState.bind(this), 1);

    var services = [this.informationService, this.lightService, this.speakerService];
    if (this.addPowerSwitch)
        services.push(this.switchService);
    Object.keys(this.inputSwitchServices).forEach((input) => {
       services.push(this.inputSwitchServices[input]); 
    });
    return services;
};
