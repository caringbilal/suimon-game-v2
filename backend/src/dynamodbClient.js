const AWS = require('aws-sdk');

// Configure the AWS region and credentials from environment variables
AWS.config.update({
    region: process.env.AWS_REGION || 'us-west-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Create DynamoDB service object
const dynamodb = new AWS.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});

// Get player by player name
const getPlayer = async (playerName) => {
    const params = {
        TableName: "SuimonPlayers",
        Key: {
            PlayerName: playerName,
        },
    };
    try {
        const result = await dynamodb.get(params).promise();
        console.log(result);
        return result.Item;
    } catch (error) {
        console.error('Error getting player:', error);
        throw error;
    }
};

module.exports = {
    dynamodb,
    getPlayer
};