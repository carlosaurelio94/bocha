package com.bocha.backoffice.application.dto;

import com.bocha.backoffice.domain.model.ClientStatus;
import jakarta.validation.constraints.Size;

/** Todos los campos son opcionales — se aplica PATCH semántico en el use case. */
public record UpdateClientRequest(
        @Size(max = 120) String name,
        @Size(max = 200) String address,
        @Size(max = 20)  String rif,
        @Size(max = 20)  String phone,
        ClientStatus clientStatus
) {}
