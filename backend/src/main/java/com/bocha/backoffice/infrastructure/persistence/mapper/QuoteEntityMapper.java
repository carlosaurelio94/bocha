package com.bocha.backoffice.infrastructure.persistence.mapper;

import com.bocha.backoffice.domain.model.Quote;
import com.bocha.backoffice.domain.model.QuoteItem;
import com.bocha.backoffice.domain.model.QuoteStatus;
import com.bocha.backoffice.infrastructure.persistence.entity.QuoteEntity;
import com.bocha.backoffice.infrastructure.persistence.entity.QuoteEntity.QuoteStatusJpa;
import com.bocha.backoffice.infrastructure.persistence.entity.QuoteItemEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.Collections;
import java.util.List;

@Mapper(componentModel = "spring")
public interface QuoteEntityMapper {

    @Mapping(target = "status", expression = "java(mapStatus(entity.getStatus()))")
    @Mapping(target = "items",  expression = "java(mapItems(entity.getItems()))")
    Quote toDomain(QuoteEntity entity);

    @Mapping(target = "status", expression = "java(mapStatusJpa(domain.status()))")
    @Mapping(target = "items",  ignore = true)  // ítems se persisten por separado
    QuoteEntity toEntity(Quote domain);

    @Mapping(target = "unitPrice",  source = "unitPrice")
    @Mapping(target = "totalPrice", source = "totalPrice")
    QuoteItem itemToDomain(QuoteItemEntity entity);

    default QuoteStatus mapStatus(QuoteStatusJpa jpa) {
        return jpa != null ? QuoteStatus.valueOf(jpa.name()) : null;
    }

    default QuoteStatusJpa mapStatusJpa(QuoteStatus domain) {
        return domain != null ? QuoteStatusJpa.valueOf(domain.name()) : null;
    }

    default List<QuoteItem> mapItems(List<QuoteItemEntity> items) {
        if (items == null) return Collections.emptyList();
        return items.stream().map(this::itemToDomain).toList();
    }
}
