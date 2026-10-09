package dev.scframework.autoconfigure.browsererrors;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/*
 * 현재 앱 release와 허용 route/component 코드, 본문/빈도/보존 제한을 바인딩한다.
 * validate는 SemVer와 코드 형식 및 수치 범위를 검사한다. route는 URL 원문 대신 앱이 등록한 이름이다.
 * 설정 리스트는 copyOf로 복사해 호출자가 원본 리스트를 바꿔 허용 목록을 우회하지 않게 한다.
 */

@ConfigurationProperties("sc.framework.browser-errors")
public class ScBrowserErrorsProperties {
    private boolean enabled;
    private String appVersion = "0.1.0";
    private List<String> routeCodes = List.of("start","login","examples","requests","requirement-report","request-detail","workspace","patterns","admin-users","admin-menus","admin-audit","account","screens","kanban","notices","notices-new","notice-detail","documents","documents-new","document-detail","operations-messages","operations-schedules","operations-browser-errors");
    private List<String> componentCodes = List.of("ROOT");
    private int maxBodyBytes = 4096;
    private int actorPerMinute = 20;
    private int globalPerMinute = 200;
    private int occurrenceRetentionDays = 30;
    private int receiptRetentionDays = 30;
    private int inactiveGroupRetentionDays = 90;
    private int retentionBatchSize = 500;
    public boolean isEnabled(){return enabled;} public void setEnabled(boolean value){enabled=value;}
    public String getAppVersion(){return appVersion;} public void setAppVersion(String value){appVersion=value;}
    public List<String> getRouteCodes(){return routeCodes;} public void setRouteCodes(List<String> value){routeCodes=List.copyOf(value);}
    public List<String> getComponentCodes(){return componentCodes;} public void setComponentCodes(List<String> value){componentCodes=List.copyOf(value);}
    public int getMaxBodyBytes(){return maxBodyBytes;} public void setMaxBodyBytes(int value){maxBodyBytes=value;}
    public int getActorPerMinute(){return actorPerMinute;} public void setActorPerMinute(int value){actorPerMinute=value;}
    public int getGlobalPerMinute(){return globalPerMinute;} public void setGlobalPerMinute(int value){globalPerMinute=value;}
    public int getOccurrenceRetentionDays(){return occurrenceRetentionDays;} public void setOccurrenceRetentionDays(int value){occurrenceRetentionDays=value;}
    public int getReceiptRetentionDays(){return receiptRetentionDays;} public void setReceiptRetentionDays(int value){receiptRetentionDays=value;}
    public int getInactiveGroupRetentionDays(){return inactiveGroupRetentionDays;} public void setInactiveGroupRetentionDays(int value){inactiveGroupRetentionDays=value;}
    public int getRetentionBatchSize(){return retentionBatchSize;} public void setRetentionBatchSize(int value){retentionBatchSize=value;}
    public void validate(){
        if (appVersion==null || appVersion.length()>64 || !appVersion.matches("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?") || routeCodes.isEmpty() || routeCodes.size()>100 || routeCodes.stream().anyMatch(value->!value.matches("[a-z][a-z0-9-]{0,63}"))
                || !componentCodes.equals(List.of("ROOT")) || maxBodyBytes<512 || maxBodyBytes>4096 || actorPerMinute<1 || actorPerMinute>100
                || globalPerMinute<actorPerMinute || globalPerMinute>10000 || occurrenceRetentionDays<1 || occurrenceRetentionDays>365
                || receiptRetentionDays<1 || receiptRetentionDays>365 || inactiveGroupRetentionDays<1 || inactiveGroupRetentionDays>365
                || retentionBatchSize<1 || retentionBatchSize>1000) throw new IllegalStateException("Invalid browser error configuration");
    }
}
