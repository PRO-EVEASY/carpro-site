package com.carpro.driversettings.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.carpro.driversettings.data.AppState

@Composable
fun SettingsScreen(
    appState: AppState,
    isDriving: Boolean,
    onManuallySelectChanged: (Boolean) -> Unit,
    onDrivingSimulationChanged: (Boolean) -> Unit,
    onSimulateIgnition: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        Text("Settings", style = MaterialTheme.typography.titleLarge)
        Spacer(modifier = Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Manually select driver", style = MaterialTheme.typography.bodyLarge)
                Text(
                    "When enabled, you'll see a driver-select popup on ignition and " +
                        "the active driver's settings won't be auto-applied.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Switch(checked = appState.manuallySelectDriver, onCheckedChange = onManuallySelectChanged)
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Simulate driving (demo)",
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f),
            )
            Switch(checked = isDriving, onCheckedChange = onDrivingSimulationChanged)
        }
        Text(
            "While this is on, switching the active driver is blocked — same as the real app while the car is moving.",
            style = MaterialTheme.typography.bodySmall,
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(onClick = onSimulateIgnition, enabled = appState.manuallySelectDriver) {
            Text("Simulate Car Ignition")
        }
        if (!appState.manuallySelectDriver) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Enable \"Manually select driver\" above to test the ignition popup.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
