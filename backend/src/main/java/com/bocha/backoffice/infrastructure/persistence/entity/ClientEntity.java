package com.bocha.backoffice.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Entidad JPA para la tabla `clients`.
 * El mapeo a/desde el dominio lo hace ClientEntityMapper (MapStruct).
 */
@Entity
@Table(name = "clients")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClientEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 200)
    private String address;

    @Column(length = 20)
    private String rif;

    @Column(length = 20)
    private String phone;

    /** Enum mapeado como String para evitar dependencia de orden de columna en DB. */
    @Enumerated(EnumType.STRING)
    @Column(name = "client_status", nullable = false, length = 20)
    private ClientStatusJpa clientStatus;

    @Column(name = "created_by", nullable = false, length = 80)
    private String createdBy;

    @Column(name = "updated_by", length = 80)
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(nullable = false)
    private boolean deleted = false;

    /** Enum interno para evitar romper el ClientStatus de dominio. */
    public enum ClientStatusJpa { prospect, client }
}
