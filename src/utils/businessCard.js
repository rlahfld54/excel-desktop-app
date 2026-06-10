export function getBusinessCard(user) {
  return {
    name: user.name ?? '',
    title: user.title ?? '',
    department: user.department ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    company: 'Aster Works',
    companyKr: '애스터웍스',
  };
}

export function makeSignatureText(user) {
  const card = getBusinessCard(user);
  return [
    '',
    '--',
    `${card.name}${card.title ? ` · ${card.title}` : ''}`,
    `${card.companyKr}${card.department ? ` ${card.department}` : ''}`,
    card.email ? `E. ${card.email}` : '',
    card.phone ? `T. ${card.phone}` : '',
  ].filter(Boolean).join('\n');
}
