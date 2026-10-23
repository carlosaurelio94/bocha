package com.bocha.backoffice.infrastructure.persistence.mapper;

import com.bocha.backoffice.domain.model.Client;
import com.bocha.backoffice.domain.model.ClientStatus;
import com.bocha.backoffice.infrastructure.persistence.entity.ClientEntity;
import com.bocha.backoffice.infrastructure.persistence.entity.ClientEntity.ClientStatusJpa;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct: convierte entre ClientEntity (JPA) y Client (dominio).
 * componentModel = "spring" → lo registra como bean de Spring.
 */
@Mapper(componentModel = "spring")
public interface ClientEntityMapper {

    @Mapping(target = "clientStatus", expression = "java(mapStatus(entity.getClientStatus()))")
    Client toDomain(ClientEntity entity);

    @Mapping(target = "clientStatus", expression = "java(mapStatusJpa(domain.clientStatus()))")
    ClientEntity toEntity(Client domain);

    default ClientStatus mapStatus(ClientStatusJpa jpa) {
        return jpa != null ? ClientStatus.valueOf(jpa.name()) : null;
    }

    default ClientStatusJpa mapStatusJpa(ClientStatus domain) {
        return domain != null ? ClientStatusJpa.valueOf(domain.name()) : null;
    }
}
