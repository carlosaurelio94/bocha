package com.bocha.backoffice.domain.repository;

import com.bocha.backoffice.domain.model.Client;
import com.bocha.backoffice.domain.model.ClientStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Puerto (interface) del repositorio de clientes — capa de dominio.
 * La implementación real vive en infrastructure/persistence.
 * Esto permite cambiar la base de datos sin tocar el dominio.
 */
public interface ClientRepository {

    List<Client> findAll(int page, int size, String search, ClientStatus status);

    long count(String search, ClientStatus status);

    Optional<Client> findById(UUID id);

    Client save(Client client);

    void deleteById(UUID id, String updatedBy);
}
