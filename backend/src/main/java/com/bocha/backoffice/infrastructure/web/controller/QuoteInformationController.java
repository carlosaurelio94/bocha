package com.bocha.backoffice.infrastructure.web.controller;

import com.bocha.backoffice.application.dto.CreateQuoteInformationRequest;
import com.bocha.backoffice.application.dto.QuoteInformationDTO;
import com.bocha.backoffice.application.usecase.QuoteInformationUseCase;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/quote-information")
@RequiredArgsConstructor
@Tag(name = "Quote Information", description = "Presets de texto informativo para presupuestos")
public class QuoteInformationController {

    private final QuoteInformationUseCase useCase;

    @GetMapping
    @Operation(summary = "Listar todos los presets activos")
    public ResponseEntity<List<QuoteInformationDTO>> list() {
        return ResponseEntity.ok(useCase.list());
    }

    @PostMapping
    @Operation(summary = "Crear nuevo preset")
    public ResponseEntity<QuoteInformationDTO> create(
            @Valid @RequestBody CreateQuoteInformationRequest request,
            @RequestHeader(value = "X-Device-Id", defaultValue = "unknown") String deviceId
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(useCase.create(request, deviceId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar preset existente")
    public ResponseEntity<QuoteInformationDTO> update(
            @PathVariable UUID id,
            @Valid @RequestBody CreateQuoteInformationRequest request,
            @RequestHeader(value = "X-Device-Id", defaultValue = "unknown") String deviceId
    ) {
        return ResponseEntity.ok(useCase.update(id, request, deviceId));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar preset (soft delete)")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id,
            @RequestHeader(value = "X-Device-Id", defaultValue = "unknown") String deviceId
    ) {
        useCase.delete(id, deviceId);
        return ResponseEntity.noContent().build();
    }
}
