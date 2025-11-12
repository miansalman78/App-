const { getHealthPayload, getAllowedOrigin } = require('../src/presignService');

module.exports = function handler(req, res) {
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

  res.status(200).json(getHealthPayload());
}