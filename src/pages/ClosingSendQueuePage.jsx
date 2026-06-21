import React, { useEffect, useMemo, useState } from 'react';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';

import PageShell from './PageShell';
import { addActivityLog, getCurrentUser } from '../utils/authSession';
import { addNotification } from '../utils/appNotifications';
import { getBusinessCard, makeSignatureText } from '../utils/businessCard';

const closingDays = ['10일', '25일', '30일'];
const temporaryRecipientEmail = 'rlahfld54@naver.com';

const steps = [
  { title: '대상 선택', description: '연락할 업체를 묶어서 발송 큐에 담습니다.' },
  { title: '발송 유형 확인', description: '상태에 따라 마감장, 금액 확인, 세금계산서 확인 요청을 자동 분류합니다.' },
  { title: '첨부 생성', description: '업체별 엑셀/PDF 마감장과 요청 자료 생성 상태를 확인합니다.' },
  { title: '문구 미리보기', description: '메일 또는 카톡 문구를 발송 전 한 번에 검토합니다.' },
  { title: '메일 발송', description: '선택한 거래처에 실제 메일을 보내고 성공·실패 기록을 저장합니다.' },
];

function formatCurrency(value) {
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function getTargetDate(target, month) {
  const day = String(parseInt(target.deadline, 10) || 1).padStart(2, '0');
  return `${month}-${day}`;
}

function isInDateRange(value, startDate, endDate) {
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

function matchesTargetFilters(target, params) {
  const targetDate = getTargetDate(target, params.month);
  const matchesDate = isInDateRange(targetDate, params.startDate, params.endDate);
  const matchesManager = params.manager === '전체' || target.manager === params.manager;
  const matchesDeadline = params.deadline === '전체' || target.deadline === params.deadline;
  return matchesDate && matchesManager && matchesDeadline;
}

function getCurrentMonthRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const format = (date) => {
    const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${dateMonth}-${day}`;
  };

  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    startDate: format(new Date(year, month, 1)),
    endDate: format(new Date(year, month + 1, 0)),
  };
}

function getUserEmail(user) {
  return String(user?.email ?? '').trim();
}

function getDefaultSenderName(user) {
  const card = getBusinessCard(user);
  return [card.department || '총무팀', card.name || '담당자', card.title || ''].filter(Boolean).join(' ');
}

function formatBytes(value) {
  if (!value) return '0 KB';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(Math.round(value / 1024), 1)} KB`;
}

function sanitizeFileName(value) {
  return String(value ?? 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

async function downloadBlob(blob, fileName) {
  if (fileName.toLowerCase().endsWith('.xlsx') && window.api?.saveFileAs) {
    const buffer = await blob.arrayBuffer();
    const result = await window.api.saveFileAs({
      fileName,
      bytes: Array.from(new Uint8Array(buffer)),
      openFolder: true,
    });

    if (result?.canceled) return;
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let koreanFontBytesPromise;

function loadKoreanFontBytes() {
  if (!koreanFontBytesPromise) {
    koreanFontBytesPromise = fetch(`${import.meta.env.BASE_URL}fonts/malgun.ttf`).then((response) => {
      if (!response.ok) throw new Error('PDF 한글 폰트를 불러오지 못했습니다.');
      return response.arrayBuffer();
    });
  }
  return koreanFontBytesPromise;
}

function wrapPdfText(text, font, size, maxWidth) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];

  const lines = [];
  let line = '';

  normalized.split('').forEach((char) => {
    const nextLine = `${line}${char}`;
    if (font.widthOfTextAtSize(nextLine, size) > maxWidth && line) {
      lines.push(line);
      line = char.trimStart();
      return;
    }
    line = nextLine;
  });

  if (line) lines.push(line);
  return lines;
}

async function createClosingPdfBlob(target, mailTemplates) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await loadKoreanFontBytes();
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 48;
  const teal = rgb(0.02, 0.48, 0.44);
  const gray = rgb(0.32, 0.36, 0.43);
  const lightGray = rgb(0.95, 0.97, 0.98);
  const border = rgb(0.82, 0.86, 0.9);
  let y = height - 58;

  page.drawText('마감 확인 요청서', { x: margin, y, size: 24, font, color: teal });
  page.drawText('Excel Desktop App', { x: margin, y: y - 22, size: 10, font, color: gray });
  page.drawText(new Date().toLocaleDateString('ko-KR'), { x: width - margin - 86, y, size: 10, font, color: gray });

  y -= 62;
  page.drawRectangle({ x: margin, y: y - 86, width: width - margin * 2, height: 96, color: lightGray, borderColor: border, borderWidth: 1 });
  [
    ['업체명', target.company],
    ['거래처 담당자', target.contactName],
    ['내부 담당자', target.manager],
    ['마감일', target.deadline],
  ].forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + 18 + col * 250;
    const rowY = y - 16 - row * 38;
    page.drawText(label, { x, y: rowY, size: 9, font, color: gray });
    page.drawText(String(value), { x, y: rowY - 17, size: 13, font, color: rgb(0.06, 0.09, 0.16) });
  });

  y -= 126;
  page.drawText('마감 정보', { x: margin, y, size: 15, font, color: rgb(0.06, 0.09, 0.16) });
  y -= 28;
  [
    ['마감 금액', formatCurrency(target.amount)],
    ['발송 유형', getSendType(target)],
    ['미확정 사유', target.reason],
    ['마지막 연락', `${target.lastContactAt} / ${target.contactCount}회`],
    ['세금계산서 상태', target.taxIssued ? '발행 확인' : '발행 전'],
  ].forEach(([label, value]) => {
    page.drawRectangle({ x: margin, y: y - 12, width: width - margin * 2, height: 30, borderColor: border, borderWidth: 0.8 });
    page.drawText(label, { x: margin + 12, y, size: 10, font, color: gray });
    page.drawText(String(value), { x: margin + 150, y, size: 11, font, color: rgb(0.06, 0.09, 0.16) });
    y -= 30;
  });

  y -= 18;
  page.drawText('요청 문구', { x: margin, y, size: 15, font, color: rgb(0.06, 0.09, 0.16) });
  y -= 24;
  const messageLines = wrapPdfText(getTargetMailBody(target, mailTemplates), font, 11, width - margin * 2 - 24);
  page.drawRectangle({ x: margin, y: y - Math.max(messageLines.length * 18 + 20, 74), width: width - margin * 2, height: Math.max(messageLines.length * 18 + 32, 86), color: rgb(0.99, 0.99, 0.99), borderColor: border, borderWidth: 1 });
  messageLines.forEach((line) => {
    page.drawText(line, { x: margin + 12, y, size: 11, font, color: rgb(0.17, 0.2, 0.26) });
    y -= 18;
  });

  page.drawText('첨부 엑셀 파일과 함께 거래처 확인 요청 메일에 첨부됩니다.', {
    x: margin,
    y: 42,
    size: 9,
    font,
    color: gray,
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function saveGeneratedFilesToDisk(fileGroups) {
  if (!window.api?.saveGeneratedFiles || fileGroups.length === 0) return null;

  const payloadFiles = [];
  for (const group of fileGroups) {
    for (const file of group.files) {
      if (!['XLSX', 'PDF'].includes(file.type)) continue;
      payloadFiles.push({
        fileName: file.fileName,
        base64: await blobToBase64(file.blob),
        mimeType: file.mimeType,
      });
    }
  }

  if (payloadFiles.length === 0) return null;

  const result = await window.api.saveGeneratedFiles({
    folderName: `마감첨부_${fileGroups.length}개업체`,
    files: payloadFiles,
  });

  if (!result?.ok) {
    throw new Error(result?.message || '첨부파일 저장에 실패했습니다.');
  }

  return result;
}

function downloadTextFile(text, fileName, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type }), fileName);
}

function escapeVCardValue(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function createBusinessCardFile(user) {
  const card = getBusinessCard(user);
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardValue(card.name)}`,
    `N:${escapeVCardValue(card.name)};;;;`,
    card.companyKr ? `ORG:${escapeVCardValue(card.companyKr)}${card.department ? `;${escapeVCardValue(card.department)}` : ''}` : '',
    card.title ? `TITLE:${escapeVCardValue(card.title)}` : '',
    card.phone ? `TEL;TYPE=CELL:${escapeVCardValue(card.phone)}` : '',
    card.email ? `EMAIL;TYPE=WORK:${escapeVCardValue(card.email)}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\r\n');
  const fileName = `${sanitizeFileName(`${card.name || '담당자'}_명함`)}.vcf`;
  const blob = new Blob([`\uFEFF${vcard}`], { type: 'text/vcard;charset=utf-8' });

  return {
    type: 'VCF',
    fileName,
    blob,
    size: blob.size,
    mimeType: blob.type,
  };
}

async function createBusinessCardImageFile(user) {
  const response = await fetch(`${import.meta.env.BASE_URL}email-signature-card.png`);
  if (!response.ok) {
    throw new Error('메일 명함 이미지를 불러오지 못했습니다.');
  }
  const backgroundBlob = await response.blob();
  const backgroundImage = await createImageBitmap(backgroundBlob);
  const card = getBusinessCard(user);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('메일 명함 이미지를 만들 수 없습니다.');
  }

  context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  backgroundImage.close();

  context.fillStyle = 'rgba(255,255,255,0.9)';
  context.beginPath();
  context.roundRect(335, 75, 610, 360, 22);
  context.fill();

  context.fillStyle = '#0f766e';
  context.font = '700 24px "Noto Sans KR", Arial, sans-serif';
  context.fillText(card.companyKr || card.company || 'Aster Works', 390, 135);

  context.fillStyle = '#0f172a';
  context.font = '700 52px "Noto Sans KR", Arial, sans-serif';
  context.fillText(card.name || '담당자', 390, 210);

  context.fillStyle = '#475569';
  context.font = '600 27px "Noto Sans KR", Arial, sans-serif';
  context.fillText([card.department, card.title].filter(Boolean).join(' · ') || '총무팀', 390, 260);

  context.strokeStyle = '#99f6e4';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(390, 292);
  context.lineTo(885, 292);
  context.stroke();

  context.fillStyle = '#334155';
  context.font = '500 24px "Noto Sans KR", Arial, sans-serif';
  if (card.email) context.fillText(`E. ${card.email}`, 390, 340);
  if (card.phone) context.fillText(`T. ${card.phone}`, 390, 382);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('메일 명함 이미지 변환에 실패했습니다.'));
    }, 'image/png');
  });

  return {
    type: 'IMAGE',
    fileName: 'email-signature-card.png',
    blob,
    size: blob.size,
    mimeType: 'image/png',
    cid: 'asterworks-business-card',
    contentDisposition: 'inline',
  };
}

function escapeMailHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createMailHtml(target, templates, currentUser) {
  const bodyHtml = escapeMailHtml(getTargetMailBody(target, templates)).replace(/\n/g, '<br>');

  return `
    <div style="font-family:Arial,'Noto Sans KR',sans-serif;color:#334155;font-size:14px;line-height:1.75">
      <div>${bodyHtml}</div>
      <div style="margin-top:28px;width:600px;max-width:100%">
        <img src="cid:asterworks-business-card" alt="Aster Works 명함" width="600" style="display:block;width:100%;height:auto;border:0;border-radius:12px">
      </div>
    </div>
  `;
}

function getContactLabel(target) {
  const department = target.contactDepartment || '정산팀';
  const name = target.contactName || '담당자';
  const title = target.contactTitle || '담당자';
  return `${target.company} ${department} ${name} ${title}님`;
}

function getSendType(target) {
  if (!target.closingSheetSent) return '마감장 최초 발송';
  if (!target.amountConfirmed) return '금액 확인 재연락';
  if (target.amountConfirmed && !target.taxIssued) return '세금계산서 발행 요청';
  return '마감 완료 안내';
}

function getSendTone(type) {
  if (type.includes('최초')) return 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
  if (type.includes('금액')) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
  if (type.includes('세금계산서')) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
}

function getMessagePreview(target) {
  const sendType = getSendType(target);

  if (sendType === '마감장 최초 발송') {
    return `${target.company} ${target.contactName}님, ${target.deadline} 마감장 확인 요청드립니다. 첨부된 엑셀/PDF 금액 확인 후 회신 부탁드립니다.`;
  }

  if (sendType === '금액 확인 재연락') {
    return `${target.company} ${target.contactName}님, 보내드린 마감장 금액 확인이 아직 완료되지 않아 재연락드립니다. 금액 확정 가능 여부 회신 부탁드립니다.`;
  }

  if (sendType === '세금계산서 발행 요청') {
    return `${target.company} ${target.contactName}님, 마감 금액 확정이 완료되어 세금계산서 발행 확인 요청드립니다. 발행 후 공급가액 일치 여부 확인 부탁드립니다.`;
  }

  return `${target.company} ${target.contactName}님, 마감 금액과 세금계산서 확인이 완료되었습니다. 협조 감사합니다.`;
}

function getDefaultTemplateBySendType(sendType) {
  const templates = {
    '마감장 최초 발송': '첨부드린 마감장 엑셀과 PDF를 확인하신 뒤 금액 이상 여부를 회신 부탁드립니다.',
    '금액 확인 재연락': '이전에 전달드린 마감장 금액 확인이 아직 완료되지 않아 재연락드립니다. 금액 확정 가능 여부를 회신 부탁드립니다.',
    '세금계산서 발행 요청': '마감 금액 확정이 완료되어 세금계산서 발행 확인을 요청드립니다. 발행 후 공급가액 일치 여부를 확인 부탁드립니다.',
    '마감 완료 안내': '마감 금액과 세금계산서 확인이 완료되었습니다. 협조 감사합니다.',
  };

  return templates[sendType] ?? templates['마감장 최초 발송'];
}

function makeDefaultMailTemplates(user = {}) {
  const card = getBusinessCard(user);
  const department = card.department || '담당 부서';
  const name = card.name || '담당자';
  const title = card.title ? ` ${card.title}` : '';

  return {
    subjectSuffix: '의 건',
    greeting: `안녕하세요. ${department} ${name}${title}입니다.`,
    closing: '감사합니다.',
    commonByType: {
      '마감장 최초 발송': getDefaultTemplateBySendType('마감장 최초 발송'),
      '금액 확인 재연락': getDefaultTemplateBySendType('금액 확인 재연락'),
      '세금계산서 발행 요청': getDefaultTemplateBySendType('세금계산서 발행 요청'),
      '마감 완료 안내': getDefaultTemplateBySendType('마감 완료 안내'),
    },
    targetSubjects: {},
    targetBodies: {},
    targetNotes: {},
  };
}

function getTargetMailSubject(target, templates = makeDefaultMailTemplates()) {
  if (Object.prototype.hasOwnProperty.call(templates.targetSubjects ?? {}, target.id)) {
    return templates.targetSubjects[target.id];
  }

  const sendType = getSendType(target);
  return `${target.company} ${sendType} ${templates.subjectSuffix || '의 건'}`;
}

function getTargetMailBody(target, templates = makeDefaultMailTemplates()) {
  if (Object.prototype.hasOwnProperty.call(templates.targetBodies ?? {}, target.id)) {
    return templates.targetBodies[target.id];
  }

  const sendType = getSendType(target);
  const commonBody = templates.commonByType?.[sendType] || getDefaultTemplateBySendType(sendType);
  const targetNote = templates.targetNotes?.[target.id]?.trim();

  return [
    getContactLabel(target),
    '',
    templates.greeting || '안녕하세요. 담당자입니다.',
    '',
    commonBody,
    '',
    `마감일: ${target.deadline}`,
    `마감 금액: ${formatCurrency(target.amount)}`,
    `확인 유형: ${sendType}`,
    targetNote ? ['', '[추가 안내]', targetNote].join('\n') : '',
    '',
    templates.closing || '감사합니다.',
  ].filter(Boolean).join('\n');
}

