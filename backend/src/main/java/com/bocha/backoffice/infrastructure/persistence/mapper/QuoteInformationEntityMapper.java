package com.bocha.backoffice.infrastructure.persistence.mapper;

import com.bocha.backoffice.domain.model.QuoteInformation;
import com.bocha.backoffice.infrastructure.persistence.entity.QuoteInformationEntity;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface QuoteInformationEntityMapper {
    QuoteInformation toDomain(QuoteInformationEntity entity);
    QuoteInformationEntity toEntity(QuoteInformation domain);
}
