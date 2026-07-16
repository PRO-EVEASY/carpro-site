package com.carpro.driversettings.popup

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.carpro.driversettings.ui.theme.DriverSettingsTheme

class AcPopupActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DriverSettingsTheme {
                PopupOverlay(onDismiss = { finish() }) {
                    var acOn by remember { mutableStateOf(true) }
                    var temperature by remember { mutableIntStateOf(22) }

                    Text("A/C", style = MaterialTheme.typography.titleLarge)
                    Spacer(modifier = Modifier.height(16.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Power", style = MaterialTheme.typography.bodyLarge, modifier = Modifier.width(120.dp))
                        Switch(checked = acOn, onCheckedChange = { acOn = it })
                    }
                    Spacer(modifier = Modifier.height(16.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { if (temperature > 16) temperature-- }, enabled = acOn) {
                            Icon(Icons.Default.Remove, contentDescription = "Decrease temperature")
                        }
                        Text(
                            "$temperature°C",
                            style = MaterialTheme.typography.headlineSmall,
                            modifier = Modifier.width(72.dp),
                            textAlign = TextAlign.Center,
                        )
                        IconButton(onClick = { if (temperature < 28) temperature++ }, enabled = acOn) {
                            Icon(Icons.Default.Add, contentDescription = "Increase temperature")
                        }
                    }
                }
            }
        }
    }
}
