import React from 'react';

const columns = ['거래일', '거래처', '품목 코드', '품목명', '수량', '단가', '금액', '검증', '담당자'];

const rows = [
  ['2026-05-18', '한빛유통', 'A-1024', '복사용지 A4', '42', '5,800', '243,600', '정상', '김민서'],
  ['2026-05-18', '세종오피스', 'B-2108', '토너 카트리지', '8', '86,000', '688,000', '확인 필요', '박준호'],
  ['2026-05-17', '노블상사', 'C-0412', 'USB 허브', '16', '19,500', '312,000', '정상', '이서연'],
  ['2026-05-17', '에이원물류', 'A-1180', '라벨 스티커', '120', '1,200', '144,000', '중복 의심', '최현우'],
  ['2026-05-16', '바른테크', 'D-3301', '무선 마우스', '24', '22,000', '528,000', '정상', '정다은'],
  ['2026-05-16', '동서문구', 'E-7120', '파일 박스', '75', '3,400', '255,000', '정상', '김민서'],
  ['2026-05-15', '그린솔루션', 'C-0412', 'USB 허브', '16', '19,500', '312,000', '중복 의심', '박준호'],
  ['2026-05-15', '서울컴퍼니', 'F-0905', '키보드', '18', '31,000', '558,000', '정상', '이서연'],
  ['2026-05-14', '코리아비즈', 'A-1024', '복사용지 A4', '60', '5,800', '348,000', '정상', '최현우'],
  ['2026-05-14', '제이엠상사', 'G-5022', '회의실 케이블', '11', '14,700', '161,700', '확인 필요', '정다은'],
];

function ExcelTable() {
  return (
    <section className="flex min-h-[520px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
        <div className="flex items-center gap-2">
          {['Sheet 1', '정제 결과', '오류 목록'].map((tab, index) => (
            <button
              key={tab}
              className={`h-8 rounded-md px-3 text-sm font-medium ${index === 0 ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60'}`}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['필터', '정렬', '열', '찾기/바꾸기', '검증', '고정', '내보내기'].map((action) => (
            <button
              key={action}
              className="h-8 rounded-md border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-700/40"
              type="button"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-[1080px] w-full border-separate border-spacing-0 text-sm dark:text-gray-300">
          <thead className="sticky top-0 z-10 text-xs text-gray-500 dark:text-gray-400">
            <tr>
              <th className="w-12 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center font-semibold dark:border-gray-700/60 dark:bg-gray-900/40">#</th>
              {columns.map((column) => (
                <th key={column} className="border-b border-r border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold dark:border-gray-700/60 dark:bg-gray-900/40">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${row[2]}-${rowIndex}`} className="group">
                <td className="border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs text-gray-400 dark:border-gray-700/60 dark:bg-gray-900/30">
                  {rowIndex + 1}
                </td>
                {row.map((cell, cellIndex) => {
                  const isStatus = cellIndex === 7;
                  const statusClass = cell === '정상'
                    ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300'
                    : cell === '중복 의심'
                      ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300';

                  return (
                    <td
                      key={`${cell}-${cellIndex}`}
                      className="border-b border-r border-gray-200 px-3 py-2 text-gray-700 group-hover:bg-sky-50/60 dark:border-gray-700/60 dark:text-gray-200 dark:group-hover:bg-sky-500/10"
                    >
                      {isStatus ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ExcelTable;
