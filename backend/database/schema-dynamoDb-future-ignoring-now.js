const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-west-2'
});

const dynamodb = new AWS.DynamoDB();

// Players table schema
const playersTableParams = {
  TableName: 'SuimonPlayers',
  KeySchema: [
    { AttributeName: 'playerId', KeyType: 'HASH' } // Partition key
  ],
  AttributeDefinitions: [
    { AttributeName: 'playerId', AttributeType: 'S' }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Games table schema
const gamesTableParams = {
  TableName: 'SuimonGames',
  KeySchema: [
    { AttributeName: 'gameId', KeyType: 'HASH' }, // Partition key
    { AttributeName: 'startTime', KeyType: 'RANGE' } // Sort key
  ],
  AttributeDefinitions: [
    { AttributeName: 'gameId', AttributeType: 'S' },
    { AttributeName: 'startTime', AttributeType: 'N' }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  },
  GlobalSecondaryIndexes: [
    {
      IndexName: 'PlayerGamesIndex',
      KeySchema: [
        { AttributeName: 'player1Id', KeyType: 'HASH' },
        { AttributeName: 'startTime', KeyType: 'RANGE' }
      ],
      Projection: {
        ProjectionType: 'ALL'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ]
};

// Function to create tables
const createTables = async () => {
  try {
    await dynamodb.createTable(playersTableParams).promise();
    console.log('Players table created successfully');
    
    await dynamodb.createTable(gamesTableParams).promise();
    console.log('Games table created successfully');
  } catch (error) {
    if (error.code === 'ResourceInUseException') {
      console.log('Tables already exist');
    } else {
      console.error('Error creating tables:', error);
      throw error;
    }
  }
};

module.exports = { createTables };