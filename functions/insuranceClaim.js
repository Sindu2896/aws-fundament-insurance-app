const middy = require("@middy/core");
const { v4: uuidv4 } = require('uuid');
const { documentClient } = require('./dbClient');
const cors = require('@middy/http-cors');
const httpJsonBodyParser = require('@middy/http-json-body-parser');
const httpErrorHandler = require('@middy/http-error-handler');
const inputOutputLogger = require('@middy/input-output-logger');
const createError = require('http-errors');
const { stringifyResponse } = require('./helpers');

const TABLE_NAME = process.env.INSURANCE_TABLE || 'Insurance';
const INITIAL_CLAIM_STATUS = 'PENDING';


const get = async (event) => {
  try {
    const { userId } = event.pathParameters;
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#id = :userId AND begins_with(#attr, :attributeInfo)',
      ExpressionAttributeNames: {
        '#id': 'userId',
        '#attr': 'attributeInfo'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':attributeInfo': 'CLAIM#',
      },
    };
    const response = await documentClient.query(params);
    const items = response.Items;
    return {
      claims: items
    };
  } catch (error) {
    throw error
  }
};

module.exports.getClaims = middy(get)
  .use(cors())
  .use(httpJsonBodyParser())
  .use(inputOutputLogger())
  .use(httpErrorHandler({
    awsContext: true
  }))
  .use(stringifyResponse());



const create = async (event) => {
  try {
    const { userId } = event.pathParameters;
    const { claimAmount, claimType } = event.body;

    const userDataParams = {
      TableName: TABLE_NAME,
      Key: {
        userId: userId,
        attributeInfo: `METADATA#${userId}`
      },
    };
    const userResponse = await documentClient.get(userDataParams);
    const userInfo = userResponse.Item;
    if (!userInfo) throw createError(404, `User Record Not Found for userId ${userId}`)
    if ((userInfo.insuranceBudget - claimAmount) < 0) throw createError(405, `Claim amount exceeds the budget for user: ${userId}`)
    const claimId = uuidv4();
    const claimData = {
      userId,
      claimAmount,
      claimType,
      orgName: userInfo.orgName,
      createdAt: new Date().toJSON(),
      status: INITIAL_CLAIM_STATUS,
    }
    const claimParams = {
      TableName: TABLE_NAME,
      Item: {
        ...claimData,
        attributeInfo: `CLAIM#${claimId}`,
      }
    };


    await documentClient.put(claimParams);
    return claimData;
  } catch (err) {
    throw createError(500, err);
  }
};

module.exports.createClaim = middy(create)
  .use(cors())
  .use(stringifyResponse())
  .use(httpJsonBodyParser())
  .use(inputOutputLogger())
  .use(httpErrorHandler({
    awsContext: true
  }))


const update = async (event) => {
  try {
    const { userId, claimId } = event.pathParameters;
    const { claimAmount } = event.body;
    const updatableProperties = ['claimAmount', 'claimType', 'status']


    const userDataParams = {
      TableName: TABLE_NAME,
      Key: {
        userId: userId,
        attributeInfo: `METADATA#${userId}`
      },
    };
    const userResponse = await documentClient.get(userDataParams);
    const userInfo = userResponse.Item;
    if (!userInfo) throw createError(404, `User Record Not Found for userId ${userId}`)
    if ((userInfo.insuranceBudget - claimAmount) < 0) throw createError(405, `Claim amount exceeds the budget for user: ${userId}`)
    let updateExpression = 'set';
    let expressionAttributeNames = {};
    let expressionAttributeValues = {};
    for (const property in event.body) {
      if (updatableProperties.includes(property)) {
        updateExpression += ` #${property} = :${property} ,`;
        expressionAttributeNames['#' + property] = property;
        expressionAttributeValues[':' + property] = event.body[property];
      }

    }

    updateExpression = updateExpression.slice(0, -1);


    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId: userId,
        attributeInfo: `CLAIM#${claimId}`
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };


    const response = await documentClient.update(params);
    return response.Attributes;
  } catch (err) {
    throw createError(500, err);
  }
};

module.exports.updateClaim = middy(update)
  .use(cors())
  .use(stringifyResponse())
  .use(httpJsonBodyParser())
  .use(inputOutputLogger())
  .use(httpErrorHandler({
    awsContext: true
  }))
