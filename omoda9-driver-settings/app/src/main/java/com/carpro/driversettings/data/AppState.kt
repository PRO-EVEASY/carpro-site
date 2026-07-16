package com.carpro.driversettings.data

import kotlinx.serialization.Serializable

@Serializable
data class AppState(
    val drivers: List<Driver> = emptyList(),
    val alarmSettingsByDriverId: Map<String, DmsAlarmSettings> = emptyMap(),
    val activeDriverId: String? = null,
    // Mirrors the source DMS app's option: show a driver-select popup on
    // ignition instead of silently auto-applying the last active driver.
    val manuallySelectDriver: Boolean = false,
)
