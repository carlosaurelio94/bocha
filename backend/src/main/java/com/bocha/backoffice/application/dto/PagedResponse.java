package com.bocha.backoffice.application.dto;

import java.util.List;

/**
 * Wrapper genérico de paginación para todas las respuestas de lista.
 *
 * @param <T> Tipo del ítem dentro de la lista
 */
public record PagedResponse<T>(
        List<T> data,
        long total,
        int page,
        int pageSize,
        int totalPages
) {
    public static <T> PagedResponse<T> of(List<T> data, long total, int page, int pageSize) {
        int totalPages = (int) Math.ceil((double) total / pageSize);
        return new PagedResponse<>(data, total, page, pageSize, totalPages);
    }
}
