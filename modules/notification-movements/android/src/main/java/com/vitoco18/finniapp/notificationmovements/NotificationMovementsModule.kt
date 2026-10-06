package com.vitoco18.finniapp.notificationmovements

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationMovementsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FinniNotificationMovements")

    AsyncFunction("isAccessEnabledAsync") {
      val context = requireNotNull(appContext.reactContext)
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty()
      val component = ComponentName(context, FinancialNotificationListenerService::class.java)
      enabled.split(":").any { ComponentName.unflattenFromString(it) == component }
    }

    AsyncFunction("openAccessSettingsAsync") {
      val context = requireNotNull(appContext.reactContext)
      context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("getPendingAsync") {
      val context = requireNotNull(appContext.reactContext)
      PendingMovementStore.list(context).map { it.toJson().toMap() }
    }

    AsyncFunction("claimNextPendingAsync") {
      val context = requireNotNull(appContext.reactContext)
      PendingMovementStore.claimNext(context)?.toJson()?.toMap()
    }

    AsyncFunction("removePendingAsync") { id: String ->
      val context = requireNotNull(appContext.reactContext)
      PendingMovementStore.remove(context, id)
    }

    AsyncFunction("getSourcesAsync") {
      val context = requireNotNull(appContext.reactContext)
      NotificationMovementSourceStore.list(context).map { source ->
        mapOf(
          "packageName" to source.packageName,
          "name" to source.name,
          "enabled" to source.enabled,
        )
      }
    }

    AsyncFunction("setSourceEnabledAsync") { packageName: String, enabled: Boolean ->
      val context = requireNotNull(appContext.reactContext)
      NotificationMovementSourceStore.setEnabled(context, packageName, enabled)
    }
  }
}

private fun org.json.JSONObject.toMap(): Map<String, Any?> = keys().asSequence().associateWith { key ->
  if (isNull(key)) null else get(key)
}
