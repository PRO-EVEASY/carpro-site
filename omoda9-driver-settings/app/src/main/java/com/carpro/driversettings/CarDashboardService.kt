package com.carpro.driversettings

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.carpro.driversettings.popup.AcPopupActivity
import com.carpro.driversettings.popup.DriveModePopupActivity
import com.carpro.driversettings.popup.DriverSelectPopupActivity

/**
 * Foreground service that keeps a persistent, low-priority notification with
 * quick-action buttons for the popup screens — the non-privileged equivalent
 * of an always-on car dashboard quick-launcher.
 */
class CarDashboardService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY
    }

    private fun buildNotification(): Notification {
        createChannelIfNeeded()

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_manage)
            .setContentTitle("Omoda 9 Dashboard")
            .setContentText("Quick access is running")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(0, "Driver", popupPendingIntent(DriverSelectPopupActivity::class.java, requestCode = 1))
            .addAction(0, "A/C", popupPendingIntent(AcPopupActivity::class.java, requestCode = 2))
            .addAction(0, "Drive Mode", popupPendingIntent(DriveModePopupActivity::class.java, requestCode = 3))
            .build()
    }

    private fun <T> popupPendingIntent(activityClass: Class<T>, requestCode: Int): PendingIntent {
        val intent = Intent(this, activityClass).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        return PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(CHANNEL_ID, "Car Dashboard", NotificationManager.IMPORTANCE_LOW)
                manager.createNotificationChannel(channel)
            }
        }
    }

    companion object {
        private const val CHANNEL_ID = "car_dashboard"
        private const val NOTIFICATION_ID = 1001
    }
}
