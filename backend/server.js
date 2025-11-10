require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const AWS_S3_PREFIX = process.env.AWS_S3_PREFIX || 'user-uploads/';
const PRESIGNED_URL_EXPIRY = parseInt(process.env.PRESIGNED_URL_EXPIRY || '900', 10); // 15 minutes default

const credentialsProvided = Boolean(
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: credentialsProvided
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

app.get('/health', (req, res) => {
  res.json({
    status: AWS_S3_BUCKET ? 'OK' : 'MISSING_CONFIG',
    config: {
      bucket: AWS_S3_BUCKET || null,
      region: AWS_REGION,
      prefix: AWS_S3_PREFIX,
      hasCredentials: credentialsProvided,
      presignedExpirySeconds: PRESIGNED_URL_EXPIRY,
    },
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/get-presigned-url', async (req, res) => {
  try {
    if (!AWS_S3_BUCKET) {
      return res.status(500).json({
        success: false,
        error: 'AWS_S3_BUCKET is not configured on the backend.',
      });
    }

    const { fileName, contentType } = req.body || {};

    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'fileName is required.',
      });
    }

    const safeContentType =
      typeof contentType === 'string' && contentType.trim().length > 0
        ? contentType
        : 'video/mp4';

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const key = `${AWS_S3_PREFIX}${timestamp}-${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      ContentType: safeContentType,
      Metadata: {
        'uploaded-by': 'teleprompter-module',
        'upload-timestamp': new Date().toISOString(),
      },
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY,
    });

    res.json({
      success: true,
      presignedUrl,
      key,
      bucket: AWS_S3_BUCKET,
      region: AWS_REGION,
      expiresIn: PRESIGNED_URL_EXPIRY,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate presigned URL.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Teleprompter upload backend running on port ${PORT}`);
  if (!AWS_S3_BUCKET) {
    console.warn('⚠️  AWS_S3_BUCKET is not set. Presigned URL requests will fail.');
  }
  if (!credentialsProvided) {
    console.warn('⚠️  AWS credentials not explicitly provided. Ensure the server has IAM permissions.');
  }
});


