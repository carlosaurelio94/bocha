package com.bocha.backoffice.infrastructure.web.controller;

import com.bocha.backoffice.application.dto.*;
import com.bocha.backoffice.application.usecase.QuoteUseCase;
import com.bocha.backoffice.domain.model.QuoteStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/quotes")
@RequiredArgsConstructor
@Tag(name = "Quotes", description = "Gestión de presupuestos")
public class QuoteController {

    private final QuoteUseCase quoteUseCase;

    @GetMapping
    @Operation(summary = "Listar presupuestos paginados")
    public ResponseEntity<PagedResponse<QuoteDTO>> list(
            @RequestParam(defaultValue = "1")   int page,
            @RequestParam(defaultValue = "20")  int size,
            @RequestParam(required = false)     QuoteStatus status,
            @RequestParam(required = false)     UUID clientId
    ) {
        return ResponseEntity.ok(quoteUseCase.list(page, size, status, clientId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Obtener presupuesto por ID (incluye ítems)")
    public ResponseEntity<QuoteDTO> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(quoteUseCase.getById(id));
    }

    @GetMapping("/next-number")
    @Operation(summary = "Siguiente número de presupuesto disponible")
    public ResponseEntity<Integer> nextNumber() {
        return ResponseEntity.ok(quoteUseCase.nextQuoteNumber());
    }

    @PostMapping
    @Operation(summary = "Crear presupuesto con sus ítems")
    public ResponseEntity<QuoteDTO> create(
            @Valid @RequestBody CreateQuoteRequest request,
            @RequestHeader(value = "X-Device-Id", defaultValue = "unknown") String deviceId
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(quoteUseCase.create(request, deviceId));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Actualizar estado del presupuesto")
    public ResponseEntity<Void> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateQuoteStatusRequest request,
            @RequestHeader(value = "X-Device-Id", defaultValue = "unknown") String deviceId
    ) {
        quoteUseCase.updateStatus(id, request.status(), deviceId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar presupuesto (soft delete, incluye ítems)")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Device-Id", defaultValue = "unknown") String deviceId
    ) {
        quoteUseCase.delete(id, deviceId);
        return ResponseEntity.noContent().build();
    }
}
