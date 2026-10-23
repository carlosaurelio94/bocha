package com.bocha.backoffice.application.dto;

import com.bocha.backoffice.domain.model.ClientStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * DTO de entrada para crear un cliente.
 * Las anotaciones de @NotBlank y @NotNull activan la validación automática de Spring.
 */
public record CreateClientRequest(

        @NotBlank(message = "El nombre es obligatorio")
        String name,

        String address,  // opcional

        String rif,      // opcional

        String phone,    // opcional

        @NotNull(message = "El estado del cliente es obligatorio")
        ClientStatus clientStatus
) {}