function createCombinedMailBody({ emailTargets, templates, currentUser }) {
  return [
    ...emailTargets.flatMap((target, index) => [
      index > 0 ? '\n------------------------------' : '',
      getTargetMailBody(target, templates),
    ]),
    makeSignatureText(currentUser),
  ].filter(Boolean).join('\n');
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getMailSubject(target, templates) {
  return target ? getTargetMailSubject(target, templates) : `거래처 마감 자료 확인 ${templates?.subjectSuffix || '의 건'}`;
}

async function createClosingXlsxBlob(target, mailTemplates) {
  const ExcelModule = await import('exceljs');
  const ExcelJS = ExcelModule.default ?? ExcelModule;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('마감 요청');

  workbook.creator = 'Excel Desktop App';
  workbook.created = new Date();
  workbook.modified = new Date();
  worksheet.columns = [
    { header: '항목', key: 'label', width: 22 },
    { header: '내용', key: 'value', width: 42 },
  ];
  worksheet.addRows([
    { label: '업체명', value: target.company },
    { label: '거래처 담당자', value: target.contactName },
    { label: '내부 담당자', value: target.manager },
    { label: '마감일', value: target.deadline },
    { label: '마감 금액', value: target.amount },
    { label: '발송 유형', value: getSendType(target) },
    { label: '미확정 사유', value: target.reason },
    { label: '마지막 연락', value: target.lastContactAt },
  ]);
  worksheet.getRow(1).font = { bold: true };
  worksheet.getColumn('value').numFmt = '#,##0';
  worksheet.addRow({});
  worksheet.addRow({ label: '요청 문구', value: getTargetMailBody(target, mailTemplates) });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function createGeneratedFiles(targets, mailTemplates) {
  const createdAt = new Date().toISOString();
  const fileGroups = [];

  for (const target of targets) {
    const baseName = sanitizeFileName(`${target.company}_${target.deadline}_마감요청`);
    const xlsxBlob = await createClosingXlsxBlob(target, mailTemplates);
    const pdfBlob = await createClosingPdfBlob(target, mailTemplates);
    fileGroups.push({
      targetId: target.id,
      company: target.company,
      createdAt,
      files: [
        {
          type: 'XLSX',
          fileName: `${baseName}.xlsx`,
          blob: xlsxBlob,
          size: xlsxBlob.size,
          mimeType: xlsxBlob.type,
        },
        {
          type: 'PDF',
          fileName: `${baseName}.pdf`,
          blob: pdfBlob,
          size: pdfBlob.size,
          mimeType: pdfBlob.type,
        },
      ],
    });
  }

  return fileGroups;
}

async function createEmailDraftEml({ emailTargets, generatedFileGroups, mailSettings, currentUser, mailTemplates }) {
  const firstTarget = emailTargets[0];
  const subject = getMailSubject(firstTarget, mailTemplates);
  const body = createCombinedMailBody({ emailTargets, templates: mailTemplates, currentUser }).replace(/\n/g, '\r\n');
  const boundary = `----=_ClosingDraft_${Date.now()}`;
  const businessCardFile = createBusinessCardFile(currentUser);
  const attachments = generatedFileGroups
    .filter((group) => emailTargets.some((target) => target.id === group.targetId))
    .flatMap((group) => group.files)
    .concat(businessCardFile);
  const encodedAttachments = [];

  for (const file of attachments) {
    encodedAttachments.push({
      ...file,
      base64: await blobToBase64(file.blob),
    });
  }

  const headers = [
    `From: ${mailSettings.senderName || 'Excel Desktop App'} <${mailSettings.gmailAddress || 'sender@gmail.com'}>`,
    `To: ${mailSettings.testEmail || mailSettings.gmailAddress || 'test@example.com'}`,
    mailSettings.replyToEmail ? `Reply-To: ${mailSettings.replyToEmail}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    ...encodedAttachments.flatMap((file) => [
      `--${boundary}`,
      `Content-Type: ${file.mimeType}; name="${file.fileName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${file.fileName}"`,
      '',
      file.base64.replace(/(.{76})/g, '$1\r\n'),
    ]),
    `--${boundary}--`,
    '',
  ];

  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

function createMailBody({ emailTargets, mailTemplates, currentUser }) {
  return createCombinedMailBody({ emailTargets, templates: mailTemplates, currentUser });
}

function makePreflightChecks({ mailSettings, mailTemplates, selectedTargets, emailTargets, isGenerated }) {
  const gmailAddress = mailSettings.gmailAddress.trim();
  const testEmail = mailSettings.testEmail.trim();

  return [
    {
      label: 'Gmail 주소',
      ok: isEmail(gmailAddress) && gmailAddress.toLowerCase().endsWith('@gmail.com'),
      detail: gmailAddress ? 'gmail.com 주소 형식 확인' : '발송자 Gmail 주소를 입력하세요.',
    },
    {
      label: '앱 비밀번호',
      ok: mailSettings.appPassword.trim().length >= 12,
      detail: 'Google 계정의 앱 비밀번호 16자리를 권장합니다.',
    },
    {
      label: '테스트 수신자',
      ok: isEmail(testEmail),
      detail: testEmail ? '테스트 수신 이메일 형식 확인' : '내 메일로 테스트할 주소를 입력하세요.',
    },
    {
      label: '선택 업체',
      ok: selectedTargets.length > 0,
      detail: `${selectedTargets.length}개 업체가 발송 큐에 담겨 있습니다.`,
    },
    {
      label: '메일 대상',
      ok: emailTargets.length > 0,
      detail: `${emailTargets.length}개 업체는 이메일 채널입니다.`,
    },
    {
      label: '첨부 생성',
      ok: isGenerated,
      detail: isGenerated ? '엑셀/PDF 첨부 생성 상태 확인' : '첨부 생성 단계에서 먼저 생성하세요.',
    },
    {
      label: '제목/본문',
      ok: emailTargets.length > 0,
      detail: emailTargets[0] ? getMailSubject(emailTargets[0], mailTemplates) : '메일 대상 선택 후 자동 생성됩니다.',
    },
    {
      label: '실제 발송 잠금',
      ok: true,
      detail: '최종 단계에서 선택한 거래처 이메일로 실제 발송할 수 있습니다.',
    },
  ];
}

function StatusPill({ children, className = '' }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function PreflightChecklist({ checks }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {checks.map((check) => (
        <div
          key={check.label}
          className={`rounded-md border px-3 py-2 ${
            check.ok
              ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
              : 'border-amber-100 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                check.ok ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {check.ok ? '✓' : '!'}
            </span>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{check.label}</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{check.detail}</p>
        </div>
      ))}
    </div>
  );
}

