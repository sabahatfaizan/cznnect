package com.sabahatfaizan.cznnect;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.List;

/** Native bits the web view can't do: the Android share sheet, and switching the launcher icon. */
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
