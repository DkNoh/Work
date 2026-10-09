package dev.scframework.autoconfigure.browsererrors;

import dev.scframework.core.ApiException;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

/*
 * 단일 프로세스의 분 단위 전체/인증 사용자별 수집 횟수를 제한한다.
 * synchronized로 카운터 확인과 증가를 한 구간으로 묶고 분이 바뀌면 지난 bucket을 제거한다.
 * 최대 actor 수를 제한하며 429와 다음 분까지의 Retry-After 계산을 제공한다. 분산 제한기는 아니다.
 */

/** 단일 앱 프로세스의 제한이다. IP/사용자 입력을 key나 metric label로 저장하지 않는다. */
public final class BrowserErrorRateLimiter {
    private final Clock clock;
    private final ScBrowserErrorsProperties properties;
    private final Map<String,Bucket> actors=new HashMap<>();
    private long globalMinute=Long.MIN_VALUE;
    private int globalCount;
    public BrowserErrorRateLimiter(Clock clock,ScBrowserErrorsProperties properties){this.clock=clock;this.properties=properties;}
    public synchronized void acquire(String actorSubject){
        long minute=Math.floorDiv(clock.instant().getEpochSecond(),60);
        if(globalMinute!=minute){globalMinute=minute;globalCount=0;actors.entrySet().removeIf(entry->entry.getValue().minute()!=minute);}
        if(globalCount>=properties.getGlobalPerMinute())throw limited();
        var old=actors.get(actorSubject);
        int count=old!=null&&old.minute()==minute?old.count():0;
        if(count>=properties.getActorPerMinute()||(!actors.containsKey(actorSubject)&&actors.size()>=10000))throw limited();
        actors.put(actorSubject,new Bucket(minute,count+1));globalCount++;
    }
    public int retryAfterSeconds(){return (int)(60-Math.floorMod(clock.instant().getEpochSecond(),60));}
    private static ApiException limited(){return new ApiException(429,"RATE_LIMITED","오류 보고 횟수 제한을 넘었습니다. 잠시 후 다시 시도해 주세요.");}
    private record Bucket(long minute,int count){}
}
