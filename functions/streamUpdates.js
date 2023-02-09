const middy = require("@middy/core");
const inputOutputLogger = require('@middy/input-output-logger');
const { documentClient } = require('./dbClient');

const TABLE_NAME = process.env.INSURANCE_TABLE || 'Insurance';

const updateBudget = async (event) => {
  try {
    console.log(event.Records)
    for (const record of event.Records) {
      console.log('Stream record: ', JSON.stringify(record, null, 2));
      const userId = record.dynamodb.NewImage.userId.S;
      const claimAmount = record.dynamodb.NewImage.claimAmount.N;
      const userDataParams = {
        TableName: TABLE_NAME,
        Key: {
          userId: userId,
          attributeInfo: `METADATA#${userId}`
        },
      };
      const userResponse = await documentClient.get(userDataParams);
      const userInfo = userResponse.Item;
      if (!userInfo) throw new Error(`User Record Not Found for userId ${userId}`)
      if ((userInfo.insuranceBudget - claimAmount) < 0) throw new Error(`Claim amount exceeds the budget for user: ${userId}`)
      const updateParams = {
        TableName: TABLE_NAME,
        Key: {
          userId: userId,
          attributeInfo: `METADATA#${userId}`
        },
        UpdateExpression: "SET #insuranceBudget = :updatedAmount",
        ExpressionAttributeNames: {
          '#insuranceBudget': "insuranceBudget"
        },
        ExpressionAttributeValues: {
          ':updatedAmount': userInfo.insuranceBudget - claimAmount,
        },
        ReturnValues: 'UPDATED_NEW',
      };


      const response = await documentClient.update(updateParams);
      console.log(`Successfully updated the Insurance Budget for userId: ${userId}`)
      return response;
    }
  } catch (err) {
    throw err;
  }
}

module.exports.updateUserBudget = middy(updateBudget)
  .use(inputOutputLogger())
