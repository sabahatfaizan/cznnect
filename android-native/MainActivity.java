package com.sabahatfaizan.cznnect;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CznnectNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
