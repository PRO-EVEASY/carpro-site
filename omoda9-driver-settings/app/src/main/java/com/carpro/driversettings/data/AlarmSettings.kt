package com.carpro.driversettings.data

import kotlinx.serialization.Serializable

@Serializable
enum class AlarmSensitivity { LOW, MEDIUM, HIGH }

@Serializable
data class DmsAlarmSettings(
    val forwardCollisionWarning: Boolean = true,
    val fatigueAlert: Boolean = true,
    val fatigueSensitivity: AlarmSensitivity = AlarmSensitivity.MEDIUM,
    val distractionAlert: Boolean = true,
    val laneDepartureWarning: Boolean = false,
    val smokingDetection: Boolean = false,
    val seatbeltReminder: Boolean = true,
)
