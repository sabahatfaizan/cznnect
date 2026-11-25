#!/usr/bin/env python3
"""Run by the APK build after `npx cap add android`, from the repo root.

1. Copies the Cznnect launcher icons into the generated Android project.
2. Adds the native plugin (share sheet + launcher-icon and launcher-name switching) and registers it in MainActivity.
3. Gives the app one launcher entry (an <activity-alias>) per app icon, so the icon on the phone's home screen
   can change. Only the "light" entry is on by default. The ones that are not in "active" are old icons that
   are no longer offered; they stay (showing the Light icon) so an update never leaves a phone without a launcher icon.
4. Makes Android's own launch splash neutral (plain background, no logo). Its picture is fixed when the app is built and
   cannot follow the app icon a Cznnect+ account picked, so the only logo shown while loading is the in-app one,
   which does follow it (src/components/Splash.tsx).
"""
import json, pathlib, re, shutil

ANDROID = pathlib.Path('android/app/src/main')
PKG_DIR = ANDROID / 'java/com/sabahatfaizan/cznnect'
_icons = json.load(open('android-native/icons.json'))
active = _icons['active']
icons = active + _icons['legacy']

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
            android:enabled="{'true' if i == 'light' else 'false'}"
            android:exported="true"
            android:icon="@mipmap/ic_cz_{i if i in active else 'light'}"
            android:roundIcon="@mipmap/ic_cz_{i if i in active else 'light'}"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>
''' for i in icons)
# A second, switched-off entry per current icon, named "Cznnect+". The app turns it on instead of the plain one for a
# Cznnect+ account, so the name under the icon on the home screen reads "Cznnect+". Taking Cznnect+ away switches back.
plus_aliases = ''.join(f'''
        <activity-alias
            android:name=".Icon{i[0].upper()}{i[1:]}Plus"
            android:targetActivity=".MainActivity"
            android:enabled="false"
            android:exported="true"
            android:icon="@mipmap/ic_cz_{i}"
            android:roundIcon="@mipmap/ic_cz_{i}"
            android:label="Cznnect+">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>
''' for i in active)
# Neutral Android launch splash: a new theme on top of Capacitor's launch theme (its parent keeps the post-splash theme),
# with a blank icon and a plain background (light by default, dark when the phone is in dark mode).
LAUNCH_THEME = '@style/AppTheme.NoActionBarLaunch'
if LAUNCH_THEME in s:
    s = s.replace(LAUNCH_THEME, '@style/CznnectLaunch')
    res = ANDROID / 'res'
    (res / 'values').mkdir(parents=True, exist_ok=True)
    (res / 'values-night').mkdir(parents=True, exist_ok=True)
    (res / 'drawable').mkdir(parents=True, exist_ok=True)
    (res / 'values/cz_splash.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="cz_splash_bg">#f3f5f8</color>
    <style name="CznnectLaunch" parent="AppTheme.NoActionBarLaunch">
        <item name="android:background">@color/cz_splash_bg</item>
        <item name="android:windowBackground">@color/cz_splash_bg</item>
        <item name="windowSplashScreenBackground">@color/cz_splash_bg</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/cz_splash_blank</item>
    </style>
</resources>
''', encoding='utf-8')
    (res / 'values-night/cz_splash.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="cz_splash_bg">#111318</color>
</resources>
''', encoding='utf-8')
    (res / 'drawable/cz_splash_blank.xml').write_text('''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <size android:width="1dp" android:height="1dp" />
    <solid android:color="@android:color/transparent" />
</shape>
''', encoding='utf-8')
else:
    print('WARNING: launch theme not found in AndroidManifest.xml; the Android splash was left as it is')
assert '</application>' in s
s = s.replace('</application>', aliases + plus_aliases + '\n    </application>', 1)
manifest_path.write_text(s, encoding='utf-8')
print(f'{len(icons)} launcher icons and {len(active)} Cznnect+ entries added')
