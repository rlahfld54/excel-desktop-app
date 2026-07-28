export const PASSWORD_MIN_LENGTH = 8;

export function getPasswordChecks(password = '') {
  const value = String(password);
  return [
    { key: 'length', label: `${PASSWORD_MIN_LENGTH}자 이상`, passed: value.length >= PASSWORD_MIN_LENGTH },
    { key: 'letter', label: '영문 포함', passed: /[A-Za-z]/.test(value) },
    { key: 'number', label: '숫자 포함', passed: /\d/.test(value) },
  ];
}

export function isPasswordValid(password = '') {
  return getPasswordChecks(password).every((check) => check.passed);
}

export function passwordHelpText(password = '') {
  return isPasswordValid(password)
    ? '사용 가능한 비밀번호입니다.'
    : `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이며 영문과 숫자를 포함해야 합니다.`;
}
