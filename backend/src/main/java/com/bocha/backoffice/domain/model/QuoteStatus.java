package com.bocha.backoffice.domain.model;

/**
 * Estados del ciclo de vida de un presupuesto.
 */
public enum QuoteStatus {
    DRAFT,    // Borrador — aún no enviado al cliente
    SENT,     // Enviado y esperando respuesta
    APPROVED, // Aprobado por el cliente
    REJECTED  // Rechazado
}
