# Lambda Login API

This folder packages the login API expected by the desktop app.

## Build the upload ZIP

From the project root in PowerShell, run:

```powershell
./aws/lambda/build.ps1
```

The generated `aws/lambda/excel-shared-api.zip` is uploaded to the `excel-shared-api` Lambda function using **Code > Upload from > .zip file**.

Set the Lambda handler to `index.handler` and use these environment variables:

```text
DB_HOST=<RDS endpoint>
DB_PORT=5432
DB_NAME=exceldesktop
DB_USER=<RDS master user>
DB_PASSWORD=<RDS master password>
JWT_SECRET=<long random secret>
DB_SSL=true
```

## Test events

Use this event in Lambda after upload to create a test user:

```json
{
  "requestContext": { "http": { "method": "POST" } },
  "rawPath": "/auth/signup",
  "body": "{\"username\":\"admin\",\"password\":\"change-this-password\",\"name\":\"관리자\",\"departmentName\":\"관리팀\"}"
}
```

Then use this event to test login:

```json
{
  "requestContext": { "http": { "method": "POST" } },
  "rawPath": "/auth/login",
  "body": "{\"username\":\"admin\",\"password\":\"change-this-password\"}"
}
```

The Lambda only handles `/health`, `/auth/signup`, and `/auth/login`. API Gateway is configured after both test events succeed.
