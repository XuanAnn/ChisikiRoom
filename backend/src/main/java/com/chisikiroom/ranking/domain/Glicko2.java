package com.chisikiroom.ranking.domain;

import java.util.List;

/** Glickman (2022), tau=0.5. One completed match is one rating period. */
public final class Glicko2 {

    private static final double SCALE = 173.7178;
    private static final double TAU = 0.5;

    private Glicko2() {}

    public record Rating(double value, double deviation, double volatility) {}

    public record Opponent(double value, double deviation, double score) {}

    public static Rating update(Rating player, List<Opponent> opponents) {
        double mean = (player.value() - 1500) / SCALE;
        double deviation = player.deviation() / SCALE;
        if (opponents.isEmpty()) {
            double nextDeviation = Math.sqrt(
                deviation * deviation + player.volatility() * player.volatility()
            );
            return new Rating(
                player.value(),
                Math.min(350, SCALE * nextDeviation),
                player.volatility()
            );
        }
        double information = 0;
        double improvement = 0;
        for (Opponent opponent : opponents) {
            double opponentDeviation = opponent.deviation() / SCALE;
            double weight =
                1 /
                Math.sqrt(1 + (3 * opponentDeviation * opponentDeviation) / (Math.PI * Math.PI));
            double expected =
                1 / (1 + Math.exp(-weight * (mean - (opponent.value() - 1500) / SCALE)));
            information += weight * weight * expected * (1 - expected);
            improvement += weight * (opponent.score() - expected);
        }
        double variance = 1 / Math.max(1e-12, information);
        double delta = variance * improvement;
        double alpha = Math.log(player.volatility() * player.volatility());
        double lower = alpha;
        double upper;
        if (delta * delta > deviation * deviation + variance) {
            upper = Math.log(delta * delta - deviation * deviation - variance);
        } else {
            int step = 1;
            while (function(alpha - step * TAU, delta, deviation, variance, alpha) < 0) {
                step++;
                if (step > 1000) {
                    throw new IllegalStateException("Glicko bracket did not converge");
                }
            }
            upper = alpha - step * TAU;
        }
        double lowerValue = function(lower, delta, deviation, variance, alpha);
        double upperValue = function(upper, delta, deviation, variance, alpha);
        int iteration = 0;
        while (Math.abs(upper - lower) > 0.000001) {
            double middle = lower + ((lower - upper) * lowerValue) / (upperValue - lowerValue);
            double middleValue = function(middle, delta, deviation, variance, alpha);
            if (middleValue * upperValue <= 0) {
                lower = upper;
                lowerValue = upperValue;
            } else {
                lowerValue /= 2;
            }
            upper = middle;
            upperValue = middleValue;
            iteration++;
            if (iteration > 1000) {
                throw new IllegalStateException("Glicko update did not converge");
            }
        }
        double volatility = Math.exp(lower / 2);
        double priorDeviation = Math.sqrt(deviation * deviation + volatility * volatility);
        double nextDeviation = 1 / Math.sqrt(1 / (priorDeviation * priorDeviation) + 1 / variance);
        double nextMean = mean + nextDeviation * nextDeviation * improvement;
        return new Rating(
            SCALE * nextMean + 1500,
            Math.min(350, SCALE * nextDeviation),
            volatility
        );
    }

    private static double function(
        double value,
        double delta,
        double deviation,
        double variance,
        double alpha
    ) {
        double exponential = Math.exp(value);
        double total = deviation * deviation + variance + exponential;
        return (
            (exponential * (delta * delta - total)) / (2 * total * total) -
            (value - alpha) / (TAU * TAU)
        );
    }

    public static Rating inactive(Rating rating, long days) {
        double deviation = rating.deviation() / SCALE;
        double periods = Math.max(0, Math.min(days, 3650));
        double inflated =
            SCALE *
            Math.sqrt(deviation * deviation + periods * rating.volatility() * rating.volatility());
        return new Rating(rating.value(), Math.min(350, inflated), rating.volatility());
    }
}
