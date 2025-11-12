const express = require('express');
const cors = require('cors');
const {
  getHealthPayload,
  generatePresignedUpload,
  buildSuccessResponse,
  buildErrorResponse,
  HttpError,
  getConfig,
} = require('./src/presignService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json(getHealthPayload());
});

app.post('/api/get-presigned-url', async (req, res) => {
  try {
    const payload = await generatePresignedUpload(req.body || {});
    res.json(buildSuccessResponse(payload));
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json(buildErrorResponse(error));
    }
    console.error('Error generating presigned URL:', error);
    res
      .status(500)
      .json(
        buildErrorResponse(
          new Error('Failed to generate presigned URL. Please try again later.')
        )
      );
  }
});

app.listen(PORT, () => {
  const config = getConfig();
  console.log(`🚀 Teleprompter upload backend running on port ${PORT}`);
  if (!config.bucket) {
    console.warn('⚠️  AWS_S3_BUCKET is not set. Presigned URL requests will fail.');
  }
  if (!config.credentialsProvided) {
    console.warn(
      '⚠️  AWS credentials not explicitly provided. Ensure the server has IAM permissions.'
    );
  }
});
