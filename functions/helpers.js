const stringifyResponse = () => {
    return {
        after: async (request) => {
            request.response = {
                statusCode: 200,
                body: JSON.stringify(request.response)
            };
        }

    };
};

module.exports = {
    stringifyResponse
}