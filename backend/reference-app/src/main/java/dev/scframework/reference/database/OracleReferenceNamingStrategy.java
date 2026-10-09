package dev.scframework.reference.database;

import org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy;
import org.hibernate.boot.model.naming.Identifier;
import org.hibernate.engine.jdbc.env.spi.JdbcEnvironment;

/**
 * Oracle 레퍼런스 앱에서만 선택하는 물리 열 이름 규칙이다.
 * 기존 Java 필드와 API의 size/number 이름을 유지하면서 Oracle 예약어인 두 DB 열을 인용한다.
 * 나머지 camelCase→snake_case 규칙은 Spring 기본 구현에 맡기며 H2의 기존 스키마는 바꾸지 않는다.
 * 고객 앱의 기존 열 이름 매핑은 앱 책임이므로 이 클래스는 공통 Starter에 넣지 않는다.
 */
public class OracleReferenceNamingStrategy extends CamelCaseToUnderscoresNamingStrategy {
    @Override
    public Identifier toPhysicalColumnName(Identifier name, JdbcEnvironment environment) {
        Identifier physical = super.toPhysicalColumnName(name, environment);
        if (physical != null && (physical.getText().equalsIgnoreCase("size")
                || physical.getText().equalsIgnoreCase("number"))) {
            return Identifier.toIdentifier(physical.getText().toUpperCase(java.util.Locale.ROOT), true);
        }
        return physical;
    }
}
