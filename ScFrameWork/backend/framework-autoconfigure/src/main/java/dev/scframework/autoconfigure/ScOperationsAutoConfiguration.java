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

@AutoConfiguration(before=DataSourceAutoConfiguration.class)
@ConditionalOnProperty(prefix="sc.framework.operations",name="enabled",havingValue="true")
@EnableConfigurationProperties(ScOperationsProperties.class)
public class ScOperationsAutoConfiguration {
    @Bean(destroyMethod="close") RuntimeMaintenanceLock scRuntimeMaintenanceLock(ScOperationsProperties properties)throws IOException{return new RuntimeMaintenanceLock(properties.getRuntimeRoot());}
    @Bean static BeanFactoryPostProcessor scRuntimeDataSourceDependency(){
        return factory->{java.util.LinkedHashSet<String> dependentBeans=new java.util.LinkedHashSet<>(Arrays.asList(factory.getBeanNamesForType(DataSource.class,false,false)));dependentBeans.addAll(Arrays.asList(factory.getBeanNamesForType(dev.scframework.core.storage.FileStorage.class,false,false)));for(String name:dependentBeans){
            if(!factory.containsBeanDefinition(name))continue;
            org.springframework.beans.factory.config.BeanDefinition definition=factory.getBeanDefinition(name);
            java.util.LinkedHashSet<String> names=new java.util.LinkedHashSet<>();if(definition.getDependsOn()!=null)names.addAll(Arrays.asList(definition.getDependsOn()));names.add("scRuntimeMaintenanceLock");definition.setDependsOn(names.toArray(String[]::new));
        }};
    }
}
