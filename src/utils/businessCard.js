export function getBusinessCard(user, documentSettings = {}) {
  return {
    name: user.name ?? '',
    title: user.title ?? '',
    department: user.department ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    company: documentSettings.companyName || 'Aster Works',
    companyKr: documentSettings.companyName || '애스터웍스',
  };
}

export function makeSignatureText(user, documentSettings = {}) {
  const card = getBusinessCard(user, documentSettings);
  return [
    '',
    '--',
    `${card.name}${card.title ? ` · ${card.title}` : ''}`,
    `${card.companyKr}${card.department ? ` ${card.department}` : ''}`,
    card.email ? `E. ${card.email}` : '',
    card.phone ? `T. ${card.phone}` : '',
  ].filter(Boolean).join('\n');
}
