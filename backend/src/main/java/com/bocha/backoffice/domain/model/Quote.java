package com.bocha.backoffice.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Presupuesto (cabecera).
 * Contiene la referencia al cliente, el texto de información usado,
 * y la lista de ítems.
 */
public record Quote(
        UUID id,
        UUID clientId,
        UUID informationId,
        int quoteNumber,
        LocalDate quoteDate,
        BigDecimal totalAmount,
        int itemCount,
        String currency,
        QuoteStatus status,
        String createdBy,
        String updatedBy,
        Instant createdAt,
        Instant updatedAt,
        boolean deleted,
        List<QuoteItem> items  // cargados en consultas de detalle
) {}
