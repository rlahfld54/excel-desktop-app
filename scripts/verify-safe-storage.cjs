const assert = require("node:assert/strict");
const { app, safeStorage } = require("electron/main");

app.whenReady().then(() => {
  assert.equal(safeStorage.isEncryptionAvailable(), true, "Electron secure storage is unavailable on this PC");
  const encrypted = safeStorage.encryptString("credential-probe");
  assert.notEqual(encrypted.toString("utf8"), "credential-probe", "Credential was not encrypted");
  assert.equal(safeStorage.decryptString(encrypted), "credential-probe", "Credential decryption failed");
  console.log("Electron safeStorage verification passed.");
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
