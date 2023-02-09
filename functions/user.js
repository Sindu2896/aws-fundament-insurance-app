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
const ALLOWED_INSURANCE_BUDGET = 2000000;


const get = async (event) => {
    try {
        const { userId } = event.pathParameters;
        const params = {
            TableName: TABLE_NAME,
            Key: {
                userId: userId,
                attributeInfo: `METADATA#${userId}`
            },
        };
        const response = await documentClient.get(params);
        const item = response.Item;
        if (!item) throw createError(404, `Record Not Found for userId ${userId}`)
        return item;
    } catch (error) {
        throw error
    }

};


module.exports.getUser = middy(get)
    .use(cors())
    .use(httpJsonBodyParser())
    .use(inputOutputLogger())
    .use(httpErrorHandler({
        awsContext: true
    }))
    .use(stringifyResponse());

const create = async (event) => {
    try {
        const { username, role, orgName } = event.body;
        const userId = uuidv4();
        const params = {
            TableName: TABLE_NAME,
            Item: {
                userId: userId ,
                attributeInfo: `METADATA#${userId}`,
                insuranceBudget: ALLOWED_INSURANCE_BUDGET,
                orgName: orgName,
                role: role ,
                username: username,
            }
        };


        await documentClient.put(params);
        return {
            username,
            orgName,
            role,
            userId,
            insuranceBudget: ALLOWED_INSURANCE_BUDGET,
        };
    } catch (err) {
        throw createError(500,err);
    }
};

module.exports.createUser = middy(create)
    .use(cors())
    .use(stringifyResponse())
    .use(httpJsonBodyParser())
    .use(inputOutputLogger())
    .use(httpErrorHandler({
        awsContext: true
    }))
