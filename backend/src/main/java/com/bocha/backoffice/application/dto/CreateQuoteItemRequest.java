package com.bocha.backoffice.application.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record CreateQuoteItemRequest(
        @NotBlank String  product,
        @Positive int     quantity,
        @PositiveOrZero BigDecimal unitPrice,
        @PositiveOrZero BigDecimal totalPrice
) {}
