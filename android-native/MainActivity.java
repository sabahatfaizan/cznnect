package com.sabahatfaizan.cznnect;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private OnBackPressedCallback backCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CznnectNativePlugin.class);
        super.onCreate(savedInstanceState);

        // Capacitor does not handle the Back button by itself, so Android simply closed the app. This asks the web page
        // (window.__cznnectBack) whether it had something to close: a popup, the menu, or any screen other than Home.
        // If it did not, Back closes the app as usual.
        backCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() != null ? getBridge().getWebView() : null;
                if (web == null) {
                    leave();
                    return;
                }
                web.evaluateJavascript(
                    "(function(){try{return !!(window.__cznnectBack && window.__cznnectBack());}catch(e){return false;}})()",
                    value -> {
                        if (!"true".equals(value)) leave();
                    });
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backCallback);
    }

    private void leave() {
        backCallback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (backCallback != null) backCallback.setEnabled(true);
    }
}