function SendResultModal({ result, onClose }) {
  if (!result) return null;

  const isSuccess = result.status === 'SUCCESS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4">
      <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-white ${isSuccess ? 'bg-emerald-600' : 'bg-rose-600'}`}>
              {isSuccess ? '✓' : '!'}
            </span>
            <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-gray-100">
              {isSuccess ? '메일 발송 완료' : '메일 발송 실패'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{result.message}</p>
          </div>
          <button className="rounded-md px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" type="button" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="mt-4 grid gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/40">
          <div className="flex justify-between gap-3">
            <span className="text-gray-500 dark:text-gray-400">수신자</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{result.to}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500 dark:text-gray-400">첨부</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{result.attachmentCount}개</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-500 dark:text-gray-400">처리 시각</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{new Date(result.createdAt).toLocaleString('ko-KR', { hour12: false })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MailSendProgressModal({ state, onClose }) {
  if (!state) return null;
  const isSending = state.status === 'sending';
  const isSuccess = state.status === 'completed' && state.failureCount === 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-2xl dark:bg-gray-800">
        {isSending ? (
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />
        ) : (
          <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold ${isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isSuccess ? '✓' : '!'}
          </div>
        )}
        <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">
          {isSending ? '메일 발송 중' : isSuccess ? '메일 발송 완료' : '메일 발송 결과'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{state.message}</p>
        {!isSending && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">성공 {state.successCount}건</div>
            <div className="rounded-lg bg-rose-50 p-3 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">실패 {state.failureCount}건</div>
          </div>
        )}
        {!isSending && <button className="btn btn-primary mt-5 w-full" type="button" onClick={onClose}>확인</button>}
      </div>
    </div>
  );
}

function AttachmentPreviewModal({ preview, onClose, onDownload }) {
  const objectUrl = useMemo(() => (preview?.file?.blob ? URL.createObjectURL(preview.file.blob) : ''), [preview]);

  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  if (!preview) return null;

  const isPdf = preview.file.type === 'PDF';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4">
      <div className="flex h-[min(86vh,760px)] w-full max-w-5xl flex-col rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
          <div className="min-w-0">
            <p className="truncate font-bold text-gray-900 dark:text-gray-100">{preview.file.fileName}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{preview.company} · {preview.file.type} · {formatBytes(preview.file.size)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="btn btn-secondary" type="button" onClick={() => onDownload(preview.file)}>다운로드</button>
            <button className="btn btn-secondary" type="button" onClick={onClose}>닫기</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-gray-50 p-4 dark:bg-gray-900/30">
          {isPdf ? (
            <iframe className="h-full w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700" title={preview.file.fileName} src={objectUrl} />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">엑셀 미리보기</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                엑셀 파일은 이미지로 변환하면 느리고 글자가 흐려질 수 있어, 실제 파일 다운로드로 확인하는 방식이 더 안정적입니다.
                현재 생성된 파일은 메일 첨부에 그대로 사용됩니다.
              </p>
              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                  <span className="text-gray-500 dark:text-gray-400">파일명</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{preview.file.fileName}</span>
                </div>
                <div className="flex justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                  <span className="text-gray-500 dark:text-gray-400">크기</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBytes(preview.file.size)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MailTemplateModal({ templates, onChange, onClose }) {
  const sendTypes = ['마감장 최초 발송', '금액 확인 재연락', '세금계산서 발행 요청', '마감 완료 안내'];

  const updateField = (field, value) => {
    onChange({ ...templates, [field]: value });
  };

  const updateTypeBody = (type, value) => {
    onChange({
      ...templates,
      commonByType: {
        ...templates.commonByType,
        [type]: value,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4">
      <div className="flex h-[min(88vh,820px)] w-full max-w-6xl flex-col rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">메일 문구 서식 설정</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              공통 서식과 발송 유형별 본문을 수정합니다.
            </p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onClose}>닫기</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <section className="grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">제목 끝 문구</span>
              <input className="form-input w-full" value={templates.subjectSuffix} onChange={(event) => updateField('subjectSuffix', event.target.value)} />
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">공통 인사말</span>
              <input className="form-input w-full" value={templates.greeting} onChange={(event) => updateField('greeting', event.target.value)} />
            </label>
            <label className="block lg:col-span-3">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">마무리 문구</span>
              <input className="form-input w-full" value={templates.closing} onChange={(event) => updateField('closing', event.target.value)} />
            </label>
          </section>

          <section className="mt-5">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">발송 유형별 공통 본문</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {sendTypes.map((type) => (
                <label key={type} className="block rounded-lg border border-gray-200 p-3 dark:border-gray-700/60">
                  <span className="mb-2 block text-sm font-bold text-gray-900 dark:text-gray-100">{type}</span>
                  <textarea
                    className="form-textarea min-h-24 w-full"
                    value={templates.commonByType[type] || ''}
                    onChange={(event) => updateTypeBody(type, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TargetMailNoteModal({ target, templates, onChange, onClose }) {
  if (!target) return null;

  const defaultSubject = getTargetMailSubject(target, {
    ...templates,
    targetSubjects: Object.fromEntries(
      Object.entries(templates.targetSubjects ?? {}).filter(([targetId]) => targetId !== target.id)
    ),
  });
  const defaultBody = getTargetMailBody(target, {
    ...templates,
    targetBodies: Object.fromEntries(
      Object.entries(templates.targetBodies ?? {}).filter(([targetId]) => targetId !== target.id)
    ),
  });
  const subjectValue = Object.prototype.hasOwnProperty.call(templates.targetSubjects ?? {}, target.id)
    ? templates.targetSubjects[target.id]
    : defaultSubject;
  const bodyValue = Object.prototype.hasOwnProperty.call(templates.targetBodies ?? {}, target.id)
    ? templates.targetBodies[target.id]
    : defaultBody;

  const updateTargetSubject = (value) => {
    onChange({
      ...templates,
      targetSubjects: {
        ...(templates.targetSubjects ?? {}),
        [target.id]: value,
      },
    });
  };

  const updateTargetBody = (value) => {
    onChange({
      ...templates,
      targetBodies: {
        ...(templates.targetBodies ?? {}),
        [target.id]: value,
      },
    });
  };

  const resetTargetCopy = () => {
    const nextTargetSubjects = { ...(templates.targetSubjects ?? {}) };
    const nextTargetBodies = { ...(templates.targetBodies ?? {}) };
    const nextTargetNotes = { ...(templates.targetNotes ?? {}) };

    delete nextTargetSubjects[target.id];
    delete nextTargetBodies[target.id];
    delete nextTargetNotes[target.id];

    onChange({
      ...templates,
      targetSubjects: nextTargetSubjects,
      targetBodies: nextTargetBodies,
      targetNotes: nextTargetNotes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700/60">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{target.company} 메일 문구 수정</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{target.email} · {getSendType(target)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="btn btn-secondary" type="button" onClick={resetTargetCopy}>기본값</button>
            <button className="btn btn-secondary" type="button" onClick={onClose}>닫기</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-900 dark:text-gray-100">메일 제목</span>
            <input
              className="form-input w-full"
              value={subjectValue}
              onChange={(event) => updateTargetSubject(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-gray-900 dark:text-gray-100">메일 본문 전체</span>
            <textarea
              className="form-textarea min-h-80 w-full resize-y leading-6"
              value={bodyValue}
              onChange={(event) => updateTargetBody(event.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function mapClosingCompanyToTarget(row) {
  return {
    id: row.id,
    company: row.company,
    manager: row.owner,
    contactName: row.contactName,
    contactDepartment: row.contactDepartment,
    contactTitle: row.contactTitle,
    email: row.email,
    phone: row.phone,
    channel: row.channel || 'EMAIL',
    deadline: row.deadline,
    closingSheetSent: row.closingSheetSent,
    amountConfirmed: row.amountConfirmed,
    taxIssued: row.taxIssued,
    taxMatched: row.taxMatched,
    reason: row.requestSent ? '마감 완료' : row.reason,
    amount: row.confirmedAmount || row.salesAmount || 0,
    salesAmount: row.salesAmount || 0,
    confirmedAmount: row.confirmedAmount || 0,
    taxAmount: row.taxAmount || 0,
    lastContactAt: row.lastContactAt,
    contactCount: row.contactCount || 0,
  };
}

async function readClosingTargetsFromDatabase(options) {
  if (!window.api?.getClosingCompanies) return [];
  const result = await window.api.getClosingCompanies({
    ...options,
    excludeCompleted: true,
    emailOnly: true,
  });
  return result?.ok && Array.isArray(result.rows)
    ? result.rows.map(mapClosingCompanyToTarget).filter((target) => target.channel === 'EMAIL')
    : [];
}

async function readClosingSendRecordsFromDatabase(month, currentUser) {
  if (!window.api?.getSendPackages) return [];
  const result = await window.api.getSendPackages({
    createdBy: currentUser.id,
    isAdmin: currentUser.role === 'ADMIN',
  });
  const packages = result?.ok && Array.isArray(result.packages) ? result.packages : [];
  const successfulStatuses = new Set(['SENT', 'SUCCESS', 'COMPLETED', 'REPLIED', 'CLOSED']);

  return packages
    .filter((sendPackage) => !month || sendPackage.closingMonth === month)
    .flatMap((sendPackage) => sendPackage.items.map((item) => ({
      id: `db-${item.itemId}`,
      status: successfulStatuses.has(item.status) ? 'SUCCESS' : 'ERROR',
      type: 'CLOSING',
      to: item.channel === 'EMAIL' ? item.recipientEmail : item.recipientPhone,
      subject: item.subject,
      attachmentCount: [item.attachmentPdfPath, item.attachmentXlsxPath].filter(Boolean).length,
      message: item.memo || `${item.customerName} 발송 기록`,
      createdAt: item.createdAt,
    })))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export default function ClosingSendQueuePage() {
  const currentUser = getCurrentUser();
  const currentUserEmail = getUserEmail(currentUser);
  const [currentStep, setCurrentStep] = useState(0);
  const [closingTargets, setClosingTargets] = useState([]);
  const [activeManagers, setActiveManagers] = useState(() => (
    [currentUser.name || currentUser.id].filter(Boolean)
  ));
  const [selectedIds, setSelectedIds] = useState([]);
  const [params, setParams] = useState(() => ({
    ...getCurrentMonthRange(),
    manager: currentUser.name || currentUser.id || '전체',
    deadline: '전체',
    page: 1,
    pageSize: 10,
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isGeneratingFiles, setIsGeneratingFiles] = useState(false);
  const [isSendingTestMail, setIsSendingTestMail] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [mailSendProgress, setMailSendProgress] = useState(null);
  const [generatedFileGroups, setGeneratedFileGroups] = useState([]);
  const [sendRecords, setSendRecords] = useState([]);
  const [sendResultModal, setSendResultModal] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState(null);
  const [mailTemplates, setMailTemplates] = useState(() => makeDefaultMailTemplates(currentUser));
  const [mailDraftStatus, setMailDraftStatus] = useState('첨부 파일을 생성하면 메일 초안 파일을 만들 수 있습니다.');
  const [statusText, setStatusText] = useState('오늘 연락할 업체를 모아서 한 번에 검토합니다.');
  const [mailSettings, setMailSettings] = useState({
    senderName: getDefaultSenderName(currentUser),
    gmailAddress: currentUserEmail,
    appPassword: '',
    testEmail: '',
    replyToEmail: currentUserEmail,
  });
  const [preflightChecked, setPreflightChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (window.api?.getAppSettings) {
      window.api.getAppSettings()
        .then((result) => {
          const settings = result?.settings ?? result;
          if (!isMounted || !settings) return;
          setMailSettings({
            senderName: getDefaultSenderName(currentUser),
            gmailAddress: settings.gmailAddress || currentUserEmail,
            appPassword: settings.gmailAppPassword || '',
            testEmail: settings.gmailTestEmail || '',
            replyToEmail: settings.gmailReplyToEmail || currentUserEmail,
          });
        })
        .catch(() => {
          // Keep user profile defaults when app settings are unavailable.
        });
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser.name, currentUserEmail]);

  const managerOptions = useMemo(
    () => activeManagers,
    [activeManagers],
  );

  useEffect(() => {
    let active = true;
    if (!window.api?.listUsers) return undefined;

    window.api.listUsers()
      .then((result) => {
        if (!active) return;
        const managers = (result?.users ?? [])
          .filter((user) => (
            user.status === 'ACTIVE'
            && (currentUser.role === 'ADMIN' || user.id === currentUser.id)
          ))
          .map((user) => user.name || user.id)
          .filter(Boolean);
        setActiveManagers(Array.from(new Set(managers)));
      })
      .catch(() => {
        // Keep the current logged-in user when SQLite users cannot be loaded.
      });

    return () => {
      active = false;
    };
  }, [currentUser.id, currentUser.role]);
  const visibleClosingTargets = useMemo(
    () => closingTargets.filter((target) => matchesTargetFilters(target, params)),
    [closingTargets, params]
  );
  const selectedTargets = useMemo(
    () => visibleClosingTargets.filter((target) => selectedIds.includes(target.id)),
    [selectedIds, visibleClosingTargets]
  );
  const queueTotalPages = Math.max(Math.ceil(visibleClosingTargets.length / params.pageSize), 1);
  const paginatedClosingTargets = useMemo(
    () => visibleClosingTargets.slice((params.page - 1) * params.pageSize, params.page * params.pageSize),
    [params.page, params.pageSize, visibleClosingTargets]
  );

  useEffect(() => {
    setParams((current) => ({
      ...current,
      page: Math.min(current.page, queueTotalPages),
    }));
  }, [queueTotalPages]);
  const groupedCounts = useMemo(() => selectedTargets.reduce((acc, target) => {
    const type = getSendType(target);
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {}), [selectedTargets]);
  const emailTargets = useMemo(
    () => selectedTargets
      .filter((target) => target.channel === 'EMAIL')
      .map((target) => ({
        ...target,
        email: temporaryRecipientEmail,
      })),
    [selectedTargets]
  );
  const preflightChecks = useMemo(
    () => makePreflightChecks({ mailSettings, mailTemplates, selectedTargets, emailTargets, isGenerated }),
    [mailSettings, mailTemplates, selectedTargets, emailTargets, isGenerated]
  );
  const editingTarget = useMemo(
    () => selectedTargets.find((target) => target.id === editingTargetId) || null,
    [selectedTargets, editingTargetId]
  );
  const isPreflightReady = preflightChecks.every((check) => check.ok);
  const isActualSendReady = preflightChecks
    .filter((check) => check.label !== '테스트 수신자')
    .every((check) => check.ok)
    && emailTargets.every((target) => isEmail(target.email));
  const visibleTargetIds = useMemo(
    () => visibleClosingTargets.map((target) => target.id),
    [visibleClosingTargets],
  );
  const selectedVisibleCount = visibleTargetIds.filter((id) => selectedIds.includes(id)).length;
  const isAllVisibleSelected = visibleTargetIds.length > 0 && selectedVisibleCount === visibleTargetIds.length;

  const updateDateRange = (key, value) => {
    setParams((current) => ({
      ...current,
      [key]: value,
      month: key === 'startDate' && value ? value.slice(0, 7) : current.month,
      page: 1,
    }));
    setGeneratedFileGroups([]);
    setIsGenerated(false);
    setMailDraftStatus('조회 기간이 바뀌었습니다. 첨부 파일을 다시 생성하세요.');
  };

  const updateQueryFilter = (key, value) => {
    setParams((current) => ({
      ...current,
      [key]: value,
      page: 1,
    }));
    setGeneratedFileGroups([]);
    setIsGenerated(false);
    setMailDraftStatus('조회 조건이 바뀌었습니다. 첨부 파일을 다시 생성하세요.');
  };

  const handleSearch = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setStatusText('SQLite에서 발송 대상 업체를 조회하는 중입니다.');
    try {
      const [databaseTargets, databaseSendRecords] = await Promise.all([
        readClosingTargetsFromDatabase(params),
        readClosingSendRecordsFromDatabase(params.month, currentUser),
      ]);
      const searchedTargets = databaseTargets.filter((target) => matchesTargetFilters(target, params));
      setClosingTargets(databaseTargets);
      setSelectedIds(searchedTargets.filter((item) => item.reason !== '마감 완료').map((item) => item.id));
      setSendRecords(databaseSendRecords);
      setParams((current) => ({ ...current, page: 1 }));
      setCurrentStep(0);
      setGeneratedFileGroups([]);
      setIsGenerated(false);
      setStatusText(`조회 조건에 맞는 발송 대상 ${searchedTargets.length.toLocaleString('ko-KR')}개 업체를 불러왔습니다.`);
    } catch (error) {
      setClosingTargets([]);
      setSelectedIds([]);
      setStatusText(error?.message || 'SQLite 발송 대상 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMailTemplatesChange = (nextTemplates) => {
    setMailTemplates(nextTemplates);
    setPreflightChecked(false);
    setGeneratedFileGroups([]);
    setIsGenerated(false);
    setMailDraftStatus('메일 문구가 바뀌었습니다. 첨부 파일을 다시 생성하면 PDF/XLSX에도 새 문구가 반영됩니다.');
  };

  const toggleTarget = (id) => {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
    setGeneratedFileGroups([]);
    setIsGenerated(false);
    setMailDraftStatus('발송 대상이 바뀌었습니다. 첨부 파일을 다시 생성하세요.');
  };

  const toggleAllVisibleTargets = () => {
    setSelectedIds((current) => {
      if (isAllVisibleSelected) {
        return current.filter((id) => !visibleTargetIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleTargetIds]));
    });
    setGeneratedFileGroups([]);
    setIsGenerated(false);
    setMailDraftStatus('발송 대상이 바뀌었습니다. 첨부 파일을 다시 생성하세요.');
    setStatusText(isAllVisibleSelected
      ? '현재 조회 결과의 선택을 모두 해제했습니다.'
      : `현재 조회 결과 ${visibleTargetIds.length.toLocaleString('ko-KR')}개 업체를 모두 선택했습니다.`);
  };

  const selectByPredicate = (predicate, message) => {
    setSelectedIds(visibleClosingTargets.filter(predicate).map((target) => target.id));
    setStatusText(message);
    setParams((current) => ({ ...current, page: 1 }));
    setGeneratedFileGroups([]);
    setIsGenerated(false);
    setMailDraftStatus('대상이 바뀌었습니다. 첨부 파일을 다시 생성하세요.');
    setCurrentStep(0);
  };

  const handleGenerateAttachments = async () => {
    if (selectedTargets.length === 0 || isGeneratingFiles) return;
    setIsGeneratingFiles(true);
    setStatusText(`${selectedTargets.length}개 업체의 엑셀/PDF 첨부파일을 생성하는 중입니다.`);

    try {
      const nextFileGroups = await createGeneratedFiles(selectedTargets, mailTemplates);
      const saveResult = await saveGeneratedFilesToDisk(nextFileGroups);
      const savedPathByName = new Map((saveResult?.savedFiles || []).map((file) => [file.fileName, file.filePath]));
      const fileGroupsWithPaths = nextFileGroups.map((group) => ({
        ...group,
        savedFolderPath: saveResult?.folderPath,
        files: group.files.map((file) => ({
          ...file,
          filePath: savedPathByName.get(file.fileName),
        })),
      }));
      setGeneratedFileGroups(fileGroupsWithPaths);
      setIsGenerated(true);
      setMailDraftStatus(`${nextFileGroups.length}개 업체의 첨부가 준비되었습니다. 메일 초안 파일을 만들 수 있습니다.`);
      setStatusText(saveResult?.folderPath
        ? `${selectedTargets.length}개 업체의 엑셀/PDF 첨부파일을 생성하고 저장했습니다.`
        : `${selectedTargets.length}개 업체의 엑셀/PDF 첨부파일 생성이 완료되었습니다.`);
      addNotification({
        title: '발송 큐 첨부 생성 완료',
        message: saveResult?.folderPath
          ? `${selectedTargets.length}개 업체의 엑셀/PDF 파일을 저장했습니다.`
          : `${selectedTargets.length}개 업체의 엑셀/PDF 파일을 생성했습니다.`,
        level: 'SUCCESS',
        target: 'closing-send-queue',
        href: '/closing-workspace/send-queue',
      });
    } catch (error) {
      setStatusText('첨부 파일 생성 중 오류가 발생했습니다. 다시 시도하세요.');
      addNotification({
        title: '첨부 생성 실패',
        message: error?.message || '엑셀/PDF 파일 생성 중 오류가 발생했습니다.',
        level: 'ERROR',
        target: 'closing-send-queue',
        href: '/closing-workspace/send-queue',
      });
    } finally {
      setIsGeneratingFiles(false);
    }
  };

  const handleDownloadFile = async (file) => {
    await downloadBlob(file.blob, file.fileName);
  };

  const handleOpenFileLocation = async (file) => {
    if (!file?.filePath || !window.api?.openFileLocation) return;

    const result = await window.api.openFileLocation(file.filePath);
    if (!result?.ok) {
      setStatusText(result?.message || '파일 위치를 열 수 없습니다.');
    }
  };

  const handleCreateMailDraft = async () => {
    if (!isGenerated || emailTargets.length === 0) {
      setMailDraftStatus('메일 대상과 첨부 파일을 먼저 준비하세요.');
      return;
    }

    const eml = await createEmailDraftEml({ emailTargets, generatedFileGroups, mailSettings, currentUser, mailTemplates });
    const fileName = `${sanitizeFileName(`마감_메일_초안_${emailTargets.length}개업체`)}.eml`;
    downloadTextFile(eml, fileName, 'message/rfc822;charset=utf-8');
    setMailDraftStatus(`${fileName} 파일을 만들었습니다. 열어서 첨부 포함 메일 초안을 확인하세요.`);
    addNotification({
      title: '메일 초안 파일 생성',
      message: `${emailTargets.length}개 이메일 대상의 첨부 포함 초안을 만들었습니다.`,
      level: 'SUCCESS',
      target: 'closing-send-queue',
      href: '/closing-workspace/send-queue',
    });
  };

  const handleNext = async () => {
    if (currentStep === 2 && !isGenerated) {
      await handleGenerateAttachments();
    }

    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  };

  const handlePreflightCheck = () => {
    setPreflightChecked(true);

    if (isPreflightReady) {
      setStatusText(`Gmail 전송 전 점검 완료: ${emailTargets.length}개 메일 대상, 실제 발송은 아직 비활성화 상태입니다.`);
      addNotification({
        title: 'Gmail 전송 전 점검 완료',
        message: `${emailTargets.length}개 메일 대상의 발송 직전 조건을 확인했습니다.`,
        level: 'SUCCESS',
        target: 'closing-send-queue',
        href: '/closing-workspace/send-queue',
      });
      return;
    }

    setStatusText('Gmail 전송 전 점검에서 보완할 항목이 있습니다. 체크리스트를 확인하세요.');
    addNotification({
      title: 'Gmail 전송 전 점검 필요',
      message: '발송 직전 조건 중 아직 준비되지 않은 항목이 있습니다.',
      level: 'WARNING',
      target: 'closing-send-queue',
      href: '/closing-workspace/send-queue',
    });
  };

  const handleSendRealTestMail = async () => {
    if (!window.api?.sendGmailTest) {
      setMailDraftStatus('실제 발송은 Electron 데스크톱 앱에서만 가능합니다.');
      return;
    }

    if (!isPreflightReady) {
      setPreflightChecked(true);
      setMailDraftStatus('전송 전 점검을 먼저 완료하세요.');
      return;
    }

    setIsSendingTestMail(true);
    setMailDraftStatus(`${mailSettings.testEmail}로 실제 테스트 메일을 발송하는 중입니다.`);

    try {
      const attachments = [];
      const businessCardFile = createBusinessCardFile(currentUser);
      const businessCardImageFile = await createBusinessCardImageFile(currentUser);
      const targetIds = new Set(emailTargets.map((target) => target.id));
      const files = generatedFileGroups
        .filter((group) => targetIds.has(group.targetId))
        .flatMap((group) => group.files)
        .concat(businessCardFile, businessCardImageFile);

      for (const file of files) {
        attachments.push({
          fileName: file.fileName,
          mimeType: file.mimeType,
          base64: await blobToBase64(file.blob),
          cid: file.cid,
          contentDisposition: file.contentDisposition,
        });
      }

      const result = await window.api.sendGmailTest({
        senderName: getDefaultSenderName(currentUser),
        gmailAddress: mailSettings.gmailAddress,
        appPassword: mailSettings.appPassword,
        testEmail: mailSettings.testEmail,
        replyToEmail: mailSettings.replyToEmail,
        subject: getMailSubject(emailTargets[0], mailTemplates),
        text: createMailBody({ emailTargets, mailTemplates, currentUser }),
        html: createMailHtml(emailTargets[0], mailTemplates, currentUser),
        attachments,
      });

      if (!result?.ok) {
        throw new Error(result?.message || 'Gmail 테스트 발송에 실패했습니다.');
      }

      const record = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        status: 'SUCCESS',
        type: 'TEST',
        to: mailSettings.testEmail,
        subject: getMailSubject(emailTargets[0], mailTemplates),
        attachmentCount: result.attachmentCount,
        messageId: result.messageId,
        message: `${mailSettings.testEmail}로 첨부 ${result.attachmentCount}개를 포함해 발송했습니다.`,
        createdAt: new Date().toISOString(),
      };
      setSendRecords((current) => [record, ...current]);
      setSendResultModal(record);
      setMailDraftStatus(`실제 테스트 메일 발송 완료: ${mailSettings.testEmail} / 첨부 ${result.attachmentCount}개`);
      setStatusText(`${mailSettings.testEmail}로 Gmail 테스트 메일을 실제 발송했습니다.`);
      addNotification({
        title: 'Gmail 테스트 메일 발송 완료',
        message: `${mailSettings.testEmail}로 첨부 ${result.attachmentCount}개를 포함해 발송했습니다.`,
        level: 'SUCCESS',
        target: 'closing-send-queue',
        href: '/closing-workspace/send-queue',
      });
    } catch (error) {
      const record = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        status: 'ERROR',
        type: 'TEST',
        to: mailSettings.testEmail || '-',
        subject: getMailSubject(emailTargets[0], mailTemplates),
        attachmentCount: generatedFileGroups.flatMap((group) => group.files).length,
        message: error?.message || 'Gmail 테스트 발송 중 오류가 발생했습니다.',
        createdAt: new Date().toISOString(),
      };
      setSendRecords((current) => [record, ...current]);
      setSendResultModal(record);
      setMailDraftStatus(record.message);
      addNotification({
        title: 'Gmail 테스트 메일 발송 실패',
        message: error?.message || 'Gmail SMTP 발송 중 오류가 발생했습니다.',
        level: 'ERROR',
        target: 'closing-send-queue',
        href: '/closing-workspace/send-queue',
      });
    } finally {
      setIsSendingTestMail(false);
    }
  };

  const handleComplete = async () => {
    if (emailTargets.length === 0 || isCompleting) return;
    if (!window.api?.sendClosingEmails || !window.api?.recordClosingSendHistory) {
      setStatusText('메일 발송 기능이 갱신되었습니다. Electron 앱을 완전히 종료한 뒤 다시 실행해 주세요.');
      addNotification({
        title: '앱 재시작 필요',
        message: '새 메일 발송 기능을 사용하려면 Electron 앱을 완전히 종료한 뒤 다시 실행해 주세요.',
        level: 'WARNING',
        target: 'closing-send-queue',
        href: '/closing-workspace/send-queue',
      });
      return;
    }
    if (!isActualSendReady) {
      setPreflightChecked(true);
      setStatusText('Gmail 주소, 앱 비밀번호, 거래처 이메일, 첨부 생성 상태를 확인하세요.');
      return;
    }

    const confirmed = window.confirm(
      `${emailTargets.length}개 거래처에 실제 메일을 발송합니다.\n발송 후에는 취소할 수 없습니다. 계속할까요?`,
    );
    if (!confirmed) return;

    setIsCompleting(true);
    setMailSendProgress({
      status: 'sending',
      message: `${emailTargets.length}개 거래처에 메일을 발송하고 있습니다. 창을 닫지 마세요.`,
      successCount: 0,
      failureCount: 0,
    });
    setStatusText(`${emailTargets.length}개 거래처에 실제 메일을 발송하는 중입니다.`);

    try {
      const packageId = Date.now();
      const createdAt = new Date().toISOString();
      const fileGroupByTarget = new Map(generatedFileGroups.map((group) => [group.targetId, group]));
      const businessCardFile = createBusinessCardFile(currentUser);
      const businessCardImageFile = await createBusinessCardImageFile(currentUser);
      const messages = [];

      for (const target of emailTargets) {
        const fileGroup = fileGroupByTarget.get(target.id);
        const files = [...(fileGroup?.files ?? []), businessCardFile, businessCardImageFile];
        const attachments = [];
        for (const file of files) {
          attachments.push({
            fileName: file.fileName,
            mimeType: file.mimeType,
            base64: await blobToBase64(file.blob),
            cid: file.cid,
            contentDisposition: file.contentDisposition,
          });
        }
        messages.push({
          targetId: target.id,
          to: target.email,
          subject: getMailSubject(target, mailTemplates),
          text: `${getTargetMailBody(target, mailTemplates)}\n${makeSignatureText(currentUser)}`,
          html: createMailHtml(target, mailTemplates, currentUser),
          attachments,
        });
      }

      const sendResult = await window.api.sendClosingEmails({
        senderName: getDefaultSenderName(currentUser),
        gmailAddress: mailSettings.gmailAddress,
        appPassword: mailSettings.appPassword,
        replyToEmail: mailSettings.replyToEmail,
        messages,
      });
      const resultByTargetId = new Map((sendResult?.results ?? []).map((result) => [result.targetId, result]));
      const historyRecords = emailTargets.map((target) => {
        const fileGroup = fileGroupByTarget.get(target.id);
        const pdfFile = fileGroup?.files.find((file) => file.fileName.toLowerCase().endsWith('.pdf'));
        const xlsxFile = fileGroup?.files.find((file) => file.fileName.toLowerCase().endsWith('.xlsx'));
        const result = resultByTargetId.get(target.id);
        return {
          customerCode: target.id,
          customerName: target.company,
          recipientEmail: target.email,
          recipientPhone: target.phone,
          channel: target.channel,
          subject: getMailSubject(target, mailTemplates),
          body: getTargetMailBody(target, mailTemplates),
          attachmentPdfPath: pdfFile?.filePath || '',
          attachmentXlsxPath: xlsxFile?.filePath || '',
          status: result?.ok ? 'SENT' : 'FAILED',
          memo: result?.ok
            ? `${getSendType(target)} 메일 발송 성공`
            : result?.message || '메일 발송 실패',
        };
      });

      const historyResult = await window.api.recordClosingSendHistory({
        packageId,
        packageName: `${params.month} 마감 발송`,
        closingMonth: params.month,
        outputFolderPath: generatedFileGroups[0]?.savedFolderPath || '',
        createdBy: currentUser.id,
        records: historyRecords,
      });
      if (!historyResult?.ok) {
        throw new Error(historyResult?.message || '메일은 발송됐지만 SQLite 기록 저장에 실패했습니다.');
      }

      const nextRecords = historyRecords.map((record, index) => ({
        id: `${packageId}-${index}`,
        status: record.status === 'SENT' ? 'SUCCESS' : 'ERROR',
        type: 'CLOSING',
        to: record.recipientEmail,
        subject: record.subject,
        attachmentCount: [record.attachmentPdfPath, record.attachmentXlsxPath].filter(Boolean).length,
        message: record.memo,
        createdAt,
      }));
      setSendRecords((current) => [...nextRecords, ...current]);

      const successCount = nextRecords.filter((record) => record.status === 'SUCCESS').length;
      const failureCount = nextRecords.length - successCount;
      addActivityLog('INFO', '마감 메일 발송', `${successCount}건 성공 / ${failureCount}건 실패`);
      addNotification({
        title: failureCount > 0 ? '메일 발송 일부 실패' : '메일 발송 완료',
        message: `${successCount}건 성공, ${failureCount}건 실패했습니다.`,
        level: failureCount > 0 ? 'WARNING' : 'SUCCESS',
        target: 'closing-send-queue',
        href: '/closing-workspace/send-queue',
      });
      setStatusText(`메일 발송 결과: ${successCount}건 성공, ${failureCount}건 실패. 상세 오류는 발송 기록에서 확인하세요.`);
      setMailSendProgress({
        status: 'completed',
        message: failureCount > 0 ? '일부 메일 발송에 실패했습니다. 발송 기록에서 오류를 확인하세요.' : '선택한 거래처에 메일 발송을 완료했습니다.',
        successCount,
        failureCount,
      });
    } catch (error) {
      const rawMessage = error?.message || '메일 발송에 실패했습니다.';
      const message = rawMessage.includes('No handler registered')
        ? '새 메일 발송 기능을 사용하려면 Electron 앱을 완전히 종료한 뒤 다시 실행해 주세요.'
        : rawMessage;
      const failedAt = new Date().toISOString();
      const failedRecords = emailTargets.map((target, index) => ({
        id: `failed-${Date.now()}-${index}`,
        status: 'ERROR',
        type: 'CLOSING',
        to: target.email || '-',
        subject: getMailSubject(target, mailTemplates),
        attachmentCount: generatedFileGroups.find((group) => group.targetId === target.id)?.files.length ?? 0,
        message,
        createdAt: failedAt,
      }));
      setSendRecords((current) => [...failedRecords, ...current]);
      setStatusText(message);
      setMailSendProgress({
        status: 'completed',
        message,
        successCount: 0,
        failureCount: emailTargets.length,
      });
      addNotification({
        title: '메일 발송 실패',
        message,
        level: 'ERROR',
        target: 'closing-send-queue',
        href: '/closing-workspace/send-queue',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <PageShell title="마감 발송 큐" description="여러 업체를 묶어서 마감장, 금액 확인, 세금계산서 확인 요청을 단계별로 검토하고 발송 처리합니다.">
      <div className="flex h-[calc(100vh-14rem)] flex-col">


      <section className="mb-4 shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_150px_140px_120px_auto] xl:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">시작일</span>
            <input
              className="form-input w-full"
              type="date"
              value={params.startDate}
              onChange={(event) => updateDateRange('startDate', event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">종료일</span>
            <input
              className="form-input w-full"
              type="date"
              value={params.endDate}
              onChange={(event) => updateDateRange('endDate', event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">담당자</span>
            <select className="form-select w-full" value={params.manager} onChange={(event) => updateQueryFilter('manager', event.target.value)}>
              {currentUser.role === 'ADMIN' && <option>전체</option>}
              {managerOptions.map((manager) => <option key={manager}>{manager}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">마감일</span>
            <select className="form-select w-full" value={params.deadline} onChange={(event) => updateQueryFilter('deadline', event.target.value)}>
              <option>전체</option>
              {closingDays.map((day) => <option key={day}>{day}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary whitespace-nowrap" type="button" onClick={handleSearch} disabled={isLoading}>
              {isLoading ? '조회 중...' : '조회'}
            </button>
            <button className="btn btn-secondary whitespace-nowrap" type="button" onClick={() => setIsTemplateModalOpen(true)}>
              메일 문구 수정
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{statusText}</p>
      </section>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="grid gap-2 lg:grid-cols-5">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isDone = index < currentStep;

            return (
              <button
                key={step.title}
                className={`rounded-md border px-3 py-2 text-left transition-colors ${isActive ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-500/10' : isDone ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50'}`}
                type="button"
                onClick={() => setCurrentStep(index)}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${isActive ? 'bg-teal-600 text-white' : isDone ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {isDone ? '✓' : index + 1}
                </span>
                <p className="mt-2 text-sm font-bold text-gray-900 dark:text-gray-100">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{step.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-xs dark:border-gray-700/60 dark:bg-gray-800">
        <div className="shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-700/60">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">{steps[currentStep].title}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{steps[currentStep].description}</p>
            </div>
            {currentStep === 0 && visibleClosingTargets.length > params.pageSize && (
              <div className="flex items-center gap-2">
                <button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={params.page <= 1} onClick={() => setParams((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))}>이전</button>
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{params.page} / {queueTotalPages}</span>
                <button className="btn btn-secondary h-8 px-3 text-xs" type="button" disabled={params.page >= queueTotalPages} onClick={() => setParams((current) => ({ ...current, page: Math.min(current.page + 1, queueTotalPages) }))}>다음</button>
              </div>
            )}
          </div>
        </div>

        {currentStep === 0 && (
          <div className="min-h-[18rem] flex-1 overflow-auto" data-table-tools="false">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 whitespace-nowrap">
                      <input
                        aria-label="조회 결과 전체 선택 또는 해제"
                        className="form-checkbox"
                        type="checkbox"
                        checked={isAllVisibleSelected}
                        disabled={visibleClosingTargets.length === 0}
                        onChange={toggleAllVisibleTargets}
                      />
                      <span>전체 선택</span>
                    </label>
                  </th>
                  <th className="px-4 py-3">업체</th>
                  <th className="px-4 py-3">담당자</th>
                  <th className="px-4 py-3">마감일</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">마지막 연락</th>
                  <th className="px-4 py-3 text-right">금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {paginatedClosingTargets.map((target) => {
                  const sendType = getSendType(target);

                  return (
                    <tr key={target.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <input
                          aria-label={`${target.company} 발송 대상 선택`}
                          className="form-checkbox"
                          type="checkbox"
                          checked={selectedIds.includes(target.id)}
                          onChange={() => toggleTarget(target.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{target.company}</p>
                        <p className="mt-1 text-xs text-gray-500">{target.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{target.manager}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{getTargetDate(target, params.month)}</td>
                      <td className="px-4 py-3">
                        <StatusPill className={getSendTone(sendType)}>{sendType}</StatusPill>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{target.lastContactAt} · {target.contactCount}회</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(target.amount)}</td>
                    </tr>
                  );
                })}
                {visibleClosingTargets.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-gray-500 dark:text-gray-400" colSpan={7}>조회 기간에 해당하는 발송 대상이 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {currentStep === 1 && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(groupedCounts).map(([type, count]) => (
              <div key={type} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700/60 dark:bg-gray-900/30">
                <StatusPill className={getSendTone(type)}>{type}</StatusPill>
                <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">{count}개</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">자동 분류된 발송 유형입니다.</p>
              </div>
            ))}
          </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700/60 dark:bg-gray-900/30 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100">엑셀/PDF 첨부 생성</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  선택 업체별 마감 요청 엑셀과 PDF를 실제 파일로 만들고, 다운로드해서 눈으로 확인합니다.
                </p>
              </div>
              <button className="btn btn-primary" type="button" onClick={handleGenerateAttachments} disabled={isGeneratingFiles || selectedTargets.length === 0}>
                {isGeneratingFiles ? '생성 중...' : '첨부 파일 생성'}
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {selectedTargets.map((target) => {
                const generatedGroup = generatedFileGroups.find((group) => group.targetId === target.id);

                return (
                  <div key={target.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700/60">
                    <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{target.company}</p>
                    <p className="mt-1 text-xs text-gray-500">{getSendType(target)}</p>
                  </div>
                  <StatusPill className={generatedGroup ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}>
                    {generatedGroup ? '첨부 생성 완료' : '생성 대기'}
                  </StatusPill>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {(generatedGroup?.files ?? [
                        { type: 'XLSX', fileName: '엑셀 마감장', size: 0 },
                        { type: 'PDF', fileName: 'PDF 확인본', size: 0 },
                      ]).map((file) => (
                        <div key={`${target.id}-${file.type}`} className="grid gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0 overflow-hidden">
                            <p className="truncate font-semibold text-gray-700 dark:text-gray-200">{file.fileName}</p>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{file.type} · {formatBytes(file.size)}</p>
                          </div>
                          {file.blob ? (
                            <div className="flex flex-wrap gap-1 sm:justify-end">
                              <button className="btn btn-secondary h-8 px-3 text-xs" type="button" onClick={() => setAttachmentPreview({ company: target.company, file })}>
                                미리보기
                              </button>
                              {file.filePath && (
                                <button className="btn btn-secondary h-8 px-3 text-xs" type="button" onClick={() => handleOpenFileLocation(file)}>
                                  위치 열기
                                </button>
                              )}
                              <button className="btn btn-secondary h-8 px-3 text-xs" type="button" onClick={() => handleDownloadFile(file)}>
                                저장
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-gray-400">대기</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 rounded-lg border border-teal-100 bg-teal-50 p-3 dark:border-teal-500/20 dark:bg-teal-500/10">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h3 className="font-bold text-teal-900 dark:text-teal-100">내 메일 테스트 발송 준비</h3>
                  <p className="mt-1 text-sm text-teal-700 dark:text-teal-300">
                    테스트 수신자: {mailSettings.testEmail || '미입력'} · 메일 대상 {emailTargets.length}개 · 첨부 {generatedFileGroups.flatMap((group) => group.files).length + 1}개
                  </p>
                  <p className="mt-1 text-xs text-teal-700/80 dark:text-teal-300/80">
                    예시 제목: {getMailSubject(emailTargets[0], mailTemplates)} · 명함(vCard) 자동 첨부
                  </p>
                  <p className="mt-1 text-xs text-teal-700/80 dark:text-teal-300/80">
                    {mailDraftStatus}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {selectedTargets.map((target) => (
                <button
                  key={target.id}
                  className="w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-gray-700/60 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/10"
                  type="button"
                  onClick={() => setEditingTargetId(target.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{target.company}</p>
                      <p className="truncate text-xs text-gray-500">{target.channel === 'EMAIL' ? '메일 발송' : '카톡 문구 복사'} · {target.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill className={getSendTone(getSendType(target))}>{getSendType(target)}</StatusPill>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-300">수정</span>
                    </div>
                  </div>
                  <p className="mt-3 truncate text-xs font-semibold text-gray-400 dark:text-gray-500">{getMailSubject(target, mailTemplates)}</p>
                  <p className="mt-2 whitespace-pre-line rounded-md bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-600 dark:bg-gray-900/30 dark:text-gray-300">{getTargetMailBody(target, mailTemplates)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <h3 className="font-bold text-emerald-800 dark:text-emerald-200">메일 발송 전 최종 확인</h3>
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                이메일 채널 {emailTargets.length}개 업체에 실제 Gmail을 발송하고 결과를 업체별로 저장합니다.
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700/60">
                <p className="text-xs font-semibold text-gray-400">선택 업체</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{selectedTargets.length}개</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700/60">
                <p className="text-xs font-semibold text-gray-400">실제 메일 대상</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{emailTargets.length}개</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700/60">
                <p className="text-xs font-semibold text-gray-400">기록 방식</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">업체별 저장</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700/60">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2 dark:border-gray-700/60">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">메일 발송 기록</h3>
                <span className="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">{sendRecords.length}건</span>
              </div>
              <div className="overflow-auto" data-table-tools="false">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">결과</th>
                      <th className="px-3 py-2">수신자</th>
                      <th className="px-3 py-2">제목</th>
                      <th className="px-3 py-2">첨부</th>
                      <th className="px-3 py-2">시각</th>
                      <th className="px-3 py-2">처리 결과</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {sendRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="px-3 py-2">
                          <StatusPill className={record.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}>
                            {record.status === 'SUCCESS' ? '성공' : '실패'}
                          </StatusPill>
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{record.to}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{record.subject}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{record.attachmentCount}개</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{new Date(record.createdAt).toLocaleString('ko-KR', { hour12: false })}</td>
                        <td className={record.status === 'SUCCESS' ? 'px-3 py-2 text-gray-500 dark:text-gray-400' : 'px-3 py-2 font-semibold text-rose-600 dark:text-rose-300'}>{record.message}</td>
                      </tr>
                    ))}
                    {sendRecords.length === 0 && (
                      <tr>
                        <td className="px-3 py-5 text-center text-gray-500 dark:text-gray-400" colSpan={6}>아직 실제 발송 기록이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={`mt-4 rounded-lg border p-3 ${isPreflightReady ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-amber-100 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'}`}>
              <p className={`text-sm font-bold ${isPreflightReady ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>
                Gmail 전송 전 점검: {isPreflightReady ? '완료' : '보완 필요'}
              </p>
              <p className={`mt-1 text-sm ${isPreflightReady ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                발송 버튼을 누르면 선택된 이메일 채널 거래처에 실제 메일이 전송됩니다. 발송 전 수신자와 첨부를 확인하세요.
              </p>
            </div>
          </div>
        )}

        <div className="shrink-0 flex flex-col gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700/60 sm:flex-row sm:items-center sm:justify-between">
          <button className="btn btn-secondary" type="button" onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))} disabled={currentStep === 0}>
            이전 단계
          </button>
          <div className="flex gap-2">
            {currentStep === steps.length - 1 ? (
              <button className="btn btn-primary" type="button" onClick={handleComplete} disabled={selectedTargets.length === 0 || isCompleting}>
                {isCompleting ? '메일 발송 중...' : '메일 발송하기'}
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={handleNext} disabled={selectedTargets.length === 0}>다음 단계</button>
            )}
          </div>
        </div>
      </section>
      </div>
      <SendResultModal result={sendResultModal} onClose={() => setSendResultModal(null)} />
      <MailSendProgressModal state={mailSendProgress} onClose={() => setMailSendProgress(null)} />
      <AttachmentPreviewModal preview={attachmentPreview} onClose={() => setAttachmentPreview(null)} onDownload={handleDownloadFile} />
      {isTemplateModalOpen && (
        <MailTemplateModal
          templates={mailTemplates}
          onChange={handleMailTemplatesChange}
          onClose={() => setIsTemplateModalOpen(false)}
        />
      )}
      {editingTarget && (
        <TargetMailNoteModal
          target={editingTarget}
          templates={mailTemplates}
          onChange={handleMailTemplatesChange}
          onClose={() => setEditingTargetId(null)}
        />
      )}
    </PageShell>
  );
}
