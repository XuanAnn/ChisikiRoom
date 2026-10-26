package com.chisikiroom;

import static org.junit.jupiter.api.Assertions.*;

import com.chisikiroom.ranking.domain.Glicko2;
import java.util.List;
import org.junit.jupiter.api.Test;

class Glicko2Test {

    @Test
    void matchesGlickmanReferenceExample() {
        var result = Glicko2.update(
            new Glicko2.Rating(1500, 200, 0.06),
            List.of(
                new Glicko2.Opponent(1400, 30, 1),
                new Glicko2.Opponent(1550, 100, 0),
                new Glicko2.Opponent(1700, 300, 0)
            )
        );
        assertEquals(1464.06, result.value(), 0.01);
        assertEquals(151.52, result.deviation(), 0.01);
        assertEquals(0.059996, result.volatility(), 0.000001);
    }

    @Test
    void inactivityIncreasesUncertaintyWithoutChangingRating() {
        var before = new Glicko2.Rating(1600, 80, 0.06);
        var after = Glicko2.inactive(before, 30);
        assertEquals(1600, after.value());
        assertTrue(after.deviation() > 80);
        assertEquals(350, Glicko2.inactive(before, 100000).deviation());
    }
}
