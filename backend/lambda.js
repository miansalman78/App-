const {
  getHealthPayload,
  generatePresignedUpload,
  buildSuccessResponse,
  buildErrorResponse,
  HttpError,
  getAllowedOrigin,
} = require('./src/presignService');

const defaultHeaders = () => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': getAllowedOrigin() || '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
});

const parseJsonBody = (event) => {
  if (!event || !event.body) {
    return {};
  }

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  if (!raw || raw.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new HttpError(400, 'Request body must be valid JSON.', error.message);
  }
};

const isOptionsRequest = (event) => {
  const method =
    event?.requestContext?.http?.method || event?.httpMethod || 'GET';
  return method.toUpperCase() === 'OPTIONS';
};

const extractPath = (event) => {
  const httpPath = event?.requestContext?.http?.path || event?.rawPath;
  if (typeof httpPath === 'string') {
    return httpPath;
  }

  return event?.path || '/';
};

const matchesPath = (actualPath, expectedPath) => {
  if (actualPath === expectedPath) {
    return true;
  }
  return actualPath?.endsWith(expectedPath);
};

exports.handler = async (event) => {
  const headers = defaultHeaders();

  if (isOptionsRequest(event)) {
    return {
      statusCode: 204,
      headers,
    };
  }

  const method =
    event?.requestContext?.http?.method || event?.httpMethod || 'GET';
  const path = extractPath(event);

  try {
    if (method === 'GET' && (matchesPath(path, '/health') || path === '/')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(getHealthPayload()),
      };
    }

    if (method === 'POST' && matchesPath(path, '/api/get-presigned-url')) {
      const body = parseJsonBody(event);
      const payload = await generatePresignedUpload(body);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(buildSuccessResponse(payload)),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: `Route ${method} ${path} is not defined.`,
      }),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      return {
        statusCode: error.statusCode,
        headers,
        body: JSON.stringify(buildErrorResponse(error)),
      };
    }

    console.error('Unhandled error in Lambda handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error.',
      }),
    };
  }
};

