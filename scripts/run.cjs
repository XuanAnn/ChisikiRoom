const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const root = path.resolve(__dirname, '..');
process.chdir(root);
const action = process.argv[2];
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
function checkBackendPort() {
  const port = process.env.SERVER_PORT || '8080';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    fail('SERVER_PORT phai tu 1 den 65535.');
  }
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () =>
      reject(
        new Error(
          `Cong ${port} dang bi chiem hoac khong the su dung. Chi chay mot phien backend. Dung Ctrl+C trong terminal backend cu; hoac doi SERVER_PORT va CHISIKI_API_URL trong .env.`,
        ),
      ),
    );
    probe.listen(
      { port: Number(port), host: process.env.SERVER_ADDRESS || '0.0.0.0', exclusive: true },
      () => probe.close(resolve),
    );
  });
}
function run(command, args, cwd = root) {
  // All commands and arguments below are fixed literals, never values from .env.
  // Invoke cmd explicitly for npm/mvn .cmd shims without Node's shell:true mode.
  const windows = process.platform === 'win32';
  const child = spawn(
    windows ? 'cmd.exe' : command,
    windows ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args,
    { cwd, stdio: 'inherit', env: process.env },
  );
  child.on('error', (err) => fail(`Khong chay duoc ${command}: ${err.message}`));
  child.on('exit', (code) => process.exit(code ?? 1));
}

if (action === 'db' || action === 'backend') {
  if (!process.env.DB_PASSWORD) {
    fail('Thieu DB_PASSWORD. Sao chep .env.example thanh .env va dat mat khau.');
  }
  const port = process.env.DB_PORT || '5433';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    fail('DB_PORT phai la cong tu 1 den 65535.');
  }
  process.env.DB_PORT = port;
  if (action === 'db') {
    run('docker', ['compose', 'up', '-d', '--wait']);
  } else {
    if (
      process.platform === 'win32' &&
      !process.env.JAVA_TOOL_OPTIONS?.includes('-Djdk.net.unixdomain.tmpdir=')
    ) {
      // Windows AF_UNIX connections can fail with the 8.3 alias in TEMP.
      // Use a real project directory for the JDK's internal selector socket.
      const socketDir = path.join(root, '.runtime');
      fs.mkdirSync(socketDir, { recursive: true });
      process.env.JAVA_TOOL_OPTIONS =
        `${process.env.JAVA_TOOL_OPTIONS || ''} -Djdk.net.unixdomain.tmpdir="${socketDir.replaceAll('\\', '/')}"`.trim();
    }
    checkBackendPort()
      .then(() => run('mvn', ['-f', 'backend/pom.xml', 'spring-boot:run']))
      .catch((error) => fail(error.message));
  }
} else if (action === 'desktop') {
  if (
    !fs.existsSync(path.join(root, 'desktop/dist/index.html')) &&
    process.env.CHISIKI_DEV !== '1'
  ) {
    fail('Chua build giao dien. Hay chay npm run build truoc.');
  }
  // The Codex host may use this variable; Electron must launch as a GUI app.
  delete process.env.ELECTRON_RUN_AS_NODE;
  run('npm', ['run', 'desktop'], path.join(root, 'desktop'));
} else {
  fail('Lenh khong hop le. Dung npm run db, npm run backend, hoac npm run desktop.');
}
