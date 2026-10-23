package com.bocha.backoffice.application.dto;

import com.bocha.backoffice.domain.model.QuoteStatus;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Builder
public record QuoteDTO(
        UUID          id,
        UUID          clientId,
        UUID          informationId,
        int           quoteNumber,
        LocalDate     quoteDate,
        BigDecimal    totalAmount,
        int           itemCount,
        String        currency,
        QuoteStatus   status,
        String        createdBy,
        Instant       createdAt,
        Instant       updatedAt,
        List<QuoteItemDTO> items      // null en listado, poblado en detalle
) {}
