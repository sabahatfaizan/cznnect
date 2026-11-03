package com.sabahatfaizan.cznnect;

import android.app.DownloadManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Environment;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.List;

/** Native bits the web view can't do: the Android share sheet, switching the launcher icon, and downloading the app update. */
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

    /**
     * Downloads the app update with Android's own download manager. The in-app browser view could not finish saving
     * the file, but the download manager always does, shows progress in the notification shade, and opens the
     * installer when the notification is tapped. Only this app's GitHub releases are allowed.
     */
    @PluginMethod
    public void downloadFile(PluginCall call) {
        String url = call.getString("url");
        String name = call.getString("name");
        if (url == null || !url.startsWith("https://github.com/sabahatfaizan/cznnect/")) {
            call.reject("Address not allowed");
            return;
        }
        if (name == null || name.isEmpty()) name = "cznnect.apk";
        try {
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle(name);
            req.setDescription("Tap when finished to install");
            req.setMimeType("application/vnd.android.package-archive");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            dm.enqueue(req);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start the download");
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
