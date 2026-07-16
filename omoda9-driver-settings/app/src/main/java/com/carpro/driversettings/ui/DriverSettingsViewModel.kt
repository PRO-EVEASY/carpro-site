package com.carpro.driversettings.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.carpro.driversettings.data.AppState
import com.carpro.driversettings.data.Driver
import com.carpro.driversettings.data.DmsAlarmSettings
import com.carpro.driversettings.data.DriverRepository
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class DriverSettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = DriverRepository(application)

    val appState: StateFlow<AppState> = repository.appState.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = AppState(),
    )

    // Demo-only switch that simulates the vehicle being in motion, mirroring
    // the source app's "can't change driver while driving" guard.
    private val _isDriving = MutableStateFlow(false)
    val isDriving: StateFlow<Boolean> = _isDriving

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    fun setDriving(driving: Boolean) {
        _isDriving.value = driving
    }

    fun consumeMessage() {
        _message.value = null
    }

    fun addDriver(name: String, colorHex: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            val current = appState.value
            val driver = Driver(id = UUID.randomUUID().toString(), name = trimmed, colorHex = colorHex)
            repository.save(
                current.copy(
                    drivers = current.drivers + driver,
                    alarmSettingsByDriverId = current.alarmSettingsByDriverId + (driver.id to DmsAlarmSettings()),
                    activeDriverId = current.activeDriverId ?: driver.id,
                ),
            )
        }
    }

    fun deleteDriver(driverId: String) {
        viewModelScope.launch {
            val current = appState.value
            val remaining = current.drivers.filterNot { it.id == driverId }
            val newActive = if (current.activeDriverId == driverId) remaining.firstOrNull()?.id else current.activeDriverId
            repository.save(
                current.copy(
                    drivers = remaining,
                    alarmSettingsByDriverId = current.alarmSettingsByDriverId - driverId,
                    activeDriverId = newActive,
                ),
            )
        }
    }

    fun selectDriver(driverId: String) {
        if (_isDriving.value) {
            _message.value = "Can't change driver while driving"
            return
        }
        viewModelScope.launch {
            repository.save(appState.value.copy(activeDriverId = driverId))
        }
    }

    fun updateAlarmSettings(driverId: String, settings: DmsAlarmSettings) {
        viewModelScope.launch {
            val current = appState.value
            repository.save(
                current.copy(alarmSettingsByDriverId = current.alarmSettingsByDriverId + (driverId to settings)),
            )
        }
    }

    fun setManuallySelectDriver(enabled: Boolean) {
        viewModelScope.launch {
            repository.save(appState.value.copy(manuallySelectDriver = enabled))
        }
    }
}
