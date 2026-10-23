package com.bocha.backoffice.infrastructure.persistence.adapter;

import com.bocha.backoffice.domain.model.Client;
import com.bocha.backoffice.domain.model.ClientStatus;
import com.bocha.backoffice.domain.repository.ClientRepository;
import com.bocha.backoffice.infrastructure.persistence.entity.ClientEntity;
import com.bocha.backoffice.infrastructure.persistence.entity.ClientEntity.ClientStatusJpa;
import com.bocha.backoffice.infrastructure.persistence.jpa.ClientJpaRepository;
import com.bocha.backoffice.infrastructure.persistence.mapper.ClientEntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Adaptador que implementa el puerto ClientRepository usando Spring Data JPA.
 * Traduce entre el modelo de dominio y la entidad JPA.
 */
@Repository
@RequiredArgsConstructor
public class ClientRepositoryAdapter implements ClientRepository {

    private final ClientJpaRepository jpa;
    private final ClientEntityMapper  mapper;

    @Override
    public List<Client> findAll(int page, int size, String search, ClientStatus status) {
        ClientStatusJpa statusJpa = status != null ? ClientStatusJpa.valueOf(status.name()) : null;
        return jpa.findFiltered(search, statusJpa, PageRequest.of(page - 1, size))
                  .stream().map(mapper::toDomain).toList();
    }

    @Override
    public long count(String search, ClientStatus status) {
        ClientStatusJpa statusJpa = status != null ? ClientStatusJpa.valueOf(status.name()) : null;
        return jpa.findFiltered(search, statusJpa, PageRequest.of(0, Integer.MAX_VALUE)).getTotalElements();
    }

    @Override
    public Optional<Client> findById(UUID id) {
        return jpa.findByIdAndDeletedFalse(id).map(mapper::toDomain);
    }

    @Override
    public Client save(Client client) {
        ClientEntity entity = mapper.toEntity(client);
        return mapper.toDomain(jpa.save(entity));
    }

    @Override
    @Transactional
    public void deleteById(UUID id, String updatedBy) {
        jpa.findById(id).ifPresent(entity -> {
            entity.setDeleted(true);
            entity.setUpdatedBy(updatedBy);
            entity.setUpdatedAt(Instant.now());
            jpa.save(entity);
        });
    }
}
