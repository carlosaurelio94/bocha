package com.bocha.backoffice.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "quote_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class QuoteItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "quote_id", nullable = false)
    private UUID quoteId;

    @Column(name = "client_id", nullable = false)
    private UUID clientId;

    @Column(name = "information_id")
    private UUID informationId;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false, length = 200)
    private String product;

    @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;

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
}
