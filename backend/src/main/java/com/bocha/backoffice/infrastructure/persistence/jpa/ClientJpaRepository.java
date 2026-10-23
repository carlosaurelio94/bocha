package com.bocha.backoffice.infrastructure.persistence.jpa;

import com.bocha.backoffice.infrastructure.persistence.entity.ClientEntity;
import com.bocha.backoffice.infrastructure.persistence.entity.ClientEntity.ClientStatusJpa;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ClientJpaRepository extends JpaRepository<ClientEntity, UUID> {

    /** Búsqueda con filtros opcionales — JPQL usa nombres de campo Java, no columnas DB. */
    @Query("""
        SELECT c FROM ClientEntity c
        WHERE c.deleted = false
          AND (:search IS NULL OR LOWER(c.name)  LIKE LOWER(CONCAT('%', :search, '%'))
                               OR LOWER(c.rif)   LIKE LOWER(CONCAT('%', :search, '%'))
                               OR LOWER(c.phone) LIKE LOWER(CONCAT('%', :search, '%')))
          AND (:status IS NULL OR c.clientStatus = :status)
        ORDER BY c.createdAt DESC
        """)
    Page<ClientEntity> findFiltered(
            @Param("search") String search,
            @Param("status") ClientStatusJpa status,
            Pageable pageable
    );

    Optional<ClientEntity> findByIdAndDeletedFalse(UUID id);
}
