var moment = require('moment');

function convertSpeed(metersPerSecond) {
    return Math.round((metersPerSecond*3.6)*100)/100;
}

function convertPace(metersPerSecond) {
    var value = Math.round((16.666666666667/metersPerSecond)*100)/100;
    var minutes = parseInt(value);
    var seconds = parseInt((value % minutes)*60);
    seconds = seconds < 10 ? '0'+seconds : seconds;

    return minutes+':'+seconds;
}

function convertDistance(meters) {
    return Math.round((meters/1000)*100)/100; // looks too long but it's easier to analyse
}

function convertTime(seconds) {
    return moment.utc(0).add(seconds, 'seconds').format('HH:mm:ss');
}

function fromMetersPerSecond(metersPerSecond) {
    return {
        toKilometersPerHour: function() { return convertSpeed(metersPerSecond); },
        toMinutesPerKilometer: function() { return convertPace(metersPerSecond); }
    }
}

function fromSeconds(seconds) {
    return {
        toTime: function() { return convertTime(seconds); }
    }
}

function fromMeters(meters) {
    return {
        toKilometers: function() { return convertDistance(meters); }
    }
}

module.exports = {
    fromMetersPerSecond: fromMetersPerSecond,
    fromSeconds: fromSeconds,
    fromMeters: fromMeters
};