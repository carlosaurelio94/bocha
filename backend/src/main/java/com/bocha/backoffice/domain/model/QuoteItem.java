package com.bocha.backoffice.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Línea de detalle de un presupuesto.
 * total_price = quantity * unit_price (calculado en la capa de aplicación).
 */
public record QuoteItem(
        UUID id,
        UUID quoteId,
        UUID clientId,
        UUID informationId,
        int quantity,
        String product,
        BigDecimal unitPrice,
        BigDecimal totalPrice,
        String createdBy,
        String updatedBy,
        Instant createdAt,
        Instant updatedAt,
        boolean deleted
) {}
