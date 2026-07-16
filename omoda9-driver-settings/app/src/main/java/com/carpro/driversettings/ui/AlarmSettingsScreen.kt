package com.carpro.driversettings.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.carpro.driversettings.data.AlarmSensitivity
import com.carpro.driversettings.data.AppState
import com.carpro.driversettings.data.DmsAlarmSettings

@Composable
fun AlarmSettingsScreen(
    appState: AppState,
    onUpdateSettings: (driverId: String, settings: DmsAlarmSettings) -> Unit,
) {
    val activeDriver = appState.drivers.firstOrNull { it.id == appState.activeDriverId }

    if (activeDriver == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Select an active driver first.")
        }
        return
    }

    val settings = appState.alarmSettingsByDriverId[activeDriver.id] ?: DmsAlarmSettings()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        Text(
            "Driver Monitoring System Alarm — ${activeDriver.name}",
            style = MaterialTheme.typography.titleLarge,
        )
        Spacer(modifier = Modifier.height(16.dp))

        AlarmToggleRow(
            label = "Forward Collision Warning",
            checked = settings.forwardCollisionWarning,
            onCheckedChange = { onUpdateSettings(activeDriver.id, settings.copy(forwardCollisionWarning = it)) },
        )
        AlarmToggleRow(
            label = "Fatigue Alert",
            checked = settings.fatigueAlert,
            onCheckedChange = { onUpdateSettings(activeDriver.id, settings.copy(fatigueAlert = it)) },
        )
        if (settings.fatigueAlert) {
            SensitivitySelector(
                selected = settings.fatigueSensitivity,
                onSelected = { onUpdateSettings(activeDriver.id, settings.copy(fatigueSensitivity = it)) },
            )
        }
        AlarmToggleRow(
            label = "Distraction Alert",
            checked = settings.distractionAlert,
            onCheckedChange = { onUpdateSettings(activeDriver.id, settings.copy(distractionAlert = it)) },
        )
        AlarmToggleRow(
            label = "Lane Departure Warning",
            checked = settings.laneDepartureWarning,
            onCheckedChange = { onUpdateSettings(activeDriver.id, settings.copy(laneDepartureWarning = it)) },
        )
        AlarmToggleRow(
            label = "Smoking Detection",
            checked = settings.smokingDetection,
            onCheckedChange = { onUpdateSettings(activeDriver.id, settings.copy(smokingDetection = it)) },
        )
        AlarmToggleRow(
            label = "Seatbelt Reminder",
            checked = settings.seatbeltReminder,
            onCheckedChange = { onUpdateSettings(activeDriver.id, settings.copy(seatbeltReminder = it)) },
        )
    }
}

@Composable
private fun AlarmToggleRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
    HorizontalDivider()
}

@Composable
private fun SensitivitySelector(selected: AlarmSensitivity, onSelected: (AlarmSensitivity) -> Unit) {
    Column(modifier = Modifier.padding(start = 8.dp, bottom = 8.dp)) {
        Text("Sensitivity", style = MaterialTheme.typography.labelMedium)
        Row {
            AlarmSensitivity.entries.forEach { level ->
                FilterChip(
                    selected = selected == level,
                    onClick = { onSelected(level) },
                    label = { Text(level.name.lowercase().replaceFirstChar { c -> c.uppercase() }) },
                    modifier = Modifier.padding(end = 8.dp),
                )
            }
        }
    }
}
