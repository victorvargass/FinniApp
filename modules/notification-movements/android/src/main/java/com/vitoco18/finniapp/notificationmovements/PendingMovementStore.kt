package com.vitoco18.finniapp.notificationmovements

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import java.text.Normalizer
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlin.math.abs

internal data class PendingMovement(
  val id: String,
  val sourceApp: String,
  val name: String,
  val amount: Long,
  val occurredAt: Long,
  val suggestedType: String,
  val promptedAt: Long? = null,
) {
  fun toJson() = JSONObject().apply {
    put("id", id)
    put("sourceApp", sourceApp)
    put("name", name)
    put("amount", amount)
    put("currency", "CLP")
    put("occurredAt", occurredAt)
    put("suggestedType", suggestedType)
    if (promptedAt == null) put("promptedAt", JSONObject.NULL) else put("promptedAt", promptedAt)
  }

  companion object {
    fun fromJson(json: JSONObject) = PendingMovement(
      id = json.getString("id"),
      sourceApp = json.getString("sourceApp"),
      name = json.getString("name"),
      amount = json.getLong("amount"),
      occurredAt = json.getLong("occurredAt"),
      suggestedType = json.getString("suggestedType"),
      promptedAt = if (json.isNull("promptedAt")) null else json.getLong("promptedAt"),
    )
  }
}

internal object PendingMovementStore {
  private const val PREFERENCES = "finni_pending_notification_movements"
  private const val ITEMS = "items"
  private const val MAX_ITEMS = 100
  private const val KEY_ALIAS = "finni_pending_notification_movements_key"
  private const val DUPLICATE_WINDOW_MS = 2 * 60 * 1000L

  @Synchronized
  fun list(context: Context): MutableList<PendingMovement> {
    val stored = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(ITEMS, null)
    val serialized = stored?.let(::decrypt) ?: "[]"
    return try {
      val array = JSONArray(serialized)
      MutableList(array.length()) { index -> PendingMovement.fromJson(array.getJSONObject(index)) }
    } catch (_: Exception) {
      mutableListOf()
    }
  }

  @Synchronized
  fun add(context: Context, movement: PendingMovement) {
    val items = list(context)
    if (items.any { it.id == movement.id }) return
    if (items.any { existing -> isLikelyDuplicate(existing, movement) }) return
    items.add(0, movement)
    save(context, items.take(MAX_ITEMS))
  }

  internal fun isLikelyDuplicate(first: PendingMovement, second: PendingMovement): Boolean =
    first.amount == second.amount &&
      first.suggestedType == second.suggestedType &&
      comparableName(first.name) == comparableName(second.name) &&
      abs(first.occurredAt - second.occurredAt) <= DUPLICATE_WINDOW_MS

  private fun comparableName(value: String): String = Normalizer
    .normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
    .replace(Regex("\\p{Mn}+"), "")
    .replace(Regex("[^a-z0-9]+"), "")

  @Synchronized
  fun claimNext(context: Context): PendingMovement? {
    val items = list(context)
    val index = items.indexOfFirst { it.promptedAt == null }
    if (index < 0) return null
    val claimed = items[index].copy(promptedAt = System.currentTimeMillis())
    items[index] = claimed
    save(context, items)
    return claimed
  }

  @Synchronized
  fun remove(context: Context, id: String) {
    save(context, list(context).filterNot { it.id == id })
  }

  private fun save(context: Context, items: List<PendingMovement>) {
    val array = JSONArray()
    items.forEach { array.put(it.toJson()) }
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().putString(ITEMS, encrypt(array.toString())).apply()
  }

  private fun getOrCreateKey(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .build())
    }.generateKey()
  }

  private fun encrypt(value: String): String {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
    val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    return Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP)
  }

  private fun decrypt(value: String): String? {
    if (value.startsWith("[")) return value
    return try {
      val payload = Base64.decode(value, Base64.NO_WRAP)
      if (payload.size <= 12) return null
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, payload.copyOfRange(0, 12)))
      cipher.doFinal(payload.copyOfRange(12, payload.size)).toString(Charsets.UTF_8)
    } catch (_: Exception) {
      null
    }
  }
}
