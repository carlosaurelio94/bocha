package com.viverourbano.backoffice.application.dto;

import com.viverourbano.backoffice.domain.model.ClientStatus;
import com.viverourbano.backoffice.support.TestData;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/** Valida las reglas de Bean Validation de los DTOs de entrada. */
class RequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory   = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static <T> Set<String> invalidFields(T dto) {
        return validator.validate(dto).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(Collectors.toSet());
    }

    @Nested
    class CreateClient {
        @Test
        void validWithOnlyRequiredFields() {
            assertThat(invalidFields(new CreateClientRequest("Ana", null, null, null, ClientStatus.PROSPECT))).isEmpty();
        }

        @Test
        void rejectsBlankNameAndMissingStatus() {
            Set<ConstraintViolation<CreateClientRequest>> violations =
                    validator.validate(new CreateClientRequest("   ", null, null, null, null));

            assertThat(violations).extracting(v -> v.getPropertyPath().toString())
                    .containsExactlyInAnyOrder("name", "clientStatus");
            assertThat(violations).extracting(ConstraintViolation::getMessage)
                    .contains("El nombre es obligatorio", "El estado del cliente es obligatorio");
        }
    }

    @Nested
    class UpdateClient {
        @Test
        void allFieldsOptional() {
            assertThat(invalidFields(new UpdateClientRequest(null, null, null, null, null))).isEmpty();
        }

        @Test
        void enforcesMaxLengths() {
            assertThat(invalidFields(new UpdateClientRequest("x".repeat(121), "x".repeat(201), "x".repeat(21), "x".repeat(21), null)))
                    .containsExactlyInAnyOrder("name", "address", "rif", "phone");
        }
    }

    @Nested
    class CreateQuote {
        @Test
        void validRequest() {
            assertThat(invalidFields(TestData.createQuoteRequest(UUID.randomUUID()))).isEmpty();
        }

        @Test
        void requiresAtLeastOneItem() {
            var req = TestData.createQuoteRequest(UUID.randomUUID());
            var empty = new CreateQuoteRequest(req.clientId(), null, req.quoteNumber(), req.quoteDate(),
                    req.currency(), req.status(), req.totalAmount(), 1, List.of());
            assertThat(invalidFields(empty)).contains("items");
        }

        @Test
        void validatesNestedItems() {
            var req = TestData.createQuoteRequest(UUID.randomUUID());
            var badItem = new CreateQuoteItemRequest("", 0, new BigDecimal("-1"), BigDecimal.ZERO);
            var withBadItem = new CreateQuoteRequest(req.clientId(), null, req.quoteNumber(), req.quoteDate(),
                    req.currency(), req.status(), req.totalAmount(), 1, List.of(badItem));

            assertThat(invalidFields(withBadItem))
                    .contains("items[0].product", "items[0].quantity", "items[0].unitPrice");
        }

        @Test
        void rejectsMissingHeaderFields() {
            var bad = new CreateQuoteRequest(null, null, 0, null, "", null, new BigDecimal("-5"), 0,
                    TestData.createQuoteRequest(UUID.randomUUID()).items());
            assertThat(invalidFields(bad)).contains(
                    "clientId", "quoteNumber", "quoteDate", "currency", "status", "totalAmount", "itemCount");
        }

        @Test
        void currencyMaxFiveChars() {
            var req = TestData.createQuoteRequest(UUID.randomUUID());
            var longCurrency = new CreateQuoteRequest(req.clientId(), null, 1, req.quoteDate(), "DOLARES",
                    req.status(), req.totalAmount(), 1, req.items());
            assertThat(invalidFields(longCurrency)).containsExactly("currency");
        }
    }

    @Nested
    class QuoteInformation {
        @Test
        void requiresNameAndText() {
            assertThat(invalidFields(new CreateQuoteInformationRequest("", " "))).containsExactlyInAnyOrder("name", "information");
        }

        @Test
        void enforcesMaxLengths() {
            assertThat(invalidFields(new CreateQuoteInformationRequest("x".repeat(81), "x".repeat(2001))))
                    .containsExactlyInAnyOrder("name", "information");
        }
    }
}
