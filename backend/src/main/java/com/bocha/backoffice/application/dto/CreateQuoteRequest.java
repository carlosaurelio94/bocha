package com.bocha.backoffice.application.dto;

import com.bocha.backoffice.domain.model.QuoteStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CreateQuoteRequest(
        @NotNull UUID clientId,
        UUID         informationId,           // opcional
        @Positive int quoteNumber,
        @NotNull LocalDate quoteDate,
        @NotBlank @Size(max = 5) String currency,
        @NotNull QuoteStatus status,
        @NotNull @PositiveOrZero BigDecimal totalAmount,
        @Positive int itemCount,
        @NotEmpty @Valid List<CreateQuoteItemRequest> items
) {}
