package com.carpro.driversettings.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel

private enum class Tab(val label: String) {
    DRIVERS("Drivers"),
    ALARMS("Alarm Settings"),
    SETTINGS("Settings"),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriverSettingsApp(viewModel: DriverSettingsViewModel = viewModel()) {
    val appState by viewModel.appState.collectAsState()
    val isDriving by viewModel.isDriving.collectAsState()
    val message by viewModel.message.collectAsState()

    var selectedTab by remember { mutableStateOf(Tab.DRIVERS) }
    var showIgnitionPopup by remember { mutableStateOf(false) }
    var hasCheckedIgnition by remember { mutableStateOf(false) }

    // On first load, mirror the source app: if "manually select driver" is on,
    // present the select-driver popup instead of auto-applying the last active driver.
    LaunchedEffect(appState.manuallySelectDriver, appState.drivers.isNotEmpty()) {
        if (!hasCheckedIgnition && appState.drivers.isNotEmpty()) {
            hasCheckedIgnition = true
            if (appState.manuallySelectDriver) showIgnitionPopup = true
        }
    }

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(message) {
        message?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.consumeMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == Tab.DRIVERS,
                    onClick = { selectedTab = Tab.DRIVERS },
                    icon = { Icon(Icons.Default.DirectionsCar, contentDescription = null) },
                    label = { Text(Tab.DRIVERS.label) },
                )
                NavigationBarItem(
                    selected = selectedTab == Tab.ALARMS,
                    onClick = { selectedTab = Tab.ALARMS },
                    icon = { Icon(Icons.Default.Notifications, contentDescription = null) },
                    label = { Text(Tab.ALARMS.label) },
                )
                NavigationBarItem(
                    selected = selectedTab == Tab.SETTINGS,
                    onClick = { selectedTab = Tab.SETTINGS },
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    label = { Text(Tab.SETTINGS.label) },
                )
            }
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                Tab.DRIVERS -> DriversScreen(
                    appState = appState,
                    onAddDriver = viewModel::addDriver,
                    onDeleteDriver = viewModel::deleteDriver,
                    onSelectDriver = viewModel::selectDriver,
                )
                Tab.ALARMS -> AlarmSettingsScreen(
                    appState = appState,
                    onUpdateSettings = viewModel::updateAlarmSettings,
                )
                Tab.SETTINGS -> SettingsScreen(
                    appState = appState,
                    isDriving = isDriving,
                    onManuallySelectChanged = viewModel::setManuallySelectDriver,
                    onDrivingSimulationChanged = viewModel::setDriving,
                    onSimulateIgnition = { if (appState.manuallySelectDriver) showIgnitionPopup = true },
                )
            }
        }
    }

    if (showIgnitionPopup) {
        DriverSelectDialog(
            drivers = appState.drivers,
            onDismiss = { showIgnitionPopup = false },
            onDriverSelected = { driverId ->
                viewModel.selectDriver(driverId)
                showIgnitionPopup = false
            },
        )
    }
}
