package com.vitoco18.finniapp.notificationmovements

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.text.Normalizer
import java.util.Locale

class FinancialNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName == packageName || sbn.notification.flags and Notification.FLAG_ONGOING_EVENT != 0) return
    if (sbn.packageName in NotificationMovementParser.EXCLUDED_SOURCE_PACKAGES) return
    val trustedFinancialSource = sbn.packageName in NotificationMovementParser.TRUSTED_FINANCIAL_PACKAGES
    if (!trustedFinancialSource && sbn.notification.category in setOf(
        Notification.CATEGORY_MESSAGE,
        Notification.CATEGORY_SOCIAL,
        Notification.CATEGORY_EMAIL,
      )) return
    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
    val parsed = NotificationMovementParser.parse(sbn.packageName, title, body) ?: return
    val sourceApp = try {
      packageManager.getApplicationLabel(packageManager.getApplicationInfo(sbn.packageName, 0)).toString()
    } catch (_: Exception) {
      sbn.packageName
    }
    val movement = PendingMovement(
      id = "${sbn.packageName}:${sbn.id}:${sbn.postTime}",
      sourceApp = sourceApp,
      name = parsed.name.ifBlank { sourceApp },
      amount = parsed.amount,
      occurredAt = sbn.postTime,
      suggestedType = parsed.suggestedType,
      paymentMethodHint = parsed.paymentMethodHint ?: sourceApp,
      suggestedPaymentMethodType = parsed.suggestedPaymentMethodType,
    )
    PendingMovementStore.add(applicationContext, movement)
    showDetectedNotification(movement)
  }

  private fun showDetectedNotification(movement: PendingMovement) {
    val manager = getSystemService(NotificationManager::class.java)
    val channelId = "finni_detected_movements"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(
        channelId,
        "Movimientos detectados",
        NotificationManager.IMPORTANCE_DEFAULT,
      ))
    }
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val pendingIntent = PendingIntent.getActivity(
      this,
      movement.id.hashCode(),
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, channelId)
    } else {
      @Suppress("DEPRECATION") Notification.Builder(this)
    }
    notification
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Movimiento detectado")
      .setContentText("Abre FinniApp para revisar la sugerencia")
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
    manager.notify(movement.id.hashCode(), notification.build())
  }
}

internal data class ParsedNotificationMovement(
  val name: String,
  val amount: Long,
  val suggestedType: String,
  val paymentMethodHint: String?,
  val suggestedPaymentMethodType: String?,
)

internal object NotificationMovementParser {
  internal const val GOOGLE_WALLET_PACKAGE = "com.google.android.apps.walletnfcrel"
  internal const val COOPEUCH_PACKAGE = "com.coopeuchapp"
  internal const val BANCO_DE_CHILE_PACKAGE = "cl.bancochile.mi_banco"
  internal const val MACH_PACKAGE = "cl.bci.sismo.mach"

  internal val TRUSTED_FINANCIAL_PACKAGES = setOf(
    GOOGLE_WALLET_PACKAGE,
    COOPEUCH_PACKAGE,
    BANCO_DE_CHILE_PACKAGE,
    MACH_PACKAGE,
  )
  internal val EXCLUDED_SOURCE_PACKAGES = setOf(
    "com.google.android.gm",
    "com.microsoft.office.outlook",
    "com.whatsapp",
    "com.facebook.orca",
    "org.telegram.messenger",
    "com.google.android.apps.messaging",
    "com.samsung.android.messaging",
  )

  private const val CLP_NUMBER = "[0-9]{1,3}(?:[.,\\s][0-9]{3})+|[0-9]+"
  private val amountPattern = Regex(
    "(?i)(?<![A-Z])\\$\\s*($CLP_NUMBER)(?![0-9.,])|" +
      "CLP\\s*\\$?\\s*($CLP_NUMBER)(?![0-9.,])|" +
      "($CLP_NUMBER)\\s*CLP(?![A-Z])"
  )
  private val financialWords = listOf(
    "compra", "consumo", "pago", "transferencia", "abono", "deposito", "cargo", "giro", "retiro", "transaccion"
  )
  private val genericTitles = listOf(
    "notificacion", "movimiento", "compra", "pago", "transferencia",
    "google wallet", "billetera de google", "wallet"
  )

