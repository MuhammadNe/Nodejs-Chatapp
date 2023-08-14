'use strict';
const uuid = require('uuid');

const readline = require('readline/promises');
const rl = readline.createInterface(process.stdin, process.stdout);

const redis = require('./redis');

// CONSTANTS
const consts = require('./const');

const userUUID = uuid.v4(); 
let userName = '';

// init redis connections
const redisClient = redis.generateClient();
const publisher = redis.generateClient();
const subscriber = redis.generateClient();

redisClient.connect();


redisClient.on('connect', async () => {
    try {
        await connectPublisher(); // connect redis publisher
        await connectSubscriber(); // connect redis subscriber
        await init(); // init app
    } catch (err) {
        console.log('An error happened, could not connect to app', err);
    }
    
})


redisClient.on('error', (err) => {
    console.log('An error happened, exiting now');
    console.error(err);
    process.exit();
})

async function init() {
    // write username
    console.log('Welcome to ChatApp.');
    console.log('To quit the app type <quit>.');
    try {
        while(userName === '') {
            userName = await rl.question('Username: ')
        }
        console.log('Hello ' + userName + '\n');
        await joinChatRoomMenu();
    } catch(err) {
        // todo handle error
    }

}

// display Join Chat Room Menu
async function joinChatRoomMenu() {
    try {
        await unsunscribeChannel(); // unsubscrube channel in case of previous subscribsion
        const activeRoomsArray = await getActiveRooms(); // get currently active chat rooms
        displayActiveRooms(activeRoomsArray); // display active chat rooms
        let roomNumber = '';
        while(!containsOnlyNumbers(roomNumber)) {
            roomNumber = await rl.question('Pick a room number, or create a new room by typing any number: ');
        }
        // subscibe to selected chat room
        const roomName = consts.CHAT_ROOM + roomNumber
        await subscribeChannel(roomName, roomNumber);
        chatInput(roomName);
    } catch (err) {
        console.log('An error happebed', err);
    }
}

// get active channels in redis
async function getActiveRooms() {
    const activeArray = [];
    return redisClient.pubSubChannels().then(channels => {
        const numsubPromises = [];
        channels.forEach((channel) => {
            // check if channel name starts with CONST CHAT_ROOM_
            if(channel.startsWith(consts.CHAT_ROOM)) {
                numsubPromises.push(redisClient.pubSubNumSub(channel));
            }
        })
        return Promise.all(numsubPromises);
    }).then((channelsNumSub) => {
        // parse rooms and get room name and subscribers
        channelsNumSub.forEach((channelNumSub) => {
            const roomKey = Object.keys(channelNumSub).at(0);
            activeArray.push({
                room: roomKey, 
                subscribers: channelNumSub[roomKey],
            })
        })
        return activeArray;
    }).catch(err => {
        return err;
    })    
}

// getActiveRooms Async Await
async function getActiveRooms_ASYNC_AWAIT() {
    const activeRoomsArray = [];
    const pubSubChannels = await redisClient.pubSubChannels();
    const numsubPromises = [];
    pubSubChannels.forEach((channel) => {
        numsubPromises.push(redisClient.pubSubNumSub(channel));
    })
    const channelsNumSub = await Promise.all(numsubPromises);
    channelsNumSub.forEach((channelNumSub) => {
        const roomKey = Object.keys(channelNumSub).at(0);
        activeRoomsArray.push({
            room: roomKey, 
            subscribers: channelNumSub[roomKey],
        })
    })
    return activeRoomsArray;
}

// Display active rooms
function displayActiveRooms(activeRoomsArray) {
    let printStr = '';
    if(activeRoomsArray.length) {
        printStr = 'Currently active rooms: \n';
        activeRoomsArray.forEach((activeRoom, index) => {
            printStr += `${activeRoom.room.split('_')[2]} - ${activeRoom.room}, (${activeRoom.subscribers}) People\n`
        })
    }
    else {
        printStr = 'No currently active rooms';
    }
    console.log(printStr + '\n');
}

// create publsh message
function createMessage(message) {
    return {
        userUUID: userUUID,
        userName,
        message
    };
}

function log(message) {
    require('readline').cursorTo(process.stdout, 0);
    console.log(message);
    rl.prompt(true);
}

// subscribe room channel
async function subscribeChannel(roomName, roomNumber) {
    console.log('Joining  Chat Room ' + roomNumber + '\n');
    console.log('To exit room type <exit>.\n')
    subscriber.subscribe(roomName, (result) => {
        const objResult = JSON.parse(result);
        if(objResult.userUUID !== userUUID) {
            log(objResult.userName + ' >: ' + objResult.message)
        }
        rl.prompt(true);
    }).catch((err) => {
        console.log('Error joining the room', err);
    });
}

// Chat input
const chatInput = (roomName) => {
    rl.question('You >: ').then((input) =>{
        if(input.toString().toLocaleLowerCase().trim() == 'quit') {
            // quit app
            rl.close()
            publisher.quit();
            subscriber.quit();
            redisClient.quit();
            console.log('Quitting app');
        } else if(input.toString().toLocaleLowerCase().trim() == 'exit') {
            // exit room
            joinChatRoomMenu();
        } else {
            // publish message
            const message = createMessage(input)
            publisher.publish(roomName, JSON.stringify(message)).then(() => {
                chatInput(roomName);
            })
        }
    });
}

async function unsunscribeChannel() {
    return subscriber.unsubscribe();
}

async function connectPublisher() {
    return publisher.connect();
}

async function connectSubscriber() {
    return subscriber.connect();
}

function containsOnlyNumbers(str) {
    return /^\d+$/.test(str);
}