package com.carpro.driversettings

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.carpro.driversettings.ui.DriverSettingsApp
import com.carpro.driversettings.ui.theme.DriverSettingsTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DriverSettingsTheme {
                DriverSettingsApp()
            }
        }
    }
}
