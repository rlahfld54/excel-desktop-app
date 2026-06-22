const fs = require("node:fs");
const path = require("node:path");

const {
  closeDatabase,
  getDatabaseForInternalUse,
} = require("../public/database/localDb.cjs");

const DATABASE_DIR =
  process.env.EXCEL_APP_USER_DATA ||
  path.join(process.env.APPDATA || process.cwd(), "excel-desktop-app");
const DATABASE_PATH = path.join(DATABASE_DIR, "excel-desktop-app.sqlite");
const DRY_RUN = process.argv.includes("--inspect");

const customers = [
  ["AC-001", "한성모빌리티", "hanseongmobility"],
  ["AC-002", "대륙오토텍", "daeryukautotech"],
  ["AC-003", "세광파워트레인", "sekwangpowertrain"],
  ["AC-004", "동해정밀기어", "donghaeprecisiongear"],
  ["AC-005", "유진브레이크시스템", "yujinbrakesystem"],
  ["AC-006", "태성샤시모듈", "taeseongchassismodule"],
  ["AC-007", "성진전장솔루션", "seongjinelectric"],
  ["AC-008", "가람오토파트", "garamautoparts"],
  ["AC-009", "미래서스펜션", "miraesuspension"],
  ["AC-010", "제일차체부품", "jeilbodyparts"],
  ["AC-011", "우성모터테크", "woosungmotortech"],
  ["AC-012", "진명하네스", "jinmyeongharness"],
  ["AC-013", "한빛스티어링", "hanbitsteering"],
  ["AC-014", "케이원베어링", "konebearing"],
  ["AC-015", "삼우열관리", "samwoothermal"],
  ["AC-016", "동진에어시스템", "dongjinairsystem"],
  ["AC-017", "아진알루미늄", "ajinaluminium"],
  ["AC-018", "서진파스너", "seojinfastener"],
  ["AC-019", "대영실링테크", "daeyoungsealing"],
  ["AC-020", "한국유압모듈", "koreahydraulic"],
  ["AC-021", "동성인젝션", "dongseonginjection"],
  ["AC-022", "신화연료시스템", "shinhwafuelsystem"],
  ["AC-023", "금강배기솔루션", "geumgangexhaust"],
  ["AC-024", "에스엠클러치", "smclutch"],
  ["AC-025", "대신액슬테크", "daeshinaxle"],
  ["AC-026", "우진센서", "woojinsensor"],
  ["AC-027", "청우램프시스템", "cheongwoolamp"],
  ["AC-028", "현대정공소재", "hyundaiprecisionmaterial"],
  ["AC-029", "성우고무산업", "sungwoorubber"],
  ["AC-030", "대창플라스틱모듈", "daechangplastic"],
  ["AC-031", "한결시트프레임", "hangyeolseatframe"],
  ["AC-032", "태광도어시스템", "taekwangdoor"],
  ["AC-033", "세명와이어링", "semyeongwiring"],
  ["AC-034", "동양냉각기술", "dongyangcooling"],
  ["AC-035", "유성오일펌프", "yuseongoilpump"],
  ["AC-036", "광진워터펌프", "gwangjinwaterpump"],
  ["AC-037", "신성점화부품", "shinseongignition"],
  ["AC-038", "대원필터테크", "daewonfilter"],
  ["AC-039", "한일와이퍼시스템", "hanilwiper"],
  ["AC-040", "경동미러테크", "gyeongdongmirror"],
  ["AC-041", "오성안전벨트", "osungseatbelt"],
  ["AC-042", "미성에어백모듈", "miseongairbag"],
  ["AC-043", "태진휠솔루션", "taejinwheel"],
  ["AC-044", "삼광타이어부품", "samkwangtireparts"],
  ["AC-045", "동남배터리시스템", "dongnambattery"],
  ["AC-046", "에이치케이인버터", "hkinverter"],
  ["AC-047", "제이엠충전모듈", "jmcharging"],
  ["AC-048", "코리아전동화부품", "koreaelectrification"],
  ["AC-049", "세아경량소재", "sealightmaterial"],
  ["AC-050", "한림자동차부품", "hanrimautoparts"],
];

const contactNames = [
  "김도윤", "이서준", "박지후", "최현우", "정민재", "강준서", "조현석", "윤태호", "장우진", "임성민",
  "한지훈", "오세진", "서동현", "신재원", "권민석", "황준혁", "안태현", "송재민", "류성호", "홍지환",
  "김서연", "이수빈", "박지민", "최예린", "정하은", "강유진", "조민서", "윤채원", "장서현", "임지아",
  "한예진", "오다은", "서유나", "신소연", "권지현", "황수진", "안예은", "송하린", "류가영", "홍나연",
  "김태윤", "이주원", "박성현", "최민준", "정우석", "강지호", "조승현", "윤동욱", "장현수", "임재훈",
];

