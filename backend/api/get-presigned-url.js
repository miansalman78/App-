const {
  generatePresignedUpload,
  buildSuccessResponse,
  buildErrorResponse,
  HttpError,
  getAllowedOrigin,
} = require('../src/presignService');

module.exports = async function handler(req, res) {
  const origin = getAllowedOrigin() || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  try {
    const payload = await generatePresignedUpload(req.body || {});
    res.status(200).json(buildSuccessResponse(payload));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json(buildErrorResponse(error));
      return;
    }
    res.status(500).json(buildErrorResponse(new Error('Internal error')));
  }
}