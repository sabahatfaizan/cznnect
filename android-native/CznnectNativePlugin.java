package com.sabahatfaizan.cznnect;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.List;

/** Native bits the web view can't do: the Android share sheet, switching the launcher icon, downloading the app update, and the phone's push (Firebase) token. */
@CapacitorPlugin(name = "CznnectNative")
public class CznnectNativePlugin extends Plugin {
    // Keep in step with android-native/icons.json (and the aliases apply.py adds to the manifest).
    private static final List<String> ICONS = Arrays.asList(
        "ocean", "sunset", "aurora", "orchid", "forest", "graphite",
        "treasure", "libertalia", "outlaw", "dust", "khonshu", "crescent");

    @PluginMethod
    public void share(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.isEmpty()) {
            call.reject("Nothing to share");
            return;
        }
        String title = call.getString("title");
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);
        getActivity().startActivity(Intent.createChooser(send, title == null || title.isEmpty() ? null : title));
        call.resolve();
    }

    /** Shares a PNG (base64) with text. The picture is saved to Pictures/Cznnect so any app can read it. */
    @PluginMethod
    public void shareImage(PluginCall call) {
        String b64 = call.getString("base64");
        String text = call.getString("text");
        if (b64 == null || b64.isEmpty()) {
            call.reject("No picture");
            return;
        }
        if (Build.VERSION.SDK_INT < 29) {
            call.reject("Sharing a picture needs Android 10 or newer");
            return;
        }
        try {
            byte[] bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            android.content.ContentResolver cr = getContext().getContentResolver();
            android.content.ContentValues v = new android.content.ContentValues();
            v.put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, "cznnect-banner-" + System.currentTimeMillis() + ".png");
            v.put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/png");
            v.put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Cznnect");
            Uri uri = cr.insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (uri == null) {
                call.reject("Could not save the picture");
                return;
            }
            java.io.OutputStream out = cr.openOutputStream(uri);
            if (out == null) {
                call.reject("Could not save the picture");
                return;
            }
            out.write(bytes);
            out.close();
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(send, null));
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not share the picture");
        }
    }

    // ---- The app update download. The app downloads the file itself (Android's download manager could sit "pending"
    // or frozen near the end with no way to see why), so it follows the redirect, shows real progress, gives up on a
    // stalled connection after 20 seconds and tries again, up to three times. ----
    private static long dlId = 0;
    private static String dlStatus = "unknown"; // running, success or failed
    private static long dlDownloaded = 0;
    private static long dlTotal = -1;
    private static int dlReason = 0;
    private static File dlFile = null;

    private File updatesDir() {
        File dir = new File(getContext().getCacheDir(), "updates");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return dir;
    }

    /**
     * Opens Android's installer for the finished file, from the app's own screen when there is one (Android blocks
     * installers that start from the background). If this app is not yet allowed to install apps, the settings page
     * for that opens instead and false is returned; the person then taps Install again.
     */
    private boolean launchInstaller(File apk) {
        try {
            if (apk == null || !apk.exists()) return false;
            Context ctx = getContext();
            Context starter = getActivity() != null ? getActivity() : ctx;
            if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
                Intent allow = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
                allow.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                starter.startActivity(allow);
                return false;
            }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
            Intent open = new Intent(Intent.ACTION_VIEW);
            open.setDataAndType(uri, "application/vnd.android.package-archive");
            open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            starter.startActivity(open);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void runDownload(final long id, final String url, final File target, final boolean install) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                boolean ok = false;
                int reason = 0;
                for (int attempt = 1; attempt <= 3 && !ok; attempt++) {
                    HttpURLConnection conn = null;
                    File part = new File(target.getPath() + ".part");
                    try {
                        synchronized (CznnectNativePlugin.class) {
                            if (dlId != id) return; // a newer download replaced this one
                            dlDownloaded = 0;
                            dlTotal = -1;
                        }
                        conn = (HttpURLConnection) new URL(url).openConnection();
                        conn.setConnectTimeout(15000);
                        conn.setReadTimeout(20000);
                        conn.setInstanceFollowRedirects(true);
                        conn.setRequestProperty("User-Agent", "CznnectApp");
                        int code = conn.getResponseCode();
                        if (code != 200) {
                            reason = code;
                            throw new IOException("HTTP " + code);
                        }
                        long total = conn.getContentLengthLong();
                        synchronized (CznnectNativePlugin.class) { if (dlId == id) dlTotal = total; }
                        InputStream in = conn.getInputStream();
                        FileOutputStream out = new FileOutputStream(part);
                        try {
                            byte[] buf = new byte[32 * 1024];
                            long got = 0;
                            int n;
                            while ((n = in.read(buf)) != -1) {
                                out.write(buf, 0, n);
                                got += n;
                                synchronized (CznnectNativePlugin.class) {
                                    if (dlId != id) return;
                                    dlDownloaded = got;
                                }
                            }
                            if (total > 0 && got != total) throw new IOException("Short file");
                        } finally {
                            try { out.close(); } catch (Exception ignored) { }
                            try { in.close(); } catch (Exception ignored) { }
                        }
                        if (target.exists()) {
                            //noinspection ResultOfMethodCallIgnored
                            target.delete();
                        }
                        if (!part.renameTo(target)) throw new IOException("Could not save the file");
                        ok = true;
                    } catch (Exception e) {
                        if (reason == 0) reason = -1;
                        //noinspection ResultOfMethodCallIgnored
                        part.delete();
                        try { Thread.sleep(1500); } catch (InterruptedException ignored) { }
                    } finally {
                        if (conn != null) conn.disconnect();
                    }
                }
                synchronized (CznnectNativePlugin.class) {
                    if (dlId != id) return;
                    dlStatus = ok ? "success" : "failed";
                    dlReason = ok ? 0 : reason;
                    if (ok) dlFile = target;
                }
                if (ok && install && getActivity() != null) {
                    final File apk = target;
                    getActivity().runOnUiThread(new Runnable() {
                        @Override
                        public void run() { launchInstaller(apk); }
                    });
                }
            }
        }).start();
    }

    @PluginMethod
    public void downloadFile(PluginCall call) {
        String url = call.getString("url");
        String name = call.getString("name");
        if (url == null || !(url.startsWith("https://github.com/sabahatfaizan/cznnect/") || url.startsWith("https://sabahatfaizan.github.io/cznnect/"))) {
            call.reject("Address not allowed");
            return;
        }
        if (name == null || name.isEmpty()) name = "cznnect.apk";
        // A new name each time, so an earlier download of the same file can never get in the way.
        String stem = name.endsWith(".apk") ? name.substring(0, name.length() - 4) : name;
        name = stem + "-" + (System.currentTimeMillis() / 1000) + ".apk";
        try {
            File dir = updatesDir();
            // Earlier update files go first, so old copies do not pile up.
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
            File target = new File(dir, name);
            long id = System.currentTimeMillis();
            synchronized (CznnectNativePlugin.class) {
                dlId = id;
                dlStatus = "running";
                dlDownloaded = 0;
                dlTotal = -1;
                dlReason = 0;
                dlFile = null;
            }
            runDownload(id, url, target, Boolean.TRUE.equals(call.getBoolean("install")));
            // The id lets the web code watch the download (downloadStatus) instead of just hoping it works.
            JSObject out = new JSObject();
            out.put("id", id);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Could not start the download");
        }
    }

    /** How the download is doing: running, success or failed, with bytes so far and the total (-1 when unknown). */
    @PluginMethod
    public void downloadStatus(PluginCall call) {
        Long id = call.getLong("id");
        if (id == null) {
            call.reject("No download id");
            return;
        }
        JSObject out = new JSObject();
        synchronized (CznnectNativePlugin.class) {
            if (id != dlId) {
                out.put("status", "unknown");
            } else {
                out.put("status", dlStatus);
                out.put("downloaded", dlDownloaded);
                out.put("total", dlTotal);
                out.put("reason", dlReason);
            }
        }
        call.resolve(out);
    }

    /** Opens one of this app's own download addresses in the phone's browser, the fallback when the download manager fails. */
    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !(url.startsWith("https://github.com/sabahatfaizan/cznnect/") || url.startsWith("https://sabahatfaizan.github.io/cznnect/"))) {
            call.reject("Address not allowed");
            return;
        }
        try {
            Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(view);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the browser");
        }
    }

    /** Opens the installer for the update that was downloaded last. The Install button in the app calls this. */
    @PluginMethod
    public void installUpdate(PluginCall call) {
        File apk;
        synchronized (CznnectNativePlugin.class) {
            apk = "success".equals(dlStatus) ? dlFile : null;
        }
        if (apk == null) {
            call.reject("The update is still downloading. Try again in a moment.");
            return;
        }
        if (launchInstaller(apk)) call.resolve();
        else call.reject("Allow Cznnect to install apps in the page that opened, then tap Install again.");
    }

    /**
     * Returns this phone's Firebase Cloud Messaging token, which the server needs to send it a push notification.
     * Rejects (rather than crashing) when the build has no google-services.json, so older or unconfigured builds
     * simply have no push.
     */
    @PluginMethod
    public void getPushToken(final PluginCall call) {
        try {
            if (FirebaseApp.getApps(getContext()).isEmpty()) {
                call.reject("Push is not set up in this build");
                return;
            }
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (!task.isSuccessful() || task.getResult() == null) {
                    call.reject("Could not get the push token");
                    return;
                }
                JSObject out = new JSObject();
                out.put("token", task.getResult());
                call.resolve(out);
            });
        } catch (Exception e) {
            call.reject("Could not get the push token");
        }
    }

    @PluginMethod
    public void setIcon(PluginCall call) {
        String id = call.getString("id");
        if (id == null || !ICONS.contains(id)) {
            call.reject("Unknown icon");
            return;
        }
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        String pkg = ctx.getPackageName();
        // Turn the chosen icon's launcher entry on first, then the others off, so one is always available.
        pm.setComponentEnabledSetting(alias(pkg, id), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (String other : ICONS) {
            if (!other.equals(id)) {
                pm.setComponentEnabledSetting(alias(pkg, other), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            }
        }
        call.resolve();
    }

    private static ComponentName alias(String pkg, String id) {
        return new ComponentName(pkg, pkg + ".Icon" + Character.toUpperCase(id.charAt(0)) + id.substring(1));
    }
}
