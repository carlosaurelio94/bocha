package com.bocha.backoffice.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateQuoteInformationRequest(
        @NotBlank @Size(max = 80)   String name,
        @NotBlank @Size(max = 2000) String information
) {}
