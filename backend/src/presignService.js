require('dotenv').config();

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_PREFIX = 'user-uploads/';
const DEFAULT_EXPIRY_SECONDS = 900;

class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const rawPrefix = process.env.AWS_S3_PREFIX || DEFAULT_PREFIX;
const normalizedPrefix =
  typeof rawPrefix === 'string' && rawPrefix.length > 0
    ? rawPrefix.endsWith('/') || rawPrefix.endsWith('*')
      ? rawPrefix.replace(/\*+$/, '')
      : `${rawPrefix}/`
    : DEFAULT_PREFIX;

const presignedExpirySeconds = Number.parseInt(
  process.env.PRESIGNED_URL_EXPIRY || `${DEFAULT_EXPIRY_SECONDS}`,
  10
);

const credentialsProvided = Boolean(
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);

const config = {
  region:
    process.env.AWS_REGION ||
    process.env.AWS_S3_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    DEFAULT_REGION,
  bucket: process.env.AWS_S3_BUCKET || null,
  prefix: normalizedPrefix,
  presignedExpirySeconds:
    Number.isFinite(presignedExpirySeconds) && presignedExpirySeconds > 0
      ? presignedExpirySeconds
      : DEFAULT_EXPIRY_SECONDS,
  credentialsProvided,
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
};

const sharedS3Client = new S3Client({
  region: config.region,
  credentials: credentialsProvided
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const defaultMetadata = Object.freeze({
  'uploaded-by': 'teleprompter-module',
});

const sanitizeFileName = (fileName) =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-200);

const buildS3Key = (fileName) => {
  const timestamp = Date.now();
  const sanitizedName = sanitizeFileName(fileName);
  return `${config.prefix}${timestamp}-${sanitizedName}`;
};

const safeContentType = (contentType) =>
  typeof contentType === 'string' && contentType.trim().length > 0
    ? contentType.trim()
    : 'video/mp4';

const getHealthPayload = () => ({
  status: config.bucket ? 'OK' : 'MISSING_CONFIG',
  config: {
    bucket: config.bucket,
    region: config.region,
    prefix: config.prefix,
    hasCredentials: config.credentialsProvided,
    presignedExpirySeconds: config.presignedExpirySeconds,
    allowedOrigin: config.allowedOrigin,
  },
  timestamp: new Date().toISOString(),
});

const generatePresignedUpload = async ({ fileName, contentType }) => {
  if (!config.bucket) {
    throw new HttpError(
      500,
      'AWS_S3_BUCKET is not configured on the backend.',
      'Set the AWS_S3_BUCKET environment variable before requesting presigned URLs.'
    );
  }

  if (!fileName || typeof fileName !== 'string') {
    throw new HttpError(400, 'fileName is required and must be a string.');
  }

  const key = buildS3Key(fileName);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: safeContentType(contentType),
    Metadata: {
      ...defaultMetadata,
      'upload-timestamp': new Date().toISOString(),
    },
  });

  const presignedUrl = await getSignedUrl(sharedS3Client, command, {
    expiresIn: config.presignedExpirySeconds,
  });

  return {
    presignedUrl,
    key,
    bucket: config.bucket,
    region: config.region,
    expiresIn: config.presignedExpirySeconds,
  };
};

const buildSuccessResponse = (payload) => ({
  success: true,
  ...payload,
});

const buildErrorResponse = (error) => ({
  success: false,
  error: error.message,
  ...(error.details ? { details: error.details } : {}),
});

module.exports = {
  HttpError,
  getHealthPayload,
  generatePresignedUpload,
  buildSuccessResponse,
  buildErrorResponse,
  getConfig: () => ({ ...config }),
  getAllowedOrigin: () => config.allowedOrigin,
};

