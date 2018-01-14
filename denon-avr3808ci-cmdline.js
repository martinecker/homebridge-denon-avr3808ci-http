/* jshint esversion: 6 */
/* jshint node: true */

'use strict';

const Denon3808 = require('./lib/denon3808.js');

var denon = new Denon3808('192.168.1.8');

function errorHandler(error)
{
    if (error)
        console.error(error);
}

console.log(`Denon AVR-3808CI command line utility`);
console.log(`  (c) by Martin Ecker in 2017`);
console.log(`Uses the receiver's HTTP server to set and retrieve input, mute state, and volume.`);
console.log();
console.log(`Usage:`);
console.log(`   To set input: Pass "input" as first command line argument,`);
console.log(`       followed by one of the following:`);
console.log(`       ` + denon.Inputs);
console.log(`   To mute: Pass "mute" as first command line argument.`);
console.log(`   To unmute: Pass "unmute" as first command line argument.`);
console.log(`   To set volume in percent: Pass "volume" as first command line argument,`);
console.log(`       followed by a volume percentage in the range [0, 100],`);
console.log(`       followed by the % sign.`);
console.log(`       For example: node denon-avr3808ci-cmdline.js volume 50%`);
console.log(`   To set volume in dB: Pass "volume" as first command line argument,`);
console.log(`       followed by a volume dB value in the range [-80, 18]`);
console.log(`       followed by "db".`);
console.log(`       For example: node denon-avr3808ci-cmdline.js volume -20db`);
console.log();

if (process.argv[2] == 'input') {
    const input = process.argv[3].toUpperCase();
    const inputIndex = denon.Inputs.findIndex((name) => { return name.toUpperCase() == input.toUpperCase(); });
    if (inputIndex == -1)
        console.error(`Invalid 3rd argument. Must be one of: ` + denon.Inputs);
    else
        denon.setInput(input, errorHandler);
} else if (process.argv[2] == 'mute') {
    denon.setMuteState(true, errorHandler);
} else if (process.argv[2] == 'unmute') {
    denon.setMuteState(false, errorHandler);
} else if (process.argv[2] == 'volume') {
    const volumeStr = process.argv[3];
    if (volumeStr.endsWith("%")) {
        const volumePercent = parseFloat(volumeStr);
        if (volumePercent == Number.NaN)
            console.error('Invalid 3rd argument. Must be number in range [0, 100] to indicate volume percentage');
        else
            denon.setVolumePercent(Math.min(Math.max(volumePercent, 0), 100), errorHandler);
    } else if (volumeStr.toLowerCase().endsWith("db")) {
        const volumeDb = parseFloat(volumeStr);
        if (volumeDb == Number.NaN)
            console.error('Invalid 3rd argument. Must be number in range [-80, 18] to indicate volume percentage');
        else
            denon.setVolumeDb(Math.min(Math.max(volumeDb, -80), 18), errorHandler);
    } else {
        console.error('Invalid 3rd argument. Must be a number in range [0, 100] followed by % sign, or a number in range [-80, 18] followed by "db".');
    }
}

console.log(`Current state:`);
denon.getFullState(function (error, denonState) {
    if (!error) {
        console.log('    Power is ' + (denonState.isPoweredOn ? 'on' : 'off'));
        console.log('    Input: ' + denonState.input);
        console.log(`    Volume: ${denonState.volumeDb} db, ${denonState.volumePercent}%`);
        if (denonState.isMuted)
            console.log('    Muted');
    } else {
        console.error(error);
    }
});
