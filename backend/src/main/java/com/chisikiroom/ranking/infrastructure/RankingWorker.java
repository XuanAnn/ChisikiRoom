package com.chisikiroom.ranking.infrastructure;

import com.chisikiroom.ranking.application.RankingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "chisiki.worker.enabled", havingValue = "true", matchIfMissing = true)
public class RankingWorker {

    private static final Logger LOG = LoggerFactory.getLogger(RankingWorker.class);
    private final RankingService ranking;

    public RankingWorker(RankingService ranking) {
        this.ranking = ranking;
    }

    @Scheduled(fixedDelay = 1000)
    public void tick() {
        try {
            ranking.tick();
        } catch (Exception exception) {
            LOG.error("Ranking processing failed", exception);
        }
    }
}
