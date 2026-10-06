package com.vitoco18.finniapp.notificationmovements

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test

class NotificationMovementParserTest {
  @Test
  fun parsesGoogleWalletWithoutDependingOnFixedTransactionWords() {
    val movement = NotificationMovementParser.parse(
      NotificationMovementParser.GOOGLE_WALLET_PACKAGE,
      "PANADERIA LA VECINA SP",
      "\$1.300 with Banco Chile Débito ••4472",
    )

    assertNotNull(movement)
    assertEquals("PANADERIA LA VECINA SP", movement?.name)
    assertEquals(1_300L, movement?.amount)
    assertEquals("expense", movement?.suggestedType)
  }

  @Test
  fun acceptsCommaAsClpThousandsSeparatorForGoogleWallet() {
    val movement = NotificationMovementParser.parse(
      NotificationMovementParser.GOOGLE_WALLET_PACKAGE,
      "Comercio de prueba",
      "\$7,500 con tarjeta terminada en 4472",
    )

    assertEquals(7_500L, movement?.amount)
  }

  @Test
  fun arbitraryAppsStillNeedFinancialContext() {
    val movement = NotificationMovementParser.parse(
      "com.example.untrusted",
      "PANADERIA LA VECINA SP",
      "\$1.300 with card",
    )

    assertNull(movement)
  }

  @Test
  fun keepsParsingOrdinaryFinancialNotifications() {
    val movement = NotificationMovementParser.parse(
      "cl.example.bank",
      "Compra",
      "Compra en Mercado por CLP 12.990",
    )

    assertNotNull(movement)
    assertEquals(12_990L, movement?.amount)
    assertEquals("Mercado", movement?.name)
  }

  @Test
  fun identifiesEquivalentCrossAppNotificationsAsDuplicates() {
    val walletMovement = pendingMovement(
      id = "wallet:1",
      sourceApp = "Google Wallet",
      name = "PANADERÍA LA VECINA SP",
      occurredAt = 1_000_000L,
    )
    val bankMovement = pendingMovement(
      id = "bank:1",
      sourceApp = "Banco de prueba",
      name = "Panaderia La Vecina Sp",
      occurredAt = 1_090_000L,
    )

    assertEquals(true, PendingMovementStore.isLikelyDuplicate(walletMovement, bankMovement))
  }

  @Test
  fun preservesRepeatedPurchasesOutsideTheDuplicateWindow() {
    val first = pendingMovement(id = "wallet:1", occurredAt = 1_000_000L)
    val second = pendingMovement(id = "wallet:2", occurredAt = 1_121_000L)

    assertEquals(false, PendingMovementStore.isLikelyDuplicate(first, second))
  }

  private fun pendingMovement(
    id: String,
    sourceApp: String = "Google Wallet",
    name: String = "Comercio de prueba",
    occurredAt: Long,
  ) = PendingMovement(
    id = id,
    sourceApp = sourceApp,
    name = name,
    amount = 1_300L,
    occurredAt = occurredAt,
    suggestedType = "expense",
  )
}
