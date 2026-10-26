package com.chisikiroom.common.infrastructure;

import java.time.Clock;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
@EnableScheduling
public class ClockConfiguration {

    @Bean
    Clock serverClock() {
        return Clock.systemUTC();
    }

    @Bean(name = "taskScheduler")
    ThreadPoolTaskScheduler workerScheduler() {
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("chisiki-worker-");
        return scheduler;
    }
}
