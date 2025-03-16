const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-west-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table names
const PLAYERS_TABLE = 'SuimonPlayers';
const GAMES_TABLE = 'SuimonGames';

// Player operations
const playerOperations = {
  createPlayer: async (playerData) => {
    const params = {
      TableName: PLAYERS_TABLE,
      Item: {
        playerId: playerData.sub, // Google Auth ID
        email: playerData.email,
        username: playerData.name,
        picture: playerData.picture,
        wins: 0,
        losses: 0,
        eloRating: 1000, // Initial ELO rating
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      ConditionExpression: 'attribute_not_exists(playerId)'
    };

    try {
      await dynamoDB.put(params).promise();
      return params.Item;
    } catch (error) {
      if (error.code === 'ConditionalCheckFailedException') {
        return await playerOperations.getPlayer(playerData.sub);
      }
      throw error;
    }
  },

  getPlayer: async (playerId) => {
    const params = {
      TableName: PLAYERS_TABLE,
      Key: { playerId }
    };

    const result = await dynamoDB.get(params).promise();
    return result.Item;
  },

  updatePlayer: async (playerId, updateData) => {
    const updateExpression = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.entries(updateData).forEach(([key, value]) => {
      updateExpression.push(`#${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = value;
      expressionAttributeNames[`#${key}`] = key;
    });

    const params = {
      TableName: PLAYERS_TABLE,
      Key: { playerId },
      UpdateExpression: `SET ${updateExpression.join(', ')}, #updatedAt = :updatedAt`,
      ExpressionAttributeValues: {
        ...expressionAttributeValues,
        ':updatedAt': Date.now()
      },
      ExpressionAttributeNames: {
        ...expressionAttributeNames,
        '#updatedAt': 'updatedAt'
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }
};

// Game operations
const gameOperations = {
  createGame: async (gameData) => {
    const params = {
      TableName: GAMES_TABLE,
      Item: {
        gameId: gameData.roomId,
        player1Id: gameData.player1Id,
        player2Id: gameData.player2Id,
        gameState: gameData.gameState,
        startTime: Date.now(),
        status: 'active',
        turn: 1
      }
    };

    await dynamoDB.put(params).promise();
    return params.Item;
  },

  getGame: async (gameId) => {
    const params = {
      TableName: GAMES_TABLE,
      Key: { gameId }
    };

    const result = await dynamoDB.get(params).promise();
    return result.Item;
  },

  updateGame: async (gameId, gameState) => {
    const params = {
      TableName: GAMES_TABLE,
      Key: { gameId },
      UpdateExpression: 'SET gameState = :gameState, turn = :turn, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':gameState': gameState,
        ':turn': gameState.turn,
        ':updatedAt': Date.now()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  },

  endGame: async (gameId, winnerId) => {
    const params = {
      TableName: GAMES_TABLE,
      Key: { gameId },
      UpdateExpression: 'SET winnerId = :winnerId, status = :status, endTime = :endTime',
      ExpressionAttributeValues: {
        ':winnerId': winnerId,
        ':status': 'completed',
        ':endTime': Date.now()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamoDB.update(params).promise();
    return result.Attributes;
  }
};

module.exports = {
  playerOperations,
  gameOperations
};