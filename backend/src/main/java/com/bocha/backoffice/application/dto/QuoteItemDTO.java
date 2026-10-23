package com.bocha.backoffice.application.dto;

import lombok.Builder;
import java.math.BigDecimal;
import java.util.UUID;

@Builder
public record QuoteItemDTO(
        UUID       id,
        String     product,
        int        quantity,
        BigDecimal unitPrice,
        BigDecimal totalPrice
) {}
