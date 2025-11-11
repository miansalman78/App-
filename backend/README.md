# Teleprompter Upload Backend

Backend service that fulfils the Stage 3 requirement: generating S3 presigned upload URLs for the Teleprompter module.  
Two deployment modes are supported:

- Local Express server for rapid development/testing.
- AWS Lambda + API Gateway stack defined via `template.yaml` (AWS SAM/CloudFormation).

---

## Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `PORT` | No (Express only) | Local port. Defaults to `3000`. |
| `AWS_REGION` / `AWS_S3_REGION` | No | Region override (otherwise Lambda-provided region is used). |
| `AWS_S3_BUCKET` | Yes | Target bucket (e.g. `startuppal-video-storage`). |
| `AWS_S3_PREFIX` | No | Key prefix for uploads. Defaults to `user-uploads/` (trailing slash recommended). |
| `PRESIGNED_URL_EXPIRY` | No | Presigned URL TTL in seconds. Defaults to `900`. |
| `ALLOWED_ORIGIN` | No | CORS allow-origin header. Defaults to `*`. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | No | Optional static credentials for local development. In AWS, rely on the Lambda execution role instead. |

> Tip: create an `.env` locally if you need to run the Express server. The Lambda deployment reads its configuration from environment variables populated in CloudFormation.

---

## Local Development (Express)

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Configure environment:
   ```ini
   # .env (example)
   PORT=3000
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=startuppal-video-storage
   AWS_S3_PREFIX=user-uploads/
   PRESIGNED_URL_EXPIRY=900
   ```

   Provide `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` **or** run the server on an EC2/VM that has an instance profile with S3 `PutObject` rights on the uploads prefix.

3. Start the server:
   ```bash
   npm run start
   # or during development
   npm run dev
   ```

The service listens on `http://localhost:3000`.

---

## AWS Deployment (Lambda + API Gateway via SAM)

### Prerequisites

- AWS account with access to create CloudFormation stacks, Lambda functions, API Gateway HTTP APIs, and assign IAM policies limited to `s3:PutObject` on `startuppal-video-storage/user-uploads/*`.
- AWS CLI configured (v2+).
- AWS SAM CLI (`sam --version`).
- Access to the backend source folder (`backend/`).

### 1. Validate / Build

```bash
cd backend
sam validate
sam build
```

### 2. Deploy (guided on first run)

```bash
sam deploy --guided
```

Recommended parameter values when prompted:

| Parameter | Suggested Value |
| --------- | ---------------- |
| `Stack Name` | `teleprompter-presign-backend` |
| `AWS Region` | `us-east-1` (or the bucket’s region) |
| `S3BucketName` | `startuppal-video-storage` |
| `S3Prefix` | `user-uploads/` |
| `PresignedUrlExpiry` | `900` |
| `CorsAllowedOrigins` | `https://teleprompter.startuppal.com` (or `*` for testing) |
| `StageName` | `$default` (produces cleaner URLs) |

SAM will upload the Lambda bundle to the deployment bucket, create the Lambda function, wire it to an HTTP API, and apply the least-privilege S3 permissions (`s3:PutObject` on `bucket/prefix*`).

Deployment output includes `ApiEndpoint`. When using `$default`, the base URL matches the value shown (e.g. `https://abc123.execute-api.us-east-1.amazonaws.com`). Append `/api/get-presigned-url` for uploads and `/health` for diagnostics.

### 3. Smoke Test

```bash
curl https://{api-id}.execute-api.{region}.amazonaws.com/health
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp4","contentType":"video/mp4"}' \
  https://{api-id}.execute-api.{region}.amazonaws.com/api/get-presigned-url
```

Verify the JSON response returns `success: true` and a valid `presignedUrl`.

---

## API Contract

- `GET /health` &rarr; Returns config status. Used by the app’s “Test Connection” flow.
- `POST /api/get-presigned-url` &rarr; Body `{ "fileName": "video.mp4", "contentType": "video/mp4" }`.

Example success response:
```json
{
  "success": true,
  "presignedUrl": "https://startuppal-video-storage.s3.amazonaws.com/user-uploads/1730981234-video.mp4?...",
  "key": "user-uploads/1730981234-video.mp4",
  "bucket": "startuppal-video-storage",
  "region": "us-east-1",
  "expiresIn": 900
}
```

Error responses follow the same shape with `success: false` and an explanatory `error` string.

---

## IAM / Access Notes

- The Lambda execution role only needs `s3:PutObject` for `arn:aws:s3:::startuppal-video-storage/user-uploads/*` (already enforced in `template.yaml`).
- If a developer must deploy on your behalf, grant a temporary IAM role limited to:
  - `cloudformation:*` (stack create/update on this template).
  - `lambda:*` (function deployment).
  - `apigateway:*` (HTTP API configuration).
  - `iam:PassRole` for the SAM-generated execution role (SAM handles this automatically when the deploying principal can create the role).
  - `s3:PutObject` on the deployment artifacts bucket (SAM prompt will create/upload to a managed bucket).

---

## Integrating with the App

- Set the backend base URL inside the Teleprompter app (`AWSSettings` or AsyncStorage key `aws_config.backendUrl`).
- The mobile app never stores AWS credentials; it always requests a presigned PUT URL from this backend, then uploads the file directly to S3.
- Ensure firewall rules allow outbound HTTPS traffic from the devices to the API Gateway endpoint.

---

## Troubleshooting

- `MISSING_CONFIG` from `/health`: the Lambda/Express environment is missing `AWS_S3_BUCKET`.
- CORS failures: adjust `CorsAllowedOrigins` (SAM) or `ALLOWED_ORIGIN` (Express) to include the frontend origin.
- Access denied when uploading: confirm the object key prefix matches `S3Prefix` and that the Lambda role retains `s3:PutObject` on that prefix.