  fun parse(sourcePackage: String, title: String, body: String): ParsedNotificationMovement? {
    val combined = "$title $body".trim()
    val normalized = normalize(combined)
    val isGoogleWallet = sourcePackage == GOOGLE_WALLET_PACKAGE
    if (!isGoogleWallet && financialWords.none { normalized.contains(it) }) return null
    val amountMatch = amountPattern.find(combined) ?: return null
    val amount = amountMatch.groupValues.drop(1).firstOrNull { it.isNotEmpty() }
      ?.replace(Regex("[.,\\s]"), "")?.toLongOrNull()?.takeIf { it > 0 } ?: return null
    val type = when {
      listOf("pago de tarjeta", "pagaste tu tarjeta", "abono a tarjeta").any { normalized.contains(it) } -> "card-payment"
      listOf("recibiste", "recibido", "transferencia recibida", "deposito recibido", "abono en tu cuenta").any { normalized.contains(it) } -> "income"
      normalized.contains("transferencia") -> "transfer"
      else -> "expense"
    }
    val merchant = Regex("(?i)(?:\\ben\\s+|\\ba\\s+)([\\p{L}0-9][\\p{L}0-9 .&'_-]{1,40}?)(?=\\s+(?:por|de|el|a las|CLP|\\$)|[.,]|$)")
      .find(combined)?.groupValues?.getOrNull(1)?.let(::sanitizeName)
    val fallbackTitle = usableName(title)
    val walletMerchant = if (isGoogleWallet) extractWalletMerchant(title, body) else null
    val paymentMethodHint = if (isGoogleWallet) extractWalletPaymentMethod(body) else null
    val paymentMethodType = when {
      listOf("tarjeta de credito", "credito", "credit card", "credit").any { normalized.contains(it) } -> "credit"
      listOf("tarjeta de debito", "debito", "debit card", "debit").any { normalized.contains(it) } -> "debit"
      listOf("tarjeta de prepago", "prepago", "prepaid card", "prepaid").any { normalized.contains(it) } -> "prepaid"
      else -> null
    }
    return ParsedNotificationMovement(
      walletMerchant ?: merchant ?: fallbackTitle.orEmpty(),
      amount,
      type,
      paymentMethodHint,
      paymentMethodType,
    )
  }

  private fun extractWalletPaymentMethod(body: String): String? = Regex(
    "(?i)(?:with|con)\\s+(.+?)(?=\\s+(?:[•*xX]{2,}\\s*)?\\d{2,4}(?:\\D|$)|[.,]|$)"
  ).find(body)?.groupValues?.getOrNull(1)?.let(::sanitizePaymentMethod)?.takeIf { it.isNotEmpty() }

  private fun extractWalletMerchant(title: String, body: String): String? {
    usableName(title)?.let { return it }
    return body.lineSequence()
      .flatMap { line -> line.split(Regex("(?i)\\s+(?:with|con)\\s+")).asSequence() }
      .mapNotNull(::usableName)
      .firstOrNull { candidate ->
        val normalized = normalize(candidate)
        !normalized.contains("tarjeta") && !normalized.contains("card") && !normalized.contains("debito")
      }
  }

  private fun usableName(value: String): String? = sanitizeName(value).takeIf { candidate ->
    candidate.isNotEmpty() && genericTitles.none { normalize(candidate) == it }
  }

  private fun sanitizeName(value: String): String = amountPattern.replace(value, "")
    .replace(Regex("\\s+"), " ")
    .trim(' ', '-', ':', '.', ',')
    .take(48)

  private fun sanitizePaymentMethod(value: String): String = value
    .replace(Regex("(?i)\\b(?:terminada|terminado|ending)\\s+(?:en|in)\\b"), "")
    .replace(Regex("\\s+"), " ")
    .trim(' ', '-', ':', '.', ',')
    .take(48)

  private fun normalize(value: String): String = Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
    .replace(Regex("\\p{Mn}+"), "")
}