const emailNames = [
  "doyun.kim", "seojun.lee", "jihu.park", "hyunwoo.choi", "minjae.jung",
  "junseo.kang", "hyunseok.cho", "taeho.yoon", "woojin.jang", "seongmin.lim",
  "jihoon.han", "sejin.oh", "donghyun.seo", "jaewon.shin", "minseok.kwon",
  "junhyuk.hwang", "taehyun.ahn", "jaemin.song", "seongho.ryu", "jihwan.hong",
  "seoyeon.kim", "subin.lee", "jimin.park", "yerin.choi", "haeun.jung",
  "yujin.kang", "minseo.cho", "chaewon.yoon", "seohyun.jang", "jia.lim",
  "yejin.han", "daeun.oh", "yuna.seo", "soyeon.shin", "jihyun.kwon",
  "sujin.hwang", "yeeun.ahn", "harin.song", "gayoung.ryu", "nayeon.hong",
  "taeyoon.kim", "juwon.lee", "seonghyun.park", "minjun.choi", "wooseok.jung",
  "jiho.kang", "seunghyun.cho", "dongwook.yoon", "hyunsu.jang", "jaehoon.lim",
];

const productFamilies = [
  ["ENG-PISTON", "엔진 피스톤 어셈블리", "EA", 78500],
  ["ENG-VALVE", "흡배기 밸브 세트", "SET", 64200],
  ["ENG-GASKET", "실린더 헤드 가스켓", "EA", 31800],
  ["TRM-CLUTCH", "클러치 디스크", "EA", 126000],
  ["TRM-GEAR", "변속기 기어 세트", "SET", 284000],
  ["BRK-PAD", "브레이크 패드 세트", "SET", 56800],
  ["BRK-DISC", "브레이크 디스크", "EA", 92400],
  ["SUS-ARM", "로어 컨트롤 암", "EA", 118000],
  ["SUS-SHOCK", "쇼크 업소버", "EA", 143000],
  ["STR-RACK", "스티어링 랙 모듈", "EA", 396000],
  ["CHS-HUB", "휠 허브 베어링", "EA", 87500],
  ["ELE-HARNESS", "메인 와이어링 하네스", "EA", 236000],
  ["ELE-SENSOR", "휠 스피드 센서", "EA", 47200],
  ["ELE-ECU", "차체 제어 ECU", "EA", 328000],
  ["CLM-RADIATOR", "알루미늄 라디에이터", "EA", 186000],
  ["CLM-COMP", "에어컨 컴프레서", "EA", 412000],
  ["FUE-PUMP", "연료 펌프 모듈", "EA", 167000],
  ["FUE-INJECTOR", "연료 인젝터", "EA", 109000],
  ["EXH-MUFFLER", "리어 머플러 어셈블리", "EA", 214000],
  ["BDY-LAMP", "LED 헤드램프 모듈", "EA", 465000],
  ["BDY-MIRROR", "사이드 미러 어셈블리", "EA", 238000],
  ["INT-SEAT", "시트 프레임 어셈블리", "EA", 352000],
  ["SAFE-BELT", "프리텐셔너 안전벨트", "EA", 98000],
  ["EV-INVERTER", "구동 인버터 모듈", "EA", 1380000],
  ["EV-CHARGER", "온보드 차저 모듈", "EA", 920000],
];

const variants = [
  ["A", "소형 승용", 0.88],
  ["B", "중형 승용", 1],
  ["C", "SUV", 1.18],
  ["D", "상용", 1.34],
];

const departments = ["구매팀", "자재관리팀", "원가관리팀", "생산관리팀", "협력사지원팀"];
const months = [
  { value: "2026-06", days: 30 },
  { value: "2026-07", days: 31 },
  { value: "2026-08", days: 31 },
  { value: "2026-09", days: 30 },
];

function tableCount(database, tableName) {
  return database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}

