const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.TABLE_AWS_REGION,
});

const documentClient = DynamoDBDocument.from(client);

module.exports = {
  documentClient,
};