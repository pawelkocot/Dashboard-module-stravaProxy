module.exports = function setup(options, imports, register) {
    "use strict";

    var promise = require('promise');
    var request = require('request-promise');
    var underscore = require('underscore');
    var moment = require('moment');
    var unitConverter = require('./unitConverter.js');
    var dataChannel = imports.data;
    var accessToken = '2b23fe7a6bf7681f688fd2d743db5fde3c728940';
    var clubs = [
        {
            type: 'Ride',
            name: ' Making Waves Cycling Club',
            url: 'https://www.strava.com/api/v3/clubs/4966/activities.json'
        },
        {
            type: 'Run',
            name: 'Making Waves Runners Club',
            url: 'https://www.strava.com/api/v3/clubs/143030/activities.json'
        }
    ];
    var clubsData;
    var currentIndex = 0;
    var dataChangeInterval;

    prepareData();
    setInterval(prepareData, 30 * 60 * 1000); // 30 minutes

    function prepareData() {
        fetchAllClubs()
            .then(calculateClubsData)
            .then(publishData)
            .catch(console.error);
    }

    function calculateClubsData(clubsWithActivities) {
        return promise.all(clubsWithActivities.map(function(club) {
            return createClubData(club);
        }));
    }

    function createClubData(club) {
        return promise.resolve(club).then(calculateLeaderboardForClub).then(pickLatestActivities)
    }

    function calculateLeaderboardForClub(club) {
        return promise.resolve(club.activities)
            .then(pickActivitiesByType(club.type))
            .then(groupActivitiesByAthlete)
            .then(sumActivities)
            .then(pickBestAthletes)
            .then(function(leaderboard) {
                return underscore.extend(club, {leaderboard: leaderboard});
            });
    }

    function pickBestAthletes(leaderboard) {
        return underscore.sortBy(leaderboard, 'distance_meters').reverse().slice(0, 3);
    }
    
    function pickLatestActivities(club) {
        return promise.resolve(club.activities)
            .then(orderActivities)
            .then(limitActivities)
            .then(function(activities) {
                return underscore.extend(club, {activities: activities});
            });
    }

    function orderActivities(activities) {
        return underscore.sortBy(activities, 'date_ts');
    }

    function limitActivities(activities) {
        return activities.slice(-10).reverse();
    }

    function publishData(clubs) {
        clubsData = clubs;
        changeClubData();
        if (!dataChangeInterval) {
            dataChangeInterval = setInterval(function() {
                changeClubData();
            }, 60000);
        }
    }

    function changeClubData() {
        currentIndex = currentIndex ? 0 : 1; // @todo fix for more general use case, not only for two items
        updateDataChannel(clubsData[currentIndex]);
    }

    function fetchAllClubs() {
        return promise.all(getPromisesForAllClubs())
    }

    function getPromisesForAllClubs() {
        return clubs.map(function(club) {
            return getPromiseForClub(club);
        });
    }

    function getPromiseForClub(club) {
        return request.get({
            uri: club.url,
            qs: {
                access_token: accessToken,
                per_page: 200, // maximum available
                after: moment().subtract(30, 'days').format('X') // last 30 days
            }
        })
            .then(JSON.parse)
            .then(function(activities) {
                return underscore.extend(
                    getClubDTO(club),
                    {
                        activities: activities.map(prepareActivity)
                    }
                );
            });
    }

    function getClubDTO(club) {
        return underscore.pick(club, 'name', 'type');
    }

    function prepareActivity(activity) {
        var item = {
            athlete: prepareAthlete(activity.athlete),
            name: activity.name,
            type: activity.type,
            time: unitConverter.fromSeconds(activity.moving_time).toTime(),
            time_seconds: activity.moving_time,
            date: activity.start_date,
            date_ts: parseInt(moment(activity.start_date).format('X')),
            distance: unitConverter.fromMeters(activity.distance).toKilometers(),
            distance_meters: activity.distance
        };

        if (item.type == 'Ride') {
            item.average = unitConverter.fromMetersPerSecond(activity.average_speed).toKilometersPerHour();
            item.average_metric = 'km/h';
            item.isRide = true;
        } else if (item.type == 'Run') {
            item.average = unitConverter.fromMetersPerSecond(activity.average_speed).toMinutesPerKilometer();
            item.average_metric = 'min/km';
            item.isRun = true;
        }

        return item;
    }

    function prepareAthlete(data) {
        var athlete = {
            id: data.id,
            name: data.firstname+' '+data.lastname
        };

        if (data.profile != 'avatar/athlete/large.png') {
            athlete.avatar = data.profile;
        }

        return athlete;
    }

    function pickActivitiesByType(type) {
        return function(activities) {
            return underscore.filter(activities, function(activity) {
                return activity.type == type;
            });
        }
    }

    function groupActivitiesByAthlete(activities) {
        return underscore.groupBy(activities, function(activity) {
            return activity.athlete.id;
        });
    }

    function sumActivities(groupedActivities) {
        return underscore.values(groupedActivities).map(function(activities) {
            var distanceMeters = activities.map(function(activity) {return activity.distance_meters})
                .reduce(function(sum, distance) {
                    return sum + distance;
                });

            var timeSeconds = activities
                .map(function(activity) {return activity.time_seconds})
                .reduce(function(sum, distance) {
                    return sum + distance;
                });

            return {
                athlete: activities[0].athlete,
                activities: activities.length,
                longest: unitConverter.fromMeters(underscore.max(activities.map(function (activity) {
                    return activity.distance_meters
                }))).toKilometers(),
                distance: unitConverter.fromMeters(distanceMeters).toKilometers(),
                distance_meters: parseInt(distanceMeters),
                time: unitConverter.fromSeconds(timeSeconds).toTime(),
                time_seconds: parseInt(timeSeconds),
                average: activities[0].isRide ? unitConverter.fromMetersPerSecond(distanceMeters/timeSeconds).toKilometersPerHour() : unitConverter.fromMetersPerSecond(distanceMeters/timeSeconds).toMinutesPerKilometer(),
                average_metric: activities[0].isRide ? 'km/h' : 'min/km'
            };
        });
    }

    function updateDataChannel(data) {
        dataChannel.set('strava', data);
    }

    register(null, {});
};