function inspect(database) {
  const owners = database.prepare(`
    SELECT username, display_name AS displayName, role, department_name AS department
    FROM users
    WHERE status = 'ACTIVE'
    ORDER BY user_id
  `).all();
  const contactQuality = database.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN preferred_channel = 'EMAIL' THEN 1 ELSE 0 END) AS emailOnly,
      SUM(CASE WHEN recipient_email IS NOT NULL AND recipient_email <> '' THEN 1 ELSE 0 END) AS withEmail,
      SUM(CASE WHEN recipient_phone IS NOT NULL AND recipient_phone <> '' THEN 1 ELSE 0 END) AS withPhone
    FROM contacts
  `).get();
  const placeholderRows = database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM customers
       WHERE lower(customer_code || ' ' || customer_name || ' ' || COALESCE(memo, ''))
         LIKE '%test%'
       OR lower(customer_code || ' ' || customer_name || ' ' || COALESCE(memo, ''))
         LIKE '%sample%') +
      (SELECT COUNT(*) FROM products
       WHERE lower(product_code || ' ' || product_name || ' ' || COALESCE(memo, ''))
         LIKE '%test%'
       OR lower(product_code || ' ' || product_name || ' ' || COALESCE(memo, ''))
         LIKE '%sample%') +
      (SELECT COUNT(*) FROM sales_uploads
       WHERE lower(file_name || ' ' || COALESCE(file_path, '') || ' ' || COALESCE(memo, ''))
         LIKE '%test%'
       OR lower(file_name || ' ' || COALESCE(file_path, '') || ' ' || COALESCE(memo, ''))
         LIKE '%sample%') AS count
  `).get().count;
  return {
    databasePath: DATABASE_PATH,
    users: owners,
    counts: {
      customers: tableCount(database, "customers"),
      contacts: tableCount(database, "contacts"),
      products: tableCount(database, "products"),
      salesUploads: tableCount(database, "sales_uploads"),
      sales: tableCount(database, "sales"),
    },
    quality: {
      contacts: contactQuality,
      placeholderRows,
    },
  };
}

