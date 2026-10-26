package com.chisikiroom.calling.infrastructure;

import com.chisikiroom.calling.application.CallService;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "chisiki.worker.enabled",
    havingValue = "true",
    matchIfMissing = true
)
public class CallWorker {

    private final CallService calls;

    public CallWorker(CallService calls) {
        this.calls = calls;
    }

    @Scheduled(fixedDelay = 5000)
    public void sweep() {
        for (var id : calls.activeIds()) {
            try {
                calls.sweep(id);
            } catch (Exception e) {
                LoggerFactory.getLogger(CallWorker.class).warn("Call cleanup failed for {}", id, e);
            }
        }
    }
}
