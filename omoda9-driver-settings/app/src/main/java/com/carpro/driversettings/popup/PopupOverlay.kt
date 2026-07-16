package com.carpro.driversettings.popup

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.ColumnScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Tap-outside-to-dismiss backdrop with a centered card, used by the popup
 * activities launched from [com.carpro.driversettings.CarDashboardService]'s
 * notification actions. Plain translucent Activities, not a SYSTEM_ALERT_WINDOW
 * overlay — no special permission required beyond posting the notification.
 */
@Composable
fun PopupOverlay(
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(interactionSource = null, indication = null, onClick = onDismiss),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .padding(32.dp)
                .clickable(interactionSource = null, indication = null, onClick = {}),
        ) {
            Column(modifier = Modifier.padding(24.dp), content = content)
        }
    }
}
