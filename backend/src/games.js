const dynamodb = require('./dynamodbClient'); // Import DynamoDB client
const AWS = require('aws-sdk');

AWS.config.update({
    region: 'us-west-2',  // Replace with your AWS region
});
async function saveGame(gameData) {
    const params = {
        TableName: 'SuimonGames',
        Item: gameData  // Assuming gameData has the correct attributes (GameID, Player1ID, etc.)
    };

    try {
        const data = await dynamodb.put(params).promise();
        console.log("Game saved:", data);
        return data;  // Return the saved data if needed
    } catch (err) {
        console.error("Unable to save game:", err);
        throw err;  // Re-throw the error
    }
}

async function getGame(gameId) {
    const params = {
        TableName: 'SuimonGames',
        Key: {
            GameID: gameId
        }
    };

    try {
        const data = await dynamodb.get(params).promise();
        console.log("GetGame result:", data);
        return data.Item; // Returns the game, if found, otherwise undefined
    } catch (error) {
        console.error("Unable to get game:", error);
        throw error;
    }
}

async function updateGame(gameId, gameState) {
    const params = {
        TableName: 'SuimonGames',
        Key: {
            GameID: gameId
        },
        UpdateExpression: 'set GameState = :gs',
        ExpressionAttributeValues: {
            ':gs': gameState
        },
        ReturnValues: 'UPDATED_NEW'
    };

    try {
        const data = await dynamodb.update(params).promise();
        console.log("Game updated:", data);
        return data;
    } catch (err) {
        console.error("Unable to update game:", err);
        throw err;
    }
}

module.exports = { saveGame, getGame, updateGame };