async function main() {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
  const app = { getPath: () => DATABASE_DIR };
  const database = getDatabaseForInternalUse(app);
  const before = inspect(database);

  if (DRY_RUN) {
    console.log(JSON.stringify({ mode: "inspect", ...before }, null, 2));
    closeDatabase();
    return;
  }

  if (before.users.length === 0) {
    throw new Error("활성 사용자가 없습니다. 관리자 회원가입 후 다시 실행해 주세요.");
  }

  const backupDir = path.join(DATABASE_DIR, "seed-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupPath = path.join(backupDir, `before-automotive-seed-${timestamp}.sqlite`);
  await database.backup(backupPath);

  const insertCustomer = database.prepare(`
    INSERT INTO customers (
      customer_code, customer_name, business_number, tax_status, status, memo, created_at, updated_at
    ) VALUES (
      @code, @name, @businessNumber, 'ACTIVE', 'ACTIVE', @memo, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
  const insertContact = database.prepare(`
    INSERT INTO contacts (
      customer_code, department_name, recipient_name, recipient_email,
      recipient_phone, preferred_channel, status, memo, created_at, updated_at
    ) VALUES (
      @customerCode, @department, @recipientName, @email,
      NULL, 'EMAIL', 'ACTIVE', @memo, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
  const insertProduct = database.prepare(`
    INSERT INTO products (
      product_code, product_name, unit, unit_price, currency, status, memo, created_at, updated_at
    ) VALUES (
      @code, @name, @unit, @price, 'KRW', 'ACTIVE', @memo, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
  const insertSnapshot = database.prepare(`
    INSERT INTO workspace_snapshots (
      file_name, file_path, payload_json, row_count, column_count,
      issue_count, duplicate_count, review_count, saved_at
    ) VALUES (
      @fileName, @filePath, @payloadJson, 1200, 10, 0, 0, 0, @savedAt
    )
  `);
  const insertUpload = database.prepare(`
    INSERT INTO sales_uploads (
      snapshot_id, file_name, file_path, normalized_json_path, closing_month,
      uploaded_department_code, uploaded_at, status, memo
    ) VALUES (
      @snapshotId, @fileName, @filePath, NULL, @month,
      '영업관리팀', @uploadedAt, 'UPLOADED', @memo
    )
  `);
  const insertSale = database.prepare(`
    INSERT INTO sales (
      upload_id, row_no, transaction_date, raw_customer_name, raw_product_name,
      customer_code, product_code, quantity, unit_price, sales_amount,
      validation_status, review_status, owner_name, created_at
    ) VALUES (
      @uploadId, @rowNo, @transactionDate, @customerName, @productName,
      @customerCode, @productCode, @quantity, @unitPrice, @salesAmount,
      '정상', 'DONE', @ownerName, @createdAt
    )
  `);

  const seed = database.transaction(() => {
    database.exec(`
      DELETE FROM reports;
      DELETE FROM email_history;
      DELETE FROM validation_issues;
      DELETE FROM closing_status;
      DELETE FROM sales;
      DELETE FROM sales_uploads;
      DELETE FROM workspace_snapshots;
      DELETE FROM contacts;
      DELETE FROM customers;
      DELETE FROM products;
    `);

    customers.forEach(([code, name, domain], index) => {
      insertCustomer.run({
        code,
        name,
        businessNumber: `${310 + (index % 80)}-${10 + (index % 89)}-${String(12000 + index * 137).padStart(5, "0")}`,
        memo: "자동차 부품 공급 거래처",
      });
      insertContact.run({
        customerCode: code,
        department: departments[index % departments.length],
        recipientName: contactNames[index],
        email: `${emailNames[index]}@${domain}.co.kr`,
        memo: "월 마감 및 매출 확인 이메일 담당자",
      });
    });

    const products = [];
    productFamilies.forEach(([familyCode, familyName, unit, basePrice]) => {
      variants.forEach(([variantCode, variantName, multiplier]) => {
        const product = {
          code: `${familyCode}-${variantCode}`,
          name: `${variantName} ${familyName}`,
          unit,
          price: Math.round((basePrice * multiplier) / 100) * 100,
          memo: `${variantName} 차량용 자동차 부품`,
        };
        products.push(product);
        insertProduct.run(product);
      });
    });

    months.forEach((month, monthIndex) => {
      const fileName = `${month.value.replace("-", "년_")}월_자동차부품_매출.xlsx`;
      const savedAt = `${month.value}-${String(month.days).padStart(2, "0")} 18:00:00`;
      const snapshot = insertSnapshot.run({
        fileName,
        filePath: path.join(DATABASE_DIR, "imports", fileName),
        payloadJson: JSON.stringify({
          source: "AUTOMOTIVE_OPERATIONAL_DATA_V1",
          month: month.value,
          industry: "자동차 부품",
          rowCount: 1200,
        }),
        savedAt,
      });
      const upload = insertUpload.run({
        snapshotId: snapshot.lastInsertRowid,
        fileName,
        filePath: path.join(DATABASE_DIR, "imports", fileName),
        month: month.value,
        uploadedAt: savedAt,
        memo: "자동차 부품 월 매출 데이터",
      });

      for (let rowNo = 1; rowNo <= 1200; rowNo += 1) {
        const customerIndex = (rowNo * 7 + monthIndex * 11) % customers.length;
        const productIndex = (rowNo * 13 + monthIndex * 17) % products.length;
        const ownerIndex = (rowNo - 1 + monthIndex) % before.users.length;
        const quantity = 1 + ((rowNo * 9 + productIndex) % 36);
        const product = products[productIndex];
        const customer = customers[customerIndex];
        const day = 1 + ((rowNo * 5 + customerIndex) % month.days);
        const transactionDate = `${month.value}-${String(day).padStart(2, "0")}`;

        insertSale.run({
          uploadId: upload.lastInsertRowid,
          rowNo,
          transactionDate,
          customerName: customer[1],
          productName: product.name,
          customerCode: customer[0],
          productCode: product.code,
          quantity,
          unitPrice: product.price,
          salesAmount: quantity * product.price,
          ownerName: before.users[ownerIndex].displayName,
          createdAt: `${transactionDate} 17:${String(rowNo % 60).padStart(2, "0")}:00`,
        });
      }
    });
  });

  seed();

  const monthly = database.prepare(`
    SELECT uploads.closing_month AS month, COUNT(*) AS rows,
           SUM(sales.sales_amount) AS amount
    FROM sales
    JOIN sales_uploads uploads ON uploads.upload_id = sales.upload_id
    GROUP BY uploads.closing_month
    ORDER BY uploads.closing_month
  `).all();
  const ownerDistribution = database.prepare(`
    SELECT uploads.closing_month AS month, sales.owner_name AS owner, COUNT(*) AS rows
    FROM sales
    JOIN sales_uploads uploads ON uploads.upload_id = sales.upload_id
    GROUP BY uploads.closing_month, sales.owner_name
    ORDER BY uploads.closing_month, sales.owner_name
  `).all();
  const after = inspect(database);
  const integrity = database.pragma("foreign_key_check");

  console.log(JSON.stringify({
    mode: "seed",
    backupPath,
    before: before.counts,
    after: after.counts,
    quality: after.quality,
    users: before.users,
    monthly,
    ownerDistribution,
    foreignKeyErrors: integrity,
  }, null, 2));

  closeDatabase();
}

main().catch((error) => {
  console.error(error);
  closeDatabase();
  process.exitCode = 1;
});
