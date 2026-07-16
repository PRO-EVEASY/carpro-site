package com.carpro.driversettings.data

import kotlinx.serialization.Serializable

@Serializable
data class Driver(
    val id: String,
    val name: String,
    val colorHex: String = "#FFC107",
)
