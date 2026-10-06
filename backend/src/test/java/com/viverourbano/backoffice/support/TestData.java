package com.viverourbano.backoffice.support;

import com.viverourbano.backoffice.application.dto.CreateQuoteItemRequest;
import com.viverourbano.backoffice.application.dto.CreateQuoteRequest;
import com.viverourbano.backoffice.domain.model.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Object Mother con datos de prueba reutilizables. */
public final class TestData {

    public static final Instant   CREATED_AT = Instant.parse("2026-01-10T12:00:00Z");
    public static final LocalDate QUOTE_DATE = LocalDate.of(2026, 10, 6);

    private TestData() {}

    public static Client client(UUID id) {
        return new Client(id, "Ana Torres", "Caracas", "J-12345678-9", "+58 412 000 0000",
                ClientStatus.CLIENT, "device-a", null, CREATED_AT, null, false);
    }

    public static Client deletedClient(UUID id) {
        return client(id).delete("device-a");
    }

    public static QuoteItem quoteItem(UUID quoteId, String product, int qty, String unitPrice) {
        BigDecimal price = new BigDecimal(unitPrice);
        return new QuoteItem(UUID.randomUUID(), quoteId, UUID.randomUUID(), null, qty, product,
                price, price.multiply(BigDecimal.valueOf(qty)), "device-a", null, CREATED_AT, null, false);
    }

    public static Quote quote(UUID id, QuoteStatus status, boolean deleted) {
        return new Quote(id, UUID.randomUUID(), null, 42, QUOTE_DATE, new BigDecimal("75.00"), 2, "$",
                status, "device-a", null, CREATED_AT, null, deleted,
                List.of(quoteItem(id, "Ficus", 1, "25.00"), quoteItem(id, "Palma", 2, "25.00")));
    }

    public static QuoteInformation info(UUID id, boolean deleted) {
        return new QuoteInformation(id, "Default", "Precios sujetos a cambio.", "device-a", null,
                CREATED_AT, null, deleted);
    }

    public static CreateQuoteRequest createQuoteRequest(UUID clientId) {
        return new CreateQuoteRequest(
                clientId, null, 42, QUOTE_DATE, "$", QuoteStatus.DRAFT,
                new BigDecimal("75.00"), 2,
                List.of(
                        new CreateQuoteItemRequest("Ficus", 1, new BigDecimal("25.00"), new BigDecimal("25.00")),
                        new CreateQuoteItemRequest("Palma", 2, new BigDecimal("25.00"), new BigDecimal("50.00"))
                ));
    }
}
