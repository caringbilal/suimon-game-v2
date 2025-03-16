const dynamodb = require('./dynamodbClient'); // Import DynamoDB client
const AWS = require('aws-sdk');

AWS.config.update({
    region: 'us-west-2',  // Replace with your AWS region
});

async function updatePlayerStats(playerId, wins, losses) {
    const params = {
        TableName: 'SuimonPlayers', // Replace with your table name
        Key: {
            PlayerID: playerId //Assuming PlayerID is the partition key
        },
        UpdateExpression: 'set Wins = :w, Losses = :l',
        ExpressionAttributeValues: {
            ':w': wins,
            ':l': losses
        },
        ReturnValues: 'UPDATED_NEW'
    };

    try {
        const data = await dynamodb.update(params).promise();
        console.log("Player stats updated:", data);
        return data; // Return the updated data if needed
    } catch (err) {
        console.error("Unable to update player stats:", err);
        throw err; // Re-throw the error so the caller can handle it
    }
}

async function getPlayer(playerId) {
  const params = {
    TableName: 'SuimonPlayers',
    Key: {
      PlayerID: playerId
    }
  };

  try {
    const data = await dynamodb.get(params).promise();
    console.log("GetPlayer result:", data);
    return data.Item; // Returns the player, if found, otherwise undefined
  } catch (error) {
    console.error("Unable to get player:", error);
    throw error;
  }
}

module.exports = { updatePlayerStats, getPlayer };