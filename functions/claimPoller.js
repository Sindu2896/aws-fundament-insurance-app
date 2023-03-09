const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const sqs = new SQSClient({ region: process.env.APP_AWS_REGION });
const sns = new SNSClient({ region: process.env.APP_AWS_REGION });

exports.pollFromSqs = async (event, context) => {
  try {
    const claimQueue = process.env.CLAIM_QUEUE;
    const claimTopicArn = process.env.CLAIM_TOPIC_ARN;
    const { Messages: messages } = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: claimQueue,
      MaxNumberOfMessages: 10
    }));
    if (messages) {
      const messageArr = messages.map((record) => {
        return record.Body;
      });
      const messageBody = JSON.stringify(messageArr);
      const publishParams = {
        Message: messageBody,
        TopicArn: claimTopicArn
      };
      await sns.send(new PublishCommand(publishParams));
      const deletePromises = messages.map(async (message) => {
        const receiptHandle = message.ReceiptHandle;
        await sqs.send(new DeleteMessageCommand({
          QueueUrl: claimQueue,
          ReceiptHandle: receiptHandle
        }));
      });
      await Promise.all(deletePromises);
    }

    return { statusCode: 200, body: 'Messages processed' };
  } catch (error) {
    return { statusCode: 500, body: error.stack };
  }
};
