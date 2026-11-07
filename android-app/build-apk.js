// Compile l'APK (Gradle) avec le JDK et le SDK Android installés dans C:\Users\tadeo\android-build,
// puis le copie à côté de ce script : Panel-<version>.apk
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOOLS = process.env.PANEL_ANDROID_TOOLS || 'C:\\Users\\tadeo\\android-build';
const env = Object.assign({}, process.env, { JAVA_HOME: path.join(TOOLS, 'jdk'), ANDROID_HOME: path.join(TOOLS, 'sdk') });
const androidDir = path.join(__dirname, 'android');
fs.writeFileSync(path.join(androidDir, 'local.properties'), 'sdk.dir=' + path.join(TOOLS, 'sdk').replace(/\\/g, '/') + '\n');

execFileSync('cmd.exe', ['/c', path.join(androidDir, 'gradlew.bat'), 'assembleDebug', '--no-daemon', '-q'], { cwd: androidDir, env, stdio: 'inherit' });

const meta = JSON.parse(fs.readFileSync(path.join(androidDir, 'app/build/outputs/apk/debug/output-metadata.json'), 'utf8'));
const version = (meta.elements && meta.elements[0] && meta.elements[0].versionName) || '1.0';
const out = path.join(__dirname, `Panel-${version}.apk`);
fs.copyFileSync(path.join(androidDir, 'app/build/outputs/apk/debug/app-debug.apk'), out);
console.log(`✓ APK prêt : ${out} (${Math.round(fs.statSync(out).size / 1024 / 1024 * 10) / 10} Mo)`);
