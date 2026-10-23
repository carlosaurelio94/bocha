package com.bocha.backoffice.application.mapper;

import com.bocha.backoffice.application.dto.ClientDTO;
import com.bocha.backoffice.domain.model.Client;
import org.mapstruct.Mapper;

/**
 * MapStruct genera la implementación de este mapper automáticamente en tiempo de compilación.
 * Convierte entre el modelo de dominio (Client) y el DTO de respuesta (ClientDTO).
 *
 * componentModel = "spring" → lo registra como bean de Spring para inyección.
 */
@Mapper(componentModel = "spring")
public interface ClientMapper {

    /**
     * Convierte un Client de dominio a ClientDTO para la respuesta de la API.
     */
    ClientDTO toDto(Client client);
}
