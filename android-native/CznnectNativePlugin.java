package com.sabahatfaizan.cznnect;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.database.Cursor;
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

    /**
     * Downloads the app update with Android's own download manager. The in-app browser view could not finish saving
     * the file, but the download manager always does and shows progress in the notification shade. With install set,
     * the installer opens by itself when the download finishes; otherwise it opens when the notification is tapped. Only this app's GitHub releases and its own website are allowed.
     */
    private BroadcastReceiver installReceiver;
    private long pendingInstallId = -1;

    private static final String PREFS = "cznnect_update";

    private long savedDownloadId() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong("id", -1);
    }

    private void saveDownloadId(long id) {
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong("id", id).apply();
    }

    /** True when the download manager has finished saving the given download. */
    private boolean downloadFinished(DownloadManager dm, long id) {
        Cursor c = null;
        try {
            c = dm.query(new DownloadManager.Query().setFilterById(id));
            if (c != null && c.moveToFirst()) {
                return c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) == DownloadManager.STATUS_SUCCESSFUL;
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        return false;
    }

    /**
     * Opens Android's installer for a finished download, from the app's own screen when there is one (Android
     * blocks installers that start from the background). If this app is not yet allowed to install apps, the
     * settings page for that opens instead and false is returned; the person then taps Install again.
     */
    private boolean launchInstaller(DownloadManager dm, long id) {
        try {
            Context ctx = getContext();
            Context starter = getActivity() != null ? getActivity() : ctx;
            Uri uri = dm.getUriForDownloadedFile(id);
            if (uri == null) return false;
            if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
                Intent allow = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
                allow.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                starter.startActivity(allow);
                return false;
            }
            Intent open = new Intent(Intent.ACTION_VIEW);
            open.setDataAndType(uri, "application/vnd.android.package-archive");
            open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            starter.startActivity(open);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Opens the installer as soon as the given download finishes (the app must still be open). */
    private void watchForInstall(final DownloadManager dm, final long id) {
        final Context ctx = getContext();
        pendingInstallId = id;
        if (installReceiver != null) {
            try { ctx.unregisterReceiver(installReceiver); } catch (Exception ignored) { }
        }
        installReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long done = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (done != pendingInstallId) return;
                try { context.unregisterReceiver(this); } catch (Exception ignored) { }
                installReceiver = null;
                if (downloadFinished(dm, done)) launchInstaller(dm, done);
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            ctx.registerReceiver(installReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            ctx.registerReceiver(installReceiver, filter);
        }
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
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle(name);
            req.setDescription("Tap when finished to install");
            req.setMimeType("application/vnd.android.package-archive");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            // The previous update file goes first, so old copies do not pile up in Downloads.
            long last = savedDownloadId();
            if (last >= 0) {
                try { dm.remove(last); } catch (Exception ignored) { }
            }
            long id = dm.enqueue(req);
            saveDownloadId(id);
            if (Boolean.TRUE.equals(call.getBoolean("install"))) watchForInstall(dm, id);
            // The id lets the web code watch the download (downloadStatus) instead of just hoping it works.
            JSObject out = new JSObject();
            out.put("id", id);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Could not start the download");
        }
    }

    /** How a download is doing: pending, running, paused, success or failed, with bytes and the download manager's reason code. */
    @PluginMethod
    public void downloadStatus(PluginCall call) {
        Long id = call.getLong("id");
        if (id == null) {
            call.reject("No download id");
            return;
        }
        Cursor c = null;
        try {
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            c = dm.query(new DownloadManager.Query().setFilterById(id));
            JSObject out = new JSObject();
            if (c == null || !c.moveToFirst()) {
                out.put("status", "unknown");
            } else {
                int s = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                out.put("status", s == DownloadManager.STATUS_SUCCESSFUL ? "success"
                    : s == DownloadManager.STATUS_FAILED ? "failed"
                    : s == DownloadManager.STATUS_PAUSED ? "paused"
                    : s == DownloadManager.STATUS_PENDING ? "pending" : "running");
                out.put("downloaded", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
                out.put("total", c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
                out.put("reason", c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)));
            }
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Could not read the download");
        } finally {
            if (c != null) c.close();
        }
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
        DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        long id = savedDownloadId();
        if (id < 0 || !downloadFinished(dm, id)) {
            call.reject("The update is still downloading. Try again in a moment.");
            return;
        }
        if (launchInstaller(dm, id)) call.resolve();
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
