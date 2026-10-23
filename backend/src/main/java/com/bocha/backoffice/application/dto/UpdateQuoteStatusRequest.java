package com.bocha.backoffice.application.dto;

import com.bocha.backoffice.domain.model.QuoteStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateQuoteStatusRequest(@NotNull QuoteStatus status) {}
