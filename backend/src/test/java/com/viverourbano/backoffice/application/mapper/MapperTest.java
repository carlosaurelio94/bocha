package com.viverourbano.backoffice.application.mapper;

import com.viverourbano.backoffice.application.dto.ClientDTO;
import com.viverourbano.backoffice.application.dto.QuoteDTO;
import com.viverourbano.backoffice.application.dto.QuoteInformationDTO;
import com.viverourbano.backoffice.domain.model.Client;
import com.viverourbano.backoffice.domain.model.Quote;
import com.viverourbano.backoffice.domain.model.QuoteInformation;
import com.viverourbano.backoffice.domain.model.QuoteStatus;
import com.viverourbano.backoffice.support.TestData;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Verifica las implementaciones generadas por MapStruct. */
class MapperTest {

    private final ClientMapper           clientMapper = new ClientMapperImpl();
    private final QuoteMapper            quoteMapper  = new QuoteMapperImpl();
    private final QuoteInformationMapper infoMapper   = new QuoteInformationMapperImpl();

    @Test
    void mapsClientToDto() {
        Client client = TestData.client(UUID.randomUUID());

        ClientDTO dto = clientMapper.toDto(client);

        assertThat(dto.id()).isEqualTo(client.id());
        assertThat(dto.name()).isEqualTo(client.name());
        assertThat(dto.rif()).isEqualTo(client.rif());
        assertThat(dto.phone()).isEqualTo(client.phone());
        assertThat(dto.address()).isEqualTo(client.address());
        assertThat(dto.clientStatus()).isEqualTo(client.clientStatus());
        assertThat(dto.createdAt()).isEqualTo(client.createdAt());
    }

    @Test
    void nullSafe() {
        assertThat(clientMapper.toDto(null)).isNull();
        assertThat(quoteMapper.toDto(null)).isNull();
        assertThat(infoMapper.toDto(null)).isNull();
    }

    @Test
    void mapsQuoteWithItems() {
        Quote quote = TestData.quote(UUID.randomUUID(), QuoteStatus.SENT, false);

        QuoteDTO dto = quoteMapper.toDto(quote);

        assertThat(dto.id()).isEqualTo(quote.id());
        assertThat(dto.quoteNumber()).isEqualTo(42);
        assertThat(dto.status()).isEqualTo(QuoteStatus.SENT);
        assertThat(dto.totalAmount()).isEqualByComparingTo("75.00");
        assertThat(dto.items()).hasSize(2);
        assertThat(dto.items().get(1).product()).isEqualTo("Palma");
        assertThat(dto.items().get(1).quantity()).isEqualTo(2);
        assertThat(dto.items().get(1).totalPrice()).isEqualByComparingTo("50.00");
    }

    @Test
    void mapsQuoteInformation() {
        QuoteInformation info = TestData.info(UUID.randomUUID(), false);
        QuoteInformationDTO dto = infoMapper.toDto(info);
        assertThat(dto.name()).isEqualTo("Default");
        assertThat(dto.information()).isEqualTo(info.information());
    }
}
