const redis = require('redis');
const redisConfig = require('./config.json').redis;

const generateClient = () => {
    return redis.createClient({
        socket: {
            host: redisConfig.hostname,
            port: redisConfig.port,
        },
        username: redisConfig.username,
        password: redisConfig.password,
    });
}

exports.generateClient = generateClient;
 