const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');

console.log("Checking A2A environment...");
const doctorCmd = os.platform() === 'win32' ? 'okx-a2a.cmd' : 'okx-a2a';
spawnSync(doctorCmd, ['doctor', '--fix'], { stdio: 'inherit', shell: true });

console.log("Reading service description...");
const json = fs.readFileSync('service-update.json', 'utf8');
const minified = JSON.stringify(JSON.parse(json));

console.log("Updating TACIT service description on-chain...");
console.log("(Please check your OKX wallet to sign the transaction!)");

// Use shell: false to bypass cmd.exe and send arguments directly to the Windows API
const onchainosCmd = os.platform() === 'win32' ? 'onchainos.exe' : 'onchainos';
const result = spawnSync(onchainosCmd, ['agent', 'update', '--agent-id', '6077', '--service', minified], {
  encoding: 'utf8',
  stdio: 'inherit',
  shell: false
});

if (result.error) {
  console.error("Error:", result.error);
  process.exit(1);
}
console.log("Update process exited with code", result.status || 0);
process.exit(result.status || 0);
