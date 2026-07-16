package com.carpro.driversettings.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val Context.dataStore by preferencesDataStore(name = "driver_settings")

class DriverRepository(private val context: Context) {

    private val stateKey = stringPreferencesKey("app_state")
    private val json = Json { ignoreUnknownKeys = true }

    val appState: Flow<AppState> = context.dataStore.data.map { prefs ->
        val raw = prefs[stateKey]
        if (raw.isNullOrBlank()) {
            AppState()
        } else {
            runCatching { json.decodeFromString<AppState>(raw) }.getOrDefault(AppState())
        }
    }

    suspend fun save(state: AppState) {
        context.dataStore.edit { prefs ->
            prefs[stateKey] = json.encodeToString(state)
        }
    }
}
