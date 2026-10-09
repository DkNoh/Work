package dev.scframework.autoconfigure;

import dev.scframework.autoconfigure.operations.RuntimeMaintenanceLock;
import dev.scframework.autoconfigure.operations.ScOperationsProperties;
import java.io.IOException;
import java.util.Arrays;
import javax.sql.DataSource;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

/*
 * 운영 프로필의 runtime 파일 잠금을 DataSource/FileStorage 생성보다 먼저 획득하도록 설정한다.
 * BeanFactoryPostProcessor가 dependsOn을 추가해 시작/종료 의존 순서를 보장하고 close에서 잠금을 해제한다.
 */

@AutoConfiguration(before=DataSourceAutoConfiguration.class)
@ConditionalOnProperty(prefix="sc.framework.operations",name="enabled",havingValue="true")
@EnableConfigurationProperties(ScOperationsProperties.class)
public class ScOperationsAutoConfiguration {
    @Bean(destroyMethod="close") RuntimeMaintenanceLock scRuntimeMaintenanceLock(ScOperationsProperties properties)throws IOException{return new RuntimeMaintenanceLock(properties.getRuntimeRoot());}
    // 기존 dependsOn 목록을 보존한 채 잠금 의존성을 추가한다. 의존 bean 종료 뒤 lock이 닫히도록 Spring 생명주기를 활용한다.
    @Bean static BeanFactoryPostProcessor scRuntimeDataSourceDependency(){
        return factory->{java.util.LinkedHashSet<String> dependentBeans=new java.util.LinkedHashSet<>(Arrays.asList(factory.getBeanNamesForType(DataSource.class,false,false)));dependentBeans.addAll(Arrays.asList(factory.getBeanNamesForType(dev.scframework.core.storage.FileStorage.class,false,false)));for(String name:dependentBeans){
            if(!factory.containsBeanDefinition(name))continue;
            org.springframework.beans.factory.config.BeanDefinition definition=factory.getBeanDefinition(name);
            java.util.LinkedHashSet<String> names=new java.util.LinkedHashSet<>();if(definition.getDependsOn()!=null)names.addAll(Arrays.asList(definition.getDependsOn()));names.add("scRuntimeMaintenanceLock");definition.setDependsOn(names.toArray(String[]::new));
        }};
    }
}
