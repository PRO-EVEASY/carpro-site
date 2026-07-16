package com.carpro.driversettings.popup

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.carpro.driversettings.ui.theme.DriverSettingsTheme

private enum class DriveMode { NORMAL, ECO, SPORT, SNOW }

class DriveModePopupActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DriverSettingsTheme {
                PopupOverlay(onDismiss = { finish() }) {
                    var mode by remember { mutableStateOf(DriveMode.NORMAL) }
                    var evMode by remember { mutableStateOf(false) }

                    Text("Drive Mode", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(16.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DriveMode.entries.forEach { candidate ->
                            FilterChip(
                                selected = mode == candidate,
                                onClick = { mode = candidate },
                                label = {
                                    Text(candidate.name.lowercase().replaceFirstChar { c -> c.uppercase() })
                                },
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "EV / Hybrid mode",
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.weight(1f),
                        )
                        Switch(checked = evMode, onCheckedChange = { evMode = it })
                    }
                }
            }
        }
    }
}
