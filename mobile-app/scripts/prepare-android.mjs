import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const androidDir = path.join(appRoot, 'android');
const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');

if (!fs.existsSync(androidDir)) {
  console.error('android/ directory not found. Run "npx cap add android" first.');
  process.exit(1);
}

// 1. Copy custom HD-2D RCD launcher icons into all Android mipmap buckets
const iconAny = path.join(repoRoot, 'icons', 'icon-512.png');
const iconMask = path.join(repoRoot, 'icons', 'icon-maskable-512.png');
const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
for (const dir of mipmaps) {
  const targetDir = path.join(resDir, dir);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  for (const existing of fs.readdirSync(targetDir)) {
    if (/^ic_launcher.*\.(png|webp)$/i.test(existing)) {
      fs.unlinkSync(path.join(targetDir, existing));
    }
  }
  if (fs.existsSync(iconAny)) {
    fs.copyFileSync(iconAny, path.join(targetDir, 'ic_launcher.png'));
    fs.copyFileSync(iconAny, path.join(targetDir, 'ic_launcher_round.png'));
  }
  if (fs.existsSync(iconMask)) {
    fs.copyFileSync(iconMask, path.join(targetDir, 'ic_launcher_foreground.png'));
  }
}

// Set dark navy adaptive icon background color
const valuesDir = path.join(resDir, 'values');
if (!fs.existsSync(valuesDir)) fs.mkdirSync(valuesDir, { recursive: true });
const bgXml = path.join(valuesDir, 'ic_launcher_background.xml');
fs.writeFileSync(
  bgXml,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="ic_launcher_background">#070b14</color>\n</resources>\n`
);
// Ensure anydpi adaptive icon points to our dark color + foreground
const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
if (fs.existsSync(anydpiDir)) {
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/ic_launcher_background"/>\n  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml);
}

// 2. Patch styles.xml for dark full-screen mobile game theme (zero white flash + notch cutout support)
const stylesPath = path.join(resDir, 'values', 'styles.xml');
if (fs.existsSync(stylesPath)) {
  let styles = fs.readFileSync(stylesPath, 'utf8');
  if (!styles.includes('android:statusBarColor')) {
    styles = styles.replace(
      /(<style name="AppTheme\.NoActionBar"[^>]*>)/,
      `$1\n        <item name="android:statusBarColor">#070b14</item>\n        <item name="android:navigationBarColor">#070b14</item>\n        <item name="android:windowBackground">#070b14</item>\n        <item name="android:windowFullscreen">true</item>`
    );
  }
  fs.writeFileSync(stylesPath, styles);
}

// 3. Patch AndroidManifest.xml so Android APK defaults and locks to sensorLandscape
const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let mf = fs.readFileSync(manifestPath, 'utf8');
  if (mf.includes('android:screenOrientation=')) {
    mf = mf.replace(/android:screenOrientation="[^"]*"/, 'android:screenOrientation="sensorLandscape"');
  } else {
    mf = mf.replace(
      /(<activity\s[^>]*android:name="\.MainActivity")/,
      `$1\n            android:screenOrientation="sensorLandscape"`
    );
  }
  fs.writeFileSync(manifestPath, mf);
}

// 4. Stamp versionCode & versionName from version.json + GITHUB_RUN_NUMBER
const gradlePath = path.join(androidDir, 'app', 'build.gradle');
const versionJsonPath = path.join(repoRoot, 'version.json');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  const runNum = parseInt(process.env.GITHUB_RUN_NUMBER || '7', 10) || 7;
  let buildId = `1.0.${runNum}`;
  try {
    const vj = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    if (vj.buildId) buildId = vj.buildId;
  } catch (_) {}
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${runNum}`);
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${buildId}"`);
  fs.writeFileSync(gradlePath, gradle);
  console.log(`Configured Android APK versionCode=${runNum}, versionName=${buildId}`);
}

console.log('Android mobile game project prepared successfully.');
