# AWS 초기 데이터 API 규격

초기 설정 마법사와 저장 설정 화면은 다음 API를 호출합니다.

```http
GET {API_BASE_URL}/bootstrap
Authorization: Bearer {ACCESS_TOKEN}
Accept: application/json
```

접근 토큰은 요청에만 사용하며 앱 설정 파일에 저장하지 않습니다. 배포 앱에서는 HTTPS 주소만 허용합니다.

## 응답 예시

```json
{
  "customers": [
    {
      "customerCode": "CUST-001",
      "customerName": "거래처명",
      "businessNumber": "123-45-67890",
      "taxStatus": "TAXABLE",
      "status": "ACTIVE",
      "memo": "",
      "updatedAt": "2026-06-21T09:00:00.000Z"
    }
  ],
  "products": [
    {
      "productCode": "PROD-001",
      "productName": "제품명",
      "unit": "EA",
      "unitPrice": 15000,
      "currency": "KRW",
      "status": "ACTIVE",
      "memo": "",
      "updatedAt": "2026-06-21T09:00:00.000Z"
    }
  ],
  "contacts": [
    {
      "customerCode": "CUST-001",
      "departmentName": "구매팀",
      "recipientName": "김담당",
      "recipientEmail": "contact@example.com",
      "recipientPhone": "010-1234-5678",
      "preferredChannel": "EMAIL",
      "status": "ACTIVE",
      "memo": ""
    }
  ]
}
```

거래처와 제품은 각 코드 기준으로 SQLite에 UPSERT됩니다. AWS API가 준비되지 않은 사용자는 초기 설정에서 `지금은 로컬로 시작`을 선택할 수 있습니다.
