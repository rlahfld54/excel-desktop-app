const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const projectDir = context.packager.projectDir;
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(projectDir, 'public', 'icon.ico');
  const rceditPath = path.join(projectDir, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe');

  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath) || !fs.existsSync(rceditPath)) {
    return;
  }

  execFileSync(rceditPath, [exePath, '--set-icon', iconPath], {
    stdio: 'inherit',
  });
  console.log(`Applied Windows app icon: ${iconPath}`);
};
