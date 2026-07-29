# Excel Desktop Shared API Lambda

로그인, 공용 업무 데이터 동기화, 연락처·일정, AWS 파일 보관함을 제공하는 Lambda입니다.

## 1. RDS 스키마 적용

PostgreSQL 데이터베이스에 프로젝트 루트의 `aws/schema.sql`을 먼저 적용합니다. 기존 테이블에는 `IF NOT EXISTS`와 안전한 `ALTER TABLE`이 사용됩니다.

## 2. Lambda ZIP 생성

프로젝트 루트에서 PowerShell로 실행합니다.

```powershell
./aws/lambda/build.ps1
```

생성된 `aws/lambda/excel-shared-api.zip`을 Lambda 함수에 업로드하고 핸들러를 `index.handler`로 지정합니다.

## 3. 필수 환경변수

```text
DB_HOST=<RDS endpoint>
DB_PORT=5432
DB_NAME=exceldesktop
DB_USER=<database user>
DB_PASSWORD=<database password>
DB_SSL=true
JWT_SECRET=<충분히 긴 임의 문자열>
JWT_EXPIRES_IN=8h
S3_BUCKET=<AWS 파일 보관함 버킷 이름>
AWS_REGION=ap-northeast-2
```

`DB_PASSWORD`와 `JWT_SECRET`은 가능하면 Secrets Manager에서 주입하고 소스나 ZIP에 포함하지 않습니다.

## 4. Lambda 실행 역할의 S3 권한

버킷 목록 조회와 `user-files/` 아래 객체 작업이 필요합니다. `<bucket-name>`을 실제 버킷명으로 교체합니다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<bucket-name>",
      "Condition": {
        "StringLike": {
          "s3:prefix": ["user-files/*"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<bucket-name>/user-files/*"
    }
  ]
}
```

S3 버킷 CORS에는 데스크톱 앱이 발급받은 presigned URL로 `PUT`할 수 있도록 최소한 `PUT`, `GET`, 필요한 헤더를 허용합니다. 운영 웹 도메인이 있다면 `AllowedOrigins`를 해당 도메인으로 제한합니다.

## 5. 네트워크와 API Gateway

- Lambda가 RDS용 VPC에 있다면 RDS 보안 그룹의 PostgreSQL 포트 접근을 허용합니다.
- VPC Lambda가 S3에 접근하려면 S3 Gateway VPC Endpoint 또는 NAT 경로가 필요합니다.
- API Gateway HTTP API는 Lambda의 `$default` 통합 또는 아래 경로들을 전달하도록 설정합니다.
- 배포 앱은 HTTPS API 주소만 허용합니다.

주요 경로:

- 공개: `GET /health`, `POST /auth/signup`, `POST /auth/login`
- 인증 필요: `/users/me`, `/contacts`, `/closing-companies`, `/todos`, `/notifications`
- 동기화: `/sync/workspace`, `/migration/import`
- 파일 보관함: `/files`, `/files/presign`, `/files/complete`, `/files/download-url`

## 6. 배포 후 확인

1. `GET /health`가 `{ "ok": true }`를 반환하는지 확인합니다.
2. 로그인 후 발급된 Bearer 토큰으로 `GET /files`를 호출합니다.
3. 일반 사용자가 자신의 `user-files/{userId}/` 밖으로 업로드할 수 없는지 확인합니다.
4. 관리자가 기존 폴더를 선택해 업로드·다운로드·삭제할 수 있는지 확인합니다.
5. 한글 파일명, 중복 파일명, 폴더 업로드, 100MB 제한을 확인합니다.
6. Lambda 로그에서 RDS 시간 초과, S3 `AccessDenied`, VPC 경로 오류가 없는지 확인합니다.
