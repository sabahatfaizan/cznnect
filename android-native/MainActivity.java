package com.sabahatfaizan.cznnect;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CznnectNativePlugin.class);
        super.onCreate(savedInstanceState);

        // Capacitor does not handle the Back button by itself, so Android simply closed the app. This sends Back to
        // the web page's history instead: the page keeps one history entry for every open popup, the menu and every
        // screen other than Home, so Back closes the top one. With nothing left to go back to, Back closes the app.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() != null ? getBridge().getWebView() : null;
                if (web != null && web.canGoBack()) {
                    web.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }
}
