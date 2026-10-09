// "npx cap add android" sonrasi calistirilir: native eklentiyi kopyalar, kaydeder, izinleri ayarlar.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const android = path.join(root, 'android');
if (!fs.existsSync(android)) throw new Error('android/ yok. Once: npx cap add android');

const javaDir = path.join(android, 'app', 'src', 'main', 'java', 'com', 'retrohub', 'app');
fs.mkdirSync(javaDir, { recursive: true });
fs.copyFileSync(path.join(root, 'native', 'EmuLauncherPlugin.java'), path.join(javaDir, 'EmuLauncherPlugin.java'));
fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), `package com.retrohub.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EmuLauncherPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

// documentfile bagimliligi (klasor tarama icin)
const gradle = path.join(android, 'app', 'build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
if (!g.includes('androidx.documentfile')) {
  g = g.replace(/dependencies\s*\{/, 'dependencies {\n    implementation "androidx.documentfile:documentfile:1.0.1"');
  fs.writeFileSync(gradle, g);
}

// Emulator paketlerini gorebilmek icin <queries>
const manifestPath = path.join(android, 'app', 'src', 'main', 'AndroidManifest.xml');
let m = fs.readFileSync(manifestPath, 'utf8');
if (!m.includes('<queries>')) {
  m = m.replace('<application', `<queries>
        <package android:name="org.dolphinemu.dolphinemu" />
        <package android:name="xyz.aethersx2.android" />
    </queries>

    <application`);
  fs.writeFileSync(manifestPath, m);
}
console.log('Android kurulumu tamam.');
