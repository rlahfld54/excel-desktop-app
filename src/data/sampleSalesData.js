export const sampleColumns = ['거래일', '거래처', '품목 코드', '품목명', '수량', '단가', '금액', '검증', '담당자'];

const customers = [
  '한빛유통',
  '세종오피스',
  '노블상사',
  '에이원물류',
  '바른테크',
  '동서문구',
  '그린솔루션',
  '서울컴퍼니',
  '코리아비즈',
  '제이엠상사',
  '새롬문구',
  '대원시스템',
];

const products = [
  ['A-1024', '복사용지 A4', 5800],
  ['B-2108', '토너 카트리지', 86000],
  ['C-0412', 'USB 허브', 19500],
  ['A-1180', '라벨 스티커', 1200],
  ['D-3301', '무선 마우스', 22000],
  ['E-7120', '파일 박스', 3400],
  ['F-0905', '키보드', 31000],
  ['G-5022', '회의실 케이블', 14700],
  ['H-1100', '모니터 받침대', 27800],
  ['J-4201', '노트북 파우치', 18400],
];

const owners = ['김민서', '박준호', '이서연', '최현우', '정다은', '오지훈'];

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function formatDate(index) {
  const date = new Date(2026, 4, 18);
  date.setDate(date.getDate() - (index % 45));
  return date.toISOString().slice(0, 10);
}

function getStatus(index, productCode) {
  if (index % 37 === 0) return '확인 필요';
  if (index % 29 === 0 || productCode === 'C-0412' && index % 11 === 0) return '중복 의심';
  return '정상';
}

export function createSampleSalesRows(count = 1200) {
  return Array.from({ length: count }, (_, index) => {
    const product = products[index % products.length];
    const quantity = (index * 7) % 130 + 1;
    const unitPrice = product[2];
    const amount = quantity * unitPrice;

    return [
      formatDate(index),
      customers[index % customers.length],
      product[0],
      product[1],
      formatNumber(quantity),
      formatNumber(unitPrice),
      formatNumber(amount),
      getStatus(index, product[0]),
      owners[index % owners.length],
    ];
  });
}
