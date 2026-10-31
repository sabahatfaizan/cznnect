#!/usr/bin/env python3
"""Run by the APK build after `npx cap add android`, from the repo root.

1. Copies the Cznnect launcher icons into the generated Android project.
2. Adds the native plugin (share sheet + launcher-icon switching) and registers it in MainActivity.
3. Gives the app one launcher entry (an <activity-alias>) per app-icon colour, so the icon on the phone's
   home screen can change with the theme. Only the "ocean" entry is on by default.
"""
import json, pathlib, re, shutil

ANDROID = pathlib.Path('android/app/src/main')
PKG_DIR = ANDROID / 'java/com/sabahatfaizan/cznnect'
icons = json.load(open('android-native/icons.json'))

shutil.copytree('android-icons/res', ANDROID / 'res', dirs_exist_ok=True)
PKG_DIR.mkdir(parents=True, exist_ok=True)
for name in ('CznnectNativePlugin.java', 'MainActivity.java'):
    shutil.copy(f'android-native/{name}', PKG_DIR / name)

manifest_path = ANDROID / 'AndroidManifest.xml'
s = manifest_path.read_text(encoding='utf-8')
launcher = re.compile(
    r'\s*<intent-filter>\s*<action android:name="android.intent.action.MAIN"\s*/>\s*'
    r'<category android:name="android.intent.category.LAUNCHER"\s*/>\s*</intent-filter>')
s, n = launcher.subn('', s, count=1)
assert n == 1, 'could not find the launcher intent-filter in AndroidManifest.xml'

aliases = ''.join(f'''
        <activity-alias
            android:name=".Icon{i[0].upper()}{i[1:]}"
            android:targetActivity=".MainActivity"
            android:enabled="{'true' if i == 'ocean' else 'false'}"
            android:exported="true"
            android:icon="@mipmap/ic_cz_{i}"
            android:roundIcon="@mipmap/ic_cz_{i}"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>
''' for i in icons)
assert '</application>' in s
s = s.replace('</application>', aliases + '\n    </application>', 1)
manifest_path.write_text(s, encoding='utf-8')
print(f'{len(icons)} launcher icons added')
