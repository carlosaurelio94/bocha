package com.bocha.backoffice.domain.model;

/**
 * Estado del cliente dentro del negocio.
 * - PROSPECT: contacto que aún no concretó una compra/servicio
 * - CLIENT:   ya tuvo al menos un trabajo realizado
 */
public enum ClientStatus {
    PROSPECT,
    CLIENT
}
