package com.vitoco18.finniapp.notificationmovements

import android.content.Context
import org.json.JSONObject

internal data class NotificationMovementSource(
  val packageName: String,
  val name: String,
  val enabled: Boolean,
)

internal object NotificationMovementSourceStore {
  private const val PREFERENCES = "finni_notification_movement_sources"
  private const val SOURCES = "sources"
  private const val DISABLED_PACKAGES = "disabled_packages"

  @Synchronized
  fun remember(context: Context, packageName: String, name: String) {
    if (packageName.isBlank() || name.isBlank()) return
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    val sources = readSources(preferences.getString(SOURCES, null))
    if (sources[packageName] == name) return
    sources[packageName] = name
    preferences.edit().putString(SOURCES, JSONObject(sources as Map<*, *>).toString()).apply()
  }

  fun isEnabled(context: Context, packageName: String): Boolean =
    !context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      .getStringSet(DISABLED_PACKAGES, emptySet()).orEmpty()
      .contains(packageName)

  @Synchronized
  fun setEnabled(context: Context, packageName: String, enabled: Boolean) {
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    val disabled = preferences.getStringSet(DISABLED_PACKAGES, emptySet()).orEmpty().toMutableSet()
    if (enabled) disabled.remove(packageName) else disabled.add(packageName)
    preferences.edit().putStringSet(DISABLED_PACKAGES, disabled).apply()
  }

  @Synchronized
  fun list(context: Context): List<NotificationMovementSource> {
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    val sources = readSources(preferences.getString(SOURCES, null))
    var changed = false
    PendingMovementStore.list(context).forEach { movement ->
      if (!sources.containsKey(movement.sourcePackage)) {
        sources[movement.sourcePackage] = movement.sourceApp
        changed = true
      }
    }
    if (changed) preferences.edit().putString(SOURCES, JSONObject(sources as Map<*, *>).toString()).apply()
    return sources.map { (packageName, name) ->
      NotificationMovementSource(packageName, name, isEnabled(context, packageName))
    }.sortedBy { it.name.lowercase() }
  }

  private fun readSources(value: String?): MutableMap<String, String> {
    if (value.isNullOrBlank()) return mutableMapOf()
    return try {
      val json = JSONObject(value)
      json.keys().asSequence().associateWith { key -> json.getString(key) }.toMutableMap()
    } catch (_: Exception) {
      mutableMapOf()
    }
  }
}
