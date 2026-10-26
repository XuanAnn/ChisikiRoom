package com.chisikiroom.battle.domain;

/** Pure rules shared by battle orchestration; no transport or persistence dependencies. */
public final class BattleRules {

    private BattleRules() {}

    public static final int MAX_PLAYERS = 4;
    public static final int QUESTION_SECONDS = 15;
    public static final int RECOVERY_SECONDS = 30;

    public static int scoreDelta(boolean winner) {
        return winner ? 10 : -5;
    }
}
